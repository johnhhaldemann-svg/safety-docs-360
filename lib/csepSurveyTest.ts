import { buildCsepProgramSelections } from "@/lib/csepPrograms";
import {
  buildCsepTradeSelection,
  type CSEPRiskItem,
  getCsepSubTradeOptions,
  getCsepTaskOptions,
} from "@/lib/csepTradeSelection";
import { SOR_HAZARD_CATEGORY_LABELS } from "@/lib/incidents/sorHazardCategory";

export const SURVEY_TEST_TRADE_LABEL = "Survey / Layout";
export const SURVEY_TEST_LAYOUT_VARIANT = "survey_test" as const;

export type SurveyTestLayoutSectionKey =
  | "risks_hazards"
  | "work_planning"
  | "structural_stability"
  | "connecting_and_decking"
  | "training_requirements"
  | "certification_requirements"
  | "required_equipment"
  | "required_permits"
  | "affected_trades"
  | "additional_related_information";

export type SurveyTestLayoutSection = {
  key: SurveyTestLayoutSectionKey;
  number: number;
  title: string;
  summary: string;
  subsections: Array<{
    number: string;
    title: string;
    body: string;
  }>;
};

export type SurveyTestFormData = {
  project_name: string;
  project_number: string;
  project_address: string;
  owner_client: string;
  gc_cm: string;
  contractor_company: string;
  contractor_contact: string;
  contractor_phone: string;
  contractor_email: string;
  trade: string;
  subTrade: string;
  tasks: string[];
  selectedLayoutSections: SurveyTestLayoutSectionKey[];
  scope_of_work: string;
  site_specific_notes: string;
  emergency_procedures: string;
  required_ppe: string[];
  additional_permits: string[];
  selected_hazards: string[];
};

export type SurveyTestEnrichment = {
  tradeLabel: string;
  subTradeLabel: string | null;
  selectedTasks: string[];
  selectedSections: SurveyTestLayoutSection[];
  tradeSummary: string;
  oshaData: string[];
  sorData: string[];
  injuryData: string[];
  requiredTraining: string[];
  permitsRequired: string[];
  elementsRequired: string[];
  hazards: string[];
  ppe: string[];
  tradeItems: CSEPRiskItem[];
  commonOverlappingTrades: string[];
  overlapPermitHints: string[];
  readinessChecklist: Array<{ label: string; done: boolean }>;
};

function uniq(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function hasAny(text: string, tokens: readonly string[]) {
  return tokens.some((token) => text.includes(token));
}

function mergeScopeText(input: SurveyTestFormData, selectedTasks: string[]) {
  if (input.scope_of_work.trim()) {
    return input.scope_of_work.trim();
  }

  if (selectedTasks.length === 0) {
    return "Survey and layout activities will be planned, verified, and documented before dependent work proceeds.";
  }

  return `Survey / layout scope includes ${selectedTasks.join(", ")} with control verification, documentation, and field coordination before dependent work proceeds.`;
}

function defaultEmergencyProcedures(input: SurveyTestFormData) {
  if (input.emergency_procedures.trim()) {
    return input.emergency_procedures.trim();
  }

  return "In the event of an emergency, the crew will stop work, notify supervision immediately, follow site alarm and evacuation instructions, and keep control equipment clear of emergency access routes.";
}

function mapHazardsToSorData(hazards: string[]) {
  const labels = new Set<string>();

  for (const hazard of hazards) {
    const lower = hazard.toLowerCase();
    if (lower.includes("fall")) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.falls_same_level);
    }
    if (lower.includes("height")) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.falls_elevation);
    }
    if (
      lower.includes("struck") ||
      lower.includes("traffic") ||
      lower.includes("equipment") ||
      lower.includes("falling object")
    ) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.struck_by);
      labels.add(SOR_HAZARD_CATEGORY_LABELS.contact_equipment);
    }
    if (lower.includes("electrical")) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.electrical);
    }
    if (lower.includes("chemical") || lower.includes("silica") || lower.includes("dust")) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.hazardous_substance);
    }
    if (lower.includes("confined")) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.environmental);
    }
    if (lower.includes("lifting") || lower.includes("material")) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.material_handling);
    }
    if (lower.includes("housekeeping") || lower.includes("slip") || lower.includes("trip")) {
      labels.add(SOR_HAZARD_CATEGORY_LABELS.ppe_behavioral);
    }
  }

  if (labels.size === 0) {
    labels.add(SOR_HAZARD_CATEGORY_LABELS.ppe_behavioral);
  }

  return [...labels];
}

