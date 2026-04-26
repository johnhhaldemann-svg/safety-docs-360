import { NextResponse } from "next/server";
import type { DashboardHomeMetrics } from "@/lib/dashboardAnalytics";
import { DASHBOARD_METRICS_FIELD_HELP } from "@/lib/dashboardAnalytics";
import { buildSalesDemoDashboardMetrics } from "@/lib/demoWorkspace";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

type CountResult = { count: number | null; error: { message?: string | null } | null };

/** Supabase head-count builder after `.eq(...)` and before `.gte("created_at", since)`. */
type ScopedCountBuilder = {
  in: (col: string, vals: string[]) => ScopedCountBuilder;
  gte: (col: string, val: string) => Promise<CountResult>;
};

function withJobsiteScope(
  query: ScopedCountBuilder,
  jobsiteScoped: boolean,
  jobsiteIds: string[]
): ScopedCountBuilder {
  if (!jobsiteScoped || jobsiteIds.length === 0) {
    return query;
  }
  return query.in("jobsite_id", jobsiteIds);
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const windowDays = Math.max(1, Math.min(365, Number(searchParams.get("days") ?? "30") || 30));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  if (auth.role === "sales_demo") {
    return NextResponse.json({
      metrics: buildSalesDemoDashboardMetrics(windowDays),
      definitions: DASHBOARD_METRICS_FIELD_HELP,
    });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    const empty: DashboardHomeMetrics = {
      windowDays,
      since,
      sorReportsCount: 0,
      correctiveActionsInWindowCount: 0,
      nearMissCorrectiveActionsCount: 0,
      positiveObservationsCount: 0,
      incidentNearMissRecordsCount: 0,
      activeContractorsCount: 0,
      trainingRequirementDefinitionsCount: 0,
      jobsiteScoped: false,
    };
    return NextResponse.json({
      metrics: empty,
      definitions: DASHBOARD_METRICS_FIELD_HELP,
      warning: "Dashboard metrics are not available because no company workspace is linked to this account yet.",
    });
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
  const jobsiteScoped = jobsiteScope.restricted && jobsiteScope.jobsiteIds.length > 0;

  const companyId = companyScope.companyId;

  const sorQuery = auth.supabase
    .from("company_sor_records")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("is_deleted", false)
    .gte("created_at", since);

  const correctiveTotalQuery = withJobsiteScope(
    auth.supabase
      .from("company_corrective_actions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId) as unknown as ScopedCountBuilder,
    jobsiteScoped,
    jobsiteScope.jobsiteIds
  ).gte("created_at", since);

  const nearMissCorrQuery = withJobsiteScope(
    auth.supabase
      .from("company_corrective_actions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("observation_type", "near_miss") as unknown as ScopedCountBuilder,
    jobsiteScoped,
    jobsiteScope.jobsiteIds
  ).gte("created_at", since);

  const positiveCorrQuery = withJobsiteScope(
    auth.supabase
      .from("company_corrective_actions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("observation_type", "positive") as unknown as ScopedCountBuilder,
    jobsiteScoped,
    jobsiteScope.jobsiteIds
  ).gte("created_at", since);

  const incidentNearMissQuery = withJobsiteScope(
    auth.supabase
      .from("company_incidents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("category", "near_miss") as unknown as ScopedCountBuilder,
    jobsiteScoped,
    jobsiteScope.jobsiteIds
  ).gte("created_at", since);

  const contractorsQuery = auth.supabase
    .from("company_contractors")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("active", true);

  const trainingReqQuery = auth.supabase
    .from("company_training_requirements")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  const [
    sorRes,
    correctiveRes,
    nearMissCorrRes,
    positiveCorrRes,
    incidentNearMissRes,
    contractorsRes,
    trainingRes,
  ] = await Promise.all([
    sorQuery,
    correctiveTotalQuery,
    nearMissCorrQuery,
    positiveCorrQuery,
    incidentNearMissQuery,
    contractorsQuery,
    trainingReqQuery,
  ]);

  const results: CountResult[] = [
    sorRes as CountResult,
    correctiveRes as CountResult,
    nearMissCorrRes as CountResult,
    positiveCorrRes as CountResult,
    incidentNearMissRes as CountResult,
    contractorsRes as CountResult,
    trainingRes as CountResult,
  ];
  const firstErr = results.find((r) => r.error)?.error?.message;
  if (firstErr) {
    return NextResponse.json({ error: firstErr || "Failed to load dashboard metrics." }, { status: 500 });
  }

  const metrics: DashboardHomeMetrics = {
    windowDays,
    since,
    sorReportsCount: sorRes.count ?? 0,
    correctiveActionsInWindowCount: correctiveRes.count ?? 0,
    nearMissCorrectiveActionsCount: nearMissCorrRes.count ?? 0,
    positiveObservationsCount: positiveCorrRes.count ?? 0,
    incidentNearMissRecordsCount: incidentNearMissRes.count ?? 0,
    activeContractorsCount: contractorsRes.count ?? 0,
    trainingRequirementDefinitionsCount: trainingRes.count ?? 0,
    jobsiteScoped,
  };

  return NextResponse.json({
    metrics,
    definitions: DASHBOARD_METRICS_FIELD_HELP,
  });
}
