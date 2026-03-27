import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";
const ANALYTICS_CACHE_TTL_MS = 60_000;
const analyticsSummaryCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();

function getAnalyticsCacheKey(companyId: string, since: string) {
  return `${companyId}:${since}`;
}

function getCachedAnalyticsPayload(cacheKey: string) {
  const cached = analyticsSummaryCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    analyticsSummaryCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function setCachedAnalyticsPayload(cacheKey: string, payload: Record<string, unknown>) {
  analyticsSummaryCache.set(cacheKey, {
    expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
    payload,
  });
}

function invalidateCompanyAnalyticsCache(companyId: string) {
  for (const key of analyticsSummaryCache.keys()) {
    if (key.startsWith(`${companyId}:`)) {
      analyticsSummaryCache.delete(key);
    }
  }
}

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_analytics_snapshots");
}
function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team });
  if (!companyScope.companyId) return NextResponse.json({ snapshots: [] });
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cacheKey = getAnalyticsCacheKey(companyScope.companyId, since);
  const cachedPayload = getCachedAnalyticsPayload(cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        "X-Analytics-Cache": "hit",
      },
    });
  }
  const result = await auth.supabase
    .from("company_analytics_snapshots")
    .select("id,company_id,jobsite_id,snapshot_date,metrics,created_at,created_by")
    .eq("company_id", companyScope.companyId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: false });
  if (result.error) {
    if (isMissingTable(result.error.message)) {
      return NextResponse.json({ snapshots: [], warning: "Analytics snapshot tables are not available yet. Run latest migrations." }, { status: 500 });
    }
    return NextResponse.json({ error: result.error.message || "Failed to load analytics summary." }, { status: 500 });
  }
  const [actionsRes, incidentsRes, permitsRes, dapsRes, activitiesRes, jobsitesRes] = await Promise.all([
    auth.supabase
      .from("company_corrective_actions")
      .select("id, category, status, severity, priority, observation_type, created_at, closed_at, due_at, jobsite_id, sif_potential, sif_category")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_incidents")
      .select("id, category, status, severity, sif_flag, escalation_level, created_at, closed_at, jobsite_id")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_permits")
      .select("id, status, stop_work_status, sif_flag, escalation_level, created_at, jobsite_id")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_daps")
      .select("id, status, created_at, jobsite_id")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_dap_activities")
      .select("id, dap_id, status, hazard_category, created_at, work_date, jobsite_id")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_jobsites")
      .select("id, status")
      .eq("company_id", companyScope.companyId),
  ]);
  if (actionsRes.error) return NextResponse.json({ error: actionsRes.error.message || "Failed to load corrective actions." }, { status: 500 });
  if (incidentsRes.error) return NextResponse.json({ error: incidentsRes.error.message || "Failed to load incidents." }, { status: 500 });
  if (permitsRes.error) return NextResponse.json({ error: permitsRes.error.message || "Failed to load permits." }, { status: 500 });
  if (dapsRes.error) return NextResponse.json({ error: dapsRes.error.message || "Failed to load daps." }, { status: 500 });
  if (activitiesRes.error) return NextResponse.json({ error: activitiesRes.error.message || "Failed to load dap activities." }, { status: 500 });
  if (jobsitesRes.error) return NextResponse.json({ error: jobsitesRes.error.message || "Failed to load jobsites." }, { status: 500 });

  const actions = actionsRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const permits = permitsRes.data ?? [];
  const daps = dapsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const jobsites = jobsitesRes.data ?? [];

  const hazardCounts = new Map<string, number>();
  const actionsByDay = new Map<string, number>();
  const closureHours: number[] = [];
  const jobsiteRisk = new Map<string, { incidents: number; sif: number; stopWork: number; overdue: number }>();
  const sifTrendByDay = new Map<string, number>();
  const sifCategoryCounts = new Map<string, number>();
  const highRiskLocationCounts = new Map<string, number>();
  const closureByJobsite = new Map<string, { totalHours: number; count: number }>();
  let positiveObservationCount = 0;
  let negativeObservationCount = 0;
  for (const action of actions) {
    const category = (action.category ?? "uncategorized").toLowerCase();
    hazardCounts.set(category, (hazardCounts.get(category) ?? 0) + 1);
    const day = String(action.created_at ?? "").slice(0, 10);
    if (day) actionsByDay.set(day, (actionsByDay.get(day) ?? 0) + 1);
    if (action.sif_potential) {
      const sifDay = String(action.created_at ?? "").slice(0, 10);
      if (sifDay) sifTrendByDay.set(sifDay, (sifTrendByDay.get(sifDay) ?? 0) + 1);
      const sifCategory = (action.sif_category ?? "uncategorized").toLowerCase();
      sifCategoryCounts.set(sifCategory, (sifCategoryCounts.get(sifCategory) ?? 0) + 1);
    }
    const observationType = (action.observation_type ?? "").toLowerCase();
    if (observationType === "positive") positiveObservationCount += 1;
    if (observationType === "negative" || observationType === "near_miss") negativeObservationCount += 1;
    const highRisk =
      ["high", "critical"].includes(String(action.severity ?? "").toLowerCase()) ||
      String(action.priority ?? "").toLowerCase() === "high" ||
      ["stop_work", "escalated"].includes(String(action.status ?? "").toLowerCase());
    if (highRisk) {
      const key = action.jobsite_id ?? "unassigned";
      highRiskLocationCounts.set(key, (highRiskLocationCounts.get(key) ?? 0) + 1);
    }
    if (action.closed_at && action.created_at) {
      const createdAt = new Date(action.created_at).getTime();
      const closedAt = new Date(action.closed_at).getTime();
      const hours = Math.max(0, (closedAt - createdAt) / (1000 * 60 * 60));
      closureHours.push(hours);
      const closureKey = action.jobsite_id ?? "unassigned";
      const current = closureByJobsite.get(closureKey) ?? { totalHours: 0, count: 0 };
      current.totalHours += hours;
      current.count += 1;
      closureByJobsite.set(closureKey, current);
    }
    const jobsiteKey = action.jobsite_id ?? "unassigned";
    const existing = jobsiteRisk.get(jobsiteKey) ?? { incidents: 0, sif: 0, stopWork: 0, overdue: 0 };
    if (
      action.status !== "verified_closed" &&
      action.due_at &&
      new Date(action.due_at).getTime() < Date.now()
    ) {
      existing.overdue += 1;
    }
    jobsiteRisk.set(jobsiteKey, existing);
  }
  for (const incident of incidents) {
    const category = (incident.category ?? "incident").toLowerCase();
    hazardCounts.set(category, (hazardCounts.get(category) ?? 0) + 1);
    const jobsiteKey = incident.jobsite_id ?? "unassigned";
    const existing = jobsiteRisk.get(jobsiteKey) ?? { incidents: 0, sif: 0, stopWork: 0, overdue: 0 };
    existing.incidents += 1;
    if (incident.sif_flag) existing.sif += 1;
    if (incident.sif_flag) {
      const day = String(incident.created_at ?? "").slice(0, 10);
      if (day) sifTrendByDay.set(day, (sifTrendByDay.get(day) ?? 0) + 1);
    }
    jobsiteRisk.set(jobsiteKey, existing);
  }
  for (const activity of activities) {
    const category = (activity.hazard_category ?? "planned_activity").toLowerCase();
    hazardCounts.set(category, (hazardCounts.get(category) ?? 0) + 1);
  }
  for (const permit of permits) {
    const jobsiteKey = permit.jobsite_id ?? "unassigned";
    const existing = jobsiteRisk.get(jobsiteKey) ?? { incidents: 0, sif: 0, stopWork: 0, overdue: 0 };
    if (permit.stop_work_status === "stop_work_active") existing.stopWork += 1;
    if (permit.sif_flag) existing.sif += 1;
    jobsiteRisk.set(jobsiteKey, existing);
  }

  const topHazardCategories = Array.from(hazardCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count }));
  const observationTrends = Array.from(actionsByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
  const avgClosureHours =
    closureHours.length > 0
      ? Number((closureHours.reduce((sum, value) => sum + value, 0) / closureHours.length).toFixed(2))
      : 0;
  const jobsiteRiskScore = Array.from(jobsiteRisk.entries())
    .map(([jobsiteId, row]) => ({
      jobsiteId,
      score: row.incidents * 2 + row.sif * 5 + row.stopWork * 4 + row.overdue * 3,
      ...row,
    }))
    .sort((a, b) => b.score - a.score);
  const sifTrends = Array.from(sifTrendByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
  const sifDashboard = {
    potentialCount: actions.filter((item) => Boolean(item.sif_potential)).length,
    byCategory: Array.from(sifCategoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count })),
  };
  const toWeekLabel = (isoDate: string) => {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((date.getTime() - first.getTime()) / 86400000) + 1;
    const week = Math.ceil(dayOfYear / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  };
  const weeklyObservations = new Map<string, number>();
  for (const item of observationTrends) {
    const week = toWeekLabel(item.date);
    weeklyObservations.set(week, (weeklyObservations.get(week) ?? 0) + item.count);
  }
  const today = new Date().toISOString().slice(0, 10);
  const todayActivities = activities.filter((item) => String(item.work_date ?? "").slice(0, 10) === today);
  const completedToday = todayActivities.filter((item) => String(item.status ?? "").toLowerCase() === "completed").length;
  const activeJobsitesCount = jobsites.filter((j) => {
    const value = String(j.status ?? "").trim().toLowerCase();
    return value !== "archived" && value !== "completed" && value !== "inactive";
  }).length;
  const openIncidents = incidents.filter((item) => String(item.status ?? "").toLowerCase() !== "closed").length;
  const openObservations = actions.filter((item) => String(item.status ?? "").toLowerCase() !== "verified_closed").length;
  const highRiskObservations = actions.filter((item) => {
    const severity = String(item.severity ?? "").toLowerCase();
    const priority = String(item.priority ?? "").toLowerCase();
    return severity === "high" || severity === "critical" || priority === "high";
  }).length;

  const payload = {
    snapshots: result.data ?? [],
    summary: {
      totals: {
        correctiveActions: actions.length,
        incidents: incidents.length,
        permits: permits.length,
        daps: daps.length,
        dapActivities: activities.length,
      },
      closureTimes: {
        averageHours: avgClosureHours,
        sampleSize: closureHours.length,
      },
      topHazardCategories,
      observationTrends,
      sifTrends,
      sifDashboard,
      jobsiteRiskScore,
      companyDashboard: {
        totalActiveJobsites: activeJobsitesCount,
        totalOpenObservations: openObservations,
        totalHighRiskObservations: highRiskObservations,
        sifCount: sifDashboard.potentialCount,
        averageClosureTimeHours: avgClosureHours,
        topHazardCategories,
        openIncidents,
        dapCompletionToday: {
          completed: completedToday,
          total: todayActivities.length,
          percent:
            todayActivities.length > 0
              ? Number(((completedToday / todayActivities.length) * 100).toFixed(1))
              : 0,
        },
      },
      safetyLeadership: {
        trendOfObservationsByWeek: Array.from(weeklyObservations.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([week, count]) => ({ week, count })),
        repeatHazardCategories: topHazardCategories.filter((item) => item.count > 1),
        highRiskLocations: Array.from(highRiskLocationCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([jobsiteId, count]) => ({ jobsiteId, count })),
        sifByCategory: sifDashboard.byCategory,
        closurePerformanceByJobsite: Array.from(closureByJobsite.entries())
          .map(([jobsiteId, data]) => ({
            jobsiteId,
            averageHours: data.count > 0 ? Number((data.totalHours / data.count).toFixed(2)) : 0,
            sampleSize: data.count,
          }))
          .sort((a, b) => a.averageHours - b.averageHours),
        positiveNegativeObservationRatio: {
          positive: positiveObservationCount,
          negative: negativeObservationCount,
          ratio:
            negativeObservationCount > 0
              ? Number((positiveObservationCount / negativeObservationCount).toFixed(2))
              : positiveObservationCount > 0
                ? positiveObservationCount
                : 0,
        },
      },
    },
  };
  setCachedAnalyticsPayload(cacheKey, payload);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      "X-Analytics-Cache": "miss",
    },
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can create analytics snapshots." }, { status: 403 });
  }
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team });
  if (!companyScope.companyId) return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const snapshotDate = String(body?.snapshotDate ?? "").trim() || new Date().toISOString().slice(0, 10);
  const jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
  const metrics = typeof body?.metrics === "object" && body?.metrics !== null ? body.metrics : {};
  const result = await auth.supabase
    .from("company_analytics_snapshots")
    .upsert(
      {
        company_id: companyScope.companyId,
        jobsite_id: jobsiteId,
        snapshot_date: snapshotDate,
        metrics,
        created_by: auth.user.id,
      },
      { onConflict: "company_id,jobsite_id,snapshot_date" }
    )
    .select("id,company_id,jobsite_id,snapshot_date,metrics,created_at,created_by")
    .single();
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to upsert analytics snapshot." }, { status: 500 });
  }
  invalidateCompanyAnalyticsCache(companyScope.companyId);
  return NextResponse.json({ success: true, snapshot: result.data });
}

export async function PATCH(request: Request) {
  return POST(request);
}