function mapHazardsToInjuryData(hazards: string[]) {
  const likelyInjuries = new Set<string>();

  for (const hazard of hazards) {
    const lower = hazard.toLowerCase();
    if (lower.includes("struck") || lower.includes("falling object")) {
      likelyInjuries.add("Likely injury pattern: struck-by exposure from moving equipment, haul routes, or active work zones.");
    }
    if (lower.includes("slip") || lower.includes("trip") || lower.includes("fall")) {
      likelyInjuries.add("Likely injury pattern: same-level fall or lower-level fall exposure during access, setup, and verification work.");
    }
    if (lower.includes("electrical")) {
      likelyInjuries.add("Likely injury pattern: electric shock or contact with energized systems during utility or layout support work.");
    }
    if (lower.includes("collapse") || lower.includes("excavation")) {
      likelyInjuries.add("Likely injury pattern: excavation edge, collapse, or ground-instability exposure while verifying utilities or grades.");
    }
    if (lower.includes("chemical") || lower.includes("silica") || lower.includes("dust")) {
      likelyInjuries.add("Likely injury pattern: dust, silica, or chemical exposure where survey work intersects with active construction operations.");
    }
  }

  if (likelyInjuries.size === 0) {
    likelyInjuries.add("Likely injury pattern: access, visibility, and equipment-interaction exposure in active construction zones.");
  }

  return [...likelyInjuries];
}

function buildRequiredTraining(input: SurveyTestFormData, hazards: string[], permits: string[]) {
  const taskText = input.tasks.join(" ").toLowerCase();
  const hazardText = hazards.join(" ").toLowerCase();
  const training = new Set<string>([
    "Workers shall be instructed on site access routes, active work zones, visibility constraints, and daily pre-task communication before survey work begins.",
    "Personnel performing benchmark, control, layout, or as-built work shall understand the control basis, required tolerances, and documentation expected for the assigned task.",
    "Instrument users shall confirm equipment readiness, battery status, calibration condition, and data-collection method before field work starts.",
  ]);

  if (hasAny(taskText, ["utility locating", "control points", "slope verification"])) {
    training.add(
      "Utility coordination, underground-awareness, and control-point protection expectations shall be reviewed before field verification begins."
    );
  }

  if (hasAny(taskText, ["building layout", "anchor bolt verification", "grid layout", "elevation checks"])) {
    training.add(
      "Crews shall review how layout marks are issued, rechecked, protected, and handed off before dependent trades build from them."
    );
  }

  if (hazardText.includes("struck")) {
    training.add(
      "Workers shall be trained on traffic-control expectations, equipment interaction, blind-spot awareness, and when spotter support is required."
    );
  }

  if (hazardText.includes("fall")) {
    training.add(
      "Workers shall be trained on safe positioning near edges, slabs, excavations, and unfinished decks before working from those areas."
    );
  }

  if (permits.some((permit) => permit.toLowerCase().includes("ground disturbance"))) {
    training.add(
      "Ground-disturbance and utility-locate coordination shall be reviewed whenever survey work supports excavation, trenching, or exposed utility work."
    );
  }

  return [...training];
}

