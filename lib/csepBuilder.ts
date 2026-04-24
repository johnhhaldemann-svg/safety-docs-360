import {
  CSEP_BUILDER_BLOCK_KEYS,
  CSEP_APPENDIX_KEYS,
  CSEP_FORMAT_SECTION_KEYS,
  CSEP_FRONT_MATTER_KEYS,
  type CsepAppendixKey,
  type CsepCoverageAudit,
  type CsepCoverageAuditFinding,
  type CsepWeatherSectionInput,
  type CsepBuilderBlockKey,
  type CsepDocumentControlFields,
  type CsepFormatEntryKey,
  type CsepFormatSectionDefinition,
  type CsepFormatSectionKey,
} from "@/types/csep-builder";
import type { GeneratedSafetyPlanDraft, GeneratedSafetyPlanSection } from "@/types/safety-intelligence";
import {
  cleanFinalText,
  cleanSectionForFinalIssue,
  isMeaningfulFinalText,
  normalizePermitList,
} from "@/lib/csepFinalization";

type CsepFrontMatterDefinition = CsepFormatSectionDefinition & {
  key: (typeof CSEP_FRONT_MATTER_KEYS)[number];
  kind: "front_matter";
};

type CsepMainSectionDefinition = CsepFormatSectionDefinition & {
  key: CsepFormatSectionKey;
  kind: "main";
};

type CsepAppendixDefinition = CsepFormatSectionDefinition & {
  key: CsepAppendixKey;
  kind: "appendix";
};

const BLOCK_OPTION_DEFINITIONS: Array<{
  key: CsepBuilderBlockKey;
  label: string;
  title: string;
}> = [
  {
    key: "project_information",
    label: "Project Information",
    title: "Project Information",
  },
  {
    key: "contractor_information",
    label: "Contractor Information",
    title: "Contractor Information",
  },
  {
    key: "trade_summary",
    label: "Trade Summary",
    title: "Trade Summary",
  },
  {
    key: "scope_of_work",
    label: "Scope of Work",
    title: "Scope of Work",
  },
  {
    key: "site_specific_notes",
    label: "Site Specific Notes",
    title: "Site Specific Notes",
  },
  {
    key: "emergency_procedures",
    label: "Emergency Procedures",
    title: "Emergency Procedures",
  },
  {
    key: "hazard_communication",
    label: "Hazard Communication (HazCom)",
    title: "Hazard Communication (HazCom)",
  },
  {
    key: "weather_requirements_and_severe_weather_response",
    label: "Weather Requirements and Severe Weather Response",
    title: "Weather Requirements and Severe Weather Response",
  },
  {
    key: "required_ppe",
    label: "Required PPE",
    title: "Required Personal Protective Equipment",
  },
  {
    key: "additional_permits",
    label: "Additional Permits",
    title: "Permit Requirements",
  },
  {
    key: "common_overlapping_trades",
    label: "Common Overlapping Trades",
    title: "Common Overlapping Trades in Same Areas",
  },
  {
    key: "osha_references",
    label: "OSHA References",
    title: "Applicable OSHA References",
  },
  {
    key: "selected_hazards",
    label: "Selected Hazards",
    title: "Selected Hazard Summary",
  },
  {
    key: "activity_hazard_matrix",
    label: "Activity / Hazard Matrix",
    title: "Activity Hazard Analysis Matrix",
  },
  {
    key: "roles_and_responsibilities",
    label: "Roles and Responsibilities",
    title: "Roles and Responsibilities",
  },
  {
    key: "security_and_access",
    label: "Security and Access",
    title: "Security and Access",
  },
  {
    key: "health_and_wellness",
    label: "Health and Wellness",
    title: "Health and Wellness",
  },
  {
    key: "incident_reporting_and_investigation",
    label: "Incident Reporting and Investigation",
    title: "Incident Reporting and Investigation",
  },
  {
    key: "training_and_instruction",
    label: "Training and Instruction",
    title: "Training and Instruction",
  },
  {
    key: "drug_and_alcohol_testing",
    label: "Drug, Alcohol, and Fit-for-Duty Controls",
    title: "Drug, Alcohol, and Fit-for-Duty Controls",
  },
  {
    key: "enforcement_and_corrective_action",
    label: "Enforcement and Corrective Action",
    title: "Enforcement and Corrective Action",
  },
  {
    key: "recordkeeping",
    label: "Recordkeeping",
    title: "Recordkeeping and Documentation",
  },
  {
    key: "continuous_improvement",
    label: "Continuous Improvement",
    title: "Program Evaluations and Continuous Improvement",
  },
];

export const CSEP_BUILDER_BLOCK_OPTIONS = BLOCK_OPTION_DEFINITIONS;

export const CSEP_BUILDER_BLOCK_LABELS = Object.fromEntries(
  BLOCK_OPTION_DEFINITIONS.map((option) => [option.key, option.label])
) as Record<CsepBuilderBlockKey, string>;

export const CSEP_BUILDER_BLOCK_TITLES = Object.fromEntries(
  BLOCK_OPTION_DEFINITIONS.map((option) => [option.key, option.title])
) as Record<CsepBuilderBlockKey, string>;

const FRONT_MATTER_DEFINITIONS: readonly CsepFrontMatterDefinition[] = [
  {
    key: "document_control",
    kind: "front_matter",
    order: 0,
    title: "0.0 Document Control",
    shortTitle: "Document Control",
    numberLabel: "0.0",
    purpose: "Capture issue, revision, preparer/reviewer/approver, and document control metadata.",
    aiEligible: false,
  },
  {
    key: "revision_history",
    kind: "front_matter",
    order: 1,
    title: "0.1 Revision History",
    shortTitle: "Revision History",
    numberLabel: "0.1",
    purpose: "Track issued versions and approval status for the active CSEP package.",
    aiEligible: false,
  },
  {
    key: "table_of_contents",
    kind: "front_matter",
    order: 2,
    title: "Table of Contents",
    shortTitle: "Table of Contents",
    numberLabel: null,
    purpose: "List the numbered sections and appendix library.",
    aiEligible: false,
  },
  {
    key: "plan_use_guidance",
    kind: "front_matter",
    order: 3,
    title: "How to Use This Plan",
    shortTitle: "How to Use This Plan",
    numberLabel: null,
    purpose: "Explain how to navigate the package, front matter, and appendix references.",
    aiEligible: true,
  },
  {
    key: "definitions_and_abbreviations",
    kind: "front_matter",
    order: 4,
    title: "Definitions and Abbreviations",
    shortTitle: "Definitions and Abbreviations",
    numberLabel: null,
    purpose: "Capture key acronyms, labor terms, and project shorthand used throughout the document.",
    aiEligible: true,
  },
  {
    key: "incident_overview",
    kind: "front_matter",
    order: 5,
    title: "Incident Overview",
    shortTitle: "Incident Overview",
    numberLabel: null,
    purpose: "Provide the quick-reference incident trigger and escalation panel.",
    aiEligible: true,
  },
  {
    key: "life_saving_rules",
    kind: "front_matter",
    order: 6,
    title: "Life-Saving Rules",
    shortTitle: "Life-Saving Rules",
    numberLabel: null,
    purpose: "Provide the life-saving rules visual panel and stop-work cues.",
    aiEligible: true,
  },
] as const;

