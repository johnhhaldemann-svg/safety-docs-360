import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { injuryTimePatternFromOccurredAt } from "@/lib/incidents/injuryTimePatterns";
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
  actionStatus?: "open" | "assigned" | "in_progress" | "corrected" | "verified_closed" | "escalated" | "stop_work" | "closed";
  category?: string;
};

function normalizeActionStatus(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "closed") return "verified_closed";
  if (
    normalized === "open" ||
    normalized === "assigned" ||
    normalized === "in_progress" ||
    normalized === "corrected" ||
    normalized === "verified_closed" ||
    normalized === "escalated" ||
    normalized === "stop_work"
  ) {
    return normalized;
  }
  return "open";
}

function canReviewSafetySubmissions(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

function normalizeCategory(category?: string | null) {
  const normalized = (category ?? "").trim().toLowerCase();
  return ISSUE_CATEGORIES.has(normalized) ? normalized : "hazard";
}

function computeSubmissionHash(input: {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  severity?: string | null;
  category: string;
  createdBy?: string | null;
  version: number;
  reviewStatus: "approved" | "rejected" | "pending";
  linkedActionId?: string | null;
}) {
  const normalized = JSON.stringify({
    id: input.id,
    company_id: input.companyId,
    title: input.title,
    description: input.description ?? null,
    severity: input.severity ?? null,
    category: input.category,
    created_by: input.createdBy ?? null,
    version: input.version,
    review_status: input.reviewStatus,
    linked_action_id: input.linkedActionId ?? null,
  });
  return createHash("sha256").update(normalized).digest("hex");
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
  const actionStatus = normalizeActionStatus(body?.actionStatus);
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
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  const submissionResult = await auth.supabase
    .from("company_safety_submissions")
    .select("id, review_status, linked_action_id, title, description, severity, created_by, version")
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
  const nextSubmissionVersion = Math.max((submissionResult.data.version ?? 1) + 1, 1);
  const nextSubmissionHash = computeSubmissionHash({
    id,
    companyId: companyScope.companyId,
    title: submissionResult.data.title || "Safety submission",
    description: submissionResult.data.description ?? null,
    severity: submissionResult.data.severity ?? null,
    category,
    createdBy: submissionResult.data.created_by ?? null,
    version: nextSubmissionVersion,
    reviewStatus: decision,
    linkedActionId: submissionResult.data.linked_action_id,
  });
  const nextActionStatus = decision === "rejected" ? "verified_closed" : actionStatus;
  const shouldConvertToIncident =
    decision === "approved" &&
    (category === "incident" || category === "near_miss");

  const actionUpdateResult = await auth.supabase
    .from("company_corrective_actions")
    .update({
      category,
      status: nextActionStatus,
      closed_at: nextActionStatus === "verified_closed" ? now : null,
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

  let incidentId: string | null = null;
  if (shouldConvertToIncident) {
    const incidentTimePatterns = injuryTimePatternFromOccurredAt(now);
    const incidentInsertResult = await auth.supabase
      .from("company_incidents")
      .insert({
        company_id: companyScope.companyId,
        jobsite_id: null,
        title: submissionResult.data.title || "Converted safety submission",
        description: `Converted from safety submission ${id}.`,
        status: nextActionStatus === "verified_closed" ? "closed" : "open",
        severity: "medium",
        category,
        injury_source: "other",
        exposure_event_type: "other",
        days_away_from_work: 0,
        days_restricted: 0,
        job_transfer: false,
        recordable: false,
        lost_time: false,
        fatality: false,
        injury_type: category === "incident" ? "other" : null,
        body_part: category === "incident" ? "other" : null,
        owner_user_id: auth.user.id,
        occurred_at: now,
        ...incidentTimePatterns,
        sif_flag: category === "incident",
        escalation_level: category === "incident" ? "monitor" : "none",
        stop_work_status: "normal",
        converted_from_submission_id: id,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("id")
      .single();
    if (!incidentInsertResult.error && incidentInsertResult.data) {
      incidentId = incidentInsertResult.data.id;
      await auth.supabase.from("company_risk_events").insert({
        company_id: companyScope.companyId,
        module_name: "incidents",
        record_id: incidentId,
        event_type: "converted_from_submission",
        detail: "Incident converted from safety submission review.",
        event_payload: {
          submissionId: id,
          linkedActionId: submissionResult.data.linked_action_id,
          category,
          decision,
        },
        created_by: auth.user.id,
      });
    }
  }

  const submissionUpdateResult = await auth.supabase
    .from("company_safety_submissions")
    .update({
      review_status: decision,
      category,
      reviewed_by: auth.user.id,
      reviewed_at: now,
      version: nextSubmissionVersion,
      last_modified: now,
      hash: nextSubmissionHash,
    })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(
      "id, review_status, category, reviewed_by, reviewed_at, linked_action_id, title, created_at, created_by, last_modified, version, hash"
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
      incidentId,
    },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    submission: submissionUpdateResult.data,
    action: actionUpdateResult.data,
    incidentId,
    message:
      decision === "approved"
        ? `Submission approved and issue set to ${nextActionStatus}.`
        : "Submission rejected and linked issue closed.",
  });
}