function buildElementsRequired(
  input: SurveyTestFormData,
  hazards: string[],
  permits: string[],
  overlapPermitHints: string[]
) {
  const taskText = input.tasks.join(" ").toLowerCase();
  const elements = new Set<string>([
    "Project datum, benchmark basis, and current control references confirmed before work starts.",
    "Latest drawings, control sheets, and issued revisions available to the crew in the field.",
    "Instrument readiness and calibration status verified before layout or verification work begins.",
    "Control-point protection plan and recheck process established before dependent trades proceed.",
    "As-built capture plan and documentation handoff identified before the record opportunity is lost.",
  ]);

  if (hasAny(taskText, ["utility locating", "slope verification", "elevation checks"])) {
    elements.add("Utility information, locate status, and grade verification references available for the affected area.");
  }

  if (hasAny(taskText, ["building layout", "grid layout", "anchor bolt verification"])) {
    elements.add("Layout sequence and verification hold points identified before concrete, steel, or equipment-setting work proceeds.");
  }

  if (hazards.join(" ").toLowerCase().includes("struck")) {
    elements.add("Access route review, traffic-control plan, and communication method confirmed for active work zones.");
  }

  if (permits.length || overlapPermitHints.length) {
    elements.add(
      `Permit or approval triggers reviewed: ${uniq([...permits, ...overlapPermitHints]).join(", ")}.`
    );
  }

  return [...elements];
}

