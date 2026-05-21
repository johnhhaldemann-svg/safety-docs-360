import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canConfigureInductions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canConfigureInductions(auth.role)) {
    return NextResponse.json({ error: "Only admins and managers can update requirements." }, { status: 403 });
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

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.effectiveFrom === "string") patch.effective_from = body.effectiveFrom.trim();
  if (body.effectiveTo === null || typeof body.effectiveTo === "string") {
    patch.effective_to =
      body.effectiveTo === null ? null : String(body.effectiveTo).trim() || null;
  }

  const res = await auth.supabase
    .from("company_induction_requirements")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .maybeSingle();

  if (res.error) {
    return NextResponse.json({ error: res.error.message || "Failed to update requirement." }, { status: 500 });
  }
  if (!res.data) {
    return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
  }

  return NextResponse.json({ requirement: res.data });
}
