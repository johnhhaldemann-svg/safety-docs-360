import { NextResponse } from "next/server";
import { enforceDraftOnlyStatus } from "@/lib/gus/gusSafetyGate";
import { detectGusWorkTypes } from "@/lib/gus/plans/detectWorkType";
import { authorizeRequest, isAdminRole, normalizeAppRole } from "@/lib/rbac";

export const runtime = "nodejs";

type GusPlanningSessionAuth = Exclude<Awaited<ReturnType<typeof authorizeRequest>>, { error: NextResponse }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function hasCompanyWideJobsiteAccess(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager"
  );
}

async function hasCompanyMembership(auth: GusPlanningSessionAuth, companyId: string) {
  if (isAdminRole(auth.role)) return true;

  const roleResult = await auth.supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .eq("company_id", companyId)
    .eq("account_status", "active")
    .maybeSingle();

  if (roleResult.data) return true;

  const membershipResult = await auth.supabase
    .from("company_memberships")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  return Boolean(membershipResult.data);
}

async function hasJobsiteAccess(auth: GusPlanningSessionAuth, companyId: string, jobsiteId: string | null) {
  if (!jobsiteId) return true;
  if (hasCompanyWideJobsiteAccess(auth.role)) return true;

  const assignmentResult = await auth.supabase
    .from("company_jobsite_assignments")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("company_id", companyId)
    .eq("jobsite_id", jobsiteId)
    .maybeSingle();

  return Boolean(assignmentResult.data);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_access_field_work", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const workType = cleanString(body.workType, 160);
  const taskDescription = cleanString(body.taskDescription, 4_000);
  if (!workType) {
    return NextResponse.json({ error: "workType is required." }, { status: 400 });
  }

  const companyId = cleanString(body.companyId, 80) || null;
  const jobsiteId = cleanString(body.jobsiteId, 80) || null;

  if (companyId) {
    const canUseCompany = await hasCompanyMembership(auth, companyId);
    const canUseJobsite = canUseCompany ? await hasJobsiteAccess(auth, companyId, jobsiteId) : false;
    if (!canUseCompany || !canUseJobsite) {
      return NextResponse.json(
        { error: "You do not have access to create a Gus planning session for this scope." },
        { status: 403 },
      );
    }
  }

  const detected = detectGusWorkTypes(`${workType} ${taskDescription}`.trim());
  const missingItems = cleanStringArray(body.missingItems);
  const riskFlags = cleanStringArray(body.riskFlags);
  const status = enforceDraftOnlyStatus(
    missingItems.length > 0 ? "draft_incomplete" : cleanString(body.status, 80) || "draft_incomplete",
  );

  const insert = await auth.supabase
    .from("gus_planning_sessions")
    .insert({
      company_id: companyId,
      jobsite_id: jobsiteId,
      user_id: auth.user.id,
      work_type: workType,
      detected_modules: detected.matches,
      task_description: taskDescription || null,
      status,
      plan_data: isRecord(body.planData) ? body.planData : {},
      missing_items: missingItems,
      risk_flags: riskFlags,
      human_review_required: true,
    })
    .select("*")
    .single();

  if (insert.error) {
    return NextResponse.json(
      { error: insert.error.message || "Failed to create Gus planning session." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    session: insert.data,
    draftOnly: true,
    humanReviewRequired: true,
    officialRecordCreated: false,
  });
}
