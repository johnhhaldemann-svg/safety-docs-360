import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

const ACTION_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
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

type SafetySubmissionPayload = {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  jobsiteId?: string;
  photoPath?: string;
};

function normalizeSeverity(severity?: string | null) {
  const normalized = (severity ?? "").trim().toLowerCase();
  return ACTION_SEVERITIES.has(normalized) ? normalized : "medium";
}

function normalizeCategory(category?: string | null) {
  const normalized = (category ?? "").trim().toLowerCase();
  return ISSUE_CATEGORIES.has(normalized) ? normalized : "hazard";
}

function isMissingSafetySubmissionTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_safety_submissions") ||
    normalized.includes("company_corrective_actions")
  );
}

function canReviewSafetySubmissions(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ submissions: [] });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "pending").trim().toLowerCase();

  let query = auth.supabase
    .from("company_safety_submissions")
    .select(
      "id, company_id, jobsite_id, title, description, severity, category, photo_path, submitted_by, review_status, reviewed_by, reviewed_at, linked_action_id, created_at, updated_at"
    )
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false });

  if (status === "pending" || status === "approved" || status === "rejected") {
    query = query.eq("review_status", status);
  }

  const submissionsResult = await query;
  if (submissionsResult.error) {
    if (isMissingSafetySubmissionTable(submissionsResult.error.message)) {
      return NextResponse.json(
        {
          submissions: [],
          warning:
            "Safety submission tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: submissionsResult.error.message || "Failed to load safety submissions." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    submissions: submissionsResult.data ?? [],
    canReview: canReviewSafetySubmissions(auth.role),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
  });

  if ("error" in auth) {
    return auth.error;
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

  const body = (await request.json().catch(() => null)) as SafetySubmissionPayload | null;
  const title = body?.title?.trim() ?? "";
  const description = body?.description?.trim() ?? "";
  const severity = normalizeSeverity(body?.severity);
  const category = normalizeCategory(body?.category);
  const jobsiteId = body?.jobsiteId?.trim() ?? "";
  const photoPath = body?.photoPath?.trim() ?? "";

  if (!title) {
    return NextResponse.json({ error: "Issue title is required." }, { status: 400 });
  }

  const submissionResult = await auth.supabase
    .from("company_safety_submissions")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId || null,
      title,
      description: description || null,
      severity,
      category,
      photo_path: photoPath || null,
      submitted_by: auth.user.id,
      review_status: "pending",
    })
    .select(
      "id, company_id, jobsite_id, title, description, severity, category, photo_path, submitted_by, review_status, created_at"
    )
    .single();

  if (submissionResult.error) {
    if (isMissingSafetySubmissionTable(submissionResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "Safety submission tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: submissionResult.error.message || "Failed to create safety submission." },
      { status: 500 }
    );
  }

  const correctiveActionResult = await auth.supabase
    .from("company_corrective_actions")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId || null,
      title,
      description: description || null,
      severity,
      category,
      status: "open",
      source_submission_id: submissionResult.data.id,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(
      "id, company_id, jobsite_id, title, description, severity, category, status, assigned_user_id, due_at, started_at, closed_at, source_submission_id, created_at, updated_at"
    )
    .single();

  if (correctiveActionResult.error) {
    return NextResponse.json(
      { error: correctiveActionResult.error.message || "Failed to create corrective action." },
      { status: 500 }
    );
  }

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: correctiveActionResult.data.id,
    company_id: companyScope.companyId,
    event_type: "created_from_submission",
    detail: "Corrective action created from individual safety submission.",
    event_payload: {
      submissionId: submissionResult.data.id,
      severity,
      category,
      photoPath: photoPath || null,
    },
    created_by: auth.user.id,
  });

  await auth.supabase
    .from("company_safety_submissions")
    .update({
      linked_action_id: correctiveActionResult.data.id,
    })
    .eq("id", submissionResult.data.id)
    .eq("company_id", companyScope.companyId);

  if (photoPath) {
    await auth.supabase.from("company_corrective_action_evidence").insert({
      action_id: correctiveActionResult.data.id,
      company_id: companyScope.companyId,
      file_path: photoPath,
      file_name: photoPath.split("/").pop() || "safety-photo",
      mime_type: null,
      created_by: auth.user.id,
    });
  }

  return NextResponse.json({
    success: true,
    submission: submissionResult.data,
    action: correctiveActionResult.data,
    submissionId: submissionResult.data.id,
    actionId: correctiveActionResult.data.id,
    message: "Safety submission received. Awaiting company admin review.",
  });
}
