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
type RecentActivityRow = {
  id: string;
  label: string;
  detail: string;
  createdAt: string | null;
  tone: "neutral" | "warning" | "success";
};
type MobileJobsiteRow = {
  id: string;
  name: string;
  status?: string | null;
  customer_company_name?: string | null;
};

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

function buildMobileCompanies(params: {
  companyId: string;
  companyName: string;
  jobsites: MobileJobsiteRow[];
}) {
  const groups = new Map<string, { id: string; name: string; jobsites: MobileJobsiteRow[] }>();
  const fallbackName = params.companyName || "Company";
  for (const jobsite of params.jobsites) {
    const name = (jobsite.customer_company_name ?? "").trim() || fallbackName;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || params.companyId;
    const existing = groups.get(id) ?? { id, name, jobsites: [] };
    existing.jobsites.push(jobsite);
    groups.set(id, existing);
  }
  if (groups.size < 1) {
    groups.set(params.companyId, { id: params.companyId, name: fallbackName, jobsites: [] });
  }
  return [...groups.values()];
}

function toRecentActivityRows(params: {
  audits: Array<{ id: string; status?: string | null; created_at?: string | null }>;
  issues: Array<{ id: string; title?: string | null; status?: string | null; created_at?: string | null }>;
  jsas: Array<{ id: string; title?: string | null; status?: string | null; created_at?: string | null }>;
}): RecentActivityRow[] {
  return [
    ...params.audits.map((audit) => ({
      id: `audit-${audit.id}`,
      label: "Field Audit",
      detail: `Audit ${String(audit.status ?? "submitted").replaceAll("_", " ")}`,
      createdAt: audit.created_at ?? null,
      tone: audit.status === "pending_review" ? "warning" : "success",
    })),
    ...params.issues.map((issue) => ({
      id: `issue-${issue.id}`,
      label: "Field Issue",
      detail: issue.title?.trim() || `Issue ${String(issue.status ?? "open").replaceAll("_", " ")}`,
      createdAt: issue.created_at ?? null,
      tone: "neutral",
    })),
    ...params.jsas.map((jsa) => ({
      id: `jsa-${jsa.id}`,
      label: "JSA",
      detail: jsa.title?.trim() || `JSA ${String(jsa.status ?? "active").replaceAll("_", " ")}`,
      createdAt: jsa.created_at ?? null,
      tone: "neutral",
    })),
  ]
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")))
    .slice(0, 5) as RecentActivityRow[];
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
        { id: "demo-jobsite-1", name: "Summit Ridge Tower", customer_company_name: "Summit Ridge Development" },
        { id: "demo-jobsite-2", name: "West Yard Expansion", customer_company_name: "West Yard Logistics" },
      ],
      mobileCompanies: [
        {
          id: "summit-ridge-development",
          name: "Summit Ridge Development",
          jobsites: [{ id: "demo-jobsite-1", name: "Summit Ridge Tower", customer_company_name: "Summit Ridge Development" }],
        },
        {
          id: "west-yard-logistics",
          name: "West Yard Logistics",
          jobsites: [{ id: "demo-jobsite-2", name: "West Yard Expansion", customer_company_name: "West Yard Logistics" }],
        },
      ],
      dashboard: {
        openIssues: 4,
        activeJsas: 3,
        recentAudits: 2,
        assignedJobsites: 2,
        pendingAuditReviews: 1,
        lastSyncAt: new Date().toISOString(),
        recentActivity: [
          {
            id: "demo-audit-activity",
            label: "Field Audit",
            detail: "Audit pending review",
            createdAt: new Date().toISOString(),
            tone: "warning",
          },
        ],
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
      mobileCompanies: [],
      dashboard: {
        openIssues: 0,
        activeJsas: 0,
        recentAudits: 0,
        assignedJobsites: 0,
        pendingAuditReviews: 0,
        lastSyncAt: new Date().toISOString(),
        recentActivity: [],
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
    .select("id, name, status, customer_company_name")
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
        mobileCompanies: [],
        dashboard: {
          openIssues: 0,
          activeJsas: 0,
          recentAudits: 0,
          assignedJobsites: 0,
          pendingAuditReviews: 0,
          lastSyncAt: new Date().toISOString(),
          recentActivity: [],
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
  let pendingAuditReviewsQuery = auth.supabase
    .from("company_jobsite_audits")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .eq("status", "pending_review");
  let recentAuditsQuery = auth.supabase
    .from("company_jobsite_audits")
    .select("id, status, created_at")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false })
    .limit(3);
  let recentIssuesQuery = auth.supabase
    .from("company_corrective_actions")
    .select("id, title, status, created_at")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false })
    .limit(3);
  let recentJsasQuery = auth.supabase
    .from("company_jsas")
    .select("id, title, status, created_at")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (jobsiteScope.restricted) {
    issuesQuery = issuesQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    jsasQuery = jsasQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    auditsQuery = auditsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    pendingAuditReviewsQuery = pendingAuditReviewsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentAuditsQuery = recentAuditsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentIssuesQuery = recentIssuesQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentJsasQuery = recentJsasQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const [
    jobsitesResult,
    openIssues,
    activeJsas,
    recentAudits,
    pendingAuditReviews,
    recentAuditsResult,
    recentIssuesResult,
    recentJsasResult,
  ] = await Promise.all([
    jobsitesQuery,
    countRows(issuesQuery as unknown as Promise<CountResult>),
    countRows(jsasQuery as unknown as Promise<CountResult>),
    countRows(auditsQuery as unknown as Promise<CountResult>),
    countRows(pendingAuditReviewsQuery as unknown as Promise<CountResult>),
    recentAuditsQuery,
    recentIssuesQuery,
    recentJsasQuery,
  ]);
  const jobsites = !jobsitesResult.error ? ((jobsitesResult.data ?? []) as MobileJobsiteRow[]) : [];

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
    jobsites,
    mobileCompanies: buildMobileCompanies({
      companyId: companyScope.companyId,
      companyName: companyScope.companyName,
      jobsites,
    }),
    dashboard: {
      openIssues,
      activeJsas,
      recentAudits,
      assignedJobsites: jobsites.length,
      pendingAuditReviews,
      lastSyncAt: new Date().toISOString(),
      recentActivity: toRecentActivityRows({
        audits: !recentAuditsResult.error ? (recentAuditsResult.data ?? []) : [],
        issues: !recentIssuesResult.error ? (recentIssuesResult.data ?? []) : [],
        jsas: !recentJsasResult.error ? (recentJsasResult.data ?? []) : [],
      }),
    },
  });
}
