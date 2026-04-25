/**
 * Risk heatmap cell styling: t is cell/max (0–1) relative density.
 */
export function heatmapCellClassName(t: number) {
  if (t >= 0.75) return "border border-[rgba(209,98,98,0.24)] bg-[rgba(255,232,232,0.96)]";
  if (t >= 0.5) return "border border-[rgba(217,164,65,0.26)] bg-[rgba(255,242,218,0.96)]";
  if (t >= 0.25) return "border border-[var(--app-accent-border-22)] bg-[rgba(232,240,255,0.98)]";
  if (t > 0) return "border border-[rgba(46,158,91,0.22)] bg-[rgba(232,247,237,0.96)]";
  return "border border-[rgba(198,212,236,0.85)] bg-[rgba(246,249,255,0.96)]";
}

export const HEATMAP_LEGEND_STEPS: Array<{
  t: number;
  label: string;
  sampleClass: string;
}> = [
  { t: 0, label: "No activity", sampleClass: heatmapCellClassName(0) },
  { t: 0.12, label: "Low", sampleClass: heatmapCellClassName(0.12) },
  { t: 0.35, label: "Medium", sampleClass: heatmapCellClassName(0.35) },
  { t: 0.65, label: "High", sampleClass: heatmapCellClassName(0.65) },
  { t: 0.9, label: "Very high (vs max in window)", sampleClass: heatmapCellClassName(0.9) },
];
