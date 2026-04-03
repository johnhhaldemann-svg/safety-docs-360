import { getIndustryBenchmarkRates } from "@/lib/benchmarking/industryBenchmarkDataset";
import type {
  BehaviorSignals,
  InjuryWeatherIndustryBenchmarkContext,
  InjuryWeatherLocation,
  NormalizedLiveSignalRow,
  RiskEngineV2Explainability,
  WorkScheduleInputs,
} from "@/lib/injuryWeather/types";
import type { ForecastInput, ForecastRunContext } from "./types";

const MS_DAY = 86400000;

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / MS_DAY);
}

function rowDate(r: NormalizedLiveSignalRow): Date | null {
  const d = new Date(r.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Count signals in rolling windows ending `asOf` for trend layer.
 */
export function signalRatesByWindow(rows: NormalizedLiveSignalRow[], asOf: Date): {
  recent30DaySignalRate: number;
  prior90DaySignalRate: number;
} {
  let r30 = 0;
  let p90 = 0;
  for (const r of rows) {
    const d = rowDate(r);
    if (!d) continue;
    const age = daysBetween(d, asOf);
    if (age <= 30) r30 += 1;
    if (age > 30 && age <= 120) p90 += 1;
  }
  return {
    recent30DaySignalRate: r30 / 30,
    prior90DaySignalRate: p90 / 90,
  };
}

function industryRateFromContext(ctx: InjuryWeatherIndustryBenchmarkContext): number {
  const code = ctx.exampleIndustryCode ?? "236000";
  const rates = getIndustryBenchmarkRates(code);
  const per200k = rates.recordableCasesPer200kHours ?? 2.5;
  // Dimensionless prior scaled to sit in baseline layer (tunable via engine constants).
  return Math.min(0.06, Math.max(0.004, (per200k / 100) * 0.014));
}

function monthIndexFromLabel(label: string): number {
  const d = new Date(label);
  return Number.isNaN(d.getTime()) ? 0 : d.getMonth();
}

function weatherIndicesFromLocation(loc: InjuryWeatherLocation): ForecastInput["weather"] {
  const f = loc.combinedWeatherFactor ?? loc.weatherRiskMultiplier ?? 1;
  const stress = Math.min(1, Math.max(0, (f - 1) / 0.12));
  return {
    rainIndex: stress * 0.55,
    windIndex: stress * 0.45,
    heatStressIndex: stress * 0.5,
    coldStressIndex: stress * 0.25,
    lowVisibilityIndex: stress * 0.2,
    slipSurfaceIndex: stress * 0.5,
    seasonFactor: stress * 0.4,
    assumed: { rainIndex: true, windIndex: true, heatStressIndex: true, coldStressIndex: true, lowVisibilityIndex: true, slipSurfaceIndex: true, seasonFactor: true },
  };
}

function buildTextBlob(rows: NormalizedLiveSignalRow[]): string {
  return rows.map((r) => `${r.categoryLabel} ${r.tradeLabel}`).join(" | ");
}

/**
 * Maps current Injury Weather live payload into `ForecastInput` for the dynamic engine.
 * Many fields are **proxies or defaults** until dedicated ETL columns exist (see gap list in docs / PR summary).
 */
export function buildForecastInputFromLegacyContext(args: {
  rows: NormalizedLiveSignalRow[];
  explainability: RiskEngineV2Explainability | null | undefined;
  location: InjuryWeatherLocation;
  industryBenchmarkContext: InjuryWeatherIndustryBenchmarkContext;
  monthLabel: string;
  workforceTotal?: number;
  hoursWorked?: number;
  behaviorSignals?: Partial<BehaviorSignals>;
  workSchedule?: WorkScheduleInputs;
  asOf?: Date;
}): ForecastInput {
  const asOf = args.asOf ?? new Date();
  const rows = args.rows;
  const hours = args.hoursWorked && args.hoursWorked > 0 ? args.hoursWorked : 0;
  const head = args.workforceTotal && args.workforceTotal > 0 ? args.workforceTotal : 0;
  /** Inferred hours from row count alone used to be tiny (~rows×40), which forced benchmark-only λ; use a small-job month floor. */
  const totalLaborHours = hours > 0 ? hours : head > 0 ? head * 40 * 4 : Math.max(1800, rows.length * 52);
  const activeHeadcount = head > 0 ? head : hours > 0 ? Math.max(1, Math.round(hours / 160)) : Math.max(1, Math.ceil(rows.length / 8));

  const highRiskRows = rows.filter((r) => r.severity === "high" || r.severity === "critical");
  const highRiskTaskCount = Math.max(highRiskRows.length, Math.round(rows.length * 0.15));
  const simultaneousTrades = new Set(rows.map((r) => r.tradeLabel)).size || 1;
  const equipHay = rows.filter((r) => /crane|fork|lift|rigg|hoist|aerial/i.test(r.categoryLabel)).length;
  const equipmentOperationsCount = Math.max(equipHay, Math.ceil(simultaneousTrades / 2));

  const sorCount = rows.filter((r) => r.source === "sor").length;
  const capa = rows.filter((r) => r.source === "corrective_action");
  const correctiveOpenCount = capa.filter((r) => r.status !== "closed").length;
  const correctiveOverdueCount = 0;
  const nearMissCount = rows.filter((r) => /near\s*miss|close\s*call/i.test(r.categoryLabel)).length;
  const failedInspectionCount = rows.filter((r) => /fail|unsat|deficient/i.test(r.categoryLabel) && /inspect/i.test(r.categoryLabel)).length;
  const permitFailureCount = rows.filter((r) => /permit/i.test(r.categoryLabel) && /denied|revoked|expired/i.test(r.categoryLabel)).length;
  const hk = rows.filter((r) => /housekeeping|walkway|clutter|5s/i.test(r.categoryLabel)).length;
  const housekeepingDeficiencyRate = Math.min(1, hk / Math.max(8, rows.length));

  const sev = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const r of rows) sev[r.severity] += 1;

  const ex = args.explainability;
  const incidentCount = rows.filter((r) => r.source === "incident").length;
  const inferredMissingSeverity = rows.length > 0 ? 0.08 : 0.25;
  const inferredTradeMap = rows.filter((r) => r.usedCategoryInference).length / Math.max(1, rows.length);

  const schedule = args.workSchedule ?? { workSevenDaysPerWeek: false, hoursPerDay: null };
  const hpd = schedule.hoursPerDay ?? 8;
  const days = schedule.workSevenDaysPerWeek ? 7 : 5;
  const avgWeeklyHours = hpd * days;
  const behavior = args.behaviorSignals ?? {};
  const overtimeHeavy = (behavior.overtimeHours ?? 0) > 12;

  const rates = signalRatesByWindow(rows, asOf);

  const controlMetrics = [
    { id: "training", label: "Training completion", value: 0.82, assumed: true },
    { id: "permits", label: "Permit compliance", value: 0.78, assumed: true },
    { id: "ppe", label: "PPE compliance (field proxy)", value: 0.8, assumed: true },
    { id: "jsa", label: "JSA completion", value: 0.74, assumed: true },
    { id: "housekeeping", label: "Housekeeping pass rate", value: Math.max(0.35, 1 - housekeepingDeficiencyRate), assumed: true },
  ];

  return {
    baseline: {
      company: { incidentCount, hoursWorked: totalLaborHours, headcount: activeHeadcount },
      industryBenchmarkRate: industryRateFromContext(args.industryBenchmarkContext),
      tradeBenchmark: null,
      stateBenchmark: args.location.stateCode
        ? { stateCode: args.location.stateCode, rateIndex: Math.min(1.15, args.location.weatherRiskMultiplier), note: args.location.impactNote }
        : null,
      monthlyBenchmark: { monthIndex0: monthIndexFromLabel(args.monthLabel), rateIndex: 1 },
    },
    exposure: {
      totalLaborHours,
      activeHeadcount,
      highRiskTaskCount,
      simultaneousTrades,
      equipmentOperationsCount,
      assumed:
        hours <= 0 && head <= 0
          ? { totalLaborHours: true, activeHeadcount: true, highRiskTaskCount: true, equipmentOperationsCount: true }
          : { equipmentOperationsCount: equipHay === 0 },
    },
    leadingIndicators: {
      sorCount,
      nearMissCount,
      correctiveOpenCount,
      correctiveOverdueCount,
      failedInspectionCount,
      permitFailureCount,
      jsaQualityScore: 0.72,
      housekeepingDeficiencyRate,
      severityCounts: sev,
      totalHoursForNormalization: totalLaborHours,
      assumed: {
        nearMiss: nearMissCount === 0,
        inspections: failedInspectionCount === 0,
        permits: permitFailureCount === 0,
        overdue: correctiveOpenCount > 0,
      },
    },
    controls: { metrics: controlMetrics },
    trend: {
      recent30DaySignalRate: rates.recent30DaySignalRate || (ex?.recentTrendSlope ?? 0) * 0.01 + 0.02,
      prior90DaySignalRate: Math.max(0.01, rates.prior90DaySignalRate || 0.02),
    },
    fatigue: {
      avgShiftHours: hpd,
      avgWeeklyHours,
      consecutiveDaysWorked: schedule.workSevenDaysPerWeek ? 7 : 5,
      nightShift: false,
      overtimeHeavy,
      assumed: { nightShift: true },
    },
    weather: weatherIndicesFromLocation(args.location),
    uncertainty: {
      completeness: rows.length >= 20 ? 0.82 : rows.length >= 8 ? 0.65 : 0.45,
      missingTradeMappingRate: inferredTradeMap,
      lateEntryRate: 0.12,
      missingSeverityRate: inferredMissingSeverity,
      missingCloseoutRate: capa.length ? correctiveOpenCount / Math.max(1, capa.length) : 0.2,
      staleDataRate: rows.length ? 0.08 : 0.35,
      assumed: { lateEntry: true, staleData: true },
    },
  };
}

export function buildInjuryTypeContextFromLegacy(rows: NormalizedLiveSignalRow[], location: InjuryWeatherLocation) {
  return {
    textBlob: buildTextBlob(rows),
    heatOutdoorExposure: Math.min(1, (location.combinedWeatherFactor ?? location.weatherRiskMultiplier ?? 1) - 0.95),
  };
}

/**
 * Volume / recency / trade context for forecast mode (`FULL_DATA` | `PARTIAL_DATA` | `BENCHMARK_FALLBACK`).
 */
export function buildForecastRunContextFromLegacy(args: {
  rows: NormalizedLiveSignalRow[];
  location: InjuryWeatherLocation;
  monthLabel: string;
  workforceTotal?: number;
  hoursWorked?: number;
  asOf?: Date;
}): ForecastRunContext {
  const asOf = args.asOf ?? new Date();
  const rows = args.rows;
  const hours = args.hoursWorked && args.hoursWorked > 0 ? args.hoursWorked : 0;
  const head = args.workforceTotal && args.workforceTotal > 0 ? args.workforceTotal : 0;
  const laborHours =
    hours > 0 ? hours : head > 0 ? head * 40 * 4 : rows.length > 0 ? Math.max(1800, rows.length * 52) : 0;

  const sorCount = rows.filter((r) => r.source === "sor").length;
  const capaRows = rows.filter((r) => r.source === "corrective_action");
  const correctiveActionCount = capaRows.length;
  const incidentCount = rows.filter((r) => r.source === "incident").length;

  const monthKeys = new Set<string>();
  const ages: number[] = [];
  for (const r of rows) {
    const d = rowDate(r);
    if (!d) continue;
    monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    ages.push(daysBetween(d, asOf));
  }
  const distinctMonthsOfHistory = monthKeys.size;
  const dataRecencyScore01 =
    ages.length > 0 ? ages.reduce((s, a) => s + Math.exp(-a / 70), 0) / ages.length : 0;

  const inspectionProxyCount = rows.filter((r) => /inspect|audit|inspection/i.test(r.categoryLabel)).length;

  const tradeCounts = new Map<string, number>();
  for (const r of rows) {
    const tl = r.tradeLabel?.trim() || "Unknown";
    tradeCounts.set(tl, (tradeCounts.get(tl) ?? 0) + 1);
  }
  const dominantTradeLabels = [...tradeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 5);

  const completeness01 =
    rows.length >= 20 ? 0.82 : rows.length >= 8 ? 0.65 : rows.length > 0 ? 0.48 : 0.25;

  const stateRateIndex = args.location.stateCode
    ? Math.min(1.15, args.location.weatherRiskMultiplier)
    : null;

  return {
    signalRowCount: rows.length,
    incidentCount,
    sorCount,
    correctiveActionCount,
    laborHours,
    distinctMonthsOfHistory,
    inspectionProxyCount,
    completeness01,
    dataRecencyScore01,
    dominantTradeLabels,
    monthIndex0: monthIndexFromLabel(args.monthLabel),
    projectPhase: null,
    highRiskTaskTags: [],
    stateRateIndex,
  };
}
