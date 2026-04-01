/**
 * Equipment / object involved (links SOR → hazard → outcome). API field: `source`.
 * DB column: `injury_source`.
 */

export const INCIDENT_SOURCES = [
  "ladder",
  "scaffold",
  "hand_tools",
  "heavy_equipment",
  "material_handling",
  "electrical_system",
  "other",
] as const;

export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

const SET = new Set<string>(INCIDENT_SOURCES);

export function isIncidentSource(value: string): value is IncidentSource {
  return SET.has(value);
}

/** Accepts canonical slugs or human phrases (e.g. "hand tools" → hand_tools). */
export function normalizeIncidentSource(input: unknown): IncidentSource | null {
  const v = String(input ?? "").trim().toLowerCase();
  if (!v) return null;
  const slug = v.replace(/[/\s-]+/g, "_").replace(/_+/g, "_");
  if (isIncidentSource(slug)) return slug;
  const aliases: Record<string, IncidentSource> = {
    hand_tool: "hand_tools",
    tools: "hand_tools",
    heavy_equip: "heavy_equipment",
    material: "material_handling",
    electrical: "electrical_system",
  };
  return aliases[slug] ?? null;
}

export const INCIDENT_SOURCE_LABELS: Record<IncidentSource, string> = {
  ladder: "Ladder",
  scaffold: "Scaffold",
  hand_tools: "Hand tools",
  heavy_equipment: "Heavy equipment",
  material_handling: "Material handling",
  electrical_system: "Electrical system",
  other: "Other",
};
