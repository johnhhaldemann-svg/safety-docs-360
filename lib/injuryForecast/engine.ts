import { computeBaselineLayer } from "./baseline";
import { computeFallbackLambdaCore } from "./benchmarkDefaults";
import { DYNAMIC_INJURY_FORECAST } from "./constants";
import { computeControlReliability } from "./controls";
import {
  bandFromScore,
  buildNarrative,
  buildRecommendedActions,
  buildTopRiskDrivers,
} from "./explainability";
import {
  BENCHMARK_FORECAST_USER_MESSAGE,
  benchmarkSourcesUsedList,
  clampConfidenceToMode,
  fallbackReasonForMode,
  getCredibilityWeightComposite,
  getForecastMode,
  getHybridBlendWeight,
} from "./forecastMode";
import { computeExposureMultiplier } from "./exposure";
import { computeFatigueMultiplier } from "./fatigue";
import { scoreLikelyInjuryTypes } from "./injuryTypes";
import { computeLeadingIndicatorPressure } from "./leadingIndicators";
import { defaultMlCalibrationHooks } from "./mlCalibration";
import { computeTrendMultiplier } from "./trend";
import type { DynamicForecastOutput, ForecastInput, ForecastRunContext, MlCalibrationHooks } from "./types";
import { computeUncertaintyMultiplier } from "./uncertainty";
import { computeWeatherMultiplier } from "./weather";

const { INTERPRETABLE_WEIGHT, ML_WEIGHT, LAMBDA_SCALE, MODEL_VERSION, FALLBACK_LAMBDA_SCALE, MIN_DISPLAY_RISK_SCORE } =
  DYNAMIC_INJURY_FORECAST;

function synthesizeRunContextFromForecastInput(input: ForecastInput): ForecastRunContext {
  const sor = input.leadingIndicators.sorCount;
  const capa = input.leadingIndicators.correctiveOpenCount;
  const inc = input.baseline.company.incidentCount;
  const signalRowCount = sor + capa + inc;
  const laborHours = Math.max(0, input.exposure.totalLaborHours);
  return {
    signalRowCount,
    incidentCount: inc,
    sorCount: sor,
    correctiveActionCount: capa,
    laborHours,
    distinctMonthsOfHistory: signalRowCount >= 22 ? 3 : signalRowCount >= 10 ? 2 : signalRowCount >= 4 ? 1 : 0,
    inspectionProxyCount: input.leadingIndicators.failedInspectionCount,
    completeness01: input.uncertainty.completeness,
    dataRecencyScore01: signalRowCount > 0 ? 0.58 : 0.12,
    dominantTradeLabels: [],
    monthIndex0: input.baseline.monthlyBenchmark?.monthIndex0 ?? 0,
    projectPhase: null,
    highRiskTaskTags: [],
    stateRateIndex: input.baseline.stateBenchmark?.rateIndex ?? null,
  };
}

/**
 * Core hybrid engine: interpretable Poisson-style λ, blended with a benchmark fallback when data is thin.
 *
 * λ_hybrid = w · λ_full + (1 − w) · λ_fallback
 * P = 1 - exp(-λ_hybrid)
 */
