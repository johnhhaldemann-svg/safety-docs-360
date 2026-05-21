import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { getInjuryWeatherDashboardData } from "@/lib/injuryWeather/service";
import {
  buildPredictiveRiskPayload,
  buildSalesDemoPredictiveRiskPayload,
  type PredictiveRiskCorrectiveActionRow,
  type PredictiveRiskIncidentRow,
  type PredictiveRiskJobsiteRow,
  type PredictiveRiskJsaActivityRow,
  type PredictiveRiskPermitRow,
  type PredictiveRiskScheduleItemRow,
} from "@/lib/predictiveRisk";
import { listCompanyMemoryItems } from "@/lib/companyMemory/repository";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import {
  buildLlmRiskActionDrafts,
  buildRiskActionEvidencePack,
  buildRuleBasedRiskActionDrafts,
  mergeRiskActionDrafts,
} from "@/lib/riskActionPlan";
import {
  createCompanyNotification,
  listCompanyNotificationRecipients,
} from "@/lib/companyNotifications";
import type { BehaviorRiskObservationRow } from "@/lib/predictive/behaviorRisk";
import type {
  RiskActionPlanResponse,
  RiskActionRecommendation,
} from "@/types/risk-action-plan";

export const runtime = "nodejs";

type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };
type ScopedQueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq: (column: string, value: string | boolean) => ScopedQueryBuilder<T>;
  in: (column: string, values: string[]) => ScopedQueryBuilder<T>;
  neq: (column: string, value: string) => ScopedQueryBuilder<T>;
  gte: (column: string, value: string) => PromiseLike<QueryResult<T>>;
};

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function parseDays(value: unknown) {
  const n = Number(value ?? 30);
  return Math.max(1, Math.min(365, Number.isFinite(n) ? Math.floor(n) : 30));
}

function parseMode(value: unknown): RiskActionPlanResponse["mode"] {
  const raw = String(value ?? "both").trim().toLowerCase();
  if (raw === "rules" || raw === "llm" || raw === "both") return raw;
  return "both";
}

function isMissingTable(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

function applyJobsiteScope<T>(
  query: ScopedQueryBuilder<T>,
  options: { requestedJobsiteId: string | null; assignedJobsiteIds: string[] | null }
) {
  if (options.requestedJobsiteId) return query.eq("jobsite_id", options.requestedJobsiteId);
  if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) {
    return query.in("jobsite_id", options.assignedJobsiteIds);
  }
  return query;
}

function applyJobsiteIdScope<T>(
  query: ScopedQueryBuilder<T>,
  options: { requestedJobsiteId: string | null; assignedJobsiteIds: string[] | null }
) {
  if (options.requestedJobsiteId) return query.eq("id", options.requestedJobsiteId);
  if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) {
    return query.in("id", options.assignedJobsiteIds);
  }
  return query;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function itemOverlapsWindow(item: PredictiveRiskScheduleItemRow, startDate: string, endDate: string) {
  const itemStart = item.work_start_date ?? "";
  const itemEnd = item.work_end_date ?? itemStart;
  return Boolean(itemStart && itemStart <= endDate && itemEnd >= startDate);
}

