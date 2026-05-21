/**
 * Risk heatmap styling is based on the row's severity level, not count density.
 */
export function heatmapCellClassName(level: string, active = true) {
  if (!active) return "border border-[rgba(198,212,236,0.85)] bg-[rgba(246,249,255,0.96)]";

  const normalized = level.trim().toLowerCase();
  if (normalized === "critical") {
    return "border border-[rgba(209,72,72,0.34)] bg-[rgba(255,219,219,0.98)]";
  }
  if (normalized === "high") {
    return "border border-[rgba(220,112,112,0.24)] bg-[rgba(255,237,237,0.97)]";
  }
  if (normalized === "moderate" || normalized === "medium") {
    return "border border-[rgba(67,116,208,0.28)] bg-[rgba(219,232,255,0.98)]";
  }
  if (normalized === "low") {
    return "border border-[rgba(46,158,91,0.24)] bg-[rgba(232,247,237,0.97)]";
  }
  return "border border-[rgba(198,212,236,0.85)] bg-[rgba(246,249,255,0.96)]";
}

export const HEATMAP_LEGEND_STEPS: Array<{
  level: string;
  label: string;
  sampleClass: string;
}> = [
  { level: "", label: "No activity", sampleClass: heatmapCellClassName("", false) },
  { level: "Low", label: "Low", sampleClass: heatmapCellClassName("Low") },
  { level: "Moderate", label: "Moderate", sampleClass: heatmapCellClassName("Moderate") },
  { level: "High", label: "High", sampleClass: heatmapCellClassName("High") },
  { level: "Critical", label: "Critical", sampleClass: heatmapCellClassName("Critical") },
];
