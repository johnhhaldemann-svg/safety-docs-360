import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { parseSafetyFormSchema, validateAnswersAgainstSchema } from "@/lib/safetyForms/schema";

export const runtime = "nodejs";

function canApprove(role: string) {
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
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const existing = await auth.supabase
    .from("company_safety_form_submissions")
    .select("id, jobsite_id, status, version_id")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const row = existing.data as { jobsite_id: string | null; status: string; version_id: string };
  if (!row.jobsite_id || !isJobsiteAllowed(row.jobsite_id, jobsiteScope)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ver = await auth.supabase
    .from("company_safety_form_versions")
    .select("schema")
    .eq("id", row.version_id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  const schema = parseSafetyFormSchema(ver.data?.schema);
  if (!schema) {
    return NextResponse.json({ error: "Corrupt form schema." }, { status: 500 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.answers === "object" && body.answers !== null && !Array.isArray(body.answers)) {
    patch.answers = body.answers;
  }

  let nextStatus = row.status;
  if (body.status === "draft" || body.status === "submitted" || body.status === "approved") {
    nextStatus = body.status;
  }

  if (nextStatus === "approved" && !canApprove(auth.role)) {
    return NextResponse.json({ error: "Your role cannot approve submissions." }, { status: 403 });
  }

  if (nextStatus === "submitted" || nextStatus === "approved") {
    const answersPatch = patch.answers as Record<string, unknown> | undefined;
    let merged: unknown = answersPatch;
    if (merged === undefined) {
      const cur = await auth.supabase
        .from("company_safety_form_submissions")
        .select("answers")
        .eq("id", id)
        .maybeSingle();
      merged = cur.data?.answers;
    }
    if (typeof merged !== "object" || merged === null || Array.isArray(merged)) {
      return NextResponse.json({ error: "Invalid answers." }, { status: 400 });
    }
    const check = validateAnswersAgainstSchema(schema, merged as Record<string, unknown>);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
  }

  patch.status = nextStatus;

  const res = await auth.supabase
    .from("company_safety_form_submissions")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select("*")
    .maybeSingle();

  if (res.error || !res.data) {
    return NextResponse.json({ error: res.error?.message || "Update failed." }, { status: 500 });
  }

  if (nextStatus === "submitted" && row.status !== "submitted") {
    await auth.supabase.from("company_risk_events").insert({
      company_id: companyScope.companyId,
      module_name: "safety_forms",
      record_id: id,
      event_type: "safety_form_submitted",
      detail: "Safety form submitted.",
      event_payload: { submissionId: id },
      created_by: auth.user.id,
    });
  }

  return NextResponse.json({ submission: res.data });
}
