import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { withCronTelemetry } from "@/lib/cronTelemetry";
import { buildJobsiteDailyTodos, getDailyTodoWorkDate, getLocalDailyDateParts } from "@/lib/jobsiteDailyTodos";
import { evaluateEmergencyActionPlanReadiness, type EmergencyActionPlanReadiness } from "@/lib/jobsiteEmergencyActionPlan";
import { buildTopJobsiteRisks, type JobsiteTopRiskEvidenceRow } from "@/lib/jobsiteTopRisks";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 120;

type JobsiteRow = {
  id: string;
  company_id: string;
  name: string | null;
  status: string | null;
};

type SignalCounts = {
  emergencyActionPlanReadiness: EmergencyActionPlanReadiness;
  emergencyActionPlanMissingCount: number;
  topJobsiteRiskLevel: "low" | "medium" | "high" | "critical" | null;
  topJobsiteRiskTitle: string | null;
  topJobsiteRiskEvidenceCount: number;
  highRiskScheduleCount: number;
  firstScheduleRiskTitle: string | null;
  openActionsCount: number;
  overdueActionsCount: number;
  permitBlockerCount: number;
  inspectionGapCount: number;
  readyReportCount: number;
  workforceGapCount: number;
};

const ACTIVE_STATUS_BLOCKLIST = new Set(["archived", "closed", "completed", "inactive"]);

function isMissingDailyTodoTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_jobsite_daily_todos");
}

function isActiveJobsite(row: JobsiteRow) {
  const status = String(row.status ?? "").trim().toLowerCase();
  return !ACTIVE_STATUS_BLOCKLIST.has(status);
}

function todayBounds(workDate: string) {
  const start = `${workDate}T00:00:00.000Z`;
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start, end: endDate.toISOString() };
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function evidenceRows(rows: Array<Record<string, unknown>>, source: JobsiteTopRiskEvidenceRow["source"]): JobsiteTopRiskEvidenceRow[] {
  return rows.map((row) => ({
    source,
    id: typeof row.id === "string" ? row.id : null,
    title: typeof row.title === "string" ? row.title : typeof row.name === "string" ? row.name : null,
    category: typeof row.category === "string" ? row.category : typeof row.incident_type === "string" ? row.incident_type : null,
    severity: typeof row.severity === "string" ? row.severity : null,
    priority: typeof row.priority === "string" ? row.priority : null,
    status: typeof row.status === "string" ? row.status : null,
    riskLevel: typeof row.risk_level === "string" ? row.risk_level : null,
    isHighRisk: typeof row.is_high_risk === "boolean" ? row.is_high_risk : null,
    sifPotential: Boolean(row.sif_potential),
    sifFlag: Boolean(row.sif_flag),
    stopWorkStatus: typeof row.stop_work_status === "string" ? row.stop_work_status : null,
    escalationLevel: typeof row.escalation_level === "string" ? row.escalation_level : null,
    hazardCategories: stringArray(row.hazard_categories),
    permitTriggers: stringArray(row.permit_triggers),
    permitType: typeof row.permit_type === "string" ? row.permit_type : null,
    description: typeof row.description === "string" ? row.description : typeof row.work_area === "string" ? row.work_area : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  }));
}

function todoRiskLevelFromTopRisk(level: string | undefined) {
  if (level === "critical" || level === "high" || level === "low") return level;
  if (level === "moderate") return "medium";
  return null;
}

