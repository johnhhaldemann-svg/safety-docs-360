import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type EvidencePayload = {
  filePath?: string;
  fileName?: string;
  mimeType?: string;
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
      { error: "Only company admins and operations managers can attach completion proof." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as EvidencePayload | null;
  const filePath = body?.filePath?.trim() ?? "";
  const fileName = body?.fileName?.trim() ?? "";
  const mimeType = body?.mimeType?.trim() ?? "";

  if (!filePath || !fileName) {
    return NextResponse.json(
      { error: "filePath and fileName are required for completion proof." },
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

  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id")
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

  const insertResult = await auth.supabase
    .from("company_corrective_action_evidence")
    .insert({
      action_id: id,
      company_id: companyScope.companyId,
      file_path: filePath,
      file_name: fileName,
      mime_type: mimeType || null,
      created_by: auth.user.id,
    })
    .select("id, action_id, company_id, file_path, file_name, mime_type, created_at")
    .single();

  if (insertResult.error) {
    return NextResponse.json(
      { error: insertResult.error.message || "Failed to attach completion proof." },
      { status: 500 }
    );
  }

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: id,
    company_id: companyScope.companyId,
    event_type: "evidence_added",
    detail: "Completion proof photo attached.",
    event_payload: {
      evidenceId: insertResult.data.id,
      fileName,
      filePath,
      mimeType: mimeType || null,
    },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    evidence: insertResult.data,
    message: "Completion proof attached.",
  });
}
