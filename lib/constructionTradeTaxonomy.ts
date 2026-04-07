/**
 * Canonical construction trade taxonomy (aligned across profile, CSEP, jobsite audits).
 * Field-audit scope keys map to checklist section bundles in `fieldAuditTradeScope.ts`.
 */

export type FieldAuditScopeKey =
  | "general_contractor"
  | "excavation_earthwork"
  | "demolition"
  | "framing"
  | "steel_erection"
  | "concrete"
  | "masonry"
  | "roofing"
  | "waterproofing"
  | "insulation"
  | "drywall"
  | "painting"
  | "flooring"
  | "ceiling_acoustical"
  | "glazing"
  | "electrical"
  | "plumbing"
  | "hvac"
  | "fire_protection"
  | "scaffold_access"
  | "equipment_crane_operations"
  | "utilities_underground"
  | "landscaping_site_work"
  | "carpentry"
  | "millwright_mechanical"
  | "other";

/** Buckets for CSEP library text (summary / OSHA / default PPE). */
export type CsepKind =
  | "site_earth"
  | "structural_steel_wood"
  | "structural_concrete_masonry"
  | "exterior_envelope"
  | "mep"
  | "interior_finishes"
  | "specialty_misc"
  | "heavy_civil"
  | "gc_cm"
  | "other_common";

export type ConstructionTradeDefinition = {
  slug: string;
  label: string;
  fieldScope: FieldAuditScopeKey;
  csepKind: CsepKind;
};

export const CONSTRUCTION_TRADE_DEFINITIONS: readonly ConstructionTradeDefinition[] = [
  // Site Work & Earthmoving
  {
    slug: "site_preparation_clearing",
    label: "Site Preparation / Clearing",
    fieldScope: "excavation_earthwork",
    csepKind: "site_earth",
  },
  {
    slug: "excavation_grading",
    label: "Excavation & Grading",
    fieldScope: "excavation_earthwork",
    csepKind: "site_earth",
  },
  { slug: "earthwork", label: "Earthwork", fieldScope: "excavation_earthwork", csepKind: "site_earth" },
  {
    slug: "foundation_work",
    label: "Foundation Work",
    fieldScope: "concrete",
    csepKind: "structural_concrete_masonry",
  },
  {
    slug: "pile_driving_deep_foundations",
    label: "Pile Driving / Deep Foundations",
    fieldScope: "concrete",
    csepKind: "structural_concrete_masonry",
  },
  { slug: "demolition", label: "Demolition", fieldScope: "demolition", csepKind: "site_earth" },
  // Structural & Framing
  { slug: "wood_framing", label: "Wood Framing", fieldScope: "framing", csepKind: "structural_steel_wood" },
  {
    slug: "steel_framing_structural_steel",
    label: "Steel Framing / Structural Steel",
    fieldScope: "steel_erection",
    csepKind: "structural_steel_wood",
  },
  {
    slug: "concrete_forming_placement",
    label: "Concrete Forming & Placement",
    fieldScope: "concrete",
    csepKind: "structural_concrete_masonry",
  },
  {
    slug: "masonry_brick_block_stone",
    label: "Masonry (Brick, Block, Stone)",
    fieldScope: "masonry",
    csepKind: "structural_concrete_masonry",
  },
  // Exterior Envelope
  { slug: "roofing", label: "Roofing", fieldScope: "roofing", csepKind: "exterior_envelope" },
  {
    slug: "siding_exterior_cladding",
    label: "Siding / Exterior Cladding",
    fieldScope: "waterproofing",
    csepKind: "exterior_envelope",
  },
  {
    slug: "waterproofing_sealants",
    label: "Waterproofing & Sealants",
    fieldScope: "waterproofing",
    csepKind: "exterior_envelope",
  },
  { slug: "insulation", label: "Insulation", fieldScope: "insulation", csepKind: "exterior_envelope" },
  {
    slug: "exterior_trim_millwork",
    label: "Exterior Trim & Millwork",
    fieldScope: "carpentry",
    csepKind: "exterior_envelope",
  },
  // MEP
  { slug: "hvac_mechanical", label: "HVAC / Mechanical", fieldScope: "hvac", csepKind: "mep" },
  { slug: "electrical", label: "Electrical", fieldScope: "electrical", csepKind: "mep" },
  { slug: "plumbing", label: "Plumbing", fieldScope: "plumbing", csepKind: "mep" },
  {
    slug: "fire_protection_sprinklers",
    label: "Fire Protection / Sprinklers",
    fieldScope: "fire_protection",
    csepKind: "mep",
  },
  {
    slug: "low_voltage_data_communications",
    label: "Low Voltage / Data / Communications",
    fieldScope: "electrical",
    csepKind: "mep",
  },
  // Interior Finishes
  {
    slug: "drywall_metal_stud_framing",
    label: "Drywall / Metal Stud Framing",
    fieldScope: "drywall",
    csepKind: "interior_finishes",
  },
  {
    slug: "painting_wall_covering",
    label: "Painting & Wall Covering",
    fieldScope: "painting",
    csepKind: "interior_finishes",
  },
  {
    slug: "flooring_tile_carpet_hardwood_concrete_polishing",
    label: "Flooring (Tile, Carpet, Hardwood, Concrete Polishing)",
    fieldScope: "flooring",
    csepKind: "interior_finishes",
  },
  {
    slug: "ceiling_systems",
    label: "Ceiling Systems",
    fieldScope: "ceiling_acoustical",
    csepKind: "interior_finishes",
  },
  {
    slug: "interior_trim_millwork",
    label: "Interior Trim & Millwork",
    fieldScope: "carpentry",
    csepKind: "interior_finishes",
  },
  // Specialty & Miscellaneous
  { slug: "glass_glazing", label: "Glass & Glazing", fieldScope: "glazing", csepKind: "specialty_misc" },
  {
    slug: "curtain_wall_storefront",
    label: "Curtain Wall / Storefront",
    fieldScope: "glazing",
    csepKind: "specialty_misc",
  },
  {
    slug: "elevators_escalators",
    label: "Elevators / Escalators",
    fieldScope: "millwright_mechanical",
    csepKind: "specialty_misc",
  },
  {
    slug: "tile_stone_setting",
    label: "Tile & Stone Setting",
    fieldScope: "flooring",
    csepKind: "specialty_misc",
  },
  { slug: "plaster_stucco", label: "Plaster / Stucco", fieldScope: "masonry", csepKind: "specialty_misc" },
  { slug: "welding", label: "Welding", fieldScope: "steel_erection", csepKind: "specialty_misc" },
  {
    slug: "scaffolding_hoisting",
    label: "Scaffolding & Hoisting",
    fieldScope: "scaffold_access",
    csepKind: "specialty_misc",
  },
  { slug: "rigging", label: "Rigging", fieldScope: "equipment_crane_operations", csepKind: "specialty_misc" },
  // Heavy Civil / Infrastructure
  {
    slug: "road_highway_construction",
    label: "Road & Highway Construction",
    fieldScope: "excavation_earthwork",
    csepKind: "heavy_civil",
  },
  {
    slug: "bridge_construction",
    label: "Bridge Construction",
    fieldScope: "steel_erection",
    csepKind: "heavy_civil",
  },
  {
    slug: "utility_underground_work",
    label: "Utility & Underground Work",
    fieldScope: "utilities_underground",
    csepKind: "heavy_civil",
  },
  { slug: "asphalt_paving", label: "Asphalt Paving", fieldScope: "landscaping_site_work", csepKind: "heavy_civil" },
  {
    slug: "landscaping_irrigation",
    label: "Landscaping & Irrigation",
    fieldScope: "landscaping_site_work",
    csepKind: "heavy_civil",
  },
  // Other common
  { slug: "carpentry_finish", label: "Carpentry (Finish)", fieldScope: "carpentry", csepKind: "other_common" },
  { slug: "sheet_metal", label: "Sheet Metal", fieldScope: "hvac", csepKind: "other_common" },
  {
    slug: "safety_environmental_services",
    label: "Safety / Environmental Services",
    fieldScope: "other",
    csepKind: "other_common",
  },
  {
    slug: "general_contractor",
    label: "General Contractor / Construction Manager",
    fieldScope: "general_contractor",
    csepKind: "gc_cm",
  },
  { slug: "other_not_listed", label: "Other / Not listed", fieldScope: "other", csepKind: "other_common" },
] as const;

