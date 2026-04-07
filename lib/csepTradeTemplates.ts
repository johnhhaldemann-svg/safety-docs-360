import type { CsepKind } from "@/lib/constructionTradeTaxonomy";

const DEFAULT_SUMMARY_FALLBACK =
  "Trade-specific work exposes workers to changing site conditions, equipment interaction, access challenges, and task-specific hazards that must be managed through planning, controls, and coordination.";

const DEFAULT_OSHA = [
  "OSHA 1926 Subpart E – PPE",
  "OSHA 1926 Subpart M – Fall Protection",
  "OSHA 1926 Subpart K – Electrical",
];

const DEFAULT_PPE_BASE = [
  "Hard Hat",
  "Safety Glasses",
  "High Visibility Vest",
  "Gloves",
  "Steel Toe Boots",
] as const;

const CSEP_BY_KIND: Record<
  CsepKind,
  { summary: string; oshaRefs: string[]; defaultPPE: string[] }
> = {
  site_earth: {
    summary:
      "Site preparation, earthmoving, and demolition expose workers to heavy equipment interaction, changing grades, struck-by hazards, dust, underground utilities, and unstable materials.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart P – Excavations",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart K – Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Hearing Protection", "Respiratory Protection"],
  },
  structural_steel_wood: {
    summary:
      "Structural framing and steel work involve falls from height, material hoisting, rigging, power tools, hot work, and multi-trade coordination in evolving structures.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart L – Scaffolding",
      "OSHA 1926 Subpart R – Steel Erection (where applicable)",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Fall Protection Harness", "Hearing Protection"],
  },
  structural_concrete_masonry: {
    summary:
      "Concrete, masonry, and foundation work involves formwork, rebar, pumping, lifting, silica exposure, wall bracing, and struck-by hazards from materials and equipment.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart L – Scaffolding",
      "OSHA 1926 Subpart Q – Concrete and Masonry Construction",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Face Shield", "Respiratory Protection"],
  },
  exterior_envelope: {
    summary:
      "Exterior envelope work includes leading-edge exposures, weather, sealants and adhesives, material handling at elevation, and coordination with ongoing interior and MEP activities.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart L – Scaffolding",
      "OSHA 1926 Subpart K – Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Fall Protection Harness"],
  },
  mep: {
    summary:
      "Mechanical, electrical, plumbing, fire protection, and low-voltage work exposes crews to energized parts, confined spaces, overhead installation, lifting, and multi-system tie-ins.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart M – Fall Protection",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Face Shield", "Hearing Protection"],
  },
  interior_finishes: {
    summary:
      "Interior finishes involve overhead work, dust and fume sources, slips and trips, material handling in occupied buildings, and frequent ladder or lift use.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart L – Scaffolding",
      "OSHA 1926 Subpart K – Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Respiratory Protection"],
  },
  specialty_misc: {
    summary:
      "Specialty trades combine elevated work, rigging and hoisting, glass handling, welding and cutting hazards, and tight coordination with other crews in congested areas.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart K – Electrical",
      "OSHA 1926 Subpart L – Scaffolding",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Fall Protection Harness", "Face Shield", "Hearing Protection"],
  },
  heavy_civil: {
    summary:
      "Heavy civil and infrastructure work involves live traffic interfaces, trenches, large equipment, bridge work at height, asphalt heat hazards, and long utility runs.",
    oshaRefs: [
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart P – Excavations",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart K – Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Hearing Protection", "Respiratory Protection"],
  },
  gc_cm: {
    summary:
      "General contractor and construction management roles coordinate multiple trades, site logistics, temporary utilities, access control, and evolving hazards across the full project lifecycle.",
    oshaRefs: [
      "OSHA 1926 Subpart C – General Safety and Health Provisions",
      "OSHA 1926 Subpart E – PPE",
      "OSHA 1926 Subpart M – Fall Protection",
      "OSHA 1926 Subpart K – Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE],
  },
  other_common: {
    summary:
      "Identify exposures through scope of work, site walkthrough, equipment and materials on site, and coordination with the GC safety team. Supplement with site-specific notes and applicable permit requirements.",
    oshaRefs: [
      ...DEFAULT_OSHA,
      "OSHA 1926 Subpart C – General Safety and Health Provisions",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE],
  },
};

export function csepSummaryForKind(kind: CsepKind): string {
  return CSEP_BY_KIND[kind]?.summary ?? DEFAULT_SUMMARY_FALLBACK;
}

export function csepOshaRefsForKind(kind: CsepKind): string[] {
  return CSEP_BY_KIND[kind]?.oshaRefs ?? [...DEFAULT_OSHA];
}

export function csepDefaultPpeForKind(kind: CsepKind): string[] {
  return CSEP_BY_KIND[kind]?.defaultPPE ?? [...DEFAULT_PPE_BASE];
}
