import type { CSEPProgramSelectionInput } from "@/types/csep-programs";

export type PshsepCatalogGroup =
  | "scope_of_work_selected"
  | "high_risk_focus_areas"
  | "permits_selected"
  | "assumed_trades_index"
  | "ancillary_contractors";

export type PshsepExportProgramId =
  | "housekeeping_material_storage"
  | "fall_protection"
  | "excavation"
  | "crane_rigging"
  | "confined_space"
  | "electrical_loto"
  | "hot_work"
  | "scaffold_safety"
  | "mewp"
  | "forklift_material_handling"
  | "material_handling_support"
  | "line_break_pressure_testing"
  | "temporary_structures"
  | "steel_erection"
  | "concrete_masonry"
  | "demolition"
  | "hazard_communication"
  | "chemical_safety"
  | "silica_exposure"
  | "respiratory_protection"
  | "fire_prevention"
  | "flammable_storage"
  | "site_traffic"
  | "delivery_logistics"
  | "public_protection"
  | "security_site_access"
  | "tools_equipment_temporary_power"
  | "heat_illness_prevention"
  | "cold_stress_winter_work"
  | "subcontractor_safety_requirements"
  | "sanitation_welfare"
  | "severe_weather_response";

export type PshsepCatalogItem = {
  id: string;
  label: string;
  aliases?: string[];
  exportPrograms?: PshsepExportProgramId[];
  oshaRefs?: string[];
  impliedSelections?: Array<Pick<CSEPProgramSelectionInput, "category" | "item">>;
};

