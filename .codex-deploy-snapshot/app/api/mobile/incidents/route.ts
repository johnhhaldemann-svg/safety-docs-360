import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { requireMobileFeature } from "@/lib/mobileFeatureGate";
import { cloneHeadersForInternalApi } from "@/lib/mobileRouteForward";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

const INCIDENT_CATEGORIES = new Set(["incident", "near_miss"]);

function normalizeIncidentCategory(input: unknown) {
  const value = String(input ?? "").trim().toLowerCase();
  return INCIDENT_CATEGORIES.has(value) ? value : "incident";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ incidents: [] });
  const featureBlock = await requireMobileFeature({
    auth,
    companyId: companyScope.companyId,
    feature: "mobile_incidents",
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
  const status = new URL(request.url).searchParams.get("status")?.trim().toLowerCase();
  let query = auth.supabase
    .from("company_safety_submissions")
    .select(
      "id, company_id, jobsite_id, title, description, severity, category, photo_path, review_status, linked_action_id, created_at, updated_at"
    )
    .eq("company_id", companyScope.companyId)
    .in("category", ["incident", "near_miss"])
    .order("created_at", { ascending: false });
  if (status === "pending" || status === "approved" || status === "rejected") {
    query = query.eq("review_status", status);
  }
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ incidents: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load incident reports." }, { status: 500 });
  }
  return NextResponse.json({ incidents: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
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
    feature: "mobile_incidents",
  });
  if (featureBlock) return featureBlock;
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  const jobsiteId = String(body?.jobsiteId ?? "").trim();
  const category = normalizeIncidentCategory(body?.category);
  if (!title) return NextResponse.json({ error: "Incident title is required." }, { status: 400 });
  if (!jobsiteId) return NextResponse.json({ error: "Choose a jobsite before submitting an incident report." }, { status: 400 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only submit incident reports for assigned jobsites." }, { status: 403 });
  }

  const url = new URL("/api/company/safety-submissions", request.url);
  const response = await fetch(url, {
    method: "POST",
    headers: cloneHeadersForInternalApi(request),
    body: JSON.stringify({
      ...body,
      title,
      jobsiteId,
      category,
      description: String(body?.description ?? "").trim(),
    }),
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    return NextResponse.json(
      { error: typeof payload?.error === "string" ? payload.error : "Failed to submit incident report." },
      { status: response.status }
    );
  }
  return NextResponse.json({
    ...payload,
    message: "Incident report submitted. A manager or safety admin must review it.",
  });
}
