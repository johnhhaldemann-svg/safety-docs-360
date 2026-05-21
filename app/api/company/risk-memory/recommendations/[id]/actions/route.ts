import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { validateCompanyAssignableUserId } from "@/lib/companyAssignableUsers";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  recordAiEngineFeedback,
  sanitizeAiFeedbackSignalMetadata,
  type AiEngineReadableClient,
} from "@/lib/superadmin/aiEngineOperations";
import {
  calculateRiskReductionPoints,
  eventTypeForRiskAction,
  mitigationStateForAction,
  statusForRiskAction,
} from "@/lib/riskActionPlan";
import type {
  RiskActionExecuteType,
  RiskActionLinkedModule,
  RiskActionMitigationState,
} from "@/types/risk-action-plan";

export const runtime = "nodejs";

const ACTIONS = new Set<RiskActionExecuteType>([
  "assign",
  "request_documentation",
  "request_inspection",
  "create_corrective_action",
  "request_permit",
  "accountability_review",
  "stop_work_review",
  "mark_field_used",
  "resolve",
  "dismiss",
]);

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function cleanText(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function optionalDateTime(value: unknown) {
  const text = cleanText(value, 80);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
}

function normalizeActionType(value: unknown): RiskActionExecuteType | null {
  const raw = cleanText(value, 80).toLowerCase();
  return ACTIONS.has(raw as RiskActionExecuteType) ? (raw as RiskActionExecuteType) : null;
}

function linkedModuleForAction(actionType: RiskActionExecuteType): RiskActionLinkedModule | null {
  if (actionType === "create_corrective_action") return "corrective_action";
  if (actionType === "accountability_review") return "accountability_review";
  if (actionType === "stop_work_review") return "stop_work_review";
  if (actionType === "request_permit") return "permit";
  if (actionType === "request_inspection") return "auditflow_assignment";
  if (actionType === "request_documentation") return "documentation_request";
  return null;
}

function statusForCorrectiveAction(actionType: RiskActionExecuteType) {
  if (actionType === "stop_work_review") return "stop_work";
  if (actionType === "accountability_review") return "escalated";
  return "open";
}

function severityForPriority(priority: unknown) {
  const value = cleanText(priority, 20).toLowerCase();
  if (value === "critical" || value === "high" || value === "low") return value;
  return "medium";
}

async function createLinkedRecord(params: {
  supabase: {
    from: (table: string) => {
      insert: (payload: Record<string, unknown>) => {
        select: (columns?: string) => { single: () => PromiseLike<{ data: Record<string, unknown> | null; error: { message?: string | null } | null }> };
      };
    };
  };
  actionType: RiskActionExecuteType;
  companyId: string;
  actorUserId: string;
  recommendation: Record<string, unknown>;
  body: Record<string, unknown>;
}) {
  const title = cleanText(params.body.title, 180) || cleanText(params.recommendation.title, 180) || "AI risk action follow-up";
  const description = [
    cleanText(params.body.notes, 1000),
    cleanText(params.recommendation.body, 1200),
    `Source recommendation ${params.recommendation.id}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const jobsiteId = cleanText(params.body.jobsiteId, 80) || cleanText(params.recommendation.jobsite_id, 80) || null;
  const assignedUserId = cleanText(params.body.ownerUserId ?? params.body.assignedUserId, 80) || null;
  const dueAt = optionalDateTime(params.body.dueAt);
  const severity = severityForPriority(params.recommendation.priority);

  if (params.actionType === "request_inspection") {
    const templateId = cleanText(params.body.templateId, 80);
    if (!templateId) return { error: "templateId is required to request an inspection.", status: 400 };
    const templateVersionId = cleanText(params.body.templateVersionId, 80) || null;
    const insert = await params.supabase.from("company_auditflow_assignments").insert({
      company_id: params.companyId,
      template_id: templateId,
      template_version_id: templateVersionId,
      jobsite_id: jobsiteId,
      assigned_user_id: assignedUserId,
      scheduled_date: cleanText(params.body.scheduledDate, 20) || null,
      due_at: dueAt === "invalid" ? null : dueAt,
      status: "assigned",
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    }).select("id").single();
    if (insert.error) return { error: insert.error.message || "Failed to request inspection.", status: 500 };
    return { linkedModule: "auditflow_assignment" as const, linkedRecordId: String(insert.data?.id ?? "") };
  }

  if (params.actionType === "request_permit") {
    const permitType = cleanText(params.body.permitType, 80) || "safety_review";
    const insert = await params.supabase.from("company_permits").insert({
      company_id: params.companyId,
      jobsite_id: jobsiteId,
      permit_type: permitType,
      title,
      status: "draft",
      severity,
      category: "corrective_action",
      owner_user_id: assignedUserId,
      due_at: dueAt === "invalid" ? null : dueAt,
      sif_flag: severity === "high" || severity === "critical",
      escalation_level: severity === "critical" ? "critical" : "none",
      escalation_reason: "AI risk action requested permit review.",
      stop_work_status: "normal",
      stop_work_reason: null,
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    }).select("id").single();
    if (insert.error) return { error: insert.error.message || "Failed to request permit.", status: 500 };
    return { linkedModule: "permit" as const, linkedRecordId: String(insert.data?.id ?? "") };
  }

  if (
    params.actionType === "create_corrective_action" ||
    params.actionType === "accountability_review" ||
    params.actionType === "stop_work_review"
  ) {
    const prefix =
      params.actionType === "accountability_review"
        ? "Accountability review"
        : params.actionType === "stop_work_review"
          ? "Stop-work review"
          : "AI corrective action";
    const insert = await params.supabase.from("company_corrective_actions").insert({
      company_id: params.companyId,
      jobsite_id: jobsiteId,
      title: `${prefix}: ${title}`.slice(0, 240),
      description,
      severity,
      category: "corrective_action",
      status: statusForCorrectiveAction(params.actionType),
      assigned_user_id: assignedUserId,
      due_at: dueAt === "invalid" ? null : dueAt,
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
      observation_type: "negative",
      sif_potential: severity === "high" || severity === "critical",
      immediate_action_required: severity === "high" || severity === "critical",
      priority: severity,
    }).select("id").single();
    if (insert.error) return { error: insert.error.message || "Failed to create corrective action.", status: 500 };
    return {
      linkedModule:
        params.actionType === "accountability_review"
          ? "accountability_review" as const
          : params.actionType === "stop_work_review"
            ? "stop_work_review" as const
            : "corrective_action" as const,
      linkedRecordId: String(insert.data?.id ?? ""),
    };
  }

  return { linkedModule: linkedModuleForAction(params.actionType), linkedRecordId: null };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only managers and admins can execute risk recommendation actions." }, { status: 403 });
  }

  const { id: recId } = await params;
  const id = cleanText(recId, 80);
  if (!id) return NextResponse.json({ error: "Invalid recommendation id." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const actionType = normalizeActionType(body?.actionType ?? body?.action_type);
  if (!actionType) return NextResponse.json({ error: "A valid actionType is required." }, { status: 400 });
  const dueAt = optionalDateTime(body?.dueAt ?? body?.due_at);
  if (dueAt === "invalid") return NextResponse.json({ error: "dueAt is invalid." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) return csepWorkspaceForbiddenResponse();

  const recommendation = await auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, company_id, jobsite_id, kind, title, body, status, priority, action_type, owner_user_id, due_at, target_module, target_href, linked_module, linked_record_id, verification_required, mitigation_state, risk_reduction_points, accepted_at")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (recommendation.error) {
    return NextResponse.json({ error: recommendation.error.message || "Recommendation lookup failed." }, { status: 500 });
  }
  if (!recommendation.data?.id) return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });

  const requestedJobsiteId = cleanText(body?.jobsiteId, 80) || cleanText(recommendation.data.jobsite_id, 80) || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(requestedJobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You do not have access to this jobsite." }, { status: 403 });
  }

  const ownerUserId = cleanText(body?.ownerUserId ?? body?.assignedUserId, 80) || null;
  if (ownerUserId) {
    const assignee = await validateCompanyAssignableUserId({
      supabase: auth.supabase,
      companyId: companyScope.companyId,
      assignedUserId: ownerUserId,
    });
    if (assignee.error) return NextResponse.json({ error: assignee.error }, { status: 400 });
  }

  const linked =
    actionType === "assign" || actionType === "mark_field_used" || actionType === "resolve" || actionType === "dismiss"
      ? { linkedModule: linkedModuleForAction(actionType), linkedRecordId: null }
      : await createLinkedRecord({
          supabase: auth.supabase,
          actionType,
          companyId: companyScope.companyId,
          actorUserId: auth.user.id,
          recommendation: recommendation.data,
          body: body ?? {},
        });
  if ("error" in linked) {
    return NextResponse.json({ error: linked.error }, { status: linked.status });
  }

  const nextStatus = statusForRiskAction(actionType);
  const nextMitigationState: RiskActionMitigationState =
    actionType === "dismiss"
      ? "dismissed"
      : actionType === "resolve"
        ? "resolved"
        : actionType === "mark_field_used"
          ? "field_verified"
          : actionType === "request_documentation" && body?.evidenceProvided === true
            ? "evidence_uploaded"
            : mitigationStateForAction(actionType);
  const riskReductionPoints = calculateRiskReductionPoints({
    priority: recommendation.data.priority,
    status: nextStatus,
    mitigationState: nextMitigationState,
    verificationRequired: recommendation.data.verification_required,
  });
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    action_type:
      actionType === "mark_field_used" || actionType === "resolve" || actionType === "dismiss"
        ? recommendation.data.action_type
        : actionType,
    status: nextStatus,
    dismissed: nextStatus === "dismissed",
    owner_user_id: ownerUserId ?? recommendation.data.owner_user_id ?? null,
    due_at: dueAt ?? recommendation.data.due_at ?? null,
    linked_module: linked.linkedModule ?? recommendation.data.linked_module ?? null,
    linked_record_id: linked.linkedRecordId ?? recommendation.data.linked_record_id ?? null,
    mitigation_state: nextMitigationState,
    risk_reduction_points: riskReductionPoints,
    ...(nextStatus === "accepted" ? { accepted_at: now } : {}),
    ...(nextStatus === "assigned" ? { accepted_at: recommendation.data.accepted_at ?? now } : {}),
    ...(nextStatus === "field_used" ? { field_used_at: now } : {}),
    ...(nextStatus === "resolved" ? { resolved_at: now } : {}),
    ...(nextStatus === "dismissed" ? { dismissed_at: now } : {}),
  };

  const update = await auth.supabase
    .from("company_risk_ai_recommendations")
    .update(updatePayload)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("id, status, priority, action_type, owner_user_id, due_at, linked_module, linked_record_id, verification_required, mitigation_state, risk_reduction_points, target_href")
    .single();
  if (update.error) {
    return NextResponse.json({ error: update.error.message || "Failed to update recommendation." }, { status: 500 });
  }

  await auth.supabase.from("company_risk_recommendation_events").insert({
    company_id: companyScope.companyId,
    recommendation_id: id,
    event_type: eventTypeForRiskAction(actionType),
    from_status: recommendation.data.status ?? "active",
    to_status: nextStatus,
    actor_user_id: auth.user.id,
    metadata: sanitizeAiFeedbackSignalMetadata({
      actionType,
      linkedModule: linked.linkedModule,
      linkedRecordId: linked.linkedRecordId,
      ownerUserId,
      dueAt,
      mitigationState: nextMitigationState,
      riskReductionPoints,
      evidenceProvided: body?.evidenceProvided === true,
    }),
  });

  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  await recordAiEngineFeedback(adminClient, {
    surface: "risk-action-plan.recommendation-action",
    sourceId: id,
    outcome: actionType === "dismiss" ? "rejected" : actionType === "mark_field_used" ? "field-used" : "accepted",
    rating: actionType === "dismiss" ? 1 : 5,
    reason: actionType,
    signalMetadata: sanitizeAiFeedbackSignalMetadata({
      workflowStatus: nextStatus,
      actionType,
      mitigationState: nextMitigationState,
      riskReductionPoints,
    }),
    createdBy: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    recommendation: update.data,
    linkedModule: linked.linkedModule,
    linkedRecordId: linked.linkedRecordId,
    riskReductionPoints,
  });
}