const FORMAT_SECTION_DEFINITIONS: readonly CsepMainSectionDefinition[] = [
  {
    key: "company_overview_and_safety_philosophy",
    kind: "main",
    order: 10,
    title: "1.0 Company Overview and Safety Philosophy",
    shortTitle: "Company Overview and Safety Philosophy",
    numberLabel: "1.0",
    purpose: "Mission-forward leadership commitment, labor partnership, and key company commitments.",
    aiEligible: true,
    legacyBlockKeys: ["contractor_information"],
  },
  {
    key: "project_scope_and_trade_specific_activities",
    kind: "main",
    order: 11,
    title: "2.0 Project Scope and Trade-Specific Activities",
    shortTitle: "Project Scope and Trade-Specific Activities",
    numberLabel: "2.0",
    purpose: "Project summary, phases, high-risk work, trade interfaces, and environmental impacts.",
    aiEligible: true,
    legacyBlockKeys: [
      "project_information",
      "trade_summary",
      "scope_of_work",
      "site_specific_notes",
      "common_overlapping_trades",
    ],
  },
  {
    key: "roles_and_responsibilities",
    kind: "main",
    order: 12,
    title: "3.0 Roles and Responsibilities",
    shortTitle: "Roles and Responsibilities",
    numberLabel: "3.0",
    purpose: "Organization chart, role cards, competent persons, and HSE staffing ratios.",
    aiEligible: true,
    legacyBlockKeys: ["roles_and_responsibilities"],
  },
  {
    key: "security_and_access_control",
    kind: "main",
    order: 13,
    title: "4.0 Security and Access Control",
    shortTitle: "Security and Access Control",
    numberLabel: "4.0",
    purpose: "Worker access, sign-in flow, zone control, and asset protection expectations.",
    aiEligible: true,
    legacyBlockKeys: ["security_and_access"],
  },
  {
    key: "contractor_iipp",
    kind: "main",
    order: 14,
    title: "5.0 Contractor Injury & Illness Prevention Program (IIPP)",
    shortTitle: "Contractor IIPP",
    numberLabel: "5.0",
    purpose: "Accountability, communication, incident handling, training, testing, and corrective action.",
    aiEligible: true,
    legacyBlockKeys: [
      "health_and_wellness",
      "incident_reporting_and_investigation",
      "training_and_instruction",
      "drug_and_alcohol_testing",
      "enforcement_and_corrective_action",
      "recordkeeping",
      "continuous_improvement",
    ],
  },
  {
    key: "emergency_preparedness_and_response",
    kind: "main",
    order: 15,
    title: "6.0 Emergency Preparedness and Response",
    shortTitle: "Emergency Preparedness and Response",
    numberLabel: "6.0",
    purpose: "Emergency quick reference, evacuation, medical response, fire, spill, and rescue planning.",
    aiEligible: true,
    legacyBlockKeys: ["emergency_procedures"],
  },
  {
    key: "personal_protective_equipment",
    kind: "main",
    order: 16,
    title: "7.0 Personal Protective Equipment",
    shortTitle: "Personal Protective Equipment",
    numberLabel: "7.0",
    purpose: "Quick-reference PPE expectations, specialty PPE, respiratory protection, and inspection flow.",
    aiEligible: true,
    legacyBlockKeys: ["required_ppe"],
  },
  {
    key: "hazard_communication_program",
    kind: "main",
    order: 17,
    title: "8.0 Hazard Communication (HazCom)",
    shortTitle: "Hazard Communication (HazCom)",
    numberLabel: "8.0",
    purpose:
      "GHS labels, secondary containers, SDS access, training, chemical inventory, contractor notification, and damaged-container reporting (not general environmental or emergency response).",
    aiEligible: true,
    legacyBlockKeys: ["hazard_communication"],
  },
  {
    key: "weather_requirements_and_severe_weather_response",
    kind: "main",
    order: 18,
    title: "9.0 Emergency, Weather, Fire Prevention & Housekeeping",
    shortTitle: "Emergency, Weather, Fire Prevention & Housekeeping",
    numberLabel: "9.0",
    purpose:
      "Field coordination for weather, heat, cold, fire prevention, and housekeeping, cross-referenced to the emergency program—not a substitute for full emergency plans or the HazCom section.",
    aiEligible: true,
    legacyBlockKeys: ["weather_requirements_and_severe_weather_response"],
  },
  {
    key: "safe_work_practices_and_trade_specific_procedures",
    kind: "main",
    order: 19,
    title: "10.0 Safe Work Practices and Trade Specific Procedures",
    shortTitle: "Safe Work Practices and Trade Specific Procedures",
    numberLabel: "10.0",
    purpose: "Core policy modules, equipment/material handling, and trade-specific procedure references.",
    aiEligible: true,
    appendixRefs: ["appendix_a_forms_and_permit_library"],
    legacyBlockKeys: ["selected_hazards", "activity_hazard_matrix"],
  },
  {
    key: "environmental_execution_requirements",
    kind: "main",
    order: 20,
    title: "11.0 Environmental Controls",
    shortTitle: "Environmental Controls",
    numberLabel: "11.0",
    purpose: "SWPPP, waste, stormwater, dust, noise, spill response in the field, and compliance modules. Chemical labeling and worker HazCom are in Section 8.0; inventory of hazardous chemicals is in HazCom, not in environmental.",
    aiEligible: true,
    legacyBlockKeys: ["site_specific_notes"],
  },
  {
    key: "contractor_monitoring_audits_and_reporting",
    kind: "main",
    order: 21,
    title: "12.0 Contractor Monitoring, Audits & Reporting",
    shortTitle: "Contractor Monitoring, Audits & Reporting",
    numberLabel: "12.0",
    purpose: "KPIs, audits, corrective action tracking, and reporting cadence.",
    aiEligible: true,
    appendixRefs: ["appendix_c_checklists_and_inspection_sheets"],
    legacyBlockKeys: ["recordkeeping", "continuous_improvement"],
  },
  {
    key: "contractor_safety_meetings_and_engagement",
    kind: "main",
    order: 22,
    title: "13.0 Contractor Safety Meetings and Engagement",
    shortTitle: "Contractor Safety Meetings and Engagement",
    numberLabel: "13.0",
    purpose: "Daily huddles, toolbox talks, stand-down triggers, and engagement workflow.",
    aiEligible: true,
    appendixRefs: ["appendix_c_checklists_and_inspection_sheets"],
    legacyBlockKeys: ["training_and_instruction"],
  },
  {
    key: "sub_tier_contractor_management",
    kind: "main",
    order: 23,
    title: "14.0 Sub-Tier Contractor Management",
    shortTitle: "Sub-Tier Contractor Management",
    numberLabel: "14.0",
    purpose: "Prequalification, onboarding, documentation turnover, and field oversight expectations.",
    aiEligible: true,
    legacyBlockKeys: ["common_overlapping_trades", "roles_and_responsibilities"],
  },
  {
    key: "project_close_out",
    kind: "main",
    order: 24,
    title: "15.0 Project Close-Out",
    shortTitle: "Project Close-Out",
    numberLabel: "15.0",
    purpose: "Action-based close-out of corrective actions, permits, documentation, and turnover before final release.",
    aiEligible: true,
    legacyBlockKeys: ["continuous_improvement", "recordkeeping"],
  },
  {
    key: "permits_and_forms",
    kind: "main",
    order: 25,
    title: "16.0 Permits and Forms",
    shortTitle: "Permits and Forms",
    numberLabel: "16.0",
    purpose: "Permit/form library overview and cross-references to generated appendix content.",
    aiEligible: true,
    appendixRefs: ["appendix_a_forms_and_permit_library"],
    legacyBlockKeys: ["additional_permits"],
  },
  {
    key: "checklists_and_inspections",
    kind: "main",
    order: 26,
    title: "17.0 Checklists and Inspections",
    shortTitle: "Checklists and Inspections",
    numberLabel: "17.0",
    purpose: "Checklist trigger/frequency cards and inspection reference logic.",
    aiEligible: true,
    appendixRefs: ["appendix_c_checklists_and_inspection_sheets"],
    legacyBlockKeys: ["recordkeeping"],
  },
  {
    key: "regulatory_framework",
    kind: "main",
    order: 27,
    title: "18.0 Regulatory Framework",
    shortTitle: "Regulatory Framework",
    numberLabel: "18.0",
    purpose: "OSHA, state, local, owner, and labor-framework quick-reference content.",
    aiEligible: true,
    legacyBlockKeys: ["osha_references"],
  },
  {
    key: "hse_elements_and_site_specific_hazard_analysis",
    kind: "main",
    order: 28,
    title: "19.0 HSE Elements / Site-Specific Hazard Analysis",
    shortTitle: "HSE Elements / Site-Specific Hazard Analysis",
    numberLabel: "19.0",
    purpose: "Hazard module library with purpose, controls, training, and response expectations.",
    aiEligible: true,
    appendixRefs: ["appendix_a_forms_and_permit_library", "appendix_b_incident_and_investigation_package"],
    legacyBlockKeys: ["selected_hazards", "activity_hazard_matrix"],
  },
  {
    key: "appendices_and_support_library",
    kind: "main",
    order: 29,
    title: "20.0 Appendices and Support Library",
    shortTitle: "Appendices and Support Library",
    numberLabel: "20.0",
    purpose: "Divider page and appendix library cards for forms, investigations, checklists, and field references.",
    aiEligible: true,
    appendixRefs: [...CSEP_APPENDIX_KEYS],
  },
] as const;

const APPENDIX_DEFINITIONS: readonly CsepAppendixDefinition[] = [
  {
    key: "appendix_a_forms_and_permit_library",
    kind: "appendix",
    order: 40,
    title: "Appendix A. Forms and Permit Library",
    shortTitle: "Forms and Permit Library",
    numberLabel: "Appendix A",
    purpose: "Permit, planning-form, and administrative document library.",
    aiEligible: true,
  },
  {
    key: "appendix_b_incident_and_investigation_package",
    kind: "appendix",
    order: 41,
    title: "Appendix B. Incident and Investigation Package",
    shortTitle: "Incident and Investigation Package",
    numberLabel: "Appendix B",
    purpose:
      "Required incident-response, investigation, corrective-action, and closeout documents for recordkeeping and follow-up.",
    aiEligible: true,
  },
  {
    key: "appendix_c_checklists_and_inspection_sheets",
    kind: "appendix",
    order: 42,
    title: "Appendix C. Checklists and Inspection Sheets",
    shortTitle: "Checklists and Inspection Sheets",
    numberLabel: "Appendix C",
    purpose: "Recurring inspection and checklist library with trigger/frequency context.",
    aiEligible: true,
  },
  {
    key: "appendix_d_field_references_maps_and_contact_inserts",
    kind: "appendix",
    order: 43,
    title: "Appendix D. Field References, Maps, and Contact Inserts",
    shortTitle: "Field References, Maps, and Contact Inserts",
    numberLabel: "Appendix D",
    purpose: "Field-use maps, emergency contacts, clinic directions, and quick inserts.",
    aiEligible: true,
  },
] as const;

export const CSEP_FORMAT_DEFINITIONS = [
  ...FRONT_MATTER_DEFINITIONS,
  ...FORMAT_SECTION_DEFINITIONS,
  ...APPENDIX_DEFINITIONS,
] as const;

export const CSEP_FORMAT_DEFINITION_BY_KEY = Object.fromEntries(
  CSEP_FORMAT_DEFINITIONS.map((definition) => [definition.key, definition])
) as Record<CsepFormatEntryKey, CsepFormatSectionDefinition>;

export const CSEP_FORMAT_SECTION_OPTIONS: ReadonlyArray<{
  value: CsepFormatSectionKey;
  label: string;
  description?: string;
}> = FORMAT_SECTION_DEFINITIONS.map((definition) => ({
  value: definition.key,
  label: definition.title,
  description: definition.purpose ?? undefined,
}));

export const CSEP_FORMAT_SECTION_LABELS = Object.fromEntries(
  FORMAT_SECTION_DEFINITIONS.map((definition) => [definition.key, definition.title])
) as Record<CsepFormatSectionKey, string>;

export const CSEP_FORMAT_SECTION_TO_BLOCK_KEYS = Object.fromEntries(
  FORMAT_SECTION_DEFINITIONS.map((definition) => [definition.key, definition.legacyBlockKeys ?? []])
) as Record<CsepFormatSectionKey, CsepBuilderBlockKey[]>;

export const CSEP_BUILDER_AI_TEXT_FIELD_KEYS = [
  "scope_of_work",
  "site_specific_notes",
  "emergency_procedures",
  "roles_and_responsibilities_text",
  "security_and_access_text",
  "health_and_wellness_text",
  "incident_reporting_and_investigation_text",
  "training_and_instruction_text",
  "drug_and_alcohol_testing_text",
  "enforcement_and_corrective_action_text",
  "recordkeeping_text",
  "continuous_improvement_text",
] as const;

export type CsepBuilderAiTextFieldKey = (typeof CSEP_BUILDER_AI_TEXT_FIELD_KEYS)[number];
export type CsepBuilderAiSectionId = "weather" | CsepBuilderAiTextFieldKey;
export type CsepBuilderAiSectionKind = "text" | "weather";

export type CsepBuilderAiSectionConfig =
  | {
      id: CsepBuilderAiTextFieldKey;
      kind: "text";
      title: string;
      fieldKey: CsepBuilderAiTextFieldKey;
      includedSectionLabel: string;
      draftingFocus: string;
    }
  | {
      id: "weather";
      kind: "weather";
      title: string;
      includedSectionLabel: string;
      draftingFocus: string;
    };

