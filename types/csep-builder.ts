export const CSEP_BUILDER_BLOCK_KEYS = [
  "scope_of_work",
  "site_specific_notes",
  "project_information",
  "contractor_information",
  "trade_summary",
  "emergency_procedures",
  "hazard_communication",
  "weather_requirements_and_severe_weather_response",
  "required_ppe",
  "additional_permits",
  "common_overlapping_trades",
  "osha_references",
  "selected_hazards",
  "activity_hazard_matrix",
  "roles_and_responsibilities",
  "security_and_access",
  "health_and_wellness",
  "incident_reporting_and_investigation",
  "training_and_instruction",
  "drug_and_alcohol_testing",
  "enforcement_and_corrective_action",
  "recordkeeping",
  "continuous_improvement",
] as const;

export type CsepBuilderBlockKey = (typeof CSEP_BUILDER_BLOCK_KEYS)[number];

export type CsepBuilderBlockValue = string | string[] | null;

export const CSEP_FRONT_MATTER_KEYS = [
  "document_control",
  "revision_history",
  "table_of_contents",
  "plan_use_guidance",
  "definitions_and_abbreviations",
  "incident_overview",
  "life_saving_rules",
] as const;

export const CSEP_FORMAT_SECTION_KEYS = [
  "company_overview_and_safety_philosophy",
  "project_scope_and_trade_specific_activities",
  "roles_and_responsibilities",
  "security_and_access_control",
  "contractor_iipp",
  "emergency_preparedness_and_response",
  "personal_protective_equipment",
  "hazard_communication_program",
  "weather_requirements_and_severe_weather_response",
  "safe_work_practices_and_trade_specific_procedures",
  "environmental_execution_requirements",
  "contractor_monitoring_audits_and_reporting",
  "contractor_safety_meetings_and_engagement",
  "sub_tier_contractor_management",
  "project_close_out",
  "permits_and_forms",
  "hse_elements_and_site_specific_hazard_analysis",
  "checklists_and_inspections",
  "regulatory_framework",
  "appendices_and_support_library",
] as const;

export const CSEP_APPENDIX_KEYS = [
  "appendix_a_forms_and_permit_library",
  "appendix_b_incident_and_investigation_package",
  "appendix_c_checklists_and_inspection_sheets",
  "appendix_d_field_references_maps_and_contact_inserts",
  "appendix_safety_program_reference_pack",
] as const;

export type CsepFrontMatterKey = (typeof CSEP_FRONT_MATTER_KEYS)[number];
export type CsepFormatSectionKey = (typeof CSEP_FORMAT_SECTION_KEYS)[number];
export type CsepAppendixKey = (typeof CSEP_APPENDIX_KEYS)[number];
export type CsepFormatEntryKey = CsepFrontMatterKey | CsepFormatSectionKey | CsepAppendixKey;
export type CsepFormatEntryKind = "front_matter" | "main" | "appendix";
export type CsepCoverageAuditSeverity = "info" | "warning" | "required";

export type CsepWeatherSectionInput = {
  monitoringSources?: string[];
  dailyReviewNotes?: string;
  communicationMethods?: string[];
  highWindThresholdText?: string;
  highWindControls?: string[];
  lightningRadiusMiles?: number | null;
  lightningAllClearMinutes?: number | null;
  lightningShelterNotes?: string;
  heatTriggerText?: string;
  heatControls?: string[];
  coldTriggerText?: string;
  coldControls?: string[];
  tornadoStormShelterNotes?: string;
  tornadoStormControls?: string[];
  environmentalControls?: string[];
  unionAccountabilityNotes?: string;
  projectOverrideNotes?: string[];
  contractorResponsibilityNotes?: string[];
};

export type CsepDocumentControlFields = {
  projectSite?: string | null;
  primeContractor?: string | null;
  clientOwner?: string | null;
  documentNumber?: string | null;
  revision?: string | null;
  issueDate?: string | null;
  preparedBy?: string | null;
  reviewedBy?: string | null;
  approvedBy?: string | null;
};

export type CsepFormatSectionDefinition = {
  key: CsepFormatEntryKey;
  kind: CsepFormatEntryKind;
  order: number;
  title: string;
  shortTitle: string;
  numberLabel?: string | null;
  purpose?: string | null;
  aiEligible: boolean;
  appendixRefs?: CsepAppendixKey[];
  legacyBlockKeys?: CsepBuilderBlockKey[];
};

export type CsepCoverageAuditFinding = {
  key: string;
  severity: CsepCoverageAuditSeverity;
  title: string;
  detail: string;
  sectionKey?: CsepFormatEntryKey | null;
  appendixKey?: CsepAppendixKey | null;
};

export type CsepCoverageAudit = {
  findings: CsepCoverageAuditFinding[];
  unresolvedRequiredCount: number;
  unresolvedWarningCount: number;
};

export type CsepBuilderInstructions = {
  selectedBlockKeys: CsepBuilderBlockKey[];
  selectedFormatSectionKeys?: CsepFormatSectionKey[];
  blockInputs: Partial<Record<CsepBuilderBlockKey, CsepBuilderBlockValue>>;
  documentControl?: Partial<CsepDocumentControlFields>;
  coverageAudit?: CsepCoverageAudit | null;
  builderInputHash: string;
};
