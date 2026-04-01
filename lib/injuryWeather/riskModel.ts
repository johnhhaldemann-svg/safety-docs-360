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
 *      `behavioralLikelihoodAdjustmentFromMonthLabel`). `baseRisk` starts from the **baseline engine**
 *      (`avgInjuryRateByMonth + avgInjuryRateByTrade + avgSeverityWeight`) plus a structural overlay.
 *      **No weather** in this score.
 *   1b. `predictedRisk` (dimensionless index) — parallel headline for calibration; not identical to (1).
 *      If **liveSignals.length === 0** (`baseline_only`): `baselineRisk × monthlyFactor × tradeFactor` (see
 *      `computePredictedRiskProductWhenNoObservations`; behavior/weather = 1). **Else** (`live_adjusted`):
 *      `baselineRisk × monthlyFactor × tradeFactor × behaviorFactor × weatherFactor` where `behaviorFactor`
 *      combines realtime behavior and schedule exposure (`computePredictedRiskProduct`).
 *   2. `incidentLikelihoodIndexPct`: illustrative “next ~30 day” likelihood index derived from
 *      structural score × trade/site weather exposure. **Not** the same unit as (1).
 *   3. `projectedCaseEstimate`: rough case-load style count for prioritization; uses (2) × exposure
 *      constants × optional trend step-up. **Not** equated with structural score.
 *   4. Trade/category **allocation** uses signal shares × weather weights for display only.
 *
 * Target product narrative (layers 1–8) maps to code fields in `injuryRiskDeterminationTree.ts` and the
 * `InjuryRiskTreePanel` dashboard component.
 */

import { getTradeWeatherWeight } from "@/lib/injuryWeather/locationWeather";
import type {
  BehaviorSignals,
  InjuryWeatherForecastMode,
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
  /** Structural headline for live data uses `riskEngineV2` (weighted signals); likelihood / case paths still read these constants. */
  VERSION: "3.0.0" as const,

  /** Forecast path confidence when no live rows match scope (`baseline_only`). */
  FORECAST_CONFIDENCE_BASELINE_ONLY: 0.4 as const,
  /** Forecast path confidence when live rows adjust the product (`live_adjusted`). */
  FORECAST_CONFIDENCE_LIVE_ADJUSTED: 0.8 as const,

  /**
   * When **no** SOR/CA/incident rows match the current filters, the structural blend is 0. For
   * `predictedRisk` only, we apply this minimum base score so `historicalBaseline` stays above
   * neutral (1.0)—representing prior uncertainty, not “proven zero risk.”
   */
  BASE_RISK_PRIOR_WHEN_NO_SIGNALS: 12,

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

  /**
   * Baseline engine: `baselineRisk = avgInjuryRateByMonth + avgInjuryRateByTrade + avgSeverityWeight`
   * (each on a 0–33 / 0–34 point scale; sum ≤ 100). PLACEHOLDER priors — replace with employer or sector rates when available.
   */
  BASELINE_MONTH_POINTS_MAX: 33,
  BASELINE_TRADE_POINTS_MAX: 33,
  /** Max points from observed high/critical severity share (0–100% → 0–34). */
  BASELINE_SEVERITY_WEIGHT_MAX: 34,
  /** When there are no signal rows, severity term uses this prior (not zero). */
  BASELINE_SEVERITY_WEIGHT_WHEN_NO_SIGNALS: 11,
  /**
   * Relative injury-rate index by calendar month (1=Jan … 12=Dec). Min/max normalized to month points.
   * PLACEHOLDER — not empirical TRIR; tunable seasonality prior.
   */
  AVG_INJURY_RATE_BY_MONTH_RELATIVE: [
    1.12, 1.06, 1.02, 0.98, 1.0, 1.05, 1.1, 1.12, 1.04, 1.0, 1.05, 1.14,
  ] as const,
  /** Maps `tradeWeatherWeight` (≈0.9–1.28) into baseline trade points. */
  BASELINE_TRADE_WEIGHT_MIN: 0.9,
  BASELINE_TRADE_WEIGHT_MAX: 1.28,
  /**
   * Structural overlay (concentration / repeat / density) scales how much leading-indicator shape
   * moves score above the baseline sum (0–1).
   */
  BASELINE_OVERLAY_WEIGHT: 0.38,
  /**
   * When live signals exist, **reinforce** the baseline (not only add overlay)—stronger signal volume
   * pulls the baseline term up modestly.
   */
  SIGNAL_BASELINE_REINFORCEMENT_CAP: 0.16,
  SIGNAL_BASELINE_REINFORCEMENT_PER_ROW: 0.008,
  /**
   * Extra scaling on overlay weight per signal row (capped)—makes concentration/repeat/density matter more.
   */
  SIGNAL_OVERLAY_WEIGHT_EXTRA_CAP: 0.85,
  SIGNAL_OVERLAY_WEIGHT_PER_ROW: 0.018,
  /**
   * When trend pressure/momentum **align** with signal-stress shape (severity/repeat/concentration),
   * apply a small upward multiplier (validates the trend with live data).
   */
  TREND_SIGNAL_VALIDATION_CAP: 0.14,
} as const;

