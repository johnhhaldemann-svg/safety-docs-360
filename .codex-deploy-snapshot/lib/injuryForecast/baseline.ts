import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { BaselineLayerInput, BaselineLayerOutput } from "./types";

const B = DYNAMIC_INJURY_FORECAST.BASELINE;

/**
 * Credibility weight z ∈ [Z_MIN, Z_MAX]: how much we trust company-specific incident history vs sector priors.
 * Very few events → lean on benchmarks; many → trust the employer rate more.
 */
export function getCredibilityWeight(incidentCount: number): number {
  const n = Math.max(0, incidentCount);
  let z: number;
  if (n <= B.SMALL_MAX) {
    z = B.Z_SMALL + (n / Math.max(1, B.SMALL_MAX)) * (B.Z_MED - B.Z_SMALL) * 0.35;
  } else if (n <= B.MEDIUM_MAX) {
    const t = (n - B.SMALL_MAX) / Math.max(1, B.MEDIUM_MAX - B.SMALL_MAX);
    z = B.Z_MED + t * (B.Z_LARGE - B.Z_MED) * 0.85;
  } else {
    z = B.Z_LARGE + Math.min(0.07, (n - B.MEDIUM_MAX) * 0.004);
  }
  return Math.min(B.Z_MAX, Math.max(B.Z_MIN, z));
}

/** Rough annualized injury intensity from incidents and hours (not OSHA TRIR — interpretable index). */
function companyRateIndex(input: BaselineLayerInput["company"]): number {
  const inc = Math.max(0, input.incidentCount);
  const hours = input.hoursWorked && input.hoursWorked > 0 ? input.hoursWorked : 0;
  const head = input.headcount && input.headcount > 0 ? input.headcount : 0;
  // Prefer hours; else scale by head * 520 h/qtr proxy for 90d window mis-use — keep simple
  const denom = hours > 0 ? hours / 2000 : head > 0 ? head * 0.25 : 1;
  const raw = inc / Math.max(0.25, denom);
  return Math.min(B.BENCHMARK_CAP, Math.max(0, raw * 0.08));
}

function blendBenchmarks(input: BaselineLayerInput): number {
  let r = Math.max(B.BENCHMARK_FLOOR, input.industryBenchmarkRate);
  if (input.tradeBenchmark?.rateIndex) r = r * (0.65 + 0.35 * input.tradeBenchmark.rateIndex);
  if (input.stateBenchmark?.rateIndex) r = r * (0.7 + 0.3 * input.stateBenchmark.rateIndex);
  if (input.monthlyBenchmark?.rateIndex) r = r * (0.75 + 0.25 * input.monthlyBenchmark.rateIndex);
  return Math.min(B.BENCHMARK_CAP, r);
}

/**
 * Baseline risk layer: credibility-weighted blend of employer experience and benchmark priors.
 */
export function computeBaselineLayer(input: BaselineLayerInput): BaselineLayerOutput {
  const z =
    input.credibilityZOverride !== undefined && Number.isFinite(input.credibilityZOverride)
      ? Math.min(B.Z_MAX, Math.max(B.Z_MIN, input.credibilityZOverride))
      : getCredibilityWeight(input.company.incidentCount);
  const company = companyRateIndex(input.company);
  const bench = blendBenchmarks(input);
  const baselineRisk = z * company + (1 - z) * bench;
  return {
    value: Math.max(B.BENCHMARK_FLOOR, baselineRisk),
    detail: `Credibility z=${z.toFixed(2)} blends company index (${company.toFixed(4)}) with benchmark (${bench.toFixed(4)}).`,
    raw: { credibilityZ: z, companyRate: company, blendedBenchmarkRate: bench, baselineRisk },
  };
}
