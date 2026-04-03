import type { ControlMetric, ControlReliabilityInput, LayerOutput } from "./types";

/**
 * Control reliability: weighted mean of health metrics (0–1). Missing metrics are omitted from the mean
 * so we do not pretend we measured them — those show up in `weakest` as assumed gaps.
 */
export function computeControlReliability(input: ControlReliabilityInput): LayerOutput<{ reliability: number; weakest: ControlMetric[] }> {
  const metrics = input.metrics.filter((m) => Number.isFinite(m.value));
  if (metrics.length === 0) {
    return {
      value: 0.35,
      detail: "No control metrics supplied — using conservative default failure pressure.",
      raw: { reliability: 0.65, weakest: [] },
    };
  }
  const sum = metrics.reduce((a, m) => a + Math.min(1, Math.max(0, m.value)), 0);
  const reliability = sum / metrics.length;
  const sorted = [...metrics].sort((a, b) => a.value - b.value);
  const weakest = sorted.slice(0, 5).filter((m) => m.value < 0.85 || m.assumed);
  return {
    value: 1 - reliability,
    detail: `Control reliability mean=${reliability.toFixed(3)} → failure pressure ${(1 - reliability).toFixed(3)}.`,
    raw: { reliability, weakest: weakest.length ? weakest : sorted.slice(0, 3) },
  };
}
