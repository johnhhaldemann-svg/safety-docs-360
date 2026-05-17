import { NextResponse } from "next/server";
import { GET as GET_COMPANY_PERMITS } from "@/app/api/company/permits/route";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { requireMobileFeature } from "@/lib/mobileFeatureGate";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function canSubmitMobilePermit(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "field_supervisor" ||
    role === "foreman"
  );
}

function normalizeSeverity(input: unknown) {
  const value = String(input ?? "").trim().toLowerCase();
  return SEVERITIES.has(value) ? value : "medium";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_submit_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canSubmitMobilePermit(auth.role)) {
    return NextResponse.json({ error: "Your role cannot submit permit requests." }, { status: 403 });
  }

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
    feature: "mobile_permits",
  });
  if (featureBlock) return featureBlock;
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim();
  const permitType = String(body?.permitType ?? "").trim();
  const jobsiteId = String(body?.jobsiteId ?? "").trim();
  if (!title) return NextResponse.json({ error: "Permit title is required." }, { status: 400 });
  if (!permitType) return NextResponse.json({ error: "Permit type is required." }, { status: 400 });
  if (!jobsiteId) return NextResponse.json({ error: "Choose a jobsite before submitting a permit request." }, { status: 400 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only submit permit requests for assigned jobsites." }, { status: 403 });
  }

  const jobsiteResult = await auth.supabase
    .from("company_jobsites")
    .select("id, status")
    .eq("company_id", companyScope.companyId)
    .eq("id", jobsiteId)
    .maybeSingle();
  if (jobsiteResult.error) {
    return NextResponse.json({ error: jobsiteResult.error.message || "Failed to verify jobsite." }, { status: 500 });
  }
  if (!jobsiteResult.data) return NextResponse.json({ error: "Selected jobsite was not found." }, { status: 404 });
  const jobsiteStatus = String(jobsiteResult.data.status ?? "").trim().toLowerCase();
  if (["archived", "closed", "completed", "inactive"].includes(jobsiteStatus)) {
    return NextResponse.json({ error: "Permit requests can only be created for active jobsites." }, { status: 400 });
  }

  const result = await auth.supabase
    .from("company_permits")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      permit_type: permitType,
      title,
      status: "draft",
      severity: normalizeSeverity(body?.severity),
      category: String(body?.category ?? "").trim().toLowerCase() || "corrective_action",
      owner_user_id: null,
      due_at: String(body?.dueAt ?? "").trim() || null,
      sif_flag: Boolean(body?.sifFlag),
      escalation_level: "none",
      escalation_reason: null,
      stop_work_status: "normal",
      stop_work_reason: null,
      observation_id: String(body?.observationId ?? "").trim() || null,
      dap_activity_id: String(body?.jsaActivityId ?? body?.dapActivityId ?? "").trim() || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to submit permit request." }, { status: 500 });
  }

  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "permits",
    record_id: result.data.id,
    event_type: "mobile_permit_request_submitted",
    detail: "Mobile permit request submitted for manager review.",
    event_payload: { status: "draft", permitType },
    created_by: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    permit: result.data,
    message: "Permit request submitted. A manager or safety admin must activate it.",
  });
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_create_documents",
      "can_view_all_company_data",
      "can_view_analytics",
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
  if (!companyScope.companyId) return NextResponse.json({ permits: [] });
  const featureBlock = await requireMobileFeature({
    auth,
    companyId: companyScope.companyId,
    feature: "mobile_permits",
  });
  if (featureBlock) return featureBlock;
  return GET_COMPANY_PERMITS(request);
}
