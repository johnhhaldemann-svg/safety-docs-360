import { getCredibilityWeight } from "./baseline";
import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { ForecastDataMode, ForecastRunContext } from "./types";

const T = DYNAMIC_INJURY_FORECAST.FORECAST_THRESHOLDS;
const M = DYNAMIC_INJURY_FORECAST.MODE_CONFIDENCE;

/** User-facing copy when the benchmark path is active or dominant. */
export const BENCHMARK_FORECAST_USER_MESSAGE =
  "This forecast is currently benchmark-driven because limited company-specific safety data is available. As more observations, corrective actions, inspections, and exposure hours are entered, the forecast will become more tailored and accurate.";

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Classify forecast path: full hybrid vs partial blend vs benchmark-first λ path.
 */
export function getForecastMode(ctx: ForecastRunContext): ForecastDataMode {
  const events = ctx.sorCount + ctx.correctiveActionCount + ctx.incidentCount;

  const benchmarkLike =
    (ctx.signalRowCount === 0 && ctx.laborHours < 2000 && events === 0) ||
    (ctx.signalRowCount > 0 &&
      ctx.signalRowCount <= T.BENCHMARK_SIGNAL_ROWS &&
      events <= T.BENCHMARK_MAX_EVENTS &&
      ctx.laborHours < T.BENCHMARK_MAX_LABOR_HOURS) ||
    (ctx.signalRowCount <= 2 && ctx.laborHours < T.ZERO_ROWS_BENCHMARK_HOURS && events <= 2);

  const fullLike =
    ctx.signalRowCount >= T.FULL_MIN_SIGNAL_ROWS &&
    ctx.laborHours >= T.FULL_MIN_LABOR_HOURS &&
    ctx.distinctMonthsOfHistory >= T.FULL_MIN_DISTINCT_MONTHS &&
    events >= T.FULL_MIN_EVENTS &&
    ctx.completeness01 >= T.FULL_MIN_COMPLETENESS &&
    ctx.correctiveActionCount >= T.FULL_MIN_CORRECTIVE &&
    ctx.inspectionProxyCount >= T.FULL_MIN_INSPECTION_PROXY;

  if (fullLike && !benchmarkLike) return "FULL_DATA";
  if (benchmarkLike) return "BENCHMARK_FALLBACK";
  return "PARTIAL_DATA";
}

/**
 * Composite credibility 0–1 for blending company path vs benchmark fallback.
 */
export function getCredibilityWeightComposite(ctx: ForecastRunContext): number {
  const zInc = getCredibilityWeight(ctx.incidentCount);
  const vol = clamp01(Math.log1p(ctx.signalRowCount) / Math.log1p(45));
  const hrs = clamp01(Math.log1p(ctx.laborHours) / Math.log1p(6000));
  const months = clamp01(ctx.distinctMonthsOfHistory / 5);
  const events = clamp01((ctx.sorCount + ctx.correctiveActionCount + ctx.incidentCount) / 24);
  const insp = clamp01(ctx.inspectionProxyCount / 6);
  const capa = clamp01(ctx.correctiveActionCount / 12);
  const qual = ctx.completeness01 * 0.28 + ctx.dataRecencyScore01 * 0.22 + months * 0.18 + vol * 0.14 + hrs * 0.1 + events * 0.08;
  const struct = insp * 0.06 + capa * 0.06;
  const raw = zInc * 0.28 + qual * 0.58 + struct * 0.14;
  return clamp01(raw);
}

/**
 * Weight on full hybrid λ (rest on fallback λ). FULL_DATA → 1, BENCHMARK with no rows → 0,
 * BENCHMARK with any in-scope rows → blended so the forecast still reacts to what was logged.
 */
export function getHybridBlendWeight(
  mode: ForecastDataMode,
  credibilityComposite: number,
  ctx: ForecastRunContext
): number {
  if (mode === "FULL_DATA") return 1;
  if (mode === "BENCHMARK_FALLBACK") {
    if (ctx.signalRowCount <= 0) return 0;
    const vol = clamp01(Math.log1p(ctx.signalRowCount) / Math.log1p(24));
    const floor = 0.14 + 0.32 * vol;
    const fromCred = 0.12 + 0.38 * credibilityComposite;
    return clamp01(Math.min(0.68, Math.max(floor, fromCred)));
  }
  return clamp01(M.PARTIAL_MIN_HYBRID_WEIGHT + (M.PARTIAL_MAX_HYBRID_WEIGHT - M.PARTIAL_MIN_HYBRID_WEIGHT) * credibilityComposite);
}

export function clampConfidenceToMode(mode: ForecastDataMode, rawConfidence: number): number {
  const r = Number.isFinite(rawConfidence) ? rawConfidence : 40;
  if (mode === "FULL_DATA") return Math.min(M.FULL_MAX, Math.max(M.FULL_MIN, r));
  if (mode === "PARTIAL_DATA") return Math.min(M.PARTIAL_MAX, Math.max(M.PARTIAL_MIN, r));
  return Math.min(M.BENCHMARK_MAX, Math.max(M.BENCHMARK_MIN, r));
}

export function fallbackReasonForMode(mode: ForecastDataMode, ctx: ForecastRunContext): string {
  if (mode === "FULL_DATA") {
    return "Sufficient safety signal volume, exposure hours, and history depth for the full hybrid model.";
  }
  if (mode === "BENCHMARK_FALLBACK") {
    const parts: string[] = [];
    if (ctx.signalRowCount === 0) parts.push("no SOR/CAPA/incident rows in the current scope");
    else if (ctx.signalRowCount <= T.BENCHMARK_SIGNAL_ROWS) parts.push("very few safety rows in scope");
    if (ctx.laborHours < T.BENCHMARK_MAX_LABOR_HOURS) parts.push("limited labor hours on file");
    if (ctx.distinctMonthsOfHistory <= 1) parts.push("little calendar spread in the snapshot");
    return `Benchmark-driven forecast because ${parts.length ? parts.join("; ") : "company-specific evidence is thin"} — trade, season, and location priors anchor the score until more jobsite data is collected.`;
  }
  return "Partial company data: the model blends your signals with sector and trade defaults; confidence rises as observations, corrective actions, inspections, and exposure hours grow.";
}

export function benchmarkSourcesUsedList(mode: ForecastDataMode, ctx: ForecastRunContext): string[] {
  const base = [
    "internal_trade_default_risk_table",
    "month_season_multiplier_table",
    "project_phase_multiplier_table",
    "task_hazard_multiplier_table",
  ];
  if (ctx.stateRateIndex != null) base.push("state_climate_prior");
  if (mode !== "BENCHMARK_FALLBACK") base.push("industry_recordable_rate_prior");
  return base;
}