function normalizeRecommendationRow(row: Record<string, unknown>): RiskActionRecommendation {
  const evidence = row.evidence_summary && typeof row.evidence_summary === "object" && !Array.isArray(row.evidence_summary)
    ? (row.evidence_summary as { evidenceRefs?: RiskActionRecommendation["evidenceRefs"] })
    : {};
  return {
    id: String(row.id ?? ""),
    kind: String(row.kind ?? "ai_risk_action"),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    confidence: Number(row.confidence ?? 0.5),
    priority: String(row.priority ?? "medium") as RiskActionRecommendation["priority"],
    targetModule: String(row.target_module ?? "predictive_risk") as RiskActionRecommendation["targetModule"],
    targetHref: String(row.target_href ?? "/analytics/predictive-model"),
    evidenceRefs: Array.isArray(evidence.evidenceRefs) ? evidence.evidenceRefs : [],
    status: String(row.status ?? "active") as RiskActionRecommendation["status"],
    ownerUserId: typeof row.owner_user_id === "string" ? row.owner_user_id : null,
    dueAt: typeof row.due_at === "string" ? row.due_at : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    acceptedAt: typeof row.accepted_at === "string" ? row.accepted_at : null,
    fieldUsedAt: typeof row.field_used_at === "string" ? row.field_used_at : null,
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
    dismissedAt: typeof row.dismissed_at === "string" ? row.dismissed_at : null,
  };
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only managers and admins can generate AI risk action plans." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const days = parseDays(body?.days);
  const requestedJobsiteId = typeof body?.jobsiteId === "string" && body.jobsiteId.trim() ? body.jobsiteId.trim() : null;
  const mode = parseMode(body?.mode);
  const warnings: string[] = [];

  if (auth.role === "sales_demo") {
    const predictiveRisk = buildSalesDemoPredictiveRiskPayload(days);
    const evidencePackSummary = buildRiskActionEvidencePack({
      days,
      jobsiteId: requestedJobsiteId,
      predictiveRisk,
      riskMemory: null,
      memoryItems: [],
    });
    const recommendations = buildRuleBasedRiskActionDrafts(evidencePackSummary).map((draft, index) => ({
      ...draft,
      id: `demo-risk-action-${index + 1}`,
      status: "active" as const,
      ownerUserId: null,
      dueAt: null,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      fieldUsedAt: null,
      resolvedAt: null,
      dismissedAt: null,
    }));
    return NextResponse.json({ recommendations, evidencePackSummary, warnings, mode } satisfies RiskActionPlanResponse);
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (requestedJobsiteId && !isJobsiteAllowed(requestedJobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You do not have access to this jobsite." }, { status: 403 });
  }
  if (jobsiteScope.restricted && jobsiteScope.jobsiteIds.length === 0) {
    return NextResponse.json({ error: "No assigned jobsites are available for this action plan." }, { status: 403 });
  }

  const companyId = companyScope.companyId;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const today = dateOnly(new Date());
  const scheduleWindowEnd = dateOnly(new Date(Date.now() + days * 86400000));
  const assignedJobsiteIds = jobsiteScope.restricted && !requestedJobsiteId ? jobsiteScope.jobsiteIds : null;
  const scopeOptions = { requestedJobsiteId, assignedJobsiteIds };

  const jobsitesQuery = applyJobsiteIdScope(
    auth.supabase
      .from("company_jobsites")
      .select("id, name, location, status")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskJobsiteRow>,
    scopeOptions
  ) as unknown as PromiseLike<QueryResult<PredictiveRiskJobsiteRow>>;
  const correctiveQuery = applyJobsiteScope(
    auth.supabase
      .from("company_corrective_actions")
      .select("id, title, category, severity, priority, status, due_at, created_at, jobsite_id, sif_potential, prediction_validation_status")
      .eq("company_id", companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<PredictiveRiskCorrectiveActionRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskCorrectiveActionRow>>;
  const incidentsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_incidents")
      .select("id, title, description, category, severity, status, created_at, jobsite_id, sif_flag, escalation_level, prediction_validation_status")
      .eq("company_id", companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<PredictiveRiskIncidentRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskIncidentRow>>;
  const permitsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_permits")
      .select("id, title, permit_type, category, severity, status, created_at, jobsite_id, sif_flag, stop_work_status, escalation_level")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskPermitRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskPermitRow>>;
  const jsaActivitiesQuery = applyJobsiteScope(
    auth.supabase
      .from("company_jsa_activities")
      .select("id, jsa_id, jobsite_id, work_date, trade, activity_name, area, crew_size, hazard_category, hazard_description, mitigation, permit_required, permit_type, planned_risk_level, status, created_at, updated_at")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskJsaActivityRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskJsaActivityRow>>;
  const scheduleItemsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_jobsite_schedule_items")
      .select("id, jobsite_id, title, work_start_date, work_end_date, trade, work_area, crew_or_contractor, crew_size, supervisor_name, risk_level, is_high_risk, hazard_categories, permit_triggers, required_controls, status, notes, created_at")
      .eq("company_id", companyId)
      .neq("status", "archived") as unknown as ScopedQueryBuilder<PredictiveRiskScheduleItemRow>,
    scopeOptions
  ) as unknown as PromiseLike<QueryResult<PredictiveRiskScheduleItemRow>>;
  const observationsQuery = auth.supabase
    .from("company_sor_records")
    .select("id, date, location, trade, category, hazard_category_code, subcategory, description, severity, status, created_at")
    .eq("company_id", companyId)
    .eq("is_deleted", false)
    .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()) as unknown as PromiseLike<QueryResult<BehaviorRiskObservationRow>>;

  const [jobsitesRes, correctiveRes, incidentsRes, permitsRes, jsaActivitiesRes, scheduleItemsRes, observationsRes, memoryRes, riskMemory] =
    await Promise.all([
      jobsitesQuery,
      correctiveQuery,
      incidentsQuery,
      permitsQuery,
      jsaActivitiesQuery,
      scheduleItemsQuery,
      observationsQuery,
      listCompanyMemoryItems(auth.supabase, companyId, { limit: 8 }),
      buildRiskMemoryStructuredContext(auth.supabase, companyId, { days, jobsiteId: requestedJobsiteId }),
    ]);

  const hardError =
    jobsitesRes.error?.message ||
    correctiveRes.error?.message ||
    incidentsRes.error?.message ||
    permitsRes.error?.message ||
    (jsaActivitiesRes.error && !isMissingTable(jsaActivitiesRes.error.message) ? jsaActivitiesRes.error.message : null) ||
    (scheduleItemsRes.error && !isMissingTable(scheduleItemsRes.error.message) ? scheduleItemsRes.error.message : null) ||
    (observationsRes.error && !isMissingTable(observationsRes.error.message) ? observationsRes.error.message : null);
  if (hardError) {
    return NextResponse.json({ error: hardError }, { status: 500 });
  }
  if (memoryRes.error) warnings.push(`Company memory unavailable: ${memoryRes.error}`);
  if (scheduleItemsRes.error && isMissingTable(scheduleItemsRes.error.message)) {
    warnings.push("Schedule data is not available yet, so planned-work pressure is excluded.");
  }

  const scheduleItems = scheduleItemsRes.error
    ? []
    : (scheduleItemsRes.data ?? []).filter((item) => itemOverlapsWindow(item, today, scheduleWindowEnd));
  const forecastJobsiteId = requestedJobsiteId ?? (jobsiteScope.restricted ? jobsiteScope.jobsiteIds[0] ?? null : null);
  const forecast = await getInjuryWeatherDashboardData({ companyId, jobsiteId: forecastJobsiteId });
  const predictiveRisk = buildPredictiveRiskPayload({
    projectId: companyId,
    days,
    jobsiteId: requestedJobsiteId,
    forecast,
    jobsites: jobsitesRes.data ?? [],
    correctiveActions: correctiveRes.data ?? [],
    incidents: incidentsRes.data ?? [],
    permits: permitsRes.data ?? [],
    jsaActivities: jsaActivitiesRes.error ? [] : jsaActivitiesRes.data ?? [],
    scheduleItems,
    observations: observationsRes.error ? [] : observationsRes.data ?? [],
  });
  const evidencePackSummary = buildRiskActionEvidencePack({
    days,
    jobsiteId: requestedJobsiteId,
    predictiveRisk,
    riskMemory,
    memoryItems: memoryRes.items,
  });

  const llm = mode === "llm" || mode === "both" ? await buildLlmRiskActionDrafts({ evidencePack: evidencePackSummary }) : { drafts: [] };
  if (llm.error) warnings.push(`LLM action generation unavailable: ${llm.error}`);
  const ruleDrafts = mode === "rules" || mode === "both" || llm.drafts.length === 0 ? buildRuleBasedRiskActionDrafts(evidencePackSummary) : [];
  const drafts = mergeRiskActionDrafts([...(llm.drafts ?? []), ...ruleDrafts]);
  if (drafts.length === 0) {
    return NextResponse.json({ recommendations: [], evidencePackSummary, warnings, mode } satisfies RiskActionPlanResponse);
  }

  const rows = drafts.map((draft) => ({
    company_id: companyId,
    jobsite_id: requestedJobsiteId,
    kind: draft.kind,
    title: draft.title,
    body: draft.body,
    confidence: draft.confidence,
    context_snapshot: {
      mode,
      generatedAt: evidencePackSummary.generatedAt,
      sourceCoverage: evidencePackSummary.sourceCoverage,
      riskMemory: evidencePackSummary.riskMemory,
    },
    created_by: auth.user.id,
    status: "active",
    priority: draft.priority,
    target_module: draft.targetModule,
    target_href: draft.targetHref,
    evidence_summary: {
      evidenceRefs: draft.evidenceRefs,
      sourceCoverage: evidencePackSummary.sourceCoverage,
    },
  }));
  const insert = await auth.supabase
    .from("company_risk_ai_recommendations")
    .insert(rows)
    .select("id, kind, title, body, confidence, created_at, status, priority, owner_user_id, due_at, target_module, target_href, evidence_summary, accepted_at, field_used_at, resolved_at, dismissed_at");
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message || "Failed to save risk action plan." }, { status: 500 });
  }

  const inserted = (insert.data ?? []) as Array<Record<string, unknown>>;
  await auth.supabase.from("company_risk_recommendation_events").insert(
    inserted.map((row) => ({
      company_id: companyId,
      recommendation_id: row.id,
      event_type: "created",
      from_status: null,
      to_status: "active",
      actor_user_id: auth.user.id,
      metadata: { mode, priority: row.priority, targetModule: row.target_module },
    }))
  );

  const recipients = await listCompanyNotificationRecipients({
    supabase: auth.supabase,
    companyId,
    roles: ["company_admin", "manager", "safety_manager"],
    includeUserIds: [auth.user.id],
  });
  await Promise.all(
    recipients.userIds.map((recipientUserId) =>
      createCompanyNotification({
        supabase: auth.supabase,
        companyId,
        recipientUserId,
        actorUserId: auth.user.id,
        eventType: "risk_recommendation",
        title: `${inserted.length} AI risk action${inserted.length === 1 ? "" : "s"} ready`,
        body: String(inserted[0]?.title ?? "New supervisor action plan is ready."),
        priority: "high",
        href: "/analytics/predictive-model",
        sourceTable: "company_risk_ai_recommendations",
        sourceId: typeof inserted[0]?.id === "string" ? inserted[0].id : null,
        metadata: { mode, jobsiteId: requestedJobsiteId, recipientLookupError: recipients.error },
      })
    )
  );

  return NextResponse.json({
    recommendations: inserted.map(normalizeRecommendationRow),
    evidencePackSummary,
    warnings,
    mode,
  } satisfies RiskActionPlanResponse);
}