export const SURVEY_TEST_LAYOUT_SECTIONS: SurveyTestLayoutSection[] = [
  {
    key: "risks_hazards",
    number: 1,
    title: "Risks & Hazards",
    summary:
      "Control establishment, field layout, verification, and as-built documentation for land survey operations.",
    subsections: [
      {
        number: "1.1",
        title: "Control basis error",
        body:
          "Survey and layout work can affect every downstream trade. If the benchmark basis, control network, or grid information is set incorrectly, misunderstood, or disturbed, the error can carry into excavation, foundations, steel, paving, utility placement, equipment setting, and turnover verification (R1).",
      },
      {
        number: "1.2",
        title: "Site exposure",
        body:
          "Survey crews often work near haul routes, excavations, slab edges, unfinished decks, uneven ground, and active equipment travel paths. That creates struck-by, trip, slip, access, and visibility hazards if the area is not reviewed and controlled before work begins (R4, R5, R9).",
      },
      {
        number: "1.3",
        title: "Hidden-condition conflict",
        body:
          "Utility locating, as-built recovery, and slope or elevation checks may place workers near buried services, changing grades, or partially completed work. A missed locate, bad record, or late verification can create rework, damage exposure, or unsafe field improvisation (R8, R11).",
      },
    ],
  },
  {
    key: "work_planning",
    number: 2,
    title: "Work Planning Steps (Pre-Task & Pre-Construction)",
    summary:
      "Keep the control basis clear, protect crews working in active construction zones, and make sure the installed work can be laid out, checked, and recorded with confidence.",
    subsections: [
      {
        number: "2.1",
        title: "Pre-construction planning",
        body:
          "Before field work begins, the team should confirm the project datum, benchmark basis, coordinate system, tolerances, latest drawings, control-point protection plan, utility information, required access routes, and the sequence for layout, checks, and record shots (R1).",
      },
      {
        number: "2.2",
        title: "Pre-task review",
        body:
          "Daily planning should confirm instrument readiness, battery and calibration status, current site access, weather and visibility, active work zones, manpower, communication method, and whether any traffic control, utility coordination, or restricted-area approval is needed before the crew starts work (R2, R7).",
      },
      {
        number: "2.3",
        title: "Task sequencing",
        body:
          "Building layout, grid transfer, elevation checks, slope verification, and anchor bolt checks should be performed early enough to support the work that depends on them. As-built shots and as-built survey work should be completed before the installed work is buried, enclosed, or turned over (R11).",
      },
    ],
  },
  {
    key: "structural_stability",
    number: 3,
    title: "Structural Stability Requirements",
    summary: "Survey and verification work depends on stable setup surfaces and safe access.",
    subsections: [
      {
        number: "3.1",
        title: "Stable setup surfaces",
        body:
          "Tripods, prisms, rods, and layout equipment should be set on firm, suitable surfaces. Survey work should not rely on unstable fill, loose material, unsupported forms, shifting spoil, or locations where vibration or traffic can move the control basis during measurement (R1).",
      },
      {
        number: "3.2",
        title: "Work near excavations and edges",
        body:
          "When survey or verification work is performed near trenches, slope breaks, open excavations, or elevated deck areas, the crew should maintain safe positioning, use approved access, and avoid working from locations that cannot support stable footing or safe instrument setup (R9, R10).",
      },
    ],
  },
  {
    key: "connecting_and_decking",
    number: 4,
    title: "Connecting & Decking Requirements",
    summary: "Protect, check, and reconnect to control before dependent work proceeds.",
    subsections: [
      {
        number: "4.1",
        title: "Control continuity",
        body:
          "Survey and layout work depends on consistent connection back to established control. Benchmarks, hubs, nails, batter boards, wall marks, deck points, and transferred grid references should be protected, checked, and reverified before dependent work proceeds (R1).",
      },
      {
        number: "4.2",
        title: "Structural and deck-related checks",
        body:
          "Where layout or verification occurs on slabs, elevated decks, or structural areas, the crew should confirm that the working surface is ready for access and that anchor bolt templates, deck markings, embeds, and other layout references are not being disturbed by active construction or incomplete protection (R6).",
      },
    ],
  },
  {
    key: "training_requirements",
    number: 5,
    title: "Training Requirements",
    summary: "Training should stay aligned with the active survey, verification, and documentation work.",
    subsections: [
      {
        number: "5.1",
        title: "General training",
        body:
          "Personnel performing survey and layout activities should be instructed on recognized site hazards, equipment traffic, utility markings, housekeeping expectations, access routes, communication requirements, and the limits of the work area before field operations begin (R2).",
      },
      {
        number: "5.2",
        title: "Task-specific training",
        body:
          "Workers assigned to benchmarking, grid transfer, building layout, elevation checks, anchor bolt verification, slope verification, utility locating support, and as-built documentation should understand the required accuracy, the control basis, the staking or marking convention, and the documentation expected for that task.",
      },
      {
        number: "5.2.1",
        title: "Equipment-related training",
        body:
          "If survey work requires lifts, UTVs, trucks, or other mechanized equipment for access or support, only personnel with the proper training or experience should operate that equipment as part of the task (R7).",
      },
      {
        number: "5.2.2",
        title: "Update training",
        body:
          "Additional instruction should be provided whenever the datum changes, control is reset, the work sequence changes, the crew moves into a different exposure area, or site conditions change enough to affect how measurements are taken or verified (R2).",
      },
    ],
  },
  {
    key: "certification_requirements",
    number: 6,
    title: "Certification Requirements",
    summary: "Survey and layout work does not create a single universal certification requirement by itself.",
    subsections: [
      {
        number: "6.1",
        title: "General applicability",
        body:
          "Survey and layout work does not create one single universal certification requirement simply because the task is called survey or layout.",
      },
      {
        number: "6.2",
        title: "When certifications apply",
        body:
          "A licensed surveyor may be required where contract documents or state law apply to boundary, record, or certified survey work. Separate qualifications may also be required when the work involves utility locating services, excavation access, elevated work, traffic control, or equipment operation (R7, R8).",
      },
    ],
  },
  {
    key: "required_equipment",
    number: 7,
    title: "Required Equipment",
    summary: "Typical survey work depends on both measurement equipment and support equipment.",
    subsections: [
      {
        number: "7.1",
        title: "Basic survey equipment",
        body:
          "Typical equipment includes total stations, GNSS receivers, levels, rods, prisms, tribrachs, plumb bobs, tapes, marking tools, stakes, nails, paint, field books, and data collectors needed to establish, transfer, check, and document control.",
      },
      {
        number: "7.2",
        title: "Support equipment",
        body:
          "Additional support equipment may include radios, lighting, PPE, traffic-control devices, monument protection materials, ladders or temporary access equipment where authorized, and any reference drawings or control sheets needed to keep the work accurate and traceable (R4, R5).",
      },
    ],
  },
  {
    key: "required_permits",
    number: 8,
    title: "Required Permits (If Applicable)",
    summary: "Survey and layout activities do not usually create a standalone permit by themselves.",
    subsections: [
      {
        number: "8.1",
        title: "General applicability",
        body:
          "Survey and layout activities do not usually create a standalone permit requirement by themselves.",
      },
      {
        number: "8.2",
        title: "Related permit triggers",
        body:
          "Permit or approval requirements may still apply when survey work ties into utility locating, excavation access, traffic control, railroad or owner-controlled access, confined spaces, elevated work, or other controlled conditions that are part of the area being measured or verified (R8, R11).",
      },
    ],
  },
  {
    key: "affected_trades",
    number: 9,
    title: "Trades Most Affected by Survey / Layout Requirements",
    summary: "Every downstream trade relies on the control basis staying intact.",
    subsections: [
      {
        number: "9.1",
        title: "Primary affected parties",
        body:
          "These requirements most directly affect survey crews, superintendents, excavation teams, utility installers, concrete crews, steel erectors, equipment setters, and grading personnel because they depend on accurate control and timely verification to perform their work safely and correctly.",
      },
      {
        number: "9.2",
        title: "Shared responsibility",
        body:
          "Every downstream trade relies on the control basis staying intact. If a benchmark, grid line, offset, deck mark, or building control point is damaged, moved, or covered, the issue should be reported and corrected before additional work is built from that reference (R1).",
      },
    ],
  },
  {
    key: "additional_related_information",
    number: 10,
    title: "Additional Related Information",
    summary: "Keep the establish-protect-recheck-verify-as-built cycle active across the project.",
    subsections: [
      {
        number: "10.1",
        title: "Verification cycle",
        body:
          "Survey and layout quality depends on a repeatable cycle: establish the control, protect it, recheck it, use it for layout, verify the installed condition, and capture the as-built record before the opportunity is lost. That cycle should remain active throughout grading, foundations, structure, utilities, and closeout work (R1, R11).",
      },
      {
        number: "10.2",
        title: "Documentation and housekeeping",
        body:
          "Field notes, electronic files, issued control sheets, and as-built records should be kept current and understandable to the people using them. Superseded marks should be removed or clearly identified, and walk paths around active control points should be kept clear enough to support safe access and repeatable measurement work (R3).",
      },
    ],
  },
];

