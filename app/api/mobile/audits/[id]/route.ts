import { NextResponse } from "next/server";
import { GET as getAudit } from "@/app/api/company/field-audits/[id]/route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

export { getAudit as GET };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_submit_documents", "can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = String(body?.status ?? "").trim().toLowerCase();
  const patch: Record<string, unknown> = {};
  if (status === "draft" || status === "pending_review" || status === "submitted" || status === "archived") {
    patch.status = status;
  }
  if (typeof body?.auditors === "string") patch.auditors = body.auditors.trim();
  if (typeof body?.auditDate === "string") patch.audit_date = body.auditDate.trim() || null;
  if (Object.keys(patch).length < 1) return NextResponse.json({ error: "No supported audit fields provided." }, { status: 400 });
  const result = await auth.supabase
    .from("company_jobsite_audits")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message || "Failed to update audit." }, { status: 500 });
  return NextResponse.json({ success: true, audit: result.data });
}