const CSEP_BUILDER_AI_SECTION_DEFINITIONS: readonly CsepBuilderAiSectionConfig[] = [
  {
    id: "scope_of_work",
    kind: "text",
    title: "Scope of Work",
    fieldKey: "scope_of_work",
    includedSectionLabel: "Scope of Work",
    draftingFocus:
      "Describe the selected tasks, work sequence, access, equipment, material handling, and the task boundaries that matter for the crew.",
  },
  {
    id: "site_specific_notes",
    kind: "text",
    title: "Site Specific Notes",
    fieldKey: "site_specific_notes",
    includedSectionLabel: "Site Specific Notes",
    draftingFocus:
      "Capture task-relevant site conditions, access limits, occupied-area concerns, adjacent operations, and other jobsite constraints that affect the selected tasks.",
  },
  {
    id: "emergency_procedures",
    kind: "text",
    title: "Emergency Procedures",
    fieldKey: "emergency_procedures",
    includedSectionLabel: "Emergency Procedures",
    draftingFocus:
      "Explain emergency response expectations for the selected tasks, including stop-work, notification, access/egress, medical response, and coordination with site management.",
  },
  {
    id: "weather",
    kind: "weather",
    title: "Emergency, Weather, Fire Prevention & Housekeeping",
    /** Must match `CSEP_BUILDER_BLOCK_OPTIONS` label for `weather_requirements_and_severe_weather_response` (form `included_sections`). */
    includedSectionLabel: "Weather Requirements and Severe Weather Response",
    draftingFocus:
      "Cover field coordination for heat, cold, wind, and lightning, fire prevention and housekeeping, monitoring and comm (grouped, not one-line repeated prefixes), and stop-work. Cross-reference the dedicated Emergency and HazCom sections instead of restating them.",
  },
  {
    id: "roles_and_responsibilities_text",
    kind: "text",
    title: "Roles and Responsibilities",
    fieldKey: "roles_and_responsibilities_text",
    includedSectionLabel: "Roles and Responsibilities",
    draftingFocus:
      "Assign practical responsibilities for supervision, coordination, competent-person oversight, communication, and task execution tied to the selected tasks.",
  },
  {
    id: "security_and_access_text",
    kind: "text",
    title: "Security and Access",
    fieldKey: "security_and_access_text",
    includedSectionLabel: "Security and Access",
    draftingFocus:
      "Describe access control, restricted areas, deliveries, staging, and security expectations that directly support the selected tasks.",
  },
  {
    id: "health_and_wellness_text",
    kind: "text",
    title: "Health and Wellness",
    fieldKey: "health_and_wellness_text",
    includedSectionLabel: "Health and Wellness",
    draftingFocus:
      "Focus on hydration, fatigue, sanitation, exposure management, and worker wellness controls that are relevant to the selected tasks and site conditions.",
  },
  {
    id: "incident_reporting_and_investigation_text",
    kind: "text",
    title: "Incident Reporting and Investigation",
    fieldKey: "incident_reporting_and_investigation_text",
    includedSectionLabel: "Incident Reporting and Investigation",
    draftingFocus:
      "Describe reporting, scene protection, supervisor notification, documentation, and follow-up expectations for incidents and near misses related to the selected tasks.",
  },
  {
    id: "training_and_instruction_text",
    kind: "text",
    title: "Training and Instruction",
    fieldKey: "training_and_instruction_text",
    includedSectionLabel: "Training and Instruction",
    draftingFocus:
      "State task-specific orientation, toolbox talk, operator qualification, and pre-task instruction expectations needed for the selected work.",
  },
  {
    id: "drug_and_alcohol_testing_text",
    kind: "text",
    title: "Drug, Alcohol, and Fit-for-Duty Controls",
    fieldKey: "drug_and_alcohol_testing_text",
    includedSectionLabel: "Drug, Alcohol, and Fit-for-Duty Controls",
    draftingFocus:
      "Cover pre-access orientation and acknowledgments, union and reciprocal testing obligations, the personal-vehicle prohibition on site, reporting of suspected impairment, removal from exposed work, testing triggers, and restart rules—without repeating enforcement or corrective-action content.",
  },
  {
    id: "enforcement_and_corrective_action_text",
    kind: "text",
    title: "Enforcement and Corrective Action",
    fieldKey: "enforcement_and_corrective_action_text",
    includedSectionLabel: "Enforcement and Corrective Action",
    draftingFocus:
      "Focus on correction, escalation, documentation, field verification, restart approval, and disciplinary or site-removal outcomes. Do not repeat fit-for-duty or testing program language from Drug, Alcohol, and Fit-for-Duty Controls.",
  },
  {
    id: "recordkeeping_text",
    kind: "text",
    title: "Recordkeeping",
    fieldKey: "recordkeeping_text",
    includedSectionLabel: "Recordkeeping",
    draftingFocus:
      "Describe the task-relevant records, permits, inspections, attendance logs, and verification documents that should be maintained for the selected work.",
  },
  {
    id: "continuous_improvement_text",
    kind: "text",
    title: "Continuous Improvement",
    fieldKey: "continuous_improvement_text",
    includedSectionLabel: "Continuous Improvement",
    draftingFocus:
      "Describe how lessons learned, field observations, and work-plan adjustments from the selected tasks feed back into safer execution.",
  },
] as const;

export const CSEP_BUILDER_AI_SECTION_CONFIG = Object.fromEntries(
  CSEP_BUILDER_AI_SECTION_DEFINITIONS.map((section) => [section.id, section])
) as Record<CsepBuilderAiSectionId, CsepBuilderAiSectionConfig>;

export function getCsepBuilderAiSectionConfig(sectionId: CsepBuilderAiSectionId) {
  return CSEP_BUILDER_AI_SECTION_CONFIG[sectionId];
}

type CsepBuilderAiPromptContext = {
  project_name?: string;
  project_number?: string;
  project_address?: string;
  governing_state?: string;
  project_delivery_type?: string;
  owner_client?: string;
  gc_cm?: string;
  contractor_company?: string;
  contractor_contact?: string;
  contractor_phone?: string;
  contractor_email?: string;
  trade?: string;
  subTrade?: string;
  tasks: string[];
  selected_hazards: string[];
  required_ppe: string[];
  selected_permits: string[];
};

type CsepBuilderAiPromptParams = {
  sectionId: CsepBuilderAiSectionId;
  context: CsepBuilderAiPromptContext;
  currentValue?: string | CsepWeatherSectionInput;
};

const LABEL_TO_KEY = Object.fromEntries(
  BLOCK_OPTION_DEFINITIONS.map((option) => [option.label, option.key])
) as Record<string, CsepBuilderBlockKey>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareValues(left: unknown, right: unknown) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

