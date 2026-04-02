import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

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

function canManage(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "foreman"
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ activities: [] });

  const { searchParams } = new URL(request.url);
  const dapId = searchParams.get("dapId")?.trim();
  const workDate = searchParams.get("workDate")?.trim();
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  let query = auth.supabase
    .from("company_dap_activities")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (dapId) query = query.eq("dap_id", dapId);
  if (workDate) query = query.eq("work_date", workDate);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ activities: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }
  const result = await query;
  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to load DAP activities." },
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
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only foremen, managers, and admins can create DAP activities." }, { status: 403 });
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
  const dapId = String(body?.dapId ?? "").trim();
  const activityName = String(body?.activityName ?? "").trim();
  if (!dapId || !activityName) {
    return NextResponse.json({ error: "dapId and activityName are required." }, { status: 400 });
  }

  const result = await auth.supabase
    .from("company_dap_activities")
    .insert({
      company_id: companyScope.companyId,
      dap_id: dapId,
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
    return NextResponse.json({ error: result.error.message || "Failed to create DAP activity." }, { status: 500 });
  }
  return NextResponse.json({ success: true, activity: result.data });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only foremen, managers, and admins can update DAP activities." }, { status: 403 });
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
    .from("company_dap_activities")
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
    return NextResponse.json({ error: result.error.message || "Failed to update DAP activity." }, { status: 500 });
  }
  return NextResponse.json({ success: true, activity: result.data });
}
