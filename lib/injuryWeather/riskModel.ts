/**
 * Injury Weather — leading-indicator risk engine
 * ---------------------------------------------
 * This module holds the quantitative model. It is intentionally separate from DB I/O (`service.ts`).
 *
 * ROLE (assumption, not validated until backtests show calibration):
 *   We treat outputs as a **leading-indicator risk model** built from safety signals (SOR, actions,
 *   incidents), not as a certified injury forecast. Correlation with future `company_incidents` is
 *   tracked separately; until then, constants below are **tunable placeholders**.
 *
 * SEPARATION OF CONCERNS:
 *   1. `structuralRiskScore` / `finalRiskScore` (0–100):
 *      `baseRisk × trendPressure × momentumBoost × behavioralAdjustment` (calendar/behavior via
 *      `behavioralLikelihoodAdjustmentFromMonthLabel`). **No weather** in this score.
 *   1b. `predictedRisk` (dimensionless index): `historicalBaseline × seasonal × realTimeBehavior × scheduleExposure × site × weather`
 *      (`computePredictedRiskProduct`) — parallel headline for calibration; not identical to (1).
 *   2. `incidentLikelihoodIndexPct`: illustrative “next ~30 day” likelihood index derived from
 *      structural score × trade/site weather exposure. **Not** the same unit as (1).
 *   3. `projectedCaseEstimate`: rough case-load style count for prioritization; uses (2) × exposure
 *      constants × optional trend step-up. **Not** equated with structural score.
 *   4. Trade/category **allocation** uses signal shares × weather weights for display only.
 */

import { getTradeWeatherWeight } from "@/lib/injuryWeather/locationWeather";
import type {
  BehaviorSignals,
  PredictedRiskFactors,
  RiskLevel,
  TradeForecast,
  TrendPoint,
  WorkScheduleInputs,
} from "@/lib/injuryWeather/types";

// ---------------------------------------------------------------------------
// CONFIGURABLE CONSTANTS — tune here; keep version in sync when changing material weights
// ---------------------------------------------------------------------------

export const INJURY_WEATHER_MODEL = {
  /** Bump when blend weights or likelihood mapping change materially. */
  VERSION: "2.3.0" as const,

  MODEL_ROLE: "leading_indicator_unvalidated" as const,

  /**
   * Weights for structural risk score (sum = 1 when workforce density is used).
   * PLACEHOLDER: not calibrated to OSHA rates; adjust after backtest review.
   */
  STRUCTURAL_BLEND: {
    severityRatio: 0.34,
    trendPressure: 0.22,
    momentum: 0.08,
    highRiskCategoryConcentration: 0.14,
    repeatIssueRate: 0.1,
    /** Extra term when workforce (or hours-as-proxy) denominator exists. */
    workforceSignalDensity: 0.12,
  },

  /**
   * When no workforce/hours: redistribute `workforceSignalDensity` into severity (keeps sum = 1).
   * ASSUMPTION: severity mix is the dominant signal without exposure denominator.
   */
  REDISTRIBUTE_DENSITY_TO_SEVERITY: true,

  /**
   * `workforceSignalDensityPct = min(100, round((signalCount / workforce) * SCALE))`
   * ASSUMPTION: more signals per worker in-window suggests elevated activity/stress (leading indicator).
   * PLACEHOLDER scale — validate with domain experts.
   */
  SIGNALS_PER_WORKER_SCALE: 8,

  /** Band thresholds on structural score (0–100). */
  RISK_LEVEL_CUTS: { moderate: 26, high: 46, critical: 66 } as const,

  /**
   * Map structural score → base likelihood % before weather.
   * `likelihoodBase = minPct + structuralRiskScore * slope` then × combinedWeatherFactor, then clamp.
   * PLACEHOLDER — replace with calibrated mapping when outcome-linked validation exists.
   */
  LIKELIHOOD_FROM_STRUCTURAL: {
    minPct: 5,
    maxPct: 78,
    /** At structural=100, base reaches minPct + slope*100 (before weather). */
    slope: 0.65,
  },

  /**
   * Illustrative case rate when workforce is known (per person-month at “full” likelihood).
   * PLACEHOLDER — not epidemiological TRIR; for relative prioritization only.
   */
  CASE_RATE_PER_WORKER_MONTH_AT_FULL_LIKELIHOOD: 0.055,

  /**
   * When workforce unknown: tie case estimate to trend volume × likelihood (very rough).
   * PLACEHOLDER.
   */
  CASE_RATE_VS_TREND_VOLUME: 0.25,

  /** Cap month-on-month step-up for case estimate (reduces explosion on thin history). */
  MONTH_PROJECTION_CAP: 1.35,

  /**
   * `scheduleExposureLikelihoodMultiplier`: maps weekly hours vs 5×8 reference; `(ratio - 1) * SCHEDULE_EXPOSURE_SENSITIVITY`, capped.
   */
  SCHEDULE_EXPOSURE_SENSITIVITY: 0.4,
  SCHEDULE_EXPOSURE_MAX_LIFT: 0.22,

  /**
   * `trendPressureMultiplier = 1 + (trendPressurePct/100) * cap` — scales how much trend lifts `finalRiskScore`.
   */
  TREND_PRESSURE_MULT_CAP: 0.18,
  /**
   * `momentumMultiplier = 1 + (momentumBoostPct/100) * cap` — momentumBoostPct is typically 0–20.
   */
  MOMENTUM_MULT_CAP: 0.35,

  /** `historicalBaseline = 1 + (baseRisk/100) * cap` from `computeBaseRiskScore` (0–100). */
  HISTORICAL_BASELINE_CAP: 0.4,
} as const;

