import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest } from "@/lib/rbac";
import {
  buildJobsiteDailyTodos,
  getDailyTodoWorkDate,
  type JobsiteDailyTodoStatus,
} from "@/lib/jobsiteDailyTodos";
import { evaluateEmergencyActionPlanReadiness } from "@/lib/jobsiteEmergencyActionPlan";

export const runtime = "nodejs";

type Params = { jobsiteId: string };

const DAILY_TODO_SELECT =
  "id, company_id, jobsite_id, work_date, source_key, role, title, detail, priority, status, target_tab, target_href, generated_at, reviewed_at, completed_at, closed_at, updated_at";

const TODO_STATUSES = new Set(["open", "reviewed", "completed", "closed_out"]);

function isMissingDailyTodoTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_jobsite_daily_todos");
}

function normalizeStatus(value: unknown): JobsiteDailyTodoStatus | null {
  const status = String(value ?? "").trim();
  return TODO_STATUSES.has(status) ? (status as JobsiteDailyTodoStatus) : null;
}

async function resolveScopedJobsite(request: Request, params: Promise<Params>) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_jobsites",
      "can_view_dashboards",
      "can_view_all_company_data",
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return { authError: auth.error } as const;

  const { jobsiteId } = await params;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return { authError: NextResponse.json({ error: "No company scope found for user." }, { status: 400 }) } as const;
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return { authError: NextResponse.json({ error: "You do not have access to this jobsite." }, { status: 403 }) } as const;
  }

  const jobsiteResult = await auth.supabase
    .from("company_jobsites")
    .select("id, company_id, name, status")
    .eq("id", jobsiteId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (jobsiteResult.error) {
    return {
      authError: NextResponse.json(
        { error: jobsiteResult.error.message || "Failed to load jobsite." },
        { status: 500 }
      ),
    } as const;
  }
  if (!jobsiteResult.data) {
    return { authError: NextResponse.json({ error: "Jobsite not found." }, { status: 404 }) } as const;
  }

  return { auth, companyId: companyScope.companyId, jobsite: jobsiteResult.data as { id: string; name?: string | null; status?: string | null } } as const;
}

function normalizeTodoRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    sourceKey: String(row.source_key ?? ""),
    role: String(row.role ?? "pm"),
    title: String(row.title ?? ""),
    detail: String(row.detail ?? ""),
    status: String(row.status ?? "open"),
    priority: String(row.priority ?? "medium"),
    targetTab: String(row.target_tab ?? "Overview"),
    targetHref: typeof row.target_href === "string" ? row.target_href : undefined,
  };
}

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const scoped = await resolveScopedJobsite(request, params);
  if ("authError" in scoped) return scoped.authError;

  const url = new URL(request.url);
  const workDate = url.searchParams.get("workDate")?.trim() || getDailyTodoWorkDate();

  const todosResult = await scoped.auth.supabase
    .from("company_jobsite_daily_todos")
    .select(DAILY_TODO_SELECT)
    .eq("company_id", scoped.companyId)
    .eq("jobsite_id", scoped.jobsite.id)
    .eq("work_date", workDate)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (todosResult.error) {
    if (isMissingDailyTodoTable(todosResult.error.message)) {
      return NextResponse.json({
        todos: [],
        workDate,
        warning: "Daily todo table is not available yet. Run the latest Supabase migration.",
      });
    }
    return NextResponse.json(
      { error: todosResult.error.message || "Failed to load daily todos." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    workDate,
    todos: ((todosResult.data ?? []) as Array<Record<string, unknown>>).map(normalizeTodoRow),
  });
}

