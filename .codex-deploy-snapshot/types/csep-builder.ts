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
  "owner_message",
  "sign_off_page",
  "table_of_contents",
] as const;

export const CSEP_FORMAT_SECTION_KEYS = [
  "purpose",
  "project_coordination_and_authority",
  "scope_of_work_section",
  "regulatory_basis_and_references",
  "top_10_critical_risks",
  "roles_and_responsibilities",
  "trade_interaction_and_coordination",
  "site_access_security_laydown_traffic_control",
  "hazard_communication_and_environmental_protection",
  "emergency_response_and_rescue",
  "iipp_incident_reporting_corrective_action",
  "worker_conduct_fit_for_duty_disciplinary_program",
  "training_competency_and_certifications",
  "required_permits_and_hold_points",
  "ppe_and_work_attire",
  "scope_specific_policy_evidence_summary",
  "high_risk_programs",
  "excavation_trenching_na_or_program_trigger",
  "inspections_audits_and_records",
  "project_closeout",
  "reviewer_codex_readiness_summary",
  "document_control_and_revision_history",
] as const;

export const CSEP_APPENDIX_KEYS = [
  "appendix_a_forms_and_permit_library",
  "appendix_b_incident_and_investigation_package",
  "appendix_c_checklists_and_inspection_sheets",
  "appendix_d_field_references_maps_and_contact_inserts",
  "appendix_e_task_hazard_control_matrix",
] as const;

export type CsepFrontMatterKey = (typeof CSEP_FRONT_MATTER_KEYS)[number];
export type LegacyCsepFormatSectionKey =
  | "project_and_contractor_information"
  | "high_risk_steel_erection_programs"
  | "hazard_control_modules"
  | "task_execution_modules"
  | "company_overview_and_safety_philosophy"
  | "project_scope_and_trade_specific_activities"
  | "security_and_access_control"
  | "contractor_iipp"
  | "emergency_preparedness_and_response"
  | "personal_protective_equipment"
  | "hazard_communication_program"
  | "weather_requirements_and_severe_weather_response"
  | "safe_work_practices_and_trade_specific_procedures"
  | "environmental_execution_requirements"
  | "contractor_monitoring_audits_and_reporting"
  | "contractor_safety_meetings_and_engagement"
  | "sub_tier_contractor_management"
  | "project_close_out"
  | "permits_and_forms"
  | "hse_elements_and_site_specific_hazard_analysis"
  | "checklists_and_inspections"
  | "regulatory_framework"
  | "appendices_and_support_library";
export type CsepFormatSectionKey = (typeof CSEP_FORMAT_SECTION_KEYS)[number] | LegacyCsepFormatSectionKey;
export type LegacyCsepAppendixKey =
  | "appendix_safety_program_reference_pack"
  | "appendix_g_regulatory_references_r_index";
export type CsepAppendixKey = (typeof CSEP_APPENDIX_KEYS)[number] | LegacyCsepAppendixKey;
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
