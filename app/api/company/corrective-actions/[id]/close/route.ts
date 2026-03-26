import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

type ClosePayload = {
  managerOverride?: boolean;
  managerOverrideReason?: string;
  closureNote?: string;
};

function canManageCorrectiveActions(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function canVerifyClosed(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
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
  if (!canVerifyClosed(auth.role)) {
    return NextResponse.json(
      { error: "Only Safety Manager or above can mark Verified Closed." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ClosePayload | null;
  const managerOverride = Boolean(body?.managerOverride);
  const managerOverrideReason = body?.managerOverrideReason?.trim() ?? "";
  const closureNote = body?.closureNote?.trim() ?? "";

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
    .select("id, status, jobsite_id, sif_potential, created_at")
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
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(actionResult.data.jobsite_id, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only verify closures for assigned jobsites." },
      { status: 403 }
    );
  }

  if (actionResult.data.status === "verified_closed") {
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
  if (actionResult.data.sif_potential && !closureNote) {
    return NextResponse.json(
      { error: "Closure note is required for SIF-potential observations." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const timeToCloseHours =
    actionResult.data.created_at
      ? Math.max(
          0,
          Number(
            (
              (new Date(now).getTime() - new Date(actionResult.data.created_at).getTime()) /
              (1000 * 60 * 60)
            ).toFixed(2)
          )
        )
      : null;
  const closeResult = await auth.supabase
    .from("company_corrective_actions")
    .update({
      status: "verified_closed",
      workflow_status: "verified_closed",
      closed_at: now,
      closure_note: closureNote || null,
      validation_reviewed_by: auth.user.id,
      validation_reviewed_at: now,
      time_to_close_hours: timeToCloseHours,
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
      closureNote: closureNote || null,
      validationReviewedBy: auth.user.id,
      validationReviewedAt: now,
      timeToCloseHours,
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
