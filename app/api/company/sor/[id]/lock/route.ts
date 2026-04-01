import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole, normalizeAppRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

function canLockSor(role: string) {
  if (isAdminRole(role)) return true;
  const normalized = normalizeAppRole(role);
  return normalized === "company_admin";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_manage_observations"],
  });
  if ("error" in auth) return auth.error;
  if (!canLockSor(auth.role)) {
    return NextResponse.json({ error: "Only admins can lock SOR records." }, { status: 403 });
  }
  const { id } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const result = await auth.supabase
    .from("company_sor_records")
    .update({ status: "locked", updated_by: auth.user.id })
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .in("status", ["submitted"])
    .select("id, status, updated_at")
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to lock SOR." }, { status: 500 });
  return NextResponse.json({ success: true, record: result.data });
}