function item(definition: PshsepCatalogItem): PshsepCatalogItem {
  return definition;
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

const CATALOG: Record<PshsepCatalogGroup, PshsepCatalogItem[]> = {
  scope_of_work_selected: [
    item({
      id: "scope_scaffolds",
      label: "Scaffolds",
      exportPrograms: ["fall_protection", "scaffold_safety"],
      oshaRefs: ["29 CFR 1926 Subpart L"],
      impliedSelections: [{ category: "hazard", item: "Falls from height" }],
    }),
    item({
      id: "scope_mewp",
      label: "MEWP / Aerial Lifts",
      exportPrograms: ["fall_protection", "mewp"],
      oshaRefs: ["29 CFR 1926 Subpart M"],
      impliedSelections: [
        { category: "hazard", item: "Falls from height" },
        { category: "permit", item: "AWP/MEWP Permit" },
      ],
    }),
    item({
      id: "scope_forklifts",
      label: "Forklifts / Material Handling",
      exportPrograms: ["forklift_material_handling", "material_handling_support", "site_traffic", "delivery_logistics"],
      oshaRefs: ["29 CFR 1926 Subpart O"],
      impliedSelections: [{ category: "hazard", item: "Struck by equipment" }],
    }),
    item({
      id: "scope_excavation",
      label: "Excavation / Trenching",
      aliases: ["Excavation", "Groundbreaking/Excavation"],
      exportPrograms: ["excavation"],
      oshaRefs: ["29 CFR 1926 Subpart P"],
      impliedSelections: [
        { category: "hazard", item: "Excavation collapse" },
        { category: "permit", item: "Ground Disturbance Permit" },
      ],
    }),
    item({
      id: "scope_steel_erection",
      label: "Steel Erection",
      aliases: ["Steel erection / decking", "Structural Steel", "Ironwork"],
      exportPrograms: ["steel_erection", "fall_protection", "crane_rigging"],
      oshaRefs: ["29 CFR 1926 Subpart R", "29 CFR 1926 Subpart CC"],
      impliedSelections: [
        { category: "hazard", item: "Crane lift hazards" },
        { category: "hazard", item: "Falling objects" },
      ],
    }),
    item({
      id: "scope_concrete_masonry",
      label: "Concrete / Masonry",
      aliases: ["Concrete", "Masonry"],
      exportPrograms: ["concrete_masonry", "silica_exposure"],
      oshaRefs: ["29 CFR 1926.1153"],
      impliedSelections: [{ category: "hazard", item: "Silica / dust exposure" }],
    }),
    item({
      id: "scope_demolition",
      label: "Demolition",
      exportPrograms: ["demolition", "silica_exposure"],
      oshaRefs: ["29 CFR 1926 Subpart T"],
      impliedSelections: [
        { category: "hazard", item: "Falling objects" },
        { category: "hazard", item: "Silica / dust exposure" },
      ],
    }),
    item({
      id: "scope_roofing",
      label: "Roofing",
      exportPrograms: ["fall_protection"],
      oshaRefs: ["29 CFR 1926 Subpart M"],
      impliedSelections: [{ category: "hazard", item: "Falls from height" }],
    }),
    item({
      id: "scope_electrical",
      label: "Electrical",
      exportPrograms: ["electrical_loto"],
      oshaRefs: ["29 CFR 1926 Subpart K"],
      impliedSelections: [
        { category: "hazard", item: "Electrical shock" },
        { category: "permit", item: "LOTO Permit" },
      ],
    }),
    item({
      id: "scope_mechanical",
      label: "Mechanical",
      aliases: ["Mechanical / Piping / Equipment"],
      exportPrograms: ["line_break_pressure_testing", "material_handling_support"],
      impliedSelections: [{ category: "hazard", item: "Pressure / line break" }],
    }),
    item({
      id: "scope_hot_work",
      label: "Hot Work",
      aliases: ["Hot Work / Welding / Cutting"],
      exportPrograms: ["hot_work", "fire_prevention", "flammable_storage"],
      oshaRefs: ["29 CFR 1926 Subpart J"],
      impliedSelections: [
        { category: "hazard", item: "Hot work / fire" },
        { category: "permit", item: "Hot Work Permit" },
      ],
    }),
    item({
      id: "scope_confined_space",
      label: "Confined Space",
      exportPrograms: ["confined_space"],
      oshaRefs: ["29 CFR 1926 Subpart AA"],
      impliedSelections: [
        { category: "hazard", item: "Confined spaces" },
        { category: "permit", item: "Confined Space Permit" },
      ],
    }),
    item({
      id: "scope_crane_rigging",
      label: "Crane / Rigging",
      exportPrograms: ["crane_rigging"],
      oshaRefs: ["29 CFR 1926 Subpart CC"],
      impliedSelections: [{ category: "hazard", item: "Crane lift hazards" }],
    }),
    item({
      id: "scope_hand_power_tools",
      label: "Hand & Power Tools",
      exportPrograms: ["tools_equipment_temporary_power"],
      impliedSelections: [{ category: "hazard", item: "Ladder misuse" }],
    }),
    item({
      id: "scope_line_break",
      label: "Line Break / Pressure Testing",
      exportPrograms: ["line_break_pressure_testing"],
      impliedSelections: [{ category: "hazard", item: "Pressure / line break" }],
    }),
    item({
      id: "scope_material_support",
      label: "Material Handling & Rigging Support",
      exportPrograms: ["material_handling_support", "delivery_logistics"],
      impliedSelections: [
        { category: "hazard", item: "Struck by equipment" },
        { category: "hazard", item: "Crane lift hazards" },
      ],
    }),
    item({
      id: "scope_temporary_structures",
      label: "Temporary Structures / Supports / Bracing",
      exportPrograms: ["temporary_structures"],
    }),
    item({
      id: "scope_hazcom",
      label: "Hazard Communication / Chemical Use",
      exportPrograms: ["hazard_communication", "chemical_safety"],
      oshaRefs: ["29 CFR 1926.59"],
      impliedSelections: [
        { category: "hazard", item: "Chemical exposure" },
        { category: "permit", item: "Chemical Permit" },
      ],
    }),
    item({
      id: "scope_silica",
      label: "Silica / Dust Producing Work",
      exportPrograms: ["silica_exposure", "respiratory_protection"],
      oshaRefs: ["29 CFR 1926.1153"],
      impliedSelections: [
        { category: "hazard", item: "Silica / dust exposure" },
        { category: "ppe", item: "Respiratory Protection" },
      ],
    }),
    item({
      id: "scope_respiratory",
      label: "Respiratory Protection",
      exportPrograms: ["respiratory_protection"],
      impliedSelections: [{ category: "ppe", item: "Respiratory Protection" }],
    }),
    item({
      id: "scope_fire_prevention",
      label: "Fire Prevention / Flammable Storage",
      exportPrograms: ["fire_prevention", "flammable_storage", "hot_work"],
      impliedSelections: [{ category: "hazard", item: "Hot work / fire" }],
    }),
    item({
      id: "scope_site_traffic",
      label: "Site Traffic / Deliveries / Logistics",
      exportPrograms: ["site_traffic", "delivery_logistics"],
      impliedSelections: [{ category: "hazard", item: "Struck by equipment" }],
    }),
    item({
      id: "scope_public_protection",
      label: "Public Protection / Occupied Area Controls",
      exportPrograms: ["public_protection"],
    }),
    item({
      id: "scope_sanitation",
      label: "Sanitation / Welfare Facilities",
      exportPrograms: ["sanitation_welfare"],
    }),
    item({
      id: "scope_security",
      label: "Security / Site Access Control",
      exportPrograms: ["security_site_access"],
    }),
  ],
  high_risk_focus_areas: [
    item({
      id: "risk_excavation",
      label: "Excavation / trenching",
      exportPrograms: ["excavation"],
      oshaRefs: ["29 CFR 1926 Subpart P"],
      impliedSelections: [{ category: "hazard", item: "Excavation collapse" }],
    }),
    item({
      id: "risk_confined_space",
      label: "Confined space entry",
      exportPrograms: ["confined_space"],
      oshaRefs: ["29 CFR 1926 Subpart AA"],
      impliedSelections: [{ category: "hazard", item: "Confined spaces" }],
    }),
    item({
      id: "risk_loto",
      label: "LOTO / stored energy isolation",
      exportPrograms: ["electrical_loto"],
      oshaRefs: ["29 CFR 1926 Subpart K"],
      impliedSelections: [
        { category: "hazard", item: "Electrical shock" },
        { category: "permit", item: "LOTO Permit" },
      ],
    }),
    item({
      id: "risk_hot_work",
      label: "Hot work / fire watch",
      exportPrograms: ["hot_work", "fire_prevention"],
      oshaRefs: ["29 CFR 1926 Subpart J"],
      impliedSelections: [{ category: "hazard", item: "Hot work / fire" }],
    }),
    item({
      id: "risk_access",
      label: "Ladders / scaffolds / access",
      exportPrograms: ["fall_protection", "scaffold_safety", "mewp"],
      impliedSelections: [
        { category: "hazard", item: "Falls from height" },
        { category: "hazard", item: "Ladder misuse" },
      ],
    }),
    item({
      id: "risk_equipment",
      label: "Heavy equipment / spotters",
      exportPrograms: ["site_traffic", "forklift_material_handling", "delivery_logistics"],
      impliedSelections: [{ category: "hazard", item: "Struck by equipment" }],
    }),
    item({
      id: "risk_tools",
      label: "Hand and power tools",
      exportPrograms: ["tools_equipment_temporary_power"],
    }),
    item({
      id: "risk_steel",
      label: "Steel erection / rigging",
      aliases: ["Steel Erection", "Structural Steel", "Ironwork / Rigging"],
      exportPrograms: ["steel_erection", "crane_rigging", "fall_protection"],
      impliedSelections: [
        { category: "hazard", item: "Crane lift hazards" },
        { category: "hazard", item: "Falling objects" },
      ],
    }),
    item({
      id: "risk_concrete",
      label: "Concrete / masonry",
      exportPrograms: ["concrete_masonry", "silica_exposure"],
      impliedSelections: [{ category: "hazard", item: "Silica / dust exposure" }],
    }),
    item({
      id: "risk_environmental",
      label: "Hazardous waste / environmental release",
      exportPrograms: ["hazard_communication", "chemical_safety"],
      impliedSelections: [{ category: "hazard", item: "Chemical exposure" }],
    }),
    item({
      id: "risk_chemicals",
      label: "Gases / chemical storage",
      exportPrograms: ["chemical_safety", "flammable_storage"],
      impliedSelections: [{ category: "hazard", item: "Chemical exposure" }],
    }),
    item({
      id: "risk_crane",
      label: "Crane / hoisting / suspended loads",
      exportPrograms: ["crane_rigging"],
      impliedSelections: [{ category: "hazard", item: "Crane lift hazards" }],
    }),
    item({
      id: "risk_pressure",
      label: "Pressure testing / line breaking",
      exportPrograms: ["line_break_pressure_testing"],
      impliedSelections: [{ category: "hazard", item: "Pressure / line break" }],
    }),
    item({
      id: "risk_temp_power",
      label: "Temporary power / energization",
      exportPrograms: ["electrical_loto"],
      impliedSelections: [{ category: "hazard", item: "Electrical shock" }],
    }),
    item({
      id: "risk_respiratory",
      label: "Respiratory / silica / dust exposure",
      exportPrograms: ["silica_exposure", "respiratory_protection"],
      impliedSelections: [
        { category: "hazard", item: "Silica / dust exposure" },
        { category: "ppe", item: "Respiratory Protection" },
      ],
    }),
    item({
      id: "risk_public",
      label: "Occupied areas / public protection",
      exportPrograms: ["public_protection"],
    }),
    item({
      id: "risk_weather",
      label: "Severe weather / heat / cold stress",
      exportPrograms: [
        "heat_illness_prevention",
        "cold_stress_winter_work",
        "severe_weather_response",
      ],
      impliedSelections: [{ category: "permit", item: "Temperature Permit" }],
    }),
  ],
  permits_selected: [
    item({
      id: "permit_hot_work",
      label: "Hot Work",
      exportPrograms: ["hot_work", "fire_prevention"],
      oshaRefs: ["29 CFR 1926 Subpart J"],
      impliedSelections: [{ category: "permit", item: "Hot Work Permit" }],
    }),
    item({
      id: "permit_excavation",
      label: "Groundbreaking/Excavation",
      aliases: ["Excavation / Trenching"],
      exportPrograms: ["excavation"],
      oshaRefs: ["29 CFR 1926 Subpart P"],
      impliedSelections: [{ category: "permit", item: "Ground Disturbance Permit" }],
    }),
    item({
      id: "permit_confined_space",
      label: "Confined Space",
      exportPrograms: ["confined_space"],
      oshaRefs: ["29 CFR 1926 Subpart AA"],
      impliedSelections: [{ category: "permit", item: "Confined Space Permit" }],
    }),
    item({
      id: "permit_loto",
      label: "LOTO / Electrical",
      exportPrograms: ["electrical_loto"],
      oshaRefs: ["29 CFR 1926 Subpart K"],
      impliedSelections: [{ category: "permit", item: "LOTO Permit" }],
    }),
    item({
      id: "permit_height",
      label: "Work at Height",
      exportPrograms: ["fall_protection"],
      impliedSelections: [{ category: "permit", item: "Ladder Permit" }],
    }),
    item({
      id: "permit_crane",
      label: "Crane / Critical Lift",
      exportPrograms: ["crane_rigging"],
      oshaRefs: ["29 CFR 1926 Subpart CC"],
      impliedSelections: [{ category: "hazard", item: "Crane lift hazards" }],
    }),
    item({
      id: "permit_line_break",
      label: "Line Breaking",
      exportPrograms: ["line_break_pressure_testing"],
      impliedSelections: [{ category: "hazard", item: "Pressure / line break" }],
    }),
    item({
      id: "permit_scaffold",
      label: "Scaffold Erection / Modification",
      exportPrograms: ["scaffold_safety", "fall_protection"],
      impliedSelections: [{ category: "hazard", item: "Falls from height" }],
    }),
    item({
      id: "permit_mewp",
      label: "MEWP / Aerial Lift",
      exportPrograms: ["mewp", "fall_protection"],
      impliedSelections: [{ category: "permit", item: "AWP/MEWP Permit" }],
    }),
    item({
      id: "permit_temp_power",
      label: "Temporary Power / Energization",
      exportPrograms: ["electrical_loto"],
      impliedSelections: [{ category: "permit", item: "LOTO Permit" }],
    }),
    item({
      id: "permit_pressure_testing",
      label: "Pressure Testing / Hydrotest",
      exportPrograms: ["line_break_pressure_testing"],
      impliedSelections: [{ category: "hazard", item: "Pressure / line break" }],
    }),
    item({
      id: "permit_chemical",
      label: "Chemical / Coating / Solvent Use",
      exportPrograms: ["hazard_communication", "chemical_safety"],
      impliedSelections: [{ category: "permit", item: "Chemical Permit" }],
    }),
    item({
      id: "permit_roof_access",
      label: "Roof Access / Leading Edge",
      exportPrograms: ["fall_protection"],
      impliedSelections: [{ category: "hazard", item: "Falls from height" }],
    }),
    item({
      id: "permit_demolition",
      label: "Demolition / Structural Alteration",
      exportPrograms: ["demolition"],
      impliedSelections: [{ category: "hazard", item: "Falling objects" }],
    }),
  ],
  assumed_trades_index: [
    item({ id: "trade_concrete", label: "Concrete" }),
    item({ id: "trade_electrical", label: "Electrical" }),
    item({ id: "trade_mechanical", label: "Mechanical" }),
    item({ id: "trade_plumbing", label: "Plumbing" }),
    item({
      id: "trade_steel",
      label: "Steel Erection",
      aliases: ["Structural Steel", "Ironwork", "Steel erection / decking"],
    }),
    item({ id: "trade_roofing", label: "Roofing" }),
    item({ id: "trade_demolition", label: "Demolition" }),
    item({ id: "trade_masonry", label: "Masonry" }),
    item({ id: "trade_excavation", label: "Excavation / Civil", aliases: ["Excavation"] }),
    item({ id: "trade_scaffolding", label: "Scaffolding" }),
    item({ id: "trade_crane", label: "Crane / Rigging" }),
    item({ id: "trade_millwright", label: "Millwright / Equipment Setting" }),
    item({ id: "trade_welding", label: "Welding / Hot Work" }),
    item({ id: "trade_insulation", label: "Insulation / Fireproofing" }),
    item({ id: "trade_painting", label: "Painting / Coatings" }),
    item({ id: "trade_utilities", label: "Utilities / Underground" }),
    item({ id: "trade_drywall", label: "Drywall / Framing" }),
    item({ id: "trade_glazing", label: "Glazing / Envelope" }),
    item({ id: "trade_flooring", label: "Flooring / Interiors" }),
    item({ id: "trade_commissioning", label: "Commissioning / Startup" }),
  ],
  ancillary_contractors: [
    item({
      id: "anc_trash",
      label: "Trash / housekeeping",
      exportPrograms: ["housekeeping_material_storage"],
    }),
    item({
      id: "anc_bathroom",
      label: "Bathroom maintenance",
      exportPrograms: ["sanitation_welfare"],
    }),
    item({
      id: "anc_portable_toilet",
      label: "Portable toilet service",
      exportPrograms: ["sanitation_welfare"],
    }),
    item({ id: "anc_security", label: "Security", exportPrograms: ["security_site_access"] }),
    item({
      id: "anc_testing",
      label: "Testing / inspection agency",
      exportPrograms: ["subcontractor_safety_requirements"],
    }),
    item({
      id: "anc_survey",
      label: "Survey / layout",
      exportPrograms: ["subcontractor_safety_requirements", "site_traffic"],
    }),
    item({ id: "anc_traffic", label: "Traffic control", exportPrograms: ["site_traffic"] }),
    item({ id: "anc_scaffold", label: "Scaffold contractor", exportPrograms: ["scaffold_safety"] }),
    item({ id: "anc_crane", label: "Crane service / rigging support", exportPrograms: ["crane_rigging"] }),
    item({ id: "anc_fuel", label: "Fuel / equipment service", exportPrograms: ["fire_prevention", "flammable_storage"] }),
    item({ id: "anc_environmental", label: "Environmental / waste hauling", exportPrograms: ["chemical_safety"] }),
    item({ id: "anc_fire_watch", label: "Fire watch", exportPrograms: ["hot_work"] }),
    item({ id: "anc_delivery", label: "Delivery / logistics support", exportPrograms: ["delivery_logistics"] }),
    item({
      id: "anc_janitorial",
      label: "Janitorial / final clean",
      exportPrograms: ["housekeeping_material_storage", "sanitation_welfare"],
    }),
    item({ id: "anc_temp_power", label: "Temporary power / generator service", exportPrograms: ["electrical_loto"] }),
  ],
};

function getItem(group: PshsepCatalogGroup, value: string) {
  const token = normalizeToken(value);
  return (
    CATALOG[group].find(
      (entry) =>
        normalizeToken(entry.label) === token ||
        (entry.aliases ?? []).some((alias) => normalizeToken(alias) === token)
    ) ?? null
  );
}

export function getPshsepCatalog(group: PshsepCatalogGroup) {
  return CATALOG[group];
}

export function getPshsepCatalogOptions(group: PshsepCatalogGroup) {
  return CATALOG[group].map((entry) => entry.label);
}

export function normalizePshsepSelectionValues(group: PshsepCatalogGroup, values: unknown) {
  if (!Array.isArray(values)) return [];

  return dedupe(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => getItem(group, value)?.label ?? value)
  );
}

