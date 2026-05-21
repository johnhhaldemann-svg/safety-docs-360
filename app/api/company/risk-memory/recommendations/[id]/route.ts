import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { buildSalesDemoRecommendationDismissResponse } from "@/lib/demoWorkspace";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  recordAiEngineFeedback,
  sanitizeAiFeedbackSignalMetadata,
  type AiEngineFeedbackOutcome,
  type AiEngineReadableClient,
} from "@/lib/superadmin/aiEngineOperations";
import type { RiskActionRecommendationStatus } from "@/types/risk-action-plan";

export const runtime = "nodejs";

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_risk_ai_recommendations");
}

const STATUSES = new Set<RiskActionRecommendationStatus>([
  "active",
  "accepted",
  "assigned",
  "field_used",
  "resolved",
  "dismissed",
]);

function normalizeStatus(value: unknown): RiskActionRecommendationStatus | null {
  const raw = String(value ?? "").trim().toLowerCase();
  return STATUSES.has(raw as RiskActionRecommendationStatus) ? (raw as RiskActionRecommendationStatus) : null;
}

function optionalUuid(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalDueAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function feedbackOutcomeForStatus(status: RiskActionRecommendationStatus): AiEngineFeedbackOutcome | null {
  if (status === "accepted" || status === "assigned" || status === "resolved") return "accepted";
  if (status === "field_used") return "field-used";
  if (status === "dismissed") return "rejected";
  return null;
}

function eventTypeForStatus(status: RiskActionRecommendationStatus) {
  if (status === "active") return "feedback";
  if (status === "field_used") return "field_used";
  return status;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const { id: recId } = await params;
  const id = String(recId ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json(buildSalesDemoRecommendationDismissResponse(id));
  }
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only managers and admins can update recommendations." }, { status: 403 });
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
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const nextStatus = normalizeStatus(body?.status ?? (body?.dismissed === true ? "dismissed" : null));
  if (!nextStatus) {
    return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
  }
  const ownerUserId = optionalUuid(body?.ownerUserId ?? body?.owner_user_id);
  const dueAt = optionalDueAt(body?.dueAt ?? body?.due_at);

  const existing = await auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, company_id, status, priority, target_module")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existing.error) {
    if (isMissingTable(existing.error.message)) {
      return NextResponse.json({ error: "Recommendations table not available." }, { status: 503 });
    }
    return NextResponse.json({ error: existing.error.message || "Lookup failed." }, { status: 500 });
  }
  if (!existing.data?.id) {
    return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    dismissed: nextStatus === "dismissed",
    ...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
    ...(dueAt ? { due_at: dueAt } : {}),
    ...(nextStatus === "accepted" ? { accepted_at: now } : {}),
    ...(nextStatus === "field_used" ? { field_used_at: now } : {}),
    ...(nextStatus === "resolved" ? { resolved_at: now } : {}),
    ...(nextStatus === "dismissed" ? { dismissed_at: now } : {}),
  };
  if (nextStatus === "assigned" && ownerUserId) {
    updatePayload.owner_user_id = ownerUserId;
  }

  const upd = await auth.supabase
    .from("company_risk_ai_recommendations")
    .update(updatePayload)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("id, dismissed, status, priority, owner_user_id, due_at, target_module, target_href, accepted_at, field_used_at, resolved_at, dismissed_at")
    .single();

  if (upd.error) {
    if (isMissingTable(upd.error.message)) {
      return NextResponse.json({ error: "Recommendations table not available." }, { status: 503 });
    }
    return NextResponse.json({ error: upd.error.message || "Update failed." }, { status: 500 });
  }

  const previousStatus = String(existing.data.status ?? "active");
  await auth.supabase.from("company_risk_recommendation_events").insert({
    company_id: companyScope.companyId,
    recommendation_id: id,
    event_type: eventTypeForStatus(nextStatus),
    from_status: previousStatus,
    to_status: nextStatus,
    actor_user_id: auth.user.id,
    metadata: sanitizeAiFeedbackSignalMetadata({
      priority: existing.data.priority,
      targetModule: existing.data.target_module,
      ownerUserId,
      dueAt,
    }),
  });

  const outcome = feedbackOutcomeForStatus(nextStatus);
  if (outcome) {
    const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
    await recordAiEngineFeedback(adminClient, {
      surface: "risk-action-plan.recommendation",
      sourceId: id,
      outcome,
      rating: outcome === "rejected" ? 1 : 5,
      reason: nextStatus,
      signalMetadata: sanitizeAiFeedbackSignalMetadata({
        workflowStatus: nextStatus,
        priority: existing.data.priority,
        targetModule: existing.data.target_module,
      }),
      createdBy: auth.user.id,
    });
  }

  return NextResponse.json({ success: true, recommendation: upd.data });
}
