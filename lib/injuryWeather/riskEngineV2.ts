/**
 * Injury Weather — V2 weighted risk engine (defensible scoring, not flat row counts).
 * AI consumes `explainability` + summary; it does not invent the numeric score.
 */

import type {
  NormalizedLiveSignalRow,
  RiskEngineV2Explainability,
  RiskLevel,
} from "@/lib/injuryWeather/types";

export const RISK_ENGINE_V2_VERSION = "3.0.0" as const;

export type { NormalizedLiveSignalRow, RiskEngineV2Explainability };

const SOURCE_WEIGHT: Record<NormalizedLiveSignalRow["source"], number> = {
  sor: 1.0,
  corrective_action: 1.6,
  incident: 3.2,
};

const SEVERITY_WEIGHT: Record<NormalizedLiveSignalRow["severity"], number> = {
  low: 1.0,
  medium: 1.4,
  high: 2.3,
  critical: 3.8,
};

export function normalizeSeverity(raw: string): NormalizedLiveSignalRow["severity"] {
  const s = String(raw ?? "medium").toLowerCase().trim();
  if (s === "low" || s === "medium" || s === "high" || s === "critical") return s;
  return "medium";
}

export function recencyWeight(ageDays: number): number {
  if (ageDays <= 30) return 1.5;
  if (ageDays <= 90) return 1.2;
  if (ageDays <= 180) return 1.0;
  return 0.8;
}

/** Circular month distance 0 = same month, 1 = adjacent, else other. */
export function seasonalityWeight(created: Date, forecastMonthStart: Date): number {
  const cm = created.getMonth();
  const fm = forecastMonthStart.getMonth();
  const d = Math.min(Math.abs(cm - fm), 12 - Math.abs(cm - fm));
  if (d === 0) return 1.4;
  if (d === 1) return 1.15;
  return 0.9;
}

function ageDays(createdAt: Date, asOf: Date): number {
  return Math.max(0, (asOf.getTime() - createdAt.getTime()) / 86400000);
}

export type ScoredRow = NormalizedLiveSignalRow & {
  rowRiskScore: number;
  sourceW: number;
  severityW: number;
  recencyW: number;
  seasonalityW: number;
};

function scaleToUnit(raw: number, halfSaturation: number): number {
  if (raw <= 0) return 0;
  return (100 * raw) / (raw + halfSaturation);
}

function bandFromFinal(score: number): RiskEngineV2Explainability["bandLabel"] {
  if (score <= 24) return "Low";
  if (score <= 49) return "Moderate";
  if (score <= 74) return "High";
  return "Severe";
}

export function bandLabelToRiskLevel(band: RiskEngineV2Explainability["bandLabel"]): RiskLevel {
  if (band === "Low") return "LOW";
  if (band === "Moderate") return "MODERATE";
  if (band === "High") return "HIGH";
  return "CRITICAL";
}

function isCorrectiveOpen(status: string | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  if (s === "verified_closed" || s === "closed" || s === "corrected") return false;
  return true;
}

