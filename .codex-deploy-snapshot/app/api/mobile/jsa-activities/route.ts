import { NextResponse } from "next/server";
import { GET, PATCH } from "@/app/api/company/jsa-activities/route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { buildJsaActivityFacetRow, upsertRiskMemoryFacetSafe } from "@/lib/riskMemory/facets";

export const runtime = "nodejs";

export { GET, PATCH };

const ACTIVITY_STATUSES = new Set([
  "planned",
  "monitored",
  "not_started",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

function normalizeActivityStatus(input: unknown, fallback = "planned") {
  const value = String(input ?? "").trim().toLowerCase();
  return ACTIVITY_STATUSES.has(value) ? value : fallback;
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const jsaId = String(body?.jsaId ?? "").trim();
  const activityName = String(body?.activityName ?? "").trim();
  if (!jsaId || !activityName) {
    return NextResponse.json({ error: "JSA and work activity are required." }, { status: 400 });
  }

  const jsa = await auth.supabase
    .from("company_jsas")
    .select("id, jobsite_id")
    .eq("id", jsaId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (jsa.error) {
    return NextResponse.json({ error: jsa.error.message || "Failed to load JSA." }, { status: 500 });
  }
  if (!jsa.data) return NextResponse.json({ error: "JSA not found." }, { status: 404 });

  const jobsiteId = String(body?.jobsiteId ?? "").trim() || jsa.data.jobsite_id || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only add JSA work steps for assigned jobsites." }, { status: 403 });
  }

  const result = await auth.supabase
    .from("company_jsa_activities")
    .insert({
      company_id: companyScope.companyId,
      jsa_id: jsaId,
      jobsite_id: jobsiteId,
      work_date: String(body?.workDate ?? "").trim() || null,
      trade: String(body?.trade ?? "").trim() || null,
      activity_name: activityName,
      area: String(body?.area ?? "").trim() || null,
      crew_size: typeof body?.crewSize === "number" ? body.crewSize : null,
      hazard_category: String(body?.hazardCategory ?? "").trim() || null,
      hazard_description: String(body?.hazardDescription ?? "").trim() || null,
      mitigation: String(body?.mitigation ?? "").trim() || null,
      permit_required: Boolean(body?.permitRequired),
      permit_type: String(body?.permitType ?? "").trim() || null,
      planned_risk_level: String(body?.plannedRiskLevel ?? "").trim() || null,
      status: normalizeActivityStatus(body?.status, "planned"),
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to save JSA work step." }, { status: 500 });
  }
  const facet = buildJsaActivityFacetRow(companyScope.companyId, result.data as Record<string, unknown>, body ?? {});
  void upsertRiskMemoryFacetSafe(auth.supabase, facet);
  return NextResponse.json({ success: true, activity: result.data });
}
