import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_submit_documents",
      "can_manage_observations",
      "can_create_documents",
      "can_view_dashboards",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;
  if (!isCompanyRole(auth.role) && auth.role !== "sales_demo") {
    return NextResponse.json({ error: "Field audits are available to company workspace roles." }, { status: 403 });
  }

  const { id } = await context.params;
  const auditId = String(id ?? "").trim();
  if (!auditId) return NextResponse.json({ error: "Audit id is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const audit = await auth.supabase
    .from("company_jobsite_audits")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("id", auditId)
    .maybeSingle();
  if (audit.error) return NextResponse.json({ error: audit.error.message || "Failed to load audit." }, { status: 500 });
  if (!audit.data) return NextResponse.json({ error: "Audit not found." }, { status: 404 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed((audit.data.jobsite_id as string | null) ?? null, jobsiteScope)) {
    return NextResponse.json({ error: "Audit access denied for this jobsite." }, { status: 403 });
  }

  const observations = await auth.supabase
    .from("company_jobsite_audit_observations")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true });
  if (observations.error) {
    return NextResponse.json({ error: observations.error.message || "Failed to load observations." }, { status: 500 });
  }

  return NextResponse.json({
    audit: audit.data,
    observations: observations.data ?? [],
  });
}
