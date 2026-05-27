import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { summarizeOshaLogCases } from "@/lib/oshaLogs";
import type { OshaLogCaseRow } from "@/lib/oshaLogs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
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
    return NextResponse.json({ summary: summarizeOshaLogCases([]) });
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const url = new URL(request.url);
  const requestedJobsiteId = url.searchParams.get("jobsiteId")?.trim() || "all";
  const jobsiteId = requestedJobsiteId === "all" ? null : requestedJobsiteId;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only view OSHA log summaries for assigned jobsites." }, { status: 403 });
  }

  let query = auth.supabase
    .from("company_osha_log_cases")
    .select("company_id, import_id, jobsite_id, case_number, occurred_on, department, location, injury_type, body_part, exposure_event_type, injury_source, days_away_from_work, days_restricted, job_transfer, recordable, fatality, severity, repeat_pattern_key, deidentified_summary, source_row_number, parser_confidence, created_at")
    .eq("company_id", companyScope.companyId)
    .order("occurred_on", { ascending: false });

  if (jobsiteId) {
    query = query.eq("jobsite_id", jobsiteId);
  } else if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({ summary: summarizeOshaLogCases([]) });
    }
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const [casesResult, importsResult] = await Promise.all([
    query.limit(5000),
    auth.supabase
      .from("company_osha_log_imports")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyScope.companyId),
  ]);

  if (casesResult.error) {
    return NextResponse.json({ error: casesResult.error.message || "Failed to load OSHA log summary." }, { status: 500 });
  }

  return NextResponse.json({
    summary: summarizeOshaLogCases((casesResult.data ?? []) as OshaLogCaseRow[], {
      imports: importsResult.count ?? 0,
    }),
  });
}
