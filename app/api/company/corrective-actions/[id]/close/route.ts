import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type ClosePayload = {
  managerOverride?: boolean;
  managerOverrideReason?: string;
};

function canManageCorrectiveActions(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

function isMissingCorrectiveActionsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_corrective_action");
}

export async function POST(
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
      { error: "Only company admins and operations managers can close corrective actions." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ClosePayload | null;
  const managerOverride = Boolean(body?.managerOverride);
  const managerOverrideReason = body?.managerOverrideReason?.trim() ?? "";

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

  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, status")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (actionResult.error) {
    if (isMissingCorrectiveActionsTable(actionResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "Corrective action tracking tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: actionResult.error.message || "Failed to find corrective action." },
      { status: 500 }
    );
  }

  if (!actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  if (actionResult.data.status === "closed") {
    return NextResponse.json(
      { success: true, message: "Corrective action is already closed." },
      { status: 200 }
    );
  }

  const evidenceResult = await auth.supabase
    .from("company_corrective_action_evidence")
    .select("id", { count: "exact", head: true })
    .eq("action_id", id)
    .eq("company_id", companyScope.companyId);

  if (evidenceResult.error) {
    return NextResponse.json(
      { error: evidenceResult.error.message || "Failed to validate completion proof." },
      { status: 500 }
    );
  }

  const evidenceCount = evidenceResult.count ?? 0;
  if (evidenceCount < 1 && !managerOverride) {
    return NextResponse.json(
      {
        error:
          "At least one completion photo is required before closing this issue, unless a manager override is provided.",
      },
      { status: 400 }
    );
  }

  if (managerOverride && !managerOverrideReason) {
    return NextResponse.json(
      { error: "Manager override reason is required when closing without photo proof." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const closeResult = await auth.supabase
    .from("company_corrective_actions")
    .update({
      status: "closed",
      closed_at: now,
      manager_override_close: managerOverride,
      manager_override_reason: managerOverride ? managerOverrideReason : null,
      updated_by: auth.user.id,
    })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(
      "id, company_id, jobsite_id, title, description, severity, status, assigned_user_id, due_at, started_at, closed_at, manager_override_close, manager_override_reason, created_at, updated_at"
    )
    .single();

  if (closeResult.error) {
    return NextResponse.json(
      { error: closeResult.error.message || "Failed to close corrective action." },
      { status: 500 }
    );
  }

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: id,
    company_id: companyScope.companyId,
    event_type: "closed",
    detail: managerOverride
      ? "Issue closed with manager override and no photo proof."
      : "Issue closed with completion photo proof.",
    event_payload: {
      managerOverride,
      managerOverrideReason: managerOverride ? managerOverrideReason : null,
      evidenceCount,
    },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    action: closeResult.data,
    message: managerOverride
      ? "Corrective action closed with manager override."
      : "Corrective action closed.",
  });
}
