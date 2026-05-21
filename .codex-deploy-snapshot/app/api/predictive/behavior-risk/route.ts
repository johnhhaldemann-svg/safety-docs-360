import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { buildSalesDemoPredictiveRiskPayload } from "@/lib/predictiveRisk";
import {
  calculateBehaviorRisk,
  type BehaviorRiskCorrectiveActionRow,
  type BehaviorRiskIncidentRow,
  type BehaviorRiskJsaActivityRow,
  type BehaviorRiskObservationRow,
  type BehaviorRiskPermitRow,
} from "@/lib/predictive/behaviorRisk";

export const runtime = "nodejs";

type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };
type ScopedQueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq: (column: string, value: string | boolean) => ScopedQueryBuilder<T>;
  in: (column: string, values: string[]) => ScopedQueryBuilder<T>;
  neq: (column: string, value: string) => ScopedQueryBuilder<T>;
  gte: (column: string, value: string) => PromiseLike<QueryResult<T>>;
};

function parseLookAheadDays(value: unknown) {
  const n = Number(value ?? 7);
  return Math.max(1, Math.min(30, Number.isFinite(n) ? Math.floor(n) : 7));
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
  if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) return query.in("jobsite_id", options.assignedJobsiteIds);
  return query;
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectId = String(body?.projectId ?? "").trim();
  const requestedJobsiteId = String(body?.jobsiteId ?? "").trim() || null;
  const lookAheadDays = parseLookAheadDays(body?.lookAheadDays);
  const includeResolved = body?.includeResolved === true;

  if (auth.role === "sales_demo") {
    const behaviorRisk = buildSalesDemoPredictiveRiskPayload(lookAheadDays).behaviorRisk;
    return NextResponse.json({ projectId: projectId || "demo-company", ...behaviorRisk });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  if (projectId !== companyScope.companyId) {
    return NextResponse.json({ error: "projectId must match the authenticated company workspace." }, { status: 403 });
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
    return NextResponse.json({
      projectId,
      ...calculateBehaviorRisk({ projectId, lookAheadDays, includeResolved }),
    });
  }

  const assignedJobsiteIds = jobsiteScope.restricted && !requestedJobsiteId ? jobsiteScope.jobsiteIds : null;
  const scopeOptions = { requestedJobsiteId, assignedJobsiteIds };
  const since = new Date(Date.now() - Math.max(lookAheadDays, 14) * 24 * 60 * 60 * 1000).toISOString();
  const observationSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const jsaActivitiesQuery = applyJobsiteScope(
    auth.supabase
      .from("company_jsa_activities")
      .select(
        "id, jsa_id, jobsite_id, work_date, trade, activity_name, area, crew_size, hazard_category, hazard_description, mitigation, permit_required, permit_type, planned_risk_level, status, created_at, updated_at"
      )
      .eq("company_id", companyScope.companyId) as unknown as ScopedQueryBuilder<BehaviorRiskJsaActivityRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<BehaviorRiskJsaActivityRow>>;

  const permitsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_permits")
      .select("id, jobsite_id, permit_type, title, status, severity, created_at, due_at")
      .eq("company_id", companyScope.companyId) as unknown as ScopedQueryBuilder<BehaviorRiskPermitRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<BehaviorRiskPermitRow>>;

  const correctiveQuery = applyJobsiteScope(
    auth.supabase
      .from("company_corrective_actions")
      .select("id, jobsite_id, title, category, severity, priority, status, due_at, created_at, prediction_validation_status")
      .eq("company_id", companyScope.companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<BehaviorRiskCorrectiveActionRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<BehaviorRiskCorrectiveActionRow>>;

  const incidentsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_incidents")
      .select("id, jobsite_id, title, description, category, severity, status, created_at, occurred_at, prediction_validation_status")
      .eq("company_id", companyScope.companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<BehaviorRiskIncidentRow>,
    scopeOptions
  ).gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) as PromiseLike<QueryResult<BehaviorRiskIncidentRow>>;

  const observationsQuery = auth.supabase
    .from("company_sor_records")
    .select("id, date, location, trade, category, hazard_category_code, subcategory, description, severity, status, created_at")
    .eq("company_id", companyScope.companyId)
    .gte("created_at", observationSince) as unknown as PromiseLike<QueryResult<BehaviorRiskObservationRow>>;

  const [jsaActivitiesRes, permitsRes, correctiveRes, incidentsRes, observationsRes] = await Promise.all([
    jsaActivitiesQuery,
    permitsQuery,
    correctiveQuery,
    incidentsQuery,
    observationsQuery,
  ]);

  const hardError =
    (jsaActivitiesRes.error && !isMissingTable(jsaActivitiesRes.error.message) ? jsaActivitiesRes.error.message : null) ||
    permitsRes.error?.message ||
    correctiveRes.error?.message ||
    incidentsRes.error?.message ||
    (observationsRes.error && !isMissingTable(observationsRes.error.message) ? observationsRes.error.message : null);

  if (hardError) {
    return NextResponse.json({ error: hardError || "Failed to calculate behavior risk." }, { status: 500 });
  }

  const behaviorRisk = calculateBehaviorRisk({
    projectId,
    lookAheadDays,
    includeResolved,
    jsaActivities: jsaActivitiesRes.error ? [] : jsaActivitiesRes.data ?? [],
    permits: permitsRes.data ?? [],
    correctiveActions: correctiveRes.data ?? [],
    incidents: incidentsRes.data ?? [],
    observations: observationsRes.error ? [] : observationsRes.data ?? [],
  });

  return NextResponse.json({ projectId, ...behaviorRisk });
}
