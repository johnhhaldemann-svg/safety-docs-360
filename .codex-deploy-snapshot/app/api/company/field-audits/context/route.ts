import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { demoCompanyJobsiteRows } from "@/lib/demoWorkspace";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { authorizeRequest, isAdminRole, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const JOBSITE_SELECT =
  "id, company_id, name, project_number, location, status, customer_company_name, customer_report_email, audit_customer_id";

function canSelectAnyCompany(role: string, permissionMap: { can_view_all_company_data?: boolean }) {
  return isAdminRole(role) || Boolean(permissionMap.can_view_all_company_data);
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_submit_documents",
      "can_manage_observations",
      "can_create_documents",
      "can_view_dashboards",
      "can_view_all_company_data",
      "can_view_analytics",
    ],
  });
  if ("error" in auth) return auth.error;

  const canUseCompanyPicker = canSelectAnyCompany(auth.role, auth.permissionMap);
  if (!isCompanyRole(auth.role) && auth.role !== "sales_demo" && !canUseCompanyPicker) {
    return NextResponse.json(
      { error: "Field audits are available to company workspace roles." },
      { status: 403 }
    );
  }

  if (auth.role === "sales_demo") {
    return NextResponse.json({
      companies: [{ id: "demo-company", name: "Summit Ridge Constructors", status: "active" }],
      jobsites: demoCompanyJobsiteRows.filter((jobsite) => jobsite.status === "active"),
    });
  }

  const { searchParams } = new URL(request.url);
  const requestedCompanyId = searchParams.get("companyId")?.trim() || "";
  const readSupabase = canUseCompanyPicker ? createSupabaseAdminClient() ?? auth.supabase : auth.supabase;

  if (canUseCompanyPicker) {
    const [companiesResult, jobsitesResult] = await Promise.all([
      readSupabase
        .from("companies")
        .select("id, name, status, primary_contact_email")
        .neq("status", "archived")
        .order("name"),
      requestedCompanyId
        ? readSupabase
            .from("company_jobsites")
            .select(JOBSITE_SELECT)
            .eq("company_id", requestedCompanyId)
            .eq("status", "active")
            .order("name")
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (companiesResult.error) {
      return NextResponse.json(
        { error: companiesResult.error.message || "Failed to load companies." },
        { status: 500 }
      );
    }
    if (jobsitesResult.error) {
      return NextResponse.json(
        { error: jobsitesResult.error.message || "Failed to load active jobsites." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      companies: (companiesResult.data ?? []).map((company) => ({
        id: company.id,
        name: company.name?.trim() || "Unnamed Company",
        status: company.status ?? "approved",
        report_email: company.primary_contact_email ?? null,
      })),
      jobsites: jobsitesResult.data ?? [],
    });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ companies: [], jobsites: [] });
  }

  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const jobsitesResult = await auth.supabase
    .from("company_jobsites")
    .select(JOBSITE_SELECT)
    .eq("company_id", companyScope.companyId)
    .eq("status", "active")
    .order("name");

  if (jobsitesResult.error) {
    return NextResponse.json(
      { error: jobsitesResult.error.message || "Failed to load active jobsites." },
      { status: 500 }
    );
  }

  const allJobsites = jobsitesResult.data ?? [];
  const jobsites =
    jobsiteScope.restricted && jobsiteScope.jobsiteIds.length > 0
      ? allJobsites.filter((jobsite) => jobsiteScope.jobsiteIds.includes(jobsite.id))
      : jobsiteScope.restricted
        ? []
        : allJobsites;

  return NextResponse.json({
    companies: [
      {
        id: companyScope.companyId,
        name: companyScope.companyName || "Company workspace",
        status: "active",
      },
    ],
    jobsites,
  });
}
