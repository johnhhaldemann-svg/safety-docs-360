export const runtime = "nodejs";

import {
  Packer,
  Paragraph,
} from "docx";
import { NextResponse } from "next/server";
import type { CSEPRiskItem } from "@/lib/csepTradeSelection";
import { buildCsepProgramSections, buildCsepProgramSelections } from "@/lib/csepPrograms";
import {
  getDocumentBuilderSection,
  resolveDocumentBuilderSection,
} from "@/lib/documentBuilderText";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import { getCsepProgramConfig } from "@/lib/csepProgramSettings";
import {
  createCsepBody,
  createCsepCover,
  createCsepDocument,
  createCsepInfoTable,
  createCsepLabeledParagraph,
  createCsepPageBreak,
  createCsepSectionHeading,
  createCsepSubheading,
  valueOrNA,
} from "@/lib/csepDocxTheme";
import {
  buildSurveyTestEnrichment,
  SURVEY_TEST_LAYOUT_SECTIONS,
  SURVEY_TEST_LAYOUT_VARIANT,
  SURVEY_TEST_REFERENCE_SOURCE_POINTS,
  type SurveyTestLayoutSectionKey,
} from "@/lib/csepSurveyTest";
import { buildLegacyCsepRenderModel } from "@/lib/csepLegacyDocx";
import { renderCsepRenderModel, renderGeneratedCsepDocx } from "@/lib/csepDocxRenderer";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import { authorizeRequest } from "@/lib/rbac";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
  getSafetyBlueprintDraftFilename,
} from "@/lib/safetyBlueprintLabels";
import { loadGeneratedDocumentDraft } from "@/lib/safety-intelligence/repository";
import type { CsepWeatherSectionInput } from "@/types/csep-builder";
import type { DocumentBuilderTextConfig } from "@/types/document-builder-text";
import type { CSEPProgramSection, CSEPProgramSelection, CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue } from "@/types/csep-programs";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

type GeneratedCsepDocxRequest = {
  generatedDocumentId?: string | null;
  draft?: GeneratedSafetyPlanDraft | null;
};

type GeneratedDocumentDraftLoaderClient = Parameters<typeof loadGeneratedDocumentDraft>[0];

type HazardProgram = {
  title: string;
  triggerHazards: string[];
  oshaRefs: string[];
  purpose: string;
  controls: string[];
};

type IncludedContent = {
  project_information?: boolean;
  contractor_information?: boolean;
  trade_summary?: boolean;
  scope_of_work?: boolean;
  site_specific_notes?: boolean;
  emergency_procedures?: boolean;
  weather_requirements_and_severe_weather_response?: boolean;
  required_ppe?: boolean;
  additional_permits?: boolean;
  common_overlapping_trades?: boolean;
  osha_references?: boolean;
  selected_hazards?: boolean;
  activity_hazard_matrix?: boolean;
  roles_and_responsibilities?: boolean;
  security_and_access?: boolean;
  health_and_wellness?: boolean;
  incident_reporting_and_investigation?: boolean;
  training_and_instruction?: boolean;
  drug_and_alcohol_testing?: boolean;
  enforcement_and_corrective_action?: boolean;
  recordkeeping?: boolean;
  continuous_improvement?: boolean;
};

type CSEPInput = {
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
  subTrade?: string;
  tasks?: string[];
  scope_of_work: string;
  site_specific_notes: string;
  emergency_procedures: string;
  weather_requirements?: CsepWeatherSectionInput;

  required_ppe: string[];
  additional_permits: string[];
  selected_hazards?: string[];
  programSelections?: CSEPProgramSelection[];
  program_subtype_selections?: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
  included_sections?: string[];

  tradeSummary?: string;
  oshaRefs?: string[];
  tradeItems?: CSEPRiskItem[];
  derivedHazards?: string[];
  derivedPermits?: string[];
  overlapPermitHints?: string[];
  common_overlapping_trades?: string[];
  includedContent?: IncludedContent;
  layoutVariant?: "standard" | "survey_test";
  surveyLayoutSections?: SurveyTestLayoutSectionKey[];
  surveyElementsRequired?: string[];
  surveyTrainingRequired?: string[];
  surveySorData?: string[];
  surveyInjuryData?: string[];
  roles_and_responsibilities_text?: string;
  security_and_access_text?: string;
  health_and_wellness_text?: string;
  incident_reporting_and_investigation_text?: string;
  training_and_instruction_text?: string;
  drug_and_alcohol_testing_text?: string;
  enforcement_and_corrective_action_text?: string;
  recordkeeping_text?: string;
  continuous_improvement_text?: string;
};

function heading1(text: string) {
  return createCsepSectionHeading(text);
}

function heading2(text: string) {
  return createCsepSubheading(text);
}

function body(
  text: string
) {
  return createCsepBody(text);
}

function numberedItem(prefix: string, text: string) {
  return body(`${prefix} ${text}`);
}

function appendNumberedItems(
  children: Paragraph[],
  sectionPrefix: string,
  items: string[]
) {
  items.forEach((item, index) => {
    children.push(numberedItem(`${sectionPrefix}.${index + 1}`, item));
  });
}

function buildProjectInfoTable(form: CSEPInput) {
  return createCsepInfoTable([
    [
      "Project Name",
      valueOrNA(form.project_name),
      "Project Number",
      valueOrNA(form.project_number),
    ],
    [
      "Project Address",
      valueOrNA(form.project_address),
      "Owner / Client",
      valueOrNA(form.owner_client),
    ],
    [
      "GC / CM",
      valueOrNA(form.gc_cm),
      "Trade",
      valueOrNA(form.trade),
    ],
    [
      "Sub-trade",
      valueOrNA(form.subTrade),
      "Selected Tasks",
      Array.isArray(form.tasks) && form.tasks.length ? form.tasks.join(", ") : "N/A",
    ],
  ]);
}

function buildContractorInfoTable(form: CSEPInput) {
  return createCsepInfoTable([
    [
      "Contractor Company",
      valueOrNA(form.contractor_company),
      "Contractor Contact",
      valueOrNA(form.contractor_contact),
    ],
    [
      "Contractor Phone",
      valueOrNA(form.contractor_phone),
      "Contractor Email",
      valueOrNA(form.contractor_email),
    ],
  ]);
}

function buildRiskTable(sectionPrefix: string, items: CSEPRiskItem[]) {
  return items.flatMap((item, index) => {
    const prefix = `${sectionPrefix}.${index + 1}`;

    return [
      heading2(`${prefix} ${item.activity}`),
      createCsepLabeledParagraph("Hazard", item.hazard, {
        prefix: `${prefix}.1`,
        indentLeft: 240,
      }),
      createCsepLabeledParagraph("Risk", item.risk, {
        prefix: `${prefix}.2`,
        indentLeft: 240,
      }),
      createCsepLabeledParagraph("Controls", item.controls.join(", "), {
        prefix: `${prefix}.3`,
        indentLeft: 240,
      }),
      createCsepLabeledParagraph("Permit", item.permit, {
        prefix: `${prefix}.4`,
        indentLeft: 240,
      }),
    ];
  });
}

