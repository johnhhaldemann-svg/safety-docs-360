/**
 * Risk score helpers for Safety360 Risk Memory Engine (v1 heuristic).
 * Bands: Low 0–4, Moderate 5–8, High 9–12, Critical 13+
 */

import type { SeverityPotentialCode, WeatherConditionCode } from "@/lib/riskMemory/taxonomy";

export type RiskBand = "low" | "moderate" | "high" | "critical";

export function riskBandFromScore(score: number): RiskBand {
  if (score <= 4) return "low";
  if (score <= 8) return "moderate";
  if (score <= 12) return "high";
  return "critical";
}

const BASELINE_BY_SCOPE: Record<string, number> = {
  roofing: 4,
  excavation_trenching: 4,
  work_at_height: 4,
  crane_rigging_critical_lift: 4,
  confined_space: 4,
  hot_work: 3,
  electrical_work: 3,
  default: 2,
};

export function baselinePointsForScope(scopeCode: string | null | undefined): number {
  if (!scopeCode) return BASELINE_BY_SCOPE.default;
  return BASELINE_BY_SCOPE[scopeCode] ?? BASELINE_BY_SCOPE.default;
}

const WEATHER_MOD: Record<string, number> = {
  clear: 0,
  unknown: 0,
  rain: 1,
  heavy_rain: 2,
  snow: 2,
  ice: 2,
  windy: 1,
  high_wind: 3,
  lightning_risk: 3,
  extreme_heat: 2,
  high_humidity: 1,
  extreme_cold: 2,
  fog_low_visibility: 2,
  muddy_conditions: 2,
  wet_surfaces: 1,
  dusty_conditions: 1,
};

export function weatherModifier(code: WeatherConditionCode | string | null | undefined): number {
  if (!code) return 0;
  return WEATHER_MOD[String(code)] ?? 1;
}

const FAILED_CONTROL_MOD = 2;

const SEVERITY_MOD: Partial<Record<SeverityPotentialCode, number>> = {
  low_potential: 0,
  moderate_potential: 1,
  high_potential: 2,
  critical_potential: 4,
  positive_prevented: 0,
  none: 0,
  first_aid: 1,
  medical_treatment: 2,
  restricted_duty: 2,
  recordable: 3,
  lost_time: 4,
};

export function severityPotentialModifier(code: SeverityPotentialCode | string | null | undefined): number {
  if (!code) return 0;
  return SEVERITY_MOD[code as SeverityPotentialCode] ?? 1;
}

export type FacetScoreInput = {
  scope_of_work_code?: string | null;
  weather_condition_code?: string | null;
  failed_control_code?: string | null;
  potential_severity_code?: string | null;
  repeat_issue?: boolean;
  recent_near_miss?: boolean;
};

export function computeFacetRiskScore(input: FacetScoreInput): number {
  let score = baselinePointsForScope(input.scope_of_work_code);
  score += weatherModifier(input.weather_condition_code ?? null);
  if (input.failed_control_code) score += FAILED_CONTROL_MOD;
  score += severityPotentialModifier(input.potential_severity_code ?? null);
  if (input.repeat_issue) score += 2;
  if (input.recent_near_miss) score += 2;
  return Math.min(24, Math.max(0, score));
}

export type AggregatedRiskSummary = {
  score: number;
  band: RiskBand;
  sampleSize: number;
  baselineContribution: number;
};

export function aggregateFacetScores(rows: FacetScoreInput[]): AggregatedRiskSummary {
  if (rows.length === 0) {
    return { score: baselinePointsForScope(null), band: riskBandFromScore(baselinePointsForScope(null)), sampleSize: 0, baselineContribution: baselinePointsForScope(null) };
  }
  const scores = rows.map((r) => computeFacetRiskScore(r));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const rounded = Math.round(avg * 10) / 10;
  return {
    score: rounded,
    band: riskBandFromScore(rounded),
    sampleSize: rows.length,
    baselineContribution: baselinePointsForScope(null),
  };
}
