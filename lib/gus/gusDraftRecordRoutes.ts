import { NextResponse } from "next/server";
import {
  buildGusDraftRecord,
  type GusDraftRecordType,
  type GusPlanningSessionRecord,
} from "@/lib/gus/gusDraftRecordBuilder";
import { isAdminRole, normalizeAppRole, authorizeRequest } from "@/lib/rbac";

type GusDraftRouteAuth = Exclude<Awaited<ReturnType<typeof authorizeRequest>>, { error: NextResponse }>;

type GusDraftRouteOptions = {
  type: GusDraftRecordType;
  responseKey: "draftJsa" | "draftPermitChecklist" | "preTaskBriefing";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

async function hasCompanyMembership(auth: GusDraftRouteAuth, companyId: string) {
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

async function hasJobsiteAccess(auth: GusDraftRouteAuth, companyId: string, jobsiteId: string | null) {
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

async function canUsePlanningSession(auth: GusDraftRouteAuth, session: GusPlanningSessionRecord) {
  const companyId = text(session.company_id);
  const jobsiteId = text(session.jobsite_id) || null;

  if (!companyId) {
    return text(session.user_id) === auth.user.id;
  }

  if (!(await hasCompanyMembership(auth, companyId))) return false;
  return hasJobsiteAccess(auth, companyId, jobsiteId);
}

function parseDraftRequestBody(value: unknown) {
  if (!isRecord(value)) {
    return {
      sessionId: "",
      confirmed: false,
      permitType: "",
    };
  }

  return {
    sessionId: text(value.sessionId),
    confirmed: value.confirmed === true,
    permitType: text(value.permitType),
  };
}

async function loadPlanningSession(auth: GusDraftRouteAuth, sessionId: string) {
  const result = await auth.supabase
    .from("gus_planning_sessions")
    .select(
      "id, company_id, jobsite_id, user_id, work_type, detected_modules, task_description, status, plan_data, missing_items, risk_flags, human_review_required",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (result.error) {
    return {
      error: NextResponse.json({ error: result.error.message || "Failed to load Gus planning session." }, { status: 500 }),
    };
  }

  if (!result.data) {
    return {
      error: NextResponse.json({ error: "Gus planning session not found." }, { status: 404 }),
    };
  }

  return { session: result.data as GusPlanningSessionRecord };
}

export async function handleGusDraftRecordRequest(request: Request, options: GusDraftRouteOptions) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_access_field_work", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const body = parseDraftRequestBody((await request.json().catch(() => null)) as unknown);
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }
  if (!body.confirmed) {
    return NextResponse.json(
      {
        error: "User confirmation is required before Gus creates a draft record.",
        draftCreated: false,
      },
      { status: 400 },
    );
  }

  const loaded = await loadPlanningSession(auth, body.sessionId);
  if ("error" in loaded) return loaded.error;

  if (!(await canUsePlanningSession(auth, loaded.session))) {
    return NextResponse.json({ error: "You do not have access to this Gus planning session." }, { status: 403 });
  }

  const draft = buildGusDraftRecord(loaded.session, options.type, { permitType: body.permitType });
  const insert = await auth.supabase
    .from("gus_generated_plans")
    .insert({
      session_id: loaded.session.id,
      company_id: loaded.session.company_id ?? null,
      jobsite_id: loaded.session.jobsite_id ?? null,
      plan_type: draft.planType,
      plan_title: draft.planTitle,
      plan_content: draft.content,
      status: draft.status,
      human_review_required: true,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message || "Failed to create Gus draft record." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    draftCreated: true,
    officialRecordCreated: false,
    [options.responseKey]: insert.data,
    validationFindings: draft.validationFindings,
  });
}
