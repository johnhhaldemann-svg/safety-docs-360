import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type Params = { jobsiteId: string; surface: string };

const SURFACES = new Set([
  "overview",
  "live-view",
  "dap",
  "permits",
  "incidents",
  "reports",
  "documents",
  "analytics",
  "team",
]);

async function fetchFromSameOrigin(request: Request, path: string) {
  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}${path}`, {
    headers: request.headers,
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, status: response.status, json };
}

function filterByJobsiteId<T extends { jobsite_id?: string | null }>(rows: T[], jobsiteId: string) {
  return rows.filter((row) => row.jobsite_id === jobsiteId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_manage_company_users",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const { jobsiteId, surface } = await params;
  if (!SURFACES.has(surface)) {
    return NextResponse.json({ error: "Unknown jobsite surface." }, { status: 404 });
  }

  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  if (!scope.companyId) {
    return NextResponse.json({ error: "No company scope found for user." }, { status: 400 });
  }

  const jobsitesResult = await auth.supabase
    .from("company_jobsites")
    .select("id, company_id, name, status, project_number, location")
    .eq("id", jobsiteId)
    .maybeSingle();
  if (jobsitesResult.error) {
    return NextResponse.json(
      { error: jobsitesResult.error.message || "Failed to load jobsite." },
      { status: 500 }
    );
  }
  if (!jobsitesResult.data || jobsitesResult.data.company_id !== scope.companyId) {
    return NextResponse.json({ error: "Jobsite not found in your company scope." }, { status: 404 });
  }
  const jobsite = jobsitesResult.data;

  const [daps, permits, incidents, reports, actions, users, documents, analytics, activities] =
    await Promise.all([
      fetchFromSameOrigin(request, "/api/company/daps"),
      fetchFromSameOrigin(request, "/api/company/permits"),
      fetchFromSameOrigin(request, "/api/company/incidents"),
      fetchFromSameOrigin(request, "/api/company/reports"),
      fetchFromSameOrigin(request, "/api/company/corrective-actions"),
      fetchFromSameOrigin(request, "/api/company/users"),
      fetchFromSameOrigin(request, "/api/workspace/documents"),
      fetchFromSameOrigin(request, "/api/company/analytics/summary"),
      fetchFromSameOrigin(request, `/api/company/dap-activities?workDate=${new Date().toISOString().slice(0, 10)}`),
    ]);

  const dapsRows = filterByJobsiteId(((daps.json?.daps as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const permitsRows = filterByJobsiteId(((permits.json?.permits as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const incidentsRows = filterByJobsiteId(((incidents.json?.incidents as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const reportsRows = filterByJobsiteId(((reports.json?.reports as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const actionsRows = filterByJobsiteId(((actions.json?.actions as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>, jobsiteId);
  const docsRows = (((documents.json?.documents as unknown[]) ?? []) as Array<{ project_name?: string | null }>).filter(
    (doc) => (doc.project_name ?? "").trim().toLowerCase() === (jobsite.name ?? "").trim().toLowerCase()
  );
  const usersRows = ((users.json?.users as unknown[]) ?? []) as unknown[];
  const activitiesRows = filterByJobsiteId(
    ((activities.json?.activities as unknown[]) ?? []) as Array<{ jobsite_id?: string | null }>,
    jobsiteId
  );

  if (surface === "dap") return NextResponse.json({ jobsite, daps: dapsRows });
  if (surface === "permits") return NextResponse.json({ jobsite, permits: permitsRows });
  if (surface === "incidents") return NextResponse.json({ jobsite, incidents: incidentsRows });
  if (surface === "reports") return NextResponse.json({ jobsite, reports: reportsRows });
  if (surface === "live-view")
    return NextResponse.json({ jobsite, observations: actionsRows, activities: activitiesRows });
  if (surface === "documents") return NextResponse.json({ jobsite, documents: docsRows });
  if (surface === "team") return NextResponse.json({ jobsite, users: usersRows });
  if (surface === "analytics") {
    const summary = (analytics.json?.summary as Record<string, unknown> | undefined) ?? {};
    const riskRows = ((summary.jobsiteRiskScore as unknown[]) ?? []) as Array<{ jobsiteId?: string }>;
    return NextResponse.json({
      jobsite,
      analytics: {
        ...summary,
        jobsiteRiskScore: riskRows.filter((row) => row.jobsiteId === jobsiteId),
      },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const observationRows = (actionsRows as Array<Record<string, unknown>>) ?? [];
  const permitRows = (permitsRows as Array<Record<string, unknown>>) ?? [];
  const incidentRows = (incidentsRows as Array<Record<string, unknown>>) ?? [];
  const activityRows = (activitiesRows as Array<Record<string, unknown>>) ?? [];
  const workPlannedToday = activityRows.length;
  const activePermits = permitRows.filter((row) => String(row.status ?? "").toLowerCase() === "active").length;
  const openObservations = observationRows.filter(
    (row) => String(row.status ?? "").toLowerCase() !== "verified_closed"
  ).length;
  const highRiskItems = observationRows.filter((row) => {
    const severity = String(row.severity ?? "").toLowerCase();
    const priority = String(row.priority ?? "").toLowerCase();
    const status = String(row.status ?? "").toLowerCase();
    return severity === "high" || severity === "critical" || priority === "high" || status === "stop_work";
  }).length;
  const sifExposures = observationRows.filter((row) => Boolean(row.sif_potential)).length;
  const positiveObservations = observationRows.filter(
    (row) => String(row.observation_type ?? "").toLowerCase() === "positive"
  ).length;
  const closedToday = observationRows.filter((row) => {
    if (String(row.status ?? "").toLowerCase() !== "verified_closed") return false;
    const closedAt = String(row.closed_at ?? row.updated_at ?? "").slice(0, 10);
    return closedAt === today;
  }).length;
  const recentIncidents = [...incidentRows]
    .sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
    )
    .slice(0, 5);

  return NextResponse.json({
    jobsite,
    overview: {
      daps: dapsRows.length,
      permits: permitsRows.length,
      incidents: incidentsRows.length,
      reports: reportsRows.length,
      observations: actionsRows.length,
      documents: docsRows.length,
      users: usersRows.length,
    },
    widgets: {
      workPlannedToday,
      activePermits,
      openObservations,
      highRiskItems,
      sifExposures,
      positiveObservations,
      closedToday,
      recentIncidents,
    },
    links: {
      liveView: `/jobsites/${jobsiteId}/live-view`,
      dap: `/jobsites/${jobsiteId}/dap`,
      permits: `/jobsites/${jobsiteId}/permits`,
      incidents: `/jobsites/${jobsiteId}/incidents`,
      reports: `/jobsites/${jobsiteId}/reports`,
      documents: `/jobsites/${jobsiteId}/documents`,
      analytics: `/jobsites/${jobsiteId}/analytics`,
      team: `/jobsites/${jobsiteId}/team`,
    },
  });
}
