import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import {
  linkedContractorIdFromUser,
  parseDashboardRiskLevel,
  userMaySelectAnyCompanyContractor,
} from "@/lib/dashboardOverviewAccess";
import { resolveOverviewDateParams } from "@/lib/dashboardOverviewDates";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { resolveContractorIdForCompany } from "@/lib/riskMemory/contractorScope";
import { getDashboardOverview } from "@/src/lib/dashboard/getDashboardOverview";
import type { DashboardOverview } from "@/src/lib/dashboard/types";

export const runtime = "nodejs";

function buildServiceFailureOverview(): DashboardOverview {
  const lastChecked = new Date().toISOString();
  return {
    summary: {
      safetyHealthScore: 0,
      openHighRiskItems: 0,
      overdueCorrectiveActions: 0,
      incidentCount: 0,
      nearMissCount: 0,
      permitComplianceRate: 0,
      jsaCompletionRate: 0,
      trainingReadinessRate: 0,
      documentReadinessRate: 0,
    },
    incidentTrend: [],
    observationTrend: [],
    correctiveActionStatus: { open: 0, overdue: 0, closed: 0, averageDaysToClose: null },
    topRisks: [],
    contractorRiskScores: [],
    permitCompliance: [],
    documentReadiness: {
      draft: 0,
      submitted: 0,
      underReview: 0,
      approved: 0,
      rejected: 0,
      missingRequired: 0,
      expiringSoon: 0,
    },
    engineHealth: [
      {
        moduleName: "Dashboard data service",
        status: "red",
        lastChecked,
        message: "The dashboard overview service failed unexpectedly. No live metrics were returned.",
      },
    ],
    aiInsights: [
      {
        id: "insight-dashboard-overview-fallback",
        title: "Dashboard data could not be loaded",
        body: "We could not assemble your safety overview for this request. You can refresh the page to try again. If the problem continues, contact your administrator; detailed error information is not shown here for security.",
      },
    ],
    overdueCorrectiveSamples: [],
    observationCategoryTop: [],
    credentialGaps: { expiredCredentials: 0, expiringSoonCredentials: 0 },
  };
}

function trimParam(value: string | null): string | undefined {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : undefined;
}

export async function GET(req: Request) {
  const auth = await authorizeRequest(req, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (companyScope.companyId && (await companyHasCsepPlanName(auth.supabase, companyScope.companyId))) {
    return csepWorkspaceForbiddenResponse();
  }

  const { searchParams } = new URL(req.url);
  const jobsiteId = trimParam(searchParams.get("jobsiteId"));
  const riskLevel = parseDashboardRiskLevel(searchParams.get("riskLevel"));
  const { startDate, endDate } = resolveOverviewDateParams({
    range: searchParams.get("range"),
    startDate: searchParams.get("startDate"),
    endDate: searchParams.get("endDate"),
  });

  const jobsiteScope = companyScope.companyId
    ? await getJobsiteAccessScope({
        supabase: auth.supabase,
        userId: auth.user.id,
        companyId: companyScope.companyId,
        role: auth.role,
      })
    : { restricted: false as const, jobsiteIds: [] as string[] };

  if (jobsiteId && !isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "That jobsite is not available for this account." }, { status: 403 });
  }

  const jobsiteIdAllowlist =
    jobsiteScope.restricted && !jobsiteId && jobsiteScope.jobsiteIds.length > 0 ? jobsiteScope.jobsiteIds : null;

  const linked = linkedContractorIdFromUser(auth.user);
  const mayPickContractor = userMaySelectAnyCompanyContractor({
    role: auth.role,
    permissionMap: auth.permissionMap,
  });

  let contractorId = trimParam(searchParams.get("contractorId"));
  if (companyScope.companyId && linked) {
    const resolved = await resolveContractorIdForCompany(auth.supabase, companyScope.companyId, linked);
    contractorId = resolved ?? undefined;
  } else if (companyScope.companyId && contractorId) {
    if (!mayPickContractor) {
      contractorId = undefined;
    } else {
      const resolved = await resolveContractorIdForCompany(auth.supabase, companyScope.companyId, contractorId);
      contractorId = resolved ?? undefined;
    }
  } else {
    contractorId = undefined;
  }

  try {
    const overview = await getDashboardOverview({
      jobsiteId,
      jobsiteIdAllowlist,
      contractorId,
      startDate,
      endDate,
      riskLevel,
    });
    return NextResponse.json(overview);
  } catch {
    console.error("[api/dashboard/overview] getDashboardOverview threw");
    return NextResponse.json(buildServiceFailureOverview());
  }
}