function getCsepSection(
  config: DocumentBuilderTextConfig | null | undefined,
  key: string
) {
  return getDocumentBuilderSection(config, "csep", key);
}

function getResolvedCsepSection(
  config: DocumentBuilderTextConfig | null | undefined,
  key: string
) {
  return resolveDocumentBuilderSection(config, "csep", key);
}

function getResolvedSiteBuilderSection(
  config: DocumentBuilderTextConfig | null | undefined,
  key: string
) {
  return resolveDocumentBuilderSection(config, "site_builder", key);
}

function normalizeTextList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function buildResponsibilitiesTable(
  sectionPrefix: string,
  config: DocumentBuilderTextConfig | null | undefined
) {
  const rolesSection = getCsepSection(config, "roles_and_responsibilities");
  const childMap = new Map(
    (rolesSection?.children ?? []).map((child) => [child.key, child])
  );

  const rows = [
    [
      "Contractor Superintendent",
      childMap.get("contractor_superintendent")?.paragraphs[0] ??
        "Direct field operations, coordinate work sequencing, enforce the site-specific safety plan, and correct unsafe conditions immediately.",
    ],
    [
      "Foreman / Lead",
      childMap.get("foreman_lead")?.paragraphs[0] ??
        "Review daily activities with the crew, verify controls are in place, confirm required permits are obtained, and stop work when hazards change.",
    ],
    [
      "Workers",
      childMap.get("workers")?.paragraphs[0] ??
        `Follow this ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}, wear required PPE, attend safety briefings, report hazards immediately, and refuse unsafe work.`,
    ],
    [
      "Safety Representative",
      childMap.get("safety_representative")?.paragraphs[0] ??
        "Support inspections, hazard assessments, coaching, corrective actions, and verification of permit and training compliance.",
    ],
  ] as const;

  return rows.flatMap(([role, responsibility], index) => {
    const prefix = `${sectionPrefix}.${index + 1}`;

    return [
      heading2(`${prefix} ${role}`),
      createCsepLabeledParagraph("Responsibility", responsibility, {
        prefix: `${prefix}.1`,
        indentLeft: 240,
      }),
    ];
  });
}

