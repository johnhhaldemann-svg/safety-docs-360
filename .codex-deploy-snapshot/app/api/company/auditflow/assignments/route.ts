import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import { canManageAuditFlow } from "@/lib/auditflow/schema";

export const runtime = "nodejs";

type AssignmentBody = {
  templateId?: string;
  templateVersionId?: string;
  assignedUserId?: string | null;
  jobsiteId?: string | null;
  scheduledDate?: string | null;
  dueAt?: string | null;
};

function cleanText(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function validDate(value: unknown) {
  const text = cleanText(value, 20);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "invalid";
}

function validDateTime(value: unknown) {
  const text = cleanText(value, 80);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_field_audits",
      "can_view_dashboards",
      "can_submit_documents",
      "can_view_all_company_data",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ assignments: [], submissions: [] });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const { searchParams } = new URL(request.url);
  const mineOnly = searchParams.get("mine") === "true";
  const status = searchParams.get("status")?.trim();
  const jobsiteId = searchParams.get("jobsiteId")?.trim();
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  let query = auth.supabase
    .from("company_auditflow_assignments")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (mineOnly && !canManageAuditFlow(auth.role)) query = query.eq("assigned_user_id", auth.user.id);
  if (status) query = query.eq("status", status);
  if (jobsiteId) {
    if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) return NextResponse.json({ assignments: [], submissions: [] });
    query = query.eq("jobsite_id", jobsiteId);
  } else if (jobsiteScope.restricted) {
    if (jobsiteScope.jobsiteIds.length < 1) return NextResponse.json({ assignments: [], submissions: [] });
    query = query.in("jobsite_id", jobsiteScope.jobsiteIds);
  }

  const assignments = await query;
  if (assignments.error) {
    return NextResponse.json({ error: assignments.error.message || "Failed to load AuditFlow assignments." }, { status: 500 });
  }

  const assignmentRows = (assignments.data as Array<Record<string, unknown>> | null) ?? [];
  const assignmentIds = assignmentRows.map((row) => String(row.id ?? "")).filter(Boolean);
  let submissions: unknown[] = [];
  if (assignmentIds.length > 0) {
    const submissionResult = await auth.supabase
      .from("company_auditflow_submissions")
      .select("*")
      .eq("company_id", companyScope.companyId)
      .in("assignment_id", assignmentIds)
      .order("submitted_at", { ascending: false });
    if (!submissionResult.error) submissions = submissionResult.data ?? [];
  }

  return NextResponse.json({
    assignments: assignmentRows,
    submissions,
    canManage: canManageAuditFlow(auth.role),
    scopeCompanyId: companyScope.companyId,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageAuditFlow(auth.role)) {
    return NextResponse.json({ error: "Only company managers can assign AuditFlow audits." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) return NextResponse.json({ error: "No company workspace." }, { status: 400 });

  const block = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (block) return block;

  const body = (await request.json().catch(() => null)) as AssignmentBody | null;
  const templateId = cleanText(body?.templateId, 80);
  let templateVersionId = cleanText(body?.templateVersionId, 80);
  const assignedUserId = cleanText(body?.assignedUserId, 80) || null;
  const jobsiteId = cleanText(body?.jobsiteId, 80) || null;
  const scheduledDate = validDate(body?.scheduledDate);
  const dueAt = validDateTime(body?.dueAt);

  if (!templateId) return NextResponse.json({ error: "templateId is required." }, { status: 400 });
  if (scheduledDate === "invalid") return NextResponse.json({ error: "scheduledDate must be YYYY-MM-DD." }, { status: 400 });
  if (dueAt === "invalid") return NextResponse.json({ error: "dueAt is invalid." }, { status: 400 });

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only assign audits for accessible jobsites." }, { status: 403 });
  }

  const template = await auth.supabase
    .from("company_auditflow_templates")
    .select("id, current_version_id, active")
    .eq("company_id", companyScope.companyId)
    .eq("id", templateId)
    .maybeSingle();
  if (template.error) return NextResponse.json({ error: template.error.message || "Failed to load template." }, { status: 500 });
  if (!template.data || template.data.active === false) {
    return NextResponse.json({ error: "Select an active AuditFlow template." }, { status: 400 });
  }
  templateVersionId = templateVersionId || String(template.data.current_version_id ?? "");
  if (!templateVersionId) return NextResponse.json({ error: "Template has no current version." }, { status: 400 });

  const version = await auth.supabase
    .from("company_auditflow_template_versions")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .eq("template_id", templateId)
    .eq("id", templateVersionId)
    .maybeSingle();
  if (version.error) return NextResponse.json({ error: version.error.message || "Failed to load template version." }, { status: 500 });
  if (!version.data) return NextResponse.json({ error: "Template version not found." }, { status: 400 });

  const insert = await auth.supabase
    .from("company_auditflow_assignments")
    .insert({
      company_id: companyScope.companyId,
      template_id: templateId,
      template_version_id: templateVersionId,
      jobsite_id: jobsiteId,
      assigned_user_id: assignedUserId,
      scheduled_date: scheduledDate,
      due_at: dueAt,
      status: "assigned",
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("*")
    .single();

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message || "Failed to create AuditFlow assignment." }, { status: 500 });
  }

  return NextResponse.json({ success: true, assignment: insert.data });
}
