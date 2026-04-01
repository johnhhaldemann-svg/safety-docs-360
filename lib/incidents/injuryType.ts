/**
 * Structured injury mechanism / nature-of-injury classification for incidents.
 * Supports insurance-style analytics (cost, recovery, severity type) separate from `severity` (low–critical).
 */

export const INJURY_TYPES = [
  "strain",
  "sprain",
  "fracture",
  "laceration",
  "contusion",
  "burn",
  "amputation",
  "other",
] as const;

export type InjuryType = (typeof INJURY_TYPES)[number];

const SET = new Set<string>(INJURY_TYPES);

export function isInjuryType(value: string): value is InjuryType {
  return SET.has(value);
}

/** Returns null when empty or invalid (caller may treat as “unspecified”). */
export function normalizeInjuryType(input: unknown): InjuryType | null {
  const v = String(input ?? "").trim().toLowerCase();
  if (!v) return null;
  return isInjuryType(v) ? v : null;
}

export const INJURY_TYPE_LABELS: Record<InjuryType, string> = {
  strain: "Strain",
  sprain: "Sprain",
  fracture: "Fracture",
  laceration: "Laceration",
  contusion: "Contusion / bruise",
  burn: "Burn",
  amputation: "Amputation",
  other: "Other",
};