export function normalizeSelectedCsepBlockKeys(params: {
  includedSections?: unknown;
  includedContent?: unknown;
}) {
  const keys = new Set<CsepBuilderBlockKey>();

  if (Array.isArray(params.includedSections)) {
    params.includedSections.forEach((value) => {
      if (typeof value !== "string") return;
      if ((CSEP_BUILDER_BLOCK_KEYS as readonly string[]).includes(value.trim())) {
        keys.add(value.trim() as CsepBuilderBlockKey);
        return;
      }
      const mapped = LABEL_TO_KEY[value.trim()];
      if (mapped) {
        keys.add(mapped);
      }
    });
  }

  if (isRecord(params.includedContent)) {
    const includedContent = params.includedContent;
    CSEP_BUILDER_BLOCK_KEYS.forEach((key) => {
      if (includedContent[key]) {
        keys.add(key);
      }
    });
  }

  return CSEP_BUILDER_BLOCK_KEYS.filter((key) => keys.has(key));
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        if (leftKey === rightKey) return compareValues(leftValue, rightValue);
        return leftKey.localeCompare(rightKey);
      });
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function createDeterministicHash(value: unknown) {
  const serialized = stableSerialize(value);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `csep_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function parseJsonObjectCandidate<T extends Record<string, unknown>>(value: string): T | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as T;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractFirstJsonObject(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = inString;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return trimmed.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findObjectWithAnyKeys(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (keys.some((key) => key in value)) {
    return value;
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue)) {
      for (const item of nestedValue) {
        const match = findObjectWithAnyKeys(item, keys);
        if (match) return match;
      }
      continue;
    }

    const match = findObjectWithAnyKeys(nestedValue, keys);
    if (match) return match;
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|;(?=\s*[A-Za-z])/)
      .map((item) => item.replace(/^[-*•]\s*/, "").replace(/^\d+(?:\.\d+)*[\])\.-]?\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function parseStormSectionFromLabeledText(value: string): Pick<
  CsepWeatherSectionInput,
  "tornadoStormShelterNotes" | "tornadoStormControls"
> | null {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const shelterParts: string[] = [];
  const controls: string[] = [];
  let activeSection: "notes" | "controls" | null = null;

  for (const line of lines) {
    const shelterMatch = line.match(
      /^(?:tornadostormshelternotes|storm\s*\/\s*tornado shelter|storm shelter|tornado shelter|shelter notes?)\s*:?\s*(.*)$/i
    );
    if (shelterMatch) {
      activeSection = "notes";
      const remainder = shelterMatch[1]?.trim();
      if (remainder) {
        shelterParts.push(remainder);
      }
      continue;
    }

    const controlsMatch = line.match(
      /^(?:tornadostormcontrols|storm controls?|tornado controls?|controls?)\s*:?\s*(.*)$/i
    );
    if (controlsMatch) {
      activeSection = "controls";
      const remainder = controlsMatch[1]?.trim();
      if (remainder) {
        controls.push(...normalizeStringList(remainder));
      }
      continue;
    }

    if (activeSection === "controls") {
      controls.push(
        ...normalizeStringList(line.replace(/^(?:[-*•]|\d+(?:\.\d+)*[\])\.-]?)\s*/, ""))
      );
      continue;
    }

    if (activeSection === "notes") {
      shelterParts.push(line);
    }
  }

  const tornadoStormShelterNotes = shelterParts.join(" ").trim();
  const tornadoStormControls = normalizeSelectedCsepBulletValues(controls);

  if (!tornadoStormShelterNotes && tornadoStormControls.length === 0) {
    return null;
  }

  return {
    ...(tornadoStormShelterNotes ? { tornadoStormShelterNotes } : {}),
    ...(tornadoStormControls.length ? { tornadoStormControls } : {}),
  };
}

function normalizeSelectedCsepBulletValues(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function parseCsepStormSectionAiResponse(value: string): Pick<
  CsepWeatherSectionInput,
  "tornadoStormShelterNotes" | "tornadoStormControls"
> | null {
  const direct = parseJsonObjectCandidate<Record<string, unknown>>(value);
  const candidate =
    direct ??
    parseJsonObjectCandidate<Record<string, unknown>>(extractFirstJsonObject(value) ?? "");

  if (candidate) {
    const source =
      findObjectWithAnyKeys(candidate, [
        "tornadoStormShelterNotes",
        "tornadoStormControls",
        "stormShelterNotes",
        "stormControls",
        "shelterNotes",
        "controls",
      ]) ?? candidate;

    const tornadoStormShelterNotes = [
      source.tornadoStormShelterNotes,
      source.stormShelterNotes,
      source.shelterNotes,
    ].find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)?.trim();

    const tornadoStormControls = normalizeSelectedCsepBulletValues(
      normalizeStringList(source.tornadoStormControls ?? source.stormControls ?? source.controls)
    );

    if (tornadoStormShelterNotes || tornadoStormControls.length > 0) {
      return {
        ...(tornadoStormShelterNotes ? { tornadoStormShelterNotes } : {}),
        ...(tornadoStormControls.length ? { tornadoStormControls } : {}),
      };
    }
  }

  return parseStormSectionFromLabeledText(value);
}

const WEATHER_SECTION_LABELS: Array<{
  key: keyof CsepWeatherSectionInput;
  patterns: RegExp[];
  kind: "string" | "string[]" | "number";
}> = [
  { key: "monitoringSources", patterns: [/^monitoring sources?\s*:?\s*(.*)$/i], kind: "string[]" },
  {
    key: "communicationMethods",
    patterns: [/^communication methods?\s*:?\s*(.*)$/i],
    kind: "string[]",
  },
  {
    key: "highWindThresholdText",
    patterns: [/^high[- ]wind threshold(?: \/ rule)?\s*:?\s*(.*)$/i],
    kind: "string",
  },
  {
    key: "lightningShelterNotes",
    patterns: [/^lightning shelter notes?\s*:?\s*(.*)$/i],
    kind: "string",
  },
  {
    key: "lightningRadiusMiles",
    patterns: [/^lightning stop radius(?: \(miles\))?\s*:?\s*(.*)$/i],
    kind: "number",
  },
  {
    key: "lightningAllClearMinutes",
    patterns: [/^lightning all[- ]clear(?: \(minutes\))?\s*:?\s*(.*)$/i],
    kind: "number",
  },
  { key: "heatTriggerText", patterns: [/^heat trigger\s*:?\s*(.*)$/i], kind: "string" },
  {
    key: "coldTriggerText",
    patterns: [/^(?:cold|cold \/ wind[- ]chill) trigger\s*:?\s*(.*)$/i],
    kind: "string",
  },
  {
    key: "tornadoStormShelterNotes",
    patterns: [
      /^(?:tornadostormshelternotes|storm\s*\/\s*tornado shelter|storm shelter|tornado shelter|shelter notes?)\s*:?\s*(.*)$/i,
    ],
    kind: "string",
  },
  {
    key: "unionAccountabilityNotes",
    patterns: [/^union \/ accountability notes?\s*:?\s*(.*)$/i],
    kind: "string",
  },
  { key: "dailyReviewNotes", patterns: [/^daily review notes?\s*:?\s*(.*)$/i], kind: "string" },
  {
    key: "projectOverrideNotes",
    patterns: [/^project override notes?\s*:?\s*(.*)$/i],
    kind: "string[]",
  },
  {
    key: "highWindControls",
    patterns: [/^high[- ]wind controls?\s*:?\s*(.*)$/i],
    kind: "string[]",
  },
  { key: "heatControls", patterns: [/^heat controls?\s*:?\s*(.*)$/i], kind: "string[]" },
  { key: "coldControls", patterns: [/^cold controls?\s*:?\s*(.*)$/i], kind: "string[]" },
  {
    key: "tornadoStormControls",
    patterns: [/^(?:storm|tornado) controls?\s*:?\s*(.*)$/i],
    kind: "string[]",
  },
  {
    key: "environmentalControls",
    patterns: [/^environmental controls?\s*:?\s*(.*)$/i],
    kind: "string[]",
  },
  {
    key: "contractorResponsibilityNotes",
    patterns: [/^contractor responsibility notes?\s*:?\s*(.*)$/i],
    kind: "string[]",
  },
];

function parseWeatherSectionNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeWeatherSectionField<K extends keyof CsepWeatherSectionInput>(
  key: K,
  value: unknown
): CsepWeatherSectionInput[K] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (key === "lightningRadiusMiles" || key === "lightningAllClearMinutes") {
    const numericValue = parseWeatherSectionNumber(value);
    return (numericValue === null ? undefined : numericValue) as CsepWeatherSectionInput[K];
  }

  if (
    key === "monitoringSources" ||
    key === "communicationMethods" ||
    key === "highWindControls" ||
    key === "heatControls" ||
    key === "coldControls" ||
    key === "tornadoStormControls" ||
    key === "environmentalControls" ||
    key === "projectOverrideNotes" ||
    key === "contractorResponsibilityNotes"
  ) {
    const normalizedList = normalizeSelectedCsepBulletValues(normalizeStringList(value));
    return (normalizedList.length ? normalizedList : undefined) as CsepWeatherSectionInput[K];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return (trimmed ? trimmed : undefined) as CsepWeatherSectionInput[K];
  }

  return undefined;
}

function parseCsepWeatherSectionFromLabeledText(value: string): Partial<CsepWeatherSectionInput> | null {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const nextWeather: Partial<CsepWeatherSectionInput> = {};
  let activeField: (typeof WEATHER_SECTION_LABELS)[number] | null = null;

  for (const line of lines) {
    const matchedField = WEATHER_SECTION_LABELS.find((field) =>
      field.patterns.some((pattern) => pattern.test(line))
    );

    if (matchedField) {
      activeField = matchedField;
      const pattern = matchedField.patterns.find((entry) => entry.test(line));
      const remainder = pattern?.exec(line)?.[1]?.trim() ?? "";

      if (matchedField.kind === "string[]") {
        const values = normalizeSelectedCsepBulletValues([
          ...normalizeStringList(nextWeather[matchedField.key]),
          ...normalizeStringList(remainder),
        ]);
        if (values.length) {
          nextWeather[matchedField.key] = values as never;
        }
      } else if (matchedField.kind === "number") {
        const numericValue = parseWeatherSectionNumber(remainder);
        if (numericValue !== null) {
          nextWeather[matchedField.key] = numericValue as never;
        }
      } else if (remainder) {
        nextWeather[matchedField.key] = remainder as never;
      }
      continue;
    }

    if (!activeField) continue;

    if (activeField.kind === "string[]") {
      const values = normalizeSelectedCsepBulletValues([
        ...normalizeStringList(nextWeather[activeField.key]),
        ...normalizeStringList(line.replace(/^(?:[-*•]|\d+(?:\.\d+)*[\])\.-]?)\s*/, "")),
      ]);
      if (values.length) {
        nextWeather[activeField.key] = values as never;
      }
      continue;
    }

    if (activeField.kind === "number") {
      const numericValue = parseWeatherSectionNumber(line);
      if (numericValue !== null) {
        nextWeather[activeField.key] = numericValue as never;
      }
      continue;
    }

    const existingValue =
      typeof nextWeather[activeField.key] === "string"
        ? String(nextWeather[activeField.key]).trim()
        : "";
    nextWeather[activeField.key] = `${existingValue ? `${existingValue} ` : ""}${line}`.trim() as never;
  }

  return Object.keys(nextWeather).length > 0 ? nextWeather : null;
}

export function parseCsepWeatherSectionAiResponse(value: string): Partial<CsepWeatherSectionInput> | null {
  const direct = parseJsonObjectCandidate<Record<string, unknown>>(value);
  const candidate =
    direct ??
    parseJsonObjectCandidate<Record<string, unknown>>(extractFirstJsonObject(value) ?? "");

  if (candidate) {
    const source =
      findObjectWithAnyKeys(candidate, [
        "monitoringSources",
        "communicationMethods",
        "highWindThresholdText",
        "lightningShelterNotes",
        "lightningRadiusMiles",
        "lightningAllClearMinutes",
        "heatTriggerText",
        "coldTriggerText",
        "tornadoStormShelterNotes",
        "unionAccountabilityNotes",
        "dailyReviewNotes",
        "projectOverrideNotes",
        "highWindControls",
        "heatControls",
        "coldControls",
        "tornadoStormControls",
        "environmentalControls",
        "contractorResponsibilityNotes",
      ]) ?? candidate;

    const aliases: Partial<Record<keyof CsepWeatherSectionInput, unknown[]>> = {
      monitoringSources: [source.monitoringSources, source.monitoringSource],
      communicationMethods: [source.communicationMethods, source.communicationMethod],
      highWindThresholdText: [source.highWindThresholdText, source.highWindThreshold, source.highWindRule],
      lightningShelterNotes: [source.lightningShelterNotes, source.lightningShelterNote],
      lightningRadiusMiles: [source.lightningRadiusMiles, source.lightningStopRadiusMiles],
      lightningAllClearMinutes: [source.lightningAllClearMinutes, source.lightningAllClear],
      heatTriggerText: [source.heatTriggerText, source.heatTrigger],
      coldTriggerText: [source.coldTriggerText, source.coldWindChillTrigger, source.coldTrigger],
      tornadoStormShelterNotes: [
        source.tornadoStormShelterNotes,
        source.stormShelterNotes,
        source.shelterNotes,
      ],
      unionAccountabilityNotes: [source.unionAccountabilityNotes, source.unionAccountabilityNote],
      dailyReviewNotes: [source.dailyReviewNotes, source.dailyReviewNote],
      projectOverrideNotes: [source.projectOverrideNotes, source.projectOverrideNote],
      highWindControls: [source.highWindControls, source.highWindControl],
      heatControls: [source.heatControls, source.heatControl],
      coldControls: [source.coldControls, source.coldControl],
      tornadoStormControls: [source.tornadoStormControls, source.stormControls, source.controls],
      environmentalControls: [source.environmentalControls, source.environmentalControl],
      contractorResponsibilityNotes: [
        source.contractorResponsibilityNotes,
        source.contractorResponsibilityNote,
      ],
    };

    const normalizedWeather: Partial<CsepWeatherSectionInput> = {};

    (Object.keys(aliases) as Array<keyof CsepWeatherSectionInput>).forEach((key) => {
      const normalizedValue = aliases[key]
        ?.map((entry) => normalizeWeatherSectionField(key, entry))
        .find((entry) =>
          Array.isArray(entry)
            ? entry.length > 0
            : typeof entry === "number"
              ? Number.isFinite(entry)
              : typeof entry === "string"
                ? entry.length > 0
                : entry !== undefined
        );

      if (normalizedValue !== undefined) {
        (normalizedWeather as Partial<Record<keyof CsepWeatherSectionInput, unknown>>)[key] =
          normalizedValue;
      }
    });

    if (Object.keys(normalizedWeather).length > 0) {
      return normalizedWeather;
    }
  }

  return parseCsepWeatherSectionFromLabeledText(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkdownFormatting(value: string) {
  return value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function normalizeCsepAiTextLayout(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/([^\n])\s+([A-Z][A-Za-z0-9/&(),'\- ]{2,80}:)(?=\s*[-*•]\s+)/g, "$1\n\n$2")
    .replace(/([^\n])\s+([-*•]\s+)/g, "$1\n$2")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseCsepAiTextResponse(value: string, title?: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:text|markdown)?\s*([\s\S]*?)\s*```/i);
  let candidate = stripMarkdownFormatting(fencedMatch?.[1]?.trim() ?? trimmed).trim();

  if (title) {
    const lines = candidate.split(/\r?\n/);
    if (lines.length > 1) {
      const headingPattern = new RegExp(`^(?:#{1,6}\\s*)?${escapeRegExp(title)}\\s*:?\\s*$`, "i");
      if (headingPattern.test(lines[0].trim())) {
        candidate = lines.slice(1).join("\n").trim();
      }
    }

    candidate = candidate.replace(
      new RegExp(`^(?:#{1,6}\\s*)?${escapeRegExp(title)}\\s*:\\s*`, "i"),
      ""
    );
  }

  return normalizeCsepAiTextLayout(candidate) || null;
}

function formatPromptList(items: string[], fallback: string) {
  return items.length ? items.join(", ") : fallback;
}

function stringifyCurrentSectionValue(value: string | CsepWeatherSectionInput | undefined) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return "";
}

export function buildCsepBuilderAiPrompt(params: CsepBuilderAiPromptParams) {
  const config = getCsepBuilderAiSectionConfig(params.sectionId);
  const currentValue = stringifyCurrentSectionValue(params.currentValue);

  if (config.kind === "weather") {
    return [
      `Draft the full ${config.title} portion of the Construction Safety & Environmental Plan.`,
      "Selected tasks are the primary drafting anchor. Mention broader trade, hazard, permit, PPE, and project context only when it directly supports those selected tasks.",
      "Return only valid JSON with this exact shape:",
      JSON.stringify(
        {
          monitoringSources: ["string"],
          communicationMethods: ["string"],
          highWindThresholdText: "string",
          lightningShelterNotes: "string",
          lightningRadiusMiles: 20,
          lightningAllClearMinutes: 30,
          heatTriggerText: "string",
          coldTriggerText: "string",
          tornadoStormShelterNotes: "string",
          unionAccountabilityNotes: "string",
          dailyReviewNotes: "string",
          projectOverrideNotes: ["string"],
          highWindControls: ["string"],
          heatControls: ["string"],
          coldControls: ["string"],
          tornadoStormControls: ["string"],
          environmentalControls: ["string"],
          contractorResponsibilityNotes: ["string"],
        },
        null,
        0
      ),
      "Do not include markdown fences, labels, or explanatory text before or after the JSON object.",
      "Use concise field-ready language. Keep list fields to short practical items and use numeric values for lightning radius miles and all-clear minutes.",
      config.draftingFocus,
      `Selected tasks: ${formatPromptList(params.context.tasks, "None provided")}.`,
      `Selected hazards: ${formatPromptList(params.context.selected_hazards, "None selected")}.`,
      `Permits: ${formatPromptList(params.context.selected_permits, "None selected")}.`,
      `Required PPE: ${formatPromptList(params.context.required_ppe, "None selected")}.`,
      `Trade / sub-trade: ${params.context.trade || "Not set"} / ${params.context.subTrade || "Not set"}.`,
      `Jurisdiction: ${params.context.governing_state || "Not set"}. Contractor: ${params.context.contractor_company || "Not set"}.`,
      currentValue
        ? `Refine or expand these current weather inputs while preserving project-specific details that still fit the selected tasks:\n${currentValue}`
        : "Generate a strong first draft for blank weather overlay fields.",
    ].join("\n\n");
  }

  return [
    `Draft the ${config.title} section of the Construction Safety & Environmental Plan.`,
    "Selected tasks are the primary drafting anchor. Mention broader trade, hazard, permit, PPE, and project context only when it directly supports those selected tasks.",
    "Return only the finished section text. Do not include markdown fences, labels, or commentary before or after the section.",
    "Write one cohesive plain-text section. Do not use markdown bold, repeated section titles, or inline patterns like `Heading: - bullet - bullet`.",
    "Use concise field-ready language with short paragraphs or simple bullet lists only when the whole response is truly a list.",
    config.draftingFocus,
    `Selected tasks: ${formatPromptList(params.context.tasks, "None provided")}.`,
    `Selected hazards: ${formatPromptList(params.context.selected_hazards, "None selected")}.`,
    `Permits: ${formatPromptList(params.context.selected_permits, "None selected")}.`,
    `Required PPE: ${formatPromptList(params.context.required_ppe, "None selected")}.`,
    `Trade / sub-trade: ${params.context.trade || "Not set"} / ${params.context.subTrade || "Not set"}.`,
    `Jurisdiction: ${params.context.governing_state || "Not set"}. Project: ${params.context.project_name || "Not set"}. Contractor: ${params.context.contractor_company || "Not set"}.`,
    currentValue
      ? `Refine or expand this current ${config.title} draft while preserving project-specific details that still fit the selected tasks:\n${currentValue}`
      : `Generate a strong first draft for a blank ${config.title} section.`,
  ].join("\n\n");
}