/** `if (liveSignals.length === 0) → "baseline_only"` else `"live_adjusted"`. */
export function forecastModeFromObservationCount(n: number): InjuryWeatherForecastMode {
  return n === 0 ? "baseline_only" : "live_adjusted";
}

/** `0.4` when no live rows, `0.8` when the headline product includes behavior + weather adjustments. */
export function forecastConfidenceScoreFromObservationCount(n: number): number {
  return n === 0
    ? INJURY_WEATHER_MODEL.FORECAST_CONFIDENCE_BASELINE_ONLY
    : INJURY_WEATHER_MODEL.FORECAST_CONFIDENCE_LIVE_ADJUSTED;
}

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
 * `minimumRiskFloor = baselineRisk × monthlyFactor` — `baselineRisk` is the `historicalBaseline` multiplier;
 * `monthlyFactor` is the seasonal calendar factor (`seasonalFactorFromMonthLabel`). Applied so headline
 * `predictedRisk` cannot fall below this when trade/behavior/weather pull multipliers down.
 */
export function computeMinimumRiskFloor(historicalBaseline: number, monthLabel: string): number {
  const monthlyFactor = seasonalFactorFromMonthLabel(monthLabel);
  return historicalBaseline * monthlyFactor;
}

/**
 * `predictedRisk`’s `historicalBaseline` factor uses `baseRiskScore`. If there are no signals, that
 * score is 0 and the multiplier would sit at 1.0 only—use a non-zero prior so the headline product
 * does not imply zero historical baseline risk when data is simply missing.
 */
export function effectiveBaseRiskScoreForPredictedRisk(baseRiskScore: number, signalRowCount: number): number {
  if (signalRowCount > 0) return baseRiskScore;
  return Math.max(baseRiskScore, INJURY_WEATHER_MODEL.BASE_RISK_PRIOR_WHEN_NO_SIGNALS);
}

/**
 * **Live-adjusted path** (`live_adjusted`): conceptually
 * `baselineRisk × monthlyFactor × tradeFactor × behaviorFactor × weatherFactor` — implemented as
 * `historicalBaseline × seasonalFactor × siteConditionFactor × (realTimeBehavior × scheduleExposure) × weatherFactor`
 * where `siteConditionFactor` = calendar month stress × trade-mix weight (`monthlyBehavior × trade`).
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
  const predictedRiskRaw =
    historicalBaseline *
    seasonalFactor *
    realTimeBehaviorFactor *
    scheduleExposureFactor *
    siteConditionFactor *
    weatherFactor;
  const minimumRiskFloor = computeMinimumRiskFloor(historicalBaseline, input.monthLabel);
  const predictedRisk = Math.max(minimumRiskFloor, predictedRiskRaw);
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

/**
 * **Baseline-only path** (`baseline_only`): `baselineRisk × monthlyFactor × tradeFactor` with
 * `confidence = FORECAST_CONFIDENCE_BASELINE_ONLY`. Implemented as
 * `historicalBaseline × seasonalFactor × (monthlyBehavior × tradeWeatherWeight)`; behavior and weather = 1.
 */
