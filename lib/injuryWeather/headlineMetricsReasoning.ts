import type {
  InjuryWeatherAiInsights,
  InjuryWeatherDashboardData,
  RiskLevel,
} from "./types";

export type HeadlineMetricsReasoningOptions = {
  /** When true, overall risk badge may differ from the deterministic model. */
  aiForecastApplied?: boolean;
  /** Pre-AI overall band from `deterministicBaseline`, when returned by the API. */
  modelOverallRiskLevel?: RiskLevel | null;
};

function fmt(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/**
 * Plain-language, deterministic explanation of headline tiles (likelihood %, overall band, predicted-risk product).
 * Uses only fields already on the dashboard payload — no LLM text.
 */
export function buildHeadlineMetricsReasoning(
  data: InjuryWeatherDashboardData,
  aiInsights: InjuryWeatherAiInsights | null | undefined,
  options?: HeadlineMetricsReasoningOptions
): string[] {
  const s = data.summary;
  const loc = data.location;
  const p = data.signalProvenance;
  const diag = data.engineDiagnostics;
  const ex = data.riskEngineV2Explainability;
  const f = s.predictedRiskFactors;

  const weatherMult =
    loc.combinedWeatherFactor != null && Number.isFinite(loc.combinedWeatherFactor)
      ? loc.combinedWeatherFactor
      : loc.weatherRiskMultiplier;

  const structural =
    s.structuralRiskScore ??
    s.finalRiskScore ??
    s.overallRiskScore ??
    0;

  const lines: string[] = [];

  lines.push(
    `Next 30-day incident likelihood (${s.increasedIncidentRiskPercent}%): derived from structural score (~${fmt(structural, 1)}/100) via a linear ramp in the model, multiplied by the combined weather exposure factor (~${fmt(weatherMult, 2)} from state climate × trade sensitivity: ${loc.impactNote || "regional defaults"}), then clamped between 5% and 78%. This is an index, not a calibrated injury probability.`
  );

  const bandV2 = s.riskBandLabelV2 ?? ex?.bandLabel;
  const bandPhrase = bandV2 ? ` Structural band before mapping is “${bandV2}”.` : "";
  lines.push(
    `Overall risk level (${s.overallRiskLevel}): comes from the weighted structural (V2) engine on your safety rows in scope — severity, recency, seasonality, incidents, repeats, and corrective pressure — summarized as the headline structural score and mapped to LOW / MODERATE / HIGH / CRITICAL.${bandPhrase}`
  );

  const applied = Boolean(options?.aiForecastApplied);
  const modelBand = options?.modelOverallRiskLevel ?? null;
  if (applied) {
    if (modelBand && modelBand !== s.overallRiskLevel) {
      lines.push(
        `AI-adjusted forecast is active: the badge shows ${s.overallRiskLevel} while the deterministic model mapped to ${modelBand}. Likelihood % and predicted-risk product below still reflect the engine; use “Show model baseline” for the pre-AI snapshot.`
      );
    } else if (modelBand) {
      lines.push(
        "AI-adjusted forecast is active for some copy and category colors; the overall badge still matches the deterministic model on this run."
      );
    } else {
      lines.push(
        "AI-adjusted forecast may be active for copy and category colors; likelihood % and predicted-risk product still come from the engine."
      );
    }
  }

  lines.push(
    `Predicted risk (${fmt(s.predictedRisk, 2)}): product of six multipliers — historical baseline × ${fmt(f.historicalBaseline, 2)}, seasonal × ${fmt(f.seasonalFactor, 2)}, behavior × ${fmt(f.realTimeBehaviorFactor, 2)}, schedule × ${fmt(f.scheduleExposureFactor, 2)}, site × ${fmt(f.siteConditionFactor, 2)}, weather × ${fmt(f.weatherFactor, 2)}. Values near 1.0 are neutral; ${s.forecastMode === "baseline_only" ? "in baseline-only mode, behavior inputs are muted because in-window signals are sparse." : "live-adjusted mode folds logged signals into behavior and related terms where data exists."}`
  );

  const blend = p.blendNormalization;
  const blendNote =
    blend?.kind === "hours" && blend.denominator != null
      ? ` Exposure blend uses ${blend.denominator} hours worked.`
      : blend?.kind === "workforce" && blend.denominator != null
        ? ` Exposure blend uses workforce size ${blend.denominator}.`
        : " Exposure blend uses raw row shares unless hours or workforce are set.";

  const modeLine =
    p.mode === "live"
      ? `${p.sorRecords} SOR, ${p.correctiveActions} corrective actions, ${p.incidents} incidents in ${p.recordWindowLabel}.${blendNote}`
      : `Seed/offline workbook: ${p.seedWorkbookRows ?? 0} rows · ${p.recordWindowLabel}.${blendNote}`;

  lines.push(
    `Data confidence ${s.dataConfidence} / forecast mode (${s.forecastMode}): ${s.riskSignalCount} weighted safety signals in the current scope. Forecast confidence score ${fmt(s.forecastConfidenceScore ?? 0, 1)} reflects baseline vs live adjustment, not “how safe you are.” Inputs: ${modeLine}`
  );

  if (ex) {
    lines.push(
      `V2 explainability snapshot: ${ex.includedRowCount} rows included in the structural blend (${ex.sourceMix.sor} SOR / ${ex.sourceMix.corrective_action} CAPA / ${ex.sourceMix.incident} incidents), final weighted score ${fmt(ex.finalRiskScore, 1)} → band “${ex.bandLabel}”.`
    );
  }

  if (diag.seedOnlyMode) {
    lines.push(
      "Live database signals were not loaded (service configuration); headline structural and likelihood values use deterministic seed context until live data is available."
    );
  }

  if (aiInsights?.webResearchSupplement) {
    lines.push(
      "Public web research (when shown below) adds OSHA/NIOSH-style public context; it does not change the numeric tiles above."
    );
  }

  if (s.caseAllocationNote) {
    lines.push(s.caseAllocationNote);
  }

  return lines;
}
