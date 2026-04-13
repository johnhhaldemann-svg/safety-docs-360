import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function isMissingCompatJobsitesView(message?: string | null) {
  return (message ?? "").toLowerCase().includes("compat_company_jobsites");
}

function isMissingJsaRelationError(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_daps") || lower.includes("company_jsas") || lower.includes("schema cache");
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

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({
      jobsites: [],
      observations: [],
      daps: [],
      permits: [],
      incidents: [],
      reports: [],
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

  const [jobsitesRaw, observationsRaw, dapsRaw, permitsRaw, incidentsRaw, reportsRaw] =
    await Promise.all([
      auth.supabase
        .from("compat_company_jobsites")
        .select("id, company_id, name, project_number, location, status, start_date, end_date, notes, created_at, updated_at")
        .eq("company_id", companyScope.companyId)
        .order("updated_at", { ascending: false }),
      auth.supabase
        .from("company_corrective_actions")
        .select("id, jobsite_id, category, status, due_at")
        .eq("company_id", companyScope.companyId)
        .order("updated_at", { ascending: false })
        .limit(500),
      auth.supabase
        .from("company_jsas")
        .select("id, jobsite_id, status")
        .eq("company_id", companyScope.companyId)
        .order("updated_at", { ascending: false })
        .limit(500),
      auth.supabase
        .from("company_permits")
        .select("id, jobsite_id, title, status, severity, sif_flag, escalation_level, stop_work_status")
        .eq("company_id", companyScope.companyId)
        .order("updated_at", { ascending: false })
        .limit(500),
      auth.supabase
        .from("company_incidents")
        .select("id, jobsite_id, title, status, severity, sif_flag, escalation_level, stop_work_status")
        .eq("company_id", companyScope.companyId)
        .order("updated_at", { ascending: false })
        .limit(500),
      auth.supabase
        .from("company_reports")
        .select("id, jobsite_id, status")
        .eq("company_id", companyScope.companyId)
        .order("updated_at", { ascending: false })
        .limit(500),
    ]);

  if (
    jobsitesRaw.error &&
    !isMissingCompatJobsitesView(jobsitesRaw.error.message)
  ) {
    return NextResponse.json(
      { error: jobsitesRaw.error.message || "Failed to load workspace summary." },
      { status: 500 }
    );
  }
  const dapsMissing = dapsRaw.error && isMissingJsaRelationError(dapsRaw.error.message);

  if (
    observationsRaw.error ||
    (!dapsMissing && dapsRaw.error) ||
    permitsRaw.error ||
    incidentsRaw.error ||
    reportsRaw.error
  ) {
    return NextResponse.json(
      {
        error:
          observationsRaw.error?.message ||
          (!dapsMissing ? dapsRaw.error?.message : null) ||
          permitsRaw.error?.message ||
          incidentsRaw.error?.message ||
          reportsRaw.error?.message ||
          "Failed to load workspace summary.",
      },
      { status: 500 }
    );
  }

  const canAccessJobsite = (jobsiteId: string | null) =>
    !jobsiteScope.restricted ||
    (Boolean(jobsiteId) && jobsiteScope.jobsiteIds.includes(jobsiteId as string));

  const jobsites = ((jobsitesRaw.data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
    canAccessJobsite(typeof row.id === "string" ? row.id : null)
  );
  const observations = ((observationsRaw.data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
    canAccessJobsite(typeof row.jobsite_id === "string" ? row.jobsite_id : null)
  );
  const dapsSource = dapsMissing ? [] : ((dapsRaw.data as Array<Record<string, unknown>> | null) ?? []);
  const daps = dapsSource.filter((row) =>
    canAccessJobsite(typeof row.jobsite_id === "string" ? row.jobsite_id : null)
  );
  const permits = ((permitsRaw.data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
    canAccessJobsite(typeof row.jobsite_id === "string" ? row.jobsite_id : null)
  );
  const incidents = ((incidentsRaw.data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
    canAccessJobsite(typeof row.jobsite_id === "string" ? row.jobsite_id : null)
  );
  const reports = ((reportsRaw.data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
    canAccessJobsite(typeof row.jobsite_id === "string" ? row.jobsite_id : null)
  );

  return NextResponse.json({
    jobsites,
    observations,
    daps,
    permits,
    incidents,
    reports,
  });
}
