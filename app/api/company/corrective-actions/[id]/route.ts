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

type ActionUpdatePayload = {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  status?: string;
  assignedUserId?: string;
  dueAt?: string;
  jobsiteId?: string;
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
  return normalized.includes("company_corrective_actions");
}

function canManageCorrectiveActions(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

function isValidTransition(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return true;
  if (fromStatus === "open" && toStatus === "in_progress") return true;
  if (fromStatus === "in_progress" && toStatus === "open") return true;
  return false;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageCorrectiveActions(auth.role)) {
    return NextResponse.json(
      { error: "Only company admins and operations managers can update corrective actions." },
      { status: 403 }
    );
  }

  const { id } = await params;
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

  const existingResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, status, category")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existingResult.error) {
    if (isMissingCorrectiveActionsTable(existingResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "Corrective action tracking tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: existingResult.error.message || "Failed to find corrective action." },
      { status: 500 }
    );
  }

  if (!existingResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as ActionUpdatePayload | null;
  const title = typeof body?.title === "string" ? body.title.trim() : undefined;
  const dueAtRaw = typeof body?.dueAt === "string" ? body.dueAt.trim() : undefined;
  const nextStatus = body?.status ? normalizeStatus(body.status) : undefined;

  if (typeof body?.title === "string" && !title) {
    return NextResponse.json({ error: "Issue title cannot be empty." }, { status: 400 });
  }

  if (nextStatus === "closed") {
    return NextResponse.json(
      {
        error:
          "Use the close endpoint so completion proof or manager override can be enforced correctly.",
      },
      { status: 400 }
    );
  }

  if (nextStatus && !isValidTransition(existingResult.data.status, nextStatus)) {
    return NextResponse.json(
      {
        error: `Invalid status transition from ${existingResult.data.status} to ${nextStatus}.`,
      },
      { status: 400 }
    );
  }

  let dueAtIso: string | null | undefined;
  if (typeof dueAtRaw === "string") {
    if (!dueAtRaw) {
      dueAtIso = null;
    } else {
      const due = new Date(dueAtRaw);
      if (Number.isNaN(due.getTime())) {
        return NextResponse.json({ error: "Due date is invalid." }, { status: 400 });
      }
      dueAtIso = due.toISOString();
    }
  }

  const updateValues = {
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof body?.description === "string" ? { description: body.description.trim() || null } : {}),
    ...(typeof body?.severity === "string" ? { severity: normalizeSeverity(body.severity) } : {}),
    ...(typeof body?.category === "string" ? { category: normalizeCategory(body.category) } : {}),
    ...(typeof body?.jobsiteId === "string" ? { jobsite_id: body.jobsiteId.trim() || null } : {}),
    ...(typeof body?.assignedUserId === "string"
      ? { assigned_user_id: body.assignedUserId.trim() || null }
      : {}),
    ...(typeof dueAtIso !== "undefined" ? { due_at: dueAtIso } : {}),
    ...(nextStatus ? { status: nextStatus, started_at: nextStatus === "in_progress" ? new Date().toISOString() : null } : {}),
    updated_by: auth.user.id,
  };

  const updateResult = await auth.supabase
    .from("company_corrective_actions")
    .update(updateValues)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(
      "id, company_id, jobsite_id, title, description, severity, category, status, assigned_user_id, due_at, started_at, closed_at, manager_override_close, manager_override_reason, created_at, updated_at"
    )
    .single();

  if (updateResult.error) {
    return NextResponse.json(
      { error: updateResult.error.message || "Failed to update corrective action." },
      { status: 500 }
    );
  }

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: id,
    company_id: companyScope.companyId,
    event_type: "updated",
    detail: nextStatus ? `Status updated to ${nextStatus}.` : "Issue details updated.",
    event_payload: {
      status: nextStatus,
      category: body?.category,
      assignedUserId: body?.assignedUserId,
      dueAt: dueAtIso,
    },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    action: updateResult.data,
    message: "Corrective action updated.",
  });
}