export function normalizePshsepBuilderFormData<T extends Record<string, unknown>>(formData: T): T {
  return {
    ...formData,
    scope_of_work_selected: normalizePshsepSelectionValues("scope_of_work_selected", formData.scope_of_work_selected),
    high_risk_focus_areas: normalizePshsepSelectionValues("high_risk_focus_areas", formData.high_risk_focus_areas),
    permits_selected: normalizePshsepSelectionValues("permits_selected", formData.permits_selected),
    assumed_trades_index: normalizePshsepSelectionValues("assumed_trades_index", formData.assumed_trades_index),
    ancillary_contractors: normalizePshsepSelectionValues("ancillary_contractors", formData.ancillary_contractors),
  } as T;
}

type CatalogProgramSelectionParams = {
  scope_of_work_selected: string[];
  high_risk_focus_areas: string[];
  permits_selected: string[];
};

export function buildPshsepCatalogProgramSelections(params: CatalogProgramSelectionParams) {
  const selections: CSEPProgramSelectionInput[] = [];
  const selectedScopes = normalizePshsepSelectionValues(
    "scope_of_work_selected",
    params.scope_of_work_selected
  );

  const pushSelections = (group: PshsepCatalogGroup, values: string[], relatedTasks: string[]) => {
    for (const value of normalizePshsepSelectionValues(group, values)) {
      const entry = getItem(group, value);
      if (!entry) continue;
      for (const implied of entry.impliedSelections ?? []) {
        selections.push({
          category: implied.category,
          item: implied.item,
          relatedTasks: relatedTasks.length ? relatedTasks : [entry.label],
          source: "derived",
        });
      }
    }
  };

  pushSelections("scope_of_work_selected", params.scope_of_work_selected, selectedScopes);
  pushSelections("high_risk_focus_areas", params.high_risk_focus_areas, selectedScopes);
  pushSelections("permits_selected", params.permits_selected, selectedScopes);

  return selections;
}

