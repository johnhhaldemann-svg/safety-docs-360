import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
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

  const { id: contractorId } = await params;
  const c = await auth.supabase
    .from("company_contractors")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("id", contractorId)
    .maybeSingle();
  if (c.error || !c.data) {
    return NextResponse.json({ error: "Contractor not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const score = Number(body?.score ?? 0);
  const blockingFlags = Array.isArray(body?.blockingFlags) ? body!.blockingFlags : [];
  const notes = String(body?.notes ?? "").trim() || null;

  const ins = await auth.supabase
    .from("company_contractor_evaluations")
    .insert({
      company_id: companyScope.companyId,
      contractor_id: contractorId,
      score: Number.isFinite(score) ? score : 0,
      blocking_flags: blockingFlags,
      evaluator_id: auth.user.id,
      notes,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to save evaluation." }, { status: 500 });
  }

  return NextResponse.json({ evaluation: ins.data });
}
