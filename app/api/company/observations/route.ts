import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { canManageObservations } from "@/lib/companyPermissions";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

const VALID_STATUSES = new Set([
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "escalated",
  "stop_work",
]);

function normalizeStatus(input: unknown, fallback = "open") {
  const value = String(input ?? "").trim().toLowerCase();
  return VALID_STATUSES.has(value) ? value : fallback;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_dashboards",
      "can_view_analytics",
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
  if (!companyScope.companyId) return NextResponse.json({ observations: [] });
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim().toLowerCase();
  let query = auth.supabase
    .from("company_corrective_actions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ observations: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }
  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load observations." }, { status: 500 });
  }
  return NextResponse.json({ observations: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageObservations(auth.role)) {
    return NextResponse.json({ error: "You do not have permission to create observations." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company scope found." }, { status: 400 });
  }
  const csepBlockPost = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlockPost) return csepBlockPost;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });
  const jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "Jobsite access denied for this observation." }, { status: 403 });
  }

  const result = await auth.supabase
    .from("company_corrective_actions")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      title,
      description: String(body?.description ?? "").trim() || null,
      status: normalizeStatus(body?.status, "open"),
      severity: String(body?.severity ?? "").trim().toLowerCase() || "medium",
      category: String(body?.category ?? "").trim().toLowerCase() || "hazard",
      due_at: String(body?.dueAt ?? "").trim() || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
      observation_type: String(body?.observationType ?? "").trim().toLowerCase() || "negative",
      sif_potential: typeof body?.sifPotential === "boolean" ? body.sifPotential : false,
      sif_category: String(body?.sifCategory ?? "").trim() || null,
      dap_activity_id: String(body?.dapActivityId ?? "").trim() || null,
    })
    .select("*")
    .single();
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to create observation." }, { status: 500 });
  }
  return NextResponse.json({ success: true, observation: result.data });
}
