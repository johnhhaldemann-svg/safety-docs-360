import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";
import { requireMobileFeature } from "@/lib/mobileFeatureGate";
import { forwardMobileJsonRequest } from "@/lib/mobileRouteForward";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_reports",
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
  if (!companyScope.companyId) return NextResponse.json({ reports: [] });
  const featureBlock = await requireMobileFeature({
    auth,
    companyId: companyScope.companyId,
    feature: "mobile_reports",
  });
  if (featureBlock) return featureBlock;
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim().toLowerCase() || "published";
  let query = auth.supabase
    .from("company_reports")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ reports: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load reports." }, { status: 500 });
  }
  return NextResponse.json({ reports: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_reports",
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
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const featureBlock = await requireMobileFeature({
    auth,
    companyId: companyScope.companyId,
    feature: "mobile_reports",
  });
  if (featureBlock) return featureBlock;
  return forwardMobileJsonRequest(request, "/api/company/reports/export", { method: "POST" });
}