export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const scoped = await resolveScopedJobsite(request, params);
  if ("authError" in scoped) return scoped.authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const workDate = typeof body?.workDate === "string" && body.workDate.trim() ? body.workDate.trim() : getDailyTodoWorkDate();
  const signals = (body?.signals && typeof body.signals === "object" ? body.signals : {}) as Record<string, unknown>;
  const emergencyProfileResult = await scoped.auth.supabase
    .from("company_jobsite_emergency_profiles")
    .select("id, company_id, jobsite_id, emergency_contact_name, emergency_contact_phone, responder_access_instructions, responder_site_address, assembly_area, secondary_assembly_area, command_post_location, evacuation_shelter_notes, weather_shelter_location, lightning_plan, tornado_plan, aed_location, first_aid_location, fire_extinguisher_locations, spill_kit_locations, rescue_equipment_locations, nearest_medical_name, nearest_medical_address, nearest_medical_phone, nearest_medical_route, media_contact_name, media_contact_phone, media_statement_instructions, regulatory_contact_name, regulatory_contact_phone, regulatory_reporting_instructions, call_chain, utility_contacts, after_hours_contacts, backup_contacts, incident_notification_timeline, post_incident_requirements, notes, revision_date, last_reviewed_at, last_reviewed_by")
    .eq("company_id", scoped.companyId)
    .eq("jobsite_id", scoped.jobsite.id)
    .is("archived_at", null)
    .maybeSingle();
  const emergencyReadiness = evaluateEmergencyActionPlanReadiness({
    profile: emergencyProfileResult.error ? null : emergencyProfileResult.data,
    jobsiteStatus: scoped.jobsite.status,
  });
  const todos = buildJobsiteDailyTodos({
    jobsiteId: scoped.jobsite.id,
    jobsiteName: scoped.jobsite.name ?? "Jobsite",
    workDate,
    riskLevel: String(signals.riskLevel ?? "medium") as "low" | "medium" | "high" | "critical",
    emergencyActionPlanReadiness:
      String(signals.emergencyActionPlanReadiness ?? emergencyReadiness.readiness) as "complete" | "needs_review" | "missing_critical_info",
    emergencyActionPlanMissingCount:
      Number(signals.emergencyActionPlanMissingCount ?? emergencyReadiness.missingFields.length) || 0,
    topJobsiteRiskLevel:
      String(signals.topJobsiteRiskLevel ?? "") === "critical" ||
      String(signals.topJobsiteRiskLevel ?? "") === "high" ||
      String(signals.topJobsiteRiskLevel ?? "") === "medium" ||
      String(signals.topJobsiteRiskLevel ?? "") === "low"
        ? (String(signals.topJobsiteRiskLevel) as "low" | "medium" | "high" | "critical")
        : null,
    topJobsiteRiskTitle: typeof signals.topJobsiteRiskTitle === "string" ? signals.topJobsiteRiskTitle : null,
    topJobsiteRiskEvidenceCount: Number(signals.topJobsiteRiskEvidenceCount ?? 0) || 0,
    firstScheduleRiskTitle: typeof signals.firstScheduleRiskTitle === "string" ? signals.firstScheduleRiskTitle : null,
    highRiskScheduleCount: Number(signals.highRiskScheduleCount ?? 0) || 0,
    openActionsCount: Number(signals.openActionsCount ?? 0) || 0,
    overdueActionsCount: Number(signals.overdueActionsCount ?? 0) || 0,
    permitBlockerCount: Number(signals.permitBlockerCount ?? 0) || 0,
    inspectionGapCount: Number(signals.inspectionGapCount ?? 0) || 0,
    readyReportCount: Number(signals.readyReportCount ?? 0) || 0,
    workforceGapCount: Number(signals.workforceGapCount ?? 0) || 0,
  });

  const rows = todos.map((todo) => ({
    company_id: scoped.companyId,
    jobsite_id: scoped.jobsite.id,
    work_date: workDate,
    source_key: todo.sourceKey,
    role: todo.role,
    title: todo.title,
    detail: todo.detail,
    priority: todo.priority,
    status: todo.status,
    target_tab: todo.targetTab,
    target_href: todo.targetHref ?? null,
    generated_at: new Date().toISOString(),
  }));

  const upsertResult = await scoped.auth.supabase
    .from("company_jobsite_daily_todos")
    .upsert(rows, { onConflict: "company_id,jobsite_id,work_date,source_key", ignoreDuplicates: true })
    .select(DAILY_TODO_SELECT);

  if (upsertResult.error) {
    if (isMissingDailyTodoTable(upsertResult.error.message)) {
      return NextResponse.json(
        { error: "Daily todo table is not available yet. Run the latest Supabase migration." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: upsertResult.error.message || "Failed to create daily todos." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    workDate,
    todos: ((upsertResult.data ?? []) as Array<Record<string, unknown>>).map(normalizeTodoRow),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const scoped = await resolveScopedJobsite(request, params);
  if ("authError" in scoped) return scoped.authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const todoId = typeof body?.todoId === "string" ? body.todoId.trim() : "";
  const status = normalizeStatus(body?.status);
  if (!todoId || !status) {
    return NextResponse.json({ error: "Todo id and status are required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const statusColumns =
    status === "reviewed"
      ? { reviewed_at: now, reviewed_by: scoped.auth.user.id }
      : status === "completed"
        ? { completed_at: now, completed_by: scoped.auth.user.id }
        : status === "closed_out"
          ? { closed_at: now, closed_by: scoped.auth.user.id }
          : {};

  const updateResult = await scoped.auth.supabase
    .from("company_jobsite_daily_todos")
    .update({
      status,
      ...statusColumns,
    })
    .eq("id", todoId)
    .eq("company_id", scoped.companyId)
    .eq("jobsite_id", scoped.jobsite.id)
    .select(DAILY_TODO_SELECT)
    .maybeSingle();

  if (updateResult.error) {
    if (isMissingDailyTodoTable(updateResult.error.message)) {
      return NextResponse.json(
        { error: "Daily todo table is not available yet. Run the latest Supabase migration." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: updateResult.error.message || "Failed to update daily todo." },
      { status: 500 }
    );
  }
  if (!updateResult.data) return NextResponse.json({ error: "Todo not found." }, { status: 404 });

  return NextResponse.json({ success: true, todo: normalizeTodoRow(updateResult.data as Record<string, unknown>) });
}