export const SURVEY_TEST_REFERENCE_SOURCE_POINTS = [
  "R1. Employers shall initiate and maintain programs necessary to comply with Part 1926, including frequent and regular inspections by competent persons. 29 CFR 1926.20(b)(1)-(2).",
  "R2. The employer shall instruct each employee in the recognition and avoidance of unsafe conditions and the regulations applicable to the work environment. 29 CFR 1926.21(b)(2).",
  "R3. Debris and unnecessary materials shall be kept cleared from work areas, passageways, and stairs. 29 CFR 1926.25(a).",
  "R4. Construction areas, stairs, ramps, runways, and storage areas where work is in progress shall be lighted with natural or artificial illumination. 29 CFR 1926.26.",
  "R5. The employer is responsible for requiring appropriate personal protective equipment where hazardous conditions exist. 29 CFR 1926.28(a).",
  "R6. Means of egress and access to exits shall be arranged and maintained so they remain free and unobstructed. 29 CFR 1926.34(a)-(c).",
  "R7. The employer shall permit only those employees qualified by training or experience to operate equipment and machinery. 29 CFR 1926.20(b)(4).",
  "R8. The estimated location of underground utility installations shall be determined before opening an excavation. 29 CFR 1926.651(b)(1).",
  "R9. Where mobile equipment operates near excavation edges and visibility is restricted, warning systems such as barricades, hand or mechanical signals, or stop logs shall be used. 29 CFR 1926.651(f).",
  "R10. Safe means of access and egress shall be provided for trench excavations 4 feet or more in depth. 29 CFR 1926.651(c)(2).",
  "R11. One-call / 811 coordination, utility records, and safe exposure practices should be built into excavation damage-prevention planning and project documentation. CGA Best Practices 19.0 and AGC underground utility excavation safety guidance.",
];

