import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { getInjuryWeatherDashboardData } from "@/lib/injuryWeather/service";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildAiSafetyFeedbackSignals,
  type AiOutputFeedbackSignalRow,
  type AiSafetyFeedbackEventRow,
  type AiSafetyFeedbackRecommendationRow,
} from "@/lib/aiSafetyFeedbackInfluence";
import {
  buildEmptyPredictiveRiskPayload,
  buildPredictiveRiskPayload,
  buildSalesDemoPredictiveRiskPayload,
  type PredictiveRiskCorrectiveActionRow,
  type PredictiveRiskIncidentRow,
  type PredictiveRiskJobsiteRow,
  type PredictiveRiskJsaActivityRow,
  type PredictiveRiskPermitRow,
  type PredictiveRiskMitigationRow,
  type PredictiveRiskScheduleItemRow,
} from "@/lib/predictiveRisk";
import type {
  AiSafetyUnifiedBucketItemRow,
  AiSafetyUnifiedConflictPairRow,
} from "@/lib/aiSafetyUnifiedContext";
import type {
  PredictiveSafetyMemoryItemRow,
  PredictiveSafetyWeatherAlertRow,
} from "@/lib/predictiveSafetyEngine";
import type { WorkScheduleInputs } from "@/lib/injuryWeather/types";
import type { BehaviorRiskObservationRow, BehaviorRiskTrainingGapRow } from "@/lib/predictive/behaviorRisk";
import {
  fieldEvidenceSignalsFromRecommendations,
  type AiSafetyFieldEvidenceRecommendationRow,
} from "@/lib/aiSafetyFieldEvidence";

export const runtime = "nodejs";

type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };
type ScopedQueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq: (column: string, value: string | boolean) => ScopedQueryBuilder<T>;
  in: (column: string, values: string[]) => ScopedQueryBuilder<T>;
  neq: (column: string, value: string) => ScopedQueryBuilder<T>;
  gte: (column: string, value: string) => PromiseLike<QueryResult<T>>;
};
type AiOutputFeedbackQueryClient = {
  from: (table: "ai_output_feedback") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        gte: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (count: number) => PromiseLike<QueryResult<AiOutputFeedbackSignalRow>>;
          };
        };
      };
    };
  };
};

function parseDays(value: string | null) {
  const n = Number(value ?? "30");
  return Math.max(1, Math.min(365, Number.isFinite(n) ? Math.floor(n) : 30));
}

function isMissingTable(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

function applyJobsiteScope<T>(
  query: ScopedQueryBuilder<T>,
  options: { requestedJobsiteId: string | null; assignedJobsiteIds: string[] | null }
) {
  if (options.requestedJobsiteId) {
    return query.eq("jobsite_id", options.requestedJobsiteId);
  }
  if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) {
    return query.in("jobsite_id", options.assignedJobsiteIds);
  }
  return query;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function loadCurrentUserAiOutputFeedback(params: {
  userId: string;
  since: string;
}): Promise<{ rows: AiOutputFeedbackSignalRow[]; unavailable: boolean }> {
  const adminClient = createSupabaseAdminClient() as unknown as AiOutputFeedbackQueryClient | null;
  if (!adminClient) return { rows: [], unavailable: true };
  const result = await adminClient
    .from("ai_output_feedback")
    .select("id,created_at,surface,source_id,outcome,reason,signal_metadata")
    .eq("created_by", params.userId)
    .gte("created_at", params.since)
    .order("created_at", { ascending: false })
    .limit(250);
  if (result.error) return { rows: [], unavailable: true };
  return {
    rows: (result.data ?? []).filter((row) => {
      const surface = String(row.surface ?? "").toLowerCase();
      return surface.startsWith("ai-engine") || surface.startsWith("risk-action-plan");
    }),
    unavailable: false,
  };
}

function itemOverlapsWindow(item: PredictiveRiskScheduleItemRow, startDate: string, endDate: string) {
  const itemStart = item.work_start_date ?? "";
  const itemEnd = item.work_end_date ?? itemStart;
  return Boolean(itemStart && itemStart <= endDate && itemEnd >= startDate);
}

function shiftHours(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return null;
  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return Math.max(0.25, Math.min(24, (endMinutes - startMinutes) / 60));
}

function scheduleDateRange(start: string, end: string) {
  const dates: Date[] = [];
  const current = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime())) return dates;
  while (current.getTime() <= last.getTime() && dates.length < 31) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function workScheduleFromScheduleItems(items: PredictiveRiskScheduleItemRow[]): Partial<WorkScheduleInputs> | undefined {
  if (items.length === 0) return undefined;
  const hours = items
    .map((item) => shiftHours(item.shift_start_time, item.shift_end_time))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const hoursPerDay = hours.length > 0 ? Math.max(...hours) : null;
  const scheduledDates = new Set<string>();
  for (const item of items) {
    const start = item.work_start_date ?? "";
    const end = item.work_end_date ?? start;
    for (const date of scheduleDateRange(start, end)) {
      scheduledDates.add(dateOnly(date));
    }
  }
  const weekendWork = [...scheduledDates].some((value) => {
    const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
    return day === 0 || day === 6;
  });
  const denseWeek = scheduledDates.size >= 7;
  if (!weekendWork && !denseWeek && hoursPerDay == null) return undefined;
  return {
    workSevenDaysPerWeek: weekendWork || denseWeek,
    hoursPerDay,
  };
}