/**
 * Calendar-month behavioral / operational stress (pace, holidays, heat, year-end rush).
 * Tunable prior — not weather; folded into `behavioralLikelihoodAdjustment` and thus `finalRiskScore`.
 */
export const MONTHLY_BEHAVIOR_FACTOR: Readonly<Record<number, number>> = {
  1: 1.15, // January (cold, slow, rushed)
  2: 1.1,
  3: 1.05, // ramp up work
  4: 1.0,
  5: 0.98,
  6: 1.05, // heat begins
  7: 1.12,
  8: 1.1,
  9: 1.03,
  10: 1.0,
  11: 1.08, // fatigue + deadlines
  12: 1.15, // holidays, rushing
};

export function monthlyBehaviorFactorForCalendarMonth(month1to12: number): number {
  if (!Number.isFinite(month1to12) || month1to12 < 1 || month1to12 > 12) return 1;
  return MONTHLY_BEHAVIOR_FACTOR[month1to12] ?? 1;
}

/** Calendar month 1–12 from dashboard labels like "April 2026"; unparseable → current month. */
export function calendarMonthFromMonthLabel(monthLabel: string): number {
  const d = new Date(monthLabel.trim());
  if (Number.isNaN(d.getTime())) return new Date().getMonth() + 1;
  return d.getMonth() + 1;
}

/** Parses labels like "April 2026" / ISO month strings. */
export function monthlyBehaviorFactorFromMonthLabel(monthLabel: string): number {
  return monthlyBehaviorFactorForCalendarMonth(calendarMonthFromMonthLabel(monthLabel));
}

/** Coarse season multipliers (Northern Hemisphere); distinct from per-month `MONTHLY_BEHAVIOR_FACTOR`. */
export type SeasonName = "winter" | "spring" | "summer" | "fall";

export const SEASONAL_FACTOR: Readonly<Record<SeasonName, number>> = {
  winter: 1.15,
  spring: 1.05,
  summer: 1.1,
  fall: 1.08,
};

/** Calendar month 1–12 → meteorological season (Northern Hemisphere). */
export function getSeason(month: number): SeasonName {
  if (!Number.isFinite(month) || month < 1 || month > 12) return "spring";
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "fall";
}

