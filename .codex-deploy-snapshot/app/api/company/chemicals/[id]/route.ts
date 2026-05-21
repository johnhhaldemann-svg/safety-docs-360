import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

function canManage(role: string) {
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

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { id } = await params;
  const existing = await auth.supabase
    .from("company_jobsite_chemicals")
    .select("id, jobsite_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const jsId = (existing.data as { jobsite_id: string }).jobsite_id;
  if (!isJobsiteAllowed(jsId, jobsiteScope)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.chemicalName === "string") patch.chemical_name = body.chemicalName.trim();
  if (typeof body.manufacturer === "string") patch.manufacturer = body.manufacturer.trim() || null;
  if (typeof body.sdsFilePath === "string") patch.sds_file_path = body.sdsFilePath.trim() || null;
  if (typeof body.sdsEffectiveDate === "string") patch.sds_effective_date = body.sdsEffectiveDate.trim() || null;
  if (typeof body.nextReviewDate === "string") patch.next_review_date = body.nextReviewDate.trim() || null;
  if (typeof body.quantityNote === "string") patch.quantity_note = body.quantityNote.trim() || null;

  const res = await auth.supabase
    .from("company_jobsite_chemicals")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .maybeSingle();

  if (res.error || !res.data) {
    return NextResponse.json({ error: res.error?.message || "Update failed." }, { status: 500 });
  }
  return NextResponse.json({ chemical: res.data });
}