function applyJobsiteIdScope<T>(
  query: ScopedQueryBuilder<T>,
  options: { requestedJobsiteId: string | null; assignedJobsiteIds: string[] | null }
) {
  if (options.requestedJobsiteId) {
    return query.eq("id", options.requestedJobsiteId);
  }
  if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) {
    return query.in("id", options.assignedJobsiteIds);
  }
  return query;
}

type TrainingRecordRow = {
  id?: string | null;
  employee_id?: string | null;
  title?: string | null;
  status?: string | null;
  expires_on?: string | null;
};

type FieldAuditObservationRow = {
  id?: string | null;
  jobsite_id?: string | null;
  trade_code?: string | null;
  sub_trade_code?: string | null;
  task_code?: string | null;
  category_code?: string | null;
  category_label?: string | null;
  item_label?: string | null;
  status?: string | null;
  severity?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

function trainingGapsFromRecords(rows: TrainingRecordRow[], scheduleWindowEnd: string): BehaviorRiskTrainingGapRow[] {
  return rows
    .filter((row) => {
      const status = String(row.status ?? "").toLowerCase();
      const expiresOn = row.expires_on ?? "";
      return (
        status.includes("expired") ||
        status.includes("missing") ||
        status.includes("overdue") ||
        status.includes("not_ready") ||
        Boolean(expiresOn && expiresOn <= scheduleWindowEnd)
      );
    })
    .map((row): BehaviorRiskTrainingGapRow => ({
      id: row.id ?? null,
      worker_id: row.employee_id ?? null,
      requirement: row.title ?? "Required training",
      status: row.status ?? null,
      expires_at: row.expires_on ?? null,
    }));
}

function observationsFromFieldAuditRows(rows: FieldAuditObservationRow[]): BehaviorRiskObservationRow[] {
  return rows.map((row): BehaviorRiskObservationRow => ({
    id: row.id ?? null,
    jobsite_id: row.jobsite_id ?? null,
    trade: row.trade_code ?? row.sub_trade_code ?? null,
    category: row.category_label ?? row.category_code ?? null,
    hazard_category_code: row.category_code ?? row.task_code ?? null,
    subcategory: row.task_code ?? null,
    description: row.notes ?? row.item_label ?? "Field audit observation",
    severity: row.severity ?? null,
    status: row.status === "fail" ? "inspection_failure" : row.status ?? null,
    observation_type: "field_audit",
    created_at: row.created_at ?? null,
  }));
}

function fieldEvidenceRowsForScope(
  rows: AiSafetyFieldEvidenceRecommendationRow[],
  options: { requestedJobsiteId: string | null; assignedJobsiteIds: string[] | null },
) {
  return rows.filter((row) => {
    const jobsiteId = row.jobsite_id ?? null;
    if (options.requestedJobsiteId) return !jobsiteId || jobsiteId === options.requestedJobsiteId;
    if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) return !jobsiteId || options.assignedJobsiteIds.includes(jobsiteId);
    return true;
  });
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const days = parseDays(searchParams.get("days"));
  const requestedJobsiteId = searchParams.get("jobsiteId")?.trim() || null;
  const month = searchParams.get("month")?.trim() || null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const today = dateOnly(new Date());
  const scheduleWindowEnd = dateOnly(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

  if (auth.role === "sales_demo") {
    return NextResponse.json(buildSalesDemoPredictiveRiskPayload(days));
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      buildEmptyPredictiveRiskPayload(
        days,
        "Predictive risk is not available because no company workspace is linked to this account yet."
      )
    );
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
    return NextResponse.json(
      buildEmptyPredictiveRiskPayload(days, "No assigned jobsites are available for predictive risk yet.")
    );
  }

  const assignedJobsiteIds = jobsiteScope.restricted && !requestedJobsiteId ? jobsiteScope.jobsiteIds : null;
  const forecastJobsiteId = requestedJobsiteId ?? (jobsiteScope.restricted ? jobsiteScope.jobsiteIds[0] ?? null : null);
  const scopeOptions = { requestedJobsiteId, assignedJobsiteIds };
  const companyId = companyScope.companyId;

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
      .select(
        "id, title, category, severity, priority, status, due_at, created_at, jobsite_id, sif_potential, prediction_validation_status, prediction_review_rating, prediction_review_tags"
      )
      .eq("company_id", companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<PredictiveRiskCorrectiveActionRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskCorrectiveActionRow>>;

  const incidentsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_incidents")
      .select(
        "id, title, description, category, severity, status, created_at, jobsite_id, sif_flag, escalation_level, prediction_validation_status, prediction_review_rating, prediction_review_tags"
      )
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
      .select(
        "id, jsa_id, jobsite_id, work_date, trade, activity_name, area, crew_size, hazard_category, hazard_description, mitigation, permit_required, permit_type, planned_risk_level, status, created_at, updated_at"
      )
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskJsaActivityRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskJsaActivityRow>>;

  const scheduleItemsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_jobsite_schedule_items")
      .select(
        "id, jobsite_id, title, work_start_date, work_end_date, shift_start_time, shift_end_time, trade, work_area, crew_or_contractor, crew_size, supervisor_name, risk_level, is_high_risk, hazard_categories, permit_triggers, required_controls, status, notes, created_at"
      )
      .eq("company_id", companyId)
      .neq("status", "archived") as unknown as ScopedQueryBuilder<PredictiveRiskScheduleItemRow>,
    scopeOptions
  ) as unknown as PromiseLike<QueryResult<PredictiveRiskScheduleItemRow>>;

  const observationsQuery = auth.supabase
    .from("company_sor_records")
    .select("id, date, location, trade, category, hazard_category_code, subcategory, description, severity, status, created_at, prediction_validation_status, prediction_review_rating, prediction_review_tags")
    .eq("company_id", companyId)
    .eq("is_deleted", false)
    .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) as unknown as PromiseLike<QueryResult<BehaviorRiskObservationRow>>;
  const fieldAuditObservationsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_jobsite_audit_observations")
      .select("id, jobsite_id, trade_code, sub_trade_code, task_code, category_code, category_label, item_label, status, severity, notes, created_at")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<FieldAuditObservationRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<FieldAuditObservationRow>>;
  const mitigationsQuery = auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, title, status, priority, mitigation_state, risk_reduction_points")
    .eq("company_id", companyId)
    .in("status", ["field_used", "resolved"]) as unknown as PromiseLike<QueryResult<PredictiveRiskMitigationRow>>;
  const trainingRecordsQuery = auth.supabase
    .from("company_employee_training_records")
    .select("id, employee_id, title, status, expires_on")
    .eq("company_id", companyId) as unknown as PromiseLike<QueryResult<TrainingRecordRow>>;
  const weatherAlertsQuery = applyJobsiteScope(
    auth.supabase
      .from("weather_alert_events")
      .select("id, jobsite_id, event_name, headline, severity, urgency, certainty, effective_at, expires_at, created_at")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveSafetyWeatherAlertRow>,
    scopeOptions
  ) as unknown as PromiseLike<QueryResult<PredictiveSafetyWeatherAlertRow>>;
  const memoryItemsQuery = auth.supabase
    .from("company_memory_items")
    .select("id, title, summary, content, body, source, source_type, created_at")
    .eq("company_id", companyId) as unknown as PromiseLike<QueryResult<PredictiveSafetyMemoryItemRow>>;
  const fieldEvidenceQuery = auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, jobsite_id, title, body, confidence, status, evidence_summary, created_at")
    .eq("company_id", companyId)
    .eq("kind", "ai_safety_field_evidence")
    .in("status", ["active", "accepted", "assigned", "field_used"])
    .gte("created_at", since) as unknown as PromiseLike<QueryResult<AiSafetyFieldEvidenceRecommendationRow>>;
  const safetyIntelligenceBucketsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_bucket_items")
      .select("id, jobsite_id, bucket_key, bucket_type, starts_at, ends_at, bucket_payload, rule_results, conflict_results, created_at, updated_at")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<AiSafetyUnifiedBucketItemRow>,
    scopeOptions
  ).gte("updated_at", since) as PromiseLike<QueryResult<AiSafetyUnifiedBucketItemRow>>;
  const safetyIntelligenceConflictsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_conflict_pairs")
      .select("id, jobsite_id, bucket_run_id, left_operation_id, right_operation_id, conflict_code, conflict_type, severity, status, rationale, recommended_controls, overlap_scope, updated_at")
      .eq("company_id", companyId)
      .in("status", ["open", "active"]) as unknown as ScopedQueryBuilder<AiSafetyUnifiedConflictPairRow>,
    scopeOptions
  ).gte("updated_at", since) as PromiseLike<QueryResult<AiSafetyUnifiedConflictPairRow>>;
  const feedbackRecommendationsQuery = auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, kind, title, body, status, priority, created_at, due_at, accepted_at, field_used_at, resolved_at, dismissed_at, target_module, target_href, jobsite_id, mitigation_state, risk_reduction_points, evidence_summary")
    .eq("company_id", companyId)
    .gte("created_at", since) as unknown as PromiseLike<QueryResult<AiSafetyFeedbackRecommendationRow>>;
  const feedbackEventsQuery = auth.supabase
    .from("company_risk_recommendation_events")
    .select("id, recommendation_id, event_type, to_status, metadata, created_at")
    .eq("company_id", companyId)
    .gte("created_at", since) as unknown as PromiseLike<QueryResult<AiSafetyFeedbackEventRow>>;
  const aiOutputFeedbackQuery = loadCurrentUserAiOutputFeedback({ userId: auth.user.id, since });

  const [
    jobsitesRes,
    correctiveRes,
    incidentsRes,
    permitsRes,
    jsaActivitiesRes,
    scheduleItemsRes,
    observationsRes,
    fieldAuditObservationsRes,
    mitigationsRes,
    trainingRecordsRes,
    weatherAlertsRes,
    memoryItemsRes,
    fieldEvidenceRes,
    safetyIntelligenceBucketsRes,
    safetyIntelligenceConflictsRes,
    feedbackRecommendationsRes,
    feedbackEventsRes,
    aiOutputFeedbackRes,
  ] = await Promise.all([
    jobsitesQuery,
    correctiveQuery,
    incidentsQuery,
    permitsQuery,
    jsaActivitiesQuery,
    scheduleItemsQuery,
    observationsQuery,
    fieldAuditObservationsQuery,
    mitigationsQuery,
    trainingRecordsQuery,
    weatherAlertsQuery,
    memoryItemsQuery,
    fieldEvidenceQuery,
    safetyIntelligenceBucketsQuery,
    safetyIntelligenceConflictsQuery,
    feedbackRecommendationsQuery,
    feedbackEventsQuery,
    aiOutputFeedbackQuery,
  ]);

  const scheduleItems = scheduleItemsRes.error
    ? []
    : (scheduleItemsRes.data ?? []).filter((item) => itemOverlapsWindow(item, today, scheduleWindowEnd));
  const trainingGaps = trainingRecordsRes.error ? undefined : trainingGapsFromRecords(trainingRecordsRes.data ?? [], scheduleWindowEnd);
  const observations = [
    ...(observationsRes.error ? [] : observationsRes.data ?? []),
    ...(fieldAuditObservationsRes.error ? [] : observationsFromFieldAuditRows(fieldAuditObservationsRes.data ?? [])),
  ];
  const fieldEvidenceSignals = fieldEvidenceSignalsFromRecommendations(
    fieldEvidenceRowsForScope(fieldEvidenceRes.error ? [] : fieldEvidenceRes.data ?? [], scopeOptions),
  );
  const workSchedule = workScheduleFromScheduleItems(scheduleItems);
  const forecast = await getInjuryWeatherDashboardData({
    companyId,
    jobsiteId: forecastJobsiteId,
    ...(month ? { month } : {}),
    ...(workSchedule ? { workSchedule } : {}),
  });

  const hardError =
    jobsitesRes.error?.message ||
    correctiveRes.error?.message ||
    incidentsRes.error?.message ||
    permitsRes.error?.message ||
    (jsaActivitiesRes.error && !isMissingTable(jsaActivitiesRes.error.message) ? jsaActivitiesRes.error.message : null) ||
    (scheduleItemsRes.error && !isMissingTable(scheduleItemsRes.error.message) ? scheduleItemsRes.error.message : null) ||
    (observationsRes.error && !isMissingTable(observationsRes.error.message) ? observationsRes.error.message : null) ||
    (fieldAuditObservationsRes.error && !isMissingTable(fieldAuditObservationsRes.error.message) ? fieldAuditObservationsRes.error.message : null) ||
    (mitigationsRes.error && !isMissingTable(mitigationsRes.error.message) ? mitigationsRes.error.message : null) ||
    (fieldEvidenceRes.error && !isMissingTable(fieldEvidenceRes.error.message) ? fieldEvidenceRes.error.message : null) ||
    (safetyIntelligenceBucketsRes.error && !isMissingTable(safetyIntelligenceBucketsRes.error.message) ? safetyIntelligenceBucketsRes.error.message : null) ||
    (safetyIntelligenceConflictsRes.error && !isMissingTable(safetyIntelligenceConflictsRes.error.message) ? safetyIntelligenceConflictsRes.error.message : null) ||
    (feedbackRecommendationsRes.error && !isMissingTable(feedbackRecommendationsRes.error.message) ? feedbackRecommendationsRes.error.message : null) ||
    (feedbackEventsRes.error && !isMissingTable(feedbackEventsRes.error.message) ? feedbackEventsRes.error.message : null);

  if (hardError) {
    return NextResponse.json({ error: hardError || "Failed to load predictive risk." }, { status: 500 });
  }

  return NextResponse.json(
    buildPredictiveRiskPayload({
      projectId: companyId,
      days,
      jobsiteId: requestedJobsiteId,
      month,
      forecast,
      jobsites: jobsitesRes.data ?? [],
      correctiveActions: correctiveRes.data ?? [],
      incidents: incidentsRes.data ?? [],
      permits: permitsRes.data ?? [],
      jsaActivities: jsaActivitiesRes.error ? [] : jsaActivitiesRes.data ?? [],
      scheduleItems,
      observations,
      trainingGaps,
      weatherAlerts: weatherAlertsRes.error ? undefined : weatherAlertsRes.data ?? [],
      memoryItems: memoryItemsRes.error ? undefined : memoryItemsRes.data ?? [],
      fieldEvidenceSignals,
      safetyIntelligenceBucketItems: safetyIntelligenceBucketsRes.error ? [] : safetyIntelligenceBucketsRes.data ?? [],
      safetyIntelligenceConflictPairs: safetyIntelligenceConflictsRes.error ? [] : safetyIntelligenceConflictsRes.data ?? [],
      feedbackSignals: buildAiSafetyFeedbackSignals({
        recommendations: feedbackRecommendationsRes.error ? [] : feedbackRecommendationsRes.data ?? [],
        events: feedbackEventsRes.error ? [] : feedbackEventsRes.data ?? [],
        aiOutputFeedback: aiOutputFeedbackRes.rows,
      }),
      aiSafetyRecommendations: feedbackRecommendationsRes.error ? [] : feedbackRecommendationsRes.data ?? [],
      aiSafetyRecommendationEvents: feedbackEventsRes.error ? [] : feedbackEventsRes.data ?? [],
      riskMitigations: mitigationsRes.error ? [] : mitigationsRes.data ?? [],
      warning:
        scheduleItemsRes.error && isMissingTable(scheduleItemsRes.error.message)
          ? "Work schedule data is not available yet. Run the latest Supabase migration to include schedule pressure in predictive risk."
          : aiOutputFeedbackRes.unavailable
          ? "AI output feedback storage is unavailable; predictive risk is using recommendation workflow events only for feedback influence."
          : jobsiteScope.restricted && !requestedJobsiteId && forecastJobsiteId
          ? "Forecast headline uses your first assigned jobsite; location rankings use all assigned jobsites."
          : undefined,
    })
  );
}
