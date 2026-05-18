import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { demoCompanyJobsiteRows } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

type SchedulePayload = {
  itemId?: string;
  title?: string;
  workStartDate?: string;
  workEndDate?: string | null;
  trade?: string | null;
  workArea?: string | null;
  crewOrContractor?: string | null;
  status?: string;
  notes?: string | null;
  archived?: boolean;
};

const SCHEDULE_STATUSES = new Set(["planned", "active", "blocked", "completed", "archived"]);

const SCHEDULE_SELECT =
  "id, company_id, jobsite_id, title, work_start_date, work_end_date, trade, work_area, crew_or_contractor, status, notes, created_at, updated_at, archived_at";

const MICROSOFT_TASK_SELECT =
  "id, project_source_id, source_task_id, title, notes, status, percent_complete, priority, bucket_name, start_at, due_at, completed_at, updated_at";

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDateOnly(value?: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function normalizeStatus(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  return SCHEDULE_STATUSES.has(normalized) ? normalized : "planned";
}

function cleanNullable(value?: string | null) {
  const clean = (value ?? "").trim();
  return clean || null;
}

function canManageSchedule(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager"
  );
}

function isMissingScheduleSchema(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_jobsite_schedule_items") ||
    normalized.includes("company_microsoft_project_tasks") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find")
  );
}

function dateInWindow(value: string | null | undefined, start: string, end: string) {
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= start && date <= end;
}

function manualItemOverlapsWindow(
  item: { work_start_date?: string | null; work_end_date?: string | null },
  start: string,
  end: string
) {
  const itemStart = item.work_start_date ?? "";
  const itemEnd = item.work_end_date ?? itemStart;
  return itemStart <= end && itemEnd >= start;
}

async function resolveCompanyScope(auth: {
  supabase: Parameters<typeof getCompanyScope>[0]["supabase"];
  user: { id: string };
  team?: string | null;
}) {
  return getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
}

