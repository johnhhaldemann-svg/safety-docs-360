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
type MobileAuditLocationRow = {
  id: string;
  name: string;
  status?: string | null;
  audit_customer_id: string;
  report_email?: string | null;
};
type MobileAuditCustomerRow = {
  id: string;
  name: string;
  report_email?: string | null;
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

function buildAuditCompanies(params: {
  customers: MobileAuditCustomerRow[];
  locations: MobileAuditLocationRow[];
}) {
  const groups = new Map<string, { id: string; name: string; jobsites: MobileJobsiteRow[] }>();
  for (const customer of params.customers) {
    groups.set(customer.id, { id: customer.id, name: customer.name, jobsites: [] });
  }
  for (const location of params.locations) {
    const existing = groups.get(location.audit_customer_id);
    if (!existing) continue;
    existing.jobsites.push({
      id: location.id,
      name: location.name,
      status: location.status,
      customer_company_name: existing.name,
    });
  }
  return [...groups.values()];
}

function toRecentActivityRows(params: {
  audits: Array<{ id: string; status?: string | null; created_at?: string | null }>;
  issues: Array<{ id: string; title?: string | null; status?: string | null; created_at?: string | null }>;
  jsas: Array<{ id: string; title?: string | null; status?: string | null; created_at?: string | null }>;
  permits?: Array<{ id: string; title?: string | null; status?: string | null; created_at?: string | null }>;
  incidents?: Array<{ id: string; title?: string | null; category?: string | null; review_status?: string | null; created_at?: string | null }>;
  toolbox?: Array<{ id: string; status?: string | null; conducted_at?: string | null; created_at?: string | null }>;
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
    ...(params.permits ?? []).map((permit) => ({
      id: `permit-${permit.id}`,
      label: "Permit Request",
      detail: permit.title?.trim() || `Permit ${String(permit.status ?? "draft").replaceAll("_", " ")}`,
      createdAt: permit.created_at ?? null,
      tone: permit.status === "draft" ? "warning" : "neutral",
    })),
    ...(params.incidents ?? []).map((incident) => ({
      id: `incident-${incident.id}`,
      label: String(incident.category ?? "Incident").replaceAll("_", " "),
      detail: incident.title?.trim() || `Review ${String(incident.review_status ?? "pending").replaceAll("_", " ")}`,
      createdAt: incident.created_at ?? null,
      tone: incident.review_status === "pending" ? "warning" : "neutral",
    })),
    ...(params.toolbox ?? []).map((session) => ({
      id: `toolbox-${session.id}`,
      label: "Toolbox Talk",
      detail: `Session ${String(session.status ?? "draft").replaceAll("_", " ")}`,
      createdAt: session.conducted_at ?? session.created_at ?? null,
      tone: session.status === "completed" ? "success" : "neutral",
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
        draftPermits: 1,
        pendingIncidentReviews: 1,
        toolboxSessions: 2,
        trainingAttention: 1,
        publishedReports: 2,
        approvedDocuments: 3,
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

  const auditCustomersQuery = auth.supabase
    .from("company_audit_customers")
    .select("id, name, report_email")
    .eq("company_id", companyScope.companyId)
    .neq("status", "archived")
    .order("name", { ascending: true });
  const auditLocationsQuery = auth.supabase
    .from("company_audit_customer_locations")
    .select("id, name, status, audit_customer_id, report_email")
    .eq("company_id", companyScope.companyId)
    .neq("status", "archived")
    .order("name", { ascending: true });

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
  let draftPermitsQuery = auth.supabase
    .from("company_permits")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .eq("status", "draft");
  let pendingIncidentReviewsQuery = auth.supabase
    .from("company_safety_submissions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .eq("review_status", "pending")
    .in("category", ["incident", "near_miss"]);
  let toolboxSessionsQuery = auth.supabase
    .from("company_toolbox_sessions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .gte("created_at", since);
  const trainingAttentionQuery = auth.supabase
    .from("company_employee_profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .in("readiness_status", ["needs_training", "onboarding", "limited"]);
  const publishedReportsQuery = auth.supabase
    .from("company_reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .eq("status", "published");
  const approvedDocumentsQuery = auth.supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyScope.companyId)
    .eq("status", "approved");
  let recentPermitsQuery = auth.supabase
    .from("company_permits")
    .select("id, title, status, created_at")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false })
    .limit(2);
  let recentIncidentReviewsQuery = auth.supabase
    .from("company_safety_submissions")
    .select("id, title, category, review_status, created_at")
    .eq("company_id", companyScope.companyId)
    .in("category", ["incident", "near_miss"])
    .order("created_at", { ascending: false })
    .limit(2);
  let recentToolboxQuery = auth.supabase
    .from("company_toolbox_sessions")
    .select("id, status, conducted_at, created_at")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false })
    .limit(2);

  if (jobsiteScope.restricted) {
    issuesQuery = issuesQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    jsasQuery = jsasQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    auditsQuery = auditsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    pendingAuditReviewsQuery = pendingAuditReviewsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentAuditsQuery = recentAuditsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentIssuesQuery = recentIssuesQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentJsasQuery = recentJsasQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    draftPermitsQuery = draftPermitsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    pendingIncidentReviewsQuery = pendingIncidentReviewsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    toolboxSessionsQuery = toolboxSessionsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentPermitsQuery = recentPermitsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentIncidentReviewsQuery = recentIncidentReviewsQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    recentToolboxQuery = recentToolboxQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
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
    auditCustomersResult,
    auditLocationsResult,
    draftPermits,
    pendingIncidentReviews,
    toolboxSessions,
    trainingAttention,
    publishedReports,
    approvedDocuments,
    recentPermitsResult,
    recentIncidentReviewsResult,
    recentToolboxResult,
  ] = await Promise.all([
    jobsitesQuery,
    countRows(issuesQuery as unknown as Promise<CountResult>),
    countRows(jsasQuery as unknown as Promise<CountResult>),
    countRows(auditsQuery as unknown as Promise<CountResult>),
    countRows(pendingAuditReviewsQuery as unknown as Promise<CountResult>),
    recentAuditsQuery,
    recentIssuesQuery,
    recentJsasQuery,
    auditCustomersQuery,
    auditLocationsQuery,
    countRows(draftPermitsQuery as unknown as Promise<CountResult>),
    countRows(pendingIncidentReviewsQuery as unknown as Promise<CountResult>),
    countRows(toolboxSessionsQuery as unknown as Promise<CountResult>),
    countRows(trainingAttentionQuery as unknown as Promise<CountResult>),
    countRows(publishedReportsQuery as unknown as Promise<CountResult>),
    countRows(approvedDocumentsQuery as unknown as Promise<CountResult>),
    recentPermitsQuery,
    recentIncidentReviewsQuery,
    recentToolboxQuery,
  ]);
  const jobsites = !jobsitesResult.error ? ((jobsitesResult.data ?? []) as MobileJobsiteRow[]) : [];
  const auditCustomers = !auditCustomersResult.error ? ((auditCustomersResult.data ?? []) as MobileAuditCustomerRow[]) : [];
  const auditLocations = !auditLocationsResult.error ? ((auditLocationsResult.data ?? []) as MobileAuditLocationRow[]) : [];

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
    auditCustomers,
    auditLocations,
    mobileCompanies: buildAuditCompanies({
      customers: auditCustomers,
      locations: auditLocations,
    }),
    dashboard: {
      openIssues,
      activeJsas,
      recentAudits,
      assignedJobsites: jobsites.length,
      pendingAuditReviews,
      draftPermits,
      pendingIncidentReviews,
      toolboxSessions,
      trainingAttention,
      publishedReports,
      approvedDocuments,
      lastSyncAt: new Date().toISOString(),
      recentActivity: toRecentActivityRows({
        audits: !recentAuditsResult.error ? (recentAuditsResult.data ?? []) : [],
        issues: !recentIssuesResult.error ? (recentIssuesResult.data ?? []) : [],
        jsas: !recentJsasResult.error ? (recentJsasResult.data ?? []) : [],
        permits: !recentPermitsResult.error ? (recentPermitsResult.data ?? []) : [],
        incidents: !recentIncidentReviewsResult.error ? (recentIncidentReviewsResult.data ?? []) : [],
        toolbox: !recentToolboxResult.error ? (recentToolboxResult.data ?? []) : [],
      }),
    },
  });
}
