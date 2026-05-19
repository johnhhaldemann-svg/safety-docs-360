import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { getInjuryWeatherDashboardData } from "@/lib/injuryWeather/service";
import {
  buildEmptyPredictiveRiskPayload,
  buildPredictiveRiskPayload,
  buildSalesDemoPredictiveRiskPayload,
  type PredictiveRiskCorrectiveActionRow,
  type PredictiveRiskIncidentRow,
  type PredictiveRiskJobsiteRow,
  type PredictiveRiskJsaActivityRow,
  type PredictiveRiskPermitRow,
  type PredictiveRiskScheduleItemRow,
} from "@/lib/predictiveRisk";
import type { WorkScheduleInputs } from "@/lib/injuryWeather/types";
import type { BehaviorRiskObservationRow } from "@/lib/predictive/behaviorRisk";

export const runtime = "nodejs";

type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };
type ScopedQueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq: (column: string, value: string | boolean) => ScopedQueryBuilder<T>;
  in: (column: string, values: string[]) => ScopedQueryBuilder<T>;
  neq: (column: string, value: string) => ScopedQueryBuilder<T>;
  gte: (column: string, value: string) => PromiseLike<QueryResult<T>>;
};

function parseDays(value: string | null) {
  const n = Number(value ?? "30");
  return Math.max(1, Math.min(365, Number.isFinite(n) ? Math.floor(n) : 30));
}

function isMissingTable(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

function applyJobsiteScope<T>(
  query: ScopedQueryBuilder<T>,
  options: { requestedJobsiteId: string | null; assignedJobsiteIds: string[] | null }
) {
  if (options.requestedJobsiteId) {
    return query.eq("jobsite_id", options.requestedJobsiteId);
  }
  if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) {
    return query.in("jobsite_id", options.assignedJobsiteIds);
  }
  return query;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function itemOverlapsWindow(item: PredictiveRiskScheduleItemRow, startDate: string, endDate: string) {
  const itemStart = item.work_start_date ?? "";
  const itemEnd = item.work_end_date ?? itemStart;
  return Boolean(itemStart && itemStart <= endDate && itemEnd >= startDate);
}

function shiftHours(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return null;
  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return Math.max(0.25, Math.min(24, (endMinutes - startMinutes) / 60));
}

function scheduleDateRange(start: string, end: string) {
  const dates: Date[] = [];
  const current = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime())) return dates;
  while (current.getTime() <= last.getTime() && dates.length < 31) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function workScheduleFromScheduleItems(items: PredictiveRiskScheduleItemRow[]): Partial<WorkScheduleInputs> | undefined {
  if (items.length === 0) return undefined;
  const hours = items
    .map((item) => shiftHours(item.shift_start_time, item.shift_end_time))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const hoursPerDay = hours.length > 0 ? Math.max(...hours) : null;
  const scheduledDates = new Set<string>();
  for (const item of items) {
    const start = item.work_start_date ?? "";
    const end = item.work_end_date ?? start;
    for (const date of scheduleDateRange(start, end)) {
      scheduledDates.add(dateOnly(date));
    }
  }
  const weekendWork = [...scheduledDates].some((value) => {
    const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
    return day === 0 || day === 6;
  });
  const denseWeek = scheduledDates.size >= 7;
  if (!weekendWork && !denseWeek && hoursPerDay == null) return undefined;
  return {
    workSevenDaysPerWeek: weekendWork || denseWeek,
    hoursPerDay,
  };
}

