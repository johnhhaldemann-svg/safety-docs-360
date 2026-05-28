import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { demoCompanyJobsiteRows } from "@/lib/demoWorkspace";
import { autoAssignSchedulePermits } from "@/lib/schedulePermitAutoAssignment";

export const runtime = "nodejs";

type SchedulePayload = {
  itemId?: string;
  title?: string;
  workStartDate?: string;
  workEndDate?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  trade?: string | null;
  workArea?: string | null;
  crewOrContractor?: string | null;
  crewSize?: number | string | null;
  supervisorName?: string | null;
  riskLevel?: string | null;
  isHighRisk?: boolean | null;
  hazardCategories?: string[] | string | null;
  permitTriggers?: string[] | string | null;
  requiredControls?: string[] | string | null;
  sourceMetadata?: Record<string, unknown> | null;
  status?: string;
  notes?: string | null;
  archived?: boolean;
};

type ScheduleDbRow = {
  id: string;
  title: string | null;
  status: string | null;
  work_start_date: string | null;
  work_end_date: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  trade: string | null;
  work_area: string | null;
  crew_or_contractor: string | null;
  crew_size: number | null;
  supervisor_name: string | null;
  risk_level: string | null;
  is_high_risk: boolean | null;
  hazard_categories: string[] | null;
  permit_triggers: string[] | null;
  required_controls: string[] | null;
  source_metadata: Record<string, unknown> | null;
  notes: string | null;
  updated_at: string | null;
};

type ScheduleAutoAssignSummary = {
  warning?: string;
  createdCount: number;
  skippedCount: number;
  unassignedCount: number;
};

const SCHEDULE_STATUSES = new Set(["planned", "active", "blocked", "completed", "archived"]);
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);

const SCHEDULE_SELECT =
  "id, company_id, jobsite_id, title, work_start_date, work_end_date, shift_start_time, shift_end_time, trade, work_area, crew_or_contractor, crew_size, supervisor_name, risk_level, is_high_risk, hazard_categories, permit_triggers, required_controls, source_metadata, status, notes, created_at, updated_at, archived_at";

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

function normalizeRiskLevel(riskLevel?: string | null) {
  const normalized = (riskLevel ?? "").trim().toLowerCase();
  return RISK_LEVELS.has(normalized) ? normalized : "medium";
}

function cleanNullable(value?: string | null) {
  const clean = (value ?? "").trim();
  return clean || null;
}

function cleanStringList(value?: string[] | string | null) {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const cleaned = String(item ?? "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out.slice(0, 16);
}

function cleanSourceMetadata(value?: Record<string, unknown> | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key, item]) => {
      if (!key || key.length > 80) return false;
      return item == null || ["string", "number", "boolean", "object"].includes(typeof item);
    })
  );
}

function normalizeCrewSize(value: SchedulePayload["crewSize"]) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return Math.floor(n);
}