function buildTrainingBullets(
  form: CSEPInput
) {
  const bullets: string[] = [];

  const textSeed = [
    form.trade,
    form.subTrade,
    ...(Array.isArray(form.tasks) ? form.tasks : []),
    ...(Array.isArray(form.selected_hazards) ? form.selected_hazards : []),
    form.scope_of_work,
    form.site_specific_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const utilityScope = /\butility\b|locator wire|manhole|vault|duct bank|catch basin|storm structure|site drainage|pipe laying|install pipe/.test(
    textSeed
  );
  const excavationScope = /\bexcavat|\btrench|shoring|bench\/shore|backfill|trench support|\bdig|groundbreaking|ground[\s-]?breaking|ground disturb/.test(
    textSeed
  );

  if ((form.trade || "").toLowerCase().includes("electrical")) {
    bullets.push(
      "Electrical workers shall be trained on LOTO, temporary power, and energized work restrictions."
    );
  }

  if (excavationScope) {
    bullets.push(
      utilityScope
        ? "Excavation workers shall be trained on trench hazards, soil conditions, utility awareness, and protective systems."
        : "Excavation workers shall be trained on trench hazards, soil conditions, protective systems, and safe access / egress."
    );
  }

  if ((form.trade || "").toLowerCase().includes("roof")) {
    bullets.push(
      "Roofing workers shall be trained on fall protection systems, leading-edge controls, and weather restrictions."
    );
  }

  return bullets;
}

function hasUtilityScope(form: CSEPInput) {
  const textSeed = [
    form.trade,
    form.subTrade,
    ...(Array.isArray(form.tasks) ? form.tasks : []),
    ...(Array.isArray(form.selected_hazards) ? form.selected_hazards : []),
    form.scope_of_work,
    form.site_specific_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\butility\b|locator wire|manhole|vault|duct bank|catch basin|storm structure|site drainage|pipe laying|install pipe/.test(
    textSeed
  );
}

function buildWeatherProjectOverlayItems(weather: CsepWeatherSectionInput | undefined) {
  if (!weather) {
    return [];
  }

  const items: string[] = [];
  const monitoringSources = normalizeTextList(weather.monitoringSources);
  const communicationMethods = normalizeTextList(weather.communicationMethods);
  const highWindControls = normalizeTextList(weather.highWindControls);
  const heatControls = normalizeTextList(weather.heatControls);
  const coldControls = normalizeTextList(weather.coldControls);
  const tornadoStormControls = normalizeTextList(weather.tornadoStormControls);
  const environmentalControls = normalizeTextList(weather.environmentalControls);
  const projectOverrideNotes = normalizeTextList(weather.projectOverrideNotes);

  if (monitoringSources.length) {
    items.push(`Monitoring sources: ${monitoringSources.join(", ")}.`);
  }

  if (communicationMethods.length) {
    items.push(`Weather communication methods: ${communicationMethods.join(", ")}.`);
  }

  if (weather.highWindThresholdText?.trim()) {
    items.push(`High-wind threshold or trade rule: ${weather.highWindThresholdText.trim()}.`);
  }

  highWindControls.forEach((item) => {
    items.push(`High-wind control: ${item}.`);
  });

  if (typeof weather.lightningRadiusMiles === "number" && Number.isFinite(weather.lightningRadiusMiles)) {
    const allClearText =
      typeof weather.lightningAllClearMinutes === "number" &&
      Number.isFinite(weather.lightningAllClearMinutes)
        ? ` with a ${weather.lightningAllClearMinutes}-minute all-clear delay`
        : "";
    items.push(
      `Lightning stop-work radius: ${weather.lightningRadiusMiles} miles${allClearText}.`
    );
  } else if (
    typeof weather.lightningAllClearMinutes === "number" &&
    Number.isFinite(weather.lightningAllClearMinutes)
  ) {
    items.push(`Lightning all-clear delay: ${weather.lightningAllClearMinutes} minutes.`);
  }

  if (weather.lightningShelterNotes?.trim()) {
    items.push(`Lightning shelter / response note: ${weather.lightningShelterNotes.trim()}.`);
  }

  if (weather.heatTriggerText?.trim()) {
    items.push(`Heat trigger: ${weather.heatTriggerText.trim()}.`);
  }

  heatControls.forEach((item) => {
    items.push(`Heat control: ${item}.`);
  });

  if (weather.coldTriggerText?.trim()) {
    items.push(`Cold or wind-chill trigger: ${weather.coldTriggerText.trim()}.`);
  }

  coldControls.forEach((item) => {
    items.push(`Cold-weather control: ${item}.`);
  });

  if (weather.tornadoStormShelterNotes?.trim()) {
    items.push(`Storm / tornado shelter note: ${weather.tornadoStormShelterNotes.trim()}.`);
  }

  tornadoStormControls.forEach((item) => {
    items.push(`Storm control: ${item}.`);
  });

  environmentalControls.forEach((item) => {
    items.push(`Weather-related environmental control: ${item}.`);
  });

  projectOverrideNotes.forEach((item) => {
    items.push(item.endsWith(".") ? item : `${item}.`);
  });

  return items;
}

function buildWeatherContractorItems(weather: CsepWeatherSectionInput | undefined) {
  if (!weather) {
    return [];
  }

  const items: string[] = [];
  const contractorResponsibilityNotes = normalizeTextList(weather.contractorResponsibilityNotes);

  if (weather.dailyReviewNotes?.trim()) {
    items.push(`Daily weather review / task-planning note: ${weather.dailyReviewNotes.trim()}.`);
  }

  if (weather.unionAccountabilityNotes?.trim()) {
    items.push(`Union steward / accountability note: ${weather.unionAccountabilityNotes.trim()}.`);
  }

  contractorResponsibilityNotes.forEach((item) => {
    items.push(item.endsWith(".") ? item : `${item}.`);
  });

  return items;
}

function appendResolvedSectionContent(
  children: Paragraph[],
  sectionPrefix: string,
  section: ReturnType<typeof getResolvedCsepSection> | ReturnType<typeof getResolvedSiteBuilderSection>,
  options?: {
    extraParagraphs?: string[];
    extraBullets?: string[];
  }
) {
  const extraParagraphs = (options?.extraParagraphs ?? []).filter(Boolean);
  const extraBullets = (options?.extraBullets ?? []).filter(Boolean);

  (section?.paragraphs ?? []).forEach((paragraph) => {
    children.push(body(paragraph));
  });

  if ((section?.bullets?.length ?? 0) > 0) {
    appendNumberedItems(children, sectionPrefix, section?.bullets ?? []);
  }

  extraParagraphs.forEach((paragraph) => {
    children.push(body(paragraph));
  });

  if (extraBullets.length) {
    const startingIndex = (section?.bullets?.length ?? 0) + 1;
    extraBullets.forEach((item, index) => {
      children.push(numberedItem(`${sectionPrefix}.${startingIndex + index}`, item));
    });
  }
}

function appendNarrativeSection(params: {
  children: Paragraph[];
  sectionNumber: number;
  section: ReturnType<typeof getResolvedCsepSection>;
  fallbackTitle: string;
  extraText?: string;
}) {
  params.children.push(
    heading1(`${params.sectionNumber}. ${params.section?.title ?? params.fallbackTitle}`)
  );
  appendResolvedSectionContent(params.children, String(params.sectionNumber), params.section, {
    extraParagraphs: params.extraText?.trim() ? [params.extraText.trim()] : [],
  });
}

function normalizeIncludedContent(form: CSEPInput): Required<IncludedContent> {
  const defaults: Required<IncludedContent> = {
    project_information: true,
    contractor_information: true,
    trade_summary: true,
    scope_of_work: true,
    site_specific_notes: true,
    emergency_procedures: true,
    weather_requirements_and_severe_weather_response: true,
    required_ppe: true,
    additional_permits: true,
    common_overlapping_trades: true,
    osha_references: true,
    selected_hazards: true,
    activity_hazard_matrix: true,
    roles_and_responsibilities: true,
    security_and_access: true,
    health_and_wellness: true,
    incident_reporting_and_investigation: true,
    training_and_instruction: true,
    drug_and_alcohol_testing: true,
    enforcement_and_corrective_action: true,
    recordkeeping: true,
    continuous_improvement: true,
  };

  return {
    ...defaults,
    ...(form.includedContent ?? {}),
  };
}

const HAZARD_PROGRAM_LIBRARY: HazardProgram[] = [
  {
    title: "Fall Protection Program",
    triggerHazards: ["Falls from height"],
    oshaRefs: ["OSHA 1926 Subpart M – Fall Protection"],
    purpose:
      "This program establishes the minimum controls required to protect workers exposed to falls from height, leading edges, roof edges, floor openings, and elevated work platforms.",
    controls: [
      "A fall protection plan shall be reviewed before elevated work begins.",
      "Approved fall protection systems shall be used when required by site rules or OSHA criteria.",
      "Workers shall inspect harnesses, lanyards, SRLs, anchors, and connectors before each use.",
      "Guardrails, covers, warning lines, and controlled access zones shall be maintained where applicable.",
      "Damaged fall protection equipment shall be removed from service immediately.",
      "Only trained personnel shall use personal fall arrest systems.",
      "Dropped object exposure below elevated work shall be controlled with barricades and exclusion zones.",
    ],
  },
  {
    title: "Electrical Safety Program",
    triggerHazards: ["Electrical shock"],
    oshaRefs: ["OSHA 1926 Subpart K – Electrical"],
    purpose:
      "This program defines the controls required to prevent shock, arc, burn, and energized equipment exposure during construction activities.",
    controls: [
      "All temporary power systems shall be installed and maintained in a safe condition.",
      "GFCI protection shall be used where required.",
      "Damaged cords, tools, and electrical equipment shall be removed from service.",
      "Only qualified personnel shall perform electrical tie-ins, troubleshooting, or energized system work.",
      "LOTO procedures shall be followed before servicing equipment where hazardous energy is present.",
      "Extension cords shall be protected from damage, water, pinch points, and vehicle traffic.",
      "Panels and disconnects shall remain accessible and properly identified.",
    ],
  },
  {
    title: "Hot Work Program",
    triggerHazards: ["Hot work / fire"],
    oshaRefs: ["OSHA 1926 Subpart J – Fire Protection and Prevention"],
    purpose:
      "This program establishes fire prevention and hot work controls for welding, cutting, torch work, grinding, soldering, brazing, and spark-producing tasks.",
    controls: [
      "Hot work shall not begin until required permits are obtained.",
      "Combustible materials shall be removed or protected before hot work starts.",
      "Fire extinguishers shall be available in the immediate work area.",
      "A fire watch shall be assigned when required by permit or site rules.",
      "Workers shall inspect hoses, regulators, torches, leads, and equipment before use.",
      "Hot work shall stop immediately if unsafe conditions develop.",
      "Post-work fire watch requirements shall be followed.",
    ],
  },
  {
    title: "Excavation and Trenching Safety Program",
    triggerHazards: ["Excavation collapse"],
    oshaRefs: ["OSHA 1926 Subpart P – Excavations"],
    purpose:
      "This program provides minimum controls for trenching, excavation support activities, underground utility work, and changing soil conditions.",
    controls: [
      "Excavations shall be inspected by a competent person as required.",
      "Protective systems shall be used where required by depth, soil, and field conditions.",
      "Spoil piles and materials shall be kept back from excavation edges.",
      "Safe access and egress shall be maintained.",
      "Workers shall stay clear of suspended loads and equipment swing areas near trenches.",
      "Underground utilities shall be identified before excavation begins.",
      "Water accumulation, surcharge loading, and changing ground conditions shall be addressed before work continues.",
    ],
  },
  {
    title: "Struck-By and Equipment Safety Program",
    triggerHazards: ["Struck by equipment"],
    oshaRefs: [
      "OSHA 1926 Subpart O – Motor Vehicles, Mechanized Equipment, and Marine Operations",
    ],
    purpose:
      "This program establishes controls for equipment interaction, backing hazards, haul routes, blind spots, and worker exposure around moving equipment.",
    controls: [
      "Workers shall remain clear of moving equipment unless directly involved in the operation.",
      "Spotters shall be used where visibility is restricted or site rules require them.",
      "Equipment routes, swing radiuses, and exclusion zones shall be identified and maintained.",
      "Operators shall inspect equipment before use.",
      "Workers shall wear high visibility garments where equipment traffic is present.",
      "No employee shall position themselves between fixed objects and moving equipment.",
      "Loads shall be secured and transported safely.",
    ],
  },
  {
    title: "Ladder Safety Program",
    triggerHazards: ["Ladder misuse"],
    oshaRefs: ["OSHA 1926 Subpart X – Stairways and Ladders"],
    purpose:
      "This program establishes controls for safe ladder selection, inspection, setup, and use.",
    controls: [
      "Ladders shall be inspected before use.",
      "Damaged ladders shall be removed from service immediately.",
      "Ladders shall be set on stable surfaces and used at the proper angle where applicable.",
      "Three points of contact shall be maintained during climbing.",
      "Workers shall not overreach or use the top step unless the ladder is designed for it.",
      "Ladders shall be secured where required.",
      "Only the proper ladder type shall be used for the task.",
    ],
  },
  {
    title: "Confined Space Safety Program",
    triggerHazards: ["Confined spaces"],
    oshaRefs: ["OSHA 1926 Subpart AA – Confined Spaces in Construction"],
    purpose:
      "This program establishes controls for confined spaces, limited-entry work areas, and spaces requiring atmospheric evaluation or permit controls.",
    controls: [
      "Confined spaces shall be identified before work begins.",
      "Permit requirements shall be followed when applicable.",
      "Atmospheric testing shall be completed when required.",
      "Rescue procedures and communication methods shall be established before entry.",
      "Unauthorized entry shall be prevented.",
      "Entrants, attendants, and supervisors shall understand their responsibilities.",
      "Conditions shall be reevaluated whenever the work or atmosphere changes.",
    ],
  },
  {
    title: "Hazard Communication and Chemical Safety Program",
    triggerHazards: ["Chemical exposure"],
    oshaRefs: ["OSHA 1926.59 / Hazard Communication"],
    purpose:
      "This program establishes minimum requirements for chemical review, SDS access, labeling, handling, storage, and worker protection.",
    controls: [
      "Safety Data Sheets shall be available for chemicals used on site.",
      "Containers shall be properly labeled.",
      "Workers shall review hazards before using chemical products.",
      "Required PPE shall be worn when handling hazardous materials.",
      "Chemical storage areas shall be maintained in a safe condition.",
      "Spill response materials shall be available when required.",
      "Incompatible chemicals shall not be stored together.",
    ],
  },
  {
    title: "Falling Object and Overhead Work Safety Program",
    triggerHazards: ["Falling objects"],
    oshaRefs: ["OSHA 1926 Subpart M – Fall Protection"],
    purpose:
      "This program establishes controls to protect workers from falling tools, materials, debris, and overhead work activities.",
    controls: [
      "Toe boards, debris nets, tool lanyards, or overhead protection shall be used where needed.",
      "Barricades and exclusion zones shall be established below overhead work.",
      "Materials shall be secured against displacement.",
      "Workers shall not enter suspended load zones unless authorized and protected.",
      "Staging at edges and elevated surfaces shall be controlled.",
      "Dropped object risks shall be reviewed during pre-task planning.",
      "Hard hats shall be worn where overhead hazards exist.",
    ],
  },
  {
    title: "Crane, Rigging, and Lift Safety Program",
    triggerHazards: ["Crane lift hazards"],
    oshaRefs: ["OSHA 1926 Subpart CC – Cranes and Derricks in Construction"],
    purpose:
      "This program defines controls for crane activity, rigging, lifting operations, material picks, and suspended load exposure.",
    controls: [
      "Lift plans shall be used when required by site rules or lift complexity.",
      "Only trained and authorized personnel shall rig or direct crane lifts.",
      "Rigging shall be inspected before use.",
      "Workers shall remain clear of suspended loads.",
      "Tag lines shall be used when appropriate.",
      "Communication methods between operators and signal persons shall be clearly established.",
      "Crane setup, ground conditions, and swing areas shall be evaluated before lifting.",
    ],
  },
  {
    title: "Housekeeping and Slip, Trip, Fall Prevention Program",
    triggerHazards: ["Slips trips falls"],
    oshaRefs: ["OSHA 1926 Subpart C – General Safety and Health Provisions"],
    purpose:
      "This program establishes housekeeping expectations to reduce same-level fall hazards, blocked access, and material clutter.",
    controls: [
      "Walkways, access points, and work areas shall be kept clear.",
      "Debris shall be removed routinely.",
      "Cords, hoses, and materials shall be managed to prevent trip hazards.",
      "Wet, muddy, icy, or uneven surfaces shall be addressed promptly.",
      "Lighting shall be adequate for safe travel and work.",
      "Storage areas shall be organized and maintained.",
      "Workers shall report and correct slip, trip, and housekeeping hazards immediately.",
    ],
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTriggeredPrograms(selectedHazards: string[], form: CSEPInput) {
  const utilityScope = hasUtilityScope(form);
  return HAZARD_PROGRAM_LIBRARY
    .filter((program) =>
      program.triggerHazards.some((hazard) => selectedHazards.includes(hazard))
    )
    .map((program) => {
      if (program.title !== "Excavation and Trenching Safety Program" || utilityScope) {
        return program;
      }

      return {
        ...program,
        purpose:
          "This program provides minimum controls for trenching, excavation support activities, and changing soil conditions.",
        controls: program.controls.filter(
          (control) => control !== "Underground utilities shall be identified before excavation begins."
        ),
      };
    });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function addProgramSection(
  children: Paragraph[],
  sectionNumber: number,
  program: HazardProgram
) {
  children.push(heading1(`${sectionNumber}. ${program.title}`));
  children.push(body(program.purpose));

  if (program.oshaRefs.length) {
    children.push(heading2(`${sectionNumber}.1 Applicable References`));
    appendNumberedItems(children, `${sectionNumber}.1`, program.oshaRefs);
  }

  const controlsPrefix = program.oshaRefs.length ? `${sectionNumber}.2` : `${sectionNumber}.1`;
  children.push(heading2(`${controlsPrefix} Minimum Required Controls`));
  appendNumberedItems(children, controlsPrefix, program.controls);
}

function resolveProgramSelections(
  form: CSEPInput,
  selectedHazards: string[],
  selectedPermits: string[],
  requiredPPE: string[],
  tradeItems: CSEPRiskItem[],
  selectedTasks: string[]
) {
  if (Array.isArray(form.programSelections) && form.programSelections.length > 0) {
    return form.programSelections;
  }

  return buildCsepProgramSelections({
    selectedHazards,
    selectedPermits,
    selectedPpe: requiredPPE,
    tradeItems,
    selectedTasks,
    subtypeSelections: form.program_subtype_selections,
  }).selections;
}

function addCatalogProgramSection(
  children: Paragraph[],
  sectionNumber: number,
  program: CSEPProgramSection
) {
  children.push(heading1(`${sectionNumber}. ${program.title}`));
  children.push(body(program.summary));

  program.subsections.forEach((subsection, subsectionIndex) => {
    const subsectionPrefix = `${sectionNumber}.${subsectionIndex + 1}`;
    children.push(heading2(`${subsectionPrefix} ${subsection.title}`));
    appendNumberedItems(children, subsectionPrefix, subsection.bullets);
  });
}

async function buildDoc(form: CSEPInput) {
  if (form.layoutVariant === SURVEY_TEST_LAYOUT_VARIANT) {
    return buildSurveyTestDoc(form);
  }

  const includedContent = normalizeIncludedContent(form);

  const tradeItems = Array.isArray(form.tradeItems) ? form.tradeItems : [];
  const selectedTasks = Array.isArray(form.tasks) ? form.tasks : [];
  const oshaRefs = Array.isArray(form.oshaRefs) ? form.oshaRefs : [];
  const derivedHazards = Array.isArray(form.derivedHazards)
    ? form.derivedHazards
    : [];
  const derivedPermits = Array.isArray(form.derivedPermits)
    ? form.derivedPermits
    : [];
  const overlapPermitHints = Array.isArray(form.overlapPermitHints)
    ? form.overlapPermitHints
    : [];
  const commonOverlappingTrades = Array.isArray(form.common_overlapping_trades)
    ? form.common_overlapping_trades
    : [];
  const requiredPPE = Array.isArray(form.required_ppe) ? form.required_ppe : [];
  const additionalPermits = Array.isArray(form.additional_permits)
    ? form.additional_permits
    : [];
  const selectedHazards = Array.isArray(form.selected_hazards)
    ? form.selected_hazards
    : [];
  const selectedPermits = Array.from(
    new Set([...additionalPermits, ...derivedPermits, ...overlapPermitHints].filter(Boolean))
  );
  const permitList = Array.from(
    new Set([...selectedPermits].filter(Boolean))
  );

  const activeHazards = selectedHazards.length
    ? selectedHazards
    : derivedHazards;
  const programSelections = resolveProgramSelections(
    form,
    activeHazards,
    selectedPermits,
    requiredPPE,
    tradeItems,
    selectedTasks
  );
  const programConfig = await getCsepProgramConfig().catch(() => null);
  const builderTextConfig = await getDocumentBuilderTextConfig().catch(() => null);
  const programSections = buildCsepProgramSections(programSelections, {
    definitions: programConfig?.definitions,
  });

  const children: Paragraph[] = [];

  const subtitleParts = [`Trade: ${valueOrNA(form.trade)}`];

  if (valueOrNA(form.subTrade) !== "N/A") {
    subtitleParts.push(`Sub-trade: ${valueOrNA(form.subTrade)}`);
  }

  if (selectedTasks.length) {
    subtitleParts.push(`Tasks: ${selectedTasks.join(", ")}`);
  }

  children.push(
    ...createCsepCover({
      projectName: valueOrNA(form.project_name),
      subtitle: subtitleParts.join(" | "),
      contractorName: valueOrNA(form.contractor_company),
    })
  );
  children.push(
    createCsepSubheading(`Submission-ready ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE.toLowerCase()}`)
  );

  if (includedContent.project_information) {
    children.push(...buildProjectInfoTable(form));
  }

  if (includedContent.contractor_information) {
    children.push(...buildContractorInfoTable(form));
  }

  let sectionNumber = 1;

  if (includedContent.scope_of_work) {
    const section = getResolvedCsepSection(builderTextConfig, "scope_of_work");
    children.push(heading1(`${sectionNumber}. ${section?.title ?? "Scope of Work"}`));
    children.push(
      body(
        valueOrNA(form.scope_of_work) === "N/A"
          ? section?.paragraphs[0] ??
              "The contractor shall perform work in accordance with the approved project scope, applicable plans, and all site-specific requirements."
          : valueOrNA(form.scope_of_work)
      )
    );
    sectionNumber++;
  }

  if (includedContent.site_specific_notes) {
    const section = getResolvedCsepSection(builderTextConfig, "site_specific_notes");
    children.push(heading1(`${sectionNumber}. ${section?.title ?? "Site Specific Notes"}`));
    children.push(
      body(
        valueOrNA(form.site_specific_notes) === "N/A"
          ? section?.paragraphs[0] ??
              "Site-specific constraints, active construction conditions, adjacent operations, and coordination requirements shall be reviewed daily before work begins."
          : valueOrNA(form.site_specific_notes)
      )
    );
    sectionNumber++;
  }

  if (includedContent.emergency_procedures) {
    const section = getResolvedCsepSection(builderTextConfig, "emergency_procedures");
    children.push(heading1(`${sectionNumber}. ${section?.title ?? "Emergency Procedures"}`));
    children.push(
      body(
        valueOrNA(form.emergency_procedures) === "N/A"
          ? section?.paragraphs[0] ??
              "In the event of an emergency, workers shall stop work, notify supervision immediately, follow site alarm and evacuation procedures, and report to the designated assembly area."
          : valueOrNA(form.emergency_procedures)
      )
    );
    sectionNumber++;
  }

  if (includedContent.weather_requirements_and_severe_weather_response) {
    const sharedWeatherSection = getResolvedSiteBuilderSection(builderTextConfig, "severe_weather");
    const contractorWeatherSection = getCsepSection(
      builderTextConfig,
      "weather_requirements_and_severe_weather_response"
    );
    const weatherProjectOverlayItems = buildWeatherProjectOverlayItems(form.weather_requirements);
    const weatherContractorItems = buildWeatherContractorItems(form.weather_requirements);

    children.push(
      heading1(
        `${sectionNumber}. ${
          contractorWeatherSection?.title ?? "Weather Requirements and Severe Weather Response"
        }`
      )
    );

    if ((sharedWeatherSection?.paragraphs.length ?? 0) > 0) {
      children.push(heading2(`${sectionNumber}.1 Shared Project Baseline`));
      appendResolvedSectionContent(children, `${sectionNumber}.1`, sharedWeatherSection);
    }

    if (weatherProjectOverlayItems.length) {
      children.push(heading2(`${sectionNumber}.2 Project-Specific Weather Overlay`));
      appendNumberedItems(children, `${sectionNumber}.2`, weatherProjectOverlayItems);
    }

    children.push(heading2(`${sectionNumber}.3 Contractor Responsibilities and Response`));
    appendResolvedSectionContent(
      children,
      `${sectionNumber}.3`,
      contractorWeatherSection
        ? {
            ...contractorWeatherSection,
            paragraphs: [...contractorWeatherSection.paragraphs],
            bullets: [...contractorWeatherSection.bullets],
            children: contractorWeatherSection.children.map((child) => ({ ...child })),
          }
        : null,
      {
        extraBullets: weatherContractorItems,
      }
    );
    sectionNumber++;
  }

  if (includedContent.required_ppe) {
    const section = getResolvedCsepSection(builderTextConfig, "required_ppe");
    children.push(
      heading1(
        `${sectionNumber}. ${section?.title ?? "Required Personal Protective Equipment"}`
      )
    );
    if (requiredPPE.length) {
      appendNumberedItems(children, String(sectionNumber), requiredPPE);
    } else {
      children.push(body(section?.paragraphs[0] ?? "No additional PPE selections were entered."));
    }
    sectionNumber++;
  }

  if (includedContent.additional_permits) {
    const section = getResolvedCsepSection(builderTextConfig, "permit_requirements");
    children.push(heading1(`${sectionNumber}. ${section?.title ?? "Permit Requirements"}`));
    if (permitList.length) {
      appendNumberedItems(children, String(sectionNumber), permitList);
    } else {
      children.push(body(section?.paragraphs[0] ?? "No permit triggers were selected or derived."));
    }
    sectionNumber++;
  }

  if (includedContent.common_overlapping_trades) {
    const section = getResolvedCsepSection(builderTextConfig, "common_overlapping_trades");
    children.push(
      heading1(
        `${sectionNumber}. ${section?.title ?? "Common Overlapping Trades in Same Areas"}`
      )
    );
    if (commonOverlappingTrades.length) {
      appendNumberedItems(children, String(sectionNumber), commonOverlappingTrades);
      if (overlapPermitHints.length) {
        children.push(
          body(
            `High-risk overlap permit/program hints: ${overlapPermitHints.join(", ")}.`
          )
        );
      }
    } else {
      children.push(
        body(
          section?.paragraphs[0] ??
            "No overlapping-trade indicators were inferred for the current scope selection."
        )
      );
    }
    sectionNumber++;
  }

  if (includedContent.osha_references) {
    const section = getResolvedCsepSection(builderTextConfig, "applicable_osha_references");
    children.push(
      heading1(`${sectionNumber}. ${section?.title ?? "Applicable OSHA References"}`)
    );
    if (oshaRefs.length) {
      appendNumberedItems(children, String(sectionNumber), oshaRefs);
    } else {
      children.push(
        body(
          section?.paragraphs[0] ??
            "Applicable OSHA references shall be identified based on the selected trade, tools, equipment, and site conditions."
        )
      );
    }
    sectionNumber++;
  }

  if (includedContent.trade_summary) {
    const section = getResolvedCsepSection(builderTextConfig, "trade_summary");
    if (valueOrNA(form.tradeSummary) === "N/A" && section?.paragraphs[0]) {
      form.tradeSummary = section.paragraphs[0];
    }
    children.push(heading1(`${sectionNumber}. ${section?.title ?? "Trade Summary"}`));
    if (valueOrNA(form.subTrade) !== "N/A") {
      children.push(body(`Active sub-trade: ${valueOrNA(form.subTrade)}`));
    }
    if (selectedTasks.length) {
      children.push(body(`Selected tasks: ${selectedTasks.join(", ")}`));
    }
    children.push(
      body(
        valueOrNA(form.tradeSummary) === "N/A"
          ? "This contractor’s work includes trade-specific exposures that require planning, supervision, appropriate PPE, safe access, and hazard controls throughout execution of the work."
          : valueOrNA(form.tradeSummary)
      )
    );
    sectionNumber++;
  }

  if (includedContent.selected_hazards) {
    const section = getResolvedCsepSection(builderTextConfig, "selected_hazard_summary");
    children.push(
      heading1(`${sectionNumber}. ${section?.title ?? "Selected Hazard Summary"}`)
    );
    if (activeHazards.length) {
      appendNumberedItems(children, String(sectionNumber), activeHazards);
    } else {
      children.push(
        body(
          section?.paragraphs[0] ??
            "Key hazards will be determined from the selected trade, work methods, adjacent operations, and changing field conditions."
        )
      );
    }
    sectionNumber++;
  }

  if (includedContent.roles_and_responsibilities) {
    children.push(
      heading1(
        `${sectionNumber}. ${
          getResolvedCsepSection(builderTextConfig, "roles_and_responsibilities")?.title ??
          "Roles and Responsibilities"
        }`
      )
    );
    children.push(...buildResponsibilitiesTable(String(sectionNumber), builderTextConfig));
    if (normalizeOptionalText(form.roles_and_responsibilities_text)) {
      children.push(body(normalizeOptionalText(form.roles_and_responsibilities_text)));
    }
    sectionNumber++;
  }

  if (includedContent.security_and_access) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "security_and_access"),
      fallbackTitle: "Security and Access",
      extraText: form.security_and_access_text,
    });
    sectionNumber++;
  }

  if (includedContent.health_and_wellness) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "health_and_wellness"),
      fallbackTitle: "Health and Wellness",
      extraText: form.health_and_wellness_text,
    });
    sectionNumber++;
  }

  if (includedContent.incident_reporting_and_investigation) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "incident_reporting_and_investigation"),
      fallbackTitle: "Incident Reporting and Investigation",
      extraText: form.incident_reporting_and_investigation_text,
    });
    sectionNumber++;
  }

  if (includedContent.training_and_instruction) {
    const trainingSection = getResolvedCsepSection(builderTextConfig, "training_and_instruction");
    children.push(
      heading1(
        `${sectionNumber}. ${trainingSection?.title ?? "Training and Instruction"}`
      )
    );
    appendResolvedSectionContent(children, String(sectionNumber), trainingSection, {
      extraBullets: buildTrainingBullets(form),
      extraParagraphs: normalizeOptionalText(form.training_and_instruction_text)
        ? [normalizeOptionalText(form.training_and_instruction_text)]
        : [],
    });
    sectionNumber++;
  }

  const generalSafetySection = getCsepSection(builderTextConfig, "general_safety_expectations");
  children.push(
    heading1(
      `${sectionNumber}. ${
        generalSafetySection?.title ?? "General Safety Expectations"
      }`
    )
  );
  appendNumberedItems(
    children,
    String(sectionNumber),
    generalSafetySection?.bullets ?? [
      "Housekeeping shall be maintained in all work areas, access routes, and staging areas.",
      "All tools and equipment shall be inspected before use and removed from service when damaged.",
      "Workers shall maintain situational awareness for adjacent crews, moving equipment, suspended loads, and changing site conditions.",
      "Barricades, signage, and exclusion zones shall be maintained whenever work creates exposure to others.",
      "Work shall stop when hazards are uncontrolled, conditions change, or permit requirements are not met.",
    ]
  );
  sectionNumber++;

  if (includedContent.activity_hazard_matrix) {
    const section = getResolvedCsepSection(builderTextConfig, "activity_hazard_analysis_matrix");
    children.push(
      heading1(`${sectionNumber}. ${section?.title ?? "Activity Hazard Analysis Matrix"}`)
    );
    if (tradeItems.length) {
      children.push(...buildRiskTable(String(sectionNumber), tradeItems));
    } else {
      children.push(
        body(
          section?.paragraphs[0] ??
            `No trade activity matrix was provided. Select a trade, sub-trade, tasks, and hazards on the ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} page to load activities, hazards, controls, and permit triggers.`
        )
      );
    }
    sectionNumber++;
  }

  if (programSections.length) {
    children.push(createCsepPageBreak());

    programSections.forEach((program) => {
      addCatalogProgramSection(children, sectionNumber, program);
      sectionNumber++;
    });
  }

  if (includedContent.drug_and_alcohol_testing) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "drug_and_alcohol_testing"),
      fallbackTitle: "Drug and Alcohol Testing",
      extraText: form.drug_and_alcohol_testing_text,
    });
    sectionNumber++;
  }

  if (includedContent.enforcement_and_corrective_action) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "enforcement_and_corrective_action"),
      fallbackTitle: "Enforcement and Corrective Action",
      extraText: form.enforcement_and_corrective_action_text,
    });
    sectionNumber++;
  }

  if (includedContent.recordkeeping) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "recordkeeping"),
      fallbackTitle: "Recordkeeping and Documentation",
      extraText: form.recordkeeping_text,
    });
    sectionNumber++;
  }

  if (includedContent.continuous_improvement) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "continuous_improvement"),
      fallbackTitle: "Program Evaluations and Continuous Improvement",
      extraText: form.continuous_improvement_text,
    });
    sectionNumber++;
  }

  children.push(createCsepPageBreak());

  const stopWorkSection = getResolvedCsepSection(
    builderTextConfig,
    "stop_work_change_management"
  );
  children.push(
    heading1(
      `${sectionNumber}. ${stopWorkSection?.title ?? "Stop Work and Change Management"}`
    )
  );
  appendNumberedItems(
    children,
    String(sectionNumber),
    stopWorkSection?.bullets ?? [
      "Any worker has the authority and obligation to stop work when an unsafe condition exists.",
      "Work shall be reevaluated when scope changes, crews change, weather changes, or new equipment is introduced.",
      "Changed conditions shall be reviewed with supervision and the crew before work resumes.",
      "New hazards shall be documented and controlled before proceeding.",
    ]
  );
  sectionNumber++;

  const acknowledgmentSection = getCsepSection(builderTextConfig, "acknowledgment");
  children.push(heading1(`${sectionNumber}. ${acknowledgmentSection?.title ?? "Acknowledgment"}`));
  (
    acknowledgmentSection?.paragraphs ?? [
      `The contractor acknowledges responsibility for complying with this ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}, applicable site rules, required permits, and all regulatory requirements associated with the work.`,
      "Contractor Representative: ________________________________",
      "Signature: ______________________________________________",
      "Date: ___________________________________________________",
    ]
  ).forEach((paragraph) => {
    children.push(body(paragraph));
  });
  children.push(createCsepPageBreak());
  children.push(heading1("Disclaimer"));
  DOCUMENT_DISCLAIMER_LINES.forEach((line) => {
    children.push(body(line));
  });

  return createCsepDocument(children);
}

