import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

const ACTION_STATUSES = new Set(["open", "in_progress", "closed"]);
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
  jobsiteId?: string;
  assignedUserId?: string;
  dueAt?: string;
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

function isMissingCorrectiveActionsTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_corrective_actions") ||
    normalized.includes("company_corrective_action_evidence") ||
    normalized.includes("company_corrective_action_events")
  );
}

function canManageCorrectiveActions(role: string) {
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
    return NextResponse.json({ actions: [] });
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeStatus(searchParams.get("status"));
  const assigneeId = searchParams.get("assigneeId")?.trim();
  const jobsiteId = searchParams.get("jobsiteId")?.trim();
  const overdueOnly = searchParams.get("overdue") === "true";

  let query = auth.supabase
    .from("company_corrective_actions")
    .select(
      "id, company_id, jobsite_id, title, description, severity, category, status, assigned_user_id, due_at, started_at, closed_at, manager_override_close, manager_override_reason, created_at, updated_at, created_by, updated_by"
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
    query = query.eq("jobsite_id", jobsiteId);
  }
  if (overdueOnly) {
    query = query.lt("due_at", new Date().toISOString()).neq("status", "closed");
  }

  const actionsResult = await query;
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
    return {
      ...row,
      evidence_count: evidenceCountByActionId.get(id) ?? 0,
      latest_evidence_path: latestEvidencePathByActionId.get(id) ?? null,
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
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

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
  const assignedUserId = body?.assignedUserId?.trim() ?? "";
  const dueAtRaw = body?.dueAt?.trim() ?? "";

  if (!title) {
    return NextResponse.json({ error: "Issue title is required." }, { status: 400 });
  }

  const dueAtIso = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;
  if (dueAtRaw && Number.isNaN(new Date(dueAtRaw).getTime())) {
    return NextResponse.json({ error: "Due date is invalid." }, { status: 400 });
  }

  const insertResult = await auth.supabase
    .from("company_corrective_actions")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId || null,
      title,
      description: description || null,
      severity,
      category,
      status: "open",
      assigned_user_id: assignedUserId || null,
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
      dueAt: dueAtIso,
    },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    action: insertResult.data,
    message: "Corrective action created.",
  });
}