export function seasonalFactorForCalendarMonth(month1to12: number): number {
  const s = getSeason(month1to12);
  return SEASONAL_FACTOR[s] ?? 1;
}

export function seasonalFactorFromMonthLabel(monthLabel: string): number {
  return seasonalFactorForCalendarMonth(calendarMonthFromMonthLabel(monthLabel));
}

/**
 * `monthFactor * seasonFactor` only (no behavior). Prefer `behavioralLikelihoodAdjustmentFromMonthLabel` for likelihood.
 */
export function calendarLikelihoodMultiplierFromMonthLabel(monthLabel: string): number {
  const currentMonth = calendarMonthFromMonthLabel(monthLabel);
  const monthFactor = monthlyBehaviorFactorForCalendarMonth(currentMonth);
  const seasonFactor = seasonalFactorForCalendarMonth(currentMonth);
  return monthFactor * seasonFactor;
}

export function normalizeBehaviorSignals(input?: Partial<BehaviorSignals> | null): BehaviorSignals {
  return {
    fatigueIndicators: Math.max(0, Number(input?.fatigueIndicators ?? 0) || 0),
    rushingIndicators: Math.max(0, Number(input?.rushingIndicators ?? 0) || 0),
    newWorkerRatio: Math.min(100, Math.max(0, Number(input?.newWorkerRatio ?? 0) || 0)),
    overtimeHours: Math.max(0, Number(input?.overtimeHours ?? 0) || 0),
  };
}

/** Default construction-week reference: 5 days × 8 h = 40 h. */
const REFERENCE_WEEKLY_HOURS = 5 * 8;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeWorkSchedule(input?: Partial<WorkScheduleInputs> | null): WorkScheduleInputs {
  const rawH = input?.hoursPerDay;
  const hoursPerDay =
    rawH != null && Number.isFinite(Number(rawH)) && Number(rawH) > 0
      ? Math.min(24, Math.max(0.25, Number(rawH)))
      : null;
  return {
    workSevenDaysPerWeek: Boolean(input?.workSevenDaysPerWeek),
    hoursPerDay,
  };
}

/**
 * Lifts likelihood when weekly hours exceed a 40h reference (longer days and/or 7-day operations).
 * Returns 1 when no schedule signal is present (no 7-day flag and no hours/day).
 */
export function scheduleExposureLikelihoodMultiplier(workSchedule?: Partial<WorkScheduleInputs> | null): number {
  const n = normalizeWorkSchedule(workSchedule);
  const hasSignal = n.workSevenDaysPerWeek || n.hoursPerDay != null;
  if (!hasSignal) return 1;
  const daysPerWeek = n.workSevenDaysPerWeek ? 7 : 5;
  const hoursPerDay = n.hoursPerDay ?? 8;
  const weeklyHours = daysPerWeek * hoursPerDay;
  const ratio = weeklyHours / REFERENCE_WEEKLY_HOURS;
  const sens = INJURY_WEATHER_MODEL.SCHEDULE_EXPOSURE_SENSITIVITY;
  const cap = INJURY_WEATHER_MODEL.SCHEDULE_EXPOSURE_MAX_LIFT;
  const extra = (ratio - 1) * sens;
  return 1 + clamp(extra, 0, cap);
}

/**
 * `behaviorScore = fatigue*0.25 + rushing*0.30 + newWorkerRatio*0.25 + overtime*0.20`
 * with `newWorkerRatio` as 0–1 (we convert from stored 0–100 percent).
 * `behaviorMultiplier = 1 + clamp(behaviorScore, 0, 0.25)` → likelihood in [1, 1.25].
 */
export function behaviorSignalsLikelihoodMultiplier(signals: Partial<BehaviorSignals> | null | undefined): number {
  const s = normalizeBehaviorSignals(signals);
  const newWorkerRatio01 = s.newWorkerRatio / 100;
  const behaviorScore =
    s.fatigueIndicators * 0.25 +
    s.rushingIndicators * 0.3 +
    newWorkerRatio01 * 0.25 +
    s.overtimeHours * 0.2;
  return 1 + clamp(behaviorScore, 0, 0.25);
}

