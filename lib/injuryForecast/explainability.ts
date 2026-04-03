import type {
  DynamicForecastLayerBundle,
  DynamicRiskBand,
  RiskDriver,
  TrendDirection,
} from "./types";

function bandFromScore(score: number): DynamicRiskBand {
  if (score <= 24) return "Low";
  if (score <= 49) return "Moderate";
  if (score <= 74) return "High";
  return "Critical";
}

export function buildTopRiskDrivers(layers: DynamicForecastLayerBundle): RiskDriver[] {
  const drivers: RiskDriver[] = [];

  drivers.push({
    id: "baseline",
    label: "Baseline experience vs benchmarks",
    contribution: Math.min(1, layers.baseline.value * 8),
    detail: layers.baseline.detail,
  });
  drivers.push({
    id: "exposure",
    label: "Labor / concurrency exposure",
    contribution: Math.min(1, (layers.exposureMultiplier.value - 1) * 0.9),
    detail: layers.exposureMultiplier.detail,
  });
  drivers.push({
    id: "leading",
    label: "Leading-indicator pressure",
    contribution: Math.min(1, layers.leadingIndicatorPressure.value / 2.5),
    detail: layers.leadingIndicatorPressure.detail,
  });
  drivers.push({
    id: "controls",
    label: "Control gaps",
    contribution: Math.min(1, layers.controlFailurePressure.value),
    detail: layers.controlFailurePressure.detail,
  });
  drivers.push({
    id: "trend",
    label: "Recent momentum",
    contribution: Math.min(1, Math.abs(layers.trendMultiplier.value - 1) * 1.2),
    detail: layers.trendMultiplier.detail,
  });
  drivers.push({
    id: "fatigue",
    label: "Schedule / fatigue",
    contribution: Math.min(1, (layers.fatigueMultiplier.value - 1) * 2),
    detail: layers.fatigueMultiplier.detail,
  });
  drivers.push({
    id: "weather",
    label: "Environment",
    contribution: Math.min(1, (layers.weatherMultiplier.value - 1) * 1.5),
    detail: layers.weatherMultiplier.detail,
  });
  drivers.push({
    id: "uncertainty",
    label: "Data uncertainty",
    contribution: Math.min(1, (layers.uncertaintyMultiplier.value - 1) * 1.8),
    detail: layers.uncertaintyMultiplier.detail,
  });

  const maxC = Math.max(1e-6, ...drivers.map((d) => d.contribution));
  for (const d of drivers) d.contribution = d.contribution / maxC;
  drivers.sort((a, b) => b.contribution - a.contribution);
  return drivers.slice(0, 5);
}

export function buildNarrative(params: {
  probability30d: number;
  trendDirection: TrendDirection;
  drivers: RiskDriver[];
  confidenceScore: number;
  /** Appended when benchmark or heavy default blending is active. */
  dataSufficiencyNote?: string;
}): string {
  const pct = (params.probability30d * 100).toFixed(1);
  const top = params.drivers[0]?.label ?? "baseline mix";
  const core = `30-day probability ≈ ${pct}% (Poisson λ model, uncalibrated). Trend is ${params.trendDirection}; largest structured driver right now: ${top}. Confidence in data backing this run: ${params.confidenceScore.toFixed(0)}/100.`;
  return params.dataSufficiencyNote ? `${core} ${params.dataSufficiencyNote}` : core;
}

export function buildRecommendedActions(layers: DynamicForecastLayerBundle): string[] {
  const actions: string[] = [];
  const overdueMention = layers.leadingIndicatorPressure.raw.rates.overdue > 0.35;
  if (overdueMention) {
    actions.push("Close overdue corrective actions within 48 hours or re-baseline with documented extensions.");
  }
  if (layers.controlFailurePressure.raw.weakest.some((m) => /training/i.test(m.label) && m.value < 0.75)) {
    actions.push("Assign missing required training before the next shift covering affected tasks.");
  }
  if (layers.leadingIndicatorPressure.raw.severityWeightedObs > 1.2) {
    actions.push("Increase focused inspections on categories driving severe / critical observations this window.");
  }
  if (layers.weatherMultiplier.value > 1.18) {
    actions.push("Add weather-specific briefings (wind / heat / slips) tied to the active work package.");
  }
  if (layers.fatigueMultiplier.value > 1.2) {
    actions.push("Review schedule compression (hours, consecutive days, night work) against critical lifts and energized work.");
  }
  if (actions.length === 0) {
    actions.push("Maintain daily field verification on top trade/category themes from your safety signals.");
  }
  return actions.slice(0, 6);
}

export { bandFromScore };
