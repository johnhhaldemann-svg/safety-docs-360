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
 *   1. `structuralRiskScore` (0–100): composite of severity mix, trend pressure, momentum,
 *      concentration, repeats, and optional workforce-normalized signal density. **No weather.**
 *   2. `incidentLikelihoodIndexPct`: illustrative “next ~30 day” likelihood index derived from
 *      structural score × trade/site weather exposure. **Not** the same unit as (1).
 *   3. `projectedCaseEstimate`: rough case-load style count for prioritization; uses (2) × exposure
 *      constants × optional trend step-up. **Not** equated with structural score.
 *   4. Trade/category **allocation** uses signal shares × weather weights for display only.
 */

import { getTradeWeatherWeight } from "@/lib/injuryWeather/locationWeather";
import type { RiskLevel, TradeForecast, TrendPoint } from "@/lib/injuryWeather/types";

// ---------------------------------------------------------------------------
// CONFIGURABLE CONSTANTS — tune here; keep version in sync when changing material weights
// ---------------------------------------------------------------------------

export const INJURY_WEATHER_MODEL = {
  /** Bump when blend weights or likelihood mapping change materially. */
  VERSION: "2.0.0" as const,

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
} as const;

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

type StructuralInputs = {
  severityRatioPct: number;
  trendPressurePct: number;
  momentumBoostPct: number;
  highRiskCategoryConcentration: number;
  repeatIssueRate: number;
  workforceSignalDensityPct: number | null;
};

/**
 * Structural leading-indicator score (0–100). **Does not include weather** — weather applies only to
 * the likelihood index downstream.
 */
export function computeStructuralRiskScore(input: StructuralInputs): number {
  const w = INJURY_WEATHER_MODEL.STRUCTURAL_BLEND;
  let ws = w.severityRatio;
  let wt = w.trendPressure;
  let wm = w.momentum;
  let wc = w.highRiskCategoryConcentration;
  let wr = w.repeatIssueRate;
  let wd: number = w.workforceSignalDensity;

  if (input.workforceSignalDensityPct == null) {
    if (INJURY_WEATHER_MODEL.REDISTRIBUTE_DENSITY_TO_SEVERITY) {
      ws += wd;
      wd = 0;
    } else {
      // normalize remaining five weights — fallback
      const sum = ws + wt + wm + wc + wr;
      ws = (ws / sum) * (1 - wd);
      wt = (wt / sum) * (1 - wd);
      wm = (wm / sum) * (1 - wd);
      wc = (wc / sum) * (1 - wd);
      wr = (wr / sum) * (1 - wd);
      wd = 0;
    }
  }

  const density = input.workforceSignalDensityPct ?? 0;

  return (
    input.severityRatioPct * ws +
    input.trendPressurePct * wt +
    input.momentumBoostPct * wm +
    input.highRiskCategoryConcentration * wc +
    input.repeatIssueRate * wr +
    density * wd
  );
}

/**
 * Incident likelihood index (%) — **derived from structural score × weather**, not a second
 * independent regression on the same inputs (avoids double-counting severity/trend).
 */
export function computeIncidentLikelihoodIndexPct(structuralRiskScore: number, combinedWeatherFactor: number): number {
  const { minPct, maxPct, slope } = INJURY_WEATHER_MODEL.LIKELIHOOD_FROM_STRUCTURAL;
  const base = minPct + structuralRiskScore * slope;
  const raw = base * combinedWeatherFactor;
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