export function getCsepFormatDefinition(key: CsepFormatEntryKey) {
  return CSEP_FORMAT_DEFINITION_BY_KEY[key];
}

export function getDefaultSelectedCsepFormatSectionKeys() {
  return [...CSEP_FORMAT_SECTION_KEYS];
}

export function resolveSelectedCsepFormatSectionKeys(params: {
  selectedFormatSections?: unknown;
  includedSections?: unknown;
  includedContent?: unknown;
}) {
  const keys = new Set<CsepFormatSectionKey>();

  if (Array.isArray(params.selectedFormatSections)) {
    params.selectedFormatSections.forEach((value) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if ((CSEP_FORMAT_SECTION_KEYS as readonly string[]).includes(trimmed)) {
        keys.add(trimmed as CsepFormatSectionKey);
      }
    });
  }

  const legacyBlockKeys = normalizeSelectedCsepBlockKeys({
    includedSections: params.includedSections,
    includedContent: params.includedContent,
  });

  if (legacyBlockKeys.length > 0) {
    FORMAT_SECTION_DEFINITIONS.forEach((definition) => {
      if ((definition.legacyBlockKeys ?? []).some((key) => legacyBlockKeys.includes(key))) {
        keys.add(definition.key);
      }
    });
  }

  return keys.size > 0 ? CSEP_FORMAT_SECTION_KEYS.filter((key) => keys.has(key)) : [...CSEP_FORMAT_SECTION_KEYS];
}

export function buildLegacyIncludedSectionLabelsFromFormatSections(
  selectedFormatSectionKeys: readonly CsepFormatSectionKey[]
) {
  const blockKeys = new Set<CsepBuilderBlockKey>();

  selectedFormatSectionKeys.forEach((sectionKey) => {
    (CSEP_FORMAT_SECTION_TO_BLOCK_KEYS[sectionKey] ?? []).forEach((blockKey) => blockKeys.add(blockKey));
  });

  return CSEP_BUILDER_BLOCK_OPTIONS.filter((option) => blockKeys.has(option.key)).map((option) => option.label);
}

export function buildDefaultCsepDocumentControlFields(
  snapshot?: Record<string, unknown> | null
): CsepDocumentControlFields {
  const read = (key: string) => (typeof snapshot?.[key] === "string" ? String(snapshot[key]).trim() : "");
  const normalizePartyList = (value: string) =>
    value
      .replace(/\r\n?/g, "\n")
      .split(/\n|;/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, items) => items.indexOf(item) === index)
      .join("; ");

  return {
    projectSite: read("project_site") || read("project_name"),
    primeContractor: read("prime_contractor") || read("contractor_company"),
    clientOwner: normalizePartyList(read("client_owner") || read("owner_client")),
    documentNumber: read("document_number") || read("project_number"),
    revision: read("document_revision") || "1.0",
    issueDate: read("issue_date"),
    preparedBy: read("prepared_by") || read("contractor_contact"),
    reviewedBy: read("reviewed_by"),
    approvedBy: read("approved_by"),
  };
}

type CsepCoverageAuditInput = {
  selectedFormatSectionKeys?: readonly CsepFormatSectionKey[];
  selectedHazards?: readonly string[];
  selectedPermits?: readonly string[];
  requiredPpe?: readonly string[];
  tasks?: readonly string[];
  governingState?: string | null;
  commonOverlappingTrades?: readonly string[];
  programTitles?: readonly string[];
};

export function buildCsepCoverageAudit(input: CsepCoverageAuditInput): CsepCoverageAudit {
  const selectedSections = new Set(input.selectedFormatSectionKeys ?? CSEP_FORMAT_SECTION_KEYS);
  const findings: CsepCoverageAuditFinding[] = [];
  const lowerHazards = (input.selectedHazards ?? []).map((item) => item.toLowerCase());

  const pushFinding = (finding: CsepCoverageAuditFinding) => {
    if (findings.some((entry) => entry.key === finding.key)) return;
    findings.push(finding);
  };

  if ((input.tasks?.length ?? 0) > 0 && !selectedSections.has("project_scope_and_trade_specific_activities")) {
    pushFinding({
      key: "project_scope_required",
      severity: "required",
      title: "Project scope coverage missing",
      detail: "Selected tasks require the project scope section so work phases, interfaces, and high-risk activity callouts are visible.",
      sectionKey: "project_scope_and_trade_specific_activities",
    });
  }

  if ((input.selectedPermits?.length ?? 0) > 0 && !selectedSections.has("permits_and_forms")) {
    pushFinding({
      key: "permits_library_required",
      severity: "required",
      title: "Permit library coverage missing",
      detail: "Selected permits should be surfaced in Section 16 and cross-referenced into Appendix A.",
      sectionKey: "permits_and_forms",
      appendixKey: "appendix_a_forms_and_permit_library",
    });
  }

  if ((input.requiredPpe?.length ?? 0) > 0 && !selectedSections.has("personal_protective_equipment")) {
    pushFinding({
      key: "ppe_section_missing",
      severity: "warning",
      title: "PPE section not selected",
      detail: "Required PPE is present in the builder inputs, but Section 7 is not available to show quick-reference PPE and inspection guidance.",
      sectionKey: "personal_protective_equipment",
    });
  }

  if ((input.commonOverlappingTrades?.length ?? 0) > 0 && !selectedSections.has("sub_tier_contractor_management")) {
    pushFinding({
      key: "subtier_coordination_gap",
      severity: "warning",
      title: "Trade-interface oversight not visible",
      detail: "Overlapping trade context exists, so Section 14 should stay in the package for coordination and lower-tier oversight language.",
      sectionKey: "sub_tier_contractor_management",
    });
  }

  if (input.governingState?.trim() && !selectedSections.has("regulatory_framework")) {
    pushFinding({
      key: "regulatory_matrix_missing",
      severity: "warning",
      title: "Regulatory framework missing",
      detail: "A governing state was identified, but Section 18 is not available to show state, local, owner, and labor-framework requirements.",
      sectionKey: "regulatory_framework",
    });
  }

  if (lowerHazards.length > 0 && !selectedSections.has("hse_elements_and_site_specific_hazard_analysis")) {
    pushFinding({
      key: "hazard_library_missing",
      severity: "required",
      title: "Hazard analysis library missing",
      detail: "Selected hazards require Section 19 so the formatted CSEP still includes consistent hazard-module coverage.",
      sectionKey: "hse_elements_and_site_specific_hazard_analysis",
    });
  }

  if (
    lowerHazards.some((item) =>
      ["fall", "confined", "electrical", "hot work", "fire", "storm", "weather"].some((token) =>
        item.includes(token)
      )
    ) &&
    !selectedSections.has("emergency_preparedness_and_response")
  ) {
    pushFinding({
      key: "emergency_response_gap",
      severity: "warning",
      title: "Emergency-response tie-in recommended",
      detail: "The active hazard profile suggests Section 6 should stay visible for rescue, evacuation, and emergency-response tie-ins.",
      sectionKey: "emergency_preparedness_and_response",
      appendixKey: "appendix_d_field_references_maps_and_contact_inserts",
    });
  }

  if ((input.programTitles?.length ?? 0) > 0 && !selectedSections.has("checklists_and_inspections")) {
    pushFinding({
      key: "checklist_reference_gap",
      severity: "info",
      title: "Checklist appendix can strengthen program enforcement",
      detail: "Triggered programs were found. Section 17 and Appendix C can hold inspection/checklist references without crowding the body pages.",
      sectionKey: "checklists_and_inspections",
      appendixKey: "appendix_c_checklists_and_inspection_sheets",
    });
  }

  return {
    findings,
    unresolvedRequiredCount: findings.filter((finding) => finding.severity === "required").length,
    unresolvedWarningCount: findings.filter((finding) => finding.severity === "warning").length,
  };
}

export function hasBlockingCsepCoverageAudit(
  audit: CsepCoverageAudit | null | undefined
) {
  if (!audit) return false;
  if (audit.unresolvedRequiredCount > 0) return true;
  return audit.findings.some((finding) => finding.severity === "required");
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripExistingNumberPrefix(value: string) {
  return value
    .replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "")
    .replace(/^(Appendix\s+[A-Z])\.?\s+/i, "")
    .trim();
}

const NORMALIZED_FORMAT_SECTION_KEY_LOOKUP = Object.fromEntries(
  CSEP_FORMAT_SECTION_KEYS.map((key) => [normalizeToken(key), key])
) as Record<string, CsepFormatSectionKey>;

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

const PROJECT_SCOPE_SUMMARY_BY_TITLE: Record<string, string> = {
  "unload steel": "Receive, inspect, and safely offload delivered steel members and materials.",
  "sort members": "Organize steel by type, mark, sequence, and installation priority.",
  rigging: "Select, inspect, and use rigging gear to safely lift and position materials.",
  "crane picks": "Plan and execute crane lifts with controlled paths, communication, and exclusion zones.",
  "column erection": "Set, align, and stabilize structural columns during initial steel installation.",
  "beam setting": "Lift and place beams into position for connection and structural framing progress.",
  bolting: "Install and tighten structural bolts to required connection standards.",
  welding: "Perform structural welding in accordance with approved procedures and safety controls.",
  "decking install": "Place and secure metal decking to support floors and roof assemblies.",
  embeds: "Install or coordinate embedded items needed for structural or follow-on trade work.",
  "punch list": "Identify and correct incomplete, damaged, or nonconforming work before closeout.",
  "fire protection": "Install, modify, or coordinate fire protection systems and related components.",
  "general conditions / site management":
    "Manage site logistics, access, housekeeping, coordination, and overall field control.",
  "hvac / mechanical": "Install or support mechanical systems, ductwork, piping, and equipment work.",
  "painting / coatings":
    "Apply protective or finish coatings with proper prep, ventilation, and surface control.",
  "welding / hot work":
    "Perform cutting, welding, or spark-producing work under permit and fire-watch controls.",
};