export function runDynamicInjuryForecastEngine(
  input: ForecastInput,
  options?: {
    hooks?: Partial<MlCalibrationHooks>;
    injuryTypeContext?: { textBlob: string; heatOutdoorExposure: number };
    /** Prefer live mapper context; otherwise a minimal context is synthesized from `ForecastInput`. */
    runContext?: ForecastRunContext;
  }
): DynamicForecastOutput {
  const hooks = { ...defaultMlCalibrationHooks, ...options?.hooks };

  const runContext = options?.runContext ?? synthesizeRunContextFromForecastInput(input);
  const mode = getForecastMode(runContext);
  const zComposite = getCredibilityWeightComposite(runContext);
  const hybridW = getHybridBlendWeight(mode, zComposite, runContext);

  const baseline = computeBaselineLayer({ ...input.baseline, credibilityZOverride: zComposite });
  const exposure = computeExposureMultiplier(input.exposure);
  const leading = computeLeadingIndicatorPressure(input.leadingIndicators);
  const controls = computeControlReliability(input.controls);
  const trend = computeTrendMultiplier(input.trend);
  const fatigue = computeFatigueMultiplier(input.fatigue);
  const weather = computeWeatherMultiplier(input.weather);
  const uncertainty = computeUncertaintyMultiplier(input.uncertainty);

  const baselineRisk = baseline.value;
  const exposureM = exposure.value;
  const leadTerm = 1 + leading.value;
  const controlTerm = 1 + controls.value;
  const trendM = trend.value;
  const fatigueM = fatigue.value;
  const weatherM = weather.value;
  const uncertaintyM = uncertainty.value;

  let fullLambda =
    baselineRisk *
    exposureM *
    leadTerm *
    controlTerm *
    trendM *
    fatigueM *
    weatherM *
    uncertaintyM;

  fullLambda *= LAMBDA_SCALE;

  const { lambdaCore: fallbackCore, components: fbComponents } = computeFallbackLambdaCore({
    tradeLabels:
      runContext.dominantTradeLabels.length > 0
        ? runContext.dominantTradeLabels
        : ["General Contractor"],
    monthIndex0: runContext.monthIndex0,
    weatherMultiplier: weatherM,
    stateRateIndex: runContext.stateRateIndex,
    projectPhase: runContext.projectPhase,
    taskTags: runContext.highRiskTaskTags,
  });
  const fallbackLambda30 = Math.max(1e-6, fallbackCore * FALLBACK_LAMBDA_SCALE);

  let lambda30 = hybridW * fullLambda + (1 - hybridW) * fallbackLambda30;
  if (!Number.isFinite(lambda30) || lambda30 <= 0) {
    lambda30 = fallbackLambda30;
  }

  const interpretableProbability = 1 - Math.exp(-Math.max(0, lambda30));
  const mlScore = hooks.predictProbability({ lambda30, interpretableProbability });
  const blendedProbability = INTERPRETABLE_WEIGHT * interpretableProbability + ML_WEIGHT * mlScore;

  let riskScore0_100 = Math.round(Math.min(100, Math.max(0, blendedProbability * 100)));
  riskScore0_100 = Math.max(MIN_DISPLAY_RISK_SCORE, riskScore0_100);

  const riskBand = bandFromScore(riskScore0_100);

  const layers = {
    baseline,
    exposureMultiplier: exposure,
    leadingIndicatorPressure: leading,
    controlFailurePressure: controls,
    trendMultiplier: trend,
    fatigueMultiplier: fatigue,
    weatherMultiplier: weather,
    uncertaintyMultiplier: uncertainty,
  };

  const topRiskDrivers = buildTopRiskDrivers(layers);
  const trendDirection = trend.raw.direction;
  const confidenceScore = clampConfidenceToMode(mode, uncertainty.raw.confidenceScore);

  const injuryScores =
    options?.injuryTypeContext != null
      ? scoreLikelyInjuryTypes({
          textBlob: options.injuryTypeContext.textBlob,
          weather: input.weather,
          heatOutdoorExposure: options.injuryTypeContext.heatOutdoorExposure,
        })
      : [];

  const likelyInjuryTypes = hooks.predictInjuryTypes(injuryScores);

  const assumptions: string[] = [];
  if (input.exposure.assumed) assumptions.push("Some exposure inputs were defaulted (tasks, trades, equipment).");
  if (input.leadingIndicators.assumed) assumptions.push("Some leading-indicator feeds (near miss, inspections, permits) are not wired — using zeros or proxies.");
  if (
    input.controls.metrics.length > 0 &&
    input.controls.metrics.every((m) => Boolean(m.assumed))
  ) {
    assumptions.push("Control metrics are placeholders until compliance integrations exist.");
  }
  if (input.uncertainty.assumed) assumptions.push("Data-quality rates partially inferred from signal shape, not ETL audits.");
  if (mode !== "FULL_DATA") {
    assumptions.push(
      `Forecast mode ${mode}: blended λ (hybrid weight ${hybridW.toFixed(2)} on full model, ${(1 - hybridW).toFixed(2)} on benchmark core). Fallback core components: ${JSON.stringify(fbComponents)}.`
    );
  }

  const usedFallbackDefaults =
    mode === "BENCHMARK_FALLBACK" || (mode === "PARTIAL_DATA" && hybridW < 0.55);
  const fallbackReason = fallbackReasonForMode(mode, runContext);
  const benchmarkSourcesUsed = benchmarkSourcesUsedList(mode, runContext);

  const dataNote =
    mode === "BENCHMARK_FALLBACK"
      ? runContext.signalRowCount > 0
        ? `${BENCHMARK_FORECAST_USER_MESSAGE} Your logged signals still move the estimate (${(hybridW * 100).toFixed(0)}% site-specific model, ${((1 - hybridW) * 100).toFixed(0)}% sector defaults).`
        : BENCHMARK_FORECAST_USER_MESSAGE
      : mode === "PARTIAL_DATA"
        ? "Partial-data mode: your safety signals are blended with internal trade and season benchmarks; confidence rises as observations, corrective actions, inspections, and exposure hours accumulate."
        : undefined;

  const actions = buildRecommendedActions(layers);
  if (mode === "BENCHMARK_FALLBACK" || hybridW < 0.45) {
    actions.unshift(
      "Log observations, corrective actions, incidents, and exposure hours in the safety system so this forecast can move off benchmark defaults."
    );
  }

  return {
    modelVersion: MODEL_VERSION,
    lambda30,
    probability30d: blendedProbability,
    riskScore0_100,
    riskBand,
    interpretableProbability,
    mlCalibrationScore: mlScore,
    blendedModelScore: blendedProbability,
    topRiskDrivers,
    weakestControls: controls.raw.weakest,
    trendDirection,
    confidenceScore,
    likelyInjuryTypes,
    narrativeSummary: buildNarrative({
      probability30d: blendedProbability,
      trendDirection,
      drivers: topRiskDrivers,
      confidenceScore,
      dataSufficiencyNote: dataNote,
    }),
    recommendedActions: actions.slice(0, 7),
    layers,
    assumptions,
    forecastMode: mode,
    usedFallbackDefaults,
    fallbackReason,
    benchmarkSourcesUsed,
    hybridBlendWeight: hybridW,
    fallbackLambda30,
  };
}
