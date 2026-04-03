import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { LayerOutput, LeadingIndicatorInput } from "./types";

const L = DYNAMIC_INJURY_FORECAST.LEADING;

/**
 * Severity-weighted observation density per reference hours, then blended with normalized rates.
 * Leading indicators lift risk before a loss occurs (SOR, near misses, overdue actions, etc.).
 */
export function computeLeadingIndicatorPressure(input: LeadingIndicatorInput): LayerOutput<{
  severityWeightedObs: number;
  rates: Record<string, number>;
}> {
  const { low, medium, high, critical } = input.severityCounts;
  const weighted =
    low * L.SEVERITY_LOW + medium * L.SEVERITY_MEDIUM + high * L.SEVERITY_HIGH + critical * L.SEVERITY_CRITICAL;
  const hours = Math.max(L.HOURS_PER_OBS_REF, input.totalHoursForNormalization);
  const severityWeightedObs = weighted / hours;

  const denom = Math.max(1, hours / 200);
  const nearMissRate = input.nearMissCount / denom;
  const inspectionFailureRate = input.failedInspectionCount / denom;
  const overdueRate = input.correctiveOverdueCount / Math.max(1, input.correctiveOpenCount + input.correctiveOverdueCount + 1);

  const normSev = Math.min(3, severityWeightedObs * 80);
  const normNm = Math.min(2.5, nearMissRate * 4);
  const normInsp = Math.min(2.5, inspectionFailureRate * 5);
  const normOd = Math.min(2.5, overdueRate * 3);

  let pressure =
    L.W_SEVERITY_NORM * normSev +
    L.W_NEAR_MISS * normNm +
    L.W_INSP_FAIL * normInsp +
    L.W_OVERDUE * normOd;

  pressure = Math.min(L.PRESSURE_CAP, Math.max(0, pressure));

  return {
    value: pressure,
    detail: `Normalized severity density + near-miss / inspection / overdue shape → pressure ${pressure.toFixed(3)}.`,
    raw: {
      severityWeightedObs: normSev,
      rates: { nearMiss: normNm, inspectionFail: normInsp, overdue: normOd },
    },
  };
}
