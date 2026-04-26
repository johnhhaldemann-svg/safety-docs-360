import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { parseSafetyFormSchema, validateAnswersAgainstSchema } from "@/lib/safetyForms/schema";

export const runtime = "nodejs";

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
  if (!companyScope.companyId) return NextResponse.json({ submissions: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const url = new URL(request.url);
  const jobsiteId = url.searchParams.get("jobsiteId")?.trim() ?? "";
  if (!jobsiteId) {
    return NextResponse.json({ error: "jobsiteId is required." }, { status: 400 });
  }
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ submissions: [] });
  }

  const res = await auth.supabase
    .from("company_safety_form_submissions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .order("updated_at", { ascending: false });

  if (res.error) {
    return NextResponse.json({ submissions: [], warning: res.error.message });
  }
  return NextResponse.json({ submissions: res.data ?? [] });
}

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const jobsiteId = String(body?.jobsiteId ?? "").trim();
  if (!jobsiteId || !isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "Invalid jobsite." }, { status: 400 });
  }

  let versionId = String(body?.versionId ?? "").trim();
  if (!versionId) {
    const definitionId = String(body?.definitionId ?? "").trim();
    if (!definitionId) {
      return NextResponse.json({ error: "versionId or definitionId is required." }, { status: 400 });
    }
    const latest = await auth.supabase
      .from("company_safety_form_versions")
      .select("id")
      .eq("company_id", companyScope.companyId)
      .eq("definition_id", definitionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error || !latest.data) {
      return NextResponse.json({ error: "No form version for definition." }, { status: 400 });
    }
    versionId = latest.data.id as string;
  }

  const ver = await auth.supabase
    .from("company_safety_form_versions")
    .select("id, schema, company_id")
    .eq("id", versionId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (ver.error || !ver.data) {
    return NextResponse.json({ error: "Invalid version." }, { status: 400 });
  }

  const schema = parseSafetyFormSchema(ver.data.schema);
  if (!schema) {
    return NextResponse.json({ error: "Corrupt form schema." }, { status: 500 });
  }

  const answersRaw = body?.answers;
  const answers =
    answersRaw && typeof answersRaw === "object" && !Array.isArray(answersRaw)
      ? (answersRaw as Record<string, unknown>)
      : {};

  const status = body?.status === "submitted" ? "submitted" : "draft";
  if (status === "submitted") {
    const check = validateAnswersAgainstSchema(schema, answers);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
  }

  const ins = await auth.supabase
    .from("company_safety_form_submissions")
    .insert({
      company_id: companyScope.companyId,
      version_id: versionId,
      jobsite_id: jobsiteId,
      status,
      answers,
      submitted_by: auth.user.id,
    })
    .select("*")
    .single();

  if (ins.error || !ins.data) {
    return NextResponse.json({ error: ins.error?.message || "Insert failed." }, { status: 500 });
  }

  if (status === "submitted") {
    await auth.supabase.from("company_risk_events").insert({
      company_id: companyScope.companyId,
      module_name: "safety_forms",
      record_id: ins.data.id,
      event_type: "safety_form_submitted",
      detail: "Safety form submitted.",
      event_payload: { jobsiteId, versionId },
      created_by: auth.user.id,
    });
  }

  return NextResponse.json({ submission: ins.data });
}
