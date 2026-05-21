import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { parseSafetyFormSchema, validateAnswersAgainstSchema } from "@/lib/safetyForms/schema";

export const runtime = "nodejs";

const DEMO_FORM_SUBMISSIONS = [
  {
    id: "demo-form-sub-1",
    company_id: "demo-company",
    version_id: "demo-form-ver-1",
    jobsite_id: "demo-jobsite-1",
    status: "submitted",
    answers: {
      crew_brief_complete: true,
      work_area_inspected: true,
      notes: "Morning steel deck briefing complete. Barricades reset before first pick.",
    },
    submitted_by: "demo-user-2",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-form-sub-2",
    company_id: "demo-company",
    version_id: "demo-form-ver-2",
    jobsite_id: "demo-jobsite-2",
    status: "draft",
    answers: {
      permit_verified: true,
      fire_watch_assigned: false,
      fuel_sources_removed: true,
    },
    submitted_by: "demo-user-3",
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const jobsiteId = url.searchParams.get("jobsiteId")?.trim() ?? "";
  if (auth.role === "sales_demo") {
    if (!jobsiteId) {
      return NextResponse.json({ error: "jobsiteId is required." }, { status: 400 });
    }
    return NextResponse.json({
      submissions: DEMO_FORM_SUBMISSIONS.filter((submission) => submission.jobsite_id === jobsiteId),
    });
  }

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
  if (auth.role === "sales_demo") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const jobsiteId = String(body?.jobsiteId ?? "").trim();
    const versionId = String(body?.versionId ?? "").trim() || "demo-form-ver-1";
    if (!jobsiteId) {
      return NextResponse.json({ error: "Invalid jobsite." }, { status: 400 });
    }
    return NextResponse.json({
      submission: {
        id: `demo-form-sub-${Date.now()}`,
        company_id: "demo-company",
        version_id: versionId,
        jobsite_id: jobsiteId,
        status: body?.status === "submitted" ? "submitted" : "draft",
        answers:
          body?.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
            ? body.answers
            : {},
        submitted_by: "demo-user-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
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
