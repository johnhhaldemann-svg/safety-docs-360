import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

function canViewCorrectiveActions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "company_user" ||
    role === "sales_demo"
  );
}

function isMissingCorrectiveActionsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_corrective_action");
}

function isDemoRequest(auth: { role: string; user: { email?: string | null } }) {
  return (
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase()
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_view_analytics"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canViewCorrectiveActions(auth.role)) {
    return NextResponse.json(
      { error: "You do not have access to view corrective action proof history." },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (isDemoRequest(auth)) {
    return NextResponse.json({
      evidence:
        id === "demo-action-1"
          ? [
              {
                id: "demo-evidence-1",
                action_id: id,
                company_id: "demo-company",
                file_path: "demo/proof/guardrail-gap.jpg",
                file_name: "guardrail-gap.jpg",
                mime_type: "image/jpeg",
                created_at: new Date().toISOString(),
              },
            ]
          : [],
    });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ evidence: [] });
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

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

  const evidenceResult = await auth.supabase
    .from("company_corrective_action_evidence")
    .select("id, action_id, company_id, file_path, file_name, mime_type, created_at")
    .eq("action_id", id)
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false });

  if (evidenceResult.error) {
    return NextResponse.json(
      { error: evidenceResult.error.message || "Failed to load proof history." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    evidence: evidenceResult.data ?? [],
  });
}
