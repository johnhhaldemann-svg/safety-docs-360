import { NextResponse } from "next/server";
import { incidentRatePer200kHours } from "@/lib/benchmarking/incidentRate";
import { injurySeverityScore } from "@/lib/incidents/injurySeverityScore";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { isForecasterSyntheticIncident } from "@/lib/injuryWeather/excludeForecasterIncidents";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { loadCompanyRiskScoreTrend, summarizeTrendDelta } from "@/lib/riskMemory/scoresRepo";
import { buildSalesDemoAnalyticsSummaryResponse } from "@/lib/demoWorkspace";
import { INJURY_TYPE_LABELS } from "@/lib/incidents/injuryType";
import {
  buildLeadershipTrustMetadata,
  coverageStatus,
  explainRecommendation,
  type ExplainableRecommendation,
  type LeadershipEvidenceRef,
  type LeadershipNextAction,
} from "@/lib/leadershipTrust";

export const runtime = "nodejs";

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_analytics_snapshots");
}

function isMissingJsaRelationError(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_daps") || lower.includes("company_jsas") || lower.includes("schema cache");
}

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager";
}

function parseRecommendationEvidenceRefs(value: unknown): LeadershipEvidenceRef[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const refs = (value as { evidenceRefs?: unknown }).evidenceRefs;
  if (!Array.isArray(refs)) return [];
  const out: LeadershipEvidenceRef[] = [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") continue;
    const item = ref as Record<string, unknown>;
    const id = String(item.id ?? "").trim();
    const label = String(item.label ?? "").trim();
    if (!id || !label) continue;
    out.push({
      id,
      label,
      href: typeof item.href === "string" && item.href ? item.href : "/analytics/predictive-model",
      sourceModule: String(item.sourceModule ?? item.source_module ?? "predictive_risk"),
      sourceId: typeof item.sourceId === "string" ? item.sourceId : typeof item.source_id === "string" ? item.source_id : null,
      detail: typeof item.detail === "string" ? item.detail : undefined,
    });
  }
  return out;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_analytics",
      "can_view_all_company_data",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const selectedInjuryType = String(searchParams.get("injuryType") ?? "").trim().toLowerCase();
  if (auth.role === "sales_demo") {
    const demo = buildSalesDemoAnalyticsSummaryResponse(days) as {
      summary?: { healthIssueRollup?: Array<{ injuryType: string }>; healthIssueFocus?: { injuryType: string } | null };
    };
    if (demo.summary) {
      demo.summary.healthIssueFocus =
        selectedInjuryType && demo.summary.healthIssueFocus?.injuryType === selectedInjuryType
          ? demo.summary.healthIssueFocus
          : null;
    }
    return NextResponse.json(demo);
  }
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team, authUser: auth.user });
  if (!companyScope.companyId) {
    return NextResponse.json({
      snapshots: [],
      warning:
        "Company analytics are not available because no company workspace is linked to this account yet.",
    });
  }
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const companyBenchmarkRes = await auth.supabase
    .from("companies")
    .select("industry_code, industry_injury_rate, trade_injury_rate, hours_worked")
    .eq("id", companyScope.companyId)
    .maybeSingle();
  const companyBenchmarkRow =
    !companyBenchmarkRes.error && companyBenchmarkRes.data
      ? (companyBenchmarkRes.data as {
          industry_code?: string | null;
          industry_injury_rate?: number | null;
          trade_injury_rate?: number | null;
          hours_worked?: number | null;
        })
      : null;
  const hoursWorked = companyBenchmarkRow?.hours_worked ?? null;
  const result = await auth.supabase
    .from("company_analytics_snapshots")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: false });
  if (result.error) {
    if (isMissingTable(result.error.message)) {
      return NextResponse.json({ snapshots: [], warning: "Analytics snapshot tables are not available yet. Run latest migrations." }, { status: 500 });
    }
    return NextResponse.json({ error: result.error.message || "Failed to load analytics summary." }, { status: 500 });
  }
  const [actionsRes, incidentsRes, permitsRes, jsasRes, jsaActivitiesRes, jobsitesRes, sorRes] = await Promise.all([
    auth.supabase
      .from("company_corrective_actions")
      .select(
        "id, title, category, status, severity, priority, observation_type, created_at, closed_at, due_at, jobsite_id, sif_potential, sif_category"
      )
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_incidents")
      .select(
        "id, title, description, category, status, severity, sif_flag, escalation_level, created_at, jobsite_id, recordable, injury_type, body_part"
      )
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_permits")
      .select("id, status, stop_work_status, sif_flag, escalation_level, created_at, jobsite_id")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_jsas")
      .select("id, status, created_at, jobsite_id")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_jsa_activities")
      .select("id, jsa_id, status, hazard_category, created_at, work_date, jobsite_id")
      .eq("company_id", companyScope.companyId)
      .gte("created_at", since),
    auth.supabase
      .from("company_jobsites")
      .select("id, status")
      .eq("company_id", companyScope.companyId),
    auth.supabase
      .from("company_sor_records")
      .select("id, date, project, location, category, hazard_category_code, subcategory, description, severity, created_at, status")
      .eq("company_id", companyScope.companyId)
      .eq("is_deleted", false)
      .neq("status", "superseded")
      .gte("date", since),
  ]);
  const jsasMissing = jsasRes.error && isMissingJsaRelationError(jsasRes.error.message);
  const jsaActivitiesMissing = jsaActivitiesRes.error && isMissingJsaRelationError(jsaActivitiesRes.error.message);

  if (actionsRes.error) return NextResponse.json({ error: actionsRes.error.message || "Failed to load corrective actions." }, { status: 500 });
  if (incidentsRes.error) return NextResponse.json({ error: incidentsRes.error.message || "Failed to load incidents." }, { status: 500 });
  if (permitsRes.error) return NextResponse.json({ error: permitsRes.error.message || "Failed to load permits." }, { status: 500 });
  if (jsasRes.error && !jsasMissing) return NextResponse.json({ error: jsasRes.error.message || "Failed to load JSAs." }, { status: 500 });
  if (jsaActivitiesRes.error && !jsaActivitiesMissing) return NextResponse.json({ error: jsaActivitiesRes.error.message || "Failed to load JSA activities." }, { status: 500 });
  if (jobsitesRes.error) return NextResponse.json({ error: jobsitesRes.error.message || "Failed to load jobsites." }, { status: 500 });
  if (sorRes.error) return NextResponse.json({ error: sorRes.error.message || "Failed to load SOR records." }, { status: 500 });

  const actions = actionsRes.data ?? [];
  const incidents = (incidentsRes.data ?? []).filter((row) => {
    const r = row as { title?: string | null; description?: string | null };
    return !isForecasterSyntheticIncident(r.title, r.description);
  });
  const permits = permitsRes.data ?? [];
  const jsas = jsasMissing ? [] : (jsasRes.data ?? []);
  const activities = jsaActivitiesMissing ? [] : (jsaActivitiesRes.data ?? []);
  const jobsites = jobsitesRes.data ?? [];
  const sorRows = sorRes.data ?? [];

  const incidentsForRate = incidents.filter((row) => {
    if (String(row.category ?? "").toLowerCase() !== "incident") return false;
    if ((row as { recordable?: boolean | null }).recordable === false) return false;
    return true;
  }).length;
  const benchmarking = {
    industryCode: companyBenchmarkRow?.industry_code ?? null,
    industryInjuryRate: companyBenchmarkRow?.industry_injury_rate ?? null,
    tradeInjuryRate: companyBenchmarkRow?.trade_injury_rate ?? null,
    hoursWorked,
    incidentsForRate,
    incidentRate: incidentRatePer200kHours(incidentsForRate, hoursWorked),
  };

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
  let sorNearMissCount = 0;
  let sorHazardCount = 0;
  let sorOtherCount = 0;
  function sorObservationKind(row: (typeof sorRows)[0]) {
    const text = `${row.category ?? ""} ${row.subcategory ?? ""}`.toLowerCase();
    if (text.includes("positive")) return "positive" as const;
    if (text.includes("near_miss") || text.includes("near miss")) return "near_miss" as const;
    if (text.includes("other") && !row.hazard_category_code) return "other" as const;
    return "hazard" as const;
  }
  function sorReportTag(row: (typeof sorRows)[0]) {
    const kind = sorObservationKind(row);
    if (kind === "positive") return "POSITIVE" as const;
    if (kind === "near_miss") return "NEAR MISS" as const;
    if (kind === "hazard") return "HAZARD" as const;
    return "SOR" as const;
  }
  function sorDay(row: (typeof sorRows)[0]) {
    return String(row.date ?? row.created_at ?? "").slice(0, 10);
  }
  function sorCategoryKey(row: (typeof sorRows)[0]) {
    return String(row.hazard_category_code ?? row.category ?? "sor").trim().toLowerCase() || "sor";
  }
  function sorTitle(row: (typeof sorRows)[0]) {
    const description = String(row.description ?? "").trim();
    if (description) return description.length > 90 ? `${description.slice(0, 87)}...` : description;
    return String(row.category ?? "").trim() || "Untitled SOR";
  }
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
  for (const sor of sorRows) {
    const category = sorCategoryKey(sor);
    hazardCounts.set(category, (hazardCounts.get(category) ?? 0) + 1);
    const day = sorDay(sor);
    if (day) actionsByDay.set(day, (actionsByDay.get(day) ?? 0) + 1);
    const kind = sorObservationKind(sor);
    if (kind === "positive") {
      positiveObservationCount += 1;
    } else if (kind === "near_miss") {
      sorNearMissCount += 1;
      negativeObservationCount += 1;
    } else if (kind === "hazard") {
      sorHazardCount += 1;
      negativeObservationCount += 1;
    } else {
      sorOtherCount += 1;
    }
    if (["high", "critical"].includes(String(sor.severity ?? "").toLowerCase())) {
      const key = String(sor.location ?? sor.project ?? "unassigned").trim() || "unassigned";
      highRiskLocationCounts.set(key, (highRiskLocationCounts.get(key) ?? 0) + 1);
    }
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
  const openCorrectiveActions = actions.filter((item) => String(item.status ?? "").toLowerCase() !== "verified_closed").length;
  const openSorObservations = sorRows.filter((item) => !["locked", "superseded"].includes(String(item.status ?? "").toLowerCase())).length;
  const openObservations = openCorrectiveActions + openSorObservations;
  const highRiskCorrectiveActions = actions.filter((item) => {
    const severity = String(item.severity ?? "").toLowerCase();
    const priority = String(item.priority ?? "").toLowerCase();
    return severity === "high" || severity === "critical" || priority === "high";
  }).length;
  const highRiskSorObservations = sorRows.filter((item) =>
    ["high", "critical"].includes(String(item.severity ?? "").toLowerCase())
  ).length;
  const highRiskObservations = highRiskCorrectiveActions + highRiskSorObservations;

  function observationReportTag(row: (typeof actions)[0]) {
    const ot = String(row.observation_type ?? "").toLowerCase();
    if (ot === "positive") return "POSITIVE" as const;
    if (ot === "near_miss") return "NEAR MISS" as const;
    if (ot === "hazard" || ot === "negative") return "HAZARD" as const;
    return "OBSERVATION" as const;
  }

  const recentActionReports = actions.map((row) => ({
    id: row.id,
    title: String(row.title ?? "").trim() || "Untitled observation",
    tag: observationReportTag(row),
    sortAt: new Date(String(row.created_at ?? 0)).getTime(),
  }));
  const recentSorReports = sorRows.map((row) => ({
    id: row.id,
    title: sorTitle(row),
    tag: sorReportTag(row),
    sortAt: new Date(String(row.created_at ?? row.date ?? 0)).getTime(),
  }));
  const recentReports = [...recentActionReports, ...recentSorReports]
    .sort((a, b) => {
      return b.sortAt - a.sortAt;
    })
    .slice(0, 6)
    .map((row) => ({
      id: row.id,
      title: row.title,
      tag: row.tag,
    }));

  const observationBreakdown = {
    nearMiss: actions.filter((a) => String(a.observation_type ?? "").toLowerCase() === "near_miss").length + sorNearMissCount,
    hazard:
      actions.filter((a) =>
        ["hazard", "negative"].includes(String(a.observation_type ?? "").toLowerCase())
      ).length + sorHazardCount,
    positive: positiveObservationCount,
    other: actions.filter((a) => {
      const ot = String(a.observation_type ?? "").toLowerCase();
      return !["near_miss", "hazard", "negative", "positive"].includes(ot);
    }).length + sorOtherCount,
    inspections: permits.length + activities.length,
    daps: jsas.length,
  };

  const injuryIncidentsInWindow = incidents.filter(
    (row) => String(row.category ?? "").toLowerCase() === "incident"
  ).length;
  const sorCount = sorRows.length;
  const sorToInjuryRatio = sorCount > 0 ? injuryIncidentsInWindow / sorCount : null;
  const leadingSignals = observationBreakdown.nearMiss + observationBreakdown.hazard;
  const observationToInjuryConversionRate =
    leadingSignals + injuryIncidentsInWindow > 0
      ? injuryIncidentsInWindow / (leadingSignals + injuryIncidentsInWindow)
      : null;
  let severitySum = 0;
  let severityN = 0;
  for (const row of incidents) {
    if (String(row.category ?? "").toLowerCase() !== "incident") continue;
    const r = row as {
      days_away_from_work?: number | null;
      days_restricted?: number | null;
      lost_time?: boolean | null;
      fatality?: boolean | null;
    };
    severitySum += injurySeverityScore({
      daysAwayFromWork: Number(r.days_away_from_work ?? 0),
      daysRestricted: Number(r.days_restricted ?? 0),
      lostTime: Boolean(r.lost_time),
      fatality: Boolean(r.fatality),
    });
    severityN += 1;
  }
  const injuryAnalytics = {
    averageSeverityScore: severityN > 0 ? Number((severitySum / severityN).toFixed(2)) : 0,
    severitySampleSize: severityN,
    sorToInjuryRatio: sorToInjuryRatio != null ? Number(sorToInjuryRatio.toFixed(4)) : null,
    sorCount,
    injuryIncidentCount: injuryIncidentsInWindow,
    observationToInjuryConversionRate:
      observationToInjuryConversionRate != null
        ? Number((observationToInjuryConversionRate * 100).toFixed(2))
        : null,
    injuryPredictionModelUrl: "/api/company/injury-analytics/model",
  };

  const injuryRows = incidents.filter((row) => String(row.category ?? "").toLowerCase() === "incident");
  const healthIssueMap = new Map<string, number>();
  for (const row of injuryRows) {
    const key = String((row as { injury_type?: string | null }).injury_type ?? "").trim().toLowerCase() || "unspecified";
    healthIssueMap.set(key, (healthIssueMap.get(key) ?? 0) + 1);
  }
  const healthIssueRollup = Array.from(healthIssueMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([injuryType, count]) => ({
      injuryType,
      label: injuryType === "unspecified" ? "Unspecified" : (INJURY_TYPE_LABELS as Record<string, string>)[injuryType] ?? injuryType,
      count,
    }));

  const focusType = selectedInjuryType || null;
  const focusRows = focusType
    ? injuryRows.filter((row) => {
        const key = String((row as { injury_type?: string | null }).injury_type ?? "").trim().toLowerCase() || "unspecified";
        return key === focusType;
      })
    : [];
  const healthIssueFocus = focusType
    ? {
        injuryType: focusType,
        label: focusType === "unspecified" ? "Unspecified" : (INJURY_TYPE_LABELS as Record<string, string>)[focusType] ?? focusType,
        count: focusRows.length,
        severityBands: {
          critical: focusRows.filter((row) => String(row.severity ?? "").toLowerCase() === "critical").length,
          high: focusRows.filter((row) => String(row.severity ?? "").toLowerCase() === "high").length,
          medium: focusRows.filter((row) => ["medium", "moderate"].includes(String(row.severity ?? "").toLowerCase())).length,
          low: focusRows.filter((row) => String(row.severity ?? "").toLowerCase() === "low").length,
          unspecified: focusRows.filter((row) => !String(row.severity ?? "").trim()).length,
        },
        recentItems: focusRows
          .slice()
          .sort((a, b) => new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime())
          .slice(0, 8)
          .map((row) => ({
            id: row.id,
            title: String(row.title ?? "").trim() || "Untitled incident",
            severity: row.severity ?? null,
            created_at: row.created_at ?? null,
          })),
      }
    : null;

  function severityRowIndex(severity: string | null | undefined) {
    const v = String(severity ?? "").toLowerCase();
    if (v === "critical") return 0;
    if (v === "high") return 1;
    if (v === "medium" || v === "moderate") return 2;
    if (v === "low") return 3;
    return 2;
  }
  function priorityColIndex(priority: string | null | undefined) {
    const v = String(priority ?? "").toLowerCase();
    if (v === "high") return 0;
    if (v === "medium") return 1;
    if (v === "low") return 2;
    return 3;
  }
  const heatRows = ["Critical", "High", "Moderate", "Low"] as const;
  const heatCols = ["High", "Moderate", "Low", "—"] as const;
  const riskHeatmapCells = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (const a of actions) {
    const r = severityRowIndex(a.severity);
    const c = priorityColIndex(a.priority);
    riskHeatmapCells[r][c] += 1;
  }
  for (const sor of sorRows) {
    const r = severityRowIndex(sor.severity);
    riskHeatmapCells[r][3] += 1;
  }
  const heatMax = Math.max(1, ...riskHeatmapCells.flat());

  const observationPriorityBands = {
    high: highRiskObservations,
    medium:
      actions.filter((item) => {
        const s = String(item.severity ?? "").toLowerCase();
        return s === "medium" || s === "moderate";
      }).length +
      sorRows.filter((item) => {
        const s = String(item.severity ?? "").toLowerCase();
        return s === "medium" || s === "moderate";
      }).length,
    low:
      actions.filter((item) => String(item.severity ?? "").toLowerCase() === "low").length +
      sorRows.filter((item) => String(item.severity ?? "").toLowerCase() === "low").length,
  };

  const [riskMemoryRollup, riskRecRes, riskScoreTrendPoints] = await Promise.all([
    buildRiskMemoryStructuredContext(auth.supabase, companyScope.companyId, {
      days: Math.max(1, days),
    }),
    auth.supabase
      .from("company_risk_ai_recommendations")
      .select("id, kind, title, body, confidence, created_at, status, priority, owner_user_id, due_at, target_module, target_href, evidence_summary, accepted_at, field_used_at, resolved_at, dismissed_at")
      .eq("company_id", companyScope.companyId)
      .neq("status", "dismissed")
      .neq("status", "resolved")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(8),
    loadCompanyRiskScoreTrend({
      supabase: auth.supabase,
      companyId: companyScope.companyId,
      days: 30,
    }),
  ]);
  const riskScoreTrendSummary = summarizeTrendDelta(riskScoreTrendPoints);
  const riskMemoryTrend = {
    points: riskScoreTrendPoints.map((point) => ({
      date: point.scoreDate,
      score: point.score,
      band: point.band,
      windowDays: point.windowDays,
    })),
    latest: riskScoreTrendSummary.latest
      ? { date: riskScoreTrendSummary.latest.scoreDate, score: riskScoreTrendSummary.latest.score, band: riskScoreTrendSummary.latest.band }
      : null,
    earliest: riskScoreTrendSummary.earliest
      ? { date: riskScoreTrendSummary.earliest.scoreDate, score: riskScoreTrendSummary.earliest.score, band: riskScoreTrendSummary.earliest.band }
      : null,
    deltaScore: riskScoreTrendSummary.deltaScore,
    direction: riskScoreTrendSummary.direction,
  };

  let riskMemoryRecommendations: ExplainableRecommendation[] = [];
  if (!riskRecRes.error) {
    riskMemoryRecommendations = (riskRecRes.data ?? [])
      .filter((rec) => {
        const priority = String(rec.priority ?? "medium");
        return priority === "critical" || priority === "high" || priority === "medium";
      })
      .map((rec) =>
        explainRecommendation({
        id: rec.id,
        kind: rec.kind,
        title: rec.title,
        body: rec.body,
        confidence: rec.confidence,
        created_at: rec.created_at,
        actionHref: rec.target_href ?? "/analytics/predictive-model",
        status: rec.status ?? "active",
        priority: rec.priority ?? "medium",
        ownerUserId: rec.owner_user_id ?? null,
        dueAt: rec.due_at ?? null,
        sourceModule: rec.target_module ?? "risk_memory",
        evidenceRefs: parseRecommendationEvidenceRefs(rec.evidence_summary),
        acceptedAt: rec.accepted_at ?? null,
        fieldUsedAt: rec.field_used_at ?? null,
        resolvedAt: rec.resolved_at ?? null,
        dismissedAt: rec.dismissed_at ?? null,
      })
      );
  }
  const leadershipSourceCoverage = [
    {
      key: "observations",
      label: "Observations",
      count: actions.length + sorRows.length,
      href: "/field-id-exchange",
      status: coverageStatus(actions.length + sorRows.length),
    },
    {
      key: "incidents",
      label: "Incidents",
      count: incidents.length,
      href: "/incidents",
      status: coverageStatus(incidents.length),
    },
    {
      key: "permits",
      label: "Permits",
      count: permits.length,
      href: "/permits",
      status: coverageStatus(permits.length),
    },
    {
      key: "jsas",
      label: "JSAs",
      count: jsas.length + activities.length,
      href: "/jsa",
      status: coverageStatus(jsas.length + activities.length),
    },
    {
      key: "riskMemory",
      label: "Risk Memory",
      count: riskMemoryRollup?.facetCount ?? 0,
      href: "/analytics?tab=risk",
      status: coverageStatus(riskMemoryRollup?.facetCount ?? 0),
    },
    {
      key: "jobsites",
      label: "Jobsites",
      count: activeJobsitesCount,
      href: "/jobsites",
      status: coverageStatus(activeJobsitesCount),
    },
  ];
  const leadershipNextActions: LeadershipNextAction[] = [
    highRiskObservations > 0
      ? {
          id: "review-high-risk-observations",
          label: "Review high-risk observations",
          href: "/field-id-exchange",
          priority: "high",
          detail: `${highRiskObservations} high-risk observation${highRiskObservations === 1 ? "" : "s"} are in this analytics window.`,
        }
      : null,
    openIncidents > 0
      ? {
          id: "review-open-incidents",
          label: "Review open incidents",
          href: "/incidents",
          priority: "high",
          detail: `${openIncidents} incident${openIncidents === 1 ? "" : "s"} remain open.`,
        }
      : null,
    riskMemoryRecommendations.length > 0
      ? {
          id: "assign-risk-recommendations",
          label: "Assign risk recommendations",
          href: "/analytics?tab=risk",
          priority: "medium",
          detail: `${riskMemoryRecommendations.length} recommendation${riskMemoryRecommendations.length === 1 ? "" : "s"} are ready for leadership triage.`,
        }
      : null,
    permits.length > 0
      ? {
          id: "verify-permit-controls",
          label: "Verify permit controls",
          href: "/permits",
          priority: "low",
          detail: `${permits.length} permit${permits.length === 1 ? "" : "s"} contribute to this analytics window.`,
        }
      : null,
  ].filter((action): action is LeadershipNextAction => action !== null).slice(0, 3);
  const leadershipTrust = buildLeadershipTrustMetadata({
    dateWindowLabel: `Last ${Math.max(1, days)} days`,
    sourceCoverage: leadershipSourceCoverage,
    missingSignals: [
      ...(jsasMissing || jsaActivitiesMissing ? ["JSA tables are not available, so JSA coverage is partial."] : []),
      ...(riskRecRes.error ? ["Stored risk recommendations could not be loaded for this response."] : []),
      ...(riskMemoryRollup?.facetCount ? [] : ["Risk Memory facets are not populated for this window."]),
    ],
    evidenceRefs: [
      ...recentReports.slice(0, 3).map((row) => ({
        id: `recent-${row.id}`,
        label: row.title,
        href: "/field-id-exchange",
        sourceModule: row.tag === "SOR" ? "company_sor_records" : "company_corrective_actions",
        sourceId: row.id,
      })),
      ...topHazardCategories.slice(0, 2).map((hazard) => ({
        id: `hazard-${hazard.category}`,
        label: hazard.category.replace(/_/g, " "),
        href: "/analytics?tab=risk",
        sourceModule: "analytics_hazard_rollup",
        detail: `${hazard.count} signal${hazard.count === 1 ? "" : "s"}`,
      })),
    ],
    nextActions: leadershipNextActions,
    executiveSummary:
      highRiskObservations > 0 || openIncidents > 0
        ? "Leadership should treat this analytics window as active risk: high-risk observations or open incidents need review."
        : "Leadership analytics show no acute high-risk observation or open incident pressure in this window.",
    provenanceNote:
      "Derived from company-scoped observations, SOR records, incidents, permits, JSAs, jobsites, Risk Memory, and recommendation tables.",
  });

  return NextResponse.json({
    snapshots: result.data ?? [],
    summary: {
      totals: {
        correctiveActions: actions.length + sorRows.length,
        incidents: incidents.length,
        permits: permits.length,
        daps: jsas.length,
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
        observationPriorityBands,
        dapCompletionToday: {
          completed: completedToday,
          total: todayActivities.length,
          percent:
            todayActivities.length > 0
              ? Number(((completedToday / todayActivities.length) * 100).toFixed(1))
              : 0,
        },
      },
      recentReports,
      observationBreakdown,
      riskHeatmap: {
        rowLabels: [...heatRows],
        colLabels: [...heatCols],
        cells: riskHeatmapCells,
        max: heatMax,
      },
      benchmarking,
      injuryAnalytics,
      healthIssueRollup,
      healthIssueFocus,
      riskMemory: riskMemoryRollup,
      riskMemoryTrend,
      riskMemoryRecommendations,
      leadershipTrust,
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
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (auth.role === "sales_demo") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const snapshotDate = String(body?.snapshotDate ?? "").trim() || new Date().toISOString().slice(0, 10);
    const jobsiteId = String(body?.jobsiteId ?? "").trim() || null;
    const metrics = typeof body?.metrics === "object" && body?.metrics !== null ? body.metrics : {};
    return NextResponse.json({
      success: true,
      snapshot: {
        id: "demo-analytics-snapshot-1",
        company_id: "demo-company",
        jobsite_id: jobsiteId,
        snapshot_date: snapshotDate,
        metrics,
        created_by: auth.user.id,
      },
    });
  }
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only company admins and managers can create analytics snapshots." }, { status: 403 });
  }
  const companyScope = await getCompanyScope({ supabase: auth.supabase, userId: auth.user.id, fallbackTeam: auth.team, authUser: auth.user });
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
    .select("*")
    .single();
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to upsert analytics snapshot." }, { status: 500 });
  }
  return NextResponse.json({ success: true, snapshot: result.data });
}

export async function PATCH(request: Request) {
  return POST(request);
}
