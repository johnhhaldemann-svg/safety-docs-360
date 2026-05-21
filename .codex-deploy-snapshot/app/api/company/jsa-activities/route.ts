import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canManageCompanyJsa } from "@/lib/companyFeatureAccess";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { buildJsaActivityFacetRow, upsertRiskMemoryFacetSafe } from "@/lib/riskMemory/facets";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

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

function isMissingTable(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_jsa_activities") || lower.includes("company_dap_activities") || lower.includes("schema cache");
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const isDemoRequest =
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    const { searchParams } = new URL(request.url);
    const jsaId = searchParams.get("jsaId")?.trim() || "demo-jsa-1";
    const jobsiteByJsa: Record<string, string> = {
      "demo-jsa-1": "demo-jobsite-1",
      "demo-jsa-2": "demo-jobsite-2",
      "demo-jsa-3": "demo-jobsite-1",
      "demo-jsa-4": "demo-jobsite-2",
      "demo-jsa-5": "demo-jobsite-2",
    };
    const jobsiteId = jobsiteByJsa[jsaId] ?? "demo-jobsite-1";
    return NextResponse.json({
      activities: [
        {
          id: "demo-jsa-activity-1",
          company_id: "demo-company",
          jsa_id: jsaId,
          jobsite_id: jobsiteId,
          work_date: new Date().toISOString().slice(0, 10),
          trade: "Structural Steel and Erection",
          activity_name: "Crane-assisted steel beam placement",
          area: "North core level 5",
          crew_size: 6,
          hazard_category: "struck_by",
          hazard_description: "Line-of-fire exposure during picks.",
          mitigation: "Exclusion zone, signal person, and tag-line control.",
          permit_required: true,
          permit_type: "Hot Work Permit",
          planned_risk_level: "high",
          status: "active",
          updated_at: new Date().toISOString(),
        },
        {
          id: "demo-jsa-activity-2",
          company_id: "demo-company",
          jsa_id: jsaId,
          jobsite_id: jobsiteId,
          work_date: new Date().toISOString().slice(0, 10),
          trade: "Electrical",
          activity_name: "Temporary power panel verification",
          area: "East service corridor",
          crew_size: 3,
          hazard_category: "electrical",
          hazard_description: "Potential exposure to energized conductors.",
          mitigation: "LOTO verification, insulated tools, and tester confirmation.",
          permit_required: false,
          permit_type: null,
          planned_risk_level: "medium",
          status: "planned",
          updated_at: new Date().toISOString(),
        },
        {
          id: "demo-jsa-activity-3",
          company_id: "demo-company",
          jsa_id: jsaId,
          jobsite_id: jobsiteId,
          work_date: new Date().toISOString().slice(0, 10),
          trade: "General",
          activity_name: "End-of-shift housekeeping and egress clear-down",
          area: "Access routes and staging pads",
          crew_size: 4,
          hazard_category: "housekeeping",
          hazard_description: "Trip hazards from packaging and loose materials.",
          mitigation: "Walkdown checklist and supervisor sign-off before handover.",
          permit_required: false,
          permit_type: null,
          planned_risk_level: "low",
          status: "completed",
          updated_at: new Date().toISOString(),
        },
      ],
    });
  }
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ activities: [] });

  const { searchParams } = new URL(request.url);
  const jsaId = searchParams.get("jsaId")?.trim();
  const workDate = searchParams.get("workDate")?.trim();
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  let query = auth.supabase
    .from("company_jsa_activities")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (jsaId) query = query.eq("jsa_id", jsaId);
  if (workDate) query = query.eq("work_date", workDate);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ activities: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }
  const result = await query;
  if (result.error) {
    if (isMissingTable(result.error.message)) {
      return NextResponse.json(
        { activities: [], warning: "JSA activity tables are not available yet. Run latest migrations." },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: result.error.message || "Failed to load JSA activities." },
      { status: 500 }
    );
  }
  return NextResponse.json({ activities: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageCompanyJsa(auth.role, auth.permissionMap)) {
    return NextResponse.json({ error: "Only foremen, managers, and admins can create JSA activities." }, { status: 403 });
  }
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const csepBlockPost = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockPost) return csepBlockPost;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const jsaId = String(body?.jsaId ?? "").trim();
  const activityName = String(body?.activityName ?? "").trim();
  if (!jsaId || !activityName) {
    return NextResponse.json({ error: "jsaId and activityName are required." }, { status: 400 });
  }

  const result = await auth.supabase
    .from("company_jsa_activities")
    .insert({
      company_id: companyScope.companyId,
      jsa_id: jsaId,
      jobsite_id: String(body?.jobsiteId ?? "").trim() || null,
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
    return NextResponse.json({ error: result.error.message || "Failed to create JSA activity." }, { status: 500 });
  }
  const jsaFacet = buildJsaActivityFacetRow(
    companyScope.companyId,
    result.data as Record<string, unknown>,
    body
  );
  void upsertRiskMemoryFacetSafe(auth.supabase, jsaFacet);
  return NextResponse.json({ success: true, activity: result.data });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageCompanyJsa(auth.role, auth.permissionMap)) {
    return NextResponse.json({ error: "Only foremen, managers, and admins can update JSA activities." }, { status: 403 });
  }
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const csepBlockPatch = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockPatch) return csepBlockPatch;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const result = await auth.supabase
    .from("company_jsa_activities")
    .update({
      ...(typeof body?.trade === "string" ? { trade: body.trade.trim() || null } : {}),
      ...(typeof body?.activityName === "string" ? { activity_name: body.activityName.trim() } : {}),
      ...(typeof body?.area === "string" ? { area: body.area.trim() || null } : {}),
      ...(typeof body?.crewSize === "number" ? { crew_size: body.crewSize } : {}),
      ...(typeof body?.hazardCategory === "string" ? { hazard_category: body.hazardCategory.trim() || null } : {}),
      ...(typeof body?.hazardDescription === "string"
        ? { hazard_description: body.hazardDescription.trim() || null }
        : {}),
      ...(typeof body?.mitigation === "string" ? { mitigation: body.mitigation.trim() || null } : {}),
      ...(typeof body?.permitRequired === "boolean" ? { permit_required: body.permitRequired } : {}),
      ...(typeof body?.permitType === "string" ? { permit_type: body.permitType.trim() || null } : {}),
      ...(typeof body?.plannedRiskLevel === "string"
        ? { planned_risk_level: body.plannedRiskLevel.trim() || null }
        : {}),
      ...(typeof body?.status === "string"
        ? { status: normalizeActivityStatus(body.status, "planned") }
        : {}),
      ...(typeof body?.workDate === "string" ? { work_date: body.workDate.trim() || null } : {}),
      updated_by: auth.user.id,
    })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .single();
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to update JSA activity." }, { status: 500 });
  }
  const jsaFacetPatch = buildJsaActivityFacetRow(
    companyScope.companyId,
    result.data as Record<string, unknown>,
    body
  );
  void upsertRiskMemoryFacetSafe(auth.supabase, jsaFacetPatch);
  return NextResponse.json({ success: true, activity: result.data });
}
