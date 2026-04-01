/**
 * Event / exposure classification (OSHA / BLS / loss-event coding), distinct from free-text `category`.
 * Stored as `exposure_event_type` on `company_incidents`; API uses camelCase `eventType`.
 */

export const EXPOSURE_EVENT_TYPES = [
  "fall_same_level",
  "fall_to_lower_level",
  "struck_by_object",
  "caught_in_between",
  "overexertion",
  "contact_with_equipment",
  "exposure_harmful_substance",
  "electrical",
  "other",
] as const;

export type ExposureEventType = (typeof EXPOSURE_EVENT_TYPES)[number];

const SET = new Set<string>(EXPOSURE_EVENT_TYPES);

export function isExposureEventType(value: string): value is ExposureEventType {
  return SET.has(value);
}

/** Returns null when empty or invalid. */
export function normalizeExposureEventType(input: unknown): ExposureEventType | null {
  const v = String(input ?? "").trim().toLowerCase();
  if (!v) return null;
  const slug = v.replace(/[/\s-]+/g, "_").replace(/_+/g, "_");
  if (isExposureEventType(slug)) return slug;
  const aliases: Record<string, ExposureEventType> = {
    exposure_to_harmful_substance: "exposure_harmful_substance",
    contact_with: "contact_with_equipment",
  };
  return aliases[slug] ?? null;
}

export const EXPOSURE_EVENT_TYPE_LABELS: Record<ExposureEventType, string> = {
  fall_same_level: "Fall on same level",
  fall_to_lower_level: "Fall to lower level",
  struck_by_object: "Struck by object",
  caught_in_between: "Caught in or between",
  overexertion: "Overexertion",
  contact_with_equipment: "Contact with equipment",
  exposure_harmful_substance: "Exposure to harmful substance",
  electrical: "Electrical",
  other: "Other / unspecified",
};
