import type {
  InjuryWeatherDashboardData,
  RiskLevel,
  TradeForecast,
  TrendPoint,
} from "@/lib/injuryWeather/types";
import {
  buildLeadershipTrustMetadata,
  coverageStatus,
  type LeadershipTrustMetadata,
} from "@/lib/leadershipTrust";
import {
  calculateBehaviorRisk,
  type BehaviorRiskCorrectiveActionRow,
  type BehaviorRiskIncidentRow,
  type BehaviorRiskJsaActivityRow,
  type BehaviorRiskObservationRow,
  type BehaviorRiskPermitRow,
  type BehaviorRiskResult,
  type BehaviorRiskTrainingGapRow,
} from "@/lib/predictive/behaviorRisk";

export type PredictiveRiskSourceCounts = {
  correctiveActions: number;
  incidents: number;
  permits: number;
  jsaActivities: number;
};

export type PredictiveRiskLocation = {
  id: string;
  label: string;
  subtitle: string | null;
  riskScore: number;
  trendDelta: number;
  topDriver: string;
  sourceCounts: PredictiveRiskSourceCounts;
};

export type PredictiveRiskDriver = {
  id: string;
  label: string;
  percent: number;
  count: number;
};

export type PredictiveRiskTrendPoint = {
  label: string;
  riskScore: number;
};

export type PredictiveRiskAction = {
  id: string;
  title: string;
  target: string;
  impact: "High impact" | "Medium impact" | "Monitor";
  href: string | null;
  evidence?: string;
  sourceModule?: string;
  confidencePercent?: number;
};

export type PredictiveRiskPayload = {
  filters: {
    days: number;
    jobsiteId: string | null;
    month: string | null;
  };
  summary: {
    highRiskLocationCount: number;
    predictedIncidents: number;
    averageRiskScore: number;
    confidencePercent: number;
    riskSignalCount: number;
  };
  locations: PredictiveRiskLocation[];
  drivers: PredictiveRiskDriver[];
  trend: PredictiveRiskTrendPoint[];
  actions: PredictiveRiskAction[];
  model: {
    version: string;
    generatedAt: string;
    confidenceLabel: "High" | "Medium" | "Low";
    provenanceNote: string;
  };
  behaviorRisk: BehaviorRiskResult;
  leadershipTrust: LeadershipTrustMetadata;
  warning?: string;
};

export type PredictiveRiskJobsiteRow = {
  id: string;
  name?: string | null;
  location?: string | null;
  status?: string | null;
};

export type PredictiveRiskCorrectiveActionRow = BehaviorRiskCorrectiveActionRow & {
  id?: string | null;
  title?: string | null;
  category?: string | null;
  severity?: string | null;
  priority?: string | null;
  status?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  jobsite_id?: string | null;
  sif_potential?: boolean | null;
};

export type PredictiveRiskIncidentRow = BehaviorRiskIncidentRow & {
  id?: string | null;
  title?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  created_at?: string | null;
  jobsite_id?: string | null;
  sif_flag?: boolean | null;
  escalation_level?: string | null;
};

export type PredictiveRiskPermitRow = BehaviorRiskPermitRow & {
  id?: string | null;
  title?: string | null;
  permit_type?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  created_at?: string | null;
  jobsite_id?: string | null;
  sif_flag?: boolean | null;
  stop_work_status?: string | null;
  escalation_level?: string | null;
};

export type PredictiveRiskJsaActivityRow = BehaviorRiskJsaActivityRow & {
  id?: string | null;
  hazard_category?: string | null;
  status?: string | null;
  created_at?: string | null;
  jobsite_id?: string | null;
};

type LocationAccumulator = {
  id: string;
  label: string;
  subtitle: string | null;
  rawScore: number;
  recentScore: number;
  priorScore: number;
  sourceCounts: PredictiveRiskSourceCounts;
  driverCounts: Map<string, number>;
};