function buildSurveyTestDoc(form: CSEPInput) {
  const enrichment = buildSurveyTestEnrichment({
    project_name: form.project_name ?? "",
    project_number: form.project_number ?? "",
    project_address: form.project_address ?? "",
    owner_client: form.owner_client ?? "",
    gc_cm: form.gc_cm ?? "",
    contractor_company: form.contractor_company ?? "",
    contractor_contact: form.contractor_contact ?? "",
    contractor_phone: form.contractor_phone ?? "",
    contractor_email: form.contractor_email ?? "",
    trade: form.trade ?? "Survey / Layout",
    subTrade: form.subTrade ?? "",
    tasks: Array.isArray(form.tasks) ? form.tasks : [],
    selectedLayoutSections: Array.isArray(form.surveyLayoutSections)
      ? form.surveyLayoutSections
      : SURVEY_TEST_LAYOUT_SECTIONS.map((section) => section.key),
    scope_of_work: form.scope_of_work ?? "",
    site_specific_notes: form.site_specific_notes ?? "",
    emergency_procedures: form.emergency_procedures ?? "",
    required_ppe: Array.isArray(form.required_ppe) ? form.required_ppe : [],
    additional_permits: Array.isArray(form.additional_permits) ? form.additional_permits : [],
    selected_hazards: Array.isArray(form.selected_hazards) ? form.selected_hazards : [],
  });

  const surveyElementsRequired = Array.isArray(form.surveyElementsRequired)
    ? form.surveyElementsRequired
    : enrichment.elementsRequired;
  const surveyTrainingRequired = Array.isArray(form.surveyTrainingRequired)
    ? form.surveyTrainingRequired
    : enrichment.requiredTraining;
  const surveySorData = Array.isArray(form.surveySorData) ? form.surveySorData : enrichment.sorData;
  const surveyInjuryData = Array.isArray(form.surveyInjuryData)
    ? form.surveyInjuryData
    : enrichment.injuryData;
  const children: Paragraph[] = [];
  const subtitleParts = [
    "Superadmin survey test workflow",
    `Sub-trade: ${valueOrNA(form.subTrade)}`,
  ];

  if (enrichment.selectedTasks.length) {
    subtitleParts.push(`Tasks: ${enrichment.selectedTasks.join(", ")}`);
  }

  children.push(
    ...createCsepCover({
      projectName: valueOrNA(form.project_name),
      subtitle: subtitleParts.join(" | "),
      contractorName: valueOrNA(form.contractor_company),
    })
  );
  children.push(createCsepSubheading("Survey / Layout requirements overview"));
  children.push(body(enrichment.selectedSections[0]?.summary ?? enrichment.tradeSummary));
  children.push(...buildProjectInfoTable(form));
  children.push(...buildContractorInfoTable(form));

  for (const section of enrichment.selectedSections) {
    children.push(heading1(`${section.number}. ${section.title}`));
    children.push(body(section.summary));

    for (const subsection of section.subsections) {
      children.push(heading2(`${subsection.number} ${subsection.title}`));
      children.push(body(subsection.body));
    }

    if (section.key === "risks_hazards") {
      children.push(heading2("1.A Builder-derived hazard summary"));
      if (enrichment.hazards.length) {
        appendNumberedItems(children, "1.A", enrichment.hazards);
      } else {
        children.push(body("Select a sub-trade and tasks to derive survey-specific hazards."));
      }
      if (enrichment.tradeItems.length) {
        children.push(...buildRiskTable("1.B", enrichment.tradeItems));
      }
    }

    if (section.key === "work_planning") {
      children.push(heading2("2.A Selected task sequence"));
      if (enrichment.selectedTasks.length) {
        appendNumberedItems(children, "2.A", enrichment.selectedTasks);
      } else {
        children.push(body("No survey tasks were selected for this test build."));
      }
      children.push(heading2("2.B Active scope of work"));
      children.push(body(valueOrNA(form.scope_of_work)));
      if (valueOrNA(form.site_specific_notes) !== "N/A") {
        children.push(heading2("2.C Site-specific notes"));
        children.push(body(valueOrNA(form.site_specific_notes)));
      }
    }

    if (section.key === "training_requirements") {
      children.push(heading2("5.A Required training from AI enrichment"));
      appendNumberedItems(children, "5.A", surveyTrainingRequired);
    }

    if (section.key === "certification_requirements") {
      children.push(heading2("6.A Review note"));
      children.push(
        body(
          "Certification requirements should be confirmed against contract documents, state-law obligations, utility-locate services, traffic control duties, and any required licensed surveyor scope."
        )
      );
    }

    if (section.key === "required_equipment") {
      children.push(heading2("7.A Required PPE"));
      appendNumberedItems(children, "7.A", enrichment.ppe);
      children.push(heading2("7.B Required job elements"));
      appendNumberedItems(children, "7.B", surveyElementsRequired);
    }

    if (section.key === "required_permits") {
      children.push(heading2("8.A Permit triggers from AI enrichment"));
      if (enrichment.permitsRequired.length) {
        appendNumberedItems(children, "8.A", enrichment.permitsRequired);
      } else {
        children.push(body("No standalone permits are currently triggered by the selected survey tasks."));
      }
    }

    if (section.key === "affected_trades") {
      children.push(heading2("9.A Overlapping or affected trades"));
      if (enrichment.commonOverlappingTrades.length) {
        appendNumberedItems(children, "9.A", enrichment.commonOverlappingTrades);
      } else {
        children.push(
          body(
            "Excavation, utilities, concrete, steel, grading, and downstream installation teams should still verify control integrity before building from layout references."
          )
        );
      }
    }

    if (section.key === "additional_related_information") {
      children.push(heading2("10.A OSHA data"));
      appendNumberedItems(children, "10.A", enrichment.oshaData);
      children.push(heading2("10.B SOR data"));
      appendNumberedItems(children, "10.B", surveySorData);
      children.push(heading2("10.C Injury data"));
      appendNumberedItems(children, "10.C", surveyInjuryData);
      children.push(heading2("10.D Emergency coordination"));
      children.push(body(valueOrNA(form.emergency_procedures)));
    }
  }

  children.push(createCsepPageBreak());
  children.push(heading1("Reference Language and Source Points"));
  SURVEY_TEST_REFERENCE_SOURCE_POINTS.forEach((line) => {
    children.push(body(line));
  });
  children.push(createCsepPageBreak());
  children.push(heading1("Disclaimer"));
  DOCUMENT_DISCLAIMER_LINES.forEach((line) => {
    children.push(body(line));
  });

  return createCsepDocument(children);
}

