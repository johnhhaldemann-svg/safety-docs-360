import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { LayerOutput, TrendDirection, TrendLayerInput } from "./types";

const T = DYNAMIC_INJURY_FORECAST.TREND;

/**
 * Trend multiplier: compares recent 30d signal rate to prior 90d. Faster activity → higher λ until capped.
 */
export function computeTrendMultiplier(input: TrendLayerInput): LayerOutput<{ direction: TrendDirection }> {
  const recent = Math.max(0, input.recent30DaySignalRate);
  const prior = Math.max(0.01, input.prior90DaySignalRate);
  const rel = (recent - prior) / prior;
  let mult = 1 + T.SENSITIVITY * rel;
  mult = Math.min(T.MAX_MULT, Math.max(T.MIN_MULT, mult));

  let direction: TrendDirection = "stable";
  if (rel > T.STABLE_EPS) direction = "rising";
  else if (rel < -T.STABLE_EPS) direction = "falling";

  return {
    value: mult,
    detail: `Recent vs prior signal rate → trend multiplier ${mult.toFixed(3)} (${direction}).`,
    raw: { direction },
  };
}
