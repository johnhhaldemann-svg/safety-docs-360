import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_risk_ai_recommendations");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only managers and admins can update recommendations." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const { id: recId } = await params;
  const id = String(recId ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const dismissed = body?.dismissed === true;

  if (!dismissed) {
    return NextResponse.json({ error: "Only dismissed: true is supported." }, { status: 400 });
  }

  const existing = await auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, company_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existing.error) {
    if (isMissingTable(existing.error.message)) {
      return NextResponse.json({ error: "Recommendations table not available." }, { status: 503 });
    }
    return NextResponse.json({ error: existing.error.message || "Lookup failed." }, { status: 500 });
  }
  if (!existing.data?.id) {
    return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
  }

  const upd = await auth.supabase
    .from("company_risk_ai_recommendations")
    .update({ dismissed: true })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("id, dismissed")
    .single();

  if (upd.error) {
    if (isMissingTable(upd.error.message)) {
      return NextResponse.json({ error: "Recommendations table not available." }, { status: 503 });
    }
    return NextResponse.json({ error: upd.error.message || "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true, recommendation: upd.data });
}
