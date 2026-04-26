import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

function canConfigureInductions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager"
  );
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
      "can_create_documents",
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
    return NextResponse.json({ requirements: [] });
  }

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const res = await auth.supabase
    .from("company_induction_requirements")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: true });

  if (res.error) {
    return NextResponse.json({ error: res.error.message || "Failed to load requirements." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const jobsiteId = searchParams.get("jobsiteId")?.trim() ?? "";
  let rows = (res.data ?? []) as Array<{ jobsite_id?: string | null }>;

  if (jobsiteId) {
    if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
      return NextResponse.json({ requirements: [] });
    }
    rows = rows.filter((r) => r.jobsite_id == null || r.jobsite_id === jobsiteId);
  } else if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) {
      return NextResponse.json({ requirements: [] });
    }
    const allowed = new Set(jobsiteScope.jobsiteIds);
    rows = rows.filter((r) => r.jobsite_id == null || allowed.has(String(r.jobsite_id ?? "")));
  }

  return NextResponse.json({ requirements: rows });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canConfigureInductions(auth.role)) {
    return NextResponse.json({ error: "Only admins and managers can add requirements." }, { status: 403 });
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

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const programId = String(body?.programId ?? "").trim();
  if (!programId) {
    return NextResponse.json({ error: "programId is required." }, { status: 400 });
  }

  const jobsiteIdRaw = String(body?.jobsiteId ?? "").trim();
  const jobsiteId = jobsiteIdRaw || null;
  if (jobsiteId && !isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only assign requirements to your jobsites." }, { status: 403 });
  }

  const prog = await auth.supabase
    .from("company_induction_programs")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("id", programId)
    .maybeSingle();
  if (prog.error || !prog.data) {
    return NextResponse.json({ error: "Program not found in this company." }, { status: 404 });
  }

  const effectiveFrom = String(body?.effectiveFrom ?? "").trim() || new Date().toISOString().slice(0, 10);
  const effectiveTo = String(body?.effectiveTo ?? "").trim() || null;

  const ins = await auth.supabase
    .from("company_induction_requirements")
    .insert({
      company_id: companyScope.companyId,
      program_id: programId,
      jobsite_id: jobsiteId,
      active: body?.active === false ? false : true,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to create requirement." }, { status: 500 });
  }

  return NextResponse.json({ requirement: ins.data });
}
