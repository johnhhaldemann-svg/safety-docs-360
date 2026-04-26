import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canManageForms(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager"
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageForms(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.active === "boolean") patch.active = body.active;

  const res = await auth.supabase
    .from("company_safety_form_definitions")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .maybeSingle();

  if (res.error || !res.data) {
    return NextResponse.json({ error: res.error?.message || "Not found." }, { status: 404 });
  }
  return NextResponse.json({ definition: res.data });
}
