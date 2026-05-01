import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { getInjuryWeatherDashboardData } from "@/lib/injuryWeather/service";
import {
  buildEmptyPredictiveRiskPayload,
  buildPredictiveRiskPayload,
  buildSalesDemoPredictiveRiskPayload,
  type PredictiveRiskCorrectiveActionRow,
  type PredictiveRiskIncidentRow,
  type PredictiveRiskJobsiteRow,
  type PredictiveRiskJsaActivityRow,
  type PredictiveRiskPermitRow,
} from "@/lib/predictiveRisk";

export const runtime = "nodejs";

type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };
type ScopedQueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq: (column: string, value: string | boolean) => ScopedQueryBuilder<T>;
  in: (column: string, values: string[]) => ScopedQueryBuilder<T>;
  neq: (column: string, value: string) => ScopedQueryBuilder<T>;
  gte: (column: string, value: string) => PromiseLike<QueryResult<T>>;
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
        "id, title, category, severity, priority, status, due_at, created_at, jobsite_id, sif_potential, prediction_validation_status"
      )
      .eq("company_id", companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<PredictiveRiskCorrectiveActionRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskCorrectiveActionRow>>;

  const incidentsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_incidents")
      .select(
        "id, title, description, category, severity, status, created_at, jobsite_id, sif_flag, escalation_level, prediction_validation_status"
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
      .select("id, hazard_category, status, created_at, jobsite_id")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskJsaActivityRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskJsaActivityRow>>;

  const [forecast, jobsitesRes, correctiveRes, incidentsRes, permitsRes, jsaActivitiesRes] = await Promise.all([
    getInjuryWeatherDashboardData({
      companyId,
      jobsiteId: forecastJobsiteId,
      ...(month ? { month } : {}),
    }),
    jobsitesQuery,
    correctiveQuery,
    incidentsQuery,
    permitsQuery,
    jsaActivitiesQuery,
  ]);

  const hardError =
    jobsitesRes.error?.message ||
    correctiveRes.error?.message ||
    incidentsRes.error?.message ||
    permitsRes.error?.message ||
    (jsaActivitiesRes.error && !isMissingTable(jsaActivitiesRes.error.message) ? jsaActivitiesRes.error.message : null);

  if (hardError) {
    return NextResponse.json({ error: hardError || "Failed to load predictive risk." }, { status: 500 });
  }

  return NextResponse.json(
    buildPredictiveRiskPayload({
      days,
      jobsiteId: requestedJobsiteId,
      month,
      forecast,
      jobsites: jobsitesRes.data ?? [],
      correctiveActions: correctiveRes.data ?? [],
      incidents: incidentsRes.data ?? [],
      permits: permitsRes.data ?? [],
      jsaActivities: jsaActivitiesRes.error ? [] : jsaActivitiesRes.data ?? [],
      warning:
        jobsiteScope.restricted && !requestedJobsiteId && forecastJobsiteId
          ? "Forecast headline uses your first assigned jobsite; location rankings use all assigned jobsites."
          : undefined,
    })
  );
}