function isTimeOnly(value?: string | null) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function highRiskInferenceText(input: {
  title?: string | null;
  trade?: string | null;
  workArea?: string | null;
  notes?: string | null;
  hazardCategories?: string[];
  permitTriggers?: string[];
}) {
  return [
    input.title,
    input.trade,
    input.workArea,
    input.notes,
    ...(input.hazardCategories ?? []),
    ...(input.permitTriggers ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferHighRisk(input: {
  title?: string | null;
  trade?: string | null;
  workArea?: string | null;
  notes?: string | null;
  riskLevel?: string | null;
  isHighRisk?: boolean | null;
  hazardCategories?: string[];
  permitTriggers?: string[];
}) {
  if (input.isHighRisk) return true;
  const riskLevel = normalizeRiskLevel(input.riskLevel);
  if (riskLevel === "high" || riskLevel === "critical") return true;
  const text = highRiskInferenceText(input);
  return /fall|height|roof|edge|lift|aerial|confined|excavat|trench|hot work|weld|cutting|burn|electrical|loto|lockout|energized|crane|rigging|steel|overhead|line of fire|demolition/.test(text);
}

function inferRiskLevel(input: {
  title?: string | null;
  trade?: string | null;
  workArea?: string | null;
  notes?: string | null;
  riskLevel?: string | null;
  isHighRisk?: boolean | null;
  hazardCategories?: string[];
  permitTriggers?: string[];
}) {
  const explicit = normalizeRiskLevel(input.riskLevel);
  if (explicit !== "medium") return explicit;
  const text = highRiskInferenceText(input);
  if (/critical|confined|trench|excavat|energized|crane|critical lift|steel erection|fall|height|roof|edge/.test(text)) return "critical";
  if (inferHighRisk(input)) return "high";
  if (/hot work|weld|cutting|rigging|overhead|line of fire|demolition|loto|lockout|electrical/.test(text)) return "high";
  return explicit;
}

function inferHazardCategories(text: string) {
  const value = text.toLowerCase();
  const out: string[] = [];
  if (/fall|height|roof|edge|aerial|lift/.test(value)) out.push("fall_protection");
  if (/hot work|weld|cutting|burn|fire/.test(value)) out.push("hot_work");
  if (/electrical|loto|lockout|energized|power/.test(value)) out.push("electrical");
  if (/excavat|trench/.test(value)) out.push("excavation");
  if (/confined/.test(value)) out.push("confined_space");
  if (/crane|rigging|steel|lift plan/.test(value)) out.push("crane_rigging");
  if (/overhead|line of fire|struck/.test(value)) out.push("line_of_fire");
  return [...new Set(out)];
}

function inferPermitTriggers(text: string) {
  const value = text.toLowerCase();
  const out: string[] = [];
  if (/hot work|weld|cutting|burn/.test(value)) out.push("hot_work_permit");
  if (/confined/.test(value)) out.push("confined_space_permit");
  if (/excavat|trench/.test(value)) out.push("excavation_permit");
  if (/electrical|loto|lockout|energized/.test(value)) out.push("energized_electrical_or_loto");
  if (/crane|rigging|critical lift|lift plan/.test(value)) out.push("lift_plan");
  if (/fall|height|roof|edge|aerial/.test(value)) out.push("elevated_work_notice");
  return [...new Set(out)];
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

async function autoAssignPermitsForScheduleItem({
  supabase,
  companyId,
  jobsiteId,
  itemId,
  actorUserId,
}: {
  supabase: Parameters<typeof autoAssignSchedulePermits>[0]["supabase"];
  companyId: string;
  jobsiteId: string;
  itemId: string;
  actorUserId: string;
}): Promise<ScheduleAutoAssignSummary> {
  const result = await autoAssignSchedulePermits({
    supabase,
    profileClient: supabase,
    companyId,
    jobsiteId,
    scope: "weekly",
    scheduleItemIds: [itemId],
    actorUserId,
  });

  if (!result.success) {
    return {
      warning: result.error,
      createdCount: 0,
      skippedCount: 0,
      unassignedCount: 0,
    };
  }

  return {
    createdCount: result.createdPermits.length,
    skippedCount: result.skippedPermits.length,
    unassignedCount: result.unassignedPermits.length,
  };
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

function buildSummary(items: Array<{ isHighRisk?: boolean; permitTriggers?: string[]; requiredControls?: string[]; source: string }>) {
  return {
    totalItems: items.length,
    manualItems: items.filter((item) => item.source === "manual").length,
    importedTasks: items.filter((item) => item.source === "microsoft_project").length,
    highRiskItems: items.filter((item) => item.isHighRisk).length,
    permitRequiredItems: items.filter((item) => (item.permitTriggers ?? []).length > 0).length,
    missingControlItems: items.filter((item) => item.isHighRisk && (item.requiredControls ?? []).length === 0).length,
  };
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
          shiftStartTime: "07:00",
          shiftEndTime: "15:30",
          trade: "Ironworkers",
          workArea: "North Tower - Level 5",
          crewOrContractor: "Lone Star Steel",
          crewSize: 8,
          supervisorName: "Demo Supervisor",
          riskLevel: "critical",
          isHighRisk: true,
          hazardCategories: ["fall_protection", "crane_rigging"],
          permitTriggers: ["lift_plan", "elevated_work_notice"],
          requiredControls: ["controlled access zone", "supervisor verification"],
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
          shiftStartTime: null,
          shiftEndTime: null,
          trade: null,
          workArea: null,
          crewOrContractor: null,
          crewSize: null,
          supervisorName: null,
          riskLevel: "high",
          isHighRisk: true,
          hazardCategories: ["hot_work"],
          permitTriggers: ["hot_work_permit"],
          requiredControls: [],
          notes: "Imported from Microsoft Project.",
          readOnly: true,
        },
      ],
      summary: {
        totalItems: 2,
        manualItems: 1,
        importedTasks: 1,
        highRiskItems: 2,
        permitRequiredItems: 2,
        missingControlItems: 1,
      },
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

  const manualItems = ((manualResult.data ?? []) as ScheduleDbRow[])
    .filter((item) => manualItemOverlapsWindow(item, startDate, endDate))
    .map((item) => ({
      id: item.id,
      source: "manual",
      title: item.title,
      status: item.status,
      workStartDate: item.work_start_date,
      workEndDate: item.work_end_date ?? item.work_start_date,
      shiftStartTime: item.shift_start_time,
      shiftEndTime: item.shift_end_time,
      trade: item.trade,
      workArea: item.work_area,
      crewOrContractor: item.crew_or_contractor,
      crewSize: item.crew_size,
      supervisorName: item.supervisor_name,
      riskLevel: item.risk_level ?? "medium",
      isHighRisk: Boolean(item.is_high_risk),
      hazardCategories: Array.isArray(item.hazard_categories) ? item.hazard_categories : [],
      permitTriggers: Array.isArray(item.permit_triggers) ? item.permit_triggers : [],
      requiredControls: Array.isArray(item.required_controls) ? item.required_controls : [],
      sourceMetadata: item.source_metadata ?? {},
      notes: item.notes,
      updatedAt: item.updated_at,
      readOnly: false,
    }));

  const importedItems = ((microsoftResult.data ?? []) as Array<Record<string, string | number | null>>)
    .filter((task) => dateInWindow(String(task.start_at ?? ""), startDate, endDate) || dateInWindow(String(task.due_at ?? ""), startDate, endDate))
    .map((task) => {
      const text = [task.title, task.notes, task.bucket_name, task.priority].filter(Boolean).join(" ");
      const hazardCategories = inferHazardCategories(text);
      const permitTriggers = inferPermitTriggers(text);
      const riskLevel = inferRiskLevel({
        title: String(task.title ?? ""),
        trade: String(task.bucket_name ?? ""),
        notes: String(task.notes ?? ""),
        hazardCategories,
        permitTriggers,
      });
      const isHighRisk = inferHighRisk({
        title: String(task.title ?? ""),
        trade: String(task.bucket_name ?? ""),
        notes: String(task.notes ?? ""),
        riskLevel,
        hazardCategories,
        permitTriggers,
      });
      return {
        id: task.id,
        source: "microsoft_project",
        title: task.title,
        status: task.status,
        workStartDate: String(task.start_at ?? task.due_at ?? "").slice(0, 10),
        workEndDate: String(task.due_at ?? task.start_at ?? "").slice(0, 10),
        shiftStartTime: null,
        shiftEndTime: null,
        trade: task.bucket_name ?? null,
        workArea: null,
        crewOrContractor: null,
        crewSize: null,
        supervisorName: null,
        riskLevel,
        isHighRisk,
        hazardCategories,
        permitTriggers,
        requiredControls: [],
        sourceMetadata: { priority: task.priority ?? null, percentComplete: task.percent_complete ?? null },
        notes: task.notes ?? "Imported from Microsoft Project.",
        priority: task.priority,
        percentComplete: task.percent_complete,
        updatedAt: task.updated_at,
        readOnly: true,
      };
    });

  const items = [...manualItems, ...importedItems].sort((a, b) =>
    String(a.workStartDate ?? "").localeCompare(String(b.workStartDate ?? ""))
  );

  return NextResponse.json({
    jobsite: jobsiteResult.data,
    window: { startDate, endDate, days: 30 },
    items,
    summary: buildSummary(items),
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
  const shiftStartTime = cleanNullable(body?.shiftStartTime);
  const shiftEndTime = cleanNullable(body?.shiftEndTime);
  if (!isTimeOnly(shiftStartTime) || !isTimeOnly(shiftEndTime)) {
    return NextResponse.json({ error: "Shift times must use HH:MM format." }, { status: 400 });
  }
  const crewSize = normalizeCrewSize(body?.crewSize);
  if (Number.isNaN(crewSize)) {
    return NextResponse.json({ error: "Crew size must be a non-negative number." }, { status: 400 });
  }
  const hazardCategories = cleanStringList(body?.hazardCategories);
  const permitTriggers = cleanStringList(body?.permitTriggers);
  const requiredControls = cleanStringList(body?.requiredControls);
  const riskLevel = inferRiskLevel({
    title,
    trade: body?.trade,
    workArea: body?.workArea,
    notes: body?.notes,
    riskLevel: body?.riskLevel,
    isHighRisk: body?.isHighRisk,
    hazardCategories,
    permitTriggers,
  });
  const isHighRisk = inferHighRisk({
    title,
    trade: body?.trade,
    workArea: body?.workArea,
    notes: body?.notes,
    riskLevel,
    isHighRisk: body?.isHighRisk,
    hazardCategories,
    permitTriggers,
  });

  const insertResult = await auth.supabase
    .from("company_jobsite_schedule_items")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      title,
      work_start_date: workStartDate,
      work_end_date: workEndDate,
      shift_start_time: shiftStartTime,
      shift_end_time: shiftEndTime,
      trade: cleanNullable(body?.trade),
      work_area: cleanNullable(body?.workArea),
      crew_or_contractor: cleanNullable(body?.crewOrContractor),
      crew_size: crewSize,
      supervisor_name: cleanNullable(body?.supervisorName),
      risk_level: riskLevel,
      is_high_risk: isHighRisk,
      hazard_categories: hazardCategories,
      permit_triggers: permitTriggers,
      required_controls: requiredControls,
      source_metadata: {
        ...cleanSourceMetadata(body?.sourceMetadata),
        riskInput: body?.riskLevel ? "explicit" : "inferred",
      },
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

  const autoAssignment = await autoAssignPermitsForScheduleItem({
    supabase: auth.supabase,
    companyId: companyScope.companyId,
    jobsiteId,
    itemId: String((insertResult.data as { id?: string } | null)?.id ?? ""),
    actorUserId: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    item: insertResult.data,
    autoAssignment,
    message:
      autoAssignment.createdCount > 0
        ? `Schedule item added. ${autoAssignment.createdCount} permit draft${autoAssignment.createdCount === 1 ? "" : "s"} auto-assigned.`
        : "Schedule item added.",
    warning: autoAssignment.warning,
  });
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
  const shiftStartTime = typeof body?.shiftStartTime === "string" || body?.shiftStartTime === null ? cleanNullable(body.shiftStartTime) : undefined;
  const shiftEndTime = typeof body?.shiftEndTime === "string" || body?.shiftEndTime === null ? cleanNullable(body.shiftEndTime) : undefined;
  if ((typeof shiftStartTime === "string" && !isTimeOnly(shiftStartTime)) || (typeof shiftEndTime === "string" && !isTimeOnly(shiftEndTime))) {
    return NextResponse.json({ error: "Shift times must use HH:MM format." }, { status: 400 });
  }
  const crewSize = typeof body?.crewSize !== "undefined" ? normalizeCrewSize(body.crewSize) : undefined;
  if (typeof crewSize === "number" && Number.isNaN(crewSize)) {
    return NextResponse.json({ error: "Crew size must be a non-negative number." }, { status: 400 });
  }
  const nextHazardCategories = typeof body?.hazardCategories !== "undefined" ? cleanStringList(body.hazardCategories) : undefined;
  const nextPermitTriggers = typeof body?.permitTriggers !== "undefined" ? cleanStringList(body.permitTriggers) : undefined;
  const nextRequiredControls = typeof body?.requiredControls !== "undefined" ? cleanStringList(body.requiredControls) : undefined;
  const riskLevel =
    typeof body?.riskLevel === "string" || typeof body?.isHighRisk !== "undefined" || nextHazardCategories || nextPermitTriggers
      ? inferRiskLevel({
          title: body?.title,
          trade: body?.trade,
          workArea: body?.workArea,
          notes: body?.notes,
          riskLevel: body?.riskLevel,
          isHighRisk: body?.isHighRisk,
          hazardCategories: nextHazardCategories,
          permitTriggers: nextPermitTriggers,
        })
      : undefined;
  const isHighRisk =
    typeof body?.isHighRisk !== "undefined" || riskLevel || nextHazardCategories || nextPermitTriggers
      ? inferHighRisk({
          title: body?.title,
          trade: body?.trade,
          workArea: body?.workArea,
          notes: body?.notes,
          riskLevel,
          isHighRisk: body?.isHighRisk,
          hazardCategories: nextHazardCategories,
          permitTriggers: nextPermitTriggers,
        })
      : undefined;

  const archived = Boolean(body?.archived);
  const sourceMetadata = cleanSourceMetadata(body?.sourceMetadata);
  const updateValues = {
    ...(typeof body?.title === "string" ? { title: body.title.trim() } : {}),
    ...(typeof workStartDate === "string" ? { work_start_date: workStartDate } : {}),
    ...(typeof workEndDate !== "undefined" ? { work_end_date: workEndDate } : {}),
    ...(typeof shiftStartTime !== "undefined" ? { shift_start_time: shiftStartTime } : {}),
    ...(typeof shiftEndTime !== "undefined" ? { shift_end_time: shiftEndTime } : {}),
    ...(typeof body?.trade === "string" || body?.trade === null ? { trade: cleanNullable(body.trade) } : {}),
    ...(typeof body?.workArea === "string" || body?.workArea === null ? { work_area: cleanNullable(body.workArea) } : {}),
    ...(typeof body?.crewOrContractor === "string" || body?.crewOrContractor === null
      ? { crew_or_contractor: cleanNullable(body.crewOrContractor) }
      : {}),
    ...(typeof crewSize !== "undefined" ? { crew_size: crewSize } : {}),
    ...(typeof body?.supervisorName === "string" || body?.supervisorName === null ? { supervisor_name: cleanNullable(body.supervisorName) } : {}),
    ...(riskLevel ? { risk_level: riskLevel } : {}),
    ...(typeof isHighRisk !== "undefined" ? { is_high_risk: isHighRisk } : {}),
    ...(nextHazardCategories ? { hazard_categories: nextHazardCategories } : {}),
    ...(nextPermitTriggers ? { permit_triggers: nextPermitTriggers } : {}),
    ...(nextRequiredControls ? { required_controls: nextRequiredControls } : {}),
    ...(Object.keys(sourceMetadata).length > 0 || riskLevel || typeof isHighRisk !== "undefined"
      ? {
          source_metadata: {
            ...sourceMetadata,
            ...(riskLevel || typeof isHighRisk !== "undefined"
              ? { riskInput: body?.riskLevel ? "explicit" : "inferred" }
              : {}),
          },
        }
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

  const autoAssignment = archived
    ? undefined
    : await autoAssignPermitsForScheduleItem({
        supabase: auth.supabase,
        companyId: companyScope.companyId,
        jobsiteId,
        itemId,
        actorUserId: auth.user.id,
      });

  return NextResponse.json({
    success: true,
    item: updateResult.data,
    autoAssignment,
    message:
      !archived && autoAssignment && autoAssignment.createdCount > 0
        ? `Schedule item updated. ${autoAssignment.createdCount} permit draft${autoAssignment.createdCount === 1 ? "" : "s"} auto-assigned.`
        : archived ? "Schedule item archived." : "Schedule item updated.",
    warning: autoAssignment?.warning,
  });
}
