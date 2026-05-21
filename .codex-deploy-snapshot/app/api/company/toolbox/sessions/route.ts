import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";

export const runtime = "nodejs";

function canRunToolbox(role: string) {
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

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_dashboards",
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
  if (!companyScope.companyId) return NextResponse.json({ sessions: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  const jobsiteId = new URL(request.url).searchParams.get("jobsiteId")?.trim() ?? "";
  if (!jobsiteId) {
    return NextResponse.json({ error: "jobsiteId is required." }, { status: 400 });
  }
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ sessions: [] });
  }

  const res = await auth.supabase
    .from("company_toolbox_sessions")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .order("conducted_at", { ascending: false });

  if (res.error) {
    return NextResponse.json({ error: res.error.message || "Failed to load sessions." }, { status: 500 });
  }
  return NextResponse.json({ sessions: res.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canRunToolbox(auth.role)) {
    return NextResponse.json({ error: "Your role cannot create toolbox sessions." }, { status: 403 });
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
    return NextResponse.json({ error: "Valid jobsiteId is required." }, { status: 400 });
  }

  const templateId = String(body?.templateId ?? "").trim() || null;
  const notes = String(body?.notes ?? "").trim() || null;
  const linkedCorrectiveActionId = String(body?.linkedCorrectiveActionId ?? "").trim() || null;

  const ins = await auth.supabase
    .from("company_toolbox_sessions")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      template_id: templateId,
      conducted_by: auth.user.id,
      notes,
      status: "draft",
      linked_corrective_action_id: linkedCorrectiveActionId,
    })
    .select("*")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message || "Failed to create session." }, { status: 500 });
  }

  return NextResponse.json({ session: ins.data });
}