async function loadCounts(adminClient: ReturnType<typeof createSupabaseAdminClient>, jobsite: JobsiteRow, workDate: string): Promise<SignalCounts> {
  if (!adminClient) {
    return {
      highRiskScheduleCount: 0,
      firstScheduleRiskTitle: null,
      openActionsCount: 0,
      emergencyActionPlanReadiness: "missing_critical_info",
      emergencyActionPlanMissingCount: 0,
      topJobsiteRiskLevel: null,
      topJobsiteRiskTitle: null,
      topJobsiteRiskEvidenceCount: 0,
      overdueActionsCount: 0,
      permitBlockerCount: 0,
      inspectionGapCount: 0,
      readyReportCount: 0,
      workforceGapCount: 0,
    };
  }
  const { start, end } = todayBounds(workDate);

  const [scheduleResult, actionsResult, permitsResult, incidentsResult, auditsResult, reportsResult, emergencyProfileResult] = await Promise.all([
    adminClient
      .from("company_jobsite_schedule_items")
      .select("id, title, status, risk_level, is_high_risk, work_start_date, work_end_date, trade, work_area, hazard_categories, permit_triggers, notes, created_at, updated_at")
      .eq("company_id", jobsite.company_id)
      .eq("jobsite_id", jobsite.id)
      .is("archived_at", null)
      .lte("work_start_date", workDate)
      .or(`work_end_date.is.null,work_end_date.gte.${workDate}`),
    adminClient
      .from("company_corrective_actions")
      .select("id, title, category, severity, priority, status, due_at, sif_potential, created_at, updated_at")
      .eq("company_id", jobsite.company_id)
      .eq("jobsite_id", jobsite.id)
      .not("status", "in", "(verified_closed,closed)"),
    adminClient
      .from("company_permits")
      .select("id, title, permit_type, category, severity, priority, status, review_status, expires_at, sif_flag, stop_work_status, escalation_level, created_at, updated_at")
      .eq("company_id", jobsite.company_id)
      .eq("jobsite_id", jobsite.id),
    adminClient
      .from("company_incidents")
      .select("id, title, category, incident_type, severity, status, sif_flag, stop_work_status, escalation_level, created_at, updated_at")
      .eq("company_id", jobsite.company_id)
      .eq("jobsite_id", jobsite.id),
    adminClient
      .from("company_field_audits")
      .select("id, status, failed_items, deficiency_count")
      .eq("company_id", jobsite.company_id)
      .eq("jobsite_id", jobsite.id),
    adminClient
      .from("company_reports")
      .select("id, status, updated_at")
      .eq("company_id", jobsite.company_id)
      .eq("jobsite_id", jobsite.id)
      .gte("updated_at", start)
      .lt("updated_at", end),
    adminClient
      .from("company_jobsite_emergency_profiles")
      .select("id, company_id, jobsite_id, emergency_contact_name, emergency_contact_phone, responder_access_instructions, responder_site_address, assembly_area, secondary_assembly_area, command_post_location, evacuation_shelter_notes, weather_shelter_location, lightning_plan, tornado_plan, aed_location, first_aid_location, fire_extinguisher_locations, spill_kit_locations, rescue_equipment_locations, nearest_medical_name, nearest_medical_address, nearest_medical_phone, nearest_medical_route, media_contact_name, media_contact_phone, media_statement_instructions, regulatory_contact_name, regulatory_contact_phone, regulatory_reporting_instructions, call_chain, utility_contacts, after_hours_contacts, backup_contacts, incident_notification_timeline, post_incident_requirements, notes, revision_date, last_reviewed_at, last_reviewed_by")
      .eq("company_id", jobsite.company_id)
      .eq("jobsite_id", jobsite.id)
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  const scheduleRows = Array.isArray(scheduleResult.data) ? scheduleResult.data as Array<Record<string, unknown>> : [];
  const highRiskSchedule = scheduleRows.filter((row) => {
    const risk = String(row.risk_level ?? "").toLowerCase();
    return row.is_high_risk === true || risk === "high" || risk === "critical";
  });
  const actionRows = Array.isArray(actionsResult.data) ? actionsResult.data as Array<Record<string, unknown>> : [];
  const permitRows = Array.isArray(permitsResult.data) ? permitsResult.data as Array<Record<string, unknown>> : [];
  const incidentRows = Array.isArray(incidentsResult.data) ? incidentsResult.data as Array<Record<string, unknown>> : [];
  const auditRows = Array.isArray(auditsResult.data) ? auditsResult.data as Array<Record<string, unknown>> : [];
  const reportRows = Array.isArray(reportsResult.data) ? reportsResult.data as Array<Record<string, unknown>> : [];
  const topRisk = buildTopJobsiteRisks([
    ...evidenceRows(incidentRows, "incident"),
    ...evidenceRows(actionRows, "corrective_action"),
    ...evidenceRows(permitRows, "permit"),
    ...evidenceRows(scheduleRows, "scheduled_work"),
  ])[0];
  const emergencyReadiness = evaluateEmergencyActionPlanReadiness({
    profile: emergencyProfileResult.error ? null : emergencyProfileResult.data,
    jobsiteStatus: jobsite.status,
  });

  return {
    emergencyActionPlanReadiness: emergencyReadiness.readiness,
    emergencyActionPlanMissingCount: emergencyReadiness.missingFields.length,
    topJobsiteRiskLevel: todoRiskLevelFromTopRisk(topRisk?.riskLevel),
    topJobsiteRiskTitle: topRisk?.evidenceCount ? topRisk.title : null,
    topJobsiteRiskEvidenceCount: topRisk?.evidenceCount ?? 0,
    highRiskScheduleCount: highRiskSchedule.length,
    firstScheduleRiskTitle: typeof highRiskSchedule[0]?.title === "string" ? highRiskSchedule[0].title : null,
    openActionsCount: actionRows.length,
    overdueActionsCount: actionRows.filter((row) => {
      const due = typeof row.due_at === "string" ? Date.parse(row.due_at) : Number.NaN;
      return Number.isFinite(due) && due < Date.now();
    }).length,
    permitBlockerCount: permitRows.filter((row) => {
      const status = String(row.status ?? row.review_status ?? "").toLowerCase();
      return status && !status.includes("active") && !status.includes("approved") && !status.includes("ready");
    }).length,
    inspectionGapCount: auditRows.filter((row) => {
      const status = String(row.status ?? "").toLowerCase();
      const failed = Number(row.failed_items ?? row.deficiency_count ?? 0) || 0;
      return failed > 0 || status.includes("fail") || status.includes("overdue");
    }).length,
    readyReportCount: reportRows.filter((row) => {
      const status = String(row.status ?? "").toLowerCase();
      return status.includes("ready") || status.includes("publish") || status.includes("sent");
    }).length,
    workforceGapCount: 0,
  };
}

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronTelemetry("jobsite-daily-todos", async () => {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const localHour = getLocalDailyDateParts(new Date()).hour;
    if (!force && localHour !== 5) {
      return {
        response: NextResponse.json({ ok: true, skipped: true, reason: "Daily todos run at 5am America/Chicago.", localHour }),
        processedCount: 0,
        metadata: { skipped: true, localHour },
      };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return {
        response: NextResponse.json(
          { error: "Missing Supabase service role key for jobsite daily todos." },
          { status: 500 }
        ),
      };
    }

    const workDate = getDailyTodoWorkDate();
    const jobsiteResult = await adminClient
      .from("company_jobsites")
      .select("id, company_id, name, status")
      .is("archived_at", null)
      .limit(500);

    if (jobsiteResult.error) {
      return {
        response: NextResponse.json(
          { error: jobsiteResult.error.message || "Failed to load jobsites." },
          { status: 500 }
        ),
      };
    }

    const jobsites = ((jobsiteResult.data ?? []) as JobsiteRow[]).filter(isActiveJobsite);
    let insertedOrExisting = 0;
    let failed = 0;
    const failures: Array<{ jobsiteId: string; error: string }> = [];

    for (const jobsite of jobsites) {
      const counts = await loadCounts(adminClient, jobsite, workDate);
      const todos = buildJobsiteDailyTodos({
        jobsiteId: jobsite.id,
        jobsiteName: jobsite.name ?? "Jobsite",
        workDate,
        riskLevel:
          counts.overdueActionsCount > 0 || counts.permitBlockerCount > 0
            ? "critical"
            : counts.highRiskScheduleCount > 0 || counts.inspectionGapCount > 0
              ? "high"
              : "medium",
        ...counts,
      });

      const rows = todos.map((todo) => ({
        company_id: jobsite.company_id,
        jobsite_id: jobsite.id,
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

      const upsertResult = await adminClient
        .from("company_jobsite_daily_todos")
        .upsert(rows, { onConflict: "company_id,jobsite_id,work_date,source_key", ignoreDuplicates: true });

      if (upsertResult.error) {
        failed += 1;
        failures.push({ jobsiteId: jobsite.id, error: upsertResult.error.message || "Failed to upsert todos." });
        if (isMissingDailyTodoTable(upsertResult.error.message)) break;
        continue;
      }
      insertedOrExisting += rows.length;
    }

    return {
      response: NextResponse.json(
        {
          ok: failed === 0,
          workDate,
          jobsites: jobsites.length,
          todos: insertedOrExisting,
          failed,
          failures,
        },
        { status: failed > 0 ? 500 : 200 }
      ),
      processedCount: jobsites.length,
      metadata: { workDate, todos: insertedOrExisting, failed },
    };
  });
}