function applyJobsiteIdScope<T>(
  query: ScopedQueryBuilder<T>,
  options: { requestedJobsiteId: string | null; assignedJobsiteIds: string[] | null }
) {
  if (options.requestedJobsiteId) {
    return query.eq("id", options.requestedJobsiteId);
  }
  if (options.assignedJobsiteIds && options.assignedJobsiteIds.length > 0) {
    return query.in("id", options.assignedJobsiteIds);
  }
  return query;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const days = parseDays(searchParams.get("days"));
  const requestedJobsiteId = searchParams.get("jobsiteId")?.trim() || null;
  const month = searchParams.get("month")?.trim() || null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const today = dateOnly(new Date());
  const scheduleWindowEnd = dateOnly(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

  if (auth.role === "sales_demo") {
    return NextResponse.json(buildSalesDemoPredictiveRiskPayload(days));
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      buildEmptyPredictiveRiskPayload(
        days,
        "Predictive risk is not available because no company workspace is linked to this account yet."
      )
    );
  }

  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });

  if (requestedJobsiteId && !isJobsiteAllowed(requestedJobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You do not have access to this jobsite." }, { status: 403 });
  }

  if (jobsiteScope.restricted && jobsiteScope.jobsiteIds.length === 0) {
    return NextResponse.json(
      buildEmptyPredictiveRiskPayload(days, "No assigned jobsites are available for predictive risk yet.")
    );
  }

  const assignedJobsiteIds = jobsiteScope.restricted && !requestedJobsiteId ? jobsiteScope.jobsiteIds : null;
  const forecastJobsiteId = requestedJobsiteId ?? (jobsiteScope.restricted ? jobsiteScope.jobsiteIds[0] ?? null : null);
  const scopeOptions = { requestedJobsiteId, assignedJobsiteIds };
  const companyId = companyScope.companyId;

  const jobsitesQuery = applyJobsiteIdScope(
    auth.supabase
      .from("company_jobsites")
      .select("id, name, location, status")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskJobsiteRow>,
    scopeOptions
  ) as unknown as PromiseLike<QueryResult<PredictiveRiskJobsiteRow>>;

  const correctiveQuery = applyJobsiteScope(
    auth.supabase
      .from("company_corrective_actions")
      .select(
        "id, title, category, severity, priority, status, due_at, created_at, jobsite_id, sif_potential, prediction_validation_status"
      )
      .eq("company_id", companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<PredictiveRiskCorrectiveActionRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskCorrectiveActionRow>>;

  const incidentsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_incidents")
      .select(
        "id, title, description, category, severity, status, created_at, jobsite_id, sif_flag, escalation_level, prediction_validation_status"
      )
      .eq("company_id", companyId)
      .neq("prediction_validation_status", "rejected") as unknown as ScopedQueryBuilder<PredictiveRiskIncidentRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskIncidentRow>>;

  const permitsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_permits")
      .select("id, title, permit_type, category, severity, status, created_at, jobsite_id, sif_flag, stop_work_status, escalation_level")
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskPermitRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskPermitRow>>;

  const jsaActivitiesQuery = applyJobsiteScope(
    auth.supabase
      .from("company_jsa_activities")
      .select(
        "id, jsa_id, jobsite_id, work_date, trade, activity_name, area, crew_size, hazard_category, hazard_description, mitigation, permit_required, permit_type, planned_risk_level, status, created_at, updated_at"
      )
      .eq("company_id", companyId) as unknown as ScopedQueryBuilder<PredictiveRiskJsaActivityRow>,
    scopeOptions
  ).gte("created_at", since) as PromiseLike<QueryResult<PredictiveRiskJsaActivityRow>>;

  const scheduleItemsQuery = applyJobsiteScope(
    auth.supabase
      .from("company_jobsite_schedule_items")
      .select(
        "id, jobsite_id, title, work_start_date, work_end_date, shift_start_time, shift_end_time, trade, work_area, crew_or_contractor, crew_size, supervisor_name, risk_level, is_high_risk, hazard_categories, permit_triggers, required_controls, status, notes, created_at"
      )
      .eq("company_id", companyId)
      .neq("status", "archived") as unknown as ScopedQueryBuilder<PredictiveRiskScheduleItemRow>,
    scopeOptions
  ) as unknown as PromiseLike<QueryResult<PredictiveRiskScheduleItemRow>>;

  const observationsQuery = auth.supabase
    .from("company_sor_records")
    .select("id, date, location, trade, category, hazard_category_code, subcategory, description, severity, status, created_at")
    .eq("company_id", companyId)
    .eq("is_deleted", false)
    .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) as unknown as PromiseLike<QueryResult<BehaviorRiskObservationRow>>;

  const [jobsitesRes, correctiveRes, incidentsRes, permitsRes, jsaActivitiesRes, scheduleItemsRes, observationsRes] = await Promise.all([
    jobsitesQuery,
    correctiveQuery,
    incidentsQuery,
    permitsQuery,
    jsaActivitiesQuery,
    scheduleItemsQuery,
    observationsQuery,
  ]);

  const scheduleItems = scheduleItemsRes.error
    ? []
    : (scheduleItemsRes.data ?? []).filter((item) => itemOverlapsWindow(item, today, scheduleWindowEnd));
  const workSchedule = workScheduleFromScheduleItems(scheduleItems);
  const forecast = await getInjuryWeatherDashboardData({
    companyId,
    jobsiteId: forecastJobsiteId,
    ...(month ? { month } : {}),
    ...(workSchedule ? { workSchedule } : {}),
  });

  const hardError =
    jobsitesRes.error?.message ||
    correctiveRes.error?.message ||
    incidentsRes.error?.message ||
    permitsRes.error?.message ||
    (jsaActivitiesRes.error && !isMissingTable(jsaActivitiesRes.error.message) ? jsaActivitiesRes.error.message : null) ||
    (scheduleItemsRes.error && !isMissingTable(scheduleItemsRes.error.message) ? scheduleItemsRes.error.message : null) ||
    (observationsRes.error && !isMissingTable(observationsRes.error.message) ? observationsRes.error.message : null);

  if (hardError) {
    return NextResponse.json({ error: hardError || "Failed to load predictive risk." }, { status: 500 });
  }

  return NextResponse.json(
    buildPredictiveRiskPayload({
      projectId: companyId,
      days,
      jobsiteId: requestedJobsiteId,
      month,
      forecast,
      jobsites: jobsitesRes.data ?? [],
      correctiveActions: correctiveRes.data ?? [],
      incidents: incidentsRes.data ?? [],
      permits: permitsRes.data ?? [],
      jsaActivities: jsaActivitiesRes.error ? [] : jsaActivitiesRes.data ?? [],
      scheduleItems,
      observations: observationsRes.error ? [] : observationsRes.data ?? [],
      warning:
        scheduleItemsRes.error && isMissingTable(scheduleItemsRes.error.message)
          ? "Work schedule data is not available yet. Run the latest Supabase migration to include schedule pressure in predictive risk."
          : jobsiteScope.restricted && !requestedJobsiteId && forecastJobsiteId
          ? "Forecast headline uses your first assigned jobsite; location rankings use all assigned jobsites."
          : undefined,
    })
  );
}
