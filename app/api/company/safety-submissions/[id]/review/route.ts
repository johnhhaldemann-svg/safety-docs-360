import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

const ISSUE_CATEGORIES = new Set([
  "hazard",
  "near_miss",
  "incident",
  "good_catch",
  "ppe_violation",
  "housekeeping",
  "equipment_issue",
  "fall_hazard",
  "electrical_hazard",
  "excavation_trench_concern",
  "fire_hot_work_concern",
  "corrective_action",
]);

type ReviewPayload = {
  decision?: "approved" | "rejected";
  actionStatus?: "open" | "closed";
  category?: string;
};

function canReviewSafetySubmissions(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

function normalizeCategory(category?: string | null) {
  const normalized = (category ?? "").trim().toLowerCase();
  return ISSUE_CATEGORIES.has(normalized) ? normalized : "hazard";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_manage_company_users", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canReviewSafetySubmissions(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and managers can review safety submissions." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ReviewPayload | null;
  const decision = body?.decision;
  const actionStatus = body?.actionStatus ?? "open";
  const category = normalizeCategory(body?.category);

  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: "Review decision must be approved or rejected." },
      { status: 400 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const submissionResult = await auth.supabase
    .from("company_safety_submissions")
    .select("id, review_status, linked_action_id, title")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (submissionResult.error) {
    return NextResponse.json(
      { error: submissionResult.error.message || "Failed to load safety submission." },
      { status: 500 }
    );
  }
  if (!submissionResult.data) {
    return NextResponse.json({ error: "Safety submission not found." }, { status: 404 });
  }
  if (!submissionResult.data.linked_action_id) {
    return NextResponse.json(
      { error: "Safety submission is not linked to a corrective action." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const nextActionStatus = decision === "rejected" ? "closed" : actionStatus;

  const actionUpdateResult = await auth.supabase
    .from("company_corrective_actions")
    .update({
      category,
      status: nextActionStatus,
      closed_at: nextActionStatus === "closed" ? now : null,
      updated_by: auth.user.id,
    })
    .eq("id", submissionResult.data.linked_action_id)
    .eq("company_id", companyScope.companyId)
    .select(
      "id, company_id, title, status, category, source_submission_id, closed_at, updated_at"
    )
    .single();

  if (actionUpdateResult.error) {
    return NextResponse.json(
      { error: actionUpdateResult.error.message || "Failed to update linked corrective action." },
      { status: 500 }
    );
  }

  const submissionUpdateResult = await auth.supabase
    .from("company_safety_submissions")
    .update({
      review_status: decision,
      category,
      reviewed_by: auth.user.id,
      reviewed_at: now,
    })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(
      "id, review_status, category, reviewed_by, reviewed_at, linked_action_id, title, created_at"
    )
    .single();

  if (submissionUpdateResult.error) {
    return NextResponse.json(
      { error: submissionUpdateResult.error.message || "Failed to update safety submission review." },
      { status: 500 }
    );
  }

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: submissionResult.data.linked_action_id,
    company_id: companyScope.companyId,
    event_type: "submission_reviewed",
    detail: `Safety submission ${decision}.`,
    event_payload: {
      submissionId: id,
      decision,
      category,
      actionStatus: nextActionStatus,
    },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    submission: submissionUpdateResult.data,
    action: actionUpdateResult.data,
    message:
      decision === "approved"
        ? `Submission approved and issue set to ${nextActionStatus}.`
        : "Submission rejected and linked issue closed.",
  });
}