/** Profile + CSEP dropdown labels (human-readable). */
export const CONSTRUCTION_TRADE_LABELS: readonly string[] = CONSTRUCTION_TRADE_DEFINITIONS.map((d) => d.label);

/** Jobsite audit + field checklist slugs (same order as definitions). */
export const JOBSITE_AUDIT_TRADE_SLUGS: readonly string[] = CONSTRUCTION_TRADE_DEFINITIONS.map((d) => d.slug);

export const CONSTRUCTION_TRADE_SLUG_BY_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  CONSTRUCTION_TRADE_DEFINITIONS.map((d) => [d.label, d.slug])
);

export const CONSTRUCTION_TRADE_LABEL_BY_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  CONSTRUCTION_TRADE_DEFINITIONS.map((d) => [d.slug, d.label])
);

/** PDFs / older CSEP rows may still reference pre-taxonomy labels */
const LEGACY_CSEP_KIND: Readonly<Record<string, CsepKind>> = {
  "General / Multi-trade": "gc_cm",
  "Survey / Layout": "site_earth",
  Demolition: "site_earth",
  Earthwork: "site_earth",
  "Excavation / Utilities": "heavy_civil",
  Concrete: "structural_concrete_masonry",
  "Steel / Ironwork": "structural_steel_wood",
  Masonry: "structural_concrete_masonry",
  Drywall: "interior_finishes",
  Painting: "interior_finishes",
  Flooring: "interior_finishes",
  Roofing: "exterior_envelope",
  Electrical: "mep",
  Plumbing: "mep",
  "Mechanical / HVAC": "mep",
  "Low Voltage": "mep",
  "Fire Protection": "mep",
  Elevator: "specialty_misc",
  Landscaping: "heavy_civil",
  "Asphalt / Paving": "heavy_civil",
  "Traffic Control": "heavy_civil",
  Scaffolding: "specialty_misc",
  Insulation: "exterior_envelope",
  Other: "other_common",
};

export function csepKindForTradeLabel(label: string): CsepKind {
  const legacy = LEGACY_CSEP_KIND[label];
  if (legacy) return legacy;
  const d = CONSTRUCTION_TRADE_DEFINITIONS.find((x) => x.label === label);
  return d?.csepKind ?? "other_common";
}

/** @deprecated — still accepted if stored on older profiles */
export const LEGACY_CONSTRUCTION_TRADE_LABELS: readonly string[] = [
  "General / Multi-trade",
  "Survey / Layout",
  "Demolition",
  "Earthwork",
  "Excavation / Utilities",
  "Concrete",
  "Steel / Ironwork",
  "Masonry",
  "Drywall",
  "Painting",
  "Flooring",
  "Roofing",
  "Electrical",
  "Mechanical / HVAC",
  "Plumbing",
  "Low Voltage",
  "Fire Protection",
  "Elevator",
  "Landscaping",
  "Asphalt / Paving",
  "Traffic Control",
  "Scaffolding",
  "Insulation",
];