export function createDefaultSurveyTestForm(): SurveyTestFormData {
  return {
    project_name: "",
    project_number: "",
    project_address: "",
    owner_client: "",
    gc_cm: "",
    contractor_company: "",
    contractor_contact: "",
    contractor_phone: "",
    contractor_email: "",
    trade: SURVEY_TEST_TRADE_LABEL,
    subTrade: "",
    tasks: [],
    selectedLayoutSections: SURVEY_TEST_LAYOUT_SECTIONS.map((section) => section.key),
    scope_of_work: "",
    site_specific_notes: "",
    emergency_procedures: "",
    required_ppe: [],
    additional_permits: [],
    selected_hazards: [],
  };
}

export function getSurveyTestTradeOptions() {
  return [SURVEY_TEST_TRADE_LABEL];
}

export function getSurveyTestSubTradeOptions() {
  return getCsepSubTradeOptions(SURVEY_TEST_TRADE_LABEL);
}

export function getSurveyTestTaskOptions(subTradeLabel: string) {
  if (!subTradeLabel.trim()) {
    return { selectable: [], reference: [] };
  }
  return getCsepTaskOptions(SURVEY_TEST_TRADE_LABEL, subTradeLabel);
}

export function buildSurveyTestEnrichment(input: SurveyTestFormData): SurveyTestEnrichment {
  const tradeSelection =
    buildCsepTradeSelection(
      SURVEY_TEST_TRADE_LABEL,
      input.subTrade || null,
      input.tasks
    ) ?? buildCsepTradeSelection(SURVEY_TEST_TRADE_LABEL);

  const selectedTasks = tradeSelection?.items.length ? input.tasks : [];
  const hazards = uniq([
    ...(input.selected_hazards ?? []),
    ...(tradeSelection?.derivedHazards ?? []),
  ]);
  const permitsRequired = uniq([
    ...(input.additional_permits ?? []),
    ...(tradeSelection?.derivedPermits ?? []),
    ...(tradeSelection?.overlapPermitHints ?? []),
  ]);
  const ppe = uniq([
    ...(input.required_ppe ?? []),
    ...(tradeSelection?.defaultPPE ?? []),
  ]);
  const programSelections = buildCsepProgramSelections({
    selectedHazards: hazards,
    selectedPermits: permitsRequired,
    selectedPpe: ppe,
    tradeItems: tradeSelection?.items ?? [],
    selectedTasks,
  }).selections;
  const programSelectionLabels = uniq(
    programSelections.map((selection) => `${selection.category.toUpperCase()}: ${selection.item}`)
  );
  const requiredTraining = buildRequiredTraining(input, hazards, permitsRequired);
  const elementsRequired = buildElementsRequired(
    input,
    hazards,
    permitsRequired,
    tradeSelection?.overlapPermitHints ?? []
  );
  const selectedSections =
    input.selectedLayoutSections.length > 0
      ? SURVEY_TEST_LAYOUT_SECTIONS.filter((section) =>
          input.selectedLayoutSections.includes(section.key)
        )
      : [...SURVEY_TEST_LAYOUT_SECTIONS];
  const readinessChecklist = [
    { label: "Trade locked to Survey / Layout", done: true },
    { label: "Sub-trade selected", done: Boolean(input.subTrade.trim()) },
    { label: "At least one task selected", done: selectedTasks.length > 0 },
    {
      label: "At least one survey layout section selected",
      done: input.selectedLayoutSections.length > 0,
    },
    {
      label: "AI enrichment assembled",
      done: Boolean(input.subTrade.trim()) && selectedTasks.length > 0,
    },
  ];

  return {
    tradeLabel: SURVEY_TEST_TRADE_LABEL,
    subTradeLabel: tradeSelection?.subTradeLabel ?? null,
    selectedTasks,
    selectedSections,
    tradeSummary:
      tradeSelection?.summary ??
      "Survey / layout activities require control integrity, field coordination, and repeatable verification before dependent work proceeds.",
    oshaData: tradeSelection?.oshaRefs ?? [],
    sorData: mapHazardsToSorData(hazards),
    injuryData: mapHazardsToInjuryData(hazards),
    requiredTraining: uniq([...requiredTraining, ...programSelectionLabels]),
    permitsRequired,
    elementsRequired,
    hazards,
    ppe,
    tradeItems: tradeSelection?.items ?? [],
    commonOverlappingTrades: tradeSelection?.commonOverlappingTrades ?? [],
    overlapPermitHints: tradeSelection?.overlapPermitHints ?? [],
    readinessChecklist,
  };
}

