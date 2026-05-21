import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_manage_company_users",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ status: "unknown", reasons: ["No company workspace."] });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { id: contractorId } = await params;
  const c = await auth.supabase
    .from("company_contractors")
    .select("id, name")
    .eq("company_id", companyScope.companyId)
    .eq("id", contractorId)
    .maybeSingle();
  if (c.error || !c.data) {
    return NextResponse.json({ error: "Contractor not found." }, { status: 404 });
  }

  const docs = await auth.supabase
    .from("company_contractor_documents")
    .select("id, title, doc_type, expires_on, verification_status")
    .eq("company_id", companyScope.companyId)
    .eq("contractor_id", contractorId);

  if (docs.error) {
    return NextResponse.json({ error: docs.error.message }, { status: 500 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reasons: string[] = [];
  let expired = 0;
  for (const row of docs.data ?? []) {
    const exp = row.expires_on ? new Date(String(row.expires_on)) : null;
    if (exp && !Number.isNaN(exp.getTime()) && exp < today) {
      expired += 1;
      reasons.push(`Expired: ${row.title} (${row.doc_type})`);
    }
  }

  const status = expired > 0 ? "blocked" : "eligible";
  return NextResponse.json({
    contractorId,
    contractorName: (c.data as { name?: string }).name,
    status,
    expiredCount: expired,
    reasons,
    documentCount: (docs.data ?? []).length,
  });
}
