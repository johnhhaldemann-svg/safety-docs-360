/**
 * Event / exposure classification (OSHA / BLS / loss-event coding), distinct from free-text `category`.
 * Stored as `exposure_event_type` on `company_incidents`; API uses camelCase `eventType`.
 */

export const EXPOSURE_EVENT_TYPES = [
  "fall_same_level",
  "fall_to_lower_level",
  "slip_trip_without_fall",
  "struck_by_object",
  "struck_against_object",
  "struck_by_vehicle",
  "caught_in_between",
  "caught_on_object",
  "overexertion",
  "repetitive_motion",
  "contact_with_equipment",
  "exposure_harmful_substance",
  "electrical",
  "fire",
  "explosion",
  "structure_collapse",
  "excavation_collapse",
  "motor_vehicle",
  "drowning",
  "workplace_violence",
  "noise_exposure",
  "temperature_extreme",
  "confined_space",
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
    struck_against: "struck_against_object",
    slip_without_fall: "slip_trip_without_fall",
    trip_without_fall: "slip_trip_without_fall",
    trench_collapse: "excavation_collapse",
    violence: "workplace_violence",
    assault: "workplace_violence",
    heat_stress: "temperature_extreme",
    cold_stress: "temperature_extreme",
    vehicle: "motor_vehicle",
    mvo: "motor_vehicle",
  };
  return aliases[slug] ?? null;
}

export const EXPOSURE_EVENT_TYPE_LABELS: Record<ExposureEventType, string> = {
  fall_same_level: "Fall on same level",
  fall_to_lower_level: "Fall to lower level",
  slip_trip_without_fall: "Slip or trip without fall",
  struck_by_object: "Struck by object / flying / falling object",
  struck_against_object: "Struck against object or surface",
  struck_by_vehicle: "Struck by vehicle or mobile equipment",
  caught_in_between: "Caught in or compressed by equipment / objects",
  caught_on_object: "Caught on object or snagged",
  overexertion: "Overexertion / lifting / lowering",
  repetitive_motion: "Repetitive motion / ergonomic stress",
  contact_with_equipment: "Contact with equipment / machinery",
  exposure_harmful_substance: "Exposure to harmful substance",
  electrical: "Electrical contact / arc flash",
  fire: "Fire / flame contact",
  explosion: "Explosion / blast",
  structure_collapse: "Structure / building collapse",
  excavation_collapse: "Excavation / trench collapse",
  motor_vehicle: "Motor vehicle (road / transport) incident",
  drowning: "Drowning / submersion",
  workplace_violence: "Workplace violence / assault",
  noise_exposure: "Noise exposure event",
  temperature_extreme: "Temperature extreme (heat / cold)",
  confined_space: "Confined space event",
  other: "Other / unspecified",
};