export function buildSurveyTestReviewSeedText(
  input: SurveyTestFormData,
  enrichment: SurveyTestEnrichment
) {
  return [
    `Workflow source: trade selection -> sub-trade -> select sections -> selectable tasks -> AI enrichment -> AI review -> finish document.`,
    `Trade: ${enrichment.tradeLabel}`,
    `Sub-trade: ${enrichment.subTradeLabel ?? "Not selected"}`,
    `Selected tasks: ${enrichment.selectedTasks.length ? enrichment.selectedTasks.join(", ") : "None"}`,
    `Selected layout sections: ${enrichment.selectedSections.map((section) => `${section.number}. ${section.title}`).join(" | ")}`,
    `Scope of work: ${mergeScopeText(input, enrichment.selectedTasks)}`,
    `Site specific notes: ${input.site_specific_notes.trim() || "Not provided."}`,
    `Emergency procedures: ${defaultEmergencyProcedures(input)}`,
    `Trade summary: ${enrichment.tradeSummary}`,
    `Hazards: ${enrichment.hazards.join(", ") || "None yet"}`,
    `PPE: ${enrichment.ppe.join(", ") || "None yet"}`,
    `Permits required: ${enrichment.permitsRequired.join(", ") || "None currently triggered"}`,
    `Required training: ${enrichment.requiredTraining.join(" | ") || "None yet"}`,
    `Elements required: ${enrichment.elementsRequired.join(" | ") || "None yet"}`,
    `OSHA data: ${enrichment.oshaData.join(" | ") || "None yet"}`,
    `SOR data: ${enrichment.sorData.join(" | ") || "None yet"}`,
    `Injury data: ${enrichment.injuryData.join(" | ") || "None yet"}`,
    `Overlapping trades: ${enrichment.commonOverlappingTrades.join(", ") || "None inferred"}`,
    `Overlap hints: ${enrichment.overlapPermitHints.join(", ") || "None inferred"}`,
  ].join("\n");
}

export function buildSurveyTestExportPayload(input: SurveyTestFormData) {
  const enrichment = buildSurveyTestEnrichment(input);

  return {
    project_name: input.project_name.trim() || "Survey Test CSEP",
    project_number: input.project_number.trim(),
    project_address: input.project_address.trim(),
    owner_client: input.owner_client.trim(),
    gc_cm: input.gc_cm.trim(),
    contractor_company: input.contractor_company.trim() || "SafetyDocs360",
    contractor_contact: input.contractor_contact.trim(),
    contractor_phone: input.contractor_phone.trim(),
    contractor_email: input.contractor_email.trim(),
    trade: SURVEY_TEST_TRADE_LABEL,
    subTrade: input.subTrade.trim(),
    tasks: enrichment.selectedTasks,
    scope_of_work: mergeScopeText(input, enrichment.selectedTasks),
    site_specific_notes:
      input.site_specific_notes.trim() ||
      "Control points, access routes, visibility, and downstream trade impacts shall be reviewed before layout or verification proceeds.",
    emergency_procedures: defaultEmergencyProcedures(input),
    required_ppe: enrichment.ppe,
    additional_permits: enrichment.permitsRequired,
    selected_hazards: enrichment.hazards,
    tradeSummary: enrichment.tradeSummary,
    oshaRefs: enrichment.oshaData,
    tradeItems: enrichment.tradeItems,
    derivedHazards: enrichment.hazards,
    derivedPermits: enrichment.permitsRequired,
    overlapPermitHints: enrichment.overlapPermitHints,
    common_overlapping_trades: enrichment.commonOverlappingTrades,
    layoutVariant: "survey_test" as const,
    surveyLayoutSections: enrichment.selectedSections.map((section) => section.key),
    surveyElementsRequired: enrichment.elementsRequired,
    surveyTrainingRequired: enrichment.requiredTraining,
    surveySorData: enrichment.sorData,
    surveyInjuryData: enrichment.injuryData,
  };
}
