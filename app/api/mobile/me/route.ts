import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import {
  resolveMobileFeatureMap,
  visibleMobileFeatures,
  type MobileFeatureOverride,
} from "@/lib/mobileEntitlements";

export const runtime = "nodejs";

type CountResult = { count: number | null; error: { message?: string | null } | null };

function isMissingEntitlementTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_mobile_feature_entitlements");
}

async function loadMobileOverrides(params: {
  supabase: {
    from: (table: string) => unknown;
  };
  companyId: string;
  userId: string;
}) {
  const query = params.supabase.from("company_mobile_feature_entitlements") as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        is: (column: string, value: null) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
      };
      or: (filter: string) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
      };
    };
  };

  const companyResult = await query
    .select("feature, enabled")
    .eq("company_id", params.companyId)
    .is("user_id", null);

  if (companyResult.error) {
    if (isMissingEntitlementTable(companyResult.error.message)) {
      return { companyOverrides: [], userOverrides: [] };
    }
    return { companyOverrides: [], userOverrides: [] };
  }

  const userQuery = params.supabase.from("company_mobile_feature_entitlements") as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
      };
    };
  };
  const userResult = await userQuery
    .select("feature, enabled")
    .eq("company_id", params.companyId)
    .eq("user_id", params.userId);

  return {
    companyOverrides: (companyResult.data as MobileFeatureOverride[] | null) ?? [],
    userOverrides: !userResult.error ? ((userResult.data as MobileFeatureOverride[] | null) ?? []) : [],
  };
}

async function countRows(
  query: Promise<CountResult>
) {
  const result = await query;
  if (result.error) return 0;
  return result.count ?? 0;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_dashboards",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_create_documents",
      "can_submit_documents",
      "can_manage_observations",
    ],
  });
  if ("error" in auth) return auth.error;

  if (auth.role === "sales_demo") {
    const featureMap = resolveMobileFeatureMap({
      role: auth.role,
      permissionMap: auth.permissionMap,
      userOverrides: [
        { feature: "mobile_dashboard", enabled: true },
        { feature: "mobile_jsa", enabled: true },
        { feature: "mobile_field_issues", enabled: true },
        { feature: "mobile_field_audits", enabled: true },
        { feature: "mobile_photos", enabled: true },
        { feature: "mobile_signatures", enabled: true },
      ],
    });
    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email ?? "",
        role: auth.role,
        team: auth.team,
        companyId: "demo-company",
        companyName: "Summit Ridge Constructors",
      },
      featureMap,
      features: visibleMobileFeatures(featureMap),
      jobsites: [
        { id: "demo-jobsite-1", name: "Summit Ridge Tower" },
        { id: "demo-jobsite-2", name: "West Yard Expansion" },
      ],
      dashboard: {
        openIssues: 4,
        activeJsas: 3,
        recentAudits: 2,
        assignedJobsites: 2,
      },
    });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    const featureMap = resolveMobileFeatureMap({
      role: auth.role,
      permissionMap: auth.permissionMap,
      userOverrides: [],
    });
    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email ?? "",
        role: auth.role,
        team: auth.team,
        companyId: null,
        companyName: "",
      },
      featureMap,
      features: visibleMobileFeatures(featureMap),
      jobsites: [],
      dashboard: {
        openIssues: 0,
        activeJsas: 0,
        recentAudits: 0,
        assignedJobsites: 0,
      },
    });
  }

  const [overrides, jobsiteScope] = await Promise.all([
    loadMobileOverrides({
      supabase: auth.supabase as never,
      companyId: companyScope.companyId,
      userId: auth.user.id,
    }),
    getJobsiteAccessScope({
      supabase: auth.supabase,
      userId: auth.user.id,
      companyId: companyScope.companyId,
      role: auth.role,
    }),
  ]);
  const featureMap = resolveMobileFeatureMap({
    role: auth.role,
    permissionMap: auth.permissionMap,
    companyOverrides: overrides.companyOverrides,
    userOverrides: overrides.userOverrides,
  });

  let jobsitesQuery = auth.supabase
    .from("company_jobsites")
    .select("id, name, status")
    .eq("company_id", companyScope.companyId)
    .order("name", { ascending: true });
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({
        user: {
          id: auth.user.id,
          email: auth.user.email ?? "",
          role: auth.role,
          team: auth.team,
          companyId: companyScope.companyId,
          companyName: companyScope.companyName,
        },
        featureMap,
        features: visibleMobileFeatures(featureMap),
        jobsites: [],
        dashboard: {
          openIssues: 0,
          activeJsas: 0,
          recentAudits: 0,
          assignedJobsites: 0,
        },
      });
    }
    jobsitesQuery = jobsitesQuery.in("id", jobsiteScope.jobsiteIds);
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let issuesQuery = auth.supabase
    .from("company_corrective_actions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .in("status", ["open", "assigned", "in_progress", "corrected", "escalated", "stop_work"]);
  let jsasQuery = auth.supabase
    .from("company_jsas")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .in("status", ["draft", "active", "submitted"]);
  let auditsQuery = auth.supabase
    .from("company_jobsite_audits")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .gte("created_at", since);

  if (jobsiteScope.restricted) {
    issuesQuery = issuesQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    jsasQuery = jsasQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    auditsQuery = auditsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const [jobsitesResult, openIssues, activeJsas, recentAudits] = await Promise.all([
    jobsitesQuery,
    countRows(issuesQuery as unknown as Promise<CountResult>),
    countRows(jsasQuery as unknown as Promise<CountResult>),
    countRows(auditsQuery as unknown as Promise<CountResult>),
  ]);

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email ?? "",
      role: auth.role,
      team: auth.team,
      companyId: companyScope.companyId,
      companyName: companyScope.companyName,
    },
    featureMap,
    features: visibleMobileFeatures(featureMap),
    jobsites: !jobsitesResult.error ? jobsitesResult.data ?? [] : [],
    dashboard: {
      openIssues,
      activeJsas,
      recentAudits,
      assignedJobsites: !jobsitesResult.error ? (jobsitesResult.data ?? []).length : 0,
    },
  });
}