/**
 * `monthFactor * seasonFactor * behaviorMultiplier * scheduleExposure` — behavior term omitted (×1) when `behaviorSignals` is null/undefined.
 */
export function behavioralLikelihoodAdjustmentFromMonthLabel(
  monthLabel: string,
  behaviorSignals?: Partial<BehaviorSignals> | null,
  workSchedule?: Partial<WorkScheduleInputs> | null
): number {
  const currentMonth = calendarMonthFromMonthLabel(monthLabel);
  const monthFactor = monthlyBehaviorFactorForCalendarMonth(currentMonth);
  const seasonFactor = seasonalFactorForCalendarMonth(currentMonth);
  const behaviorMultiplier =
    behaviorSignals == null ? 1 : behaviorSignalsLikelihoodMultiplier(behaviorSignals);
  const scheduleExposure = scheduleExposureLikelihoodMultiplier(workSchedule);
  return monthFactor * seasonFactor * behaviorMultiplier * scheduleExposure;
}

export function historicalBaselineMultiplierFromBaseRisk(baseRisk0to100: number): number {
  const k = INJURY_WEATHER_MODEL.HISTORICAL_BASELINE_CAP;
  return 1 + Math.min(1, Math.max(0, baseRisk0to100) / 100) * k;
}

/**
 * `predictedRisk = historicalBaseline × seasonalFactor × realTimeBehaviorFactor × scheduleExposureFactor × siteConditionFactor × weatherFactor`
 * — site = calendar month stress × trade-mix sensitivity; weather = regional climate only (not combined).
 */
