/**
 * Construction-forward field audit lines with OSHA reference hints (29 CFR).
 * Internal tool — not legal advice; verify current regulatory text.
 */

export type FieldAuditItem = {
  id: string;
  label: string;
  /** Short citation or subpart anchor for auditor notes */
  oshaRef?: string;
  /** Count more heavily in “critical” rollups */
  critical?: boolean;
};

export type FieldAuditSection = {
  id: string;
  title: string;
  subtitle?: string;
  items: FieldAuditItem[];
};

export const OSHA_FIELD_AUDIT_SECTIONS: FieldAuditSection[] = [
  {
    id: "site-housekeeping",
    title: "General site & housekeeping",
    subtitle: "1926.25, 1926.23, site logistics",
    items: [
      { id: "perimeter", label: "Site perimeter secured (fencing/barricades) where required", oshaRef: "1926.502(i)" },
      { id: "walkways", label: "Walkways and travel paths clear of debris, materials, and trip hazards", oshaRef: "1926.25(a)" },
      { id: "signage", label: "Required safety signage posted at entrances, hazards, and high-traffic areas", oshaRef: "1926.200-202" },
      { id: "illumination", label: "Adequate lighting for tasks and egress routes", oshaRef: "1926.56" },
      { id: "sanitation", label: "Sanitation (toilet/wash) facilities adequate and maintained", oshaRef: "1926.51" },
      { id: "storage", label: "Materials stacked/stored stable; limited stack heights respected", oshaRef: "1926.250" },
      { id: "waste", label: "Waste and scrap contained; no uncontrolled projection hazards", oshaRef: "1926.25(c)" },
    ],
  },
  {
    id: "fall-protection",
    title: "Fall protection",
    subtitle: "1926 Subpart M",
    items: [
      { id: "fp-plan", label: "Fall protection plan / competent rescuer available where required", oshaRef: "1926.502(k)" },
      { id: "unprotected-edges", label: "Unprotected sides/edges guarded (rails, nets, or PFAS)", oshaRef: "1926.501(b)", critical: true },
      { id: "floor-openings", label: "Floor holes and openings covered/guarded and marked", oshaRef: "1926.501(b)(4)" },
      { id: "pfas-inspect", label: "Harnesses, lanyards, and anchorages inspected and appropriate for exposure", oshaRef: "1926.502(d)" },
      { id: "warning-lines", label: "Warning lines / control zones used correctly (low-slope roofs)", oshaRef: "1926.502(f)" },
      { id: "leading-edge", label: "Leading edge and steep roof work use approved fall arrest or guardrails", oshaRef: "1926.501(b)(2)", critical: true },
    ],
  },
  {
    id: "scaffold-ladder",
    title: "Scaffolding & ladders",
    subtitle: "1926.451, 1926.1053",
    items: [
      { id: "scaffold-competent", label: "Scaffold erected/altered under competent person direction", oshaRef: "1926.451(f)(7)" },
      { id: "scaffold-base", label: "Footings sound; base plates, mud sills, and leveling used as required", oshaRef: "1926.451(c)(2)" },
      { id: "scaffold-access", label: "Safe access (stairs/ladders) — no climbing cross-braces", oshaRef: "1926.451(e)" },
      { id: "scaffold-planks", label: "Fully planked/decked; planks overlapped and secured", oshaRef: "1926.451(b)" },
      { id: "guardrails", label: "Guardrails, midrails, and toeboards complete where required", oshaRef: "1926.451(g)" },
      { id: "ladder-inspect", label: "Ladders inspected; damaged ladders removed from service", oshaRef: "1926.1053(b)(16)" },
      { id: "ladder-use", label: "Ladders extend 3 ft above landing / tied off; 4:1 rule side rails", oshaRef: "1926.1053(b)" },
      { id: "step-stools", label: "Step stools / portable ladders not used as work platforms when prohibited", oshaRef: "1926.1053(b)(4)" },
    ],
  },
  {
    id: "electrical",
    title: "Electrical (temporary & permanent)",
    subtitle: "1926.405–416, 1910.305 awareness",
    items: [
      { id: "gfci", label: "GFCI protection for 120V receptacles on temporary power", oshaRef: "1926.404(b)(1)" },
      { id: "cord-condition", label: "Cords undamaged; no daisy-chaining or unapproved splices", oshaRef: "1926.405(a)(2)(ii)" },
      { id: "clearance", label: "Working clearance in front of electrical panels maintained", oshaRef: "1910.305(g)(1)" },
      { id: "overhead-lines", label: "Minimum approach distances respected near overhead power lines", oshaRef: "1926.1408", critical: true },
      { id: "lockout-awareness", label: "Energized work minimized; LOTO boundaries respected where in use", oshaRef: "1910.147" },
    ],
  },
  {
    id: "excavation",
    title: "Excavations & trenches",
    subtitle: "1926 Subpart P",
    items: [
      { id: "competent-person", label: "Competent person daily inspections documented; soil classified", oshaRef: "1926.651(k)", critical: true },
      { id: "protective-system", label: "Sloping, benching, or shoring matches soil and depth", oshaRef: "1926.652" },
      { id: "access-egress", label: "Ladders/steps within 25 ft lateral travel for trench ≥4 ft", oshaRef: "1926.651(c)(2)" },
      { id: "spoil-spoils", label: "Spoil and equipment set back ≥2 ft from edge (or engineered)", oshaRef: "1926.651(j)(2)" },
      { id: "atmospheric", label: "Atmospheric testing and ventilation before/confined trench entry", oshaRef: "1926.651(g)" },
      { id: "utilities", label: "Underground utilities located and protected before digging", oshaRef: "1926.651(b)" },
    ],
  },
  {
    id: "cranes-rigging",
    title: "Cranes, hoists & rigging",
    subtitle: "1926 Subparts CC, H",
    items: [
      { id: "operator-qual", label: "Operators qualified/certified per equipment type", oshaRef: "1926.1427" },
      { id: "load-chart", label: "Load charts and capacity limits visible and followed", oshaRef: "1926.1417(d)" },
      { id: "swing-radius", label: "Swing radius barricaded / controlled for struck-by", oshaRef: "1926.1425" },
      { id: "rigging-inspect", label: "Slings, hardware, and rigging inspected; tag lines used as needed", oshaRef: "1926.251" },
      { id: "critical-lift", label: "Critical lifts (if any) have plan, briefing, and dedicated signal person", oshaRef: "1926.1404" },
      { id: "aerial-lift", label: "MEWP/aerial lifts: inspected; occupants tied off where required", oshaRef: "1926.453" },
    ],
  },
  {
    id: "ppe",
    title: "Personal protective equipment",
    subtitle: "1926.95–102",
    items: [
      { id: "hard-hats", label: "Hard hats worn where overhead or impact hazards exist", oshaRef: "1926.100" },
      { id: "eye-face", label: "Eye/face protection for grinding, cutting, chemical, and dust tasks", oshaRef: "1926.102" },
      { id: "foot", label: "Appropriate foot protection for slip/puncture/crush exposures", oshaRef: "1926.96" },
      { id: "hi-vis", label: "High-visibility apparel where vehicle/equipment movement", oshaRef: "1926.201" },
      { id: "hearing", label: "Hearing protection in posted or measured high-noise areas", oshaRef: "1926.52 / 1910.95" },
      { id: "respiratory", label: "Respiratory protection program followed where required (fit, cartridges)", oshaRef: "1910.134" },
    ],
  },
  {
    id: "steel-erection",
    title: "Steel erection & structural",
    subtitle: "1926 Subpart R",
    items: [
      { id: "connector-policy", label: "Connectors using fall protection per steel erection rules", oshaRef: "1926.760(a)" },
      { id: "decking-zone", label: "Controlled decking zone / nets / PFAS used as required", oshaRef: "1926.760(b)" },
      { id: "structural-stability", label: "Bolts/placement maintains structural stability during erection", oshaRef: "1926.754" },
    ],
  },
  {
    id: "confined-space",
    title: "Confined spaces",
    subtitle: "1926 Subpart AA / 1910.146",
    items: [
      { id: "cs-inventory", label: "Permit-required confined spaces identified and posted", oshaRef: "1926.1203" },
      { id: "permit-system", label: "Permit system followed: atmospheric test, ventilation, communication", oshaRef: "1926.1204–1206" },
      { id: "rescue", label: "Rescue plan and equipment ready; no unauthorized entry", oshaRef: "1926.1211", critical: true },
    ],
  },
  {
    id: "hot-work",
    title: "Welding, cutting & hot work",
    subtitle: "1926.352, fire prevention",
    items: [
      { id: "hot-work-permit", label: "Hot work permit / fire watch where required", oshaRef: "1926.352(c)" },
      { id: "fire-extinguisher", label: "Fire extinguisher(s) appropriate and immediately available", oshaRef: "1926.352(d)" },
      { id: "cylinders", label: "Gas cylinders secured, capped, separated (fuel/oxygen)", oshaRef: "1926.350" },
      { id: "screens", label: "Welding screens / flash protection for adjacent workers", oshaRef: "1926.352(a)" },
    ],
  },
  {
    id: "hazcom-silica",
    title: "HazCom, silica & health hazards",
    subtitle: "1926.59, 1926.1153",
    items: [
      { id: "sds-access", label: "SDSs available for on-site hazardous chemicals", oshaRef: "1926.59(g)" },
      { id: "labels", label: "Containers labeled (GHS); secondary containers identified", oshaRef: "1926.59(f)" },
      { id: "silica-plan", label: "Silica exposure controls: water, vacuums, or Table 1 / objective data", oshaRef: "1926.1153" },
      { id: "lead-asbestos", label: "Lead/asbestos work (if present) has survey, signage, and controls", oshaRef: "1926.62 / 1926.1101" },
    ],
  },
  {
    id: "heat-emergency",
    title: "Heat illness, emergency & egress",
    subtitle: "State plans + 1926.34, 1926.150",
    items: [
      { id: "heat-plan", label: "Heat illness prevention: water, shade/cool-down, acclimatization", oshaRef: "State / Cal/OSHA heat" },
      { id: "egress", label: "Means of egress unlocked, unobstructed, and marked", oshaRef: "1926.34" },
      { id: "fire-extinguishers", label: "Portable fire extinguishers inspected and accessible", oshaRef: "1926.150" },
      { id: "first-aid", label: "First aid kits and trained personnel appropriate for hazards", oshaRef: "1926.23" },
    ],
  },
];

export function countFieldAuditItems(): number {
  return OSHA_FIELD_AUDIT_SECTIONS.reduce((n, s) => n + s.items.length, 0);
}

export function fieldItemKey(sectionId: string, itemId: string): string {
  return `field-${sectionId}-${itemId}`;
}
