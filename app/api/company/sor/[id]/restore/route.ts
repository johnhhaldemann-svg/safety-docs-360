import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data", "can_manage_users"],
  });
  if ("error" in auth) return auth.error;
  if (!isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Admin access required to restore SOR records." }, { status: 403 });
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
    .update({ is_deleted: false, updated_by: auth.user.id })
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .select("id, is_deleted, updated_at")
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to restore SOR." }, { status: 500 });
  return NextResponse.json({ success: true, record: result.data });
}