export function computePredictedRiskProductWhenNoObservations(input: {
  baseRiskScore: number;
  monthLabel: string;
  tradeWeatherWeight: number;
}): { predictedRisk: number; factors: PredictedRiskFactors } {
  const historicalBaseline = historicalBaselineMultiplierFromBaseRisk(input.baseRiskScore);
  const monthlyFactor = seasonalFactorFromMonthLabel(input.monthLabel);
  const siteStress = monthlyBehaviorFactorFromMonthLabel(input.monthLabel);
  const tradeFactor = input.tradeWeatherWeight;
  const siteConditionFactor = siteStress * tradeFactor;
  const predictedRiskRaw = historicalBaseline * monthlyFactor * siteConditionFactor;
  const minimumRiskFloor = computeMinimumRiskFloor(historicalBaseline, input.monthLabel);
  const predictedRisk = Math.max(minimumRiskFloor, predictedRiskRaw);
  const factors: PredictedRiskFactors = {
    historicalBaseline,
    seasonalFactor: monthlyFactor,
    realTimeBehaviorFactor: 1,
    scheduleExposureFactor: 1,
    siteConditionFactor,
    weatherFactor: 1,
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

export type BaselineRiskComponents = {
  /** Sum of the three terms (0–100); feeds `computeBaseRiskScore` before structural overlay. */
  baselineRisk: number;
  avgInjuryRateByMonth: number;
  avgInjuryRateByTrade: number;
  avgSeverityWeight: number;
};

/**
 * Calendar-month injury-rate prior (0…BASELINE_MONTH_POINTS_MAX) from tunable relative index.
 */
export function computeAvgInjuryRateByMonth(monthLabel: string): number {
  const m = calendarMonthFromMonthLabel(monthLabel);
  const table = INJURY_WEATHER_MODEL.AVG_INJURY_RATE_BY_MONTH_RELATIVE;
  const raw = table[m - 1] ?? 1;
  const min = Math.min(...table);
  const max = Math.max(...table);
  const t = max > min ? (raw - min) / (max - min) : 0.5;
  return t * INJURY_WEATHER_MODEL.BASELINE_MONTH_POINTS_MAX;
}

/**
 * Trade-mix injury-rate prior (0…BASELINE_TRADE_POINTS_MAX) from signal-weighted outdoor/climate sensitivity.
 */
export function computeAvgInjuryRateByTrade(tradeWeatherWeight: number): number {
  const lo = INJURY_WEATHER_MODEL.BASELINE_TRADE_WEIGHT_MIN;
  const hi = INJURY_WEATHER_MODEL.BASELINE_TRADE_WEIGHT_MAX;
  const w = Math.min(hi, Math.max(lo, tradeWeatherWeight));
  const t = (w - lo) / (hi - lo);
  return t * INJURY_WEATHER_MODEL.BASELINE_TRADE_POINTS_MAX;
}

/**
 * Severity leg of the baseline: high/critical share of signals, scaled to baseline points; prior when no rows.
 */
export function computeAvgSeverityWeight(severityRatioPct: number, signalRowCount: number | undefined): number {
  const cap = INJURY_WEATHER_MODEL.BASELINE_SEVERITY_WEIGHT_MAX;
  if (signalRowCount === 0) {
    return INJURY_WEATHER_MODEL.BASELINE_SEVERITY_WEIGHT_WHEN_NO_SIGNALS;
  }
  return (Math.min(100, Math.max(0, severityRatioPct)) / 100) * cap;
}

/**
 * Core baseline: **every** structural / predicted-risk path starts from this sum (then overlay + multipliers).
 */
export function computeBaselineRisk(input: {
  monthLabel: string;
  tradeWeatherWeight: number;
  severityRatioPct: number;
  /** `0` = no rows in window → severity prior; omit/`undefined` = use `severityRatioPct` only (tests / legacy). */
  signalRowCount?: number;
}): BaselineRiskComponents {
  const avgInjuryRateByMonth = computeAvgInjuryRateByMonth(input.monthLabel);
  const avgInjuryRateByTrade = computeAvgInjuryRateByTrade(input.tradeWeatherWeight);
  const avgSeverityWeight = computeAvgSeverityWeight(input.severityRatioPct, input.signalRowCount);
  const baselineRisk = Math.min(
    100,
    avgInjuryRateByMonth + avgInjuryRateByTrade + avgSeverityWeight
  );
  return { baselineRisk, avgInjuryRateByMonth, avgInjuryRateByTrade, avgSeverityWeight };
}

function defaultMonthLabelForBaseline(): string {
  return new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
}

/**
 * Leading-indicator overlay: concentration, repeat, density — **not** severity (that is in `computeBaselineRisk`).
 */
function computeStructuralOverlayOnly(input: BaseRiskInputs): number {
  const w = INJURY_WEATHER_MODEL.STRUCTURAL_BLEND;
  let wc: number = w.highRiskCategoryConcentration;
  let wr: number = w.repeatIssueRate;
  let wd: number = w.workforceSignalDensity;
  if (input.workforceSignalDensityPct == null) {
    if (INJURY_WEATHER_MODEL.REDISTRIBUTE_DENSITY_TO_SEVERITY) {
      wc += wd / 2;
      wr += wd / 2;
      wd = 0;
    } else {
      const sum = wc + wr;
      wc = (wc / sum) * (1 - wd);
      wr = (wr / sum) * (1 - wd);
      wd = 0;
    }
  }
  const sum = wc + wr + wd;
  const density = input.workforceSignalDensityPct ?? 0;
  return (
    input.highRiskCategoryConcentration * (wc / sum) +
    input.repeatIssueRate * (wr / sum) +
    density * (wd / sum)
  );
}

export type BaseRiskInputs = {
  severityRatioPct: number;
  highRiskCategoryConcentration: number;
  repeatIssueRate: number;
  workforceSignalDensityPct: number | null;
  /** Baseline engine: calendar month for `avgInjuryRateByMonth`. Defaults to current month label. */
  monthLabel?: string;
  /** Baseline engine: trade mix weight for `avgInjuryRateByTrade`. Defaults to 1. */
  tradeWeatherWeight?: number;
  /** `0` = no signal rows → severity prior; omit for legacy callers (severity from `severityRatioPct` only). */
  signalRowCount?: number;
};

export type StructuralInputs = BaseRiskInputs & {
  trendPressurePct: number;
  momentumBoostPct: number;
  /** `behavioralLikelihoodAdjustmentFromMonthLabel` (month × season × optional behavior). Default 1. */
  behavioralAdjustment?: number;
};

/**
 * Structural base (0–100): starts from **baseline engine** (`avgInjuryRateByMonth + avgInjuryRateByTrade + avgSeverityWeight`),
 * then adds a scaled overlay from concentration / repeat / workforce density (severity is only in the baseline sum).
 */
export function computeBaseRiskScore(input: BaseRiskInputs): number {
  const monthLabel = input.monthLabel ?? defaultMonthLabelForBaseline();
  const tradeW = input.tradeWeatherWeight ?? 1;
  const signalRowCount = input.signalRowCount ?? 0;
  const { baselineRisk } = computeBaselineRisk({
    monthLabel,
    tradeWeatherWeight: tradeW,
    severityRatioPct: input.severityRatioPct,
    signalRowCount: input.signalRowCount,
  });
  const overlay = computeStructuralOverlayOnly(input);
  const reinforce =
    signalRowCount > 0
      ? Math.min(
          INJURY_WEATHER_MODEL.SIGNAL_BASELINE_REINFORCEMENT_CAP,
          signalRowCount * INJURY_WEATHER_MODEL.SIGNAL_BASELINE_REINFORCEMENT_PER_ROW
        )
      : 0;
  const baselineAdjusted = baselineRisk * (1 + reinforce);
  const overlayExtra =
    signalRowCount > 0
      ? Math.min(
          INJURY_WEATHER_MODEL.SIGNAL_OVERLAY_WEIGHT_EXTRA_CAP,
          signalRowCount * INJURY_WEATHER_MODEL.SIGNAL_OVERLAY_WEIGHT_PER_ROW
        )
      : 0;
  const k = INJURY_WEATHER_MODEL.BASELINE_OVERLAY_WEIGHT * (signalRowCount > 0 ? 1 + overlayExtra : 1);
  const raw = baselineAdjusted + overlay * k;
  return Math.min(100, Math.round(raw * 10) / 10);
}

/**
 * When signals exist, boost `finalRiskScore` when **trend shape** (pressure + momentum) **aligns** with
 * **signal stress** (severity, repeats, concentration)—interprets live data as validating the trend.
 */
export function computeTrendSignalValidationMultiplier(input: StructuralInputs): number {
  const n = input.signalRowCount ?? 0;
  if (n === 0) return 1;
  const t =
    (Math.min(100, Math.max(0, input.trendPressurePct)) / 100) * 0.52 +
    (Math.min(100, Math.max(0, input.momentumBoostPct)) / 100) * 0.48;
  const s =
    (Math.min(100, Math.max(0, input.severityRatioPct)) / 100) * 0.42 +
    (Math.min(100, Math.max(0, input.repeatIssueRate)) / 100) * 0.28 +
    (Math.min(100, Math.max(0, input.highRiskCategoryConcentration)) / 100) * 0.3;
  const agreement = 1 - Math.abs(t - s);
  const cap = INJURY_WEATHER_MODEL.TREND_SIGNAL_VALIDATION_CAP;
  return 1 + cap * agreement;
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
 * `finalRiskScore = baseRisk × trendPressure × momentumBoost × behavioralAdjustment × trendSignalValidation`
 * (clamped 0–100). `trendSignalValidation` lifts the score when trend shape aligns with live signal stress. **No weather.**
 */
export function computeFinalRiskScore(input: StructuralInputs): number {
  const baseRisk = computeBaseRiskScore({
    severityRatioPct: input.severityRatioPct,
    highRiskCategoryConcentration: input.highRiskCategoryConcentration,
    repeatIssueRate: input.repeatIssueRate,
    workforceSignalDensityPct: input.workforceSignalDensityPct,
    monthLabel: input.monthLabel,
    tradeWeatherWeight: input.tradeWeatherWeight,
    signalRowCount: input.signalRowCount,
  });
  const trendPressure = trendPressureMultiplierFromPct(input.trendPressurePct);
  const momentumBoost = momentumMultiplierFromPct(input.momentumBoostPct);
  const behavioralAdjustment = input.behavioralAdjustment ?? 1;
  const trendValidated = computeTrendSignalValidationMultiplier(input);
  const raw = baseRisk * trendPressure * momentumBoost * behavioralAdjustment * trendValidated;
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
