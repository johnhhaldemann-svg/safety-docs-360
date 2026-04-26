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

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ chemicals: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const jobsiteId = new URL(request.url).searchParams.get("jobsiteId")?.trim() ?? "";
  if (!jobsiteId) {
    return NextResponse.json({ error: "jobsiteId is required." }, { status: 400 });
  }
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ chemicals: [] });
  }

  const res = await auth.supabase
    .from("company_jobsite_chemicals")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .order("chemical_name", { ascending: true });

  if (res.error) {
    return NextResponse.json({ chemicals: [], warning: res.error.message });
  }
  return NextResponse.json({ chemicals: res.data ?? [] });
}

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const jobsiteId = String(body?.jobsiteId ?? "").trim();
  const chemicalName = String(body?.chemicalName ?? "").trim();
  if (!jobsiteId || !isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "Invalid jobsite." }, { status: 400 });
  }
  if (!chemicalName) return NextResponse.json({ error: "chemicalName is required." }, { status: 400 });

  const ins = await auth.supabase
    .from("company_jobsite_chemicals")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      chemical_name: chemicalName,
      manufacturer: String(body?.manufacturer ?? "").trim() || null,
      sds_file_path: String(body?.sdsFilePath ?? "").trim() || null,
      sds_effective_date: String(body?.sdsEffectiveDate ?? "").trim() || null,
      next_review_date: String(body?.nextReviewDate ?? "").trim() || null,
      quantity_note: String(body?.quantityNote ?? "").trim() || null,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to add chemical." }, { status: 500 });
  }

  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "sds",
    record_id: ins.data.id,
    event_type: "chemical_registered",
    detail: "Chemical / SDS row created.",
    event_payload: { jobsiteId, chemicalName },
    created_by: auth.user.id,
  });

  return NextResponse.json({ chemical: ins.data });
}