function projectScopeFieldSummary(label: string, value: string) {
  const normalizedLabel = normalizeToken(label);
  const normalizedValue = (value ?? "").trim();
  const isPlaceholder = /tbd by contractor before issue/i.test(normalizedValue);

  if (normalizedLabel.includes("project name")) {
    return isPlaceholder
      ? "Placeholder for the final project name to be confirmed before release."
      : `Identifies the project name for this contractor CSEP as ${normalizedValue}.`;
  }
  if (normalizedLabel.includes("project number")) {
    return isPlaceholder
      ? "Placeholder for the project number to be added before issue."
      : `Identifies the project number for this contractor CSEP as ${normalizedValue}.`;
  }
  if (normalizedLabel.includes("project address") || normalizedLabel.includes("project site")) {
    return isPlaceholder
      ? "Placeholder for the site address to be completed before issue."
      : `Identifies the project site or address for this contractor CSEP as ${normalizedValue}.`;
  }
  if (normalizedLabel.includes("owner") || normalizedLabel.includes("client")) {
    return isPlaceholder
      ? "Placeholder for the owner or client name before final issue."
      : `Identifies the owner or client for this contractor CSEP as ${normalizedValue}.`;
  }
  if (normalizedLabel.includes("gc") || normalizedLabel.includes("cm")) {
    return isPlaceholder
      ? "Placeholder for the general contractor or construction manager name before issue."
      : `Identifies the general contractor or construction manager for this project as ${normalizedValue}.`;
  }
  if (normalizedLabel.includes("governing state")) {
    return normalizedValue
      ? `Indicates ${normalizedValue} is the governing state for this project's requirements.`
      : "Indicates the governing state that controls the project requirements.";
  }

  return normalizedValue
    ? `${label} is recorded for this project as ${normalizedValue}.`
    : `${label} should be confirmed before the CSEP is issued.`;
}

function summarizeProjectScopeEntry(title: string, value?: string | null) {
  const normalizedTitle = normalizeToken(title);
  if (!normalizedTitle) return null;

  if (PROJECT_SCOPE_SUMMARY_BY_TITLE[normalizedTitle]) {
    return PROJECT_SCOPE_SUMMARY_BY_TITLE[normalizedTitle];
  }

  if (value !== undefined && value !== null) {
    return projectScopeFieldSummary(title, value);
  }

  return `${title} is part of the contractor's active work scope and should be clearly defined for field execution.`;
}

function buildProjectScopeSummarySubsections(params: {
  bullets: string[];
  table: GeneratedSafetyPlanSection["table"] | null;
}) {
  const subsections: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
  const seen = new Set<string>();

  const pushSubsection = (title: string, summary: string | null | undefined) => {
    const cleanTitle = title.trim();
    const cleanSummary = summary?.trim();
    if (!cleanTitle || !cleanSummary) return;
    const key = `${normalizeToken(cleanTitle)}::${normalizeToken(cleanSummary)}`;
    if (seen.has(key)) return;
    seen.add(key);
    subsections.push({
      title: cleanTitle,
      body: cleanSummary,
      bullets: [],
    });
  };

  params.bullets.forEach((item) => {
    const fieldMatch = item.match(/^Field:\s*(.+?)\s+Value:\s*(.+)$/i);
    if (fieldMatch) {
      const label = fieldMatch[1]?.trim() || "Project field";
      const value = fieldMatch[2]?.trim() || "";
      pushSubsection(label, summarizeProjectScopeEntry(label, value));
      return;
    }

    const title = stripExistingNumberPrefix(item).trim();
    pushSubsection(title, summarizeProjectScopeEntry(title));
  });

  params.table?.rows.forEach((row) => {
    const label = row[0]?.trim() || "Project field";
    const value = row[1]?.trim() || "";
    pushSubsection(label, summarizeProjectScopeEntry(label, value));
  });

  return subsections;
}

