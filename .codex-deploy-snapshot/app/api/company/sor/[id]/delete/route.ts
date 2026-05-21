import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_edit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const record = await auth.supabase
    .from("company_sor_records")
    .select("id, created_by, status, is_deleted")
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .single();
  if (record.error) return NextResponse.json({ error: record.error.message || "SOR not found." }, { status: 404 });
  if (record.data.is_deleted) return NextResponse.json({ success: true });
  if (record.data.status !== "draft" && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Only admins can soft-delete submitted/locked SOR records." }, { status: 403 });
  }
  if (record.data.status === "draft" && record.data.created_by !== auth.user.id && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "You can only delete your own draft SOR records." }, { status: 403 });
  }

  const result = await auth.supabase
    .from("company_sor_records")
    .update({ is_deleted: true, updated_by: auth.user.id })
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .select("id, is_deleted, updated_at")
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to soft-delete SOR." }, { status: 500 });
  return NextResponse.json({ success: true, record: result.data });
}