function isGeneratedDraft(value: unknown): value is GeneratedSafetyPlanDraft {
  return Boolean(value) && typeof value === "object" && "sectionMap" in (value as Record<string, unknown>);
}

function hasGeneratedDraftPayload(value: unknown): value is { draft: GeneratedSafetyPlanDraft } {
  return Boolean(value) && typeof value === "object" && isGeneratedDraft((value as GeneratedCsepDocxRequest).draft);
}

function hasGeneratedDocumentReference(value: unknown): value is { generatedDocumentId: string } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as GeneratedCsepDocxRequest).generatedDocumentId === "string"
  );
}

export async function generateCsepDocx(
  form: CSEPInput | GeneratedCsepDocxRequest,
  options?: { supabase?: GeneratedDocumentDraftLoaderClient }
) {
  let rendered: { body: Uint8Array; filename: string } | null = null;

  if (hasGeneratedDraftPayload(form)) {
    rendered = await renderGeneratedCsepDocx(form.draft);
  } else if (hasGeneratedDocumentReference(form) && options?.supabase) {
    const draft = await loadGeneratedDocumentDraft(
      options.supabase,
      form.generatedDocumentId
    );
    rendered = await renderGeneratedCsepDocx(draft);
  }

  if (!rendered) {
    const legacyForm = form as CSEPInput;

    if (legacyForm.layoutVariant === SURVEY_TEST_LAYOUT_VARIANT) {
      const doc = await buildDoc(legacyForm);
      const buffer = await Packer.toBuffer(doc);
      const fileData = new Uint8Array(buffer);
      const safeProject = valueOrNA(legacyForm.project_name).replace(/[^\w\-]+/g, "_");
      const safeTrade = valueOrNA(legacyForm.trade).replace(/[^\w\-]+/g, "_");
      rendered = {
        body: fileData,
        filename: getSafetyBlueprintDraftFilename(`${safeProject}_${safeTrade}`, "csep").replace(
          "_Draft",
          ""
        ),
      };
    } else {
      const tradeItems = Array.isArray(legacyForm.tradeItems) ? legacyForm.tradeItems : [];
      const selectedTasks = Array.isArray(legacyForm.tasks) ? legacyForm.tasks : [];
      const derivedHazards = Array.isArray(legacyForm.derivedHazards)
        ? legacyForm.derivedHazards
        : [];
      const overlapPermitHints = Array.isArray(legacyForm.overlapPermitHints)
        ? legacyForm.overlapPermitHints
        : [];
      const requiredPPE = Array.isArray(legacyForm.required_ppe) ? legacyForm.required_ppe : [];
      const additionalPermits = Array.isArray(legacyForm.additional_permits)
        ? legacyForm.additional_permits
        : [];
      const selectedHazards = Array.isArray(legacyForm.selected_hazards)
        ? legacyForm.selected_hazards
        : [];
      const selectedPermits = Array.from(
        new Set(
          [...additionalPermits, ...(legacyForm.derivedPermits ?? []), ...overlapPermitHints].filter(
            Boolean
          )
        )
      );
      const activeHazards = selectedHazards.length ? selectedHazards : derivedHazards;
      const programSelections = resolveProgramSelections(
        legacyForm,
        activeHazards,
        selectedPermits,
        requiredPPE,
        tradeItems,
        selectedTasks
      );
      const [programConfig, builderTextConfig] = await Promise.all([
        getCsepProgramConfig().catch(() => null),
        getDocumentBuilderTextConfig().catch(() => null),
      ]);
      const programSections = buildCsepProgramSections(programSelections, {
        definitions: programConfig?.definitions,
      });
      const model = buildLegacyCsepRenderModel({
        form: legacyForm,
        builderTextConfig,
        programSections,
      });
      rendered = await renderCsepRenderModel(model);
    }
  }

  const responseBody = Buffer.from(rendered.body);

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${rendered.filename}"`,
    },
  });
}

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req);

    if ("error" in auth) {
      return auth.error;
    }

    const form = (await req.json()) as CSEPInput | {
      generatedDocumentId?: string | null;
      draft?: GeneratedSafetyPlanDraft | null;
    };
    return await generateCsepDocx(form, { supabase: auth.supabase });
  } catch (error) {
    console.error(`${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} export error:`, error);

    const message =
      error instanceof Error ? error.message : `Failed to generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} document.`;

    return new NextResponse(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