function isDuplicateStructuredText(
  candidate: string | null | undefined,
  values: readonly (string | null | undefined)[]
) {
  const normalizedCandidate = normalizeToken(candidate);
  if (!normalizedCandidate) return false;

  return values.some((value) => normalizeToken(value) === normalizedCandidate);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sectionTextParts(section: GeneratedSafetyPlanSection) {
  return uniqueNonEmpty([
    section.summary ?? null,
    section.body ?? null,
    ...(section.bullets ?? []),
    ...((section.subsections ?? []).flatMap((subsection) => [
      subsection.title,
      subsection.body ?? null,
      ...subsection.bullets,
    ]) as string[]),
  ]);
}

function isCatalogProgramSection(section: GeneratedSafetyPlanSection) {
  return section.key.startsWith("program_");
}

function buildGroupedProgramSubsection(
  section: GeneratedSafetyPlanSection
): NonNullable<GeneratedSafetyPlanSection["subsections"]>[number] | null {
  const bullets = uniqueNonEmpty(
    (section.subsections ?? []).map((subsection) => {
      const content = uniqueNonEmpty([subsection.body ?? null, ...subsection.bullets]).join(" ");
      if (!content) return null;
      return `${subsection.title}: ${content}`;
    })
  );

  const body = uniqueNonEmpty([section.summary ?? null, section.body ?? null]).join(" ") || undefined;

  if (!body && bullets.length === 0) return null;

  return {
    title: section.title,
    body,
    bullets,
  };
}

function fallbackSectionBody(definition: CsepFormatSectionDefinition) {
  return definition.purpose ? cleanFinalText(definition.purpose) : null;
}

function inferFormatSectionKey(section: GeneratedSafetyPlanSection): CsepFormatSectionKey {
  const keyToken = normalizeToken(section.key);
  const titleToken = normalizeToken(section.title);
  const combined = `${keyToken} ${titleToken}`;

  if (NORMALIZED_FORMAT_SECTION_KEY_LOOKUP[keyToken]) {
    return NORMALIZED_FORMAT_SECTION_KEY_LOOKUP[keyToken];
  }

  if (combined.includes("role") || combined.includes("competent person")) return "roles_and_responsibilities";
  if (combined.includes("company overview") || combined.includes("safety philosophy")) {
    return "company_overview_and_safety_philosophy";
  }
  if (combined.includes("security") || combined.includes("access")) return "security_and_access_control";
  if (
    combined.includes("incident") ||
    combined.includes("drug") ||
    combined.includes("wellness") ||
    combined.includes("corrective")
  ) {
    return "contractor_iipp";
  }
  if (combined.includes("meeting") || combined.includes("engagement") || combined.includes("toolbox")) {
    return "contractor_safety_meetings_and_engagement";
  }
  if (combined.includes("audit") || combined.includes("monitoring") || combined.includes("reporting")) {
    return "contractor_monitoring_audits_and_reporting";
  }
  if (combined.includes("sub tier") || combined.includes("subcontract") || combined.includes("lower tier")) {
    return "sub_tier_contractor_management";
  }
  if (combined.includes("close out") || combined.includes("closeout") || combined.includes("demobil")) {
    return "project_close_out";
  }
  if (combined.includes("inspection") || combined.includes("checklist")) {
    return "checklists_and_inspections";
  }
  if (combined.includes("environmental") || combined.includes("stormwater") || combined.includes("spill")) {
    return "environmental_execution_requirements";
  }
  if (
    combined.includes("hazcom") ||
    (combined.includes("hazard") && combined.includes("communication")) ||
    combined.includes("sds") ||
    combined.includes("ghs")
  ) {
    return "hazard_communication_program";
  }
  if (combined.includes("emergency") || combined.includes("evacuation") || combined.includes("rescue")) {
    return "emergency_preparedness_and_response";
  }
  if (
    combined.includes("ppe") ||
    combined.includes("personal protective") ||
    combined.includes("fall protection")
  ) {
    return "personal_protective_equipment";
  }
  if (combined.includes("training") || combined.includes("orientation") || combined.includes("competency")) {
    return "contractor_safety_meetings_and_engagement";
  }
  if (combined.includes("weather") || combined.includes("storm") || combined.includes("lightning")) {
    return "weather_requirements_and_severe_weather_response";
  }
  if (combined.includes("permit")) return "permits_and_forms";
  if (combined.includes("osha") || combined.includes("reference") || combined.includes("regulatory")) {
    return "regulatory_framework";
  }
  if (combined.includes("hazard") || combined.includes("activity hazard") || combined.includes("program")) {
    return "hse_elements_and_site_specific_hazard_analysis";
  }
  if (combined.includes("trade") || combined.includes("scope") || combined.includes("project information")) {
    return "project_scope_and_trade_specific_activities";
  }
  if (combined.includes("contractor information") || combined.includes("policy")) {
    return "company_overview_and_safety_philosophy";
  }

  return "safe_work_practices_and_trade_specific_procedures";
}

function buildStaticFrontMatterSections(
  draft: GeneratedSafetyPlanDraft,
  selectedFormatSectionKeys: readonly CsepFormatSectionKey[]
): GeneratedSafetyPlanSection[] {
  const aiAssemblyDecisions = draft.aiAssemblyDecisions ?? null;

  const definitionsTable = {
    columns: ["Term / Abbreviation", "Definition / Intended Use"],
    rows: [
      ["CBA", "Collective bargaining or labor-agreement language that may add project-specific safety expectations."],
      ["CM/GC", "Construction manager / general contractor responsible for project-level coordination."],
      ["Competent Person", "Qualified individual designated to identify hazards and take prompt corrective action."],
      ["IIPP", "Injury and Illness Prevention Program requirements carried through this contractor package."],
      ["JHA / PTP", "Job hazard analysis / pre-task planning tool used for activity-specific risk review."],
    ],
  };

  const formatSections = selectedFormatSectionKeys
    .map((key) => getCsepFormatDefinition(key))
    .filter(Boolean);

  return [
    {
      key: "table_of_contents",
      kind: "front_matter",
      order: 0,
      title: "Table of Contents",
      layoutKey: "table_of_contents",
      bullets: formatSections.map((section) => section.title),
    },
    {
      key: "plan_use_guidance",
      kind: "front_matter",
      order: 1,
      title: "How to Use This Plan",
      layoutKey: "plan_use_guidance",
      body: cleanFinalText(aiAssemblyDecisions?.frontMatterGuidance) ?? "Use this plan as the field execution reference for the selected contractor scope and supporting attachments.",
    },
    {
      key: "definitions_and_abbreviations",
      kind: "front_matter",
      order: 2,
      title: "Definitions and Abbreviations",
      layoutKey: "definitions_and_abbreviations",
      table: definitionsTable,
    },
  ];
}

function buildDocumentControlRevisionEndSection(
  draft: GeneratedSafetyPlanDraft
): GeneratedSafetyPlanSection {
  const builderSnapshot = asRecord(draft.builderSnapshot) ?? {};
  const documentControl = {
    ...buildDefaultCsepDocumentControlFields(builderSnapshot),
    ...(draft.documentControl ?? {}),
  };
  const displayOrNA = (value: string | null | undefined) => cleanFinalText(value) ?? "N/A";
  const projectSite =
    cleanFinalText(documentControl.projectSite) ??
    cleanFinalText(draft.projectOverview.projectName) ??
    "N/A";
  const primeContractor =
    cleanFinalText(documentControl.primeContractor) ??
    cleanFinalText(draft.projectOverview.contractorCompany) ??
    "N/A";
  const clientOwner =
    cleanFinalText(documentControl.clientOwner) ??
    cleanFinalText(draft.projectOverview.ownerClient) ??
    "N/A";
  const currentIssueLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const preparedByLabel =
    cleanFinalText(documentControl.preparedBy) ??
    cleanFinalText(draft.projectOverview.contractorCompany) ??
    "Authorized Contractor Representative";
  const reviewedByLabel =
    cleanFinalText(documentControl.reviewedBy) ?? preparedByLabel;
  const approvedByLabel =
    cleanFinalText(documentControl.approvedBy) ??
    reviewedByLabel ??
    cleanFinalText(draft.projectOverview.contractorCompany) ??
    preparedByLabel;

  return {
    key: "document_control_and_revision_history",
    kind: "appendix",
    order: 39,
    numberLabel: "15",
    title: "15. Document Control and Revision History",
    layoutKey: "document_control_and_revision_history",
    body:
      "Current issue control, revision status, and approval record for this issued CSEP package.",
    table: {
      columns: ["Field", "Value"],
      rows: [
        ["Project Name / Site", displayOrNA(projectSite)],
        ["Prime / Contractor", displayOrNA(primeContractor)],
        ["Client / Owner", displayOrNA(clientOwner)],
        ["Document Number", displayOrNA(documentControl.documentNumber)],
        ["Revision", displayOrNA(documentControl.revision || "1.0")],
        ["Issue Date", displayOrNA(documentControl.issueDate || currentIssueLabel)],
        ["Prepared By", displayOrNA(preparedByLabel)],
        ["Reviewed By", displayOrNA(reviewedByLabel)],
        ["Approved By", displayOrNA(approvedByLabel)],
        ["Revision Summary", "Initial issuance for contractor CSEP export"],
      ],
    },
  };
}

function buildOperationalQuickReferenceSubsections(): NonNullable<GeneratedSafetyPlanSection["subsections"]> {
  return [
    {
      title: "Incident Overview",
      body: "Use these incident categories to align field notifications, scene control, and escalation requirements before restart.",
      bullets: [],
    },
    {
      title: "First Aid",
      body: [
        "Example: Minor first-aid-only case with no property damage or release.",
        "Required Actions / Notifications: Notify the foreman or supervision, document the event, and confirm any immediate corrective actions.",
      ].join("\n\n"),
      bullets: [],
    },
    {
      title: "Near Miss",
      body: [
        "Example: No injury, no release, and no loss event.",
        "Required Actions / Notifications: Report to supervision and capture corrective actions before restart.",
      ].join("\n\n"),
      bullets: [],
    },
    {
      title: "Recordable",
      body: [
        "Example: OSHA recordable injury, illness, or exposure.",
        "Required Actions / Notifications: Notify supervision, safety, and required project contacts immediately.",
      ].join("\n\n"),
      bullets: [],
    },
    {
      title: "Serious / Major",
      body: [
        "Example: Hospitalization, major property loss, permit breach, or severe environmental event.",
        "Required Actions / Notifications: Activate the escalation chain, preserve the scene, and begin a formal investigation.",
      ].join("\n\n"),
      bullets: [],
    },
    {
      title: "Life-Saving Rules",
      body: "Stop-work authority and life-saving expectations apply whenever conditions defeat the planned controls.",
      bullets: [
        "Work Stoppage: Stop work when fall protection, access, or rescue conditions are not in place.",
        "Permit and Authorization Control: Do not bypass permit, energy-isolation, or authorization requirements.",
        "Line-of-Fire and Struck-By Prevention: Stay clear of line-of-fire, suspended-load, and struck-by exposure zones.",
        "Emergency Response and Evacuation: Use emergency response, shelter, and evacuation procedures immediately when triggers are met.",
      ],
    },
  ];
}

function hasLaydownAreaNeed(
  draft: GeneratedSafetyPlanDraft,
  builderSnapshot: Record<string, unknown>
) {
  const scopeSignals = [
    draft.projectOverview.contractorCompany,
    draft.projectOverview.ownerClient,
    draft.projectOverview.gcCm,
    typeof builderSnapshot.scope_of_work === "string" ? String(builderSnapshot.scope_of_work) : "",
    typeof builderSnapshot.site_specific_notes === "string" ? String(builderSnapshot.site_specific_notes) : "",
    typeof builderSnapshot.trade === "string" ? String(builderSnapshot.trade) : "",
    typeof builderSnapshot.subTrade === "string" ? String(builderSnapshot.subTrade) : "",
    ...draft.operations.flatMap((operation) => [
      operation.tradeLabel ?? "",
      operation.subTradeLabel ?? "",
      operation.taskTitle ?? "",
      ...(operation.equipmentUsed ?? []),
      ...(operation.workConditions ?? []),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return /material delivery|delivery|unloading|storage|staging|laydown|crane pick|crane|rigging|prefabricated|prefab|assembly|steel|decking|piping|duct|scaffold|scaffolds|pallet|waste staging|material area|receiving|offload|hoist|erection/.test(
    scopeSignals
  );
}

function buildSecurityLogisticsSubsections(
  draft: GeneratedSafetyPlanDraft,
  builderSnapshot: Record<string, unknown>
): NonNullable<GeneratedSafetyPlanSection["subsections"]> {
  if (!hasLaydownAreaNeed(draft, builderSnapshot)) {
    return [];
  }

  return [
    {
      title: "Site Access",
      body:
        "This project-wide logistics section establishes how site-access paths are set, maintained, adjusted, and released as deliveries and field conditions change.",
      bullets: [
        "Control delivery entry, worker access points, pedestrian routes, and equipment approach paths so unloading, staging, and retrieval activities do not conflict with active work fronts or emergency access.",
      ],
    },
    {
      title: "Laydown Area Management",
      body:
        "This project-wide logistics section defines how laydown areas are established, organized, isolated, maintained, inspected, and released.",
      bullets: [
        "Laydown areas shall be established only in approved locations.",
        "The area shall support the planned delivery route, crane reach, erection sequence, and safe pedestrian separation.",
        "Ground or slab conditions shall be verified before material is staged.",
        "Materials shall be stored in a stable, organized manner that prevents rolling, shifting, collapse, or unplanned movement.",
        "Laydown areas shall be kept within defined boundaries using barricades, markings, cones, fencing, or other project-approved controls as needed.",
        "Access to the laydown area shall be limited to authorized personnel involved in unloading, staging, inspection, or material retrieval.",
        "Pedestrian routes, emergency access routes, fire protection equipment, drains, exits, and active work paths shall not be blocked by stored material.",
        "Material stacks shall be organized by type, sequence, size, or installation order to reduce double handling and congestion.",
        "Damaged, rejected, or suspect materials shall be segregated from accepted material.",
        "Housekeeping shall be maintained at all times; dunnage, banding, debris, and scrap shall be removed or contained.",
        "The laydown area shall be reviewed when weather, ground conditions, delivery volume, or adjacent operations change.",
        "Where overhead work, crane activity, or moving equipment creates exposure, the laydown area shall include exclusion controls and spotter support as required.",
        "Flammable, chemical, or specialty materials shall be stored in accordance with project and manufacturer requirements and not mixed into general laydown without approval.",
        "End-of-shift controls shall ensure materials, tools, and access points are left in a stable and secure condition.",
      ],
    },
    {
      title: "Traffic Control",
      body:
        "This project-wide logistics section establishes how internal traffic control is maintained around delivery, unloading, staging, and retrieval operations.",
      bullets: [
        "Use project-approved route controls, spotters, unloading plans, and boundary protection whenever moving equipment, delivery vehicles, crane support equipment, or retrieval traffic can affect workers, pedestrians, or adjacent operations.",
      ],
    },
  ];
}

function buildAppendixLibrarySections(
  draft: GeneratedSafetyPlanDraft
): GeneratedSafetyPlanSection[] {
  const hazardTitles = uniqueNonEmpty(draft.sectionMap.map((section) => section.title).filter((title) => /hazard|program/i.test(title)));
  const attachmentSections: GeneratedSafetyPlanSection[] = APPENDIX_DEFINITIONS.map((definition) => {
    const appendixRows =
      definition.key === "appendix_a_forms_and_permit_library"
        ? [
            ["Incident Forms", "Worker first report, supervisor review, and event documentation inserts."],
            ["Planning Forms", "Daily JHA / pre-task planning, lift planning, and activity support tools."],
            ["Permit Library", "Permit templates are referenced here so the main body can stay layout-stable."],
            ["Project-Specific Inserts", "Owner / client administrative forms and local document inserts."],
          ]
        : definition.key === "appendix_b_incident_and_investigation_package"
          ? [
              [
                "Appendix B.1 Immediate Notification and Scene Control",
                "Initial notification, emergency contacts, scene stabilization, responder access, and immediate escalation steps.",
              ],
              [
                "Appendix B.2 Initial Incident Report",
                "First report of injury, illness, property damage, near miss, or significant safety event.",
              ],
              [
                "Appendix B.3 Supervisor Investigation Report",
                "Supervisor fact gathering, event timeline, site conditions, witness capture, and immediate control actions.",
              ],
              [
                "Appendix B.4 Witness Statements",
                "Written witness accounts, involved-person statements, and supporting narrative documentation.",
              ],
              [
                "Appendix B.5 Photo, Sketch, and Evidence Log",
                "Scene photos, sketches, equipment identification, location records, and preserved evidence tracking.",
              ],
              [
                "Appendix B.6 Root Cause and Corrective Action Tracking",
                "Root-cause analysis, corrective actions, assigned ownership, due dates, and closure verification.",
              ],
              [
                "Appendix B.7 Medical Treatment / Clinic Routing",
                "Clinic directions, treatment authorization, post-incident medical routing, and work-status documentation.",
              ],
              [
                "Appendix B.8 Post-Incident Review and Closeout",
                "Management review, lessons learned, retraining needs, communication to crews, and formal closeout approval.",
              ],
            ]
          : definition.key === "appendix_c_checklists_and_inspection_sheets"
            ? [
                ["Daily Checklists", "Pre-use, shift-start, and recurring inspection tools."],
                ["Program Inspections", "Hazard-program inspection sheets for active high-risk work."],
                ["Audit Sheets", "Weekly / periodic audit and corrective-action follow-up tools."],
                ["Frequency Notes", "Project-specific trigger and cadence notes."],
              ]
            : [
                ["Emergency Contacts", "Clinic directions, emergency ladder, and owner / GC contact inserts."],
                ["Maps and Routes", "Site maps, shelter locations, access routes, and staging references."],
                ["Quick Inserts", "Field reference cards and worker-facing quick-use pages."],
                ["Specialty References", hazardTitles.join(", ") || "Hazard-module references and project-specific field aids."],
              ];

    return {
      key: definition.key,
      kind: "appendix" as const,
      order: definition.order,
      title: definition.title,
      numberLabel: definition.numberLabel,
      parentSectionKey: "appendices_and_support_library",
      appendixKey: definition.key,
      layoutKey: "appendix_library",
      body: cleanFinalText(definition.purpose) ?? fallbackSectionBody(definition) ?? undefined,
      table: {
        columns: ["Library Area", "Intended Use"],
        rows: appendixRows,
      },
    };
  });

  return [buildDocumentControlRevisionEndSection(draft), ...attachmentSections];
}

function applyAiAssemblyDecisionsToStructuredSections(
  sectionMap: GeneratedSafetyPlanSection[],
  aiAssemblyDecisions: GeneratedSafetyPlanDraft["aiAssemblyDecisions"],
  options?: { finalIssueMode?: boolean }
) {
  if (!aiAssemblyDecisions || options?.finalIssueMode) {
    return sectionMap;
  }

  return sectionMap.map((section) => {
    if (section.key === "plan_use_guidance" && aiAssemblyDecisions.frontMatterGuidance?.trim()) {
      return {
        ...section,
        body: aiAssemblyDecisions.frontMatterGuidance.trim(),
      };
    }

    if (section.kind === "main") {
      const aiSectionDecision = aiAssemblyDecisions.sectionDecisions?.[
        section.layoutKey as CsepFormatSectionKey
      ]?.trim();
      const updatedSubsections = (section.subsections ?? []).map((subsection) =>
        subsection.title === "Required Coverage Callout" && aiAssemblyDecisions.coverageGuidance?.trim()
          ? {
              ...subsection,
              body: aiAssemblyDecisions.coverageGuidance.trim(),
            }
          : subsection
      );

      return {
        ...section,
        body:
          uniqueNonEmpty([aiSectionDecision ?? null, section.body ?? null]).join(" ") ||
          section.body,
        subsections: updatedSubsections.length ? updatedSubsections : section.subsections,
      };
    }

    return section;
  });
}

function hasStructuredContent(section: GeneratedSafetyPlanSection | null | undefined) {
  if (!section) return false;
  return Boolean(
    isMeaningfulFinalText(section.summary) ||
      isMeaningfulFinalText(section.body) ||
      section.bullets?.some((item) => isMeaningfulFinalText(item)) ||
      section.subsections?.some(
        (subsection) =>
          isMeaningfulFinalText(subsection.title) ||
          isMeaningfulFinalText(subsection.body) ||
          subsection.bullets.some((item) => isMeaningfulFinalText(item))
      ) ||
      section.table?.rows.some((row) => row.some((cell) => isMeaningfulFinalText(cell)))
  );
}

export function buildStructuredCsepSectionMap(
  draft: GeneratedSafetyPlanDraft,
  options?: {
    selectedFormatSectionKeys?: readonly CsepFormatSectionKey[];
    finalIssueMode?: boolean;
  }
) {
  const builderSnapshot = asRecord(draft.builderSnapshot) ?? {};
  const resolvedSelectedFormatSectionKeys =
    options?.selectedFormatSectionKeys ??
    resolveSelectedCsepFormatSectionKeys({
      selectedFormatSections: builderSnapshot.selected_format_sections,
      includedSections: builderSnapshot.included_sections,
      includedContent: builderSnapshot.includedContent,
    });
  const selectedFormatSectionSet = new Set<CsepFormatSectionKey>(resolvedSelectedFormatSectionKeys);
  selectedFormatSectionSet.add("appendices_and_support_library");
  const selectedFormatSectionKeys = CSEP_FORMAT_SECTION_KEYS.filter((key) =>
    selectedFormatSectionSet.has(key)
  );
  const grouped = new Map<CsepFormatSectionKey, GeneratedSafetyPlanSection[]>();

  draft.sectionMap
    .filter((section) => section.kind !== "front_matter" && section.kind !== "appendix")
    .forEach((section) => {
      const formatKey = inferFormatSectionKey(section);
      if (!grouped.has(formatKey)) {
        grouped.set(formatKey, []);
      }
      grouped.get(formatKey)!.push(section);
    });

  const programTitles = draft.sectionMap
    .map((section) => section.title)
    .filter((title) => /program|inspection|permit|hazard/i.test(title));
  const commonOverlappingTrades = toStringList(builderSnapshot.common_overlapping_trades);
  const coverageAudit = buildCsepCoverageAudit({
    selectedFormatSectionKeys,
    selectedHazards: draft.ruleSummary.hazardCategories,
    selectedPermits: draft.ruleSummary.permitTriggers,
    requiredPpe: draft.ruleSummary.ppeRequirements,
    tasks: draft.operations.map((operation) => operation.taskTitle),
    governingState:
      typeof draft.provenance.governingState === "string" ? String(draft.provenance.governingState) : null,
    commonOverlappingTrades,
    programTitles,
  });
  const findingsBySection = new Map<CsepFormatEntryKey, CsepCoverageAuditFinding[]>();
  const aiAssemblyDecisions = options?.finalIssueMode ? null : draft.aiAssemblyDecisions ?? null;

  coverageAudit.findings.forEach((finding) => {
    if (!finding.sectionKey) return;
    if (!findingsBySection.has(finding.sectionKey)) {
      findingsBySection.set(finding.sectionKey, []);
    }
    findingsBySection.get(finding.sectionKey)!.push(finding);
  });

  const frontMatterSections = buildStaticFrontMatterSections(draft, selectedFormatSectionKeys);
  const mainSections: Array<GeneratedSafetyPlanSection | null> = selectedFormatSectionKeys.map((sectionKey) => {
    if (options?.finalIssueMode && sectionKey === "appendices_and_support_library") {
      return null;
    }

    const definition = getCsepFormatDefinition(sectionKey);
    const sourceSections = grouped.get(sectionKey) ?? [];
    const programSourceSections = sourceSections.filter((section) => isCatalogProgramSection(section));
    const narrativeSourceSections =
      programSourceSections.length > 0
        ? sourceSections.filter((section) => !isCatalogProgramSection(section))
        : sourceSections;
    const combinedBullets = uniqueNonEmpty(
      narrativeSourceSections.flatMap((section) => section.bullets ?? [])
    );
    const combinedSubsections = [
      ...narrativeSourceSections.flatMap((section) => section.subsections ?? []),
      ...programSourceSections
        .map((section) => buildGroupedProgramSubsection(section))
        .filter(
          (
            subsection
          ): subsection is NonNullable<GeneratedSafetyPlanSection["subsections"]>[number] =>
            Boolean(subsection)
        ),
    ];
    const combinedTables = sourceSections.map((section) => section.table).find((table) => table?.rows.length) ?? null;
    const narrativeParts = uniqueNonEmpty(
      narrativeSourceSections.flatMap((section) => sectionTextParts(section))
    );
    const relatedFindings = findingsBySection.get(sectionKey) ?? [];
    const aiSectionDecision = aiAssemblyDecisions?.sectionDecisions?.[sectionKey]?.trim() ?? null;
    const fallbackBody = options?.finalIssueMode ? null : fallbackSectionBody(definition);
    const permitBullets =
      sectionKey === "permits_and_forms"
        ? normalizePermitList([
            ...draft.ruleSummary.permitTriggers,
            ...combinedBullets,
          ])
        : combinedBullets;
    const projectScopeSummarySubsections =
      sectionKey === "project_scope_and_trade_specific_activities"
        ? buildProjectScopeSummarySubsections({
            bullets: permitBullets,
            table: combinedTables,
          })
        : [];
    const resolvedBody =
      uniqueNonEmpty([
        aiSectionDecision,
        narrativeSourceSections[0]?.summary ?? null,
        narrativeSourceSections[0]?.body ?? null,
        narrativeParts[0] ?? null,
        sourceSections.length === 0 ? fallbackBody : null,
      ]).join(" ") || fallbackBody;
    const body =
      isDuplicateStructuredText(resolvedBody, permitBullets) ? undefined : resolvedBody;

    const emergencyQuickReferenceSubsections =
      sectionKey === "emergency_preparedness_and_response"
        ? buildOperationalQuickReferenceSubsections()
        : [];
    const securityLogisticsSubsections =
      sectionKey === "security_and_access_control"
        ? buildSecurityLogisticsSubsections(draft, builderSnapshot)
        : [];

    const nextSection = {
      key: sectionKey,
      kind: "main" as const,
      order: definition.order,
      title: definition.title,
      numberLabel: definition.numberLabel,
      layoutKey: sectionKey,
      body,
      bullets:
        projectScopeSummarySubsections.length > 0
          ? undefined
          : permitBullets.length
        ? permitBullets
        : relatedFindings.length
          ? relatedFindings.map((finding) => `${finding.title}: ${finding.detail}`)
          : undefined,
      subsections:
        projectScopeSummarySubsections.length ||
        combinedSubsections.length ||
        emergencyQuickReferenceSubsections.length ||
        securityLogisticsSubsections.length ||
        (relatedFindings.length && !options?.finalIssueMode)
          ? [
              ...projectScopeSummarySubsections,
              ...combinedSubsections,
              ...emergencyQuickReferenceSubsections,
              ...securityLogisticsSubsections,
              ...(!options?.finalIssueMode && relatedFindings.length
                ? [
                    {
                      title: "Required Coverage Callout",
                      body:
                        aiAssemblyDecisions?.coverageGuidance ??
                        "The format package identified content that should stay visible in this section based on the current builder inputs.",
                      bullets: relatedFindings.map((finding) => `${finding.title}: ${finding.detail}`),
                    },
                  ]
              : []),
            ]
          : undefined,
      table: projectScopeSummarySubsections.length > 0 ? null : combinedTables,
      parentSectionKey: null,
    } satisfies GeneratedSafetyPlanSection;
    if (
      options?.finalIssueMode &&
      sectionKey === "emergency_preparedness_and_response" &&
      !nextSection.table &&
      !(nextSection.subsections?.length) &&
      !isMeaningfulFinalText(nextSection.body)
    ) {
      return null;
    }

    return nextSection;
  });
  const appendixSections = buildAppendixLibrarySections(draft);
  const presentMainSections = mainSections.filter(
    (section): section is GeneratedSafetyPlanSection => Boolean(section)
  );
  const cleanedSections = options?.finalIssueMode
    ? [...frontMatterSections, ...presentMainSections, ...appendixSections]
        .map((section) => cleanSectionForFinalIssue(section))
        .filter((section): section is GeneratedSafetyPlanSection => Boolean(section))
        .filter((section) => hasStructuredContent(section))
    : [...frontMatterSections, ...presentMainSections, ...appendixSections];

  return {
    sectionMap: cleanedSections,
    coverageAudit,
    documentControl: {
      ...buildDefaultCsepDocumentControlFields(builderSnapshot),
      ...(draft.documentControl ?? {}),
    },
  };
}

export function buildStructuredCsepDraft(
  draft: GeneratedSafetyPlanDraft,
  options?: {
    selectedFormatSectionKeys?: readonly CsepFormatSectionKey[];
    finalIssueMode?: boolean;
  }
): GeneratedSafetyPlanDraft {
  if (
    draft.sectionMap.some((section) => section.kind === "front_matter") &&
    draft.sectionMap.some((section) => section.kind === "appendix") &&
    draft.sectionMap.some((section) => section.kind === "main")
  ) {
    const builderSnapshot = asRecord(draft.builderSnapshot) ?? {};
    const structuredSectionMap = applyAiAssemblyDecisionsToStructuredSections(
      draft.sectionMap,
      draft.aiAssemblyDecisions,
      { finalIssueMode: options?.finalIssueMode }
    );
    const finalSectionMap = options?.finalIssueMode
      ? structuredSectionMap
          .map((section) => cleanSectionForFinalIssue(section))
          .filter((section): section is GeneratedSafetyPlanSection => Boolean(section))
          .filter((section) => hasStructuredContent(section))
      : structuredSectionMap;
    return {
      ...draft,
      sectionMap: finalSectionMap,
      documentControl: draft.documentControl ?? buildDefaultCsepDocumentControlFields(builderSnapshot),
      coverageAudit:
        draft.coverageAudit ??
        buildCsepCoverageAudit({
          selectedFormatSectionKeys:
            options?.selectedFormatSectionKeys ??
            resolveSelectedCsepFormatSectionKeys({
              selectedFormatSections: builderSnapshot.selected_format_sections,
              includedSections: builderSnapshot.included_sections,
              includedContent: builderSnapshot.includedContent,
            }),
          selectedHazards: draft.ruleSummary.hazardCategories,
          selectedPermits: draft.ruleSummary.permitTriggers,
          requiredPpe: draft.ruleSummary.ppeRequirements,
          tasks: draft.operations.map((operation) => operation.taskTitle),
          governingState:
            typeof draft.provenance.governingState === "string"
              ? String(draft.provenance.governingState)
              : null,
          commonOverlappingTrades: toStringList(builderSnapshot.common_overlapping_trades),
          programTitles: draft.sectionMap.map((section) => section.title),
        }),
    };
  }

  const structured = buildStructuredCsepSectionMap(draft, options);
  return {
    ...draft,
    documentControl: structured.documentControl,
    coverageAudit: structured.coverageAudit,
    sectionMap: structured.sectionMap,
  };
}
