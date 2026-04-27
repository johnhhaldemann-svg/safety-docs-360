export const CSEP_HAZARD_TEMPLATE_SLICES = [
  "Risk",
  "Required Controls",
  "How Controls Are Verified",
  "Stop-Work Triggers",
  "References",
] as const;

export type CsepHazardTemplateSlice = (typeof CSEP_HAZARD_TEMPLATE_SLICES)[number];

export function buildHazardSliceTitle(
  hazardName: string,
  slice: CsepHazardTemplateSlice
) {
  return `${hazardName}: ${slice}`;
}

