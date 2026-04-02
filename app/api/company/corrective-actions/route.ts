import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

const ACTION_STATUSES = new Set([
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "escalated",
  "stop_work",
]);
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

type CorrectiveActionPayload = {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  status?: string;
  jobsiteId?: string;
  assignedUserId?: string;
  dueAt?: string;
  dapId?: string;
  dapActivityId?: string;
  workflowStatus?: string;
  observationType?: "positive" | "negative" | "near_miss";
  sifPotential?: boolean;
  sifCategory?: string;
};

function normalizeStatus(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  return ACTION_STATUSES.has(normalized) ? normalized : "open";
}

function normalizeSeverity(severity?: string | null) {
  const normalized = (severity ?? "").trim().toLowerCase();
  return ACTION_SEVERITIES.has(normalized) ? normalized : "medium";
}

function normalizeCategory(category?: string | null) {
  const normalized = (category ?? "").trim().toLowerCase();
  return ISSUE_CATEGORIES.has(normalized) ? normalized : "corrective_action";
}

function shouldRequireImmediateAction(severity: string, category: string) {
  return severity === "high" || severity === "critical" || category === "near_miss";
}

const SIF_CATEGORIES = new Set([
  "fall_from_height",
  "struck_by",
  "caught_between",
  "electrical",
  "excavation_collapse",
  "confined_space",
  "hazardous_energy",
  "crane_rigging",
  "line_of_fire",
]);

function normalizeObservationType(input?: string | null) {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "positive" || value === "near_miss") return value;
  return "negative";
}

function normalizeSifCategory(input?: string | null) {
  const value = (input ?? "").trim().toLowerCase();
  return SIF_CATEGORIES.has(value) ? value : null;
}

function isMissingCorrectiveActionsTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_corrective_actions") ||
    normalized.includes("company_corrective_action_evidence") ||
    normalized.includes("company_corrective_action_events")
  );
}
function isMissingCompatView(message?: string | null) {
  return (message ?? "").toLowerCase().includes("compat_company_corrective_actions");
}