async function resolveJobsite(params: {
  supabase: ReturnType<typeof authorizeRequest> extends Promise<infer T>
    ? T extends { supabase: infer S }
      ? S
      : never
    : never;
  companyId: string;
  jobsiteId: string;
}) {
  return params.supabase
    .from("company_jobsites")
    .select("id, company_id, name, jobsite_number, project_number, status")
    .eq("company_id", params.companyId)
    .eq("id", params.jobsiteId)
    .maybeSingle();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const { jobsiteId } = await params;
  if (auth.role === "sales_demo") {
    const jobsite = demoCompanyJobsiteRows.find((row) => row.id === jobsiteId) ?? demoCompanyJobsiteRows[0];
    const today = todayDateOnly();
    return NextResponse.json({
      jobsite,
      window: { startDate: today, endDate: addDays(today, 30), days: 30 },
      items: [
        {
          id: "demo-schedule-1",
          source: "manual",
          title: "Steel decking release and follow-on cleanup",
          status: "active",
          workStartDate: addDays(today, 2),
          workEndDate: addDays(today, 4),
          trade: "Ironworkers",
          workArea: "North Tower - Level 5",
          crewOrContractor: "Lone Star Steel",
          notes: "Confirm deck openings and controlled access before turnover.",
          readOnly: false,
        },
        {
          id: "demo-ms-task-1",
          source: "microsoft_project",
          title: "Hot work prep and fire watch coverage",
          status: "not_started",
          workStartDate: addDays(today, 5),
          workEndDate: addDays(today, 5),
          trade: null,
          workArea: null,
          crewOrContractor: null,
          notes: "Imported from Microsoft Project.",
          readOnly: true,
        },
      ],
    });
  }

  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const jobsiteResult = await resolveJobsite({
    supabase: auth.supabase,
    companyId: companyScope.companyId,
    jobsiteId,
  });
  if (jobsiteResult.error) {
    return NextResponse.json({ error: jobsiteResult.error.message || "Failed to load jobsite." }, { status: 500 });
  }
  if (!jobsiteResult.data) {
    return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });
  }

  const startDate = todayDateOnly();
  const endDate = addDays(startDate, 30);

  const [manualResult, microsoftResult] = await Promise.all([
    auth.supabase
      .from("company_jobsite_schedule_items")
      .select(SCHEDULE_SELECT)
      .eq("company_id", companyScope.companyId)
      .eq("jobsite_id", jobsiteId)
      .is("archived_at", null)
      .order("work_start_date", { ascending: true }),
    auth.supabase
      .from("company_microsoft_project_tasks")
      .select(MICROSOFT_TASK_SELECT)
      .eq("company_id", companyScope.companyId)
      .eq("jobsite_id", jobsiteId)
      .neq("status", "archived")
      .limit(500),
  ]);

  if (manualResult.error) {
    if (isMissingScheduleSchema(manualResult.error.message)) {
      return NextResponse.json({
        jobsite: jobsiteResult.data,
        window: { startDate, endDate, days: 30 },
        items: [],
        warning: "Jobsite schedule tables are not available yet. Run the latest Supabase migration.",
      });
    }
    return NextResponse.json({ error: manualResult.error.message || "Failed to load schedule." }, { status: 500 });
  }
  if (microsoftResult.error && !isMissingScheduleSchema(microsoftResult.error.message)) {
    return NextResponse.json(
      { error: microsoftResult.error.message || "Failed to load imported schedule tasks." },
      { status: 500 }
    );
  }

  const manualItems = ((manualResult.data ?? []) as Array<Record<string, string | null>>)
    .filter((item) => manualItemOverlapsWindow(item, startDate, endDate))
    .map((item) => ({
      id: item.id,
      source: "manual",
      title: item.title,
      status: item.status,
      workStartDate: item.work_start_date,
      workEndDate: item.work_end_date ?? item.work_start_date,
      trade: item.trade,
      workArea: item.work_area,
      crewOrContractor: item.crew_or_contractor,
      notes: item.notes,
      updatedAt: item.updated_at,
      readOnly: false,
    }));

  const importedItems = ((microsoftResult.data ?? []) as Array<Record<string, string | number | null>>)
    .filter((task) => dateInWindow(String(task.start_at ?? ""), startDate, endDate) || dateInWindow(String(task.due_at ?? ""), startDate, endDate))
    .map((task) => ({
      id: task.id,
      source: "microsoft_project",
      title: task.title,
      status: task.status,
      workStartDate: String(task.start_at ?? task.due_at ?? "").slice(0, 10),
      workEndDate: String(task.due_at ?? task.start_at ?? "").slice(0, 10),
      trade: task.bucket_name ?? null,
      workArea: null,
      crewOrContractor: null,
      notes: task.notes ?? "Imported from Microsoft Project.",
      priority: task.priority,
      percentComplete: task.percent_complete,
      updatedAt: task.updated_at,
      readOnly: true,
    }));

  const items = [...manualItems, ...importedItems].sort((a, b) =>
    String(a.workStartDate ?? "").localeCompare(String(b.workStartDate ?? ""))
  );

  return NextResponse.json({
    jobsite: jobsiteResult.data,
    window: { startDate, endDate, days: 30 },
    items,
    ...(microsoftResult.error ? { warning: "Imported Microsoft Project tasks are not available yet." } : {}),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageSchedule(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can manage jobsite schedules." }, { status: 403 });
  }

  const { jobsiteId } = await params;
  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const jobsiteResult = await resolveJobsite({ supabase: auth.supabase, companyId: companyScope.companyId, jobsiteId });
  if (jobsiteResult.error) {
    return NextResponse.json({ error: jobsiteResult.error.message || "Failed to load jobsite." }, { status: 500 });
  }
  if (!jobsiteResult.data) return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as SchedulePayload | null;
  const title = body?.title?.trim() ?? "";
  const workStartDate = body?.workStartDate?.trim() ?? "";
  const workEndDate = cleanNullable(body?.workEndDate);

  if (!title) return NextResponse.json({ error: "Schedule title is required." }, { status: 400 });
  if (!isDateOnly(workStartDate)) {
    return NextResponse.json({ error: "Work start date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (workEndDate && !isDateOnly(workEndDate)) {
    return NextResponse.json({ error: "Work end date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (workEndDate && workEndDate < workStartDate) {
    return NextResponse.json({ error: "Work end date must be on or after the start date." }, { status: 400 });
  }

  const insertResult = await auth.supabase
    .from("company_jobsite_schedule_items")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      title,
      work_start_date: workStartDate,
      work_end_date: workEndDate,
      trade: cleanNullable(body?.trade),
      work_area: cleanNullable(body?.workArea),
      crew_or_contractor: cleanNullable(body?.crewOrContractor),
      status: normalizeStatus(body?.status),
      notes: cleanNullable(body?.notes),
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(SCHEDULE_SELECT)
    .single();

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message || "Failed to create schedule item." }, { status: 500 });
  }

  return NextResponse.json({ success: true, item: insertResult.data, message: "Schedule item added." });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageSchedule(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can manage jobsite schedules." }, { status: 403 });
  }

  const { jobsiteId } = await params;
  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as SchedulePayload | null;
  const itemId = body?.itemId?.trim() ?? "";
  if (!itemId) return NextResponse.json({ error: "itemId is required." }, { status: 400 });

  const workStartDate = typeof body?.workStartDate === "string" ? body.workStartDate.trim() : undefined;
  const workEndDate = typeof body?.workEndDate === "string" || body?.workEndDate === null ? cleanNullable(body.workEndDate) : undefined;
  if (typeof workStartDate === "string" && !isDateOnly(workStartDate)) {
    return NextResponse.json({ error: "Work start date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (workEndDate && !isDateOnly(workEndDate)) {
    return NextResponse.json({ error: "Work end date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (workStartDate && workEndDate && workEndDate < workStartDate) {
    return NextResponse.json({ error: "Work end date must be on or after the start date." }, { status: 400 });
  }

  const archived = Boolean(body?.archived);
  const updateValues = {
    ...(typeof body?.title === "string" ? { title: body.title.trim() } : {}),
    ...(typeof workStartDate === "string" ? { work_start_date: workStartDate } : {}),
    ...(typeof workEndDate !== "undefined" ? { work_end_date: workEndDate } : {}),
    ...(typeof body?.trade === "string" || body?.trade === null ? { trade: cleanNullable(body.trade) } : {}),
    ...(typeof body?.workArea === "string" || body?.workArea === null ? { work_area: cleanNullable(body.workArea) } : {}),
    ...(typeof body?.crewOrContractor === "string" || body?.crewOrContractor === null
      ? { crew_or_contractor: cleanNullable(body.crewOrContractor) }
      : {}),
    ...(typeof body?.notes === "string" || body?.notes === null ? { notes: cleanNullable(body.notes) } : {}),
    ...(typeof body?.status === "string" ? { status: normalizeStatus(body.status) } : {}),
    ...(archived ? { status: "archived", archived_at: new Date().toISOString() } : {}),
    updated_by: auth.user.id,
  };

  if ("title" in updateValues && !String(updateValues.title ?? "").trim()) {
    return NextResponse.json({ error: "Schedule title cannot be empty." }, { status: 400 });
  }

  const updateResult = await auth.supabase
    .from("company_jobsite_schedule_items")
    .update(updateValues)
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("id", itemId)
    .select(SCHEDULE_SELECT)
    .single();

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message || "Failed to update schedule item." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    item: updateResult.data,
    message: archived ? "Schedule item archived." : "Schedule item updated.",
  });
}
