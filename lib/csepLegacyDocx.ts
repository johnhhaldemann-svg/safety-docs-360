import type { CSEPRiskItem } from "@/lib/csepTradeSelection";
import { formatGcCmPartnersForExport, normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import { PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK } from "@/lib/csepSiteSpecificNotes";
import {
  getDocumentBuilderSection,
  resolveDocumentBuilderSection,
} from "@/lib/documentBuilderText";
import {
  buildCsepTemplateSections,
  type CsepRenderModel,
  type CsepTemplateSection,
} from "@/lib/csepDocxRenderer";
import { CONTRACTOR_SAFETY_BLUEPRINT_TITLE } from "@/lib/safetyBlueprintLabels";
import type { CsepWeatherSectionInput } from "@/types/csep-builder";
import type { DocumentBuilderTextConfig, DocumentBuilderSectionTemplate } from "@/types/document-builder-text";
import type {
  CSEPProgramSection,
  CSEPProgramSelection,
  CSEPProgramSubtypeGroup,
  CSEPProgramSubtypeValue,
} from "@/types/csep-programs";
import type { GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

function toLegacyTemplateSection(source: GeneratedSafetyPlanSection): CsepTemplateSection {
  return {
    key: source.key,
    title: source.title,
    kind: source.kind ?? undefined,
    numberLabel: source.numberLabel ?? undefined,
    subsections: [],
    closingTagline: null,
  };
}

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

export type LegacyCsepDocxInput = {
  project_name: string;
  project_number: string;
  project_address: string;
  owner_client: string;
  owner_message_text?: string;
  gc_cm: string | string[];
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
  /** Optional; shown on cover metadata when set (not repeated in legacy body project table). */
  governing_state?: string;
  oshaRefs?: string[];
  tradeItems?: CSEPRiskItem[];
  derivedHazards?: string[];
  derivedPermits?: string[];
  overlapPermitHints?: string[];
  common_overlapping_trades?: string[];
  includedContent?: IncludedContent;
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

type BuildLegacyCsepRenderModelParams = {
  form: LegacyCsepDocxInput;
  builderTextConfig: DocumentBuilderTextConfig | null | undefined;
  programSections: CSEPProgramSection[];
  /** Workspace company for DOCX footer; falls back in `normalizeRenderModel` when empty. */
  footerCompanyName?: string | null;
};

function valueOrNA(value?: string | null) {
  return value?.trim() ? value.trim() : "N/A";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function joinLines(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)).join("\n\n");
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

function normalizeIncludedContent(form: LegacyCsepDocxInput): Required<IncludedContent> {
  return {
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
    ...(form.includedContent ?? {}),
  };
}

function composeResolvedSectionBody(
  section: DocumentBuilderSectionTemplate | null | undefined,
  options?: {
    extraParagraphs?: string[];
  }
) {
  return joinLines([...(section?.paragraphs ?? []), ...(options?.extraParagraphs ?? [])]);
}

function mergeBullets(
  section: DocumentBuilderSectionTemplate | null | undefined,
  extraBullets?: string[]
) {
  return unique([...(section?.bullets ?? []), ...(extraBullets ?? [])]);
}

function buildResponsibilitiesRows(config: DocumentBuilderTextConfig | null | undefined) {
  const rolesSection = getCsepSection(config, "roles_and_responsibilities");
  const childMap = new Map((rolesSection?.children ?? []).map((child) => [child.key, child]));

  // Spell out implementation, inspections, permits, coordination, stop-work,
  // restart, and field-compliance ownership so each row reads as a final
  // contractor accountability statement, not a generic responsibility blurb.
  return [
    [
      "Contractor Superintendent",
      childMap.get("contractor_superintendent")?.paragraphs[0] ??
        "Owns implementation of this CSEP on site. Coordinates work sequencing with the GC/CM, secures and posts required permits, authorizes stop-work and approves restart of the affected scope, and is accountable for field compliance, daily inspections, and corrective action follow-through.",
    ],
    [
      "Foreman / Lead",
      childMap.get("foreman_lead")?.paragraphs[0] ??
        "Reviews daily activities, JHA/PTP, and weather restrictions with the crew before work begins. Verifies required PPE, controls, and permits are in place at the work face, performs pre-task inspections, and immediately stops work when conditions change, hazards are uncontrolled, or scope shifts.",
    ],
    [
      "Workers",
      childMap.get("workers")?.paragraphs[0] ??
        `Follow this ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}, wear required PPE, attend pre-task and weather briefings, complete required training and competency checks, report hazards and incidents immediately, and exercise stop-work authority when conditions are unsafe.`,
    ],
    [
      "Safety Representative",
      childMap.get("safety_representative")?.paragraphs[0] ??
        "Performs documented inspections and hazard assessments, supports permit and training verification, coordinates with the GC/CM safety team, drives corrective actions to closure, and is the named point of contact for stop-work, incident response, and regulatory inquiries.",
    ],
  ];
}

function buildTrainingBullets(form: LegacyCsepDocxInput) {
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

  const utilityScope =
    /\butility\b|locator wire|manhole|vault|duct bank|catch basin|storm structure|site drainage|pipe laying|install pipe/.test(
      textSeed
    );
  const excavationScope =
    /\bexcavat|\btrench|shoring|bench\/shore|backfill|trench support|\bdig|groundbreaking|ground[\s-]?breaking|ground disturb/.test(
      textSeed
    );
  const steelScope =
    /\bsteel\b|erection|decking|connector|bolting|ironworker|metal building/.test(textSeed);

  // Baseline expectations applied to every CSEP training section so the
  // training requirements always read as final, field-ready, and tied to
  // OSHA 10/30 and competent-person documentation.
  bullets.push(
    "All field workers shall hold current OSHA 10-hour Construction training; site supervisors and competent persons shall hold current OSHA 30-hour Construction training."
  );
  bullets.push(
    "Training records, qualifications, and competent-person designations shall be documented and available on site before high-risk or permit-required work begins."
  );
  bullets.push(
    "Task-specific training and competency verification shall be completed before workers perform exposed work covered by this CSEP."
  );

  if ((form.trade || "").toLowerCase().includes("electrical")) {
    bullets.push(
      "Electrical workers shall be trained and qualified on LOTO, temporary power, energized work restrictions, and arc-flash boundaries before energized or de-energized work begins."
    );
  }

  if (excavationScope) {
    bullets.push(
      utilityScope
        ? "Excavation workers shall be trained on trench hazards, soil classification, utility awareness, locate verification, and protective systems; a competent person shall be on site during excavation."
        : "Excavation workers shall be trained on trench hazards, soil classification, protective systems, and safe access/egress; a competent person shall be on site during excavation."
    );
  }

  if ((form.trade || "").toLowerCase().includes("roof")) {
    bullets.push(
      "Roofing workers shall be trained on fall protection systems, leading-edge controls, anchor/connector inspection, and weather restrictions before exposed work begins."
    );
  }

  if (steelScope) {
    bullets.push(
      "Steel erection workers shall be trained per OSHA 1926 Subpart R on fall protection, connector and decking exposure, multiple-lift rigging, and controlled decking zone (CDZ) requirements before erection work begins."
    );
  }

  return bullets;
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

function buildProgramRenderSection(program: CSEPProgramSection): GeneratedSafetyPlanSection {
  return {
    key: program.key,
    title: program.title,
    summary: program.summary,
    subsections: program.subsections.map((subsection) => ({
      title: subsection.title,
      body: subsection.body,
      bullets: subsection.bullets,
    })),
  };
}

function buildNarrativeSection(params: {
  key: string;
  title: string;
  section: DocumentBuilderSectionTemplate | null | undefined;
  extraText?: string;
}) {
  const body = composeResolvedSectionBody(params.section, {
    extraParagraphs: params.extraText?.trim() ? [params.extraText.trim()] : [],
  });
  const bullets = mergeBullets(params.section);

  return {
    key: params.key,
    title: params.section?.title ?? params.title,
    ...(body ? { body } : {}),
    ...(bullets.length ? { bullets } : {}),
  } satisfies GeneratedSafetyPlanSection;
}

export function buildLegacyCsepRenderModel(
  params: BuildLegacyCsepRenderModelParams
): CsepRenderModel {
  const { form, builderTextConfig, programSections, footerCompanyName } = params;
  const includedContent = normalizeIncludedContent(form);
  const selectedTasks = Array.isArray(form.tasks) ? form.tasks : [];
  const oshaRefs = Array.isArray(form.oshaRefs) ? form.oshaRefs : [];
  const derivedHazards = Array.isArray(form.derivedHazards) ? form.derivedHazards : [];
  const derivedPermits = Array.isArray(form.derivedPermits) ? form.derivedPermits : [];
  const overlapPermitHints = Array.isArray(form.overlapPermitHints) ? form.overlapPermitHints : [];
  const commonOverlappingTrades = Array.isArray(form.common_overlapping_trades)
    ? form.common_overlapping_trades
    : [];
  const requiredPPE = Array.isArray(form.required_ppe) ? form.required_ppe : [];
  const additionalPermits = Array.isArray(form.additional_permits) ? form.additional_permits : [];
  const selectedHazards = Array.isArray(form.selected_hazards) ? form.selected_hazards : [];
  const selectedPermits = unique(
    [...additionalPermits, ...derivedPermits, ...overlapPermitHints].filter(Boolean)
  );
  const activeHazards = selectedHazards.length ? selectedHazards : derivedHazards;
  const tradeItems = Array.isArray(form.tradeItems) ? form.tradeItems : [];
  const hasRequiredPpeSectionContent = requiredPPE.length > 0;
  const hasPermitSectionContent = selectedPermits.length > 0;
  const hasOverlapSectionContent = commonOverlappingTrades.length > 0;
  const hasOshaSectionContent = oshaRefs.length > 0;
  const hasSelectedHazardsSectionContent = activeHazards.length > 0;
  const hasActivityHazardMatrixSectionContent = tradeItems.length > 0;
  const sections: GeneratedSafetyPlanSection[] = [];

  if (includedContent.contractor_information) {
    sections.push({
      key: "contractor_information",
      title: "Contractor Information",
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Contractor Company", valueOrNA(form.contractor_company)],
          ["Contractor Contact", valueOrNA(form.contractor_contact)],
          ["Contractor Phone", valueOrNA(form.contractor_phone)],
          ["Contractor Email", valueOrNA(form.contractor_email)],
        ],
      },
    });
  }

  const ownerMessageText = normalizeOptionalText(form.owner_message_text);
  if (ownerMessageText) {
    sections.push({
      key: "owner_message",
      title: "Leadership Commitment",
      body: ownerMessageText,
    });
  }

  if (includedContent.trade_summary) {
    const section = getResolvedCsepSection(builderTextConfig, "trade_summary");
    sections.push({
      key: "trade_summary",
      title: section?.title ?? "Trade Summary",
      body:
        valueOrNA(form.tradeSummary) === "N/A"
          ? section?.paragraphs[0] ??
            "This contractor's work includes trade-specific exposures that require planning, supervision, appropriate PPE, safe access, and hazard controls throughout execution of the work."
          : valueOrNA(form.tradeSummary),
      table: {
        columns: ["Trade", "Sub-trade", "Tasks", "Hazards", "Permits"],
        rows: [[
          valueOrNA(form.trade),
          valueOrNA(form.subTrade),
          selectedTasks.length ? selectedTasks.join(", ") : "N/A",
          activeHazards.length ? activeHazards.join(", ") : "N/A",
          selectedPermits.length ? selectedPermits.join(", ") : "None",
        ]],
      },
    });
  }

  if (includedContent.scope_of_work) {
    const section = getResolvedCsepSection(builderTextConfig, "scope_of_work");
    sections.push({
      key: "scope_of_work",
      title: section?.title ?? "Scope Summary",
      body:
        valueOrNA(form.scope_of_work) === "N/A"
          ? section?.paragraphs[0] ??
            "The contractor shall perform work in accordance with the approved project scope, applicable plans, and all site-specific requirements."
          : valueOrNA(form.scope_of_work),
    });
  }

  if (includedContent.site_specific_notes) {
    const section = getResolvedCsepSection(builderTextConfig, "site_specific_notes");
    sections.push({
      key: "site_specific_notes",
      title: section?.title ?? "Project-Specific Safety Notes",
      body:
        valueOrNA(form.site_specific_notes) === "N/A"
          ? section?.paragraphs[0] ?? PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK
          : valueOrNA(form.site_specific_notes),
    });
  }

  if (includedContent.emergency_procedures) {
    const section = getResolvedCsepSection(builderTextConfig, "emergency_procedures");
    sections.push({
      key: "emergency_procedures",
      title: section?.title ?? "Emergency Procedures",
      body:
        valueOrNA(form.emergency_procedures) === "N/A"
          ? section?.paragraphs[0] ??
            "In the event of an emergency, workers shall stop work, notify supervision immediately, follow site alarm and evacuation procedures, and report to the designated assembly area."
          : valueOrNA(form.emergency_procedures),
    });
  }

  if (includedContent.weather_requirements_and_severe_weather_response) {
    const sharedWeatherSection = getResolvedSiteBuilderSection(builderTextConfig, "severe_weather");
    const contractorWeatherSection = getResolvedCsepSection(
      builderTextConfig,
      "weather_requirements_and_severe_weather_response"
    );
    const projectOverlay = buildWeatherProjectOverlayItems(form.weather_requirements);
    const contractorItems = buildWeatherContractorItems(form.weather_requirements);

    sections.push({
      key: "weather_requirements_and_severe_weather_response",
      title: contractorWeatherSection?.title ?? "Weather Requirements and Severe Weather Response",
      subsections: [
        ...(sharedWeatherSection
          ? [
              {
                title: "Shared Project Baseline",
                body: composeResolvedSectionBody(sharedWeatherSection),
                bullets: mergeBullets(sharedWeatherSection),
              },
            ]
          : []),
        ...(projectOverlay.length
          ? [
              {
                title: "Project-Specific Weather Overlay",
                bullets: projectOverlay,
              },
            ]
          : []),
        {
          title: "Contractor Responsibilities and Response",
          body: composeResolvedSectionBody(contractorWeatherSection),
          bullets: mergeBullets(contractorWeatherSection, contractorItems),
        },
      ],
    });
  }

  if (includedContent.required_ppe && hasRequiredPpeSectionContent) {
    const section = getResolvedCsepSection(builderTextConfig, "required_ppe");
    sections.push({
      key: "required_ppe",
      title: section?.title ?? "Required Personal Protective Equipment",
      body: section?.paragraphs[0] ?? "Required PPE for the selected scope is listed below.",
      bullets: requiredPPE,
    });
  }

  if (includedContent.additional_permits && hasPermitSectionContent) {
    const section = getResolvedCsepSection(builderTextConfig, "permit_requirements");
    sections.push({
      key: "additional_permits",
      title: section?.title ?? "Permit Requirements",
      table: {
        columns: ["Permit Requirement", "Source"],
        rows: selectedPermits.map((permit) => [
          permit,
          additionalPermits.includes(permit)
            ? "Selected"
            : overlapPermitHints.includes(permit)
              ? "Overlap indicator"
              : "Derived",
        ]),
      },
    });
  }

  if (includedContent.common_overlapping_trades && hasOverlapSectionContent) {
    const section = getResolvedCsepSection(builderTextConfig, "common_overlapping_trades");
    sections.push({
      key: "common_overlapping_trades",
      title: section?.title ?? "Common Overlapping Trades in Same Areas",
      bullets: commonOverlappingTrades,
    });
  }

  if (includedContent.osha_references && hasOshaSectionContent) {
    const section = getResolvedCsepSection(builderTextConfig, "applicable_osha_references");
    sections.push({
      key: "osha_references",
      title: section?.title ?? "Applicable OSHA References",
      bullets: oshaRefs,
    });
  }

  if (includedContent.selected_hazards && hasSelectedHazardsSectionContent) {
    const section = getResolvedCsepSection(builderTextConfig, "selected_hazard_summary");
    sections.push({
      key: "selected_hazards",
      title: section?.title ?? "Selected Hazard Summary",
      bullets: activeHazards,
    });
  }

  if (includedContent.roles_and_responsibilities) {
    sections.push({
      key: "roles_and_responsibilities",
      title:
        getResolvedCsepSection(builderTextConfig, "roles_and_responsibilities")?.title ??
        "Roles and Responsibilities",
      body: normalizeOptionalText(form.roles_and_responsibilities_text),
      table: {
        columns: ["Role", "Responsibility"],
        rows: buildResponsibilitiesRows(builderTextConfig).map(([role, responsibility]) => [
          role,
          responsibility,
        ]),
      },
    });
  }

  if (includedContent.security_and_access) {
    sections.push(
      buildNarrativeSection({
        key: "security_and_access",
        title: "Security and Access",
        section: getResolvedCsepSection(builderTextConfig, "security_and_access"),
        extraText: form.security_and_access_text,
      })
    );
  }

  if (includedContent.health_and_wellness) {
    sections.push(
      buildNarrativeSection({
        key: "health_and_wellness",
        title: "Health and Wellness",
        section: getResolvedCsepSection(builderTextConfig, "health_and_wellness"),
        extraText: form.health_and_wellness_text,
      })
    );
  }

  if (includedContent.incident_reporting_and_investigation) {
    sections.push(
      buildNarrativeSection({
        key: "incident_reporting_and_investigation",
        title: "Incident Reporting and Investigation",
        section: getResolvedCsepSection(builderTextConfig, "incident_reporting_and_investigation"),
        extraText: form.incident_reporting_and_investigation_text,
      })
    );
  }

  if (includedContent.training_and_instruction) {
    const trainingSection = getResolvedCsepSection(builderTextConfig, "training_and_instruction");
    sections.push({
      key: "training_and_instruction",
      title: trainingSection?.title ?? "Training and Instruction",
      body: composeResolvedSectionBody(trainingSection, {
        extraParagraphs: normalizeOptionalText(form.training_and_instruction_text)
          ? [normalizeOptionalText(form.training_and_instruction_text)]
          : [],
      }),
      bullets: mergeBullets(trainingSection, buildTrainingBullets(form)),
    });
  }

  sections.push({
    key: "general_safety_expectations",
    title:
      getCsepSection(builderTextConfig, "general_safety_expectations")?.title ??
      "General Safety Expectations",
    bullets:
      getCsepSection(builderTextConfig, "general_safety_expectations")?.bullets ?? [
        "Housekeeping shall be maintained in all work areas, access routes, and staging areas.",
        "All tools and equipment shall be inspected before use and removed from service when damaged.",
        "Workers shall maintain situational awareness for adjacent crews, moving equipment, suspended loads, and changing site conditions.",
        "Barricades, signage, and exclusion zones shall be maintained whenever work creates exposure to others.",
        "Work shall stop when hazards are uncontrolled, conditions change, or permit requirements are not met.",
      ],
  });

  if (includedContent.activity_hazard_matrix) {
    const activityMatrixTemplate = getResolvedCsepSection(builderTextConfig, "activity_hazard_analysis_matrix");
    sections.push({
      key: "appendix_e_task_hazard_matrix_reference",
      title: activityMatrixTemplate?.title ?? "Activity Hazard Analysis Matrix",
      body: composeResolvedSectionBody(activityMatrixTemplate),
    });
  }

  // Activity / Task-Hazard-Control matrix is built but kept aside to render as
  // Appendix E — keeping the main body readable instead of embedding the wide
  // matrix awkwardly between numbered narrative sections.
  const activityHazardAppendixSection: GeneratedSafetyPlanSection | null =
    includedContent.activity_hazard_matrix && hasActivityHazardMatrixSectionContent
      ? {
          key: "appendix_e_task_hazard_control_matrix",
          kind: "appendix",
          order: 44,
          numberLabel: "Appendix E",
          title: "Appendix E. Task-Hazard-Control Matrix",
          table: {
            columns: ["Activity", "Hazard", "Risk", "Controls", "Permit"],
            rows: tradeItems.map((item) => [
              item.activity,
              item.hazard,
              item.risk,
              item.controls.join(", "),
              item.permit,
            ]),
          },
        }
      : null;

  programSections.forEach((program) => {
    sections.push(buildProgramRenderSection(program));
  });

  if (includedContent.drug_and_alcohol_testing) {
    sections.push(
      buildNarrativeSection({
        key: "drug_and_alcohol_testing",
        title: "Drug, Alcohol, and Fit-for-Duty Controls",
        section: getResolvedCsepSection(builderTextConfig, "drug_and_alcohol_testing"),
        extraText: form.drug_and_alcohol_testing_text,
      })
    );
  }

  if (includedContent.enforcement_and_corrective_action) {
    sections.push(
      buildNarrativeSection({
        key: "enforcement_and_corrective_action",
        title: "Enforcement and Corrective Action",
        section: getResolvedCsepSection(builderTextConfig, "enforcement_and_corrective_action"),
        extraText: form.enforcement_and_corrective_action_text,
      })
    );
  }

  if (includedContent.recordkeeping) {
    sections.push(
      buildNarrativeSection({
        key: "recordkeeping",
        title: "Recordkeeping and Documentation",
        section: getResolvedCsepSection(builderTextConfig, "recordkeeping"),
        extraText: form.recordkeeping_text,
      })
    );
  }

  if (includedContent.continuous_improvement) {
    sections.push(
      buildNarrativeSection({
        key: "continuous_improvement",
        title: "Program Evaluations and Continuous Improvement",
        section: getResolvedCsepSection(builderTextConfig, "continuous_improvement"),
        extraText: form.continuous_improvement_text,
      })
    );
  }

  sections.push({
    key: "stop_work_change_management",
    title:
      getResolvedCsepSection(builderTextConfig, "stop_work_change_management")?.title ??
      "Stop Work and Change Management",
    bullets:
      getResolvedCsepSection(builderTextConfig, "stop_work_change_management")?.bullets ?? [
        "Any worker has the authority and obligation to stop work when an unsafe condition exists.",
        "Work shall be reevaluated when scope changes, crews change, weather changes, or new equipment is introduced.",
        "Changed conditions shall be reviewed with supervision and the crew before work resumes.",
        "New hazards shall be documented and controlled before proceeding.",
      ],
  });

  // Acknowledgment block. Signature lines are intentionally retained as
  // approval placeholders that the Contractor Representative completes at
  // issue. Framed so it never reads as an unresolved draft artifact.
  sections.push({
    key: "acknowledgment",
    title: getCsepSection(builderTextConfig, "acknowledgment")?.title ?? "Acknowledgment",
    body: joinLines(
      getCsepSection(builderTextConfig, "acknowledgment")?.paragraphs ?? [
        `The contractor acknowledges responsibility for complying with this ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}, applicable site rules, required permits, and all regulatory requirements associated with the work.`,
        "Sign and date below at issue to confirm the CSEP has been reviewed against the project scope, site rules, and applicable regulatory requirements before field use.",
        "Contractor Representative: ________________________________",
        "Signature: ______________________________________________",
        "Date: ___________________________________________________",
      ]
    ),
  });

  const issueLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const preparedBy =
    valueOrNA(form.contractor_contact) !== "N/A"
      ? valueOrNA(form.contractor_contact)
      : "SafetyDocs360 Draft Builder";

  // Cover subtitle lines: only push tokens that actually carry project
  // identity, never N/A placeholders. Keeps the front matter customer-facing.
  const tradeValue = valueOrNA(form.trade);
  const subTradeValue = valueOrNA(form.subTrade);
  const projectAddressValue = valueOrNA(form.project_address);
  const coverSubtitleLines: string[] = [];
  const titlePageTaskSummary = selectedTasks.length ? selectedTasks.join("; ") : "N/A";
  const titlePageProjectLocation = projectAddressValue;
  const titlePageGoverningState = form.governing_state?.trim() || "N/A";

  return {
    projectName: valueOrNA(form.project_name),
    contractorName: valueOrNA(form.contractor_company),
    footerCompanyName: footerCompanyName?.trim() || "",
    tradeLabel: tradeValue,
    subTradeLabel: subTradeValue,
    issueLabel,
    titlePageTaskSummary,
    titlePageProjectLocation,
    titlePageGoverningState,
    statusLabel: "Draft Issue",
    preparedBy,
    coverSubtitleLines,
    coverMetadataRows: [
      { label: "Project Name", value: valueOrNA(form.project_name) },
      { label: "Project Number", value: valueOrNA(form.project_number) },
      { label: "Project Address", value: valueOrNA(form.project_address) },
      ...(form.governing_state?.trim()
        ? [{ label: "Governing State", value: form.governing_state.trim() }]
        : []),
      { label: "Owner / Client", value: valueOrNA(form.owner_client) },
      {
        label: "GC / CM / program partners (list all with site safety or logistics authority)",
        value: formatGcCmPartnersForExport(normalizeGcCmPartnerEntries(form.gc_cm)),
      },
      { label: "Contractor", value: valueOrNA(form.contractor_company) },
      { label: "Prepared By", value: preparedBy },
      { label: "Date", value: issueLabel },
      { label: "Revision", value: "1.0" },
    ],
    approvalLines: [
      "Project Manager / Competent Person: ___________________________ Signature / Date",
      "Corporate Safety Director: ___________________________ Signature / Date",
    ],
    revisionHistory: [
      {
        revision: "1.0",
        date: issueLabel,
        description: "Initial issuance for contractor CSEP export",
        preparedBy,
        // Use the issuing contractor as the approver of record so the
        // revision history reads as a final, signed-off issue rather than an
        // unresolved "Pending approval" placeholder.
        approvedBy:
          valueOrNA(form.contractor_company) !== "N/A"
            ? valueOrNA(form.contractor_company)
            : preparedBy,
      },
    ],
    ...(() => {
      const templateSections = buildCsepTemplateSections({
        projectName: valueOrNA(form.project_name),
        contractorName: valueOrNA(form.contractor_company),
        tradeLabel: tradeValue,
        subTradeLabel: subTradeValue,
        issueLabel,
        sourceSections: sections,
      });
      return {
        frontMatterSections: templateSections.filter((section) => section.kind === "front_matter"),
        sections: templateSections.filter((section) => section.kind === "main"),
      };
    })(),
    // Render the Task-Hazard-Control matrix as Appendix E so it never sits
    // awkwardly between numbered narrative sections in the body.
    appendixSections: activityHazardAppendixSection
      ? [toLegacyTemplateSection(activityHazardAppendixSection)]
      : [],
    disclaimerLines: [
      "This CSEP is prepared from project inputs and standard plan language; it must be reviewed, corrected, and approved by responsible project leadership before field use.",
      "Contractor supervision remains responsible for confirming site-specific conditions, permits, competent-person assignments, equipment suitability, and compliance with project requirements.",
      "When field conditions change, the work plan, controls, and communication expectations must be updated before work continues.",
    ],
    filenameProjectPart: `${valueOrNA(form.project_name).replace(/[^\w\-]+/g, "_")}_${valueOrNA(form.trade).replace(/[^\w\-]+/g, "_")}`,
  };
}