function canManageCorrectiveActions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "foreman"
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
    ],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ actions: [] });
  }
  const csepBlockGet = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockGet) return csepBlockGet;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { searchParams } = new URL(request.url);
  const status = normalizeStatus(searchParams.get("status"));
  const assigneeId = searchParams.get("assigneeId")?.trim();
  const jobsiteId = searchParams.get("jobsiteId")?.trim();
  const overdueOnly = searchParams.get("overdue") === "true";

  let query = auth.supabase
    .from("compat_company_corrective_actions")
    .select(
      "id, company_id, jobsite_id, observation_id, title, description, severity, category, status, due_at, closed_at, created_at, updated_at"
    )
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });

  if (searchParams.has("status")) {
    query = query.eq("status", status);
  }
  if (assigneeId) {
    query = query.eq("assigned_user_id", assigneeId);
  }
  if (jobsiteId) {
    if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
      return NextResponse.json({ actions: [] });
    }
    query = query.eq("jobsite_id", jobsiteId);
  }
  if (jobsiteScope.restricted && !jobsiteId) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({ actions: [] });
    }
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }
  if (overdueOnly) {
    query = query
      .lt("due_at", new Date().toISOString())
      .not("status", "in", "(verified_closed)");
  }

  let actionsResult: {
    data: Array<Record<string, unknown>> | null;
    error: { message?: string | null } | null;
  } = (await query) as {
    data: Array<Record<string, unknown>> | null;
    error: { message?: string | null } | null;
  };
  if (actionsResult.error && isMissingCompatView(actionsResult.error.message)) {
    let fallbackQuery = auth.supabase
      .from("company_corrective_actions")
      .select(
        "id, company_id, jobsite_id, title, description, severity, category, status, assigned_user_id, due_at, started_at, closed_at, manager_override_close, manager_override_reason, created_at, updated_at, created_by, updated_by"
      )
      .eq("company_id", companyScope.companyId)
      .order("updated_at", { ascending: false });
    if (searchParams.has("status")) {
      fallbackQuery = fallbackQuery.eq("status", status);
    }
    if (assigneeId) {
      fallbackQuery = fallbackQuery.eq("assigned_user_id", assigneeId);
    }
    if (jobsiteId) {
      fallbackQuery = fallbackQuery.eq("jobsite_id", jobsiteId);
    }
    if (overdueOnly) {
      fallbackQuery = fallbackQuery
        .lt("due_at", new Date().toISOString())
        .not("status", "in", "(verified_closed)");
    }
    if (jobsiteScope.restricted && !jobsiteId) {
      if (jobsiteScope.jobsiteIds.length < 1) {
        return NextResponse.json({ actions: [] });
      }
      fallbackQuery = fallbackQuery.in("jobsite_id", jobsiteScope.jobsiteIds);
    }
    actionsResult = (await fallbackQuery) as {
      data: Array<Record<string, unknown>> | null;
      error: { message?: string | null } | null;
    };
  }
  if (actionsResult.error) {
    if (isMissingCorrectiveActionsTable(actionsResult.error.message)) {
      return NextResponse.json(
        {
          actions: [],
          warning:
            "Corrective action tracking tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: actionsResult.error.message || "Failed to load corrective actions." },
      { status: 500 }
    );
  }

  const actionRows = (actionsResult.data ?? []) as Array<Record<string, unknown>>;
  const actionIds = actionRows
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);

  let evidenceCountByActionId = new Map<string, number>();
  let latestEvidencePathByActionId = new Map<string, string>();
  if (actionIds.length > 0) {
    const evidenceResult = await auth.supabase
      .from("company_corrective_action_evidence")
      .select("action_id, file_path, created_at")
      .eq("company_id", companyScope.companyId)
      .order("created_at", { ascending: false })
      .in("action_id", actionIds);

    if (!evidenceResult.error) {
      evidenceCountByActionId = new Map<string, number>();
      latestEvidencePathByActionId = new Map<string, string>();
      for (const row of
        (evidenceResult.data as Array<{ action_id: string; file_path: string }> | null) ?? []) {
        evidenceCountByActionId.set(
          row.action_id,
          (evidenceCountByActionId.get(row.action_id) ?? 0) + 1
        );
        if (!latestEvidencePathByActionId.has(row.action_id)) {
          latestEvidencePathByActionId.set(row.action_id, row.file_path);
        }
      }
    }
  }

  const actions = actionRows.map((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const createdAt = typeof row.created_at === "string" ? row.created_at : null;
    const closedAt = typeof row.closed_at === "string" ? row.closed_at : null;
    const timeToCloseHours =
      createdAt && closedAt
        ? Math.max(
            0,
            Number(
              (
                (new Date(closedAt).getTime() - new Date(createdAt).getTime()) /
                (1000 * 60 * 60)
              ).toFixed(2)
            )
          )
        : null;
    return {
      assigned_user_id:
        typeof row.assigned_user_id === "string" ? row.assigned_user_id : null,
      started_at: typeof row.started_at === "string" ? row.started_at : null,
      manager_override_close:
        typeof row.manager_override_close === "boolean" ? row.manager_override_close : false,
      manager_override_reason:
        typeof row.manager_override_reason === "string" ? row.manager_override_reason : null,
      created_by: typeof row.created_by === "string" ? row.created_by : null,
      updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
      ...row,
      evidence_count: evidenceCountByActionId.get(id) ?? 0,
      latest_evidence_path: latestEvidencePathByActionId.get(id) ?? null,
      immediate_action_required: shouldRequireImmediateAction(
        String(row.severity ?? "").toLowerCase(),
        String(row.category ?? "").toLowerCase()
      ),
      time_to_close_hours: timeToCloseHours,
    };
  });

  return NextResponse.json({
    actions,
    scopeCompanyId: companyScope.companyId,
    scopeCompanyName: companyScope.companyName,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });

  if ("error" in auth) {
    return auth.error;
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
  const csepBlockPost = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockPost) return csepBlockPost;

  if (!canManageCorrectiveActions(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and operations managers can create corrective actions." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as CorrectiveActionPayload | null;
  const title = body?.title?.trim() ?? "";
  const description = body?.description?.trim() ?? "";
  const severity = normalizeSeverity(body?.severity);
  const category = normalizeCategory(body?.category);
  const jobsiteId = body?.jobsiteId?.trim() ?? "";
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId || null, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only create observations for assigned jobsites." },
      { status: 403 }
    );
  }

  const assignedUserId = body?.assignedUserId?.trim() ?? "";
  const dapId = body?.dapId?.trim() ?? "";
  const dapActivityId = body?.dapActivityId?.trim() ?? "";
  const requestedWorkflowStatus = body?.workflowStatus?.trim().toLowerCase() ?? "open";
  const observationType = normalizeObservationType(body?.observationType);
  const hasSifPotential = typeof body?.sifPotential === "boolean";
  const sifPotential = Boolean(body?.sifPotential);
  const sifCategory = normalizeSifCategory(body?.sifCategory);
  if (observationType === "negative" && !hasSifPotential) {
    return NextResponse.json(
      { error: "SIF evaluation is required for negative observations." },
      { status: 400 }
    );
  }
  if (sifPotential && !sifCategory) {
    return NextResponse.json(
      { error: "SIF category is required when sif_potential is yes." },
      { status: 400 }
    );
  }
  const workflowStatus = shouldRequireImmediateAction(severity, category)
    ? requestedWorkflowStatus === "verified_closed"
      ? requestedWorkflowStatus
      : "immediate_action_required"
    : requestedWorkflowStatus;
  const dueAtRaw = body?.dueAt?.trim() ?? "";

  if (!title) {
    return NextResponse.json({ error: "Issue title is required." }, { status: 400 });
  }

  const dueAtIso = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;
  if (dueAtRaw && Number.isNaN(new Date(dueAtRaw).getTime())) {
    return NextResponse.json({ error: "Due date is invalid." }, { status: 400 });
  }

  const immediateActionRequired =
    shouldRequireImmediateAction(severity, category) || (observationType === "negative" && sifPotential);
  const priority = sifPotential ? "high" : severity;

  const insertResult = await auth.supabase
    .from("company_corrective_actions")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId || null,
      title,
      description: description || null,
      severity,
      category,
      status: normalizeStatus(
        body?.status ??
          (workflowStatus === "immediate_action_required" ? "open" : "open")
      ),
      assigned_user_id: assignedUserId || null,
      dap_id: dapId || null,
      dap_activity_id: dapActivityId || null,
      workflow_status: workflowStatus,
      observation_type: observationType,
      sif_potential: observationType === "negative" ? sifPotential : null,
      sif_category: observationType === "negative" && sifPotential ? sifCategory : null,
      immediate_action_required: immediateActionRequired,
      priority,
      due_at: dueAtIso,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(
      "id, company_id, jobsite_id, title, description, severity, category, status, assigned_user_id, due_at, started_at, closed_at, manager_override_close, manager_override_reason, created_at, updated_at"
    )
    .single();

  if (insertResult.error) {
    if (isMissingCorrectiveActionsTable(insertResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "Corrective action tracking tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: insertResult.error.message || "Failed to create corrective action." },
      { status: 500 }
    );
  }

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: insertResult.data.id,
    company_id: companyScope.companyId,
    event_type: "created",
    detail: "Issue created.",
    event_payload: {
      severity,
      category,
      assignedUserId: assignedUserId || null,
      dapId: dapId || null,
      dapActivityId: dapActivityId || null,
      workflowStatus,
      observationType,
      sifPotential: observationType === "negative" ? sifPotential : null,
      sifCategory: observationType === "negative" && sifPotential ? sifCategory : null,
      priority,
      immediateActionRequired,
      dueAt: dueAtIso,
    },
    created_by: auth.user.id,
  });

  if (observationType === "negative" && sifPotential) {
    await auth.supabase.from("company_corrective_action_events").insert({
      action_id: insertResult.data.id,
      company_id: companyScope.companyId,
      event_type: "notify_safety_manager",
      detail: "SIF-potential observation requires Safety Manager attention.",
      event_payload: {
        sifCategory,
        priority: "high",
      },
      created_by: auth.user.id,
    });
  }

  return NextResponse.json({
    success: true,
    action: insertResult.data,
    message: "Corrective action created.",
  });
}
