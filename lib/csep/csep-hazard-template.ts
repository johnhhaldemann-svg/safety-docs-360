export const CSEP_HAZARD_TEMPLATE_SLICES = [
  "Risk",
  "Required controls",
  "How controls are met and verified",
  "Stop-work / hold-point triggers",
  "Applicable references",
] as const;

export type CsepHazardTemplateSlice = (typeof CSEP_HAZARD_TEMPLATE_SLICES)[number];

export function buildHazardSliceTitle(
  hazardName: string,
  slice: CsepHazardTemplateSlice
) {
  return `${hazardName}: ${slice}`;
}
