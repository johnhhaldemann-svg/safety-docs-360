import type { DataConfidenceLevel } from "@/lib/injuryWeather/types";

/**
 * Data-density rubric (aligned with `computeConfidenceRubric` in `ai.ts`).
 * Use this when building `DashboardSummary` before the full `InjuryWeatherDashboardData` exists.
 */
export function computeDataConfidenceFromMetrics(
  predictedObservations: number,
  trendLength: number,
  availableMonthsCount: number
): DataConfidenceLevel {
  if (predictedObservations === 0) return "LOW";
  if (predictedObservations < 12 || trendLength < 3 || availableMonthsCount < 2) return "LOW";
  if (predictedObservations >= 45 && trendLength >= 5 && availableMonthsCount >= 4) return "HIGH";
  return "MEDIUM";
}

/**
 * How to read the **structural risk band** (LOW / MODERATE / HIGH / CRITICAL) next to this data-confidence level.
 * Avoids implying “LOW confidence” means “LOW risk” — confidence is about evidence, not hazard level.
 */
export function riskBandMeaningForDataConfidence(confidence: DataConfidenceLevel): string {
  switch (confidence) {
    case "LOW":
      return "Estimate based on baseline only";
    case "HIGH":
      return "Confirmed by live data";
    default:
      return "Partially supported by live signals";
  }
}