export function computePredictedRiskProduct(input: {
  baseRiskScore: number;
  monthLabel: string;
  behaviorSignals?: Partial<BehaviorSignals> | null;
  workSchedule?: Partial<WorkScheduleInputs> | null;
  tradeWeatherWeight: number;
  weatherRiskMultiplier: number;
}): { predictedRisk: number; factors: PredictedRiskFactors } {
  const historicalBaseline = historicalBaselineMultiplierFromBaseRisk(input.baseRiskScore);
  const seasonalFactor = seasonalFactorFromMonthLabel(input.monthLabel);
  const realTimeBehaviorFactor =
    input.behaviorSignals == null ? 1 : behaviorSignalsLikelihoodMultiplier(input.behaviorSignals);
  const scheduleExposureFactor = scheduleExposureLikelihoodMultiplier(input.workSchedule);
  const siteConditionFactor =
    monthlyBehaviorFactorFromMonthLabel(input.monthLabel) * input.tradeWeatherWeight;
  const weatherFactor = input.weatherRiskMultiplier;
  const predictedRisk =
    historicalBaseline *
    seasonalFactor *
    realTimeBehaviorFactor *
    scheduleExposureFactor *
    siteConditionFactor *
    weatherFactor;
  const factors: PredictedRiskFactors = {
    historicalBaseline,
    seasonalFactor,
    realTimeBehaviorFactor,
    scheduleExposureFactor,
    siteConditionFactor,
    weatherFactor,
  };
  return { predictedRisk: Math.round(predictedRisk * 1000) / 1000, factors };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function riskLevelFromStructuralScore(score: number): RiskLevel {
  const { moderate, high, critical } = INJURY_WEATHER_MODEL.RISK_LEVEL_CUTS;
  if (score >= critical) return "CRITICAL";
  if (score >= high) return "HIGH";
  if (score >= moderate) return "MODERATE";
  return "LOW";
}

/** Category card banding from a stress count (display — not structural score). */
export function riskBandFromStressCount(count: number): RiskLevel {
  if (count >= 50) return "CRITICAL";
  if (count >= 30) return "HIGH";
  if (count >= 15) return "MODERATE";
  return "LOW";
}

/** Max bucket density (0–100): max trade+category count / exposure (or rows). */
export function computeTradeCategoryConcentrationPct(
  rows: Array<{ trade: string; category: string }>,
  exposureDenominator: number | null
): number {
  if (rows.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.trade}\0${r.category}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let max = 0;
  for (const v of counts.values()) max = Math.max(max, v);
  const denom = exposureDenominator && exposureDenominator > 0 ? exposureDenominator : rows.length;
  return Math.min(100, (max / denom) * 100);
}

/** Repeat density (0–100): repeat pairs / exposure (or rows). */
export function computeRepeatIssueRatePct(
  rows: Array<{ trade: string; category: string }>,
  exposureDenominator: number | null
): number {
  if (rows.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.trade}\0${r.category}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let repeatPairs = 0;
  for (const c of counts.values()) {
    if (c > 1) repeatPairs += c - 1;
  }
  const denom = exposureDenominator && exposureDenominator > 0 ? exposureDenominator : rows.length;
  return Math.min(100, (repeatPairs / denom) * 100);
}

export function computeTrendPressureAndMomentumFromHistory(
  trend: TrendPoint[],
  monthly: Map<string, number>
): { trendPressurePct: number; momentumBoostPct: number } {
  if (trend.length === 0) {
    return { trendPressurePct: 50, momentumBoostPct: 0 };
  }
  const projectedBase = trend.slice(-3).reduce((sum, p) => sum + p.value, 0) / Math.max(1, Math.min(3, trend.length));
  const prevSlice = trend.slice(-6, -3);
  const previousBase = prevSlice.reduce((sum, p) => sum + p.value, 0) / Math.max(1, Math.min(3, prevSlice.length));
  const trendMomentum = previousBase > 0 ? (projectedBase - previousBase) / previousBase : 0;
  const maxMonthly = Math.max(1, ...monthly.values(), ...trend.map((t) => t.value));
  const trendPressurePct = Math.round((projectedBase / maxMonthly) * 100);
  const momentumBoostPct = Math.max(0, Math.min(20, Math.round(trendMomentum * 100)));
  return { trendPressurePct, momentumBoostPct };
}

/**
 * Optional leading-indicator: signals per worker in the analysis window.
 * VALIDATED: only when `workforceCount > 0`; else returns null (excluded from blend).
 */
export function computeWorkforceSignalDensityPct(signalCount: number, workforceCount: number): number | null {
  if (!workforceCount || workforceCount <= 0) return null;
  return Math.min(100, Math.round((signalCount / workforceCount) * INJURY_WEATHER_MODEL.SIGNALS_PER_WORKER_SCALE));
}

export type BaseRiskInputs = {
  severityRatioPct: number;
  highRiskCategoryConcentration: number;
  repeatIssueRate: number;
  workforceSignalDensityPct: number | null;
};

export type StructuralInputs = BaseRiskInputs & {
  trendPressurePct: number;
  momentumBoostPct: number;
  /** `behavioralLikelihoodAdjustmentFromMonthLabel` (month × season × optional behavior). Default 1. */
  behavioralAdjustment?: number;
};

/**
 * Severity mix (and concentration / repeats / optional density) with weights renormalized from
 * `STRUCTURAL_BLEND` excluding trend/momentum — same redistribution rules as the old additive blend.
 */
export function computeBaseRiskScore(input: BaseRiskInputs): number {
  const w = INJURY_WEATHER_MODEL.STRUCTURAL_BLEND;
  const coreSum = w.severityRatio + w.highRiskCategoryConcentration + w.repeatIssueRate + w.workforceSignalDensity;
  let ws = w.severityRatio / coreSum;
  let wc = w.highRiskCategoryConcentration / coreSum;
  let wr = w.repeatIssueRate / coreSum;
  let wd = w.workforceSignalDensity / coreSum;

  if (input.workforceSignalDensityPct == null) {
    if (INJURY_WEATHER_MODEL.REDISTRIBUTE_DENSITY_TO_SEVERITY) {
      ws += wd;
      wd = 0;
    } else {
      const sum = ws + wc + wr;
      ws = (ws / sum) * (1 - wd);
      wc = (wc / sum) * (1 - wd);
      wr = (wr / sum) * (1 - wd);
      wd = 0;
    }
  }

  const density = input.workforceSignalDensityPct ?? 0;

  return (
    input.severityRatioPct * ws +
    input.highRiskCategoryConcentration * wc +
    input.repeatIssueRate * wr +
    density * wd
  );
}

/** Unitless multiplier (≥1) from trend pressure % (0–100). */
export function trendPressureMultiplierFromPct(trendPressurePct: number): number {
  const k = INJURY_WEATHER_MODEL.TREND_PRESSURE_MULT_CAP;
  return 1 + Math.min(1, Math.max(0, trendPressurePct) / 100) * k;
}

/** Unitless multiplier (≥1) from momentum boost % (0–100). */
export function momentumMultiplierFromPct(momentumBoostPct: number): number {
  const k = INJURY_WEATHER_MODEL.MOMENTUM_MULT_CAP;
  return 1 + Math.min(1, Math.max(0, momentumBoostPct) / 100) * k;
}

/**
 * `finalRiskScore = baseRisk × trendPressure × momentumBoost × behavioralAdjustment` (clamped 0–100). **No weather.**
 */
export function computeFinalRiskScore(input: StructuralInputs): number {
  const baseRisk = computeBaseRiskScore({
    severityRatioPct: input.severityRatioPct,
    highRiskCategoryConcentration: input.highRiskCategoryConcentration,
    repeatIssueRate: input.repeatIssueRate,
    workforceSignalDensityPct: input.workforceSignalDensityPct,
  });
  const trendPressure = trendPressureMultiplierFromPct(input.trendPressurePct);
  const momentumBoost = momentumMultiplierFromPct(input.momentumBoostPct);
  const behavioralAdjustment = input.behavioralAdjustment ?? 1;
  const raw = baseRisk * trendPressure * momentumBoost * behavioralAdjustment;
  return Math.min(100, Math.round(raw * 10) / 10);
}

/**
 * Structural leading-indicator score (0–100) — alias for `computeFinalRiskScore` (product model).
 */
export function computeStructuralRiskScore(input: StructuralInputs): number {
  return computeFinalRiskScore(input);
}

/**
 * Incident likelihood index (%) — **structural × weather** (optionally × `extraLikelihoodMultiplier`).
 * Calendar/behavior are folded into `structuralRiskScore` via `finalRiskScore`; default extra is 1.
 */
export function computeIncidentLikelihoodIndexPct(
  structuralRiskScore: number,
  combinedWeatherFactor: number,
  extraLikelihoodMultiplier = 1
): number {
  const { minPct, maxPct, slope } = INJURY_WEATHER_MODEL.LIKELIHOOD_FROM_STRUCTURAL;
  const base = minPct + structuralRiskScore * slope;
  const raw = base * combinedWeatherFactor * extraLikelihoodMultiplier;
  return Math.max(minPct, Math.min(maxPct, Math.round(raw)));
}

type ProjectedCaseInput = {
  incidentLikelihoodIndexPct: number;
  workforceCount: number;
  /** Rolling average of recent monthly signal volume when no workforce */
  trendVolumeBase: number;
  monthProjectionFactor: number;
};

/**
 * Rough “case load” estimate for the next ~30 days — **not** a TRIR prediction.
 */
export function computeProjectedCaseEstimate(input: ProjectedCaseInput): number {
  const L = input.incidentLikelihoodIndexPct / 100;
  const rate = INJURY_WEATHER_MODEL.CASE_RATE_PER_WORKER_MONTH_AT_FULL_LIKELIHOOD;
  const alt = INJURY_WEATHER_MODEL.CASE_RATE_VS_TREND_VOLUME;

  const base =
    input.workforceCount > 0
      ? input.workforceCount * (L * rate)
      : Math.max(1, input.trendVolumeBase) * (L * alt);

  const stepped = base * input.monthProjectionFactor;
  return Math.max(1, Math.round(stepped));
}

export type TradeForecastBuildInput = {
  tradeForecastsRaw: [string, Map<string, number>][];
  projectedCaseEstimate: number;
  incidentLikelihoodIndexPct: number;
  defaultForecasts: TradeForecast[];
};

/**
 * Trade/category **allocation** for UI: shares from signals, magnitudes scaled to `projectedCaseEstimate`.
 * Category “risk” bands use stress from raw counts × likelihood — **not** structural score.
 */
export function buildTradeCategoryForecasts(input: TradeForecastBuildInput): TradeForecast[] {
  const { tradeForecastsRaw, projectedCaseEstimate, incidentLikelihoodIndexPct, defaultForecasts } = input;
  if (tradeForecastsRaw.length === 0) return defaultForecasts;

  const tradeSignalTotal = Math.max(
    1,
    tradeForecastsRaw.reduce((sum, [, cats]) => sum + [...cats.values()].reduce((s, v) => s + v, 0), 0)
  );

  const tradeWeatherParts = tradeForecastsRaw.map(([trade, cats]) => {
    const tradeRawTotal = [...cats.values()].reduce((n, v) => n + v, 0);
    const tradeShare = tradeRawTotal / tradeSignalTotal;
    return tradeShare * getTradeWeatherWeight(trade);
  });
  const tradeWeatherPartsSum = tradeWeatherParts.reduce((a, b) => a + b, 0) || 1;

  return tradeForecastsRaw.map(([trade, cats], idx) => {
    const tradeRawTotal = [...cats.values()].reduce((n, v) => n + v, 0);
    const tradeShare = tradeRawTotal / tradeSignalTotal;
    const tradeProjectedCases = Math.max(
      1,
      Math.round(projectedCaseEstimate * (tradeWeatherParts[idx]! / tradeWeatherPartsSum))
    );
    const topCats = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topCatTotal = Math.max(1, topCats.reduce((n, [, v]) => n + v, 0));
    return {
      trade,
      forecastProvenance: "live" as const,
      tradeCaseAllocation: tradeProjectedCases,
      categories: topCats.map(([name, rawCount], catIdx) => {
        const catShare = rawCount / topCatTotal;
        const estimatedCount = Math.max(0, Math.round(tradeProjectedCases * catShare));
        const stress = Math.max(1, Math.round(rawCount * (incidentLikelihoodIndexPct / 100)));
        return {
          name,
          predictedCount: catIdx === 0 ? Math.max(1, estimatedCount) : estimatedCount,
          riskLevel: riskBandFromStressCount(stress),
          sourceObservationCount: rawCount,
          shareOfTradeTopCategoriesPct: Math.round(catShare * 1000) / 10,
        };
      }),
    };
  });
}

/**
 * When the user filters by trade(s) but no signals roll up to those trades, show one honest card per
 * requested trade instead of falling back to demo Roofing/Electrical/etc. cards.
 */
export function tradeForecastsWhenNoSignals(requestedTradeLabels: string[]): TradeForecast[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const raw of requestedTradeLabels) {
    const s = raw.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(s);
  }
  return labels.slice(0, 8).map((raw) => {
    const trade = raw
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return {
      trade,
      forecastProvenance: "live" as const,
      tradeCaseAllocation: 0,
      categories: [
        {
          name: "No observations in selected window",
          predictedCount: 0,
          riskLevel: "LOW" as const,
          sourceObservationCount: 0,
          shareOfTradeTopCategoriesPct: 100,
        },
      ],
      footerNote:
        "No safety signals matched this trade for the current filters.",
    };
  });
}
