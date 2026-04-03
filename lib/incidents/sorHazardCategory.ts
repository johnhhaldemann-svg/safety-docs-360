import type { ExposureEventType } from "@/lib/incidents/exposureEventType";

/**
 * Normalized SOR hazard classes (leading indicators) mapped to incident `exposure_event_type`.
 */
export const SOR_HAZARD_CATEGORY_CODES = [
  "falls_same_level",
  "falls_elevation",
  "struck_by",
  "caught_in_between",
  "overexertion",
  "contact_equipment",
  "hazardous_substance",
  "electrical",
  "material_handling",
  "ppe_behavioral",
  "environmental",
  "other",
] as const;

export type SorHazardCategoryCode = (typeof SOR_HAZARD_CATEGORY_CODES)[number];

const SET = new Set<string>(SOR_HAZARD_CATEGORY_CODES);

export const SOR_HAZARD_CATEGORY_LABELS: Record<SorHazardCategoryCode, string> = {
  falls_same_level: "Falls — same level",
  falls_elevation: "Falls — from elevation",
  struck_by: "Struck by / flying object",
  caught_in_between: "Caught in or between",
  overexertion: "Overexertion / ergonomic",
  contact_equipment: "Contact with equipment / struck against",
  hazardous_substance: "Hazardous substance / chemical",
  electrical: "Electrical",
  material_handling: "Material handling / lifting",
  ppe_behavioral: "PPE / procedural / behavioral",
  environmental: "Environmental (noise, heat, confined space)",
  other: "Other / unspecified",
};

/** Primary incident exposure types implied by each SOR hazard class. */
export const SOR_HAZARD_TO_EXPOSURE_EVENTS: Record<SorHazardCategoryCode, readonly ExposureEventType[]> = {
  falls_same_level: ["fall_same_level", "slip_trip_without_fall"],
  falls_elevation: ["fall_to_lower_level"],
  struck_by: ["struck_by_object", "struck_by_vehicle"],
  caught_in_between: ["caught_in_between", "caught_on_object"],
  overexertion: ["overexertion", "repetitive_motion"],
  contact_equipment: ["contact_with_equipment", "struck_against_object"],
  hazardous_substance: ["exposure_harmful_substance"],
  electrical: ["electrical"],
  material_handling: ["overexertion", "contact_with_equipment", "repetitive_motion"],
  ppe_behavioral: ["other"],
  environmental: [
    "exposure_harmful_substance",
    "noise_exposure",
    "temperature_extreme",
    "confined_space",
    "other",
  ],
  other: ["other"],
};

export function isSorHazardCategoryCode(value: string): value is SorHazardCategoryCode {
  return SET.has(value);
}

export function normalizeSorHazardCategoryCode(input: unknown): SorHazardCategoryCode | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  if (!v) return null;
  if (isSorHazardCategoryCode(v)) return v;
  const aliases: Record<string, SorHazardCategoryCode> = {
    fall_same_level: "falls_same_level",
    fall_elevation: "falls_elevation",
    struck: "struck_by",
    caught_in: "caught_in_between",
    chemical: "hazardous_substance",
    substance: "hazardous_substance",
    ergonomics: "overexertion",
    equipment: "contact_equipment",
    lifting: "material_handling",
    ppe: "ppe_behavioral",
    behavioral: "ppe_behavioral",
  };
  return aliases[v] ?? null;
}

/** Infer code from legacy free-text `category` when explicit code was not stored. */
export function inferSorHazardCategoryFromLabel(category: string): SorHazardCategoryCode | null {
  const s = category.trim().toLowerCase();
  if (!s) return null;
  if (normalizeSorHazardCategoryCode(s)) return normalizeSorHazardCategoryCode(s);
  if (/fall|slip|trip/.test(s) && /elev|roof|ladder|scaffold|height/.test(s)) return "falls_elevation";
  if (/fall|slip|trip/.test(s)) return "falls_same_level";
  if (/struck|flying|hit by/.test(s)) return "struck_by";
  if (/caught|crush|pinch/.test(s)) return "caught_in_between";
  if (/lift|ergonomic|strain|twist/.test(s)) return "overexertion";
  if (/electric|arc|shock/.test(s)) return "electrical";
  if (/chem|dust|fume|gas|silica/.test(s)) return "hazardous_substance";
  if (/ppe|procedure|behavior|housekeeping/.test(s)) return "ppe_behavioral";
  if (/heat|cold|noise|confined/.test(s)) return "environmental";
  if (/material|load|rigging/.test(s)) return "material_handling";
  if (/equipment|machine|tool/.test(s)) return "contact_equipment";
  return null;
}

export function resolveSorHazardCategoryCode(input: {
  hazardCategoryCode?: unknown;
  category?: string;
}): SorHazardCategoryCode | null {
  const explicit = normalizeSorHazardCategoryCode(input.hazardCategoryCode);
  if (explicit) return explicit;
  return inferSorHazardCategoryFromLabel(String(input.category ?? ""));
}
