import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

function canRunToolbox(role: string) {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canRunToolbox(auth.role)) {
    return NextResponse.json({ error: "Your role cannot update toolbox sessions." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const existing = await auth.supabase
    .from("company_toolbox_sessions")
    .select("id, jobsite_id, status")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  const row = existing.data as { jobsite_id: string };
  if (!isJobsiteAllowed(row.jobsite_id, jobsiteScope)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
  if (body.status === "completed" || body.status === "draft") patch.status = body.status;
  if (typeof body.linkedCorrectiveActionId === "string") {
    patch.linked_corrective_action_id = body.linkedCorrectiveActionId.trim() || null;
  }

  const res = await auth.supabase
    .from("company_toolbox_sessions")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .maybeSingle();

  if (res.error || !res.data) {
    return NextResponse.json({ error: res.error?.message || "Update failed." }, { status: 500 });
  }

  if (patch.status === "completed") {
    await auth.supabase.from("company_risk_events").insert({
      company_id: companyScope.companyId,
      module_name: "toolbox",
      record_id: id,
      event_type: "toolbox_session_completed",
      detail: "Toolbox session marked completed.",
      event_payload: { sessionId: id },
      created_by: auth.user.id,
    });
  }

  return NextResponse.json({ session: res.data });
}
