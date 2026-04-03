/**
 * Structured injury mechanism / nature-of-injury classification for incidents.
 * Supports insurance-style analytics (cost, recovery, severity type) separate from `severity` (low–critical).
 */

export const INJURY_TYPES = [
  "abrasion",
  "amputation",
  "burn",
  "chemical_burn",
  "cold_injury",
  "concussion",
  "contusion",
  "crush_injury",
  "dislocation",
  "foreign_body",
  "fracture",
  "heat_illness",
  "hearing_loss",
  "insect_animal",
  "internal_injury",
  "laceration",
  "multiple_injuries",
  "poisoning",
  "puncture",
  "respiratory",
  "sprain",
  "strain",
  "vision_loss",
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
  abrasion: "Abrasion / scrape",
  amputation: "Amputation",
  burn: "Burn (thermal)",
  chemical_burn: "Chemical burn",
  cold_injury: "Cold injury / frostbite",
  concussion: "Concussion / head injury (non-fracture)",
  contusion: "Contusion / bruise",
  crush_injury: "Crushing injury",
  dislocation: "Dislocation",
  foreign_body: "Foreign body (splinter, embedded object)",
  fracture: "Fracture",
  heat_illness: "Heat illness / heat stress",
  hearing_loss: "Hearing loss / acoustic trauma",
  insect_animal: "Insect / animal bite or sting",
  internal_injury: "Internal injury / organ trauma",
  laceration: "Laceration / cut",
  multiple_injuries: "Multiple injury types",
  poisoning: "Poisoning / toxic exposure (systemic)",
  puncture: "Puncture wound",
  respiratory: "Respiratory irritation / illness",
  sprain: "Sprain",
  strain: "Strain",
  vision_loss: "Eye injury / vision loss",
  other: "Other",
};