export function scoreRowsForForecast(
  rows: NormalizedLiveSignalRow[],
  forecastMonthStart: Date,
  asOf: Date,
  options?: { excludedRowCount?: number }
): { scored: ScoredRow[]; explainability: RiskEngineV2Explainability } {
  const scored: ScoredRow[] = [];
  let sourceFactorMass = 0;
  let severityFactorMass = 0;
  let recencyFactorMass = 0;
  let seasonalityFactorMass = 0;
  let rowRiskSum = 0;

  const severityMix = { low: 0, medium: 0, high: 0, critical: 0 };
  const sourceMix = { sor: 0, corrective_action: 0, incident: 0 };

  for (const row of rows) {
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) continue;

    const sw = SOURCE_WEIGHT[row.source];
    const sevW = SEVERITY_WEIGHT[row.severity];
    const age = ageDays(created, asOf);
    const rw = recencyWeight(age);
    const sew = seasonalityWeight(created, forecastMonthStart);
    const rowRisk = sw * sevW * rw * sew;

    scored.push({
      ...row,
      rowRiskScore: rowRisk,
      sourceW: sw,
      severityW: sevW,
      recencyW: rw,
      seasonalityW: sew,
    });
    sourceFactorMass += sw;
    severityFactorMass += sevW;
    recencyFactorMass += rw;
    seasonalityFactorMass += sew;
    rowRiskSum += rowRisk;
    severityMix[row.severity] += 1;
    sourceMix[row.source] += 1;
  }

  let totalSignalScore = 0;
  let highSeveritySignalScore = 0;
  let incidentPressureScore = 0;
  let unresolvedCorrectiveActionScore = 0;
  const pairCounts = new Map<string, number>();

  for (const r of scored) {
    totalSignalScore += r.rowRiskScore;
    if (r.severity === "high" || r.severity === "critical") highSeveritySignalScore += r.rowRiskScore;
    if (r.source === "incident") incidentPressureScore += r.rowRiskScore;
    if (r.source === "corrective_action" && isCorrectiveOpen(r.status)) {
      unresolvedCorrectiveActionScore += r.rowRiskScore;
    }
    const key = `${r.tradeId}::${r.categoryId ?? r.categoryLabel}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  let recurrenceScore = 0;
  let repeatClusters = 0;
  for (const [, c] of pairCounts) {
    if (c >= 2) {
      repeatClusters += 1;
      recurrenceScore += (c - 1) * 8;
    }
  }

  const monthlyMass = new Map<string, number>();
  for (const r of scored) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMass.set(key, (monthlyMass.get(key) ?? 0) + r.rowRiskScore);
  }
  const sortedMonths = [...monthlyMass.keys()].sort();
  const vals = sortedMonths.map((k) => monthlyMass.get(k) ?? 0);
  let recentTrendSlope = 0;
  if (vals.length >= 2) {
    const last = vals[vals.length - 1] ?? 0;
    const prev = vals[vals.length - 2] ?? 0;
    recentTrendSlope = last - prev;
  }

  let daysSinceLastIncident: number | null = null;
  const incidents = scored.filter((r) => r.source === "incident");
  if (incidents.length > 0) {
    const latest = incidents.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b));
    daysSinceLastIncident = Math.round(ageDays(new Date(latest.created_at), asOf));
  }

  const half = {
    total: 120,
    high: 55,
    incident: 35,
    recurrence: 25,
    unresolved: 30,
  };

  const scaled = {
    totalSignalScore: scaleToUnit(totalSignalScore, half.total),
    highSeveritySignalScore: scaleToUnit(highSeveritySignalScore, half.high),
    incidentPressureScore: scaleToUnit(incidentPressureScore, half.incident),
    recurrenceScore: scaleToUnit(recurrenceScore, half.recurrence),
    unresolvedCorrectiveActionScore: scaleToUnit(unresolvedCorrectiveActionScore, half.unresolved),
  };

  const finalRiskScore =
    scaled.totalSignalScore * 0.3 +
    scaled.highSeveritySignalScore * 0.25 +
    scaled.incidentPressureScore * 0.2 +
    scaled.recurrenceScore * 0.15 +
    scaled.unresolvedCorrectiveActionScore * 0.1;

  const bandLabel = bandFromFinal(finalRiskScore);
  const inferred = rows.filter((r) => r.usedCategoryInference).length;
  const tradeNormalizationSummary =
    inferred === 0
      ? "All trades resolved from SOR trade field + alias table."
      : `${inferred} of ${rows.length} rows used category-text trade fallback (CAPA/incident or missing SOR trade).`;

  const leadingIndicatorWeightedScore = scored.filter((r) => r.source === "sor").reduce((s, r) => s + r.rowRiskScore, 0);
  const correctivePressureScore = scored
    .filter((r) => r.source === "corrective_action")
    .reduce((s, r) => s + r.rowRiskScore, 0);
  const laggingIndicatorScore = incidentPressureScore;

  const modelConfidenceHint = Math.min(
    1,
    Math.max(
      0.35,
      0.35 + (rows.length / 80) * 0.35 + (repeatClusters > 0 ? 0.1 : 0) + (incidents.length > 0 ? 0.1 : 0)
    )
  );

  const bySourceRisk = { sor: 0, corrective_action: 0, incident: 0 };
  for (const r of scored) bySourceRisk[r.source] += r.rowRiskScore;
  const denomShare = rowRiskSum > 0 ? rowRiskSum : 1;
  const sourceRiskScoreShare = {
    sor: bySourceRisk.sor / denomShare,
    corrective_action: bySourceRisk.corrective_action / denomShare,
    incident: bySourceRisk.incident / denomShare,
  };
  const meanRecencyWeight = scored.length ? recencyFactorMass / scored.length : 1;
  const meanSeasonalityWeight = scored.length ? seasonalityFactorMass / scored.length : 1;

  return {
    scored,
    explainability: {
      riskEngineVersion: RISK_ENGINE_V2_VERSION,
      includedRowCount: rows.length,
      excludedRowCount: options?.excludedRowCount ?? 0,
      tradeNormalizationSummary,
      sourceMix,
      leadingIndicatorWeightedScore,
      correctivePressureScore,
      laggingIndicatorScore,
      severityMix,
      weightedTotals: {
        sourceFactorMass,
        severityFactorMass,
        recencyFactorMass,
        seasonalityFactorMass,
        rowRiskScoreSum: rowRiskSum,
      },
      componentScoresRaw: {
        totalSignalScore,
        highSeveritySignalScore,
        incidentPressureScore,
        recurrenceScore,
        unresolvedCorrectiveActionScore,
      },
      componentScoresScaled: scaled,
      recentTrendSlope,
      daysSinceLastIncident,
      tradeCategoryRepeatClusters: repeatClusters,
      finalRiskScore,
      bandLabel,
      modelConfidenceHint,
      sourceRiskScoreShare,
      meanRecencyWeight,
      meanSeasonalityWeight,
    },
  };
}