type RiskRow = {
  jobsiteId: string | null;
  label: string;
  createdAt: string | null;
  category: string | null;
  severity: string | null;
  kind: keyof PredictiveRiskSourceCounts;
  title: string | null;
  extraWeight?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeDays(days: number) {
  return Math.max(1, Math.min(365, Number.isFinite(days) ? Math.floor(days) : 30));
}

function normalizeLabel(raw: string | null | undefined, fallback: string) {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function severityWeight(raw: string | null | undefined) {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("critical")) return 24;
  if (s.includes("high") || s.includes("urgent")) return 18;
  if (s.includes("medium") || s.includes("moderate")) return 11;
  if (s.includes("low")) return 5;
  return 8;
}

function isOpenStatus(raw: string | null | undefined) {
  const s = String(raw ?? "").toLowerCase();
  return !["closed", "verified_closed", "complete", "completed", "resolved", "cancelled"].includes(s);
}

function overdueWeight(dueAt: string | null | undefined) {
  if (!dueAt) return 0;
  const t = new Date(dueAt).getTime();
  return !Number.isNaN(t) && t < Date.now() ? 8 : 0;
}

function impactForScore(score: number): PredictiveRiskAction["impact"] {
  if (score >= 75) return "High impact";
  if (score >= 45) return "Medium impact";
  return "Monitor";
}

function confidenceLabel(percent: number): PredictiveRiskPayload["model"]["confidenceLabel"] {
  if (percent >= 75) return "High";
  if (percent >= 45) return "Medium";
  return "Low";
}

function sourceCountKey(kind: RiskRow["kind"]) {
  return kind;
}

function rowRiskWeight(row: RiskRow) {
  return severityWeight(row.severity) + (row.extraWeight ?? 0);
}

function scoreToDisplay(raw: number) {
  return clamp(Math.round(raw), 0, 100);
}

function trendDelta(recent: number, prior: number) {
  return clamp(Math.round((recent - prior) / 3), -25, 25);
}

function jobsiteLabelMap(jobsites: PredictiveRiskJobsiteRow[]) {
  const out = new Map<string, { label: string; subtitle: string | null }>();
  for (const site of jobsites) {
    out.set(site.id, {
      label: normalizeLabel(site.name, "Unnamed jobsite"),
      subtitle: site.location?.trim() || null,
    });
  }
  return out;
}

function rowToAccumulatorKey(row: RiskRow) {
  return row.jobsiteId || "unassigned";
}

function buildRiskRows(input: {
  correctiveActions: PredictiveRiskCorrectiveActionRow[];
  incidents: PredictiveRiskIncidentRow[];
  permits: PredictiveRiskPermitRow[];
  jsaActivities: PredictiveRiskJsaActivityRow[];
}): RiskRow[] {
  return [
    ...input.correctiveActions.map((row): RiskRow => ({
      jobsiteId: row.jobsite_id ?? null,
      label: row.title ?? row.category ?? "Corrective action",
      createdAt: row.created_at ?? null,
      category: row.category ?? row.title ?? null,
      severity: row.severity ?? row.priority ?? null,
      kind: "correctiveActions",
      title: row.title ?? null,
      extraWeight: (row.sif_potential ? 14 : 0) + (isOpenStatus(row.status) ? 4 : 0) + overdueWeight(row.due_at),
    })),
    ...input.incidents.map((row): RiskRow => ({
      jobsiteId: row.jobsite_id ?? null,
      label: row.title ?? row.category ?? "Incident",
      createdAt: row.created_at ?? null,
      category: row.category ?? row.title ?? null,
      severity: row.severity ?? row.escalation_level ?? null,
      kind: "incidents",
      title: row.title ?? null,
      extraWeight: (row.sif_flag ? 16 : 0) + (isOpenStatus(row.status) ? 5 : 0),
    })),
    ...input.permits.map((row): RiskRow => ({
      jobsiteId: row.jobsite_id ?? null,
      label: row.title ?? row.permit_type ?? row.category ?? "Permit",
      createdAt: row.created_at ?? null,
      category: row.permit_type ?? row.category ?? row.title ?? null,
      severity: row.severity ?? row.escalation_level ?? null,
      kind: "permits",
      title: row.title ?? null,
      extraWeight:
        (row.sif_flag ? 12 : 0) +
        (String(row.stop_work_status ?? "").toLowerCase().includes("stop_work") ? 18 : 0) +
        (isOpenStatus(row.status) ? 4 : 0),
    })),
    ...input.jsaActivities.map((row): RiskRow => ({
      jobsiteId: row.jobsite_id ?? null,
      label: row.hazard_category ?? "JSA activity",
      createdAt: row.created_at ?? null,
      category: row.hazard_category ?? null,
      severity: row.status ?? null,
      kind: "jsaActivities",
      title: row.hazard_category ?? null,
      extraWeight: isOpenStatus(row.status) ? 4 : 0,
    })),
  ];
}

function buildLocationAccumulators(params: {
  rows: RiskRow[];
  jobsites: PredictiveRiskJobsiteRow[];
  days: number;
}) {
  const labels = jobsiteLabelMap(params.jobsites);
  const split = Date.now() - Math.max(1, Math.floor(params.days / 2)) * 86400000;
  const acc = new Map<string, LocationAccumulator>();

  for (const row of params.rows) {
    const id = rowToAccumulatorKey(row);
    const meta = row.jobsiteId ? labels.get(row.jobsiteId) : null;
    const existing =
      acc.get(id) ??
      ({
        id,
        label: meta?.label ?? "Unassigned location",
        subtitle: meta?.subtitle ?? null,
        rawScore: 0,
        recentScore: 0,
        priorScore: 0,
        sourceCounts: { correctiveActions: 0, incidents: 0, permits: 0, jsaActivities: 0 },
        driverCounts: new Map<string, number>(),
      } satisfies LocationAccumulator);

    const weight = rowRiskWeight(row);
    existing.rawScore += weight;
    existing.sourceCounts[sourceCountKey(row.kind)] += 1;

    const driver = normalizeLabel(row.category, "General Risk");
    existing.driverCounts.set(driver, (existing.driverCounts.get(driver) ?? 0) + 1);

    const t = row.createdAt ? new Date(row.createdAt).getTime() : Number.NaN;
    if (!Number.isNaN(t) && t >= split) existing.recentScore += weight;
    else existing.priorScore += weight;

    acc.set(id, existing);
  }

  for (const site of params.jobsites) {
    if (acc.has(site.id)) continue;
    const meta = labels.get(site.id);
    acc.set(site.id, {
      id: site.id,
      label: meta?.label ?? "Unnamed jobsite",
      subtitle: meta?.subtitle ?? null,
      rawScore: 0,
      recentScore: 0,
      priorScore: 0,
      sourceCounts: { correctiveActions: 0, incidents: 0, permits: 0, jsaActivities: 0 },
      driverCounts: new Map(),
    });
  }

  return [...acc.values()];
}

function topDriverFromAccumulator(acc: LocationAccumulator) {
  const top = [...acc.driverCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? "No active driver";
}

function buildLocations(accumulators: LocationAccumulator[]) {
  return accumulators
    .map((acc): PredictiveRiskLocation => ({
      id: acc.id,
      label: acc.label,
      subtitle: acc.subtitle,
      riskScore: scoreToDisplay(acc.rawScore),
      trendDelta: trendDelta(acc.recentScore, acc.priorScore),
      topDriver: topDriverFromAccumulator(acc),
      sourceCounts: acc.sourceCounts,
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);
}

function buildDrivers(rows: RiskRow[], tradeForecasts: TradeForecast[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = normalizeLabel(row.category, "General Risk");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  if (counts.size === 0) {
    for (const forecast of tradeForecasts.slice(0, 4)) {
      for (const category of forecast.categories.slice(0, 3)) {
        const label = normalizeLabel(category.name, "General Risk");
        counts.set(label, (counts.get(label) ?? 0) + Math.max(1, category.predictedCount));
      }
    }
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "driver",
      label,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      count,
    }));
}

function buildTrend(points: TrendPoint[], fallbackScore: number): PredictiveRiskTrendPoint[] {
  const source = points.length > 0 ? points.slice(-8) : [{ month: "Current", value: fallbackScore }];
  return source.map((point) => ({
    label: point.month,
    riskScore: scoreToDisplay(point.value),
  }));
}

function buildActions(params: {
  locations: PredictiveRiskLocation[];
  drivers: PredictiveRiskDriver[];
  recommendedControls: string[];
}) {
  const actions: PredictiveRiskAction[] = [];
  const topDriver = params.drivers[0]?.label ?? "active risk";
  for (const location of params.locations.filter((row) => row.riskScore > 0).slice(0, 3)) {
    actions.push({
      id: `location-${location.id}`,
      title: `Address ${location.topDriver === "No active driver" ? topDriver : location.topDriver}`,
      target: location.label,
      impact: impactForScore(location.riskScore),
      href: location.id === "unassigned" ? "/analytics" : `/jobsites/${location.id}/overview`,
    });
  }

  for (const [idx, control] of params.recommendedControls.slice(0, 3).entries()) {
    if (actions.length >= 5) break;
    actions.push({
      id: `control-${idx}`,
      title: control,
      target: params.locations[0]?.label ?? "Company wide",
      impact: idx === 0 ? "High impact" : "Medium impact",
      href: "/analytics",
    });
  }

  if (actions.length === 0 && params.drivers.length > 0) {
    actions.push({
      id: "driver-focus",
      title: `Review ${params.drivers[0]!.label} controls`,
      target: "Company wide",
      impact: "Monitor",
      href: "/analytics",
    });
  }

  return actions;
}

function confidencePercent(data: InjuryWeatherDashboardData) {
  const score = data.summary.forecastConfidenceScore;
  if (Number.isFinite(score)) return clamp(Math.round(score * 100), 0, 100);
  const integrity = data.forecastIntegrity?.forecastConfidencePct;
  if (Number.isFinite(integrity)) return clamp(Math.round(Number(integrity)), 0, 100);
  return 0;
}

function provenanceNote(data: InjuryWeatherDashboardData, rowCount: number) {
  const provenance = data.signalProvenance;
  const base =
    provenance?.recordWindowLabel ??
    (data.summary.forecastMode === "baseline_only" ? "Baseline model with sparse live signal data." : "Live adjusted model.");
  if (rowCount === 0) {
    return `${base} No jobsite-aware records were found in the selected customer window.`;
  }
  return `${base} Location rankings use jobsite-aware records in the selected customer window.`;
}

export function buildPredictiveRiskPayload(input: {
  projectId?: string | null;
  days: number;
  jobsiteId?: string | null;
  month?: string | null;
  forecast: InjuryWeatherDashboardData;
  jobsites: PredictiveRiskJobsiteRow[];
  correctiveActions: PredictiveRiskCorrectiveActionRow[];
  incidents: PredictiveRiskIncidentRow[];
  permits: PredictiveRiskPermitRow[];
  jsaActivities: PredictiveRiskJsaActivityRow[];
  observations?: BehaviorRiskObservationRow[];
  trainingGaps?: BehaviorRiskTrainingGapRow[];
  warning?: string;
}): PredictiveRiskPayload {
  const days = normalizeDays(input.days);
  const rows = buildRiskRows(input);
  const behaviorRisk = calculateBehaviorRisk({
    projectId: input.projectId ?? null,
    lookAheadDays: Math.min(days, 30),
    jsaActivities: input.jsaActivities,
    permits: input.permits,
    correctiveActions: input.correctiveActions,
    incidents: input.incidents,
    observations: input.observations ?? [],
    trainingGaps: input.trainingGaps ?? [],
  });
  const accumulators = buildLocationAccumulators({
    rows,
    jobsites: input.jobsites,
    days,
  });
  const locations = buildLocations(accumulators);
  const drivers = buildDrivers(rows, input.forecast.tradeForecasts);
  const fallbackScore = input.forecast.summary.structuralRiskScore ?? input.forecast.summary.overallRiskScore ?? 0;
  const trend = buildTrend(input.forecast.trend, fallbackScore);
  const actions = buildActions({
    locations,
    drivers,
    recommendedControls: input.forecast.recommendedControls,
  }).map((action): PredictiveRiskAction => ({
    ...action,
    evidence:
      action.href === "/permits"
        ? "Linked to permit and stop-work activity in the selected window."
        : "Linked to jobsite risk, driver concentration, and recommended control signals in the selected window.",
    sourceModule: action.href === "/permits" ? "company_permits" : "predictive_risk",
    confidencePercent: confidencePercent(input.forecast),
  }));
  const confidence = confidencePercent(input.forecast);
  const positiveLocations = locations.filter((row) => row.riskScore > 0);
  const averageRiskScore =
    positiveLocations.length > 0
      ? Math.round(positiveLocations.reduce((sum, row) => sum + row.riskScore, 0) / positiveLocations.length)
      : scoreToDisplay(fallbackScore);

  const sourceCoverage = [
    {
      key: "correctives",
      label: "Correctives",
      count: input.correctiveActions.length,
      href: "/field-id-exchange",
      status: coverageStatus(input.correctiveActions.length),
    },
    {
      key: "incidents",
      label: "Incidents",
      count: input.incidents.length,
      href: "/incidents",
      status: coverageStatus(input.incidents.length),
    },
    {
      key: "permits",
      label: "Permits",
      count: input.permits.length,
      href: "/permits",
      status: coverageStatus(input.permits.length),
    },
    {
      key: "jsaActivities",
      label: "JSA activities",
      count: input.jsaActivities.length,
      href: "/jsa",
      status: coverageStatus(input.jsaActivities.length),
    },
    {
      key: "jobsites",
      label: "Jobsites",
      count: input.jobsites.length,
      href: "/jobsites",
      status: coverageStatus(input.jobsites.length),
    },
  ] as const;
  const topLocation = locations.find((location) => location.riskScore > 0);
  const leadershipTrust = buildLeadershipTrustMetadata({
    lastUpdatedAt: input.forecast.summary.lastUpdatedAt,
    dateWindowLabel: `${days} day predictive window`,
    sourceCoverage: [...sourceCoverage],
    missingSignals: [
      ...(input.jobsites.length === 0 ? ["No active jobsite roster was available for this predictive model view."] : []),
      ...(rows.length === 0 ? ["No jobsite-aware risk records were available in this window."] : []),
      ...(input.forecast.summary.forecastMode === "baseline_only"
        ? ["Forecast is currently baseline-only because live signal volume is sparse."]
        : []),
    ],
    evidenceRefs: [
      ...(topLocation
        ? [
            {
              id: `predictive-location-${topLocation.id}`,
              label: topLocation.label,
              href: topLocation.id === "unassigned" ? "/analytics?tab=risk" : `/jobsites/${topLocation.id}/analytics`,
              sourceModule: "predictive_risk_location",
              sourceId: topLocation.id,
              detail: `${topLocation.riskScore} risk score, top driver ${topLocation.topDriver}`,
            },
          ]
        : []),
      ...drivers.slice(0, 2).map((driver) => ({
        id: `driver-${driver.id}`,
        label: driver.label,
        href: "/analytics?tab=risk",
        sourceModule: "predictive_risk_driver",
        sourceId: driver.id,
        detail: `${driver.count} signal${driver.count === 1 ? "" : "s"}`,
      })),
    ],
    nextActions: actions.slice(0, 3).map((action) => ({
      id: action.id,
      label: action.title,
      href: action.href ?? "/analytics?tab=risk",
      priority: action.impact === "High impact" ? "high" : action.impact === "Medium impact" ? "medium" : "low",
      detail: `${action.target}. ${action.evidence}`,
    })),
    confidencePercent: confidence,
    executiveSummary:
      positiveLocations.length > 0
        ? `${positiveLocations.length} location${positiveLocations.length === 1 ? "" : "s"} carry predictive risk signals; use the ranked actions before work starts.`
        : "Predictive model has limited live signals in this window; use the view as a readiness check, not a risk claim.",
    provenanceNote: provenanceNote(input.forecast, rows.length),
  });

  return {
    filters: {
      days,
      jobsiteId: input.jobsiteId?.trim() || null,
      month: input.month?.trim() || null,
    },
    summary: {
      highRiskLocationCount: locations.filter((row) => row.riskScore >= 70).length,
      predictedIncidents: Math.max(0, Math.round(input.forecast.summary.predictedInjuriesNextMonth)),
      averageRiskScore,
      confidencePercent: confidence,
      riskSignalCount: rows.length || input.forecast.summary.riskSignalCount,
    },
    locations,
    drivers,
    trend,
    actions,
    model: {
      version: input.forecast.summary.riskModelVersion,
      generatedAt: input.forecast.summary.lastUpdatedAt,
      confidenceLabel: confidenceLabel(confidence),
      provenanceNote: provenanceNote(input.forecast, rows.length),
    },
    behaviorRisk,
    leadershipTrust,
    ...(input.warning ? { warning: input.warning } : {}),
  };
}

function demoForecast(days: number): InjuryWeatherDashboardData {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const trend: TrendPoint[] = [25, 28, 35, 34, 56, 67, 79, 50].map((value, idx) => ({
    month: new Date(now.getTime() - (7 - idx) * Math.max(1, Math.floor(days / 8)) * 86400000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value,
    highRisk: value >= 60,
  }));
  return {
    summary: {
      month,
      riskSignalCount: 24,
      highSeveritySignalCount: 8,
      predictedInjuriesNextMonth: 12,
      increasedIncidentRiskPercent: 68,
      overallRiskLevel: "HIGH" as RiskLevel,
      structuralRiskScore: 68,
      riskModelVersion: "IW-v2.customer-demo",
      overallRiskScore: 68,
      predictedRisk: 68,
      predictedRiskFactors: {
        historicalBaseline: 1,
        seasonalFactor: 1,
        realTimeBehaviorFactor: 1,
        scheduleExposureFactor: 1,
        siteConditionFactor: 1,
        weatherFactor: 1,
      },
      dataConfidence: "HIGH",
      forecastMode: "live_adjusted",
      forecastConfidenceScore: 0.85,
      lastUpdatedAt: new Date().toISOString(),
      likelyInjuryInsight: {
        headline: "Fall-related injury risk is elevated.",
        secondaryLine: "Fall protection and housekeeping are driving the current signal.",
        detailNote: "Demo data combines observations, permits, incidents, and corrective actions.",
        hasData: true,
      },
    },
    tradeForecasts: [
      {
        trade: "General Contractor",
        categories: [
          { name: "Fall protection", predictedCount: 7, riskLevel: "HIGH" },
          { name: "Housekeeping", predictedCount: 5, riskLevel: "HIGH" },
          { name: "Walkways / trip hazards", predictedCount: 4, riskLevel: "MODERATE" },
        ],
      },
    ],
    alerts: [],
    trend,
    recommendedControls: [
      "Verify fall protection gaps before elevated work resumes.",
      "Improve housekeeping in material staging areas.",
      "Confirm machine guarding and spotter controls before shift start.",
    ],
    monthlyTrainingRecommendations: [],
    availableMonths: [month],
    availableTrades: ["General Contractor"],
    location: {
      stateCode: "TX",
      displayName: "Texas",
      weatherRiskMultiplier: 1,
      impactNote: "Demo location factor.",
      tradeWeatherWeight: 1,
      combinedWeatherFactor: 1,
    },
    signalProvenance: {
      mode: "live",
      sorRecords: 6,
      correctiveActions: 10,
      incidents: 3,
      recordWindowLabel: `Demo customer window: ${days} days`,
      alertsAreIllustrative: true,
    },
    behaviorSignals: {
      fatigueIndicators: 0,
      rushingIndicators: 0,
      newWorkerRatio: 0,
      overtimeHours: 0,
    },
    workSchedule: {
      workSevenDaysPerWeek: false,
      hoursPerDay: null,
    },
    industryBenchmarkContext: {
      injuryFactsIndustryProfilesUrl: "",
      injuryFactsIncidentTrendsUrl: "",
      dominantNaicsPrefix: "236",
      exampleIndustryCode: "236220",
      recordableCasesPer200kHours: 2.4,
      benchmarkSummary: "Demo benchmark context.",
      oshaNationalConstruction: undefined as never,
    },
    monthlyFocus: [],
    engineDiagnostics: { seedOnlyMode: false, liveSignalRowCount: 24 },
  };
}

function emptyForecast(): InjuryWeatherDashboardData {
  const generatedAt = new Date().toISOString();
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  return {
    summary: {
      month,
      riskSignalCount: 0,
      highSeveritySignalCount: 0,
      predictedInjuriesNextMonth: 0,
      increasedIncidentRiskPercent: 0,
      overallRiskLevel: "LOW",
      structuralRiskScore: 0,
      riskModelVersion: "IW-v2",
      overallRiskScore: 0,
      predictedRisk: 0,
      predictedRiskFactors: {
        historicalBaseline: 0,
        seasonalFactor: 1,
        realTimeBehaviorFactor: 1,
        scheduleExposureFactor: 1,
        siteConditionFactor: 1,
        weatherFactor: 1,
      },
      dataConfidence: "LOW",
      forecastMode: "baseline_only",
      forecastConfidenceScore: 0,
      lastUpdatedAt: generatedAt,
      likelyInjuryInsight: {
        headline: "No injury risk signal is available yet.",
        secondaryLine: null,
        detailNote: "Connect company safety data to populate predictive risk signals.",
        hasData: false,
      },
    },
    tradeForecasts: [],
    alerts: [],
    trend: [],
    recommendedControls: [],
    monthlyTrainingRecommendations: [],
    availableMonths: [month],
    availableTrades: [],
    location: {
      stateCode: null,
      displayName: "Company workspace",
      weatherRiskMultiplier: 1,
      impactNote: "No location factor available.",
      tradeWeatherWeight: 1,
      combinedWeatherFactor: 1,
    },
    signalProvenance: {
      mode: "live",
      sorRecords: 0,
      correctiveActions: 0,
      incidents: 0,
      recordWindowLabel: "No company workspace signals available.",
      alertsAreIllustrative: true,
    },
    behaviorSignals: {
      fatigueIndicators: 0,
      rushingIndicators: 0,
      newWorkerRatio: 0,
      overtimeHours: 0,
    },
    workSchedule: {
      workSevenDaysPerWeek: false,
      hoursPerDay: null,
    },
    industryBenchmarkContext: {
      injuryFactsIndustryProfilesUrl: "",
      injuryFactsIncidentTrendsUrl: "",
      dominantNaicsPrefix: null,
      exampleIndustryCode: null,
      recordableCasesPer200kHours: null,
      benchmarkSummary: "No benchmark context available.",
      oshaNationalConstruction: undefined as never,
    },
    monthlyFocus: [],
    engineDiagnostics: { seedOnlyMode: false, liveSignalRowCount: 0 },
  };
}

export function buildEmptyPredictiveRiskPayload(days: number, warning?: string): PredictiveRiskPayload {
  return buildPredictiveRiskPayload({
    days,
    forecast: emptyForecast(),
    jobsites: [],
    correctiveActions: [],
    incidents: [],
    permits: [],
    jsaActivities: [],
    warning,
  });
}

export function buildSalesDemoPredictiveRiskPayload(days: number): PredictiveRiskPayload {
  const normalizedDays = normalizeDays(days);
  return buildPredictiveRiskPayload({
    days: normalizedDays,
    forecast: demoForecast(normalizedDays),
    jobsites: [
      { id: "demo-jobsite-1", name: "North Tower", location: "Austin, TX", status: "active" },
      { id: "demo-jobsite-2", name: "Warehouse Retrofit", location: "Round Rock, TX", status: "active" },
      { id: "demo-jobsite-3", name: "South Clinic Buildout", location: "San Marcos, TX", status: "planned" },
    ],
    correctiveActions: [
      {
        id: "demo-action-1",
        title: "Guardrail gap at level 4 stairwell",
        category: "fall_protection",
        severity: "high",
        status: "open",
        due_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        jobsite_id: "demo-jobsite-1",
        sif_potential: true,
      },
      {
        id: "demo-action-2",
        title: "Clear material staging aisle",
        category: "housekeeping",
        severity: "medium",
        status: "in_progress",
        created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        jobsite_id: "demo-jobsite-2",
      },
    ],
    incidents: [
      {
        id: "demo-incident-1",
        title: "Near miss: forklift aisle conflict",
        category: "walkways_trip_hazards",
        severity: "medium",
        status: "open",
        created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        jobsite_id: "demo-jobsite-2",
      },
      {
        id: "demo-incident-2",
        title: "Recordable hand laceration",
        category: "machine_guarding",
        severity: "high",
        status: "in_progress",
        created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
        jobsite_id: "demo-jobsite-1",
        sif_flag: true,
      },
    ],
    permits: [
      {
        id: "demo-permit-1",
        title: "Hot work permit",
        permit_type: "hot_work",
        severity: "high",
        status: "active",
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        jobsite_id: "demo-jobsite-1",
        sif_flag: true,
        stop_work_status: "stop_work_requested",
      },
    ],
    jsaActivities: [
      {
        id: "demo-jsa-activity-1",
        hazard_category: "fall_protection",
        activity_name: "Leading edge deck work",
        trade: "Steel",
        area: "North tower level 4",
        crew_size: 9,
        mitigation: "Use PPE and watch your surroundings.",
        permit_required: true,
        permit_type: "Hot Work Permit",
        planned_risk_level: "high",
        work_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        status: "planned",
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        jobsite_id: "demo-jobsite-1",
        supervisor_name: "Supervisor A",
      },
      {
        id: "demo-jsa-activity-2",
        hazard_category: "electrical",
        activity_name: "Temporary power tie-in",
        trade: "Electrical",
        area: "North tower level 4",
        crew_size: 4,
        mitigation: "Supervisor verifies LOTO, tester confirmation, and barricade before start.",
        planned_risk_level: "high",
        work_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        status: "planned",
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        jobsite_id: "demo-jobsite-1",
        supervisor_name: "Supervisor B",
      },
    ],
    observations: [
      {
        id: "demo-sor-1",
        hazard_category_code: "housekeeping",
        location: "North tower level 4",
        created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        severity: "medium",
        status: "submitted",
      },
      {
        id: "demo-sor-2",
        hazard_category_code: "housekeeping",
        location: "North tower level 4",
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        severity: "medium",
        status: "submitted",
      },
    ],
  });
}
