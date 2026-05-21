import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

function canRecordCompletion(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "field_supervisor" ||
    role === "foreman"
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
      "can_create_documents",
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
    return NextResponse.json({ completions: [] });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";
  const jobsiteId = searchParams.get("jobsiteId")?.trim() ?? "";

  let query = auth.supabase
    .from("company_induction_completions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("completed_at", { ascending: false });

  if (userId) {
    const canSeeOthers =
      isAdminRole(auth.role) ||
      auth.permissionMap?.can_view_all_company_data ||
      auth.permissionMap?.can_manage_company_users;
    if (!canSeeOthers && userId !== auth.user.id) {
      return NextResponse.json({ error: "You can only view your own completions." }, { status: 403 });
    }
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("user_id", auth.user.id);
  }

  if (jobsiteId) {
    if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
      return NextResponse.json({ completions: [] });
    }
    query = query.or(`jobsite_id.is.null,jobsite_id.eq.${jobsiteId}`);
  } else if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({ completions: [] });
    }
    const allowed = jobsiteScope.jobsiteIds;
    const orExpr = ["jobsite_id.is.null", ...allowed.map((id) => `jobsite_id.eq.${id}`)].join(",");
    query = query.or(orExpr);
  }

  const res = await query;
  if (res.error) {
    return NextResponse.json({ error: res.error.message || "Failed to load completions." }, { status: 500 });
  }

  return NextResponse.json({ completions: res.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_manage_company_users"],
  });
  if ("error" in auth) return auth.error;
  if (!canRecordCompletion(auth.role)) {
    return NextResponse.json({ error: "Your role cannot record induction completions." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const programId = String(body?.programId ?? "").trim();
  if (!programId) {
    return NextResponse.json({ error: "programId is required." }, { status: 400 });
  }

  const subjectUserId = String(body?.userId ?? "").trim() || null;
  const visitorName = String(body?.visitorDisplayName ?? "").trim() || null;
  if (!subjectUserId && !visitorName) {
    return NextResponse.json({ error: "userId or visitorDisplayName is required." }, { status: 400 });
  }

  const canAssignOthers =
    isAdminRole(auth.role) ||
    auth.permissionMap?.can_view_all_company_data ||
    auth.permissionMap?.can_manage_company_users;
  if (subjectUserId && subjectUserId !== auth.user.id && !canAssignOthers) {
    return NextResponse.json({ error: "You can only record completions for yourself." }, { status: 403 });
  }

  const jobsiteIdRaw = String(body?.jobsiteId ?? "").trim();
  const jobsiteId = jobsiteIdRaw || null;
  if (jobsiteId && !isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "Invalid jobsite for your access." }, { status: 403 });
  }

  const prog = await auth.supabase
    .from("company_induction_programs")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("id", programId)
    .maybeSingle();
  if (prog.error || !prog.data) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const expiresAt = String(body?.expiresAt ?? "").trim() || null;
  const notes = String(body?.notes ?? "").trim() || null;
  const evidencePath = String(body?.evidencePath ?? "").trim() || null;

  const ins = await auth.supabase
    .from("company_induction_completions")
    .insert({
      company_id: companyScope.companyId,
      program_id: programId,
      jobsite_id: jobsiteId,
      user_id: subjectUserId,
      visitor_display_name: visitorName,
      expires_at: expiresAt,
      notes,
      evidence_path: evidencePath,
      completed_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to record completion." }, { status: 500 });
  }

  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "inductions",
    record_id: ins.data.id,
    event_type: "induction_completed",
    detail: "Induction completion recorded.",
    event_payload: { programId, jobsiteId, userId: subjectUserId },
    created_by: auth.user.id,
  });

  return NextResponse.json({ completion: ins.data });
}
