import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import { canManageAuditFlow, canSubmitAuditFlowAssignment } from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function loadScope(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_field_audits",
      "can_submit_documents",
      "can_create_documents",
      "can_view_all_company_data",
    ],
  });
  if ("error" in auth) return { error: auth.error } as const;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return { error: NextResponse.json({ error: "No company workspace." }, { status: 400 }) } as const;
  }
  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return { error: block } as const;
  return { auth, companyScope } as const;
}

export async function GET(request: Request, context: RouteContext) {
  const scope = await loadScope(request);
  if ("error" in scope) return scope.error;
  const { id } = await context.params;
  const assignmentId = String(id ?? "").trim();
  if (!assignmentId) return NextResponse.json({ error: "Assignment id is required." }, { status: 400 });

  const assignment = await scope.auth.supabase
    .from("company_auditflow_assignments")
    .select("*")
    .eq("company_id", scope.companyScope.companyId)
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignment.error) return NextResponse.json({ error: assignment.error.message || "Failed to load assignment." }, { status: 500 });
  if (!assignment.data) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: scope.auth.supabase,
    userId: scope.auth.user.id,
    companyId: scope.companyScope.companyId,
    role: scope.auth.role,
  });
  if (!isJobsiteAllowed(assignment.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Assignment access denied for this jobsite." }, { status: 403 });
  }
  if (
    !canSubmitAuditFlowAssignment({
      role: scope.auth.role,
      userId: scope.auth.user.id,
      assignedUserId: assignment.data.assigned_user_id,
    })
  ) {
    return NextResponse.json({ error: "You can only open AuditFlow assignments assigned to you." }, { status: 403 });
  }

  const [version, submissions] = await Promise.all([
    scope.auth.supabase
      .from("company_auditflow_template_versions")
      .select("*")
      .eq("company_id", scope.companyScope.companyId)
      .eq("id", assignment.data.template_version_id)
      .maybeSingle(),
    scope.auth.supabase
      .from("company_auditflow_submissions")
      .select("*")
      .eq("company_id", scope.companyScope.companyId)
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: false }),
  ]);

  return NextResponse.json({
    assignment: assignment.data,
    templateVersion: version.data ?? null,
    submissions: submissions.data ?? [],
    warning: version.error?.message || submissions.error?.message || null,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const scope = await loadScope(request);
  if ("error" in scope) return scope.error;
  if (!canManageAuditFlow(scope.auth.role)) {
    return NextResponse.json({ error: "Only company managers can update AuditFlow assignments." }, { status: 403 });
  }
  const { id } = await context.params;
  const assignmentId = String(id ?? "").trim();
  if (!assignmentId) return NextResponse.json({ error: "Assignment id is required." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: Record<string, unknown> = { updated_by: scope.auth.user.id };
  const status = String(body?.status ?? "").trim().toLowerCase();
  if (["assigned", "in_progress", "submitted", "approved", "returned", "cancelled"].includes(status)) {
    patch.status = status;
  }
  if (typeof body?.managerNotes === "string") patch.manager_notes = body.managerNotes.trim() || null;
  if (typeof body?.assignedUserId === "string") patch.assigned_user_id = body.assignedUserId.trim() || null;
  if (typeof body?.dueAt === "string") {
    const due = body.dueAt.trim() ? new Date(body.dueAt) : null;
    if (due && Number.isNaN(due.getTime())) return NextResponse.json({ error: "dueAt is invalid." }, { status: 400 });
    patch.due_at = due ? due.toISOString() : null;
  }

  if (Object.keys(patch).length <= 1) return NextResponse.json({ error: "No supported assignment fields provided." }, { status: 400 });

  const result = await scope.auth.supabase
    .from("company_auditflow_assignments")
    .update(patch)
    .eq("company_id", scope.companyScope.companyId)
    .eq("id", assignmentId)
    .select("*")
    .single();

  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to update assignment." }, { status: 500 });
  return NextResponse.json({ success: true, assignment: result.data });
}
