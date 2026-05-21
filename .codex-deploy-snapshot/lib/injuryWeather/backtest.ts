import type { InjuryWeatherBacktestResult, InjuryWeatherBacktestRow } from "@/lib/injuryWeather/types";

/** Pearson product-moment correlation; needs ≥3 pairs and non-zero variance in both series. */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const vx = xs[i]! - mx;
    const vy = ys[i]! - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function rankify(values: number[]): number[] {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.v === sorted[i]!.v) j += 1;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) ranks[sorted[k]!.i] = avg;
    i = j;
  }
  return ranks;
}

export function spearmanCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  return pearsonCorrelation(rankify(xs), rankify(ys));
}

export function computeBacktestCorrelations(rows: InjuryWeatherBacktestRow[]): Pick<
  InjuryWeatherBacktestResult,
  | "pearsonStructuralVsIncidents"
  | "spearmanStructuralVsIncidents"
  | "pearsonLikelihoodVsIncidents"
  | "spearmanLikelihoodVsIncidents"
  | "pearsonCasesVsIncidents"
  | "spearmanCasesVsIncidents"
> {
  const y = rows.map((r) => r.incidentsNextMonth);
  const likelihood = rows.map((r) => r.injuryChancePct);
  const cases = rows.map((r) => r.projectedCaseEstimate);
  const structuralRows = rows.filter((r) => r.structuralRiskScore != null);
  const yS = structuralRows.map((r) => r.incidentsNextMonth);
  const structuralVals = structuralRows.map((r) => r.structuralRiskScore!);

  return {
    pearsonLikelihoodVsIncidents: pearsonCorrelation(likelihood, y),
    spearmanLikelihoodVsIncidents: spearmanCorrelation(likelihood, y),
    pearsonCasesVsIncidents: pearsonCorrelation(cases, y),
    spearmanCasesVsIncidents: spearmanCorrelation(cases, y),
    pearsonStructuralVsIncidents: structuralRows.length >= 3 ? pearsonCorrelation(structuralVals, yS) : null,
    spearmanStructuralVsIncidents: structuralRows.length >= 3 ? spearmanCorrelation(structuralVals, yS) : null,
  };
}

/** Compare latest Pearson r to previous run (structural vs incidents). Heuristic only. */
export function inferCalibrationTrend(
  current: number | null,
  previous: number | null
): "improving" | "flat" | "worsening" | "unknown" {
  if (current == null || previous == null) return "unknown";
  const delta = current - previous;
  if (delta > 0.05) return "improving";
  if (delta < -0.05) return "worsening";
  return "flat";
}
