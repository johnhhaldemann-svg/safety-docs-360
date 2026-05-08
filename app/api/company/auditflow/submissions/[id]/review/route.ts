import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import { canReviewAuditFlow } from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReviewBody = {
  decision?: "approved" | "returned";
  reviewNotes?: string | null;
  actionAssigneeId?: string | null;
};

function cleanText(value: unknown, max = 3000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_manage_observations", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!canReviewAuditFlow(auth.role)) {
    return NextResponse.json({ error: "Only company managers can review AuditFlow submissions." }, { status: 403 });
  }

  const { id } = await context.params;
  const submissionId = String(id ?? "").trim();
  if (!submissionId) return NextResponse.json({ error: "Submission id is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company workspace." }, { status: 400 });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const body = (await request.json().catch(() => null)) as ReviewBody | null;
  const decision = body?.decision === "returned" ? "returned" : "approved";
  const reviewNotes = cleanText(body?.reviewNotes);
  const actionAssigneeId = cleanText(body?.actionAssigneeId, 80) || null;

  const submission = await auth.supabase
    .from("company_auditflow_submissions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("id", submissionId)
    .maybeSingle();
  if (submission.error) return NextResponse.json({ error: submission.error.message || "Failed to load submission." }, { status: 500 });
  if (!submission.data) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(submission.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Submission access denied for this jobsite." }, { status: 403 });
  }

  const update = await auth.supabase
    .from("company_auditflow_submissions")
    .update({
      status: decision,
      review_notes: reviewNotes || null,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("company_id", companyScope.companyId)
    .eq("id", submissionId)
    .select("*")
    .single();
  if (update.error) {
    return NextResponse.json({ error: update.error.message || "Failed to review submission." }, { status: 500 });
  }

  await auth.supabase
    .from("company_auditflow_assignments")
    .update({
      status: decision,
      manager_notes: reviewNotes || null,
      updated_by: auth.user.id,
    })
    .eq("company_id", companyScope.companyId)
    .eq("id", submission.data.assignment_id);

  let correctiveActionsUpdated = 0;
  if (actionAssigneeId) {
    const links = await auth.supabase
      .from("company_auditflow_corrective_action_links")
      .select("action_id")
      .eq("company_id", companyScope.companyId)
      .eq("submission_id", submissionId);
    const actionIds = ((links.data as Array<{ action_id?: string }> | null) ?? [])
      .map((row) => row.action_id)
      .filter((value): value is string => Boolean(value));
    if (actionIds.length > 0) {
      const actionUpdate = await auth.supabase
        .from("company_corrective_actions")
        .update({ assigned_user_id: actionAssigneeId, updated_by: auth.user.id })
        .eq("company_id", companyScope.companyId)
        .in("id", actionIds)
        .select("id");
      correctiveActionsUpdated = actionUpdate.data?.length ?? 0;
    }
  }

  return NextResponse.json({
    success: true,
    submission: update.data,
    correctiveActionsUpdated,
    message: decision === "approved" ? "AuditFlow submission approved." : "AuditFlow submission returned.",
  });
}
