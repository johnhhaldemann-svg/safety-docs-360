import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { DataQualityInput, DataQualityMetric, LayerOutput } from "./types";

const U = DYNAMIC_INJURY_FORECAST.UNCERTAINTY;
const C = DYNAMIC_INJURY_FORECAST.CONFIDENCE;

/**
 * Uncertainty multiplier: poor data hygiene inflates λ modestly (we are less sure the forecast is tight).
 */
export function computeUncertaintyMultiplier(input: DataQualityInput): LayerOutput<{ confidenceScore: number; metrics: DataQualityMetric[] }> {
  const incomplete = clamp01(1 - input.completeness);
  const bump =
    U.W_INCOMPLETE * incomplete +
    U.W_TRADE_MAP * clamp01(input.missingTradeMappingRate) +
    U.W_LATE * clamp01(input.lateEntryRate) +
    U.W_SEV * clamp01(input.missingSeverityRate) +
    U.W_CLOSEOUT * clamp01(input.missingCloseoutRate) +
    U.W_STALE * clamp01(input.staleDataRate);

  const mult = Math.min(U.MAX_MULTIPLIER, 1 + bump);

  const confidenceScore =
    100 *
    clamp01(
      C.W_COMPLETE * clamp01(input.completeness) +
        C.W_FRESH * clamp01(1 - input.staleDataRate) +
        C.W_MAPPING * clamp01(1 - input.missingTradeMappingRate) +
        C.W_CLOSEOUT * clamp01(1 - input.missingCloseoutRate) +
        C.W_CONSISTENCY * clamp01(1 - (input.lateEntryRate + input.missingSeverityRate) / 2)
    );

  const metrics: DataQualityMetric[] = [
    { id: "completeness", label: "Data completeness", value: clamp01(input.completeness), assumed: Boolean(input.assumed?.completeness) },
    { id: "tradeMap", label: "Trade mapping quality", value: clamp01(1 - input.missingTradeMappingRate) },
    { id: "freshness", label: "Freshness", value: clamp01(1 - input.staleDataRate) },
  ];

  return {
    value: mult,
    detail: `Data-quality gaps add uncertainty bump → ×${mult.toFixed(3)}; confidence score ${confidenceScore.toFixed(0)}.`,
    raw: { confidenceScore, metrics },
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
