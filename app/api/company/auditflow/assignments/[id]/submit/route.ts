import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import {
  canSubmitAuditFlowAssignment,
  normalizeAuditFlowAnswers,
  parseAuditFlowTemplateSchema,
  scoreAuditFlowSubmission,
  validateAuditFlowSubmission,
} from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SubmitBody = {
  answers?: unknown;
  notes?: string | null;
  signatureText?: string | null;
};

function cleanText(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function buildCorrectiveAction(params: {
  companyId: string;
  jobsiteId: string | null;
  assignedUserId: string | null;
  actorUserId: string;
  assignmentId: string;
  itemLabel: string;
  sectionTitle: string;
  comment: string;
}) {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  return {
    company_id: params.companyId,
    jobsite_id: params.jobsiteId,
    title: `AuditFlow finding: ${params.itemLabel}`.slice(0, 240),
    description: [
      params.sectionTitle,
      params.comment,
      `Source AuditFlow assignment ${params.assignmentId}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    severity: "medium",
    category: "corrective_action",
    status: "assigned",
    assigned_user_id: params.assignedUserId,
    due_at: due.toISOString(),
    created_by: params.actorUserId,
    updated_by: params.actorUserId,
    observation_type: "negative",
    sif_potential: false,
    immediate_action_required: false,
    priority: "medium",
  };
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_submit_documents", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const assignmentId = String(id ?? "").trim();
  if (!assignmentId) return NextResponse.json({ error: "Assignment id is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company workspace." }, { status: 400 });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const assignment = await auth.supabase
    .from("company_auditflow_assignments")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignment.error) return NextResponse.json({ error: assignment.error.message || "Failed to load assignment." }, { status: 500 });
  if (!assignment.data) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  if (assignment.data.status === "cancelled" || assignment.data.status === "approved") {
    return NextResponse.json({ error: "This AuditFlow assignment cannot be submitted." }, { status: 400 });
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(assignment.data.jobsite_id ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Assignment access denied for this jobsite." }, { status: 403 });
  }
  if (
    !canSubmitAuditFlowAssignment({
      role: auth.role,
      userId: auth.user.id,
      assignedUserId: assignment.data.assigned_user_id,
    })
  ) {
    return NextResponse.json({ error: "You can only submit AuditFlow assignments assigned to you." }, { status: 403 });
  }

  const version = await auth.supabase
    .from("company_auditflow_template_versions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("id", assignment.data.template_version_id)
    .maybeSingle();
  if (version.error) return NextResponse.json({ error: version.error.message || "Failed to load template version." }, { status: 500 });
  if (!version.data) return NextResponse.json({ error: "Template version not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as SubmitBody | null;
  const schema = parseAuditFlowTemplateSchema(version.data.schema);
  const answers = normalizeAuditFlowAnswers(body?.answers);
  const signatureText = cleanText(body?.signatureText, 240);
  const validation = validateAuditFlowSubmission(schema, answers, signatureText);
  if (!validation.ok) {
    return NextResponse.json({ error: "Audit submission is incomplete.", errors: validation.errors }, { status: 400 });
  }
  const scoreSummary = scoreAuditFlowSubmission(schema, answers);

  const submission = await auth.supabase
    .from("company_auditflow_submissions")
    .insert({
      company_id: companyScope.companyId,
      assignment_id: assignmentId,
      template_id: assignment.data.template_id,
      template_version_id: assignment.data.template_version_id,
      jobsite_id: assignment.data.jobsite_id ?? null,
      submitted_by: auth.user.id,
      status: "submitted",
      answers,
      score_summary: scoreSummary,
      notes: cleanText(body?.notes, 4000) || null,
      signature_text: signatureText,
    })
    .select("*")
    .single();
  if (submission.error || !submission.data) {
    return NextResponse.json({ error: submission.error?.message || "Failed to save AuditFlow submission." }, { status: 500 });
  }

  await auth.supabase
    .from("company_auditflow_assignments")
    .update({ status: "submitted", updated_by: auth.user.id })
    .eq("company_id", companyScope.companyId)
    .eq("id", assignmentId);

  let correctiveActionsCreated = 0;
  const correctiveActionErrors: string[] = [];
  for (const failed of scoreSummary.failedItems) {
    const action = await auth.supabase
      .from("company_corrective_actions")
      .insert(
        buildCorrectiveAction({
          companyId: companyScope.companyId,
          jobsiteId: assignment.data.jobsite_id ?? null,
          assignedUserId: assignment.data.assigned_user_id ?? auth.user.id,
          actorUserId: auth.user.id,
          assignmentId,
          itemLabel: failed.itemLabel,
          sectionTitle: failed.sectionTitle,
          comment: failed.comment,
        })
      )
      .select("id")
      .single();
    if (action.error || !action.data) {
      correctiveActionErrors.push(action.error?.message || `Corrective action failed for ${failed.itemLabel}.`);
      continue;
    }
    correctiveActionsCreated += 1;
    const link = await auth.supabase.from("company_auditflow_corrective_action_links").insert({
      company_id: companyScope.companyId,
      assignment_id: assignmentId,
      submission_id: submission.data.id,
      action_id: action.data.id,
      item_key: failed.itemKey,
    });
    if (link.error) correctiveActionErrors.push(link.error.message || "Corrective action link failed.");
  }

  return NextResponse.json({
    success: true,
    submission: submission.data,
    scoreSummary,
    correctiveActionsCreated,
    correctiveActionErrors,
  });
}
