/**
 * Pure layout helpers for observation-count sparklines (Analytics and shared Sparkline).
 */

export type SparkPoint = { date: string; count: number };

const PLACEHOLDER: SparkPoint[] = [
  { date: "a", count: 0 },
  { date: "b", count: 0 },
];

export function resolveSparklineData(points: SparkPoint[]) {
  return points.length > 0 ? points : PLACEHOLDER;
}

export function sparkMaxY(data: Pick<SparkPoint, "count">[]) {
  return Math.max(1, ...data.map((d) => d.count));
}

export function buildAreaAndLinePath(
  data: SparkPoint[],
  w: number,
  h: number,
  padY: number,
): { dPath: string; maxY: number; step: number; padY: number; chartH: number } {
  const maxY = sparkMaxY(data);
  const chartH = h - padY * 2;
  const step = w / Math.max(1, data.length - 1);
  const dPath = data
    .map((row, i) => {
      const x = i * step;
      const y = h - padY - (row.count / maxY) * (chartH - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return { dPath, maxY, step, padY, chartH };
}

export function tickIndices(length: number): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  if (length === 2) return [0, 1];
  const mid = Math.floor((length - 1) / 2);
  if (mid === 0) return [0, length - 1];
  return [0, mid, length - 1];
}

export function formatShortAxisDate(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function sparklineAriaDescription(points: SparkPoint[], windowDays: number, loading: boolean) {
  if (loading) return "Loading observation trend.";
  if (points.length === 0) {
    return `No daily observation data in the last ${windowDays} days.`;
  }
  const data = points;
  const maxY = Math.max(...data.map((d) => d.count));
  const maxIdx = data.findIndex((d) => d.count === maxY);
  const peak = maxIdx >= 0 ? data[maxIdx] : data[0];
  const total = data.reduce((s, d) => s + d.count, 0);
  return [
    `Observation trend for the last ${windowDays} days.`,
    `${data.length} data points, ${total} observations total in series.`,
    maxY > 0
      ? `Peak ${maxY} on ${formatShortAxisDate(peak.date)}.`
      : "All zero counts in range.",
  ].join(" ");
}
