import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { ExposureLayerInput, LayerOutput } from "./types";

const E = DYNAMIC_INJURY_FORECAST.EXPOSURE;

/**
 * Exposure multiplier: more hours, people, concurrent trades, and equipment raise opportunity for events.
 * Uses log dampening so very large sites do not explode λ without bound, then clamps.
 */
export function computeExposureMultiplier(input: ExposureLayerInput): LayerOutput<{ components: Record<string, number> }> {
  const h = Math.max(0, input.totalLaborHours);
  const hc = Math.max(0, input.activeHeadcount);
  const hr = Math.max(0, input.highRiskTaskCount);
  const st = Math.max(0, input.simultaneousTrades);
  const eq = Math.max(0, input.equipmentOperationsCount);

  const cH = E.LN_HOURS_COEF * Math.log1p(h);
  const cHc = E.LN_HEADCOUNT_COEF * Math.log1p(hc);
  const cR = E.LN_HIGH_RISK_TASKS_COEF * Math.log1p(hr);
  const cS = E.LN_SIMULT_TRADES_COEF * Math.log1p(st);
  const cE = E.LN_EQUIPMENT_COEF * Math.log1p(eq);

  const raw = 1 + cH + cHc + cR + cS + cE;
  const value = Math.min(E.MAX_MULTIPLIER, Math.max(1, raw));
  return {
    value,
    detail: `1 + log terms (hours, headcount, high-risk tasks, trades, equipment) → ${value.toFixed(3)} (cap ${E.MAX_MULTIPLIER}).`,
    raw: { components: { hours: cH, headcount: cHc, highRisk: cR, trades: cS, equipment: cE } },
  };
}