export function collectPshsepCatalogOshaRefs(params: CatalogProgramSelectionParams) {
  const refs = new Set<string>();
  const pushRefs = (group: PshsepCatalogGroup, values: string[]) => {
    for (const value of normalizePshsepSelectionValues(group, values)) {
      const entry = getItem(group, value);
      for (const ref of entry?.oshaRefs ?? []) {
        refs.add(ref);
      }
    }
  };

  pushRefs("scope_of_work_selected", params.scope_of_work_selected);
  pushRefs("high_risk_focus_areas", params.high_risk_focus_areas);
  pushRefs("permits_selected", params.permits_selected);

  return [...refs];
}

export function derivePshsepExportProgramIds(formData: Record<string, unknown>) {
  const normalized = normalizePshsepBuilderFormData(formData);
  const programs = new Set<PshsepExportProgramId>();

  const addPrograms = (group: PshsepCatalogGroup, values: string[]) => {
    for (const value of values) {
      const entry = getItem(group, value);
      for (const program of entry?.exportPrograms ?? []) {
        programs.add(program);
      }
    }
  };

  addPrograms("scope_of_work_selected", normalized.scope_of_work_selected as string[]);
  addPrograms("high_risk_focus_areas", normalized.high_risk_focus_areas as string[]);
  addPrograms("permits_selected", normalized.permits_selected as string[]);
  addPrograms("ancillary_contractors", normalized.ancillary_contractors as string[]);

  return [...programs];
}
