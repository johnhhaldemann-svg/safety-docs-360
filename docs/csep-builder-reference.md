# CSEP Builder Reference

Generated from the current workspace source on 2026-04-28 09:59:18 -05:00.

## types\csep-builder.ts

```ts
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
  "project_and_contractor_information",
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
  "high_risk_steel_erection_programs",
  "hazard_control_modules",
  "task_execution_modules",
  "ppe_and_work_attire",
  "inspections_audits_and_records",
  "project_closeout",
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
```

## types\csep-priced-items.ts

```ts
export type CSEPPricedItemCategory = "permit" | "add_on";

export type CSEPPricedItemTriggerRules = {
  permits?: string[];
  hazards?: string[];
  trades?: string[];
  subTrades?: string[];
  taskTokens?: string[];
};

export type CSEPPricedItemCatalogEntry = {
  key: string;
  label: string;
  category: CSEPPricedItemCategory;
  price: number;
  triggers: CSEPPricedItemTriggerRules;
};

export type CSEPPricedItemSelection = {
  key: string;
  label: string;
  category: CSEPPricedItemCategory;
  price: number;
  source: "catalog";
};
```

## types\csep-programs.ts

```ts
export type CSEPProgramCategory = "hazard" | "permit" | "ppe";

export type CSEPProgramSubtypeGroup = "confined_space_classification";

export type CSEPProgramSubtypeValue = "permit_required" | "non_permit";

export type CSEPProgramSelectionSource = "selected" | "derived" | "default";

export type CSEPProgramSelection = {
  category: CSEPProgramCategory;
  item: string;
  subtype?: CSEPProgramSubtypeValue | null;
  relatedTasks: string[];
  source: CSEPProgramSelectionSource;
};

export type CSEPProgramSubtypeOption = {
  value: CSEPProgramSubtypeValue;
  label: string;
  description: string;
};

export type CSEPProgramSubtypeConfig = {
  group: CSEPProgramSubtypeGroup;
  label: string;
  prompt: string;
  options: CSEPProgramSubtypeOption[];
};

export type CSEPProgramSelectionInput = {
  category: CSEPProgramCategory;
  item: string;
  relatedTasks?: string[];
  subtype?: CSEPProgramSubtypeValue | null;
  source?: CSEPProgramSelectionSource;
};

export type CSEPProgramDefinitionContent = {
  title: string;
  summary: string;
  oshaRefs: string[];
  applicableWhen: string[];
  responsibilities: string[];
  preTaskProcedures: string[];
  workProcedures: string[];
  stopWorkProcedures: string[];
  closeoutProcedures: string[];
  controls: string[];
  training: string[];
};

export type CSEPProgramDefinition = CSEPProgramDefinitionContent & {
  category: CSEPProgramCategory;
  item: string;
  subtypeGroup?: CSEPProgramSubtypeGroup;
  subtypeVariants?: Partial<
    Record<CSEPProgramSubtypeValue, Partial<CSEPProgramDefinitionContent>>
  >;
  /**
   * When true, the program is rendered with a single consolidated subsection
   * rather than the full When-It-Applies / References / Responsibilities /
   * Controls / Related-Tasks breakdown. Use for short or secondary programs
   * where a full program layout creates heading clutter.
   */
  compactLayout?: boolean;
};

export type CSEPProgramConfig = {
  definitions: CSEPProgramDefinition[];
};

export type CSEPProgramModule = {
  title: string;
  risk: string;
  requiredControls: string[];
  verificationMethods: string[];
  stopWorkTriggers: string[];
  applicableReferences: string[];
};

export type CSEPProgramSection = {
  key: string;
  category: CSEPProgramCategory;
  item: string;
  subtype?: CSEPProgramSubtypeValue | null;
  title: string;
  summary: string;
  relatedTasks: string[];
  programModule: CSEPProgramModule;
  risk: string;
  requiredControls: string[];
  verificationMethods: string[];
  stopWorkTriggers: string[];
  applicableReferences: string[];
  subsections: Array<{
    title: string;
    body?: string;
    bullets: string[];
  }>;
};
```

## types\document-builder-text.ts

```ts
export type DocumentBuilderId = "csep" | "site_builder";

export type DocumentBuilderSectionReference = {
  builderId: DocumentBuilderId;
  key: string;
};

export type DocumentBuilderSectionTemplate = {
  key: string;
  label: string;
  title: string;
  paragraphs: string[];
  bullets: string[];
  children: DocumentBuilderSectionTemplate[];
  references?: DocumentBuilderSectionReference[];
};

export type DocumentBuilderTemplateGroup = {
  sections: DocumentBuilderSectionTemplate[];
};

export type DocumentBuilderTextConfig = {
  builders: Record<DocumentBuilderId, DocumentBuilderTemplateGroup>;
};
```

## lib\csepBuilder.ts

```ts
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
import { gcCmPartnersHaystack } from "@/lib/csepGcCmPartners";
import { CSEP_RESTART_AFTER_VERIFICATION, CSEP_STOP_WORK_UNIVERSAL_AUTHORITY } from "@/lib/csepStopWorkLanguage";

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
    label: "Scope Summary",
    title: "Scope Summary",
  },
  {
    key: "site_specific_notes",
    label: "Project-Specific Safety Notes",
    title: "Project-Specific Safety Notes",
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
    title: "Required PPE",
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
    key: "owner_message",
    kind: "front_matter",
    order: 0,
    title: "Owner Message",
    shortTitle: "Owner Message",
    numberLabel: null,
    purpose: "Project leadership commitment and safety expectations for this CSEP issue.",
    aiEligible: true,
  },
  {
    key: "sign_off_page",
    kind: "front_matter",
    order: 1,
    title: "Sign-Off Page",
    shortTitle: "Sign-Off Page",
    numberLabel: null,
    purpose: "Required review and signature confirmations before field use.",
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
] as const;

const FORMAT_SECTION_DEFINITIONS: readonly CsepMainSectionDefinition[] = [
  { key: "purpose", kind: "main", order: 10, title: "1. Purpose", shortTitle: "Purpose", numberLabel: "1", purpose: "Why the CSEP exists and how it governs project work.", aiEligible: true },
  { key: "project_and_contractor_information", kind: "main", order: 11, title: "2. Project and Contractor Information", shortTitle: "Project and Contractor Information", numberLabel: "2", purpose: "Project identity, owner, GC / CM, jurisdiction, and contractor contacts.", aiEligible: true, legacyBlockKeys: ["project_information", "contractor_information"] },
  { key: "scope_of_work_section", kind: "main", order: 12, title: "3. Scope of Work", shortTitle: "Scope of Work", numberLabel: "3", purpose: "Trade, sub-trade, task list, scope summary, exclusions, assumptions, and work sequence.", aiEligible: true, legacyBlockKeys: ["trade_summary", "scope_of_work", "site_specific_notes"] },
  { key: "regulatory_basis_and_references", kind: "main", order: 13, title: "4. Regulatory Basis and References", shortTitle: "Regulatory Basis and References", numberLabel: "4", purpose: "Jurisdiction profile, authority references, and clean OSHA / CFR citation list.", aiEligible: true, legacyBlockKeys: ["osha_references"] },
  { key: "top_10_critical_risks", kind: "main", order: 14, title: "5. Top 10 Critical Risks", shortTitle: "Top 10 Critical Risks", numberLabel: "5", purpose: "Highest project and steel erection exposures requiring leadership attention.", aiEligible: true, legacyBlockKeys: ["selected_hazards"] },
  { key: "roles_and_responsibilities", kind: "main", order: 15, title: "6. Roles and Responsibilities", shortTitle: "Roles and Responsibilities", numberLabel: "6", purpose: "Role duties, authority, and key definitions for the project team.", aiEligible: true, legacyBlockKeys: ["roles_and_responsibilities"] },
  { key: "trade_interaction_and_coordination", kind: "main", order: 16, title: "7. Trade Interaction and Coordination", shortTitle: "Trade Interaction and Coordination", numberLabel: "7", purpose: "Overlap planning, shared-area coordination, access handoffs, and conflict response.", aiEligible: true, legacyBlockKeys: ["common_overlapping_trades"] },
  { key: "site_access_security_laydown_traffic_control", kind: "main", order: 17, title: "8. Site Access, Security, Laydown, and Traffic Control", shortTitle: "Site Access, Security, Laydown, and Traffic Control", numberLabel: "8", purpose: "Worker access, visitors, deliveries, truck routing, staging, traffic, and restricted areas.", aiEligible: true, legacyBlockKeys: ["security_and_access"] },
  { key: "hazard_communication_and_environmental_protection", kind: "main", order: 18, title: "9. Hazard Communication and Environmental Protection", shortTitle: "Hazard Communication and Environmental Protection", numberLabel: "9", purpose: "SDS, labels, chemical inventory, spill tie-ins, waste, stormwater, dust, and nuisance controls.", aiEligible: true, legacyBlockKeys: ["hazard_communication"] },
  { key: "emergency_response_and_rescue", kind: "main", order: 19, title: "10. Emergency Response and Rescue", shortTitle: "Emergency Response and Rescue", numberLabel: "10", purpose: "Emergency notifications, 911 response, rescue, EMS access, fire response, and sheltering.", aiEligible: true, legacyBlockKeys: ["emergency_procedures", "weather_requirements_and_severe_weather_response"] },
  { key: "iipp_incident_reporting_corrective_action", kind: "main", order: 20, title: "11. IIPP / Incident Reporting / Corrective Action", shortTitle: "IIPP / Incident Reporting / Corrective Action", numberLabel: "11", purpose: "Incident and near-miss reporting, investigations, corrective actions, trends, and restart expectations.", aiEligible: true, legacyBlockKeys: ["incident_reporting_and_investigation", "enforcement_and_corrective_action"] },
  { key: "worker_conduct_fit_for_duty_disciplinary_program", kind: "main", order: 21, title: "12. Worker Conduct, Fit-for-Duty, and Disciplinary Program", shortTitle: "Worker Conduct, Fit-for-Duty, and Disciplinary Program", numberLabel: "12", purpose: "Unsafe-act response, stop-work enforcement, impairment, fatigue, wellness, and discipline.", aiEligible: true, legacyBlockKeys: ["drug_and_alcohol_testing", "health_and_wellness"] },
  { key: "training_competency_and_certifications", kind: "main", order: 22, title: "13. Training, Competency, and Certifications", shortTitle: "Training, Competency, and Certifications", numberLabel: "13", purpose: "Training records, certifications, qualified roles, and active-scope training requirements.", aiEligible: true, legacyBlockKeys: ["training_and_instruction"] },
  { key: "required_permits_and_hold_points", kind: "main", order: 23, title: "14. Required Permits and Hold Points", shortTitle: "Required Permits and Hold Points", numberLabel: "14", purpose: "Permit triggers, hold points, verification, and closeout requirements.", aiEligible: true, appendixRefs: ["appendix_a_forms_and_permit_library"], legacyBlockKeys: ["additional_permits"] },
  { key: "high_risk_steel_erection_programs", kind: "main", order: 24, title: "15. High-Risk Steel Erection Programs", shortTitle: "High-Risk Steel Erection Programs", numberLabel: "15", purpose: "Steel erection program modules for leading edge, decking, hoisting, stability, bracing, and weather.", aiEligible: true, legacyBlockKeys: ["selected_hazards", "activity_hazard_matrix"] },
  { key: "hazard_control_modules", kind: "main", order: 25, title: "16. Hazard Control Modules", shortTitle: "Hazard Control Modules", numberLabel: "16", purpose: "Hazard-specific controls only, separated from task execution and project-wide policy.", aiEligible: true, legacyBlockKeys: ["selected_hazards", "activity_hazard_matrix"] },
  { key: "task_execution_modules", kind: "main", order: 26, title: "17. Task Execution Modules", shortTitle: "Task Execution Modules", numberLabel: "17", purpose: "Task-specific work execution steps for structural steel and decking activities.", aiEligible: true, legacyBlockKeys: ["activity_hazard_matrix", "trade_summary"] },
  { key: "ppe_and_work_attire", kind: "main", order: 27, title: "18. PPE and Work Attire", shortTitle: "PPE and Work Attire", numberLabel: "18", purpose: "Base PPE, task-specific PPE, welding PPE, fall protection equipment, and attire requirements.", aiEligible: true, legacyBlockKeys: ["required_ppe"] },
  { key: "inspections_audits_and_records", kind: "main", order: 28, title: "19. Inspections, Audits, and Records", shortTitle: "Inspections, Audits, and Records", numberLabel: "19", purpose: "JHA / pre-task review, inspections, audits, permits, corrective action tracking, and records.", aiEligible: true, appendixRefs: ["appendix_c_checklists_and_inspection_sheets"], legacyBlockKeys: ["recordkeeping", "training_and_instruction"] },
  { key: "project_closeout", kind: "main", order: 29, title: "20. Project Closeout", shortTitle: "Project Closeout", numberLabel: "20", purpose: "Corrective action closeout, permit closeout, turnover, lessons learned, and final documentation review.", aiEligible: true, legacyBlockKeys: ["continuous_improvement", "recordkeeping"] },
  { key: "document_control_and_revision_history", kind: "main", order: 30, title: "21. Document Control and Revision History", shortTitle: "Document Control and Revision History", numberLabel: "21", purpose: "Issue control, revision status, and approval record for this CSEP package.", aiEligible: false },
] as const;

const LEGACY_FORMAT_SECTION_DEFINITIONS: readonly CsepFormatSectionDefinition[] = [
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
      "Field coordination for weather, heat, cold, fire prevention, and housekeeping, cross-referenced to the emergency programâ€”not a substitute for full emergency plans or the HazCom section.",
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
    key: "hse_elements_and_site_specific_hazard_analysis",
    kind: "main",
    order: 26,
    title: "19.0 HSE Elements / Site-Specific Hazard Analysis",
    shortTitle: "HSE Elements / Site-Specific Hazard Analysis",
    numberLabel: "19.0",
    purpose: "Hazard module library with purpose, controls, training, and response expectations.",
    aiEligible: true,
    appendixRefs: ["appendix_a_forms_and_permit_library", "appendix_b_incident_and_investigation_package"],
    legacyBlockKeys: ["selected_hazards", "activity_hazard_matrix"],
  },
  {
    key: "checklists_and_inspections",
    kind: "main",
    order: 27,
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
    order: 28,
    title: "18.0 Regulatory Framework",
    shortTitle: "Regulatory Framework",
    numberLabel: "18.0",
    purpose: "OSHA, state, local, owner, and labor-framework quick-reference content.",
    aiEligible: true,
    legacyBlockKeys: ["osha_references"],
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
    purpose: "Incident-response, investigation, corrective-action, and closeout documents.",
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
  {
    key: "appendix_e_task_hazard_control_matrix",
    kind: "appendix",
    order: 44,
    title: "Appendix E. Task-Hazard-Control Matrix",
    shortTitle: "Task-Hazard-Control Matrix",
    numberLabel: "Appendix E",
    purpose: "Task, hazard, control, PPE, permit, and verification matrix.",
    aiEligible: true,
  },
] as const;

const LEGACY_APPENDIX_DEFINITIONS: readonly CsepFormatSectionDefinition[] = [
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
  {
    key: "appendix_safety_program_reference_pack",
    kind: "appendix",
    order: 44,
    title: "Appendix F. Safety Program Reference Pack",
    shortTitle: "Safety Program Reference Pack",
    numberLabel: "Appendix F",
    purpose:
      "Full narratives for selected hazard programs (fall protection, hot work, rigging, CDZ, steel program modules, and similar) when the Hazards and Controls section uses abbreviated field summaries.",
    aiEligible: true,
  },
  {
    key: "appendix_g_regulatory_references_r_index",
    kind: "appendix",
    order: 45,
    title: "Appendix G. Regulatory References (R-index)",
    shortTitle: "Regulatory References (R-index)",
    numberLabel: "Appendix G",
    purpose:
      "Stable R-number citations used throughout this CSEP; program modules reference R-codes instead of repeating full OSHA titles.",
    aiEligible: true,
  },
] as const;

export const CSEP_FORMAT_DEFINITIONS = [
  ...FRONT_MATTER_DEFINITIONS,
  ...FORMAT_SECTION_DEFINITIONS,
  ...LEGACY_FORMAT_SECTION_DEFINITIONS,
  ...APPENDIX_DEFINITIONS,
  ...LEGACY_APPENDIX_DEFINITIONS,
] as const;

const ALL_FORMAT_SECTION_DEFINITIONS = [
  ...LEGACY_FORMAT_SECTION_DEFINITIONS,
  ...FORMAT_SECTION_DEFINITIONS,
] as const;

const ALL_FORMAT_SECTION_KEYS = ALL_FORMAT_SECTION_DEFINITIONS.map(
  (definition) => definition.key as CsepFormatSectionKey
) as readonly CsepFormatSectionKey[];
const LEGACY_FORMAT_SECTION_KEY_SET = new Set<CsepFormatSectionKey>(
  LEGACY_FORMAT_SECTION_DEFINITIONS.map((definition) => definition.key as CsepFormatSectionKey)
);

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
  ALL_FORMAT_SECTION_DEFINITIONS.map((definition) => [definition.key, definition.legacyBlockKeys ?? []])
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
    title: "Scope Summary",
    fieldKey: "scope_of_work",
    includedSectionLabel: "Scope Summary",
    draftingFocus:
      "Summarize the trade, sub-trade, and selected tasks this CSEP governs (what work is in scope). Do not restate site-only constraints hereâ€”those belong in Project-Specific Safety Notes.",
  },
  {
    id: "site_specific_notes",
    kind: "text",
    title: "Project-Specific Safety Notes",
    fieldKey: "site_specific_notes",
    includedSectionLabel: "Project-Specific Safety Notes",
    draftingFocus:
      "Capture unique site constraints, project conditions, owner or GC rules, access limits, weather or logistics concerns, and safety requirements that are not already covered in the Scope Summary task list.",
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
      "Cover pre-access orientation and acknowledgments, union and reciprocal testing obligations, the personal-vehicle prohibition on site, reporting of suspected impairment, removal from exposed work, testing triggers, and restart rulesâ€”without repeating enforcement or corrective-action content.",
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
  gc_cm?: string | string[];
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

const LABEL_TO_KEY = {
  ...Object.fromEntries(BLOCK_OPTION_DEFINITIONS.map((option) => [option.label, option.key])),
  /** Legacy `included_sections` labels from issued drafts and older sessions */
  "Scope of Work": "scope_of_work",
  "Site Specific Notes": "site_specific_notes",
} as Record<string, CsepBuilderBlockKey>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareValues(left: unknown, right: unknown) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

/** Labels that may appear in `included_sections` for smart-drafting / gating (current + legacy). */
export function resolveIncludedSectionLabelsForAiSection(sectionId: CsepBuilderAiSectionId): string[] {
  if (sectionId === "scope_of_work") {
    return ["Scope Summary", "Scope of Work"];
  }
  if (sectionId === "site_specific_notes") {
    return ["Project-Specific Safety Notes", "Site Specific Notes"];
  }
  const config = CSEP_BUILDER_AI_SECTION_CONFIG[sectionId];
  return "includedSectionLabel" in config ? [config.includedSectionLabel] : [];
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
      .map((item) => item.replace(/^[-*â€¢]\s*/, "").replace(/^\d+(?:\.\d+)*[\])\.-]?\s*/, "").trim())
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
        ...normalizeStringList(line.replace(/^(?:[-*â€¢]|\d+(?:\.\d+)*[\])\.-]?)\s*/, ""))
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
        ...normalizeStringList(line.replace(/^(?:[-*â€¢]|\d+(?:\.\d+)*[\])\.-]?)\s*/, "")),
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
    .replace(/([^\n])\s+([A-Z][A-Za-z0-9/&(),'\- ]{2,80}:)(?=\s*[-*â€¢]\s+)/g, "$1\n\n$2")
    .replace(/([^\n])\s+([-*â€¢]\s+)/g, "$1\n$2")
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
}): CsepFormatSectionKey[] {
  const keys = new Set<CsepFormatSectionKey>();

  if (Array.isArray(params.selectedFormatSections)) {
    params.selectedFormatSections.forEach((value) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if ((ALL_FORMAT_SECTION_KEYS as readonly string[]).includes(trimmed)) {
        keys.add(trimmed as CsepFormatSectionKey);
      }
    });
  }

  const legacyBlockKeys = normalizeSelectedCsepBlockKeys({
    includedSections: params.includedSections,
    includedContent: params.includedContent,
  });

  if (legacyBlockKeys.length > 0) {
    LEGACY_FORMAT_SECTION_DEFINITIONS.forEach((definition) => {
      if ((definition.legacyBlockKeys ?? []).some((key) => legacyBlockKeys.includes(key))) {
        keys.add(definition.key as CsepFormatSectionKey);
      }
    });
  }

  return keys.size > 0
    ? ALL_FORMAT_SECTION_KEYS.filter((key) => keys.has(key))
    : [...CSEP_FORMAT_SECTION_KEYS];
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

  if ((input.tasks?.length ?? 0) > 0 && !selectedSections.has("scope_of_work_section")) {
    pushFinding({
      key: "project_scope_required",
      severity: "required",
      title: "Project scope coverage missing",
      detail: "Selected tasks require the project scope section so work phases, interfaces, and high-risk activity callouts are visible.",
      sectionKey: "scope_of_work_section",
    });
  }

  if ((input.selectedPermits?.length ?? 0) > 0 && !selectedSections.has("required_permits_and_hold_points")) {
    pushFinding({
      key: "permits_library_required",
      severity: "required",
      title: "Permit library coverage missing",
      detail: "Selected permits should be surfaced in Section 14 and cross-referenced into Appendix A.",
      sectionKey: "required_permits_and_hold_points",
      appendixKey: "appendix_a_forms_and_permit_library",
    });
  }

  if ((input.requiredPpe?.length ?? 0) > 0 && !selectedSections.has("ppe_and_work_attire")) {
    pushFinding({
      key: "ppe_section_missing",
      severity: "warning",
      title: "PPE section not selected",
      detail: "Required PPE is present in the builder inputs, but Section 18 is not available to show consolidated PPE and work-attire guidance.",
      sectionKey: "ppe_and_work_attire",
    });
  }

  if ((input.commonOverlappingTrades?.length ?? 0) > 0 && !selectedSections.has("trade_interaction_and_coordination")) {
    pushFinding({
      key: "subtier_coordination_gap",
      severity: "warning",
      title: "Trade-interface oversight not visible",
      detail: "Overlapping trade context exists, so Section 7 should stay in the package for coordination and overlap response language.",
      sectionKey: "trade_interaction_and_coordination",
    });
  }

  if (input.governingState?.trim() && !selectedSections.has("regulatory_basis_and_references")) {
    pushFinding({
      key: "regulatory_matrix_missing",
      severity: "warning",
      title: "Regulatory framework missing",
      detail: "A governing state was identified, but Section 4 is not available to show state, local, owner, and regulatory requirements.",
      sectionKey: "regulatory_basis_and_references",
    });
  }

  if (lowerHazards.length > 0 && !selectedSections.has("hazard_control_modules")) {
    pushFinding({
      key: "hazard_library_missing",
      severity: "required",
      title: "Hazard analysis library missing",
      detail: "Selected hazards require Section 16 so the formatted CSEP still includes consistent hazard-module coverage.",
      sectionKey: "hazard_control_modules",
    });
  }

  if (
    lowerHazards.some((item) =>
      ["fall", "confined", "electrical", "hot work", "fire", "storm", "weather"].some((token) =>
        item.includes(token)
      )
    ) &&
    !selectedSections.has("emergency_response_and_rescue")
  ) {
    pushFinding({
      key: "emergency_response_gap",
      severity: "warning",
      title: "Emergency-response tie-in recommended",
      detail: "The active hazard profile suggests Section 10 should stay visible for rescue, evacuation, and emergency-response tie-ins.",
      sectionKey: "emergency_response_and_rescue",
      appendixKey: "appendix_d_field_references_maps_and_contact_inserts",
    });
  }

  if ((input.programTitles?.length ?? 0) > 0 && !selectedSections.has("inspections_audits_and_records")) {
    pushFinding({
      key: "checklist_reference_gap",
      severity: "info",
      title: "Checklist appendix can strengthen program enforcement",
      detail: "Triggered programs were found. Section 19 and Appendix C can hold inspection/checklist references without crowding the body pages.",
      sectionKey: "inspections_audits_and_records",
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
  ALL_FORMAT_SECTION_KEYS.map((key) => [normalizeToken(key), key])
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
  connecting:
    "Receive hoisted members at leading edges and seats, align bolt holes, install drift pins and initial fasteners, and communicate release conditions per the steel plan.",
  bolting: "Install and tighten structural bolts to required connection standards.",
  welding: "Perform structural welding in accordance with approved procedures and safety controls.",
  cutting: "Thermally or mechanically cut structural steel with hot-work controls, fire watch, and exclusion of personnel from spark and slag paths.",
  grinding: "Grind welds, edges, or shear-stud areas on structural steel with spark control, fire watch when required, and respiratory protection per exposure assessment.",
  "decking install": "Place and secure metal decking to support floors and roof assemblies.",
  embeds: "Install or coordinate embedded items needed for structural or follow-on trade work.",
  "punch list": "Identify and correct incomplete, damaged, or nonconforming work before closeout.",
  "touch-up painting":
    "Apply field touch-up coatings or solvents on structural steel with ventilation, ignition-source control, and fall protection matched to access method.",
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

  if (combined.includes("document control") || combined.includes("revision history")) {
    return "document_control_and_revision_history";
  }
  if (combined.includes("top 10") || combined.includes("top ten") || combined.includes("critical risk")) {
    return "top_10_critical_risks";
  }
  if (combined.includes("project information") || combined.includes("contractor information")) {
    return "project_and_contractor_information";
  }
  if (combined.includes("scope") || combined.includes("trade summary") || combined.includes("task list")) {
    return "scope_of_work_section";
  }
  if (combined.includes("osha") || combined.includes("reference") || combined.includes("regulatory") || combined.includes("jurisdiction")) {
    return "regulatory_basis_and_references";
  }
  if (combined.includes("overlap") || combined.includes("simultaneous") || combined.includes("coordination") || combined.includes("handoff")) {
    return "trade_interaction_and_coordination";
  }
  if (combined.includes("security") || combined.includes("access") || combined.includes("laydown") || combined.includes("traffic") || combined.includes("delivery")) {
    return "site_access_security_laydown_traffic_control";
  }
  if (combined.includes("hazcom") || combined.includes("hazard communication") || combined.includes("sds") || combined.includes("chemical") || combined.includes("environmental")) {
    return "hazard_communication_and_environmental_protection";
  }
  if (combined.includes("emergency") || combined.includes("rescue") || combined.includes("evacuation") || combined.includes("911")) {
    return "emergency_response_and_rescue";
  }
  if (combined.includes("incident") || combined.includes("near miss") || combined.includes("investigation") || combined.includes("corrective action") || combined.includes("iipp")) {
    return "iipp_incident_reporting_corrective_action";
  }
  if (combined.includes("drug") || combined.includes("alcohol") || combined.includes("fit") || combined.includes("disciplin") || combined.includes("conduct")) {
    return "worker_conduct_fit_for_duty_disciplinary_program";
  }
  if (combined.includes("training") || combined.includes("certification") || combined.includes("competency")) {
    return "training_competency_and_certifications";
  }
  if (combined.includes("permit") || combined.includes("hold point")) {
    return "required_permits_and_hold_points";
  }
  if (combined.includes("steel") && combined.includes("program")) {
    return "high_risk_steel_erection_programs";
  }
  if (combined.includes("task execution") || combined.includes("task module")) {
    return "task_execution_modules";
  }
  if (combined.includes("ppe") || combined.includes("personal protective") || combined.includes("work attire")) {
    return "ppe_and_work_attire";
  }
  if (combined.includes("inspection") || combined.includes("audit") || combined.includes("record")) {
    return "inspections_audits_and_records";
  }
  if (combined.includes("closeout") || combined.includes("close out") || combined.includes("lessons learned")) {
    return "project_closeout";
  }
  if (combined.includes("hazard") || combined.includes("control") || combined.includes("program")) {
    return "hazard_control_modules";
  }

  if (combined.includes("role") || combined.includes("competent person")) return "roles_and_responsibilities";
  if (combined.includes("company overview") || combined.includes("safety philosophy")) {
    return "purpose";
  }
  if (combined.includes("security") || combined.includes("access")) return "site_access_security_laydown_traffic_control";
  if (
    combined.includes("incident") ||
    combined.includes("drug") ||
    combined.includes("wellness") ||
    combined.includes("corrective")
  ) {
    return "iipp_incident_reporting_corrective_action";
  }
  if (combined.includes("meeting") || combined.includes("engagement") || combined.includes("toolbox")) {
    return "training_competency_and_certifications";
  }
  if (combined.includes("audit") || combined.includes("monitoring") || combined.includes("reporting")) {
    return "inspections_audits_and_records";
  }
  if (combined.includes("sub tier") || combined.includes("subcontract") || combined.includes("lower tier")) {
    return "trade_interaction_and_coordination";
  }
  if (combined.includes("close out") || combined.includes("closeout") || combined.includes("demobil")) {
    return "project_closeout";
  }
  if (combined.includes("inspection") || combined.includes("checklist")) {
    return "inspections_audits_and_records";
  }
  if (combined.includes("environmental") || combined.includes("stormwater") || combined.includes("spill")) {
    return "hazard_communication_and_environmental_protection";
  }
  if (
    combined.includes("hazcom") ||
    (combined.includes("hazard") && combined.includes("communication")) ||
    combined.includes("sds") ||
    combined.includes("ghs")
  ) {
    return "hazard_communication_and_environmental_protection";
  }
  if (combined.includes("emergency") || combined.includes("evacuation") || combined.includes("rescue")) {
    return "emergency_response_and_rescue";
  }
  if (
    combined.includes("ppe") ||
    combined.includes("personal protective") ||
    combined.includes("fall protection")
  ) {
    return "ppe_and_work_attire";
  }
  if (combined.includes("training") || combined.includes("orientation") || combined.includes("competency")) {
    return "training_competency_and_certifications";
  }
  if (combined.includes("weather") || combined.includes("storm") || combined.includes("lightning")) {
    return "emergency_response_and_rescue";
  }
  if (combined.includes("permit")) return "required_permits_and_hold_points";
  if (combined.includes("osha") || combined.includes("reference") || combined.includes("regulatory")) {
    return "regulatory_basis_and_references";
  }
  if (combined.includes("hazard") || combined.includes("activity hazard") || combined.includes("program")) {
    return "hazard_control_modules";
  }
  if (combined.includes("trade") || combined.includes("scope") || combined.includes("project information")) {
    return "scope_of_work_section";
  }
  if (combined.includes("contractor information") || combined.includes("policy")) {
    return "project_and_contractor_information";
  }

  return "hazard_control_modules";
}

function resolveGroupedFormatSectionKey(
  section: GeneratedSafetyPlanSection,
  inferredKey: CsepFormatSectionKey,
  selectedFormatSectionSet: ReadonlySet<CsepFormatSectionKey>
): CsepFormatSectionKey {
  if (!Array.from(selectedFormatSectionSet).some((key) => LEGACY_FORMAT_SECTION_KEY_SET.has(key))) {
    return inferredKey;
  }

  const combined = `${normalizeToken(section.key)} ${normalizeToken(section.title)}`;

  if (
    inferredKey === "scope_of_work_section" &&
    selectedFormatSectionSet.has("project_scope_and_trade_specific_activities")
  ) {
    return "project_scope_and_trade_specific_activities";
  }
  if (
    inferredKey === "emergency_response_and_rescue" &&
    selectedFormatSectionSet.has("emergency_preparedness_and_response")
  ) {
    return "emergency_preparedness_and_response";
  }
  if (
    inferredKey === "ppe_and_work_attire" &&
    selectedFormatSectionSet.has("personal_protective_equipment")
  ) {
    return "personal_protective_equipment";
  }
  if (
    inferredKey === "required_permits_and_hold_points" &&
    selectedFormatSectionSet.has("permits_and_forms")
  ) {
    return "permits_and_forms";
  }
  if (
    (inferredKey === "hazard_control_modules" || inferredKey === "high_risk_steel_erection_programs") &&
    selectedFormatSectionSet.has("hse_elements_and_site_specific_hazard_analysis")
  ) {
    return "hse_elements_and_site_specific_hazard_analysis";
  }
  if (
    combined.includes("program ppe") &&
    selectedFormatSectionSet.has("personal_protective_equipment")
  ) {
    return "personal_protective_equipment";
  }
  if (
    combined.includes("program permit") &&
    selectedFormatSectionSet.has("permits_and_forms")
  ) {
    return "permits_and_forms";
  }
  if (
    combined.includes("program hazard") &&
    selectedFormatSectionSet.has("hse_elements_and_site_specific_hazard_analysis")
  ) {
    return "hse_elements_and_site_specific_hazard_analysis";
  }

  return inferredKey;
}

function buildStaticFrontMatterSections(
  draft: GeneratedSafetyPlanDraft,
  selectedFormatSectionKeys: readonly CsepFormatSectionKey[]
): GeneratedSafetyPlanSection[] {
  const aiAssemblyDecisions = draft.aiAssemblyDecisions ?? null;
  const usesLegacyFormat = selectedFormatSectionKeys.some((key) => LEGACY_FORMAT_SECTION_KEY_SET.has(key));

  const formatSections = selectedFormatSectionKeys
    .map((key) => getCsepFormatDefinition(key))
    .filter(Boolean);

  const ownerMessage: GeneratedSafetyPlanSection = {
    key: "owner_message",
    kind: "front_matter",
    order: 0,
    title: "Owner Message",
    layoutKey: "owner_message",
    body:
      cleanFinalText(aiAssemblyDecisions?.frontMatterGuidance) ??
      "Project leadership expects all contractor work to be planned, coordinated, and executed in accordance with this CSEP.",
  };
  const signOffPage: GeneratedSafetyPlanSection = {
    key: "sign_off_page",
    kind: "front_matter",
    order: 1,
    title: "Sign-Off Page",
    layoutKey: "sign_off_page",
    body: "Issue this plan only after the responsible project and contractor representatives complete the required review and sign-off.",
  };
  const tableOfContents: GeneratedSafetyPlanSection = {
    key: "table_of_contents",
    kind: "front_matter",
    order: 2,
    title: "Table of Contents",
    layoutKey: "table_of_contents",
    bullets: formatSections.map((section) => section.title),
  };

  if (usesLegacyFormat) {
    return [
      tableOfContents,
      {
        key: "plan_use_guidance",
        kind: "front_matter",
        order: 3,
        title: "Plan Use Guidance",
        layoutKey: "plan_use_guidance",
        body:
          cleanFinalText(aiAssemblyDecisions?.frontMatterGuidance) ??
          "Use this CSEP as the field-ready execution guide for the selected contractor scope.",
      },
      ownerMessage,
      signOffPage,
    ];
  }

  return [
    ownerMessage,
    signOffPage,
    tableOfContents,
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
    kind: "main",
    order: 30,
    title: "21. Document Control and Revision History",
    numberLabel: "21",
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
      body: `${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} Life-saving expectations apply whenever conditions defeat the planned controls.`,
      bullets: [
        `Work stoppage: Stop work when fall protection, access, or rescue conditions are not in place. ${CSEP_RESTART_AFTER_VERIFICATION}`,
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
    gcCmPartnersHaystack(draft.projectOverview.gcCm),
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
            : definition.key === "appendix_d_field_references_maps_and_contact_inserts"
              ? [
                  ["Emergency Contacts", "Clinic directions, emergency ladder, and owner / GC contact inserts."],
                  ["Maps and Routes", "Site maps, shelter locations, access routes, and staging references."],
                  ["Quick Inserts", "Field reference cards and worker-facing quick-use pages."],
                  ["Specialty References", hazardTitles.join(", ") || "Hazard-module references and project-specific field aids."],
                ]
              : definition.key === "appendix_e_task_hazard_control_matrix"
                ? [
                    ["Matrix", "Task, hazard, control, PPE, permit, and verification matrix."],
                    ["Field use", "Use the matrix as a task-facing reference after reviewing Sections 15 through 17."],
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
      parentSectionKey: null,
      appendixKey: definition.key,
      layoutKey: "appendix_library",
      body: cleanFinalText(definition.purpose) ?? fallbackSectionBody(definition) ?? undefined,
      table: {
        columns: ["Library Area", "Intended Use"],
        rows: appendixRows,
      },
    };
  });

  return attachmentSections;
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
  const hasSnapshotFormatSelection = Array.isArray(builderSnapshot.selected_format_sections);
  const legacyDraftSectionKeys = draft.sectionMap
    .map((section) => section.key)
    .filter((key): key is CsepFormatSectionKey =>
      typeof key === "string" && LEGACY_FORMAT_SECTION_KEY_SET.has(key as CsepFormatSectionKey)
    );
  const resolvedSelectedFormatSectionKeys =
    options?.selectedFormatSectionKeys ??
    (hasSnapshotFormatSelection
      ? resolveSelectedCsepFormatSectionKeys({
      selectedFormatSections: builderSnapshot.selected_format_sections,
      includedSections: builderSnapshot.included_sections,
      includedContent: builderSnapshot.includedContent,
        })
      : legacyDraftSectionKeys.length > 0
        ? legacyDraftSectionKeys
        : resolveSelectedCsepFormatSectionKeys({
            selectedFormatSections: builderSnapshot.selected_format_sections,
            includedSections: builderSnapshot.included_sections,
            includedContent: builderSnapshot.includedContent,
          }));
  const selectedFormatSectionSet = new Set<CsepFormatSectionKey>(resolvedSelectedFormatSectionKeys);
  const selectedFormatSectionKeys = ALL_FORMAT_SECTION_KEYS.filter((key) =>
    selectedFormatSectionSet.has(key as CsepFormatSectionKey)
  );
  const grouped = new Map<CsepFormatSectionKey, GeneratedSafetyPlanSection[]>();

  draft.sectionMap
    .filter((section) => section.kind !== "front_matter" && section.kind !== "appendix")
    .filter((section) => normalizeToken(section.key ?? "") !== "project information")
    .forEach((section) => {
      const formatKey = resolveGroupedFormatSectionKey(
        section,
        inferFormatSectionKey(section),
        selectedFormatSectionSet
      );
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
    if (sectionKey === "document_control_and_revision_history") {
      return buildDocumentControlRevisionEndSection(draft);
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
      sectionKey === "required_permits_and_hold_points"
        ? normalizePermitList([
            ...draft.ruleSummary.permitTriggers,
            ...combinedBullets,
          ])
        : combinedBullets;
    const projectScopeSummarySubsections =
      sectionKey === "scope_of_work_section" || sectionKey === "project_scope_and_trade_specific_activities"
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
      sectionKey === "emergency_response_and_rescue" || sectionKey === "emergency_preparedness_and_response"
        ? buildOperationalQuickReferenceSubsections()
        : [];
    const securityLogisticsSubsections =
      sectionKey === "site_access_security_laydown_traffic_control"
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
                        "Confirm subsection coverage against the information entered for this CSEP before issue.",
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
      sectionKey === "emergency_response_and_rescue" &&
      !nextSection.table &&
      !(nextSection.subsections?.length) &&
      !isMeaningfulFinalText(nextSection.body)
    ) {
      return null;
    }

    return nextSection;
  });
  const appendixSections = buildAppendixLibrarySections(draft);
  const usesLegacyFormat = selectedFormatSectionKeys.some((key) => LEGACY_FORMAT_SECTION_KEY_SET.has(key));
  const legacyDocumentControlSection: GeneratedSafetyPlanSection[] =
    usesLegacyFormat && !selectedFormatSectionSet.has("document_control_and_revision_history")
      ? [buildDocumentControlRevisionEndSection(draft)]
      : [];
  const legacySupportLibrarySection: GeneratedSafetyPlanSection[] = usesLegacyFormat
    ? [
        {
          key: "appendices_and_support_library",
          kind: "main",
          order: 29,
          title: "20.0 Appendices and Support Library",
          numberLabel: "20.0",
          layoutKey: "appendices_and_support_library",
          body:
            "Appendices and support tools are maintained as controlled references for field execution, inspections, incident response, permits, and project-specific inserts.",
          parentSectionKey: null,
        },
      ]
    : [];
  const presentMainSections = mainSections.filter(
    (section): section is GeneratedSafetyPlanSection => Boolean(section)
  );
  const cleanedSections = options?.finalIssueMode
    ? [...frontMatterSections, ...presentMainSections, ...legacySupportLibrarySection, ...legacyDocumentControlSection, ...appendixSections]
        .map((section) => cleanSectionForFinalIssue(section))
        .filter((section): section is GeneratedSafetyPlanSection => Boolean(section))
        .filter((section) => hasStructuredContent(section))
    : [...frontMatterSections, ...presentMainSections, ...legacySupportLibrarySection, ...legacyDocumentControlSection, ...appendixSections];

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
```

## lib\csep\csep-section-order.ts

```ts
export type CanonicalCsepSectionDefinition = {
  key: string;
  title: string;
  kind: "front_matter" | "main";
  descriptor: string;
};

export const CANONICAL_CSEP_SECTION_ORDER: CanonicalCsepSectionDefinition[] = [
  {
    key: "owner_message",
    kind: "front_matter",
    title: "Owner Message",
    descriptor: "Project leadership commitment and safety expectations for this CSEP issue.",
  },
  {
    key: "sign_off_page",
    kind: "front_matter",
    title: "Sign-Off Page",
    descriptor: "Required review and signature confirmations before field use.",
  },
  {
    key: "table_of_contents",
    kind: "front_matter",
    title: "Table of Contents",
    descriptor: "Document navigation for the issued CSEP package.",
  },
  {
    key: "purpose",
    kind: "main",
    title: "Purpose",
    descriptor: "Why the CSEP exists and how it governs project work.",
  },
  {
    key: "project_and_contractor_information",
    kind: "main",
    title: "Project and Contractor Information",
    descriptor: "Project identity, owner, GC / CM, jurisdiction, and contractor contacts.",
  },
  {
    key: "scope_of_work_section",
    kind: "main",
    title: "Scope of Work",
    descriptor: "Trade, sub-trade, tasks, scope summary, assumptions, exclusions, and work sequence.",
  },
  {
    key: "regulatory_basis_and_references",
    kind: "main",
    title: "Regulatory Basis and References",
    descriptor: "Jurisdiction profile, authority references, and clean OSHA / CFR citation list.",
  },
  {
    key: "top_10_critical_risks",
    kind: "main",
    title: "Top 10 Critical Risks",
    descriptor: "Highest project and steel erection exposures requiring leadership attention.",
  },
  {
    key: "roles_and_responsibilities",
    kind: "main",
    title: "Roles and Responsibilities",
    descriptor: "Role duties, authority, and key definitions for the project team.",
  },
  {
    key: "trade_interaction_and_coordination",
    kind: "main",
    title: "Trade Interaction and Coordination",
    descriptor: "Overlap planning, shared-area coordination, access handoffs, and conflict response.",
  },
  {
    key: "site_access_security_laydown_traffic_control",
    kind: "main",
    title: "Site Access, Security, Laydown, and Traffic Control",
    descriptor: "Worker access, visitors, deliveries, truck routing, staging, traffic, and restricted areas.",
  },
  {
    key: "hazard_communication_and_environmental_protection",
    kind: "main",
    title: "Hazard Communication and Environmental Protection",
    descriptor: "SDS, labels, chemical inventory, spill tie-ins, waste, stormwater, dust, and nuisance controls.",
  },
  {
    key: "emergency_response_and_rescue",
    kind: "main",
    title: "Emergency Response and Rescue",
    descriptor: "Emergency notifications, 911 response, rescue, EMS access, fire response, and sheltering.",
  },
  {
    key: "iipp_incident_reporting_corrective_action",
    kind: "main",
    title: "IIPP / Incident Reporting / Corrective Action",
    descriptor: "Incident and near-miss reporting, investigations, corrective actions, trends, and restart expectations.",
  },
  {
    key: "worker_conduct_fit_for_duty_disciplinary_program",
    kind: "main",
    title: "Worker Conduct, Fit-for-Duty, and Disciplinary Program",
    descriptor: "Unsafe-act response, stop-work enforcement, impairment, fatigue, wellness, and discipline.",
  },
  {
    key: "training_competency_and_certifications",
    kind: "main",
    title: "Training, Competency, and Certifications",
    descriptor: "Training records, certifications, qualified roles, and active-scope training requirements.",
  },
  {
    key: "required_permits_and_hold_points",
    kind: "main",
    title: "Required Permits and Hold Points",
    descriptor: "Permit triggers, hold points, verification, and closeout requirements.",
  },
  {
    key: "high_risk_steel_erection_programs",
    kind: "main",
    title: "High-Risk Steel Erection Programs",
    descriptor: "Steel erection program modules for leading edge, decking, hoisting, stability, bracing, and weather.",
  },
  {
    key: "hazard_control_modules",
    kind: "main",
    title: "Hazard Control Modules",
    descriptor: "Hazard-specific controls only, separated from task execution and project-wide policy.",
  },
  {
    key: "task_execution_modules",
    kind: "main",
    title: "Task Execution Modules",
    descriptor: "Task-specific work execution steps for structural steel and decking activities.",
  },
  {
    key: "ppe_and_work_attire",
    kind: "main",
    title: "PPE and Work Attire",
    descriptor: "Base PPE, task-specific PPE, welding PPE, fall protection equipment, and attire requirements.",
  },
  {
    key: "inspections_audits_and_records",
    kind: "main",
    title: "Inspections, Audits, and Records",
    descriptor: "JHA / pre-task review, inspections, audits, permits, corrective action tracking, and records.",
  },
  {
    key: "project_closeout",
    kind: "main",
    title: "Project Closeout",
    descriptor: "Corrective action closeout, permit closeout, turnover, lessons learned, and final documentation review.",
  },
  {
    key: "document_control_and_revision_history",
    kind: "main",
    title: "Document Control and Revision History",
    descriptor: "Issue control, revision status, and approval record for this CSEP package.",
  },
];
```

## lib\csep\csep-hazard-template.ts

```ts
export const CSEP_HAZARD_TEMPLATE_SLICES = [
  "Risk",
  "Required controls",
  "How controls are met and verified",
  "Stop-work / hold-point triggers",
  "Applicable references",
] as const;

export type CsepHazardTemplateSlice = (typeof CSEP_HAZARD_TEMPLATE_SLICES)[number];

export function buildHazardSliceTitle(
  hazardName: string,
  slice: CsepHazardTemplateSlice
) {
  return `${hazardName}: ${slice}`;
}
```

## lib\csep\csep-dedupe-rules.ts

```ts
type DedupeSubsection = {
  paragraphs?: string[];
  items?: string[];
  table?: {
    rows: string[][];
  } | null;
};

export const CSEP_SECTION_OWNERSHIP_PATTERNS = {
  trade_interaction_and_coordination:
    /\b(overlap|overlapping trades|shared work|shared area|interface|coordination|handoff|trade interaction|trade-specific access|definition)\b/i,
  site_access_security_laydown_traffic_control:
    /\b(worker access|site entry|badge|visitor|delivery|deliveries|truck|trucking|traffic control|laydown|staging|restricted area|access control|end[-\s]?of[-\s]?shift|security)\b/i,
  hazard_communication_and_environmental_protection:
    /\b(hazcom|hazard communication|sds|safety data sheet|label|labels|chemical inventory|ghs|nfpa|secondary container|chemical communication|spill|waste|stormwater|drain|dust|noise|environmental)\b/i,
  emergency_response_and_rescue:
    /\b(emergency response|rescue|medical response|ems|911|evacuation|shelter|fire response|suspension trauma)\b/i,
  iipp_incident_reporting_corrective_action:
    /\b(incident reporting|near[-\s]?miss|investigation|corrective action|restart|scene protection|trend)\b/i,
  worker_conduct_fit_for_duty_disciplinary_program:
    /\b(fit[-\s]?for[-\s]?duty|drug|alcohol|disciplin|unsafe act|site removal|fatigue|wellness|impairment)\b/i,
  hazard_control_modules:
    /\b(hazard|exposure|required controls?|verify|verification|stop[-\s]?work|trigger|field control|R\d+|OSHA|29\s*CFR|subpart)\b/i,
} as const;

export const CSEP_HAZARD_NON_OWNER_POLICY_PATTERN =
  /\b(visitor|badge|site entry|delivery|trucking|traffic control|laydown|staging|chemical inventory|ghs|nfpa|secondary container|fit[-\s]?for[-\s]?duty|drug|alcohol|work attire|hard hat|safety glasses|hi[-\s]?vis)\b/i;

export function sectionHasContent(subsection: DedupeSubsection): boolean {
  return Boolean(
    subsection.paragraphs?.some((p) => p.trim()) ||
      subsection.items?.some((i) => i.trim()) ||
      subsection.table?.rows.some((row) => row.some((cell) => (cell ?? "").trim()))
  );
}
```

## lib\csep\csep-renderer.ts

```ts
export {
  buildCsepOutlinePlan,
  buildCsepRenderModelFromGeneratedDraft,
  buildCsepTemplateSections,
  renderCsepRenderModel,
  renderGeneratedCsepDocx,
  createCsepDocument,
} from "@/lib/csepDocxRenderer";

export type {
  CsepRenderModel,
  CsepTemplateSection,
  CsepTemplateSubsection,
  CsepOutlinePlanEntry,
} from "@/lib/csepDocxRenderer";

```

## lib\csepDocxRenderer.ts

```ts
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
  getSafetyBlueprintDraftFilename,
} from "@/lib/safetyBlueprintLabels";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildStructuredCsepDraft } from "@/lib/csepBuilder";
import { getProjectSpecificSafetyNotesNarrativeBody } from "@/lib/csepSiteSpecificNotes";
import {
  buildCsepPpeSectionBulletsFromCombined,
  cleanFinalText,
  dedupePpeItemsForExport,
  flattenPpeSectionBulletsToItems,
  normalizeFinalExportText,
  normalizeHazardList,
  normalizePermitList,
  normalizePpeList,
} from "@/lib/csepFinalization";
import { polishCsepDocxNarrativeText, splitCsepDocxBodyIntoSegments } from "@/lib/csepDocxNarrativePolish";
import {
  expandParagraphsForDocxReadability,
  splitParagraphAtEstimatedDocxLineCount,
} from "@/lib/csepDocxReadableParagraphs";
import {
  CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
  relocateSafetyProgramReferencePacks,
} from "@/lib/csepSafetyProgramReferenceRelocation";
import { formatGcCmPartnersForExport, normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import {
  CSEP_WORK_ATTIRE_DEFAULT_BULLETS,
  CSEP_WORK_ATTIRE_SUBSECTION_BODY,
} from "@/lib/csepWorkAttireDefaults";
import { assertCsepExportQuality } from "@/lib/csepExportQualityCheck";
import { CANONICAL_CSEP_SECTION_ORDER } from "@/lib/csep/csep-section-order";
import {
  CSEP_HAZARD_NON_OWNER_POLICY_PATTERN,
  CSEP_SECTION_OWNERSHIP_PATTERNS,
  sectionHasContent,
} from "@/lib/csep/csep-dedupe-rules";
import { CSEP_HAZARD_TEMPLATE_SLICES, buildHazardSliceTitle } from "@/lib/csep/csep-hazard-template";
import { CSEP_REGULATORY_REFERENCE_INDEX } from "@/lib/csepRegulatoryReferenceIndex";
import type { GeneratedSafetyPlanDraft, GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

export type CsepCoverMetadataRow = {
  label: string;
  value: string;
};

export type CsepRevisionEntry = {
  revision: string;
  date: string;
  description: string;
  preparedBy: string;
  approvedBy: string;
};

export type CsepTemplateSubsection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  table?: GeneratedSafetyPlanSection["table"];
  /**
   * For simple one-line task lists (e.g. Scope Summary task bullets), render `items` as indented
   * body lines without subsection numbering. Defaults to numbered list styling.
   */
  plainItemsStyle?: "numbered" | "offset_lines";
  /**
   * Task-hazard matrices and similar tables: render rows as indented blocks without
   * a deep 5.85.1-style number chain. Default is numbered rows for legacy tables.
   */
  tableRowsStyle?: "numbered" | "offset_lines";
};

export type CsepTemplateSection = {
  key: string;
  title: string;
  kind?: "front_matter" | "main" | "appendix" | "gap";
  numberLabel?: string | null;
  descriptor?: string | null;
  subsections: CsepTemplateSubsection[];
  closingTagline?: string | null;
};

export type CsepRenderModel = {
  projectName: string;
  contractorName: string;
  /**
   * Workspace / configured company name shown in every page footer.
   * Falls back to "Safety360Docs" when not supplied (see `normalizeRenderModel`).
   */
  footerCompanyName: string;
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
  issueLabel: string;
  /** Semicolon-separated tasks for the title page (may be "N/A"). */
  titlePageTaskSummary: string;
  /** Project address or location line for the title page. */
  titlePageProjectLocation: string;
  /** Governing state / jurisdiction for the title page (may be "N/A"). */
  titlePageGoverningState: string;
  statusLabel: string;
  preparedBy: string;
  coverSubtitleLines: string[];
  coverMetadataRows: CsepCoverMetadataRow[];
  coverLogo?: {
    data: Uint8Array;
    type: "png" | "jpg" | "gif" | "bmp";
  } | null;
  approvalLines: string[];
  revisionHistory: CsepRevisionEntry[];
  frontMatterSections: CsepTemplateSection[];
  sections: CsepTemplateSection[];
  appendixSections: CsepTemplateSection[];
  disclaimerLines: readonly string[];
  filenameProjectPart: string;
};

type BuildCsepTemplateSectionsParams = {
  draft?: GeneratedSafetyPlanDraft;
  projectName: string;
  contractorName: string;
  tradeLabel?: string | null;
  subTradeLabel?: string | null;
  issueLabel?: string;
  taskTitles?: string[];
  sourceSections: GeneratedSafetyPlanSection[];
};

type FixedSectionDefinition = {
  key: string;
  /** Base title without outline numbers; ordinals come from `buildCsepOutlinePlan`. */
  title: string;
  kind: "front_matter" | "main";
  descriptor: string;
};

type ParsedSourceNumberedItem = {
  title: string;
  body: string;
};

const STYLE_IDS = {
  body: "CsepBody",
  coverTitle: "CsepCoverTitle",
  coverSubtitle: "CsepCoverSubtitle",
  coverMeta: "CsepCoverMeta",
  sectionHeading: "CsepSectionHeading",
  sectionDescriptor: "CsepSectionDescriptor",
  subheading: "CsepSubheading",
  contentsEntry: "CsepContentsEntry",
} as const;

const COLORS = {
  ink: "1F1F1F",
  titleBlue: "365F91",
  headingBlue: "4F81BD",
  deepBlue: "17365D",
  accentRed: "D63A34",
  gray: "7A7A7A",
  border: "C6D4E1",
} as const;

const INDENTS = {
  numberedLeft: 180,
  numberedHanging: 180,
  childLeft: 540,
  childHanging: 240,
  childBodyLeft: 780,
  grandchildLeft: 900,
  grandchildHanging: 240,
  grandchildBodyLeft: 1140,
} as const;

const FIXED_SECTION_DEFINITIONS: FixedSectionDefinition[] = [...CANONICAL_CSEP_SECTION_ORDER];

function todayIssueLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

function finalValueOrNA(value?: string | null) {
  return normalizeFinalExportText(value) ?? "N/A";
}

function finalPartyValueOrNA(value?: string | null) {
  const normalized = value
    ?.replace(/\r\n?/g, "\n")
    .split(/\n|;/)
    .map((item) => normalizeFinalExportText(item)?.trim() ?? "")
    .filter(Boolean);

  return normalized && normalized.length ? Array.from(new Set(normalized)).join("; ") : "N/A";
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

function uniqueItems(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function joinDisplayValues(values: Array<string | null | undefined>, fallback = "N/A") {
  const normalized = uniqueValues(values);
  return normalized.length ? normalized.join(" / ") : fallback;
}

function sanitizeGeneratedText(value?: string | null) {
  if (!value) return "";
  return (
    normalizeFinalExportText(
      value
    .replace(/\bContractor Blueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .replace(/\bSite Blueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .replace(/\bBlueprint\b/g, CONTRACTOR_SAFETY_BLUEPRINT_TITLE)
    .trim()
    ) ?? ""
  );
}

function sanitizeGeneratedSection(section: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection {
  return {
    ...section,
    title: sanitizeGeneratedText(section.title),
    summary: sanitizeGeneratedText(section.summary ?? ""),
    body: sanitizeGeneratedText(section.body ?? ""),
    bullets: section.bullets?.map((bullet) => sanitizeGeneratedText(bullet)),
    subsections: section.subsections?.map((subsection) => ({
      title: sanitizeGeneratedText(subsection.title),
      body: sanitizeGeneratedText(subsection.body ?? ""),
      bullets: subsection.bullets.map((bullet) => sanitizeGeneratedText(bullet)),
    })),
    table: section.table
      ? {
          columns: section.table.columns.map((column) => sanitizeGeneratedText(column)),
          rows: section.table.rows.map((row) => row.map((cell) => sanitizeGeneratedText(cell))),
        }
      : null,
  };
}

function splitParagraphs(value?: string | null) {
  return (value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function inlineNumberMarkerIndexes(value: string) {
  return Array.from(value.matchAll(/(?:^|\s)(\d+)\.\s+/g)).map((match) => ({
    index: (match.index ?? 0) + (match[0].startsWith(" ") ? 1 : 0),
  }));
}

function normalizeInlineEnumeratedItem(value: string) {
  const cleaned = normalizeFinalExportText(value)?.trim() ?? "";
  if (!cleaned) return null;
  if (/^[a-z]/.test(cleaned)) return null;
  if (/^[\d.]/.test(cleaned)) return null;
  if (
    !/\b(is|are|shall|must|should|confirm|verify|review|document|maintain|ensure|inspect|complete|use|obtain|coordinate|provide|keep|stop|leave|remove|restore|report|assign)\b/i.test(
      cleaned
    )
  ) {
    return null;
  }
  if (!/[.!?]$/.test(cleaned) && cleaned.split(/\s+/).length <= 5) return null;
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function splitInlineEnumeratedParagraph(value: string) {
  const cleaned = cleanFinalText(value)?.trim() ?? "";
  if (!cleaned) {
    return { intro: null as string | null, items: [] as string[] };
  }

  const markers = inlineNumberMarkerIndexes(cleaned);
  if (markers.length === 0) {
    return { intro: normalizeFinalExportText(cleaned), items: [] as string[] };
  }

  const firstIndex = markers[0]?.index ?? 0;
  const intro = normalizeFinalExportText(cleaned.slice(0, firstIndex)) ?? null;
  const items: string[] = [];

  markers.forEach((marker, index) => {
    const nextMarker = markers[index + 1];
    const rawSegment = cleaned
      .slice(marker.index, nextMarker ? nextMarker.index : undefined)
      .replace(/^\d+\.\s+/, "")
      .trim();
    const normalized = normalizeInlineEnumeratedItem(rawSegment);
    if (normalized) {
      items.push(normalized);
    }
  });

  if (!items.length) {
    return { intro: intro ?? cleaned, items };
  }

  return { intro, items };
}

function splitInlineEnumeratedParagraphs(paragraphs: string[]) {
  const cleanParagraphs: string[] = [];
  const items: string[] = [];

  paragraphs.forEach((paragraph) => {
    const split = splitInlineEnumeratedParagraph(paragraph);
    if (split.intro) {
      cleanParagraphs.push(split.intro);
    }
    items.push(...split.items);
  });

  return {
    paragraphs: uniqueItems(cleanParagraphs),
    items: uniqueItems(items),
  };
}

function normalizeCompareToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripExistingNumberPrefix(value: string) {
  return value
    .replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "")
    .replace(/^Appendix\s+[A-Z](?:\.\d+)*\.?\s+/i, "")
    .trim();
}

function splitSentenceValues(value?: string | null) {
  const normalized = normalizeFinalExportText(value)?.trim();
  if (!normalized) return [];

  return uniqueItems(
    normalized
      .split(/\s*[,;]\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function tableColumnIndexes(table: NonNullable<GeneratedSafetyPlanSection["table"]>) {
  const columns = table.columns.map((column) => normalizeToken(column));

  const findIndex = (...aliases: string[]) =>
    columns.findIndex((column) => aliases.some((alias) => column === normalizeToken(alias)));

  return {
    trade: findIndex("trade", "trade subtrade", "trade / subtrade"),
    subTrade: findIndex("subtrade", "sub-trade"),
    activity: findIndex("activity", "task", "task title"),
    hazards: findIndex("hazard", "hazards", "primary hazard", "main hazards"),
    controls: findIndex("control", "controls", "required controls"),
    ppe: findIndex("ppe", "required ppe"),
    permits: findIndex("permit", "permits", "required permits"),
    competency: findIndex("competency", "training", "training requirements"),
  };
}

function valueAt(row: string[], index: number) {
  return index >= 0 ? normalizeFinalExportText(row[index]) : null;
}

function joinSentenceList(values: string[]) {
  if (!values.length) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatActivityMatrixRow(
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  row: string[]
) {
  const indexes = tableColumnIndexes(table);
  const hasActivityMatrixContent = [
    indexes.trade,
    indexes.subTrade,
    indexes.activity,
    indexes.hazards,
    indexes.controls,
    indexes.ppe,
    indexes.permits,
    indexes.competency,
  ].some((index) => index >= 0);

  if (!hasActivityMatrixContent) {
    return null;
  }

  const trade = valueAt(row, indexes.trade);
  const subTrade = valueAt(row, indexes.subTrade);
  const activity = valueAt(row, indexes.activity);
  const hazards = normalizeHazardList(splitSentenceValues(valueAt(row, indexes.hazards)));
  const controls = splitSentenceValues(valueAt(row, indexes.controls));
  const ppe = dedupePpeItemsForExport(splitSentenceValues(valueAt(row, indexes.ppe)));
  const permits = normalizePermitList(splitSentenceValues(valueAt(row, indexes.permits)));
  const competency = splitSentenceValues(valueAt(row, indexes.competency));

  const scope = joinDisplayValues([trade, subTrade], "");
  const sentences: string[] = [];

  if (activity && scope) {
    sentences.push(`${activity} for ${scope} involves ${joinSentenceList(hazards)}.`);
  } else if (activity && hazards.length) {
    sentences.push(`${activity} involves ${joinSentenceList(hazards)}.`);
  } else if (scope && hazards.length) {
    sentences.push(`${scope} work involves ${joinSentenceList(hazards)}.`);
  }

  if (controls.length) {
    sentences.push(`Required controls include ${joinSentenceList(controls)}.`);
  }

  if (ppe.length) {
    sentences.push(`Required PPE includes ${joinSentenceList(ppe)}.`);
  }

  if (permits.length) {
    sentences.push(`Required permits include ${joinSentenceList(permits)}.`);
  }

  if (competency.length) {
    sentences.push(`Required competency includes ${joinSentenceList(competency)}.`);
  }

  if (!sentences.length) {
    const fallback = normalizeFinalExportText(
      row.map((cell) => cell?.trim()).filter(Boolean).join(" ")
    );
    return fallback || null;
  }

  return sentences.join(" ");
}

function isTaskHazardStyleTable(table: NonNullable<GeneratedSafetyPlanSection["table"]>) {
  const indexes = tableColumnIndexes(table);
  return [
    indexes.trade,
    indexes.subTrade,
    indexes.activity,
    indexes.hazards,
    indexes.controls,
    indexes.ppe,
    indexes.permits,
  ].some((index) => index >= 0);
}

/**
 * Matrices and line-list tables should not produce a deep outline (e.g. 5.85.1, 5.85.2 for each row).
 */
function shouldUseOffsetTableRows(
  source: Pick<GeneratedSafetyPlanSection, "key" | "title" | "table">
): boolean {
  if (!source.table?.rows.length) return false;
  const key = normalizeToken(source.key ?? "");
  const title = normalizeToken(source.title ?? "");
  if (
    key.includes("activity_hazard") ||
    key.includes("task_hazard") ||
    (key.includes("matrix") && (key.includes("hazard") || key.includes("task") || key.includes("steel"))) ||
    (title.includes("hazard") && title.includes("matrix")) ||
    (title.includes("task") && title.includes("matrix")) ||
    (title.includes("steel") && title.includes("matrix")) ||
    title.includes("hazardcontrolmatrix") ||
    title.includes("activityhazard")
  ) {
    return true;
  }
  return isTaskHazardStyleTable(source.table);
}

function stripSourceNumberingLabel(value?: string | null) {
  const normalized = normalizeFinalExportText(value) ?? "";
  return stripExistingNumberPrefix(normalized);
}

function parseSourceNumberedItem(value?: string | null): ParsedSourceNumberedItem | null {
  const raw = value?.trim() ?? "";
  if (!/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i.test(raw)) {
    return null;
  }

  const withoutNumber = stripExistingNumberPrefix(raw);
  if (!withoutNumber) {
    return null;
  }

  const matched = withoutNumber.match(/^(.+?)(?:\s{2,}|:\s+)(.+)$/);
  if (!matched) {
    return null;
  }

  const [, rawTitle, rawBody] = matched;
  const title = stripSourceNumberingLabel(rawTitle);
  const body = normalizeFinalExportText(rawBody)?.trim() ?? "";
  if (!title || !body) {
    return null;
  }

  return { title, body };
}

function normalizeDisplayPrefix(value: string) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

function splitNarrativeSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function cleanRoleLabel(value: string) {
  return value
    .replace(/^role:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function subsectionHasContent(subsection: CsepTemplateSubsection) {
  return Boolean(
    subsection.paragraphs?.some((paragraph) => paragraph.trim()) ||
      subsection.items?.some((item) => item.trim()) ||
      subsection.table?.rows.some((row) => row.some((cell) => cell.trim()))
  );
}

function normalizeLeadingVisibleBlock(value?: string | null) {
  const cleaned = value?.trim();
  if (!cleaned) return null;

  const withoutLeadingPunctuation = cleaned.replace(/^[,;:]+\s*/, "");
  return withoutLeadingPunctuation.replace(/^([a-z])/, (match) => match.toUpperCase());
}

function normalizeSubsectionLead(subsection: CsepTemplateSubsection): CsepTemplateSubsection {
  const paragraphs = [...(subsection.paragraphs ?? [])];
  const items = [...(subsection.items ?? [])];

  if (paragraphs.length) {
    const normalized = normalizeLeadingVisibleBlock(paragraphs[0]);
    if (normalized) {
      paragraphs[0] = normalized;
    }
  } else if (items.length) {
    const normalized = normalizeLeadingVisibleBlock(items[0]);
    if (normalized) {
      items[0] = normalized;
    }
  }

  return {
    ...subsection,
    paragraphs: paragraphs.length ? uniqueItems(paragraphs) : subsection.paragraphs,
    items: items.length ? uniqueItems(items) : subsection.items,
  };
}

const GENERIC_SUBSECTION_TITLES = new Set(
  [
    "risk",
    "when it applies",
    "purpose",
    "hazard overview",
    "task scope and sequence",
    "program scope",
    "pre start verification",
    "required controls",
    "how controls are met and verified",
    "how controls are verified",
    "permits and ppe",
    "stop-work / hold-point triggers",
    "stop work hold point triggers",
    "stop-work triggers",
    "stop work triggers",
    "verification and handoff",
    "related interfaces",
    "applicable references",
    "references",
    "responsibilities and training",
    "minimum required controls",
    // Per-program procedure subsections produced by buildCsepProgramSection in
    // lib/csepPrograms.ts. Multiple programs can land in the same fixed
    // section (e.g. "Task Execution Modules"), so these generic titles must be
    // prefixed with their source program title to avoid duplicate headings
    // under a shared parent section.
    "pre task setup",
    "work execution",
    "stop work escalation",
    "post task closeout",
    "related tasks",
  ].map((value) => normalizeCompareToken(value))
);

function contextualizeSubsectionTitle(sourceTitle: string, subsectionTitle: string) {
  const cleanSourceTitle = stripExistingNumberPrefix(sourceTitle).trim();
  const cleanSubsectionTitle = stripExistingNumberPrefix(subsectionTitle).trim();
  if (!cleanSourceTitle || !cleanSubsectionTitle) {
    return subsectionTitle;
  }

  const normalizedSubsectionTitle = normalizeCompareToken(cleanSubsectionTitle);
  if (!GENERIC_SUBSECTION_TITLES.has(normalizedSubsectionTitle)) {
    return subsectionTitle;
  }

  if (normalizeCompareToken(cleanSourceTitle) === normalizedSubsectionTitle) {
    return subsectionTitle;
  }

  return `${cleanSourceTitle}: ${cleanSubsectionTitle}`;
}

function normalizeTemplateSection(section: CsepTemplateSection): CsepTemplateSection {
  return {
    ...section,
    subsections: section.subsections.map((subsection) => normalizeSubsectionLead(subsection)),
  };
}

function normalizeRenderModel(model: CsepRenderModel): CsepRenderModel {
  return {
    ...model,
    footerCompanyName: model.footerCompanyName?.trim() || "Safety360Docs",
    frontMatterSections: model.frontMatterSections.map((section) => normalizeTemplateSection(section)),
    sections: model.sections.map((section) => normalizeTemplateSection(section)),
    appendixSections: model.appendixSections.map((section) => normalizeTemplateSection(section)),
  };
}

function dedupeTemplateSubsections(subsections: CsepTemplateSubsection[]) {
  const seen = new Set<string>();

  return subsections
    .map((subsection) => normalizeSubsectionLead(subsection))
    .filter((subsection) => {
    const key = JSON.stringify({
      title: normalizeCompareToken(subsection.title),
      paragraphs: (subsection.paragraphs ?? []).map(normalizeCompareToken),
      items: (subsection.items ?? []).map(normalizeCompareToken),
      plainItemsStyle: subsection.plainItemsStyle ?? null,
      table: subsection.table
        ? {
            columns: subsection.table.columns.map(normalizeCompareToken),
            rows: subsection.table.rows.map((row) => row.map(normalizeCompareToken)),
          }
        : null,
      tableRowsStyle: subsection.tableRowsStyle ?? null,
    });

    if (seen.has(key)) return false;
    seen.add(key);
    return subsectionHasContent(subsection);
    });
}

// Strips sentences and bullet items that already appeared in a prior subsection
// of the same bucket. Prevents the sentence-level repeat validator from firing
// when multiple programs (e.g. two hazards routed to "Task Execution Modules")
// legitimately share common references, controls, or stop-work phrasing. The
// first occurrence wins; empty subsections are dropped.
function stripSharedContentAcrossSubsections(
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  const seen = new Set<string>();
  const result: CsepTemplateSubsection[] = [];

  for (const subsection of subsections) {
    const filteredParagraphs: string[] = [];
    for (const paragraph of subsection.paragraphs ?? []) {
      const sentences = splitNarrativeSentences(paragraph);
      const keptSentences: string[] = [];
      for (const sentence of sentences) {
        const normalized = normalizeCompareToken(sentence);
        if (!normalized) {
          keptSentences.push(sentence);
          continue;
        }
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        keptSentences.push(sentence);
      }
      const rebuilt = keptSentences.join(" ").trim();
      if (rebuilt) filteredParagraphs.push(rebuilt);
    }

    const filteredItems: string[] = [];
    for (const item of subsection.items ?? []) {
      const normalized = normalizeCompareToken(item);
      if (!normalized) {
        filteredItems.push(item);
        continue;
      }
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      filteredItems.push(item);
    }

    const next: CsepTemplateSubsection = {
      ...subsection,
      paragraphs: filteredParagraphs,
      items: filteredItems,
    };

    if (subsectionHasContent(next)) {
      result.push(next);
    }
  }

  return result;
}

function validateNoRepeatedSentences(section: CsepTemplateSection) {
  const seen = new Set<string>();

  for (const subsection of section.subsections) {
    const sentences = [
      ...(subsection.paragraphs ?? []).flatMap(splitNarrativeSentences),
      ...(subsection.items ?? []),
    ]
      .map(normalizeCompareToken)
      .filter(Boolean);

    for (const sentence of sentences) {
      if (seen.has(sentence)) {
        throw new Error(`CSEP export validation failed: repeated content detected in section ${section.title}.`);
      }
      seen.add(sentence);
    }
  }
}

type VisibleModelTextEntry = {
  label: string;
  value: string;
};

function collectVisibleModelText(model: CsepRenderModel): VisibleModelTextEntry[] {
  const visibleSections = [...model.frontMatterSections, ...model.sections, ...model.appendixSections];

  return [
    { label: "Project name", value: model.projectName },
    { label: "Contractor", value: model.contractorName },
    { label: "Trade", value: model.tradeLabel ?? "" },
    { label: "Sub-trade", value: model.subTradeLabel ?? "" },
    { label: "Issue date", value: model.issueLabel },
    { label: "Status", value: model.statusLabel },
    { label: "Prepared by", value: model.preparedBy },
    ...model.coverSubtitleLines.map((value, index) => ({
      label: `Cover subtitle ${index + 1}`,
      value,
    })),
    ...model.coverMetadataRows.map((row) => ({
      label: `Cover metadata: ${row.label}`,
      value: row.value,
    })),
    ...model.approvalLines.map((value, index) => ({
      label: `Approval line ${index + 1}`,
      value,
    })),
    ...model.revisionHistory.flatMap((row, index) => [
      { label: `Revision history ${index + 1}: revision`, value: row.revision },
      { label: `Revision history ${index + 1}: date`, value: row.date },
      { label: `Revision history ${index + 1}: description`, value: row.description },
      { label: `Revision history ${index + 1}: prepared by`, value: row.preparedBy },
      { label: `Revision history ${index + 1}: approved by`, value: row.approvedBy },
    ]),
    ...visibleSections.flatMap((section) => [
      { label: `Section title: ${section.key}`, value: section.title },
      { label: `Section number: ${section.key}`, value: section.numberLabel ?? "" },
      { label: `Section closing tagline: ${section.key}`, value: section.closingTagline ?? "" },
      ...section.subsections.flatMap((subsection, subsectionIndex) => [
        {
          label: `Subsection title: ${section.title} / ${subsectionIndex + 1}`,
          value: subsection.title,
        },
        ...(subsection.paragraphs ?? []).map((value, paragraphIndex) => ({
          label: `Subsection paragraph: ${section.title} / ${subsection.title || subsectionIndex + 1} / ${paragraphIndex + 1}`,
          value,
        })),
        ...(subsection.items ?? []).map((value, itemIndex) => ({
          label: `Subsection item: ${section.title} / ${subsection.title || subsectionIndex + 1} / ${itemIndex + 1}`,
          value,
        })),
        ...(subsection.table
          ? [
              ...subsection.table.columns.map((value, columnIndex) => ({
                label: `Subsection table column: ${section.title} / ${subsection.title || subsectionIndex + 1} / ${columnIndex + 1}`,
                value,
              })),
              ...subsection.table.rows.flatMap((row, rowIndex) =>
                row.map((value, columnIndex) => ({
                  label: `Subsection table cell: ${section.title} / ${subsection.title || subsectionIndex + 1} / row ${rowIndex + 1} col ${columnIndex + 1}`,
                  value,
                }))
              ),
            ]
          : []),
      ]),
    ]),
    ...model.disclaimerLines.map((value, index) => ({
      label: `Disclaimer line ${index + 1}`,
      value,
    })),
  ].filter((entry) => Boolean(entry.value));
}

function validateSectionOrdering(sections: CsepTemplateSection[]) {
  let priorNumbers: number[] | null = null;

  sections.forEach((section) => {
    const numberLabel = section.numberLabel?.trim() ?? "";
    if (!numberLabel) return;

    const parsed = normalizeDisplayPrefix(numberLabel)
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part));

    if (!parsed.length) return;

    if (priorNumbers) {
      const maxLength = Math.max(priorNumbers.length, parsed.length);
      for (let index = 0; index < maxLength; index += 1) {
        const priorValue = priorNumbers[index] ?? 0;
        const currentValue = parsed[index] ?? 0;
        if (currentValue > priorValue) break;
        if (currentValue < priorValue) {
          throw new Error(
            `CSEP export validation failed: section numbering is out of order at ${section.title}.`
          );
        }
      }
    }

    priorNumbers = parsed;
  });
}

function resolveSectionNumberLabelForValidation(
  section: CsepTemplateSection,
  index: number
): string | null {
  if (section.numberLabel === null) {
    return null;
  }
  const trimmed = section.numberLabel?.trim() ?? "";
  if (trimmed) {
    return trimmed;
  }
  return String(index + 1);
}

function validateCsepRenderModel(model: CsepRenderModel) {
  const numberedSections = model.sections.map((section, index) => ({
    ...section,
    numberLabel: resolveSectionNumberLabelForValidation(section, index),
  }));
  const seenNumbers = new Set<string>();
  const invalidExactTokens = new Set([
    "test",
    "pending approval",
    "platform fill field",
    "fill",
    "safetydocs360 ai draft builder",
  ]);
  const placeholderPattern =
    /tbd by contractor before issue|company logo placement|insert contractor logo|page\s+of/i;
  const bannedInternalPhrasePattern =
    /Applicability \/ trigger logic|Included for this scope|Review these sections first|Interfaces to coordinate|selected program hazard|Use this module to align sequence, access, and handoffs with that work|primary exposure|secondary exposure|changing condition risk|task scope\s*&\s*work conditions|main exposure profile|program purpose and applicability/i;

  validateSectionOrdering(numberedSections);

  numberedSections.forEach((section) => {
    const numberLabel = section.numberLabel?.trim() ?? "";
    const isFlatProgramSection = usesFlatProgramOutline(section);
    if (!numberLabel) {
      // Unnumbered sections (explicit null numberLabel).
    } else if (seenNumbers.has(numberLabel)) {
      throw new Error(`CSEP export validation failed: duplicate section number ${numberLabel}.`);
    } else {
      seenNumbers.add(numberLabel);
    }

    const seenTitles = new Set<string>();
    section.subsections.forEach((subsection) => {
      const normalizedTitle = normalizeCompareToken(subsection.title);
      if (normalizedTitle) {
        if (!isFlatProgramSection && seenTitles.has(normalizedTitle)) {
          throw new Error(
            `CSEP export validation failed: duplicate subsection heading "${subsection.title}" under ${section.title}.`
          );
        }
        seenTitles.add(normalizedTitle);
      }

      if (!subsectionHasContent(subsection)) {
        throw new Error(
          `CSEP export validation failed: subsection "${subsection.title || section.title}" is empty.`
        );
      }

      const firstBlock = subsection.paragraphs?.[0] ?? subsection.items?.[0] ?? "";
      if (firstBlock && /^[a-z,;:]/.test(firstBlock.trim())) {
        throw new Error(
          `CSEP export validation failed: subsection "${subsection.title || section.title}" starts mid-sentence.`
        );
      }
    });

    if (!isFlatProgramSection) {
      validateNoRepeatedSentences(section);
    }
  });

  const visibleText = collectVisibleModelText(model);
  const placeholderEntry = visibleText.find((entry) => {
    const normalized = normalizeCompareToken(entry.value);
    return (
      invalidExactTokens.has(normalized) ||
      placeholderPattern.test(entry.value) ||
      bannedInternalPhrasePattern.test(entry.value)
    );
  });

  if (placeholderEntry) {
    const preview = placeholderEntry.value.replace(/\s+/g, " ").trim().slice(0, 120);
    const isInternalPhrase = bannedInternalPhrasePattern.test(placeholderEntry.value);
    throw new Error(
      isInternalPhrase
        ? `CSEP export validation failed: internal-only generation terminology remains in final export. Source: ${placeholderEntry.label} = "${preview}".`
        : `CSEP export validation failed: unresolved placeholder content remains in final export. Source: ${placeholderEntry.label} = "${preview}".`
    );
  }
}

function buildRoleAliases(value: string) {
  const cleanValue = cleanRoleLabel(value);
  if (!cleanValue) return [];

  const aliases = new Set<string>([cleanValue]);
  cleanValue
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      aliases.add(part);
      aliases.add(part.replace(/^cm\s+/i, "").trim());
      aliases.add(part.replace(/^project\s+/i, "").trim());
    });
  aliases.add(cleanValue.replace(/^cm\s+/i, "").trim());
  aliases.add(cleanValue.replace(/^project\s+/i, "").trim());

  return Array.from(aliases).filter(Boolean);
}

function buildRoleReplacementItems(source: GeneratedSafetyPlanSection) {
  if (source.key !== "roles_and_responsibilities") {
    return [];
  }

  const narrative = uniqueItems([
    ...splitParagraphs(source.summary),
    ...splitParagraphs(source.body),
  ]).join(" ");
  if (!narrative) {
    return [];
  }

  const defaultRoles = [
    "CM Project Manager",
    "Project Manager",
    "CM Project Superintendent",
    "Project Superintendent",
    "Superintendent",
    "Competent Person",
    "Foreman / Crew Lead",
    "Foreman",
    "Crew Lead",
    "Workers",
    "All site workers",
  ];
  const tableRoles = (source.table?.rows ?? [])
    .map((row) => cleanRoleLabel(row[0] ?? ""))
    .filter(Boolean);
  const roleAnchors = uniqueItems([...tableRoles, ...defaultRoles]).map((title) => ({
    title,
    aliases: buildRoleAliases(title),
  }));
  const matches: Array<{ start: number; end: number; title: string; matchedText: string }> = [];

  roleAnchors.forEach((anchor) => {
    anchor.aliases
      .sort((left, right) => right.length - left.length)
      .forEach((alias) => {
        const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi");
        let match = pattern.exec(narrative);
        while (match) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            title: anchor.title,
            matchedText: match[0],
          });
          match = pattern.exec(narrative);
        }
      });
  });

  const orderedMatches = matches
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((match, index, collection) => {
      const previous = collection[index - 1];
      if (!previous) return true;
      return match.start >= previous.end;
    });

  if (orderedMatches.length < 2) {
    return [];
  }

  return orderedMatches
    .map((match, index) => {
      const nextStart = orderedMatches[index + 1]?.start ?? narrative.length;
      let chunk = narrative.slice(match.start, nextStart).trim();
      chunk = chunk.replace(new RegExp(`^${escapeRegExp(match.matchedText)}\\b[:\\-\\s]*`, "i"), "").trim();
      chunk = chunk.replace(/^(?:is\s+responsible\s+for|is\s+responsible\s+to|is|will|shall|must)\s+/i, "");

      const sentences = splitNarrativeSentences(chunk);
      const responsibilitySentences: string[] = [];
      const authoritySentences: string[] = [];

      sentences.forEach((sentence) => {
        if (
          /stop[-\s]?work|authority|hold point|approve|authorization|authorize|restart|do not release|release the crew|hold access/i.test(
            sentence
          )
        ) {
          authoritySentences.push(sentence);
          return;
        }
        responsibilitySentences.push(sentence);
      });

      const parts = [`Role: ${match.title}`];
      if (responsibilitySentences.length) {
        parts.push(`Core Responsibilities: ${responsibilitySentences.join(" ")}`);
      } else if (!authoritySentences.length && chunk) {
        parts.push(chunk);
      }
      if (authoritySentences.length) {
        parts.push(`Authority / Hold Point: ${authoritySentences.join(" ")}`);
      }

      return parts.join(" ").trim();
    })
    .filter(Boolean);
}

function buildRuleTableSubsections(
  source: GeneratedSafetyPlanSection
): CsepTemplateSubsection[] {
  if (!source.table?.rows.length) {
    return [];
  }

  const columns = source.table.columns.map(normalizeToken);
  if (!columns.includes("rule domain") || !columns.includes("rule text")) {
    return [];
  }

  const items = uniqueItems(
    source.table.rows
      .map((row) => {
        const ruleDomain = stripExistingNumberPrefix(cleanFinalText(row[0]) ?? "");
        const ruleText = cleanFinalText(row[1]) ?? "";
        return [ruleDomain, ruleText].filter(Boolean).join(": ").trim();
      })
      .filter(Boolean)
  );

  if (!items.length) {
    return [];
  }

  return [
    {
      title: normalizeToken(source.key) === "life_saving_rules" ? "Life-Saving Rules" : source.title,
      items,
      plainItemsStyle: "offset_lines",
    },
  ];
}

function buildTradeSummarySubsections(
  source: GeneratedSafetyPlanSection
): CsepTemplateSubsection[] | null {
  if (normalizeToken(source.key) !== "trade summary") {
    return null;
  }

  const paragraphs = uniqueItems([
    ...splitParagraphs(source.summary),
    ...splitParagraphs(source.body),
  ]);
  const items = uniqueItems(source.bullets ?? []);
  const table = source.table;

  if (!table?.rows.length) {
    return [
      {
        title: "Trade and hazard context",
        paragraphs,
        items,
      },
    ];
  }

  const columns = table.columns.map(normalizeToken);
  const tradeIndex = columns.findIndex((column) => column === "trade");
  const subTradeIndex = columns.findIndex((column) => column === "sub trade");
  const hazardIndex = columns.findIndex((column) => column === "hazards");
  const permitIndex = columns.findIndex((column) => column === "permits");

  const tradePackages = uniqueItems(
    table.rows.map((row) =>
      [row[tradeIndex] ?? "", row[subTradeIndex] ?? ""]
        .map((value) => cleanFinalText(value))
        .filter(Boolean)
        .join(" / ")
    )
  );
  const hazards = uniqueItems(
    table.rows.flatMap((row) =>
      (row[hazardIndex] ?? "")
        .split(/,\s*/)
        .map((value) => cleanFinalText(value))
    )
  );
  const permits = uniqueItems(
    table.rows.flatMap((row) =>
      (row[permitIndex] ?? "")
        .split(/,\s*/)
        .map((value) => cleanFinalText(value))
    )
  ).filter((value) => normalizeToken(value) !== "none");

  const synthesizedParagraph = normalizeFinalExportText(
    [
      tradePackages.length
        ? `Planning context for ${tradePackages.join(", ")}; use Scope Summary for the task list.`
        : null,
      hazards.length ? `Primary hazards include ${hazards.join(", ")}.` : null,
      permits.length ? `Anticipated permit triggers include ${permits.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return [
    {
      title: "Trade and hazard context",
      paragraphs: uniqueItems([...paragraphs, synthesizedParagraph].filter(Boolean)),
      items,
    },
  ];
}

function sourceSearchText(section: GeneratedSafetyPlanSection) {
  return normalizeToken(
    [
      section.key,
      section.title,
      section.summary ?? "",
      section.body ?? "",
      ...(section.bullets ?? []),
      ...(section.subsections ?? []).flatMap((subsection) => [
        subsection.title,
        subsection.body ?? "",
        ...(subsection.bullets ?? []),
      ]),
      ...(section.table?.columns ?? []),
      ...(section.table?.rows.flat() ?? []),
    ].join(" ")
  );
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function isEnforcementSubsectionTitleForSplit(title: string) {
  return /\b(6\.4|enforcement\s+and\s+corrective)\b/i.test(title);
}

function isWorkAttireSubsectionTitleForSplit(title: string) {
  const t = title.toLowerCase();
  return /\b6\.1\b/.test(t) || /\bwork\s+attire\b/i.test(t);
}

function isPpeReferenceSubsectionTitleForSplit(title: string) {
  const t = title.toLowerCase();
  if (isWorkAttireSubsectionTitleForSplit(title)) return false;
  if (/^required\s+ppe$/i.test(title.trim())) return true;
  if (/\b6\.2\b/.test(t)) return true;
  if (/personal\s+protective(\s+equipment)?/.test(t)) return true;
  return /\bppe\b/.test(t) && /minimum|reference|6\.2|enforcement|supervision/.test(t);
}

function mergeGeneratedSafetyPlanSections(group: GeneratedSafetyPlanSection[]): GeneratedSafetyPlanSection {
  const [first, ...rest] = group;
  if (!first) {
    throw new Error("mergeGeneratedSafetyPlanSections: empty group");
  }
  if (!rest.length) return first;
  const allSubs = group.flatMap((s) => s.subsections ?? []);
  const nk = normalizeToken(first.key ?? "");
  const allBulletSources =
    nk === "required ppe"
      ? group.flatMap((s) => [
          ...(s.bullets ?? []),
          ...(s.subsections ?? []).flatMap((sub) => sub.bullets ?? []),
        ])
      : group.flatMap((s) => s.bullets ?? []);
  const allBullets = uniqueItems(allBulletSources);
  const summaryParts = group.map((s) => s.summary).filter((v): v is string => Boolean(v?.trim()));
  const bodyParts = group.map((s) => s.body).filter((v): v is string => Boolean(v?.trim()));
  const mergedBullets =
    nk === "required ppe"
      ? buildCsepPpeSectionBulletsFromCombined(
          dedupePpeItemsForExport(flattenPpeSectionBulletsToItems(allBullets))
        )
      : allBullets;
  const mergedSubsections = nk === "required ppe" ? undefined : allSubs;
  return {
    ...first,
    summary: summaryParts.length ? summaryParts.join("\n\n") : first.summary,
    body: bodyParts.length ? bodyParts.join("\n\n") : first.body,
    bullets: mergedBullets.length ? mergedBullets : first.bullets,
    subsections: mergedSubsections?.length ? mergedSubsections : first.subsections,
  };
}

/**
 * Splits the assembled `contractor_iipp` block so work attire, PPE, and enforcement
 * become stand-alone sections (work attire and PPE are not co-mingled in Hazards
 * narrative), then merges duplicate `required_ppe` / `enforcement` sources.
 */
function expandCsepSourceSectionsForFixedLayout(
  sourceSections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const expanded: GeneratedSafetyPlanSection[] = [];

  for (const section of sourceSections) {
    const k = normalizeToken(section.key ?? "");
    if (k !== "contractor iipp") {
      expanded.push(section);
      continue;
    }
    const subs = section.subsections ?? [];
    if (subs.length === 0) {
      expanded.push(section);
      continue;
    }

    const workAttire: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    const ppe: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    const enforcement: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    const iipp: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
    for (const sub of subs) {
      const title = sub.title ?? "";
      if (isEnforcementSubsectionTitleForSplit(title)) enforcement.push(sub);
      else if (isWorkAttireSubsectionTitleForSplit(title)) workAttire.push(sub);
      else if (isPpeReferenceSubsectionTitleForSplit(title)) ppe.push(sub);
      else iipp.push(sub);
    }

    if (workAttire.length) {
      expanded.push({
        ...section,
        key: "work_attire_requirements",
        title: "Work Attire Requirements",
        summary: undefined,
        body: undefined,
        bullets: undefined,
        table: null,
        subsections: workAttire,
      });
    }
    if (ppe.length) {
      expanded.push({
        ...section,
        key: "required_ppe",
        title: "Required PPE",
        summary: undefined,
        body: undefined,
        bullets: undefined,
        table: null,
        subsections: ppe,
      });
    }
    if (enforcement.length) {
      expanded.push({
        ...section,
        key: "enforcement_and_corrective_action",
        title: "Enforcement and Corrective Action",
        summary: undefined,
        body: undefined,
        bullets: undefined,
        table: null,
        subsections: enforcement,
      });
    }
    expanded.push({
      ...section,
      subsections: iipp.length ? iipp : undefined,
    });
  }

  const MERGE_KEYS = new Set([
    "required ppe",
    "enforcement and corrective action",
  ]);
  const others: GeneratedSafetyPlanSection[] = [];
  const buckets = new Map<string, GeneratedSafetyPlanSection[]>();
  for (const s of expanded) {
    const nk = normalizeToken(s.key ?? "");
    if (MERGE_KEYS.has(nk)) {
      if (!buckets.has(nk)) buckets.set(nk, []);
      buckets.get(nk)!.push(s);
    } else {
      others.push(s);
    }
  }
  const mergedFromBuckets = Array.from(buckets.values()).map((g) => mergeGeneratedSafetyPlanSections(g));
  return [...others, ...mergedFromBuckets];
}

function mapSourceSectionToFixedSection(section: GeneratedSafetyPlanSection) {
  const keyTitle = normalizeToken(`${section.key} ${section.title}`);
  const combined = sourceSearchText(section);
  const keyNorm = normalizeToken(section.key ?? "");
  const fixedKey = FIXED_SECTION_DEFINITIONS.find((definition) => normalizeToken(definition.key) === keyNorm);
  if (fixedKey) return fixedKey.key;
  if (keyNorm.startsWith("program ")) {
    return "hazard_control_modules";
  }

  // --- 1) Explicit key routing (highest priority; avoids keyword bleed) ---
  // `normalizeToken` maps underscores to spaces â€” keys must match that form.
  const SCOPE_SOURCE_KEYS = new Set([
    "project information",
    "contractor information",
    "trade summary",
    "scope of work",
    "site specific notes",
    "project scope and trade specific activities",
  ]);
  if (SCOPE_SOURCE_KEYS.has(keyNorm)) {
    return keyNorm === "project information" || keyNorm === "contractor information"
      ? "project_and_contractor_information"
      : "scope_of_work_section";
  }
  if (keyNorm === "common overlapping trades") {
    return "trade_interaction_and_coordination";
  }
  if (keyNorm === "roles and responsibilities" || keyNorm === "roles_and_responsibilities") {
    return "roles_and_responsibilities";
  }
  if (keyNorm === "security and access" || keyNorm === "security and access control") {
    return "site_access_security_laydown_traffic_control";
  }
  if (keyNorm === "hazard communication" || keyNorm === "hazard communication program" || keyNorm === "hazcom program") {
    return "hazard_communication_and_environmental_protection";
  }
  if (keyNorm === "enforcement and corrective action") {
    return "iipp_incident_reporting_corrective_action";
  }
  if (keyNorm === "work attire requirements" || keyNorm === "work_attire_requirements") {
    return "ppe_and_work_attire";
  }
  if (keyNorm === "required ppe" || keyNorm === "personal protective equipment") {
    return "ppe_and_work_attire";
  }
  if (keyNorm === "union" || keyNorm === "union requirements" || keyNorm === "labor provisions") {
    return "worker_conduct_fit_for_duty_disciplinary_program";
  }
  if (
    keyNorm === "company overview" ||
    keyNorm === "company overview and safety philosophy" ||
    keyNorm === "message from owner" ||
    keyNorm === "owner message"
  ) {
    return "owner_message";
  }
  if (
    keyNorm === "contractor iipp" ||
    keyNorm === "emergency procedures" ||
    keyNorm === "emergency preparedness and response" ||
    keyNorm === "health and wellness" ||
    keyNorm === "incident reporting and investigation" ||
    keyNorm === "training and instruction" ||
    keyNorm === "drug and alcohol testing" ||
    keyNorm === "drug and alcohol" ||
    keyNorm === "recordkeeping" ||
    keyNorm === "continuous improvement" ||
    keyNorm === "project close out" ||
    keyNorm === "contractor monitoring audits and reporting" ||
    keyNorm === "checklists and inspections" ||
    keyNorm === "contractor safety meetings and engagement"
  ) {
    if (
      keyNorm === "recordkeeping" ||
      keyNorm === "training and instruction" ||
      keyNorm === "checklists and inspections" ||
      keyNorm === "contractor monitoring audits and reporting"
    ) {
      return keyNorm === "training and instruction" ? "training_competency_and_certifications" : "inspections_audits_and_records";
    }
    if (keyNorm === "continuous improvement" || keyNorm === "project close out") {
      return "project_closeout";
    }
    if (keyNorm === "emergency procedures" || keyNorm === "emergency preparedness and response") return "emergency_response_and_rescue";
    if (keyNorm === "health and wellness" || keyNorm === "drug and alcohol testing" || keyNorm === "drug and alcohol") return "worker_conduct_fit_for_duty_disciplinary_program";
    return "iipp_incident_reporting_corrective_action";
  }
  if (keyNorm === "sub tier contractor management" || keyNorm === "permits and forms") {
    return keyNorm === "permits and forms" ? "required_permits_and_hold_points" : "trade_interaction_and_coordination";
  }
  if (
    keyNorm === "weather requirements and severe weather response" ||
    keyNorm === "environmental execution requirements" ||
    keyNorm === "regulatory framework" ||
    keyNorm === "safe work practices and trade specific procedures" ||
    keyNorm === "hse elements and site specific hazard analysis" ||
    keyNorm === "appendices and support library" ||
    keyNorm === "weather"
  ) {
    if (keyNorm === "regulatory framework") return "regulatory_basis_and_references";
    if (keyNorm === "environmental execution requirements") return "hazard_communication_and_environmental_protection";
    if (keyNorm === "weather requirements and severe weather response" || keyNorm === "weather") return "emergency_response_and_rescue";
    return "hazard_control_modules";
  }

  if (
    includesAny(keyTitle, [
      "task module",
      "hazard module",
      "activity hazard",
      "task hazard",
      "safe work",
      "required ppe",
      "additional permits",
      "selected hazards",
      "jsa",
      "fall protection",
      "hot work",
      "lockout",
      "electrical",
      "compressed gas",
      "ladders",
      "housekeeping",
      "fire prevention",
      "barricade",
      "ppe",
      "permit",
      "rescue",
    ])
  ) {
    if (includesAny(keyTitle, ["task module", "activity hazard", "task hazard", "jsa"])) return "task_execution_modules";
    if (includesAny(keyTitle, ["required ppe", "ppe"])) return "ppe_and_work_attire";
    if (includesAny(keyTitle, ["additional permits", "permit"])) return "required_permits_and_hold_points";
    if (includesAny(keyTitle, ["rescue"])) return "emergency_response_and_rescue";
    return "hazard_control_modules";
  }

  if (includesAny(combined, ["table of contents", " index "])) {
    return "table_of_contents";
  }

  if (
    includesAny(combined, [
      "owner message",
      "message from owner",
      "policy statement",
      "safety philosophy",
      "leadership commitment",
      "company overview",
    ])
  ) {
    return "owner_message";
  }

  if (includesAny(combined, ["purpose", "how to use this plan", "plan use guidance"])) {
    return "purpose";
  }

  if (
    includesAny(keyTitle, [
      "project information",
      "contractor information",
      "project overview",
      "project site information",
      "trade summary",
      "scope of work",
      "scope summary",
      "project scope",
      "site specific notes",
      "site specific note",
      "project specific notes",
    ])
  ) {
    return includesAny(keyTitle, ["project information", "contractor information"])
      ? "project_and_contractor_information"
      : "scope_of_work_section";
  }

  if (
    includesAny(combined, [
      "top 10",
      "top ten",
      "selected hazards",
      "risk summary",
      "highest exposure",
      "highest risk",
      "life saving rules",
    ])
  ) {
    return "top_10_critical_risks";
  }

  if (
    includesAny(combined, [
      "overlapping trades",
      "trade conflict",
      "trade interaction",
      "shared area",
      "shared work area",
      "sequencing",
      "handoff",
      "related interfaces",
      "coordination",
    ])
  ) {
    return "trade_interaction_and_coordination";
  }

  if (includesAny(combined, ["roles and responsibilities", "roles & responsibilities", "safety roles and responsibilities"])) {
    return "roles_and_responsibilities";
  }

  if (
    includesAny(combined, [
      "incident reporting",
      "incident investigation",
      "injury",
      "illness",
      "near miss",
      "hazard reporting",
      "emergency response",
      "emergency procedures",
      "medical response",
      "return to work",
      "health and wellness",
      "drug",
      "alcohol",
      "fit for duty",
      "inspection",
      "recordkeeping",
      "continuous improvement",
      "training and instruction",
    ])
  ) {
    if (includesAny(combined, ["recordkeeping", "training and instruction", "inspection", "monitoring", "audit"])) {
      return includesAny(combined, ["training and instruction"])
        ? "training_competency_and_certifications"
        : "inspections_audits_and_records";
    }
    if (includesAny(combined, ["continuous improvement", "close out", "close-out", "lessons learned", "project close out"])) {
      return "project_closeout";
    }
    if (includesAny(combined, ["emergency response", "emergency procedures", "medical response"])) return "emergency_response_and_rescue";
    if (includesAny(combined, ["health and wellness", "drug", "alcohol", "fit for duty"])) return "worker_conduct_fit_for_duty_disciplinary_program";
    return "iipp_incident_reporting_corrective_action";
  }

  if (
    includesAny(combined, [
      "disciplinary",
      "discipline",
      "enforcement program",
      "enforcement action",
      "unsafe act",
      "removal from site",
    ]) ||
    (includesAny(combined, ["enforcement", "corrective action"]) && !includesAny(combined, ["chemical", "hazcom", "hazard communication", "sds"]))
  ) {
    return "worker_conduct_fit_for_duty_disciplinary_program";
  }

  if (includesAny(combined, ["union", "collective bargaining", "cba ", "labor agreement"]) || keyTitle.includes("union")) {
    return "worker_conduct_fit_for_duty_disciplinary_program";
  }

  if (
    includesAny(combined, [
      "security and access",
      "access control",
      "site entry",
      "worker access",
      "visitor",
      "visitor escort",
      "delivery",
      "truck route",
      "laydown",
      "traffic control",
      "unloading",
      "contraband",
      "weapon",
      "restricted area",
      "restricted item",
      "site security",
    ])
  ) {
    if (!includesAny(combined, ["it security", "data security", "chemical security", "cyber security"])) {
      return "site_access_security_laydown_traffic_control";
    }
  }

  if (
    includesAny(combined, [
      "hazcom",
      "hazard communication",
      "sds",
      "safety data sheet",
      "portable container",
      "ghs",
      "nfpa",
    ]) ||
    (includesAny(combined, ["label", "chemical", "msds"]) && !includesAny(combined, ["price label", "package label for shipping"]))
  ) {
    return "hazard_communication_and_environmental_protection";
  }

  return "hazard_control_modules";
}

function toTemplateSubsections(source: GeneratedSafetyPlanSection): CsepTemplateSubsection[] {
  const subsections: CsepTemplateSubsection[] = [];
  const tradeSummarySubsections = buildTradeSummarySubsections(source);
  if (tradeSummarySubsections) {
    return dedupeTemplateSubsections(tradeSummarySubsections);
  }
  const ruleTableSubsections = buildRuleTableSubsections(source);
  if (ruleTableSubsections.length) {
    return dedupeTemplateSubsections(ruleTableSubsections);
  }
  const roleReplacementItems = buildRoleReplacementItems(source);
  if (roleReplacementItems.length) {
    subsections.push({
      title: "",
      items: roleReplacementItems,
    });

    (source.subsections ?? []).forEach((subsection) => {
      subsections.push({
        title: contextualizeSubsectionTitle(source.title, subsection.title),
        paragraphs: expandParagraphsForDocxReadability(uniqueItems(splitParagraphs(subsection.body))),
        items: uniqueItems(subsection.bullets),
      });
    });

    return dedupeTemplateSubsections(subsections);
  }

  const leadingParagraphs = uniqueItems([
    ...splitParagraphs(source.summary),
    ...splitParagraphs(source.body),
  ]);
  const splitLeading = splitInlineEnumeratedParagraphs(leadingParagraphs);
  const leadingItems = uniqueItems(source.bullets ?? []);
  const shouldFoldLeadingParagraphsIntoItems =
    source.kind === "main" &&
    Boolean((source.subsections ?? []).length || source.table?.rows.length);
  const formattedLeadingParagraphItems = shouldFoldLeadingParagraphsIntoItems
    ? splitLeading.paragraphs
    : [];
  const leadingNarrativeParagraphs = shouldFoldLeadingParagraphsIntoItems
    ? []
    : splitLeading.paragraphs;
  const initialItems = uniqueItems([
    ...formattedLeadingParagraphItems,
    ...splitLeading.items,
    ...leadingItems,
  ]);

  // When a source has structured subsections (e.g. program blocks with
  // "When It Applies", "Responsibilities and Training", ...), always render a
  // parent heading with the source title so the first subsection is not left
  // floating as an untitled intro paragraph directly above "When It Applies".
  //
  // Additionally, whenever the source contributes standalone narrative
  // paragraphs, a leading table, or its own pre-extracted numbered items, the
  // leading block MUST carry the source title so the renderer emits a labeled
  // parent subheading. Without this, long standalone paragraphs (common in
  // Sections 6 / 8 / 9 â€” High-Risk Work Programs, Training & Recordkeeping,
  // and Close-Out â€” where several narrative-only sources land in the same
  // fixed bucket) would render as orphan body text between numbered items
  // with no clear parent heading above them.
  const hasStructuredSubsections = Boolean((source.subsections ?? []).length);
  const hasOrphanableLeadingContent =
    leadingNarrativeParagraphs.length > 0 ||
    initialItems.length > 0 ||
    Boolean(source.table?.rows.length);
  const parentHeadingTitle =
    hasStructuredSubsections || hasOrphanableLeadingContent
      ? source.title ?? ""
      : "";

  if (
    leadingNarrativeParagraphs.length ||
    initialItems.length ||
    source.table?.rows.length ||
    parentHeadingTitle
  ) {
    const mapsToTopRisks =
      mapSourceSectionToFixedSection(source) === "top_10_critical_risks" ||
      /^top[_\s-]*(10|ten)\s*risks?$/i.test(normalizeToken(source.key)) ||
      /^top[_\s-]*(10|ten)\s*risks?$/i.test(normalizeToken(source.title));
    const listLikeKeyNorms = new Set([
      "additional permits",
      "selected hazards",
      "common overlapping trades",
    ]);
    const key = normalizeToken(source.key ?? "");
    const plainListLineItems = listLikeKeyNorms.has(key);
    const plainItemsStyle: CsepTemplateSubsection["plainItemsStyle"] =
      initialItems.length > 0 &&
      (source.key === "scope_of_work" || mapsToTopRisks || plainListLineItems)
        ? "offset_lines"
        : undefined;
    const tableRowsStyle: CsepTemplateSubsection["tableRowsStyle"] = shouldUseOffsetTableRows(source)
      ? "offset_lines"
      : undefined;
    subsections.push({
      title: parentHeadingTitle,
      paragraphs: expandParagraphsForDocxReadability(leadingNarrativeParagraphs),
      items: initialItems,
      table: source.table ?? null,
      plainItemsStyle,
      tableRowsStyle,
    });
  }

  (source.subsections ?? []).forEach((subsection) => {
    const splitSubsectionParagraphs = splitInlineEnumeratedParagraphs(
      uniqueItems(splitParagraphs(subsection.body))
    );
    const splitBullets = uniqueItems(subsection.bullets).flatMap((item) =>
      splitParagraphAtEstimatedDocxLineCount(item, { maxLines: 6 })
    );
    subsections.push({
      title: contextualizeSubsectionTitle(source.title, subsection.title),
      paragraphs: expandParagraphsForDocxReadability(splitSubsectionParagraphs.paragraphs),
      items: uniqueItems([...splitSubsectionParagraphs.items, ...splitBullets]),
    });
  });

  return subsections.length ? dedupeTemplateSubsections(subsections) : [];
}

export function toTemplateSection(source: GeneratedSafetyPlanSection): CsepTemplateSection {
  return {
    key: source.key,
    title: source.title,
    kind: source.kind ?? undefined,
    numberLabel: source.numberLabel ?? undefined,
    subsections: toTemplateSubsections(source),
    closingTagline: null,
  };
}

export function buildCsepTemplateSections(
  params: BuildCsepTemplateSectionsParams
): CsepTemplateSection[] {
  const grouped = new Map<string, CsepTemplateSubsection[]>();

  const preparedSources = expandCsepSourceSectionsForFixedLayout(params.sourceSections);
  const eligibleSections = preparedSources.filter(
    (section) => section.kind !== "front_matter" && section.kind !== "appendix"
  );

  // Dedupe source sections by stable key/title before grouping so that
  // two source sections sharing the same key or normalized title do not
  // produce duplicate headings or duplicate content blocks in the same
  // grouped bucket.
  const dedupedSources: GeneratedSafetyPlanSection[] = [];
  const seenSourceSignatures = new Set<string>();
  eligibleSections.forEach((section) => {
    const normalizedKey = normalizeToken(section.key);
    const normalizedTitle = normalizeToken(section.title);
    const signature = normalizedKey || normalizedTitle;
    if (!signature) return;
    // Exclude the raw task/hazard/control matrix from the main narrative body;
    // it is rendered as an appendix table instead.
    if (
      normalizedKey.includes("activity hazard matrix") ||
      normalizedKey.includes("task hazard control matrix") ||
      normalizedTitle.includes("activity hazard matrix") ||
      normalizedTitle.includes("task hazard control matrix")
    ) {
      return;
    }
    if (seenSourceSignatures.has(signature)) return;
    seenSourceSignatures.add(signature);
    dedupedSources.push(section);
  });

  dedupedSources.forEach((section) => {
    if (normalizeToken(section.key ?? "") === "project information") return;
    const mappedKey = mapSourceSectionToFixedSection(section);
    if (!mappedKey) return;
    const existing = grouped.get(mappedKey) ?? [];
    const subsections = toTemplateSubsections(section);
    existing.push(...subsections);
    grouped.set(mappedKey, existing);
  });

  return FIXED_SECTION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    title: definition.title,
    descriptor: definition.descriptor,
    kind: definition.kind,
    subsections: buildSectionSubsections(definition, grouped, {
      draft: params.draft ?? createEmptyDraftContext(),
      projectName: params.projectName,
      contractorName: params.contractorName,
      tradeLabel: params.tradeLabel ?? "N/A",
      subTradeLabel: params.subTradeLabel ?? "N/A",
      taskTitles: params.taskTitles ?? [],
    }),
    closingTagline: null,
  }));
}

const REQUIRED_COVER_METADATA_ROW_LABELS = new Set(["Project Name", "Project Address", "Contractor", "Date"]);

function meaningfulFieldRows(rows: CsepCoverMetadataRow[]) {
  return rows.filter(
    (row) => REQUIRED_COVER_METADATA_ROW_LABELS.has(row.label) || normalizeCompareToken(row.value) !== "n a"
  );
}

function hasMeaningfulSubsections(subsections: CsepTemplateSubsection[]) {
  return subsections.some((subsection) => subsectionHasContent(subsection));
}

const DEFAULT_CSEP_COVER_LOGO_RELATIVE = ["public", "brand", "safety360docs-logo-crop.png"] as const;

function readDefaultCoverLogoFile(): CsepRenderModel["coverLogo"] {
  try {
    const abs = join(
      /* turbopackIgnore: true */ process.cwd(),
      ...DEFAULT_CSEP_COVER_LOGO_RELATIVE
    );
    if (!existsSync(abs)) {
      return null;
    }
    return { data: readFileSync(abs), type: "png" };
  } catch {
    return null;
  }
}

function getOptionalCoverLogo(
  draft: GeneratedSafetyPlanDraft
): CsepRenderModel["coverLogo"] {
  const builderSnapshot =
    draft.builderSnapshot && typeof draft.builderSnapshot === "object"
      ? (draft.builderSnapshot as Record<string, unknown>)
      : null;
  const rawDataUrl =
    builderSnapshot && typeof builderSnapshot.company_logo_data_url === "string"
      ? builderSnapshot.company_logo_data_url.trim()
      : "";

  if (!rawDataUrl.startsWith("data:image/")) {
    return readDefaultCoverLogoFile();
  }

  const match = rawDataUrl.match(/^data:image\/([a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    return readDefaultCoverLogoFile();
  }

  const mimeSubtype = match[1].toLowerCase();
  const base64Payload = match[2];
  const type =
    mimeSubtype === "jpeg"
      ? "jpg"
      : mimeSubtype === "jpg" || mimeSubtype === "png" || mimeSubtype === "gif" || mimeSubtype === "bmp"
        ? mimeSubtype
        : null;

  if (!type) {
    return readDefaultCoverLogoFile();
  }

  try {
    return {
      data: Uint8Array.from(Buffer.from(base64Payload, "base64")),
      type,
    };
  } catch {
    return readDefaultCoverLogoFile();
  }
}

function createEmptyDraftContext(): GeneratedSafetyPlanDraft {
  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: "",
    projectOverview: {
      projectName: "",
      projectNumber: "",
      projectAddress: "",
      ownerClient: "",
      gcCm: [],
      contractorCompany: "",
      location: "",
      schedule: "",
    },
    operations: [],
    ruleSummary: {
      permitTriggers: [],
      ppeRequirements: [],
      requiredControls: [],
      hazardCategories: [],
      siteRestrictions: [],
      prohibitedEquipment: [],
      trainingRequirements: [],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 0,
      intraDocument: 0,
      external: 0,
      highestSeverity: "none",
      items: [],
    },
    riskSummary: {
      score: 0,
      band: "low",
      priorities: [],
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {
      safetyNarrative: "",
    },
    sectionMap: [],
    provenance: {
      generator: "renderer-fallback",
    },
  };
}

function placeholderParagraphForSection(sectionKey: string) {
  switch (sectionKey) {
    case "top_10_critical_risks":
      return "Project-specific information to be completed.";
    case "trade_interaction_and_coordination":
      return "Project-specific coordination, overlap, access, and handoff information to be completed.";
    case "site_access_security_laydown_traffic_control":
      return "Project-specific information to be completed.";
    case "iipp_incident_reporting_corrective_action":
      return "Project-specific information to be completed.";
    case "training_competency_and_certifications":
      return "Project-specific training, inspection, monitoring, and recordkeeping requirements to be completed.";
    case "project_closeout":
      return "Project-specific close-out and lessons learned requirements to be completed.";
    default:
      return "Project-specific information to be completed.";
  }
}

function synthesizeWorkAttireSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Work Attire Requirements",
      paragraphs: [CSEP_WORK_ATTIRE_SUBSECTION_BODY],
      items: [...CSEP_WORK_ATTIRE_DEFAULT_BULLETS],
    },
  ];
}

function synthesizeTrainingInspectionsMonitoringRecordkeepingSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Training and Competency",
      paragraphs: [
        "Define role-appropriate training and competency verification before work starts and when task conditions change.",
      ],
      items: [
        "For lifting activities, verify lift plan / pick plan communication and crane permit responsibilities before execution.",
      ],
    },
    {
      title: "Inspections and Monitoring",
      paragraphs: [
        "Set inspection cadence, responsible persons, and field monitoring expectations for active work areas and critical controls.",
      ],
    },
    {
      title: "Recordkeeping",
      paragraphs: [
        "Maintain training, inspection, corrective action, and verification records in a review-ready format for project and client requirements.",
      ],
    },
  ];
}

function synthesizeCloseOutLessonsLearnedSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Close-Out and Lessons Learned",
      paragraphs: [
        "At phase or project close-out, capture lessons learned, unresolved risks, and carry-forward actions to improve future planning and execution.",
      ],
    },
  ];
}

const HIGH_RISK_STEEL_PROGRAMS = [
  "Leading Edge and Connector Work Program",
  "Fall Rescue and Suspension Trauma Program",
  "Controlled Decking Zone and Decking Access Program",
  "Hoisting and Rigging Program",
  "Multiple Lift Rigging Program",
  "Structural Stability and Temporary Bracing Program",
  "Column Anchorage and Initial Connection Program",
  "Open Web Joist and Bridging Program",
  "Falling Objects and Drop Zone Control Program",
  "Weather, Wind, Lightning and Site Condition Program",
];

const HAZARD_CONTROL_MODULES = [
  "Fall Exposure",
  "Struck-By / Load Path / Swing Radius",
  "Caught-In / Pinch Points",
  "Crane, Rigging, and Suspended Loads",
  "Structural Instability / Collapse",
  "Column Anchorage",
  "Open Web Joists and Bridging",
  "Falling Objects / Dropped Materials",
  "Hot Work / Welding / Cutting",
  "Fire Prevention",
  "Fumes / Ventilation",
  "Electrical / Temporary Power",
  "Mobile Equipment / Pedestrian Interface",
  "Weather / Wind / Lightning",
  "Heat / Cold Stress",
  "Housekeeping / Slip, Trip, Fall",
  "PPE Hazard Controls",
];

const TASK_EXECUTION_MODULES = [
  "Receiving, Unloading, Inspecting, and Staging Steel",
  "Sorting Members / Shakeout",
  "Rigging and Crane Picks",
  "Column Erection",
  "Beam and Girder Setting",
  "Initial Connections",
  "Plumbing, Temporary Bracing, and Final Bolting",
  "Field Welding, Cutting, and Shear Connectors",
  "Metal Decking Installation",
  "Opening and Perimeter Protection During Decking",
  "Embeds / Plates / Miscellaneous Metals",
  "Punch List / Detail Work",
  "Touch-Up Painting / Coatings",
];

function synthesizeNamedModuleSubsections(names: readonly string[], fallback: string): CsepTemplateSubsection[] {
  return names.map((title) => ({
    title,
    paragraphs: [`${title}: ${fallback}`],
  }));
}

function synthesizeRegulatoryReferenceSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "OSHA / CFR Reference List",
      table: {
        columns: ["Reference", "Citation"],
        rows: CSEP_REGULATORY_REFERENCE_INDEX.map((entry) => [entry.code, entry.citation]),
      },
    },
  ];
}

function synthesizeOwnerMessageSubsections(
  projectName: string,
  contractorName: string,
  options?: { steelErection?: boolean }
): CsepTemplateSubsection[] {
  const ownerLabel = contractorName !== "N/A" ? contractorName : "Project leadership";
  const projectLabel = projectName !== "N/A" ? projectName : "this project";
  const baseSecond =
    "Every supervisor and worker is expected to stop work when conditions change, communicate hazards early, and follow this CSEP before proceeding.";
  const steelSecond =
    "For structural steel and decking, do not advance picks, landings, or connection releases when fit-up, temporary bracing, or fall protection no longer match the approved erection and rigging plan; reset controls before the next load moves.";
  return [
    {
      title: "Owner Message",
      paragraphs: [
        `${ownerLabel} expects all work on ${projectLabel} to be planned, coordinated, and executed without injury, property damage, or uncontrolled environmental impact.`,
        options?.steelErection ? `${baseSecond} ${steelSecond}` : baseSecond,
      ],
    },
  ];
}

function synthesizeSignOffSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Sign-Off Requirements",
      paragraphs: [
        "The signatures below confirm that this CSEP has been reviewed against the project scope, site rules, and applicable regulatory requirements prior to field use.",
        "Issue this plan only after the responsible project and contractor representatives have completed the required sign-off.",
      ],
    },
  ];
}

function synthesizePurposeSubsections(
  projectName: string,
  options?: { steelErection?: boolean }
): CsepTemplateSubsection[] {
  const projectLabel = projectName !== "N/A" ? projectName : "this project";
  const second = options?.steelErection
    ? "It aligns field execution, coordination, and hazard controls so crews can perform assigned work in a consistent and reviewable manner, with structural steel and decking tied to pre-planned picks, connection sequencing, and verified stability before workers rely on the frame or deck for support."
    : "It aligns field execution, coordination, and hazard controls so crews can perform assigned work in a consistent and reviewable manner.";
  return [
    {
      title: "Purpose",
      paragraphs: [
        `This CSEP establishes the project-specific safety and environmental requirements that govern work on ${projectLabel}.`,
        second,
      ],
    },
  ];
}

function isStructuralSteelOrDeckingScope(
  draft: GeneratedSafetyPlanDraft,
  tradeLabel: string,
  subTradeLabel: string
) {
  const hay = [
    tradeLabel,
    subTradeLabel,
    ...draft.operations.map((o) => `${o.tradeLabel ?? ""} ${o.subTradeLabel ?? ""} ${o.taskTitle}`),
  ]
    .join(" ")
    .toLowerCase();
  return /(steel|structural|ironwork|ironworker|deck|metal deck|joist|girder|erection|connector)/.test(
    hay
  );
}

function synthesizeScopeSubsections(
  draft: GeneratedSafetyPlanDraft,
  projectName: string,
  contractorName: string,
  tradeLabel: string,
  subTradeLabel: string,
  _taskTitles: string[]
): CsepTemplateSubsection[] {
  const steelErectionScope = isStructuralSteelOrDeckingScope(draft, tradeLabel, subTradeLabel);
  const tradeSummary = [tradeLabel, subTradeLabel].filter((value) => value && value !== "N/A").join(" / ");
  const scopeSummaryParts = [
    contractorName !== "N/A" ? `Contractor: ${contractorName}` : null,
    tradeSummary ? `Covered trade / discipline: ${tradeSummary}` : null,
    steelErectionScope
      ? "Task-level steel erection, rigging, and decking controls are governed in the Hazards and Controls section and the approved plans referenced thereâ€”not in this Scope section."
      : null,
  ].filter((value): value is string => Boolean(value));

  const taskLine = _taskTitles.length
    ? `Selected tasks: ${_taskTitles.join("; ")}.`
    : "Selected tasks: confirm against the issued builder snapshot before field use.";

  const scopeParagraphs = [
    ...scopeSummaryParts,
    taskLine,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    {
      title: "Scope summary",
      paragraphs: [scopeParagraphs || "Project-specific information to be completed."],
    },
  ];
}

function riskDedupeKey(value: string) {
  return normalizeCompareToken(value);
}

const SCOPE_NARRATIVE_EXCLUSION =
  /\b(iipp\b|injury\s+and\s+illness|illness prevention|health and wellness|wellness program|incident report|incident reporting|incident investigation|drug[-\s]?|alcohol testing|substance|fit[-\s]?for[-\s]?duty|enforcement program|corrective action accountability|hazard communication|hazcom|\bsds\b|sanitation|housekeeping program|toolbox|audits?\s|monitoring program|sub[-\s]?tier|training record)\b/i;

const SECURITY_NON_OWNER =
  /(\b(?:final|torque|bolt[-\s]?up|weld|shear connector|steel execution|erection release|ncr|shop drawing)\b)/i;

const STRUCTURAL_STEEL_DECKING_TOP_10: string[] = [
  "Falls while decking, leading-edge work, or acting as a connector; incomplete guardrails, CDZ boundaries, or fall-arrest/positioning that is not rigged to an approved plan.",
  "Struck-by or caught-in in the load path, swing radius, or tag-line zone; shifting bundles; rigging that slips, rolls, or releases before a stable landing.",
  "Crane, hoist, and rigging overload or control failure; multiple-lift rigging, capacity limits, or critical lifts performed without a reviewed lift or rigging plan.",
  "Loss of stability from missing or out-of-sequence bracing, guy lines, or temporary supports; members landed before anchor bolts, templates, and bearing surfaces are plumb, level, and fit-up verified.",
  "Collapse, crush, or deck punch-through from shoring or deck that is overloaded, uninspected, or not walked before loads; unguarded floor openings, shaft jumps, and incomplete barriers.",
  "Ignition, burn, fume, and slag exposure from field welding, cutting, grinding, and hot work on steel and deck (fire watch, line clearance, combustibles below the arc).",
  "Dropped hand tools, bolts, and deck bundles through openings or at elevation; poor housekeeping at deck edges and column lines.",
  "Electrical contact, trip hazards from welding leads, and arc flash when temporary power, stingers, or equipment tie-ins are on active steel or deck.",
  "Lightning, high wind, or icing that changes crane and hoist limits, plumb, fall protection, and unsecured deck or bundle exposure.",
  "Congested picks and landings where steel interfaces with other trades, deliveries, and mobile equipment; unclear radio communication, spotter blind spots, or ad hoc staging.",
];

function filterScopeNarrativeParagraph(text: string | null | undefined) {
  const t = (text ?? "").trim();
  if (!t) return null;
  if (SCOPE_NARRATIVE_EXCLUSION.test(t)) return null;
  if (/\bprimary tasks?:/i.test(t)) return null;
  return t;
}

function filterScopeTemplateSubsections(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => ({
      ...sub,
      paragraphs: uniqueItems(
        (sub.paragraphs ?? []).map((p) => filterScopeNarrativeParagraph(p)).filter((p): p is string => Boolean(p))
      ),
      items: uniqueItems(
        (sub.items ?? []).map((i) => filterScopeNarrativeParagraph(i)).filter((p): p is string => Boolean(p))
      ),
    }))
    .filter((sub) => subsectionHasContent(sub));
}

function administrativeScopeBlocksRequired(draft: GeneratedSafetyPlanDraft): boolean {
  const builderSnapshot =
    draft.builderSnapshot && typeof draft.builderSnapshot === "object"
      ? (draft.builderSnapshot as Record<string, unknown>)
      : null;
  const siteContext =
    (draft as GeneratedSafetyPlanDraft & { siteContext?: { metadata?: Record<string, unknown> } }).siteContext
      ?.metadata ?? null;

  const hasEnabledFlag = (value: unknown) => value === true;
  const flagKeys = [
    "include_scope_project_information",
    "include_scope_contractor_information",
    "scope_include_project_information",
    "scope_include_contractor_information",
    "require_scope_project_and_contractor_blocks",
    "requireScopeProjectAndContractorBlocks",
    "includeScopeProjectInformation",
    "includeScopeContractorInformation",
  ];

  return flagKeys.some((key) => {
    const fromBuilder = builderSnapshot ? hasEnabledFlag(builderSnapshot[key]) : false;
    const fromMetadata = siteContext ? hasEnabledFlag(siteContext[key]) : false;
    return fromBuilder || fromMetadata;
  });
}

function pruneScopeAdministrativeSubsections(
  subsections: CsepTemplateSubsection[],
  context: { draft: GeneratedSafetyPlanDraft }
): CsepTemplateSubsection[] {
  if (administrativeScopeBlocksRequired(context.draft)) {
    return subsections;
  }

  return subsections.filter((subsection) => {
    const title = normalizeCompareToken(subsection.title ?? "");
    // Keep scope flow focused on operational context; project/admin identity
    // data already belongs to the title page metadata unless explicitly required.
    if (title === "project information" || title === "contractor information") {
      return false;
    }
    return true;
  });
}

/** Â§3 Scope: Scope â†’ site notes â†’ project â†’ contractor â†’ trade, then other (stable). Top 10 is Â§4. */
function sortScopeSubsectionsInProjectSetupOrder(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  const rank = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("scope of work") || t.includes("scope summary")) return 1;
    if (
      t.includes("project-specific safety") ||
      t.includes("site specific") ||
      t.includes("site-specific field")
    ) {
      return 2;
    }
    if (t.includes("project information")) return 3;
    if (t.includes("contractor information")) return 4;
    if (t.includes("trade summary")) return 5;
    return 100;
  };
  return subsections
    .map((sub, index) => ({ sub, index, r: rank(sub.title ?? "") }))
    .sort((a, b) => (a.r !== b.r ? a.r - b.r : a.index - b.index))
    .map(({ sub }) => sub);
}

function filterSecurityAtSiteSubsections(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => {
      const keepText = (t: string) => {
        const s = t.trim();
        if (!s) return null;
        if (SECURITY_NON_OWNER.test(s) && !/\b(access|gate|badge|entry|deliver|haul|laydown|traffic|exclusion|vehicle)\b/i.test(s)) {
          return null;
        }
        return s;
      };
      return {
        ...sub,
        paragraphs: uniqueItems((sub.paragraphs ?? []).map(keepText).filter((x): x is string => Boolean(x))),
        items: uniqueItems((sub.items ?? []).map(keepText).filter((x): x is string => Boolean(x))),
      };
    })
    .filter((sub) => subsectionHasContent(sub));
}

const DISCIPLINARY_NON_OWNER_LINE =
  /\b(work\s+attire|sanitation|hygiene|toolbox|audit|close[-\s]?out|checklist|inspection\s+sheet|contractor\s+monitor(ing)?|kpi|training\s+record|sub[-\s]?tier|ppe\s+matrix|hazard\s+module|housekeeping|environmental|stormwater)\b/i;

function filterDisciplinaryLine(text: string) {
  const s = text.trim();
  if (!s) return null;
  if (DISCIPLINARY_NON_OWNER_LINE.test(s) && !/\b(escalat|correct|unsafe|remove|enforcement|violation|disciplin|stop\s*work|restart|warning)\b/i.test(s)) {
    return null;
  }
  return s;
}

function filterDisciplinaryTemplateSubsections(subsections: CsepTemplateSubsection[]): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => ({
      ...sub,
      paragraphs: uniqueItems(
        (sub.paragraphs ?? []).map((p) => filterDisciplinaryLine(p)).filter((p): p is string => Boolean(p))
      ),
      items: uniqueItems(
        (sub.items ?? []).map((i) => filterDisciplinaryLine(i)).filter((p): p is string => Boolean(p))
      ),
    }))
    .filter((sub) => subsectionHasContent(sub));
}

/**
 * Returns up to `max` unique risks; treats capitalization and punctuation variants as the same.
 */
function dedupeRiskLabelsPreservingOrder(values: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const t = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const k = riskDedupeKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(/[.!?]$/.test(t) ? t : `${t}.`);
    if (out.length >= max) break;
  }
  return out;
}

function flattenTopRiskCandidateStrings(
  subsections: CsepTemplateSubsection[],
  draft: GeneratedSafetyPlanDraft
) {
  const fromSub: string[] = [];
  for (const sub of subsections) {
    for (const item of sub.items ?? []) {
      if (item.trim()) fromSub.push(item);
    }
    for (const para of sub.paragraphs ?? []) {
      for (const piece of para.split(/(?:\n|(?<=[.!?]))\s+/)) {
        const t = piece.replace(/^[\d.]+\s*/, "").trim();
        if (t.length > 2 && /[a-zA-Z]/.test(t)) fromSub.push(t);
      }
    }
  }
  const fromDraft = [
    ...(draft.riskSummary?.priorities ?? []),
    ...(draft.ruleSummary?.hazardCategories ?? []),
    ...draft.operations.flatMap((operation) => operation.hazardCategories ?? []),
  ];
  return [...fromSub, ...fromDraft];
}

function synthesizeTopRiskSubsections(
  draft: GeneratedSafetyPlanDraft,
  tradeLabel: string,
  subTradeLabel: string
): CsepTemplateSubsection[] {
  const useSteel = isStructuralSteelOrDeckingScope(draft, tradeLabel, subTradeLabel);
  const baseFromDraft = useSteel
    ? [
        ...STRUCTURAL_STEEL_DECKING_TOP_10,
        ...(draft.riskSummary?.priorities ?? []),
        ...(draft.ruleSummary?.hazardCategories ?? []),
        ...draft.operations.flatMap((operation) => operation.hazardCategories ?? []),
      ]
    : [
        ...(draft.riskSummary?.priorities ?? []),
        ...(draft.ruleSummary?.hazardCategories ?? []),
        ...draft.operations.flatMap((operation) => operation.hazardCategories ?? []),
      ];
  const items = dedupeRiskLabelsPreservingOrder(baseFromDraft, 10);

  return [
    {
      title: "Top 10 Risks",
        items: items.length ? items : [placeholderParagraphForSection("top_10_critical_risks")],
      plainItemsStyle: "offset_lines",
    },
  ];
}

const STEEL_TRADE_INTERACTION_DEFAULTS: string[] = [
  "Sequence crane time and swing so steel erection, decking, and bundle landings are not in the same airspace and ground zone as other trades' picks, man-lifts, or faÃ§ade access without a written overlap plan and radioed holds.",
  "Agree on column-line and floor-edge handoffs: who owns deck bundle drops, when openings are left for MEP, and how plumb, bolt-up, and welding tie-ins with other systems are accepted before the area is released.",
  "Coordinate delivery and laydown with hoisting: truck routes, outrigger and crane pad access, and traffic control so other crews are not under live picks or in blind rigging pull paths.",
  "Share shift-level changes (weather, out-of-tolerance field conditions, resequenced steel) with GC, crane, and adjacent trade leads before restarting picks or leading-edge work.",
];

function synthesizeTradeInteractionSubsections(
  draft: GeneratedSafetyPlanDraft,
  options?: { tradeLabel?: string; subTradeLabel?: string }
): CsepTemplateSubsection[] {
  const tradeLabel = options?.tradeLabel ?? "";
  const subTradeLabel = options?.subTradeLabel ?? "";
  const overlaps = uniqueItems([
    ...draft.operations.flatMap((operation) => operation.conflicts ?? []),
    ...draft.conflictSummary.items.flatMap((item) => [
      item.rationale,
      ...item.requiredMitigations,
      item.resequencingSuggestion ?? "",
    ]),
  ]);
  const filtered = overlaps.length ? filterTradeInteractionItems(overlaps) : [];
  const useSteelDefaults =
    !filtered.length &&
    isStructuralSteelOrDeckingScope(draft, tradeLabel, subTradeLabel);

  return [
    {
      title: "Trade Interaction Info",
      items: filtered.length
        ? filtered
        : useSteelDefaults
          ? STEEL_TRADE_INTERACTION_DEFAULTS
          : [placeholderParagraphForSection("trade_interaction_and_coordination")],
    },
  ];
}

function synthesizeRolesAndResponsibilitiesSubsections(context: {
  draft: GeneratedSafetyPlanDraft;
  projectName: string;
  contractorName: string;
  tradeLabel: string;
  subTradeLabel: string;
  taskTitles: string[];
}): CsepTemplateSubsection[] {
  const project =
    context.projectName.trim() && context.projectName !== "N/A"
      ? context.projectName.trim()
      : "this project";
  const contractor =
    context.contractorName.trim() && context.contractorName !== "N/A"
      ? context.contractorName.trim()
      : "the contractor organization";
  const tradePhrase =
    [context.tradeLabel, context.subTradeLabel].filter((t) => t && t !== "N/A").join(" / ") || "the contracted work";

  return [
    {
      title: "Overview",
      paragraphs: [
        `The responsibilities below are baseline expectations for this CSEP issue on ${project}. They do not replace or remove other duties required by employer policy, contract, OSHA, site-specific procedures, or the controlling contractor. Where this CSEP is silent, follow the hierarchy of controls, the site orientation, and the GC/CM direction of the day.`,
      ],
    },
    {
      title: "Superintendent / Project Manager",
      paragraphs: [
        `Aligns ${contractor}'s plan for ${tradePhrase} with the project schedule, permits, and interface agreements. Confirms pre-task plans match current hazards and site rules, authorizes stop-work when conditions change, and ensures competent-person coverage and required equipment are in place before production pressure resumes. Escalates trade-to-trade conflicts and records significant safety decisions for turnover and audits.`,
      ],
    },
    {
      title: "Competent Person",
      paragraphs: [
        `Identifies and predicts hazards for the work in progress, implements and documents the measures needed to control them, and has authority to stop unsafe acts. Conducts or participates in inspections tied to critical lifts, fall protection, access changes, and energy isolation when those exposures are in scope. Communicates conditions and handoffs clearly to crews and the superintendent.`,
      ],
    },
    {
      title: "Foreman / Crew Lead",
      paragraphs: [
        `Runs daily briefings for the assigned crew, verifies tools, PPE, and permits before starting, and enforces the work plan at the face. Keeps the competent person informed of field changes, near misses, and subcontractor overlap. Ensures only trained workers perform specialized tasks assigned to the crew.`,
      ],
    },
    {
      title: "Workers",
      paragraphs: [
        `Follow established safe work procedures, attend briefings, use required PPE, and report hazards and near misses immediately. Exercise stop-work authority when a condition is not controlled. Participate in inspections and drills as directed and do not bypass guards, fall protection, or lockout controls.`,
      ],
    },
    {
      title: "Qualified Rigger",
      paragraphs: [
        `Selects and inspects rigging for the loads and configurations in use, rejects damaged or misapplied gear, and follows the lift plan and qualified signaler communication. Keeps exclusion zones respected during hooking, travel, and landing. Coordinates with the crane operator and competent person when pick conditions change.`,
      ],
    },
    {
      title: "Signal Person",
      paragraphs: [
        `Gives standardized signals or radio commands only when qualified for the equipment and lift in progress, maintains continuous visual or voice contact as required, and stops the load when anyone enters the swing or drop zone. Confirms tag line control and landing clearances before movement resumes.`,
      ],
    },
    {
      title: "Safety Lead / Safety Director",
      paragraphs: [
        `Supports the project team with program interpretation, training records, incident notification, and audit readiness. Tracks corrective actions to closure and helps align contractor procedures with owner and GC/CM expectations. Does not replace line supervision but verifies critical controls are implemented in the field.`,
      ],
    },
    {
      title: "GC / CM / Controlling Contractor Interface",
      paragraphs: [
        `Provides site-wide orientation, hazard communication integration, emergency response coordination, and rules for shared spaces, traffic, and hot work where the GC/CM is the controlling entity. Confirms contractor plans align with the site safety plan and interfaces on multi-employer exposures. Contractor supervision remains responsible for crew execution and subcontractor oversight.`,
      ],
    },
  ];
}

/** Omits HazCom, IIPP, disciplinary, access/security, and recordkeeping from trade overlap bullets. */
function filterTradeInteractionItems(values: string[]): string[] {
  const noise =
    /\b(hazard communication|hazcom|sds|safety data sheet|msds|labeling program|emergency response|iipp|injury and illness|disciplinary|enforcement policy|drug[-\s]?free|alcohol|fit[-\s]?for[-\s]?duty|code of conduct)\b/i;
  const notTradeOwner =
    /\b(visitor|escort|badge|gate|security\s+admin|sub[-\s]?tier|training\s+record|qualification|driver\s+remain|pedestrian\s+exclusion|spotter\s+use|check-?in\s+at\s+the\s+gate)\b/i;
  return values
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter(
      (v) => v.length > 0 && !noise.test(v) && (!notTradeOwner.test(v) || /overlap|swing|sequence|crane|trade|manlift|other\s+trade/i.test(v))
    );
}

function filterTradeInteractionSubsections(
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  return subsections
    .map((sub) => ({
      ...sub,
      paragraphs: (sub.paragraphs ?? [])
        .map((value) => {
          const t = value.trim();
          if (!t) return null;
          return filterTradeInteractionItems([t]).length ? t : null;
        })
        .filter((value): value is string => Boolean(value)),
      items: sub.items ? filterTradeInteractionItems(sub.items) : sub.items,
    }))
    .filter((sub) => subsectionHasContent(sub));
}

function applySectionOwnershipFilter(
  sectionKey: string,
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  if (sectionKey === "hazard_control_modules") {
    return subsections
      .map((sub) => {
        const keep = (value: string) => {
          const t = value.trim();
          if (!t) return null;
          return CSEP_HAZARD_NON_OWNER_POLICY_PATTERN.test(t) ? null : t;
        };
        return {
          ...sub,
          paragraphs: uniqueItems((sub.paragraphs ?? []).map(keep).filter((v): v is string => Boolean(v))),
          items: uniqueItems((sub.items ?? []).map(keep).filter((v): v is string => Boolean(v))),
        };
      })
      .filter((sub) => sectionHasContent(sub));
  }

  const key = sectionKey as keyof typeof CSEP_SECTION_OWNERSHIP_PATTERNS;
  const ownerPattern = CSEP_SECTION_OWNERSHIP_PATTERNS[key];
  if (!ownerPattern) return subsections;

  return subsections
    .map((sub) => {
      const keep = (value: string) => {
        const t = value.trim();
        if (!t) return null;
        return ownerPattern.test(t) ? t : null;
      };

      return {
        ...sub,
        paragraphs: uniqueItems((sub.paragraphs ?? []).map(keep).filter((v): v is string => Boolean(v))),
        items: uniqueItems((sub.items ?? []).map(keep).filter((v): v is string => Boolean(v))),
      };
    })
    .filter((sub) => sectionHasContent(sub));
}

function synthesizeHazcomSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "Hazard Communication",
      items: [
        "SDS on site: Keep an SDS for every hazardous chemical in use, in the work area and in the master project library (e.g. trailer binder, GC portal, or site app). Make SDS available to the CM and HSE (or their designee) for verification and audits on request.",
        "Inventory and use communication: A chemical inventory (or other documented process) links introduced products to SDS before first use, including contractor-supplied and owner-supplied materials on multi-employer sites.",
        "Primary and secondary container labeling: Do not work from or transfer into unmarked containers. Secondary and portable containers show product identity, GHS label elements (pictograms, signal word, hazard and precautionary statements) or a site-approved worker-readable equivalent, consistent with the shipped product class.",
        "NFPA / site marking: Post or maintain NFPA 704, HMIS, or other owner-mandated markings at fixed chemical storage, fuel points, and yards where the site plan or AHJ require them; align with the SDS and local emergency response pre-plan.",
        "Worker awareness: Train to label and SDS content at a use level and know how to get help (supervision, site safety, poison control) before non-routine or unfamiliar chemical tasks.",
        "Contractor notification: Employers notify the host employer / GC/CM when bringing new or changed chemicals so incompatible operations, hot-work clearances, and storage limits stay valid.",
        "Damaged, bulging, or leaking containers: Report them immediately, isolate, and manage per the SDS, spill kit, and site/owner release rules. Repackage or decommission containers that are not serviceable; relabel if the label is defaced and the product is verified.",
        "Spill follow-through: For releases beyond a minor, controlled work-face cleanup, follow site emergency, environmental, and agency-reporting programs as applicableâ€”HazCom still owns SDS, labels, and worker communication.",
      ],
    },
  ];
}

function synthesizeIippSubsections(): CsepTemplateSubsection[] {
  return [
    {
      title: "IIPP / Emergency Response",
      items: [
        "Report: Injuries, illnesses, near misses, and significant property or environmental loss to supervision immediately; use recordable and owner/GC notification rules for each type.",
        "Control the scene: Stop the unsafe act or condition, isolate energy when needed, limit access, preserve evidence, support EMS.",
        "Medical / rescue: First aid and EMS per site plan; no improvised fall-arrest rescue outside trained, equipped procedures.",
        "Notify: Workers know how to reach 911 / site medic, give the project address, and use after-hours escalation when required.",
        "Investigate: Document facts, causes, and corrective actions; share lessons with affected crews; track repeat trends.",
        "Close the loop: Assign owners and dates; verify fixes in the field; retain training/visit records as the program requires.",
        "Restart: When hazards are abated, permits revalidated, and the competent person (or owner process) approves in writing if required.",
        "Major events: Muster, roll-call, evacuate or shelter for weather, fire, utility, or structural emergencies; re-enter only when released.",
      ],
    },
  ];
}

function buildHazardCrossReference(value: string) {
  const normalized = normalizeCompareToken(value);
  if (
    normalized.includes("hazard communication") ||
    normalized.includes("hazcom") ||
    normalized.includes("sds") ||
    normalized.includes("chemical")
  ) {
    return "Follow the project Hazard Communication requirements defined in the HazCom section.";
  }
  if (
    normalized.includes("emergency") ||
    normalized.includes("medical") ||
    normalized.includes("incident reporting") ||
    normalized.includes("near miss") ||
    normalized.includes("injury")
  ) {
    return "Follow the project IIPP / Emergency Response requirements defined in the IIPP / Emergency Response section.";
  }
  if (
    normalized.includes("security") ||
    normalized.includes("site entry") ||
    normalized.includes("visitor") ||
    normalized.includes("contraband") ||
    normalized.includes("weapon")
  ) {
    return "Follow the project Security at Site requirements defined in the Security at Site section.";
  }
  if (
    normalized.includes("laydown") ||
    normalized.includes("staging") ||
    normalized.includes("delivery route") ||
    normalized.includes("unloading") ||
    normalized.includes("material area") ||
    normalized.includes("traffic control")
  ) {
    return "Follow the project-wide Site Access, Laydown, and Traffic Control requirements in the Security at Site section.";
  }
  if (normalized.includes("drug") || normalized.includes("alcohol") || normalized.includes("substance") || normalized.includes("fit for duty")) {
    return "Follow the project IIPP / Emergency Response requirements defined in the IIPP / Emergency Response section.";
  }
  if (normalized.includes("discipline") || normalized.includes("enforcement") || normalized.includes("unsafe act")) {
    return "Follow the project Disciplinary Program requirements defined in the Disciplinary Program section.";
  }
  if (
    normalized.includes("overlapping trades") ||
    normalized.includes("trade interaction") ||
    normalized.includes("coordination") ||
    normalized.includes("handoff") ||
    normalized.includes("shared area")
  ) {
    return "Coordinate overlapping operations as required by the Trade Interaction Info section.";
  }
  return null;
}

function sanitizeHazardModuleSubsection(subsection: CsepTemplateSubsection): CsepTemplateSubsection {
  const filteredParagraphs = uniqueItems(
    (subsection.paragraphs ?? [])
      .flatMap((paragraph) => splitNarrativeSentences(paragraph))
      .map((sentence) => buildHazardCrossReference(sentence) ?? sentence)
      .filter((sentence) => {
        const normalized = normalizeCompareToken(sentence);
        return !(
          normalized.includes("message from owner") ||
          normalized.includes("purpose of this csep") ||
          normalized.includes("scope of this plan") ||
          normalized.includes("company mission") ||
          normalized.includes("owner message")
        );
      })
  );

  const filteredItems = uniqueItems(
    (subsection.items ?? [])
      .map((item) => buildHazardCrossReference(item) ?? item)
      .filter((item) => {
        const normalized = normalizeCompareToken(item);
        return !(
          normalized.includes("owner message") ||
          normalized.includes("policy statement") ||
          normalized.includes("scope of this plan")
        );
      })
  );

  return {
    ...subsection,
    paragraphs: filteredParagraphs,
    items: filteredItems,
  };
}

function hazardLinesFromSubsection(subsection: CsepTemplateSubsection): string[] {
  const tableLines =
    subsection.table?.rows.flatMap((row) =>
      row
        .map((cell) => cleanFinalText(cell) ?? "")
        .filter(Boolean)
        .map((cell) => cell.trim())
        .filter(Boolean)
    ) ?? [];
  return uniqueItems([...(subsection.paragraphs ?? []), ...(subsection.items ?? []), ...tableLines]);
}

function splitHazardLinesByType(lines: string[]) {
  const risk: string[] = [];
  const controls: string[] = [];
  const verification: string[] = [];
  const stopWork: string[] = [];
  const references: string[] = [];

  lines.forEach((line) => {
    const t = line.trim();
    if (!t) return;
    if (/\bR\d+\b|\bOSHA\b|\b29\s*CFR\b|subpart\s+[a-z]/i.test(t)) {
      references.push(t);
      return;
    }
    if (/\b(stop work|stop[-\s]?work|escalat|halt|pause work|suspend work)\b/i.test(t)) {
      stopWork.push(t);
      return;
    }
    if (/\b(verify|verification|inspect|inspection|check|checked|document|record|sign[-\s]?off|confirmed by|competent person|superintendent)\b/i.test(t)) {
      verification.push(t);
      return;
    }
    if (/\b(control|barrier|barricade|permit|ppe|required|must|ensure|maintain|protect|use|guard|anchor|tie[-\s]?off)\b/i.test(t)) {
      controls.push(t);
      return;
    }
    risk.push(t);
  });

  return { risk, controls, verification, stopWork, references };
}

function hazardCategoryFromSubsectionTitle(title: string):
  | "risk"
  | "controls"
  | "verification"
  | "stopWork"
  | "references"
  | "other" {
  const t = normalizeCompareToken(stripExistingNumberPrefix(title));
  if (!t) return "other";
  if (/\b(risk|hazard overview|when it applies|primary exposure|secondary exposure|purpose)\b/i.test(t)) {
    return "risk";
  }
  if (/\b(required controls|minimum required controls|pre task setup|task scope and sequence|work execution|permits and ppe)\b/i.test(t)) {
    return "controls";
  }
  if (/\b(how controls are met and verified|how controls are verified|verification and handoff|pre start verification|responsibilities and training)\b/i.test(t)) {
    return "verification";
  }
  if (/\b(stop[-\s]?work hold point triggers|stop[-\s]?work triggers|stop work triggers|stop work escalation)\b/i.test(t)) {
    return "stopWork";
  }
  if (/\b(references|applicable references)\b/i.test(t)) {
    return "references";
  }
  return "other";
}

function normalizeHazardModuleBlueprintSubsections(
  subsections: CsepTemplateSubsection[]
): CsepTemplateSubsection[] {
  const groupedByTitle = new Map<string, CsepTemplateSubsection[]>();
  for (const group of groupSubsectionsForFlatProgramOutline(subsections, "hazard_control_modules")) {
    const hazardName = majorProgramTitleForFlatGroup(group).trim() || "Hazard Module";
    const key = normalizeCompareToken(hazardName);
    groupedByTitle.set(key, [...(groupedByTitle.get(key) ?? []), ...group]);
  }
  const groups = Array.from(groupedByTitle.values());
  const normalized: CsepTemplateSubsection[] = [];

  for (const group of groups) {
    const hazardName = majorProgramTitleForFlatGroup(group).trim() || "Hazard Module";
    const riskLines: string[] = [];
    const controlLines: string[] = [];
    const verificationLines: string[] = [];
    const stopWorkLines: string[] = [];
    const referenceLines: string[] = [];

    for (const subsection of group) {
      const lines = hazardLinesFromSubsection(subsection);
      const split = splitHazardLinesByType(lines);
      const category = hazardCategoryFromSubsectionTitle(subsection.title);

      if (category === "risk") {
        riskLines.push(...lines);
      } else if (category === "controls") {
        controlLines.push(...lines);
      } else if (category === "verification") {
        verificationLines.push(...lines);
      } else if (category === "stopWork") {
        stopWorkLines.push(...lines);
      } else if (category === "references") {
        referenceLines.push(...lines);
      } else {
        riskLines.push(...split.risk);
        controlLines.push(...split.controls);
        verificationLines.push(...split.verification);
        stopWorkLines.push(...split.stopWork);
        referenceLines.push(...split.references);
      }

      if (category !== "references") referenceLines.push(...split.references);
      if (category !== "stopWork") stopWorkLines.push(...split.stopWork);
      if (category !== "verification") verificationLines.push(...split.verification);
      if (category !== "controls") controlLines.push(...split.controls);
      if (category !== "risk") riskLines.push(...split.risk);
    }

    const riskParagraphs = uniqueItems(riskLines).slice(0, 5);
    const requiredControls = uniqueItems(
      controlLines.filter((line) => !/\b(standard ppe|minimum ppe|required ppe reference list)\b/i.test(line))
    ).slice(0, 8);
    const verificationItems = uniqueItems(verificationLines).slice(0, 6);
    const stopWorkItems = uniqueItems(stopWorkLines).slice(0, 6);
    const refs = uniqueItems(referenceLines).filter((line) => /\bR\d+\b|\bOSHA\b|\b29\s*CFR\b|subpart\s+[a-z]/i.test(line));

    normalized.push(
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[0]),
        paragraphs: riskParagraphs.length
          ? riskParagraphs
          : ["Describe the actual field exposure and where workers can be hurt if controls fail."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[1]),
        items: requiredControls.length
          ? requiredControls
          : ["List hazard-specific controls required before and during work."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[2]),
        items: verificationItems.length
          ? verificationItems
          : ["Identify who verifies controls, when checks occur, and what field confirmation or records are required."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[3]),
        items: stopWorkItems.length
          ? stopWorkItems
          : ["Stop work when conditions change or required controls are missing, damaged, or not understood by the crew."],
      },
      {
        title: buildHazardSliceTitle(hazardName, CSEP_HAZARD_TEMPLATE_SLICES[4]),
        items: refs.length ? refs : ["Use applicable R-number and OSHA references for this hazard module."],
      }
    );
  }

  return normalized;
}

function buildSectionSubsections(
  definition: FixedSectionDefinition,
  grouped: Map<string, CsepTemplateSubsection[]>,
  context: {
    draft: GeneratedSafetyPlanDraft;
    projectName: string;
    contractorName: string;
    tradeLabel: string;
    subTradeLabel: string;
    taskTitles: string[];
  }
) {
  let subsections = stripSharedContentAcrossSubsections(
    dedupeTemplateSubsections(grouped.get(definition.key) ?? [])
  );

  if (definition.key === "scope_of_work_section") {
    subsections = sortScopeSubsectionsInProjectSetupOrder(
      pruneScopeAdministrativeSubsections(filterScopeTemplateSubsections(subsections), context)
    );
  }
  if (definition.key === "site_access_security_laydown_traffic_control") {
    subsections = filterSecurityAtSiteSubsections(subsections);
  }

  if (definition.key === "worker_conduct_fit_for_duty_disciplinary_program") {
    subsections = filterDisciplinaryTemplateSubsections(
      stripSharedContentAcrossSubsections(dedupeTemplateSubsections(subsections))
    );
  }

  if (definition.key === "owner_message" && !hasMeaningfulSubsections(subsections)) {
    const steelErection = isStructuralSteelOrDeckingScope(
      context.draft,
      context.tradeLabel,
      context.subTradeLabel
    );
    subsections = synthesizeOwnerMessageSubsections(context.projectName, context.contractorName, {
      steelErection,
    });
  }

  if (definition.key === "sign_off_page" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeSignOffSubsections();
  }

  if (definition.key === "purpose" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizePurposeSubsections(context.projectName, {
      steelErection: isStructuralSteelOrDeckingScope(
        context.draft,
        context.tradeLabel,
        context.subTradeLabel
      ),
    });
  }

  if (definition.key === "regulatory_basis_and_references") {
    const existingText = subsections.flatMap((subsection) => [
      ...(subsection.paragraphs ?? []),
      ...(subsection.items ?? []),
      ...(subsection.table?.rows.flatMap((row) => row) ?? []),
    ]).join(" ");
    if (!/\bR[1-9]\b/.test(existingText) || !/OSHA\s+29\s+CFR/i.test(existingText)) {
      subsections = [
        ...subsections,
        ...synthesizeRegulatoryReferenceSubsections(),
      ];
    }
  }

  if (definition.key === "scope_of_work_section" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeScopeSubsections(
      context.draft,
      context.projectName,
      context.contractorName,
      context.tradeLabel,
      context.subTradeLabel,
      context.taskTitles
    );
  }

  if (definition.key === "top_10_critical_risks") {
    const synthesized = synthesizeTopRiskSubsections(
      context.draft,
      context.tradeLabel,
      context.subTradeLabel
    );
    const seed = hasMeaningfulSubsections(subsections)
      ? stripSharedContentAcrossSubsections(dedupeTemplateSubsections([...synthesized, ...subsections]))
      : synthesized;
    const merged = dedupeRiskLabelsPreservingOrder(
      flattenTopRiskCandidateStrings(seed, context.draft),
      10
    );
    subsections = [
      {
        title: "Top 10 Risks",
        items: merged.length ? merged : [placeholderParagraphForSection("top_10_critical_risks")],
        plainItemsStyle: "offset_lines",
      },
    ];
  }

  if (definition.key === "trade_interaction_and_coordination") {
    const tradeCtx = { tradeLabel: context.tradeLabel, subTradeLabel: context.subTradeLabel };
    if (!hasMeaningfulSubsections(subsections)) {
      subsections = synthesizeTradeInteractionSubsections(context.draft, tradeCtx);
    } else {
      subsections = filterTradeInteractionSubsections(
        stripSharedContentAcrossSubsections(dedupeTemplateSubsections(subsections))
      );
      if (!hasMeaningfulSubsections(subsections)) {
        subsections = synthesizeTradeInteractionSubsections(context.draft, tradeCtx);
      }
    }
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "hazard_communication_and_environmental_protection" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeHazcomSubsections();
  }
  if (definition.key === "hazard_communication_and_environmental_protection") {
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "iipp_incident_reporting_corrective_action" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeIippSubsections();
  }
  if (definition.key === "iipp_incident_reporting_corrective_action") {
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "high_risk_steel_erection_programs" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeNamedModuleSubsections(
      HIGH_RISK_STEEL_PROGRAMS,
      "Apply this program when the activity is part of the active structural steel or decking scope; verify competent-person ownership, access control, permits, and stop-work triggers before work starts."
    );
  }

  if (definition.key === "hazard_control_modules") {
    subsections = stripSharedContentAcrossSubsections(
      dedupeTemplateSubsections(subsections.map((subsection) => sanitizeHazardModuleSubsection(subsection)))
    );
    if (!hasMeaningfulSubsections(subsections)) {
      subsections = synthesizeNamedModuleSubsections(
        HAZARD_CONTROL_MODULES,
        "Document the hazard-specific exposure, required controls, verification method, and stop-work trigger for this module."
      );
    }
    subsections = normalizeHazardModuleBlueprintSubsections(subsections);
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "task_execution_modules" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeNamedModuleSubsections(
      TASK_EXECUTION_MODULES,
      "Document the task sequence, required hold points, crew coordination, and field verification for this execution module."
    );
  }

  if (definition.key === "ppe_and_work_attire" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeWorkAttireSubsections();
  }

  if (definition.key === "site_access_security_laydown_traffic_control") {
    subsections = applySectionOwnershipFilter(definition.key, subsections);
  }

  if (definition.key === "training_competency_and_certifications" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeTrainingInspectionsMonitoringRecordkeepingSubsections();
  }
  if (definition.key === "training_competency_and_certifications") {
    const steelScope = isStructuralSteelOrDeckingScope(
      context.draft,
      context.tradeLabel,
      context.subTradeLabel
    );
    const hasLiftPlanCoverage = subsections.some((sub) =>
      /\b(crane permit|lift plan|pick plan|critical lift)\b/i.test(
        `${sub.title} ${(sub.paragraphs ?? []).join(" ")} ${(sub.items ?? []).join(" ")}`
      )
    );
    if (steelScope && !hasLiftPlanCoverage) {
      subsections = [
        ...subsections,
        {
          title: "Lifting Plan Readiness",
          items: [
            "For lifting activities, verify lift plan / pick plan communication and crane permit responsibilities before execution.",
          ],
        },
      ];
    }
  }

  if (definition.key === "project_closeout" && !hasMeaningfulSubsections(subsections)) {
    subsections = synthesizeCloseOutLessonsLearnedSubsections();
  }

  if (!hasMeaningfulSubsections(subsections) && definition.key !== "table_of_contents") {
    subsections = [
      {
        title: stripExistingNumberPrefix(definition.title),
        paragraphs: [placeholderParagraphForSection(definition.key)],
      },
    ];
  }

  return subsections;
}

/** Workspace company name stored on the draft (export API may override). */
function configuredCompanyNameFromDraft(draft: GeneratedSafetyPlanDraft): string | null {
  const snap = draft.builderSnapshot;
  if (snap && typeof snap === "object") {
    const o = snap as Record<string, unknown>;
    const fromSnap =
      typeof o.company_name === "string"
        ? o.company_name.trim()
        : typeof o.companyName === "string"
          ? o.companyName.trim()
          : "";
    if (fromSnap) return fromSnap;
  }
  const prov = draft.provenance;
  if (prov && typeof prov === "object") {
    const o = prov as Record<string, unknown>;
    const fromProv =
      typeof o.companyName === "string"
        ? o.companyName.trim()
        : typeof o.company_name === "string"
          ? o.company_name.trim()
          : "";
    if (fromProv) return fromProv;
  }
  return null;
}

/** Cover metadata rows already shown on the structured title page block. */
const COVER_METADATA_ON_TITLE_PAGE = new Set([
  "Project Name",
  "Project Address",
  "Governing State",
  "Contractor",
  "Date",
]);

export function buildCsepRenderModelFromGeneratedDraft(
  draft: GeneratedSafetyPlanDraft,
  options?: { footerCompanyName?: string | null }
): CsepRenderModel {
  const structuredDraft = buildStructuredCsepDraft(draft, { finalIssueMode: true });
  const draftHasStructuredKinds = draft.sectionMap.some((section) =>
    ["front_matter", "main", "appendix"].includes(section.kind ?? "")
  );
  const contractorName = finalValueOrNA(draft.projectOverview.contractorCompany);
  const tradeLabels = uniqueValues(draft.operations.map((operation) => operation.tradeLabel));
  const subTradeLabels = uniqueValues(draft.operations.map((operation) => operation.subTradeLabel));
  const taskTitles = uniqueValues(draft.operations.map((operation) => operation.taskTitle));
  // Relocate the raw task/hazard/control matrix from the main narrative flow
  // to a clean appendix table so the main body stays readable. Applied to both
  // the structured and legacy source maps so the matrix surfaces as an
  // appendix regardless of which source the main-body pipeline chooses below.
  const relocateMatrixToAppendix = (section: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection => {
    const normalizedKey = normalizeToken(section.key);
    const normalizedTitle = normalizeToken(section.title);
    const looksLikeMatrix =
      normalizedKey.includes("activity hazard matrix") ||
      normalizedKey.includes("task hazard control matrix") ||
      normalizedTitle.includes("activity hazard matrix") ||
      normalizedTitle.includes("task hazard control matrix");
    if (!looksLikeMatrix) return section;
    return {
      ...section,
      key: "appendix_e_task_hazard_control_matrix",
      kind: "appendix",
      title: "Appendix E. Task-Hazard-Control Matrix",
    };
  };
  const legacySanitizedSections = relocateSafetyProgramReferencePacks(
    draft.sectionMap.map(sanitizeGeneratedSection).map(relocateMatrixToAppendix)
  );
  const sanitizedSections = relocateSafetyProgramReferencePacks(
    structuredDraft.sectionMap.map(sanitizeGeneratedSection).map(relocateMatrixToAppendix)
  );
  const issueLabel = structuredDraft.documentControl?.issueDate || todayIssueLabel();
  const preparedBy =
    cleanFinalText(structuredDraft.documentControl?.preparedBy) ||
    cleanFinalText(draft.projectOverview.contractorCompany) ||
    "Authorized Contractor Representative";
  const approvedBy =
    cleanFinalText(structuredDraft.documentControl?.approvedBy) ||
    cleanFinalText(structuredDraft.documentControl?.reviewedBy) ||
    cleanFinalText(draft.projectOverview.contractorCompany) ||
    preparedBy;
  const projectName = finalValueOrNA(draft.projectOverview.projectName);
  const projectAddress = finalValueOrNA(draft.projectOverview.projectAddress);
  const provenanceRecord = draft.provenance as Record<string, unknown>;
  const governingFromProvenance =
    typeof provenanceRecord.governingState === "string" ? provenanceRecord.governingState.trim() : "";
  const builderSnap =
    draft.builderSnapshot && typeof draft.builderSnapshot === "object"
      ? (draft.builderSnapshot as Record<string, unknown>)
      : null;
  const governingFromSnapshot =
    builderSnap && typeof builderSnap.governing_state === "string"
      ? String(builderSnap.governing_state).trim()
      : "";
  const governingStateRaw = governingFromProvenance || governingFromSnapshot;
  const titlePageProjectLocation = finalValueOrNA(
    (draft.projectOverview.projectAddress?.trim() && draft.projectOverview.projectAddress.trim()) ||
      (draft.projectOverview.location?.trim() && draft.projectOverview.location.trim()) ||
      ""
  );
  const titlePageGoverningState = governingStateRaw.trim() ? governingStateRaw.trim() : "N/A";
  const titlePageTaskSummary = taskTitles.length ? taskTitles.join("; ") : "N/A";
  const footerCompanyNameResolved =
    options?.footerCompanyName?.trim() || configuredCompanyNameFromDraft(draft) || "";
  const coverMetadataRows = meaningfulFieldRows([
    { label: "Project Name", value: projectName },
    { label: "Project Number", value: finalValueOrNA(draft.projectOverview.projectNumber) },
    { label: "Project Address", value: projectAddress },
    ...(governingStateRaw ? [{ label: "Governing State", value: governingStateRaw }] : []),
    { label: "Owner / Client", value: finalPartyValueOrNA(draft.projectOverview.ownerClient) },
    {
      label: "GC / CM / program partners (list all with site safety or logistics authority)",
      value: formatGcCmPartnersForExport(normalizeGcCmPartnerEntries(draft.projectOverview.gcCm)),
    },
    { label: "Contractor", value: contractorName },
    { label: "Prepared By", value: preparedBy },
    { label: "Date", value: issueLabel },
    { label: "Revision", value: structuredDraft.documentControl?.revision || "1.0" },
  ]);
  const orderedSections = buildCsepTemplateSections({
    draft,
    projectName,
    contractorName,
    tradeLabel: joinDisplayValues(tradeLabels, "N/A"),
    subTradeLabel: joinDisplayValues(subTradeLabels, "N/A"),
    issueLabel,
    taskTitles,
    sourceSections: draftHasStructuredKinds ? sanitizedSections : legacySanitizedSections,
  });
  const frontMatterSections = orderedSections.filter((section) => section.kind === "front_matter");
  const mainSections = orderedSections.filter((section) => section.kind === "main");
  // Combine appendix-kind sections from both the structured draft and the
  // legacy (raw) draft so relocated items like the Task-Hazard-Control Matrix
  // are never dropped when the structured pipeline omits them. Dedupe by
  // stable section key to avoid duplicate appendix entries.
  const appendixSourceSections: GeneratedSafetyPlanSection[] = [];
  const seenAppendixKeys = new Set<string>();
  for (const section of [...sanitizedSections, ...legacySanitizedSections]) {
    if (section.kind !== "appendix") continue;
    const nk = normalizeToken(section.key ?? "");
    if (
      ![
        "appendix a forms and permit library",
        "appendix b incident and investigation package",
        "appendix c checklists and inspection sheets",
        "appendix d field references maps and contact inserts",
        "appendix e task hazard control matrix",
      ].includes(nk)
    ) {
      continue;
    }
    // End-matter document control is rendered once from `document_control_and_revision_history`;
    // drop legacy keys so revision metadata is not duplicated near the front or twice at the end.
    if (nk === "document control" || nk === "revision history") continue;
    const signature = normalizeToken(section.key) || normalizeToken(section.title);
    if (!signature || seenAppendixKeys.has(signature)) continue;
    seenAppendixKeys.add(signature);
    appendixSourceSections.push(section);
  }
  const appendixSections = appendixSourceSections
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(toTemplateSection);

  return {
    projectName,
    contractorName,
    footerCompanyName: footerCompanyNameResolved,
    tradeLabel: joinDisplayValues(tradeLabels, "N/A"),
    subTradeLabel: joinDisplayValues(subTradeLabels, "N/A"),
    issueLabel,
    titlePageTaskSummary,
    titlePageProjectLocation,
    titlePageGoverningState,
    statusLabel: "Contractor Issue",
    preparedBy,
    coverSubtitleLines: [],
    coverMetadataRows,
    coverLogo: getOptionalCoverLogo(draft),
    approvalLines: [
      "Project Manager / Competent Person: ___________________________ Signature / Date",
      "Corporate Safety Director: ___________________________ Signature / Date",
    ],
    revisionHistory: [
      {
        revision: structuredDraft.documentControl?.revision || "1.0",
        date: issueLabel,
        description: "Initial issuance for generated CSEP export",
        preparedBy,
        approvedBy,
      },
    ],
    frontMatterSections,
    sections: mainSections,
    appendixSections,
    disclaimerLines: DOCUMENT_DISCLAIMER_LINES,
    filenameProjectPart: safeFilePart(draft.projectOverview.projectName, "Project"),
  };
}

function makeParagraph(children: TextRun[], options?: {
  style?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacing?: { before?: number; after?: number; line?: number };
  keepNext?: boolean;
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  indent?: { left?: number; hanging?: number };
}) {
  return new Paragraph({
    style: options?.style,
    alignment: options?.alignment,
    spacing: options?.spacing,
    keepNext: options?.keepNext,
    heading: options?.heading,
    indent: options?.indent,
    children,
  });
}

function bodyParagraph(
  text: string,
  options?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    style?: string;
    spacing?: { before?: number; after?: number; line?: number };
    indent?: { left?: number; hanging?: number };
  }
) {
  return makeParagraph(
    [
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
    ],
    {
      style: options?.style ?? STYLE_IDS.body,
      alignment: options?.alignment,
      spacing: options?.spacing,
      indent: options?.indent,
    }
  );
}

function sectionHeading(text: string, color: string = COLORS.titleBlue) {
  return makeParagraph(
    [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        size: 28,
        color,
      }),
    ],
    {
      style: STYLE_IDS.sectionHeading,
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
    }
  );
}

function sectionDescriptorParagraph(text: string) {
  return makeParagraph(
    [
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Calibri",
        italics: true,
        size: 20,
        color: COLORS.gray,
      }),
    ],
    {
      style: STYLE_IDS.sectionDescriptor,
      keepNext: true,
      spacing: { before: 36, after: 140, line: 276 },
    }
  );
}

function sectionHeadingTone(section: CsepTemplateSection) {
  const token = normalizeToken(`${section.title} ${section.key}`);
  if (token.includes("incident") || token.includes("communication")) {
    return COLORS.accentRed;
  }
  return COLORS.titleBlue;
}

function numberedParagraph(
  numberLabel: string,
  text: string,
  options?: {
    indent?: { left?: number; hanging?: number };
    spacing?: { before?: number; after?: number; line?: number };
  }
) {
  return makeParagraph(
    [
      new TextRun({
        text: `${numberLabel} `,
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
    ],
    {
      style: STYLE_IDS.body,
      indent: options?.indent ?? { left: INDENTS.numberedLeft, hanging: INDENTS.numberedHanging },
      spacing: options?.spacing,
    }
  );
}

function termDefinitionParagraph(term: string, definition: string) {
  const polishedTerm = polishCsepDocxNarrativeText(term, { skipTerminalPunctuation: true });
  const polishedDefinition = polishCsepDocxNarrativeText(definition);
  return makeParagraph(
    [
      new TextRun({
        text: `${polishedTerm}: `,
        font: "Calibri",
        bold: true,
        size: 21,
        color: COLORS.ink,
      }),
      new TextRun({
        text: polishedDefinition,
        font: "Calibri",
        size: 21,
        color: COLORS.ink,
      }),
    ],
    {
      style: STYLE_IDS.body,
    }
  );
}

function createRunningFooter(footerCompanyName: string, contractorName: string) {
  return new Footer({
    children: [
      makeParagraph(
        [
          new TextRun({
            text: `${footerCompanyName}  |  ${contractorName}  |  `,
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            text: "Page ",
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            text: " of ",
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: "Calibri",
            size: 18,
            color: COLORS.gray,
          }),
        ],
        {
          alignment: AlignmentType.CENTER,
        }
      ),
    ],
  });
}

function subtleDivider() {
  return new Paragraph({
    border: {
      bottom: {
        color: COLORS.titleBlue,
        style: BorderStyle.SINGLE,
        size: 3,
      },
    },
    spacing: { after: 140 },
    children: [],
  });
}

function labeledFieldParagraph(
  label: string,
  value: string,
  options?: {
    indent?: { left?: number; hanging?: number };
    spacing?: { after?: number; line?: number };
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  }
) {
  const trimmed = value?.trim() ? value.trim() : "N/A";
  const lines = trimmed.split("\n");
  const valueRuns: TextRun[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      valueRuns.push(new TextRun({ break: 1 }));
    }
    valueRuns.push(
      new TextRun({
        text: polishCsepDocxNarrativeText(line),
        font: "Calibri",
        size: 20,
        color: COLORS.ink,
      })
    );
  });

  return makeParagraph(
    [
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: "Calibri",
        size: 20,
        color: COLORS.deepBlue,
      }),
      ...valueRuns,
    ],
    {
      style: STYLE_IDS.body,
      spacing: options?.spacing ?? { after: 100, line: 276 },
      indent: options?.indent,
      alignment: options?.alignment,
    }
  );
}

function approvalSignatureAsParagraphs(lines: string[]) {
  const out: Paragraph[] = [];

  lines.forEach((line) => {
    const label = line.includes(":") ? line.split(":")[0].trim() : line.trim();
    out.push(
      labeledFieldParagraph(label || "Approver", "________________________________  Date: ________________")
    );
  });

  return out;
}

function createCover(model: CsepRenderModel) {
  const tradeLine = finalValueOrNA(model.tradeLabel ?? "");
  const subTradeLine = finalValueOrNA(model.subTradeLabel ?? "");
  const taskSummary = model.titlePageTaskSummary?.trim() ? model.titlePageTaskSummary.trim() : "N/A";
  const projectLocation = model.titlePageProjectLocation?.trim()
    ? model.titlePageProjectLocation.trim()
    : finalValueOrNA("");
  const governingState =
    model.titlePageGoverningState?.trim() && model.titlePageGoverningState.trim() !== ""
      ? model.titlePageGoverningState.trim()
      : "N/A";

  const titlePageRows: Array<{ label: string; value: string }> = [
    { label: "Document title", value: "Contractor Safety & Environmental Plan (CSEP)" },
    { label: "Project name", value: finalValueOrNA(model.projectName) },
    { label: "Trade", value: tradeLine },
    { label: "Sub-trade", value: subTradeLine },
    { label: "Tasks", value: taskSummary },
    { label: "Issue date", value: finalValueOrNA(model.issueLabel) },
    { label: "Project location", value: projectLocation },
    { label: "Contractor", value: finalValueOrNA(model.contractorName) },
    { label: "Governing state", value: governingState },
  ];

  const coverChildren: Paragraph[] = [
    subtleDivider(),
    bodyParagraph("Title Page", {
      style: STYLE_IDS.subheading,
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
    }),
    makeParagraph(
      [
        new TextRun({
          text: "CONTRACTOR SAFETY & ENVIRONMENTAL PLAN (CSEP)",
          font: "Calibri Light",
          bold: true,
          size: 32,
          color: COLORS.titleBlue,
        }),
      ],
      {
        style: STYLE_IDS.coverTitle,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }
    ),
  ];

  titlePageRows.forEach((row) => {
    coverChildren.push(
      labeledFieldParagraph(row.label, row.value, {
        alignment: AlignmentType.CENTER,
        spacing: { after: 88, line: 276 },
      })
    );
  });

  if (model.coverLogo) {
    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 220 },
        children: [
          new ImageRun({
            type: model.coverLogo.type,
            data: model.coverLogo.data,
            transformation: {
              width: 220,
              height: 88,
            },
          }),
        ],
      })
    );
  }

  model.coverSubtitleLines
    .filter(
      (line) =>
        line.trim() &&
        line.trim() !== "N/A" &&
        !/^trade:\s*n\/a$/i.test(line.trim()) &&
        !/^sub-?trade:\s*n\/a$/i.test(line.trim()) &&
        normalizeCompareToken(line) !== normalizeCompareToken(model.contractorName)
    )
    .forEach((line) => {
      coverChildren.push(
        bodyParagraph(line, {
          alignment: AlignmentType.CENTER,
          style: STYLE_IDS.coverMeta,
        })
      );
    });

  const secondaryMetadataRows = meaningfulFieldRows(
    model.coverMetadataRows.filter((row) => !COVER_METADATA_ON_TITLE_PAGE.has(row.label))
  );
  if (secondaryMetadataRows.length) {
    coverChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [],
      })
    );
    secondaryMetadataRows.forEach((row) => {
      coverChildren.push(
        labeledFieldParagraph(row.label, row.value, {
          indent: { left: 360 },
          spacing: { after: 90, line: 276 },
        })
      );
    });
  }

  // Approval block. Reframed so it reads as an intentional pre-issue approval
  // placeholder rather than an unresolved draft artifact.
  coverChildren.push(
    bodyParagraph("Approval Block â€” Required Before Field Issue", {
      style: STYLE_IDS.subheading,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 90 },
    })
  );
  coverChildren.push(
    bodyParagraph(
      "The signatures below confirm that this CSEP has been reviewed against the project scope, site rules, and applicable regulatory requirements prior to field use.",
      {
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      }
    )
  );
  coverChildren.push(...approvalSignatureAsParagraphs(model.approvalLines));

  return coverChildren;
}

/**
 * Renders table rows as indented body/labeled content without 5.85.1, 5.85.2-style line numbers.
 */
function appendTableRowsAsOffsetParagraphs(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  options: {
    renderMode?: "numbered" | "definitions";
    /** Under a numbered subsection (5.x.y) â€” deeper indent for matrix rows. */
    nested: boolean;
  }
) {
  if (!table.rows.length) return;

  const titleIndent = options.nested
    ? { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging }
    : { left: INDENTS.childLeft, hanging: INDENTS.childHanging };
  const fieldIndent = options.nested
    ? { left: INDENTS.grandchildBodyLeft }
    : { left: INDENTS.childBodyLeft };
  const simpleIndent = options.nested
    ? { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging }
    : { left: INDENTS.childBodyLeft };

  table.rows.forEach((row, rowIndex) => {
    if (options.renderMode === "definitions") {
      const term = row[0]?.trim() || "Term";
      const definition = row[1]?.trim() || "Definition pending";
      children.push(termDefinitionParagraph(term, definition));
      return;
    }

    const structuredRow = buildStructuredTableRow(table, row, rowIndex);
    if (structuredRow) {
      children.push(
        bodyParagraph(structuredRow.title, {
          indent: titleIndent,
          spacing: { before: 60, after: 60, line: 276 },
        })
      );
      structuredRow.fields.forEach((field) => {
        children.push(
          labeledFieldParagraph(field.label, field.value, {
            indent: fieldIndent,
            spacing: { after: 110, line: 276 },
          })
        );
      });
      return;
    }

    const text =
      formatActivityMatrixRow(table, row) ??
      table.columns
        .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
        .join(" ");
    children.push(
      bodyParagraph(text, {
        indent: simpleIndent,
        spacing: { before: 60, after: 90, line: 276 },
      })
    );
  });
}

/**
 * Top-level table rows (no distinct subsection) as offset body â€” does not advance the outline counter.
 */
function appendTopLevelTableRowsAsOffset(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  options?: {
    renderMode?: "numbered" | "definitions";
  }
) {
  appendTableRowsAsOffsetParagraphs(children, table, {
    ...options,
    nested: false,
  });
}

function appendTableRowsAsNumberedParagraphs(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  subsectionLabel: string,
  priorItemCount: number,
  options?: {
    renderMode?: "numbered" | "definitions";
  }
) {
  if (!table.rows.length) return;

  table.rows.forEach((row, rowIndex) => {
    if (options?.renderMode === "definitions") {
      const term = row[0]?.trim() || "Term";
      const definition = row[1]?.trim() || "Definition pending";
      children.push(termDefinitionParagraph(term, definition));
      return;
    }

    const num = `${subsectionLabel}.${priorItemCount + rowIndex + 1}`;
    const structuredRow = buildStructuredTableRow(table, row, rowIndex);
    if (structuredRow) {
      children.push(
        numberedParagraph(num, structuredRow.title, {
          indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
          spacing: { before: 60, after: 60, line: 276 },
        })
      );
      structuredRow.fields.forEach((field) => {
        children.push(
          labeledFieldParagraph(field.label, field.value, {
            indent: { left: INDENTS.grandchildBodyLeft },
            spacing: { after: 110, line: 276 },
          })
        );
      });
      return;
    }

    const text =
      formatActivityMatrixRow(table, row) ??
      table.columns
        .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
        .join(" ");
    children.push(numberedParagraph(num, text));
  });
}

function appendTopLevelTableRows(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  basePrefix: string,
  startingIndex: number,
  options?: {
    renderMode?: "numbered" | "definitions";
  }
) {
  if (!table.rows.length) return startingIndex;

  if (options?.renderMode === "definitions") {
    table.rows.forEach((row) => {
      const term = row[0]?.trim() || "Term";
      const definition = row[1]?.trim() || "Definition pending";
      children.push(termDefinitionParagraph(term, definition));
    });
    return startingIndex;
  }

  let currentIndex = startingIndex;
  table.rows.forEach((row) => {
    currentIndex += 1;
    const structuredRow = buildStructuredTableRow(table, row, currentIndex - 1);
    if (structuredRow) {
      children.push(
        numberedParagraph(`${basePrefix}.${currentIndex}`, structuredRow.title, {
          spacing: { before: 80, after: 60, line: 276 },
        })
      );
      structuredRow.fields.forEach((field) => {
        children.push(
          labeledFieldParagraph(field.label, field.value, {
            indent: { left: INDENTS.childBodyLeft },
            spacing: { after: 110, line: 276 },
          })
        );
      });
      return;
    }

    const text =
      formatActivityMatrixRow(table, row) ??
      table.columns
        .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
        .join(" ");
    children.push(numberedParagraph(`${basePrefix}.${currentIndex}`, text));
  });

  return currentIndex;
}

function isFieldValueTable(table: NonNullable<GeneratedSafetyPlanSection["table"]>) {
  const columns = table.columns.map(normalizeToken);
  return columns.length === 2 && columns[0] === "field" && columns[1] === "value";
}

function appendFieldValueTableParagraphs(
  children: Paragraph[],
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  options?: { indent?: { left?: number; hanging?: number } }
) {
  table.rows.forEach((row) => {
    const label = cleanFinalText(row[0]) ?? "";
    const value = cleanFinalText(row[1]);
    if (!label || !value || normalizeCompareToken(value) === "n a") {
      return;
    }
    children.push(
      labeledFieldParagraph(label, value, {
        indent: options?.indent,
        spacing: { after: 120, line: 276 },
      })
    );
  });
}

function buildStructuredTableRow(
  table: NonNullable<GeneratedSafetyPlanSection["table"]>,
  row: string[],
  rowIndex: number
) {
  if (table.columns.length < 2 || isFieldValueTable(table)) {
    return null;
  }

  const rawTitle =
    cleanFinalText(row[0]) ??
    cleanFinalText(`${cleanFinalText(table.columns[0]) ?? "Item"} ${rowIndex + 1}`);
  if (!rawTitle || normalizeCompareToken(rawTitle) === "n a") {
    return null;
  }
  // Strip any pre-existing "Appendix X.Y" or numbered prefix so the renderer's
  // own numbering is not duplicated (e.g. "Appendix B.1 Appendix B.1 â€¦").
  const title = stripExistingNumberPrefix(rawTitle) || rawTitle;

  const fields = table.columns
    .slice(1)
    .map((column, columnIndex) => ({
      label: cleanFinalText(column) ?? `Detail ${columnIndex + 1}`,
      value: normalizeFinalExportText(row[columnIndex + 1]),
    }))
    .filter(
      (entry): entry is { label: string; value: string } =>
        Boolean(entry.label && entry.value && normalizeCompareToken(entry.value) !== "n a")
    );

  if (!fields.length) {
    return null;
  }

  return { title, fields };
}

/** Strip only numeric outline prefixes; keep "Appendix A. â€¦" titles intact for outline headings. */
function baseTitleForOutlineHeading(section: CsepTemplateSection) {
  return section.title.trim().replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
}

/** Section heading text using contiguous outline ordinals (same source as TOC). */
function displayOutlineSectionHeading(ordinal: number, section: CsepTemplateSection) {
  const base = baseTitleForOutlineHeading(section);
  return `${ordinal}. ${base}`.trim();
}

export type CsepOutlinePlanEntry =
  | { kind: "title_page"; ordinal: number }
  | { kind: "body_section"; ordinal: number; section: CsepTemplateSection }
  | { kind: "disclaimer"; ordinal: number };

/**
 * Outline order matches `createCsepDocument` after the cover: one contiguous 1..N
 * sequence for the title page line, each body section, attachment/appendix dividers
 * when present, and the disclaimer.
 */
export function buildCsepOutlinePlan(model: CsepRenderModel): CsepOutlinePlanEntry[] {
  let ordinal = 1;
  const entries: CsepOutlinePlanEntry[] = [];
  entries.push({ kind: "title_page", ordinal: ordinal++ });
  model.frontMatterSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.sections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.appendixSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  entries.push({ kind: "disclaimer", ordinal: ordinal++ });
  return entries;
}

function formatOutlineTocLine(entry: CsepOutlinePlanEntry): string {
  switch (entry.kind) {
    case "title_page":
      return `${entry.ordinal}. Title Page`;
    case "body_section":
      return displayOutlineSectionHeading(entry.ordinal, entry.section);
    case "disclaimer":
      return `${entry.ordinal}. Disclaimer`;
  }
}

function outlineOrdinalForSectionKey(plan: CsepOutlinePlanEntry[], sectionKey: string): number {
  const hit = plan.find(
    (e): e is Extract<CsepOutlinePlanEntry, { kind: "body_section" }> =>
      e.kind === "body_section" && e.section.key === sectionKey
  );
  if (!hit) {
    throw new Error(`CSEP outline plan missing section key "${sectionKey}".`);
  }
  return hit.ordinal;
}

function outlineOrdinalForKind(
  plan: CsepOutlinePlanEntry[],
  kind: "disclaimer"
): number {
  const hit = plan.find((e) => e.kind === kind);
  if (!hit) {
    throw new Error(`CSEP outline plan missing entry kind "${kind}".`);
  }
  return hit.ordinal;
}

function sectionPrefix(_section: CsepTemplateSection, outlineOrdinal: number) {
  return String(outlineOrdinal);
}

function isDistinctSubheading(sectionTitle: string, subsectionTitle: string) {
  return normalizeToken(stripExistingNumberPrefix(sectionTitle)) !== normalizeToken(stripExistingNumberPrefix(subsectionTitle));
}

function shouldRenderSubheading(sectionTitle: string, subsection: CsepTemplateSubsection) {
  const title = stripExistingNumberPrefix(subsection.title).trim();
  if (!title) return false;
  if (!isDistinctSubheading(sectionTitle, subsection.title)) return false;
  if (subsection.table?.rows.length) return true;

  const comparableContent = uniqueItems([
    ...(subsection.paragraphs ?? []),
    ...(subsection.items ?? []),
  ]).map((value) => normalizeToken(value));
  const uniqueComparableContent = Array.from(new Set(comparableContent.filter(Boolean)));

  return !(uniqueComparableContent.length === 1 && uniqueComparableContent[0] === normalizeToken(title));
}

const CSEP_SECTION_KEYS_WITH_FLAT_PROGRAM_OUTLINE = new Set<string>([
  "high_risk_steel_erection_programs",
  "hazard_control_modules",
  "task_execution_modules",
  CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
]);
const MAX_HAZARD_TOP_LEVEL_NUMBERED_ITEMS = 24;

const EM_DASH_TITLE_SPLIT = /\s*[â€”]\s*/u;

/**
 * When set, catalog program slices (e.g. "Program: When It Applies") and
 * appendix reference rows ("Program â€” overview") share one outline number for
 * the program and render inner slices as unnumbered subheadings + body text.
 */
function usesFlatProgramOutline(section: CsepTemplateSection) {
  return CSEP_SECTION_KEYS_WITH_FLAT_PROGRAM_OUTLINE.has(section.key);
}

function programBaseKeyFromSubsectionTitle(
  rawTitle: string,
  sectionKey: string
): string | null {
  const t = stripExistingNumberPrefix(rawTitle).trim();
  if (!t) return null;

  const emParts = t.split(EM_DASH_TITLE_SPLIT);
  if (emParts.length >= 2 && sectionKey === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY) {
    return normalizeToken(emParts[0]!.trim());
  }

  const colonIdx = t.indexOf(": ");
  if (colonIdx !== -1) {
    const base = t.slice(0, colonIdx).trim();
    const rest = t.slice(colonIdx + 2).trim();
    if (GENERIC_SUBSECTION_TITLES.has(normalizeCompareToken(rest))) {
      return normalizeToken(base);
    }
  }

  return null;
}

function hazardFlatGroupingKey(
  subsections: CsepTemplateSubsection[],
  index: number,
  sectionKey: string
): string {
  const sub = subsections[index]!;
  const fromTitle = programBaseKeyFromSubsectionTitle(sub.title, sectionKey);
  if (fromTitle) return fromTitle;

  const t = stripExistingNumberPrefix(sub.title).trim();
  const next = subsections[index + 1];
  if (next) {
    const nk = programBaseKeyFromSubsectionTitle(next.title, sectionKey);
    if (nk && nk === normalizeToken(t)) return nk;
  }
  const prev = subsections[index - 1];
  if (prev) {
    const pk = programBaseKeyFromSubsectionTitle(prev.title, sectionKey);
    if (pk && pk === normalizeToken(t)) return pk;
  }

  return `_row:${index}:${normalizeToken(t)}`;
}

function groupSubsectionsForFlatProgramOutline(
  subsections: CsepTemplateSubsection[],
  sectionKey: string
): CsepTemplateSubsection[][] {
  if (!subsections.length) return [];
  const keys = subsections.map((_, i) => hazardFlatGroupingKey(subsections, i, sectionKey));
  const groups: CsepTemplateSubsection[][] = [];
  for (let i = 0; i < subsections.length; i++) {
    if (i === 0 || keys[i] !== keys[i - 1]) {
      groups.push([subsections[i]!]);
    } else {
      groups[groups.length - 1]!.push(subsections[i]!);
    }
  }
  return groups;
}

/** Exported for unit tests â€” groups hazard/reference subsections that share one outline number. */
export function buildHazardFlatProgramGroupsForTest(
  subsections: CsepTemplateSubsection[],
  sectionKey: string
) {
  return groupSubsectionsForFlatProgramOutline(subsections, sectionKey);
}

function majorProgramTitleForFlatGroup(blocks: CsepTemplateSubsection[]): string {
  if (!blocks.length) return "";
  for (const b of blocks) {
    const t = stripExistingNumberPrefix(b.title).trim();
    const emParts = t.split(EM_DASH_TITLE_SPLIT);
    if (emParts.length >= 2) {
      return emParts[0]!.trim();
    }
    const colonIdx = t.indexOf(": ");
    if (colonIdx !== -1) {
      const rest = t.slice(colonIdx + 2).trim();
      if (GENERIC_SUBSECTION_TITLES.has(normalizeCompareToken(rest))) {
        return t.slice(0, colonIdx).trim();
      }
    }
  }
  return stripExistingNumberPrefix(blocks[0]!.title).trim();
}

function sliceLabelWithinProgramGroup(majorTitle: string, subsection: CsepTemplateSubsection): string | null {
  const raw = stripExistingNumberPrefix(subsection.title).trim();
  const major = stripExistingNumberPrefix(majorTitle).trim();
  if (!raw || normalizeCompareToken(raw) === normalizeCompareToken(major)) {
    return null;
  }

  const emParts = raw.split(EM_DASH_TITLE_SPLIT);
  if (emParts.length >= 2 && normalizeCompareToken(emParts[0]!.trim()) === normalizeCompareToken(major)) {
    return emParts.slice(1).join(" â€” ").trim();
  }

  const colonIdx = raw.indexOf(": ");
  if (colonIdx !== -1) {
    const base = raw.slice(0, colonIdx).trim();
    if (normalizeCompareToken(base) === normalizeCompareToken(major)) {
      return raw.slice(colonIdx + 2).trim();
    }
  }

  return raw;
}

function isNumberedProgramModuleSlice(title: string) {
  const normalized = normalizeCompareToken(canonicalProgramModuleSliceLabel(title));
  return (
    normalized === "required controls" ||
    normalized === "how controls are met and verified" ||
    normalized === "stop work hold point triggers" ||
    normalized === "applicable references"
  );
}

function canonicalProgramModuleSliceLabel(title: string) {
  const normalized = normalizeCompareToken(title);
  if (normalized === "how controls are verified" || normalized === "verification and handoff") {
    return "How controls are met and verified";
  }
  if (
    normalized === "stop work hold point triggers" ||
    normalized === "stop work triggers" ||
    normalized === "stop work escalation"
  ) {
    return "Stop-work / hold-point triggers";
  }
  if (normalized === "references") {
    return "Applicable references";
  }
  if (normalized === "required controls") return "Required controls";
  if (normalized === "risk") return "Risk";
  return title;
}

function appendFlatSubsectionContent(children: Paragraph[], subsection: CsepTemplateSubsection) {
  const paragraphSplit = splitStructuredSourceItems(subsection.paragraphs);
  const itemSplit = splitStructuredSourceItems(subsection.items);
  const structuredEntries = [...paragraphSplit.structured, ...itemSplit.structured];
  const numberedProgramItems = isNumberedProgramModuleSlice(
    stripExistingNumberPrefix(subsection.title).split(EM_DASH_TITLE_SPLIT).pop()?.split(": ").pop() ?? subsection.title
  );

  appendIndentedParagraphs(children, paragraphSplit.plain, { left: INDENTS.childBodyLeft });

  structuredEntries.forEach((entry) => {
    const bodySegments = splitCsepDocxBodyIntoSegments(entry.body);
    const bodyText = bodySegments.join("\n\n").trim();
    const title = entry.title?.trim() ?? "";
    if (title && bodyText) {
      children.push(termDefinitionParagraph(title, bodyText));
    } else if (title) {
      children.push(
        bodyParagraph(title, {
          indent: { left: INDENTS.childBodyLeft },
          spacing: { after: 140, line: 276 },
        })
      );
    } else if (bodyText) {
      children.push(
        bodyParagraph(bodyText, {
          indent: { left: INDENTS.childBodyLeft },
          spacing: { after: 140, line: 276 },
        })
      );
    }
  });

  itemSplit.plain.forEach((item, itemIndex) => {
    children.push(
      bodyParagraph(numberedProgramItems ? `${itemIndex + 1}. ${item}` : item, {
        indent: { left: INDENTS.childBodyLeft },
        spacing: { before: itemIndex === 0 ? 100 : 50, after: 90, line: 276 },
      })
    );
  });

  if (!subsection.table?.rows.length) return;

  if (isFieldValueTable(subsection.table)) {
    appendFieldValueTableParagraphs(children, subsection.table, { indent: { left: INDENTS.childBodyLeft } });
    return;
  }

  appendTableRowsAsOffsetParagraphs(children, subsection.table, {
    renderMode: "numbered",
    nested: true,
  });
}

function renderSectionWithFlatProgramOutline(outlineOrdinal: number, section: CsepTemplateSection) {
  const children: Paragraph[] = [
    sectionHeading(displayOutlineSectionHeading(outlineOrdinal, section), sectionHeadingTone(section)),
  ];
  if (section.descriptor?.trim()) {
    children.push(sectionDescriptorParagraph(section.descriptor.trim()));
  }
  const basePrefix = sectionPrefix(section, outlineOrdinal);
  const groups = groupSubsectionsForFlatProgramOutline(section.subsections, section.key);
  let nextTopLevelNumber = 0;

  for (const group of groups) {
    nextTopLevelNumber += 1;
    const majorTitle = majorProgramTitleForFlatGroup(group);
    const headingText = majorTitle || stripExistingNumberPrefix(group[0]!.title).trim() || "Program";
    const keepFlatNumbering =
      section.key !== "hazard_control_modules" || nextTopLevelNumber <= MAX_HAZARD_TOP_LEVEL_NUMBERED_ITEMS;
    if (keepFlatNumbering) {
      children.push(
        numberedParagraph(`${basePrefix}.${nextTopLevelNumber}`, headingText, {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: nextTopLevelNumber === 1 ? 120 : 260, after: 160, line: 276 },
        })
      );
    } else {
      children.push(
        bodyParagraph(headingText, {
          style: STYLE_IDS.subheading,
          indent: { left: INDENTS.childBodyLeft },
          spacing: { before: 220, after: 100, line: 276 },
        })
      );
    }

    for (const subsection of group) {
      const slice = sliceLabelWithinProgramGroup(headingText, subsection);
      if (slice) {
        const label = canonicalProgramModuleSliceLabel(slice);
        children.push(
          bodyParagraph(`${label}:`, {
            style: STYLE_IDS.subheading,
            indent: { left: INDENTS.childBodyLeft },
            spacing: { before: 200, after: 90, line: 276 },
          })
        );
      }
      appendFlatSubsectionContent(children, subsection);
    }
  }

  return children;
}

function renderProgramModuleTemplateSection(outlineOrdinal: number, section: CsepTemplateSection) {
  const children: Paragraph[] = [
    sectionHeading(displayOutlineSectionHeading(outlineOrdinal, section), sectionHeadingTone(section)),
  ];
  if (section.descriptor?.trim()) {
    children.push(sectionDescriptorParagraph(section.descriptor.trim()));
  }

  section.subsections.forEach((subsection) => {
    const label = stripExistingNumberPrefix(subsection.title).trim();
    if (!label) return;
    children.push(
      bodyParagraph(`${label}:`, {
        style: STYLE_IDS.subheading,
        spacing: { before: 180, after: 90, line: 276 },
      })
    );

    if (normalizeCompareToken(label) === "risk") {
      appendParagraphs(children, subsection.paragraphs);
      return;
    }

    const items = uniqueItems([...(subsection.items ?? []), ...(subsection.paragraphs ?? [])]);
    items.forEach((item, index) => {
      children.push(
        bodyParagraph(`${index + 1}. ${stripSourceNumberingLabel(item)}`, {
          indent: { left: INDENTS.childBodyLeft },
          spacing: { before: index === 0 ? 80 : 40, after: 90, line: 276 },
        })
      );
    });
  });

  return children;
}

function appendParagraphs(children: Paragraph[], paragraphs?: string[]) {
  (paragraphs ?? []).forEach((paragraph) => {
    children.push(
      bodyParagraph(stripSourceNumberingLabel(paragraph), {
        spacing: { after: 140, line: 276 },
      })
    );
  });
}

function appendIndentedParagraphs(
  children: Paragraph[],
  paragraphs: string[] | undefined,
  indent: { left?: number; hanging?: number }
) {
  (paragraphs ?? []).forEach((paragraph) => {
    children.push(
      bodyParagraph(stripSourceNumberingLabel(paragraph), {
        indent,
        spacing: { after: 150, line: 276 },
      })
    );
  });
}

function splitStructuredSourceItems(values?: string[]) {
  const structured: ParsedSourceNumberedItem[] = [];
  const plain: string[] = [];

  (values ?? []).forEach((value) => {
    const parsed = parseSourceNumberedItem(value);
    if (parsed) {
      structured.push(parsed);
      return;
    }

    const stripped = stripSourceNumberingLabel(value);
    if (stripped) {
      plain.push(stripped);
    }
  });

  return { structured, plain };
}

function pageBreakParagraph() {
  return new Paragraph({ children: [new PageBreak()] });
}

function createContents(model: CsepRenderModel) {
  const plan = buildCsepOutlinePlan(model);
  const tableOfContentsSection = model.frontMatterSections.find((section) => section.key === "table_of_contents");
  const tocEntry = plan.find(
    (e): e is Extract<CsepOutlinePlanEntry, { kind: "body_section" }> =>
      e.kind === "body_section" && e.section.key === "table_of_contents"
  );
  const tocHeading =
    tableOfContentsSection && tocEntry
      ? displayOutlineSectionHeading(tocEntry.ordinal, tableOfContentsSection)
      : "Table of Contents";
  const entries = plan
    .filter((entry) => !(entry.kind === "body_section" && entry.section.key === "table_of_contents"))
    .map((entry) => formatOutlineTocLine(entry));

  return [
    sectionHeading(tocHeading),
    ...(tableOfContentsSection?.descriptor?.trim()
      ? [sectionDescriptorParagraph(tableOfContentsSection.descriptor.trim())]
      : []),
    ...entries.map((entry) =>
      bodyParagraph(entry, {
        style: STYLE_IDS.contentsEntry,
      })
    ),
  ];
}

function createAttachmentsDivider(ordinal: number) {
  return [
    sectionHeading(`${ordinal}. Attachments`),
    sectionDescriptorParagraph(
      "Forms, checklists, and supporting inserts issued with this CSEP package."
    ),
  ];
}

function createAppendicesDivider(ordinal: number) {
  return [
    sectionHeading(`${ordinal}. Appendices`),
    sectionDescriptorParagraph(
      "Matrices, program reference packs, and library material referenced from the body of this plan."
    ),
  ];
}

function renderSection(outlineOrdinal: number, section: CsepTemplateSection) {
  if (section.key.startsWith("program_")) {
    return renderProgramModuleTemplateSection(outlineOrdinal, section);
  }

  if (usesFlatProgramOutline(section)) {
    return renderSectionWithFlatProgramOutline(outlineOrdinal, section);
  }

  const children: Paragraph[] = [
    sectionHeading(displayOutlineSectionHeading(outlineOrdinal, section), sectionHeadingTone(section)),
  ];
  if (section.descriptor?.trim()) {
    children.push(sectionDescriptorParagraph(section.descriptor.trim()));
  }
  const basePrefix = sectionPrefix(section, outlineOrdinal);
  // Single monotonically-increasing top-level counter so subheadings, items,
  // structured entries, and table rows never share the same X.Y label.
  let nextTopLevelNumber = 0;

  section.subsections.forEach((subsection) => {
    const distinctSubheading = shouldRenderSubheading(section.title, subsection);
    const renderMode =
      section.key === "definitions_and_abbreviations" ? "definitions" : "numbered";
    const paragraphSplit = splitStructuredSourceItems(subsection.paragraphs);
    const itemSplit = splitStructuredSourceItems(subsection.items);

    let subsectionLabel = basePrefix;
    let itemPrefixBase = basePrefix;

    if (distinctSubheading) {
      nextTopLevelNumber += 1;
      subsectionLabel = `${basePrefix}.${nextTopLevelNumber}`;
      itemPrefixBase = subsectionLabel;
      children.push(
        numberedParagraph(subsectionLabel, stripExistingNumberPrefix(subsection.title), {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: 240, after: 160, line: 276 },
        })
      );
    }

    if (distinctSubheading) {
      appendIndentedParagraphs(children, paragraphSplit.plain, { left: INDENTS.childBodyLeft });
    } else {
      appendParagraphs(children, paragraphSplit.plain);
    }

    const structuredEntries = [...paragraphSplit.structured, ...itemSplit.structured];

    structuredEntries.forEach((entry, entryIndex) => {
      const bodySegments = splitCsepDocxBodyIntoSegments(entry.body);

      if (distinctSubheading) {
        const childNumber = `${itemPrefixBase}.${entryIndex + 1}`;
        children.push(
          numberedParagraph(childNumber, entry.title, {
            indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
            spacing: { before: 180, after: 90, line: 276 },
          })
        );
        bodySegments.forEach((segment, segmentIndex) => {
          const isLast = segmentIndex === bodySegments.length - 1;
          children.push(
            bodyParagraph(segment, {
              indent: { left: INDENTS.grandchildBodyLeft },
              spacing: { after: isLast ? 260 : 120, line: 276 },
            })
          );
        });
        return;
      }

      nextTopLevelNumber += 1;
      children.push(
        numberedParagraph(`${basePrefix}.${nextTopLevelNumber}`, entry.title, {
          indent: { left: INDENTS.childLeft, hanging: INDENTS.childHanging },
          spacing: { before: 180, after: 100, line: 276 },
        })
      );
      bodySegments.forEach((segment, segmentIndex) => {
        const isLast = segmentIndex === bodySegments.length - 1;
        children.push(
          bodyParagraph(segment, {
            indent: { left: INDENTS.childBodyLeft },
            spacing: { after: isLast ? 260 : 120, line: 276 },
          })
        );
      });
    });

    itemSplit.plain.forEach((item, itemIndex) => {
      if (subsection.plainItemsStyle === "offset_lines") {
        children.push(
          bodyParagraph(item, {
            indent: { left: INDENTS.childBodyLeft },
            spacing: { before: itemIndex === 0 ? 120 : 50, after: 90, line: 276 },
          })
        );
        return;
      }
      if (distinctSubheading) {
        children.push(
          numberedParagraph(`${itemPrefixBase}.${structuredEntries.length + itemIndex + 1}`, item, {
            indent: { left: INDENTS.grandchildLeft, hanging: INDENTS.grandchildHanging },
            spacing: { before: 50, after: 110, line: 276 },
          })
        );
      } else {
        nextTopLevelNumber += 1;
        children.push(
          numberedParagraph(`${basePrefix}.${nextTopLevelNumber}`, item, {
            spacing: { before: 70, after: 130, line: 276 },
          })
        );
      }
    });

    if (subsection.table?.rows.length) {
      if (isFieldValueTable(subsection.table)) {
        appendFieldValueTableParagraphs(
          children,
          subsection.table,
          distinctSubheading ? { indent: { left: INDENTS.childBodyLeft } } : undefined
        );
        return;
      }

      if (subsection.tableRowsStyle === "offset_lines") {
        if (distinctSubheading) {
          appendTableRowsAsOffsetParagraphs(children, subsection.table, {
            renderMode,
            nested: true,
          });
        } else {
          appendTopLevelTableRowsAsOffset(children, subsection.table, { renderMode });
        }
        return;
      }

      if (distinctSubheading) {
        const numberedPlainItemCount =
          subsection.plainItemsStyle === "offset_lines" ? 0 : itemSplit.plain.length;
        appendTableRowsAsNumberedParagraphs(
          children,
          subsection.table,
          itemPrefixBase,
          structuredEntries.length + numberedPlainItemCount,
          { renderMode }
        );
      } else {
        nextTopLevelNumber = appendTopLevelTableRows(
          children,
          subsection.table,
          basePrefix,
          nextTopLevelNumber,
          { renderMode }
        );
      }
    }
  });

  return children;
}

export async function createCsepDocument(model: CsepRenderModel) {
  const children: Paragraph[] = [];
  const plan = buildCsepOutlinePlan(model);

  children.push(...createCover(model));

  const frontMatterKeys = new Set(model.frontMatterSections.map((section) => section.key));

  model.frontMatterSections.forEach((section, index) => {
    if (section.key === "table_of_contents") {
      children.push(pageBreakParagraph());
      children.push(...createContents(model));
      children.push(pageBreakParagraph());
      return;
    }
    if (section.key === "owner_message") {
      children.push(pageBreakParagraph());
    } else if (section.key === "sign_off_page") {
      children.push(pageBreakParagraph());
    } else {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
    children.push(...renderSection(outlineOrdinalForSectionKey(plan, section.key), section));
    if (section.key === "sign_off_page") {
      children.push(new Paragraph({ children: [] }));
      children.push(...approvalSignatureAsParagraphs(model.approvalLines));
    }
  });

  if (model.frontMatterSections.length && !frontMatterKeys.has("table_of_contents")) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    children.push(...createContents(model));
  }

  model.sections.forEach((section, index) => {
    if (index === 0) {
      children.push(pageBreakParagraph());
    } else {
      children.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [] }));
    }
    children.push(...renderSection(outlineOrdinalForSectionKey(plan, section.key), section));
  });

  model.appendixSections.forEach((section) => {
    children.push(pageBreakParagraph());
    children.push(...renderSection(outlineOrdinalForSectionKey(plan, section.key), section));
  });

  children.push(pageBreakParagraph());
  children.push(sectionHeading(formatOutlineTocLine(plan.find((e) => e.kind === "disclaimer")!)));
  model.disclaimerLines.forEach((line) => {
    children.push(bodyParagraph(line));
  });

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
          paragraph: {
            spacing: {
              after: 120,
              line: 276,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: STYLE_IDS.body,
          name: STYLE_IDS.body,
          paragraph: {
            spacing: {
              after: 120,
              line: 276,
            },
          },
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
        },
        {
          id: STYLE_IDS.coverTitle,
          name: STYLE_IDS.coverTitle,
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 720,
              after: 140,
            },
          },
          run: {
            font: "Calibri Light",
            bold: true,
            size: 32,
            color: COLORS.titleBlue,
          },
        },
        {
          id: STYLE_IDS.coverSubtitle,
          name: STYLE_IDS.coverSubtitle,
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 120,
            },
          },
          run: {
            font: "Calibri",
            italics: true,
            size: 21,
            color: COLORS.gray,
          },
        },
        {
          id: STYLE_IDS.coverMeta,
          name: STYLE_IDS.coverMeta,
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 80,
            },
          },
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
        },
        {
          id: STYLE_IDS.sectionHeading,
          name: STYLE_IDS.sectionHeading,
          paragraph: {
            spacing: {
              before: 200,
              after: 112,
            },
          },
          run: {
            font: "Calibri",
            bold: true,
            size: 28,
            color: COLORS.titleBlue,
          },
        },
        {
          id: STYLE_IDS.sectionDescriptor,
          name: STYLE_IDS.sectionDescriptor,
          paragraph: {
            spacing: {
              before: 36,
              after: 140,
            },
          },
          run: {
            font: "Calibri",
            italics: true,
            size: 20,
            color: COLORS.gray,
          },
        },
        {
          id: STYLE_IDS.subheading,
          name: STYLE_IDS.subheading,
          paragraph: {
            spacing: {
              before: 160,
              after: 80,
            },
          },
          run: {
            font: "Calibri",
            bold: true,
            size: 24,
            color: COLORS.headingBlue,
          },
        },
        {
          id: STYLE_IDS.contentsEntry,
          name: STYLE_IDS.contentsEntry,
          paragraph: {
            spacing: {
              after: 90,
            },
          },
          run: {
            font: "Calibri",
            size: 21,
            color: COLORS.ink,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1080,
              left: 1440,
              header: 720,
              footer: 720,
              gutter: 0,
            },
            pageNumbers: {
              start: 1,
            },
          },
        },
        footers: {
          default: createRunningFooter(model.footerCompanyName, model.contractorName),
        },
        children,
      },
    ],
  });
}

export async function renderCsepRenderModel(
  model: CsepRenderModel,
  options?: { draft?: GeneratedSafetyPlanDraft | null }
) {
  const normalizedModel = normalizeRenderModel(model);
  assertCsepExportQuality(normalizedModel, { draft: options?.draft ?? undefined });
  validateCsepRenderModel(normalizedModel);
  const doc = await createCsepDocument(normalizedModel);
  const buffer = await Packer.toBuffer(doc);

  return {
    body: new Uint8Array(buffer),
    filename: getSafetyBlueprintDraftFilename(normalizedModel.filenameProjectPart, "csep").replace(
      "_Draft",
      ""
    ),
  };
}

export async function renderGeneratedCsepDocx(
  draft: GeneratedSafetyPlanDraft,
  options?: { footerCompanyName?: string | null }
) {
  return renderCsepRenderModel(buildCsepRenderModelFromGeneratedDraft(draft, options), { draft });
}
```

## lib\csepDocxTheme.ts

```ts
import {
  AlignmentType,
  Document,
  Footer,
  PageBreak,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";
import { polishCsepDocxNarrativeText } from "@/lib/csepDocxNarrativePolish";
import { CONTRACTOR_SAFETY_BLUEPRINT_TITLE } from "@/lib/safetyBlueprintLabels";

type DocChild = Paragraph;

type CoverOptions = {
  projectName: string;
  subtitle?: string | null;
  contractorName?: string | null;
};

export const CSEP_STYLE_IDS = {
  body: "BodyTextCustom",
  sectionTitle: "SectionTitle",
  subhead: "SubheadCustom",
} as const;

const COLORS = {
  titleBlue: "17365D",
  accentBlue: "1F4E78",
  lightBorder: "D9E1F2",
  lightFill: "EEF4FA",
  footerGray: "666666",
  mutedText: "5B6B7A",
  bodyText: "1F1F1F",
  subheadText: "404040",
};

function sectionParagraph(options: IParagraphOptions) {
  return new Paragraph({
    style: CSEP_STYLE_IDS.sectionTitle,
    ...options,
  });
}

export function createCsepBody(
  text: string,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
) {
  return new Paragraph({
    style: CSEP_STYLE_IDS.body,
    alignment,
    children: [
      new TextRun({
        text: polishCsepDocxNarrativeText(text),
        font: "Aptos",
        size: 21,
        color: COLORS.bodyText,
      }),
    ],
  });
}

export function createCsepSectionHeading(text: string) {
  return sectionParagraph({
    children: [
      new TextRun({
        text,
        font: "Aptos Display",
        bold: true,
        color: COLORS.accentBlue,
        size: 30,
      }),
    ],
    spacing: { before: 180, after: 100 },
  });
}

export function createCsepSubheading(text: string) {
  return new Paragraph({
    style: CSEP_STYLE_IDS.subhead,
    children: [
      new TextRun({
        text,
        font: "Aptos",
        bold: true,
        color: COLORS.subheadText,
        size: 22,
      }),
    ],
  });
}

export function createCsepPageBreak() {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

export function createCsepLabeledParagraph(
  label: string,
  value: string,
  options: {
    prefix?: string;
    indentLeft?: number;
    spacingAfter?: number;
  } = {}
) {
  const trimmed = value?.trim() ? value.trim() : "N/A";
  const lines = trimmed.split("\n");
  const valueRuns: TextRun[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      valueRuns.push(new TextRun({ break: 1 }));
    }
    valueRuns.push(
      new TextRun({
        text: polishCsepDocxNarrativeText(line),
        font: "Aptos",
        size: 21,
        color: COLORS.bodyText,
      })
    );
  });

  return new Paragraph({
    style: CSEP_STYLE_IDS.body,
    indent: options.indentLeft ? { left: options.indentLeft } : undefined,
    spacing: { after: options.spacingAfter ?? 100 },
    children: [
      ...(options.prefix ? [new TextRun({ text: `${options.prefix} ` })] : []),
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: "Aptos",
        size: 21,
        color: COLORS.subheadText,
      }),
      ...valueRuns,
    ],
  });
}

export function createCsepCover(options: CoverOptions): Paragraph[] {
  const subtitle = options.subtitle?.trim();
  const contractorName = options.contractorName?.trim();

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "SafetyDocs360",
          font: "Aptos Display",
          bold: true,
          color: COLORS.accentBlue,
          size: 40,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "PROJECT / SITE SPECIFIC",
          font: "Aptos",
          bold: true,
          color: COLORS.mutedText,
          size: 21,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: CONTRACTOR_SAFETY_BLUEPRINT_TITLE.toUpperCase(),
          font: "Aptos Display",
          bold: true,
          color: COLORS.titleBlue,
          size: 44,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: options.projectName,
          font: "Aptos",
          bold: true,
          color: COLORS.subheadText,
          size: 26,
        }),
      ],
    }),
  ];

  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: subtitle,
            font: "Aptos",
            size: 21,
            color: COLORS.bodyText,
          }),
        ],
      })
    );
  }

  if (contractorName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Contractor: ${contractorName}`,
            font: "Aptos",
            size: 21,
            color: COLORS.bodyText,
          }),
        ],
      })
    );
  }

  return children;
}

export function createCsepInfoTable(
  rows: Array<[string, string, string, string]>
) {
  return rows.flatMap(([labelOne, valueOne, labelTwo, valueTwo]) => [
    createCsepLabeledParagraph(labelOne, valueOne),
    createCsepLabeledParagraph(labelTwo, valueTwo),
  ]);
}

export function createCsepDocument(children: DocChild[]) {
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Aptos",
            size: 22,
            color: COLORS.bodyText,
          },
          paragraph: {
            spacing: {
              after: 200,
              line: 276,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: CSEP_STYLE_IDS.body,
          name: CSEP_STYLE_IDS.body,
          paragraph: {
            spacing: {
              after: 100,
              line: 269,
            },
          },
          run: {
            font: "Aptos",
            size: 21,
          },
        },
        {
          id: CSEP_STYLE_IDS.sectionTitle,
          name: CSEP_STYLE_IDS.sectionTitle,
          paragraph: {
            spacing: {
              after: 100,
            },
          },
          run: {
            font: "Aptos Display",
            bold: true,
            color: COLORS.accentBlue,
            size: 30,
          },
        },
        {
          id: CSEP_STYLE_IDS.subhead,
          name: CSEP_STYLE_IDS.subhead,
          paragraph: {
            spacing: {
              after: 100,
            },
          },
          run: {
            font: "Aptos",
            bold: true,
            color: COLORS.subheadText,
            size: 22,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1008,
              right: 1152,
              bottom: 864,
              left: 1152,
              header: 720,
              footer: 720,
              gutter: 0,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                style: CSEP_STYLE_IDS.body,
                children: [
                  new TextRun({
                    text: `SafetyDocs360 | ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} | Submission-ready CSEP`,
                    font: "Aptos",
                    size: 17,
                    color: COLORS.footerGray,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

export function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

export function valueOrNA(value?: string | null) {
  return value?.trim() ? value.trim() : "N/A";
}
```

## lib\csepFinalization.ts

```ts
import type { GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

const CONTROLLED_TBD = "TBD by contractor before issue";

const INTERNAL_PHRASE_PATTERNS = [
  /keep this section concise, customer-facing[^.]*\.?/gi,
  /use the front matter to orient field teams quickly[^.]*\.?/gi,
  /project-specific content will be completed with ai drafting and builder inputs where the platform has supporting data\.?/gi,
  /project-specific content will be completed during final contractor review\.?/gi,
  /builder lines beginning with[^.]*environmental control[^.]*\.?/gi,
  /this section was seeded from the platform generator[^.]*\.?/gi,
  /seed(?:ed|ing)? (?:content|text|notes?|fields?|data) from the platform generator[^.]*\.?/gi,
  /generated by the platform generator[^.]*\.?/gi,
  /platform generator note:\s*/gi,
  /\bAI[-\s]?generated\b/gi,
  /\bautomation (?:pipeline|rules?|engine)\b/gi,
  /\bfallback (?:copy|text|narrative|content)\b/gi,
  /\bseeded (?:from|content|text)\b/gi,
  /ai final decision:\s*/gi,
  /platform-defined rule text/gi,
  /matched hazard modules attached[^.]*\.?/gi,
  /matched steel-erection hazard modules attached[^.]*\.?/gi,
  /raw reference notes?:?[^.]*\.?/gi,
  /document type:\s*[^|.\n]+(?:\s*\|\s*prepared:\s*[^|.\n]+)?(?:\s*\|\s*target length:\s*[^.\n]+)?\.?/gi,
  /\b(?:hazard|task) element\b/gi,
  /reference (?:steel-erection )?(?:task|hazard|program) modules? supporting the active scope\.?/gi,
  /reference (?:task|hazard) modules? supporting the selected (?:scope|hazards and permits)\.?/gi,
];

const EXPORT_TEXT_REMOVALS = [
  /Use this module to align sequence, access, and handoffs with that work\.?/gi,
  /selected program hazard\s*\/\s*/gi,
  /\((?:R\d+(?:,\s*)?)+\)/gi,
  /Related considerations include[^.]*\d+\.\d+[^.]*\.?/gi,
  /^\d+\.\d+\s+(?:Purpose|Main hazards?)[^.]*\.?/gi,
  /This program establishes controls[^.]*\.?/gi,
  /^\s*Field:\s*.+?\s+Value:\s*.+$/gim,
  /Project\s+.+?\s+is the active contractor planning record for this scope\.?/gi,
  /.+?\s+is the submitting contractor for this CSEP\.?/gi,
  /N\/A\s*\|\s*Contractor Logo\s*\/\s*Letterhead/gi,
  /\btest at test\b/gi,
  /Primary coordination contact:\s*test(?:,\s*test)+\.?/gi,
  /continuous improvement not only enhances safety outcomes[^.]*\.?/gi,
  /^\d+\.\d+\.\d+\s+required training\b[^.]*\.?/gim,
  /Required controls include Hole-cover trigger\.?/gi,
  /The following permit requirements were selected or derived[^.]*\.?/gi,
  /The following OSHA references? (?:were|was) (?:identified|selected)[^.]*\.?/gi,
  /The following hazards? (?:were|was) (?:selected|identified|derived)[^.]*\.?/gi,
  /The following overlapping trades? or affected scopes?[^.]*\.?/gi,
  /The following PPE (?:was|were) (?:selected|identified|derived)[^.]*\.?/gi,
  /The following controls? (?:were|was) (?:selected|identified|derived)[^.]*\.?/gi,
  /The following related tasks? (?:were|was) (?:selected|identified|derived)[^.]*\.?/gi,
  /The following (?:program|module|reference) (?:were|was) (?:selected|identified|derived)[^.]*\.?/gi,
  /[^.]*\bis the work site covered by this CSEP\.?/gi,
  /[^.]*\bis responsible for performing the work covered by this CSEP[^.]*\.?/gi,
  /This section identifies the project,\s*location,\s*and governing-site information used for field coordination\.?/gi,
  // Remove only the capitalized placeholder name "Test" as a contractor /
  // subject placeholder (typical of dev seed data), not the lowercase noun
  // "test" which may legitimately appear in user-supplied content.
  /(?:^|\.\s+|\n)\s*Test\s+is\s+responsible for[^.]*\.?/g,
];

const EXPORT_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^Minimum Requirements?:\s*/gim, ""],
  [/^Minimum Cadence:\s*/gim, "Requirement: "],
  [/^Minimum Frequency:\s*/gim, "Requirement: "],
  [/\bMinimum Cadence\b/gi, "Requirement"],
  [/\bMinimum Frequency\b/gi, "Requirement"],
  [/^Trigger \/ reference:\s*/gi, ""],
  [/^Applicability \/ trigger logic:\s*Apply this module whenever\s*/gi, "This section applies when "],
  [/^Applicability \/ trigger logic:\s*Apply this program before\s*/gi, "This section applies before "],
  [/^Applicability \/ trigger logic:\s*/gi, "This section applies when "],
  [
    /Included for this scope based on/gi,
    "This section is included because the selected work involves",
  ],
  [/Review these sections first:/gi, "Related considerations include"],
  [/Interfaces to coordinate:/gi, "Coordinate with"],
  [/\bPrimary exposure\b/gi, "Primary hazard"],
  [/\bSecondary exposure\b/gi, "Additional hazard"],
  [/\bChanging condition risk\b/gi, "Changing site conditions"],
  [/\bTask Scope\s*&\s*Work Conditions\b/gi, "Task scope and work conditions"],
  [/\bTask purpose\b/gi, "Purpose"],
  [/\bMain exposure profile\b/gi, "Main hazards"],
  [/\bProgram Purpose and Applicability\b/gi, "Purpose"],
  [/\bRoles and Responsibilities\b/gi, "Responsibilities"],
  [/\bCross-read\b/gi, "See"],
  [/\bline-listed\b/gi, "listed"],
  [/\bthe generated plan\b/gi, "this plan"],
  [/\bgenerated plan\b/gi, "plan"],
  [/\bContractor narrative \(from builder\):\s*/gi, "Contractor scope narrative: "],
  [/\bProject-specific health notes \(from builder\):\s*/gi, "Project-specific health notes: "],
  [/\bBuilder or project-specific requirements:\s*/gi, "Project-specific requirements: "],
  [/\bas the site names them\b/gi, "as listed on the project permit register"],
  [
    /The format package identified content that should stay visible in this section based on the current builder inputs\.?/gi,
    "Confirm subsection coverage against the information entered for this CSEP before issue.",
  ],
  [
    /(?:Project identification|Contractor contact) details were not fully provided in the current builder payload\.?/gi,
    "Complete project identification and contractor contact information before issue.",
  ],
  [
    /Scope summary details were not entered in the current builder payload\.?/gi,
    "Add the contractor scope narrative for this trade package in Section 3 before issue.",
  ],
  [
    /Emergency procedures were not entered in the current builder payload\.?/gi,
    "Complete emergency response procedures in Section 10 before issue.",
  ],
];

const INVALID_EXACT_TOKENS = new Set([
  "test",
  "pending approval",
  "null",
  "undefined",
  "[platform fill field]",
  "[fill]",
  "platform generator",
  "safetydocs360 ai draft builder",
  "safetydocs360 draft builder",
]);

const PERMIT_DEFINITIONS = [
  { id: "hot_work_permit", label: "Hot Work Permit", aliases: ["hot work", "hot work permit"] },
  {
    id: "elevated_work_notice",
    label: "Elevated Work Notice",
    aliases: ["elevated work notice", "ladder permit", "ladder permits", "elevated work", "work at height notice"],
  },
  {
    id: "lift_plan",
    label: "Lift Plan",
    aliases: ["lift plan", "critical lift plan", "crane lift plan"],
  },
  {
    id: "pick_plan",
    label: "Pick Plan",
    aliases: ["pick plan", "crane pick plan", "steel pick plan"],
  },
  {
    id: "crane_permit",
    label: "Crane Permit",
    aliases: ["crane permit", "crane use permit", "crane operation permit", "crane setup permit"],
  },
  {
    id: "awp_mewp_permit",
    label: "AWP/MEWP Permit",
    aliases: [
      "awp permit",
      "mewp permit",
      "awp mewp permit",
      "awp/mewp permit",
      "aerial lift permit",
      "aerial work platform permit",
    ],
  },
  {
    id: "gravity_permit",
    label: "Gravity Permit",
    aliases: ["gravity permit", "overhead work permit", "overhead hazard permit", "drop zone permit"],
  },
  {
    id: "motion_permit",
    label: "Motion Permit",
    aliases: ["motion permit", "equipment motion permit", "traffic control permit"],
  },
  {
    id: "energized_electrical_permit",
    label: "Energized Electrical Permit",
    aliases: ["energized electrical permit", "electrical permit", "energized work permit"],
  },
  {
    id: "excavation_permit",
    label: "Ground Disturbance Permit",
    aliases: ["excavation permit", "ground disturbance permit", "groundbreaking/excavation"],
  },
  {
    id: "confined_space_permit",
    label: "Confined Space Permit",
    aliases: ["confined space permit", "confined space entry permit"],
  },
] as const;

const HAZARD_ALIASES: Record<string, string> = {
  "fall": "Fall Exposure",
  "falls": "Fall Exposure",
  "falls from height": "Fall Exposure",
  "fall exposure": "Fall Exposure",
  "fire": "Fire",
  "hot work": "Hot Work",
  "struck by": "Struck-By",
  "struck by equipment": "Struck-By",
  "line of fire": "Line of Fire",
  "falling object hazards": "Falling Objects",
  "falling objects": "Falling Objects",
  "rigging and lifting hazards": "Rigging and Lifting Hazards",
  "crane lift hazards": "Crane Lift Hazards",
};

const PPE_ALIASES: Record<string, string> = {
  "hard hat": "Hard Hat",
  "safety glasses": "Safety glasses",
  "safety glass": "Safety glasses",
  "eye protection": "Safety glasses",
  "gloves": "Gloves",
  "high visibility vest": "High-visibility vest or shirt",
  "high visibility vests": "High-visibility vest or shirt",
  "hi vis vest": "High-visibility vest or shirt",
  "high visibility vest or shirt": "High-visibility vest or shirt",
  "steel toe boots": "Safety-toe boots",
  "steel-toe boots": "Safety-toe boots",
  "safety toe boots": "Safety-toe boots",
  "protective footwear": "Safety-toe boots",
  "work boots": "Safety-toe boots",
  "fall protection harness": "Fall protection harness",
  "harness": "Fall protection harness",
  "hearing protection": "Hearing protection",
  "fall protection": "Fall protection",
  "welding hood": "Welding hood",
  "welding gloves": "Welding gloves",
  "face shield": "Face shield",
  "respiratory protection": "Respiratory protection",
  "respirator": "Respiratory protection",
  "cut resistant gloves": "Cut-resistant gloves",
  "cut-resistant gloves": "Cut-resistant gloves",
  "fr clothing": "FR clothing",
  "chemical resistant gloves": "Chemical-resistant gloves",
  "chemical-resistant gloves": "Chemical-resistant gloves",
  "srl": "Lanyard / SRL",
  "self retracting lifeline": "Lanyard / SRL",
  "self-retracting lifeline": "Lanyard / SRL",
  "lanyard": "Lanyard / SRL",
  "awp fall protection": "AWP / MEWP fall protection",
  "mewp fall protection": "AWP / MEWP fall protection",
};

const INTERFACE_TRADE_TOKENS = [
  "fire protection",
  "hvac",
  "mechanical",
  "painting",
  "coatings",
  "electrical rough-in",
  "plumbing",
  "sprinkler",
];

const RAW_SOURCE_TOKEN_ALIASES: Record<string, string> = {
  fire_watch: "fire watch",
  spark_containment: "spark containment",
  sparks_contained: "spark containment",
  flammable_clearance: "flammable-material clearance",
  signal_person: "designated signal person",
  drop_zone_control: "drop-zone control",
  lift_plan_review: "lift plan review",
};

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collapseRepeatedPhrases(value: string) {
  return value
    .replace(/\b([a-z]+)\s+\1\b/gi, "$1")
    .replace(/\b((?:[a-z]+(?:\s+[a-z]+){1,4}))\s+\1\b/gi, "$1");
}

function stripInlineReferenceTags(value: string) {
  return value.replace(/\s*\((?:R\d+(?:,\s*)?)+\)\s*/gi, " ");
}

function humanizeRawSourceToken(value: string) {
  const trimmed = value.trim();
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(trimmed)) {
    return trimmed;
  }

  return RAW_SOURCE_TOKEN_ALIASES[trimmed] ?? trimmed.replace(/_/g, " ");
}

function normalizeRawSourceTokens(value: string) {
  return value.replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g, (token) => humanizeRawSourceToken(token));
}

export function cleanFinalText(value: string | null | undefined, options?: { allowTbd?: boolean }) {
  if (!value?.trim()) return null;

  let cleaned = value.trim();
  for (const pattern of INTERNAL_PHRASE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned
    .replace(/\[(platform fill field|fill)\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return options?.allowTbd ? CONTROLLED_TBD : null;

  if (INVALID_EXACT_TOKENS.has(cleaned.toLowerCase())) {
    return options?.allowTbd ? CONTROLLED_TBD : null;
  }

  if (cleaned.toLowerCase() === CONTROLLED_TBD.toLowerCase()) {
    return options?.allowTbd ? CONTROLLED_TBD : null;
  }

  return cleaned;
}

export function normalizeFinalExportText(
  value: string | null | undefined,
  options?: { allowTbd?: boolean }
) {
  const cleaned = cleanFinalText(value, options);
  if (!cleaned) return cleaned;

  if (
    /^(?:Trade\s*\/\s*Subtrade|Activity|Hazards?|Controls?|PPE|Permits?|Competency)\s*:/i.test(
      cleaned
    )
  ) {
    return null;
  }

  let normalized = cleaned;
  for (const pattern of EXPORT_TEXT_REMOVALS) {
    normalized = normalized.replace(pattern, " ");
  }

  normalized = stripInlineReferenceTags(normalized);
  normalized = normalizeRawSourceTokens(normalized);

  for (const [pattern, replacement] of EXPORT_TEXT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/^\s*\d+\.\d+\s+(?:Purpose|Main hazards?).*$/i, " ")
    .replace(/\bworkers should understand workers should understand\b/gi, "workers should understand")
    .replace(/\bworkers shall be trained on workers shall be trained on\b/gi, "workers shall be trained on")
    .replace(/\bcontinuous improvement\b.*?\bcontinuous improvement\b/gi, "continuous improvement")
    .replace(/\brecordkeeping\b.*?\brecordkeeping\b/gi, "recordkeeping")
    .replace(/\btraining\b.*?\btraining\b/gi, "training")
    .replace(/\s*\((?:\s*,?\s*)*\)\s*/g, " ")
    .replace(/\s+-\s*$/g, "")
    .replace(/:\s*$/g, "")
    .replace(/;\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  normalized = collapseRepeatedPhrases(normalized);

  return normalized || (options?.allowTbd ? CONTROLLED_TBD : null);
}

export function isMeaningfulFinalText(value: string | null | undefined) {
  const cleaned = cleanFinalText(value);
  return Boolean(cleaned && cleaned !== CONTROLLED_TBD);
}

function normalizeDisplayList(
  values: Array<string | null | undefined>,
  aliasMap: Record<string, string>
) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const normalized = normalizeToken(cleaned);
    const display = aliasMap[normalized] ?? cleaned;
    const key = normalizeToken(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }

  return out;
}

export function normalizeHazardList(values: Array<string | null | undefined>) {
  return normalizeDisplayList(values, HAZARD_ALIASES);
}

export function normalizePpeList(values: Array<string | null | undefined>) {
  return normalizeDisplayList(values, PPE_ALIASES);
}

/** Fixed baseline PPE; task- or exposure-specific items are listed in the add-on line. */
export const CSEP_BASELINE_PPE_DISPLAY: readonly string[] = [
  "Hard Hat",
  "Safety glasses",
  "High-visibility vest or shirt",
  "Gloves",
  "Safety-toe boots",
] as const;

const BASELINE_PPE_NORMALIZED = new Set(
  CSEP_BASELINE_PPE_DISPLAY.map((label) => normalizeToken(label))
);

function isBaselinePpeDisplay(display: string): boolean {
  const t = normalizeToken(display);
  if (!BASELINE_PPE_NORMALIZED.has(t)) return false;
  if (t === "gloves" && /\b(cut|welding|chemical|heat|nitrile|latex|electrical|arc|insulated)\b/i.test(display)) {
    return false;
  }
  return true;
}

/**
 * Normalizes and deduplicates PPE labels for export (e.g. "Steel-Toe Boots" vs "safety-toe boots").
 * Drops generic "Fall protection" when a specific harness / lanyard / SRL-type item is present.
 */
export function dedupePpeItemsForExport(values: Array<string | null | undefined>): string[] {
  const list = normalizePpeList(values);
  const hasHarnessLike = list.some((item) => normalizeToken(item) === "fall protection harness");
  const hasSpecificFall = list.some((item) =>
    /\b(harness|lanyard|\bsrl\b|self[-\s]?retracting|personal fall arrest|lifeline|retractable lifeline)\b/i.test(
      item
    )
  );

  return list.filter((item) => {
    const t = normalizeToken(item);
    if (t === "fall protection" && (hasHarnessLike || hasSpecificFall)) return false;
    return true;
  });
}

const FALL_ADDON_WHEN_UNSPECIFIED =
  "Fall protection harness, lanyard, or SRL when the task, exposure, or site rules require them";

/** Parses structured PPE bullets (or legacy flat labels) back into raw item labels. */
export function flattenPpeSectionBulletsToItems(bullets: string[]): string[] {
  const out: string[] = [];
  for (const raw of bullets) {
    const b = raw.trim();
    if (!b) continue;
    const baselineMatch = /^Project baseline PPE:\s*(.+)$/i.exec(b);
    if (baselineMatch) {
      baselineMatch[1]
        .replace(/\.\s*$/, "")
        .split(";")
        .forEach((piece) => {
          const t = piece.trim();
          if (t) out.push(t);
        });
      continue;
    }
    const taskMatch = /^Task- and exposure-specific PPE:\s*(.+)$/i.exec(b);
    if (taskMatch) {
      taskMatch[1]
        .replace(/\.\s*$/, "")
        .split(";")
        .forEach((piece) => {
          const t = piece.trim();
          if (t) out.push(t);
        });
      continue;
    }
    out.push(b);
  }
  return out;
}

export function buildCsepPpeSectionBulletsFromCombined(combinedItems: string[]): string[] {
  const normalized = dedupePpeItemsForExport(combinedItems);
  const addons = normalized.filter((item) => !isBaselinePpeDisplay(item));
  const hasSpecificFall = addons.some((item) =>
    /\b(harness|lanyard|\bsrl\b|self[-\s]?retracting|personal fall arrest|lifeline)\b/i.test(item)
  );
  if (!hasSpecificFall) {
    addons.push(FALL_ADDON_WHEN_UNSPECIFIED);
  }

  const baselineText = `Project baseline PPE: ${CSEP_BASELINE_PPE_DISPLAY.join("; ")}.`;
  const addonText = `Task- and exposure-specific PPE: ${addons.join("; ")}.`;
  return [baselineText, addonText];
}

export function buildCsepPpeSectionBullets(ppeInput: string[], rulePpe: string[]): string[] {
  return buildCsepPpeSectionBulletsFromCombined([...ppeInput, ...rulePpe]);
}

export function normalizePermitList(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const normalized = normalizeToken(cleaned);
    const permit =
      PERMIT_DEFINITIONS.find((item) => item.id === normalized) ??
      PERMIT_DEFINITIONS.find((item) =>
        item.aliases.some((alias) => normalizeToken(alias) === normalized)
      );
    const display = permit?.label ?? cleaned;
    const key = normalizeToken(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }

  return out;
}

export function normalizeTaskList(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const key = normalizeToken(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

export function splitScopeTasksAndInterfaces(values: Array<string | null | undefined>) {
  const activeTasks: string[] = [];
  const interfaceTrades: string[] = [];
  const seenActive = new Set<string>();
  const seenInterface = new Set<string>();

  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const normalized = normalizeToken(cleaned);
    const isInterface = INTERFACE_TRADE_TOKENS.some((token) => normalized.includes(token));

    if (isInterface) {
      if (!seenInterface.has(normalized)) {
        seenInterface.add(normalized);
        interfaceTrades.push(cleaned);
      }
      continue;
    }

    if (!seenActive.has(normalized)) {
      seenActive.add(normalized);
      activeTasks.push(cleaned);
    }
  }

  return { activeTasks, interfaceTrades };
}

export function cleanSectionForFinalIssue(
  section: GeneratedSafetyPlanSection
): GeneratedSafetyPlanSection | null {
  const title = normalizeFinalExportText(section.title);
  if (!title) return null;

  const summary = normalizeFinalExportText(section.summary);
  const body = normalizeFinalExportText(section.body);
  const bullets = (section.bullets ?? [])
    .map((item) => normalizeFinalExportText(item))
    .filter((item): item is string => Boolean(item));
  const subsections = (section.subsections ?? [])
    .map((subsection) => {
      const subsectionTitle = normalizeFinalExportText(subsection.title);
      const subsectionBody = normalizeFinalExportText(subsection.body);
      const subsectionBullets = subsection.bullets
        .map((item) => normalizeFinalExportText(item))
        .filter((item): item is string => Boolean(item));

      const normalizedTitle = normalizeToken(subsectionTitle);
      const filteredBullets = subsectionBullets.filter((item, index, items) => {
        const normalizedItem = normalizeToken(item);
        if (!normalizedItem) return false;
        if (normalizedTitle && normalizedItem === normalizedTitle) return false;
        return items.findIndex((candidate) => normalizeToken(candidate) === normalizedItem) === index;
      });

      const labelOnlyHeading =
        Boolean(normalizedTitle) &&
        !subsectionBody &&
        filteredBullets.length === 0;

      if ((!subsectionTitle && !subsectionBody && !filteredBullets.length) || labelOnlyHeading) {
        return null;
      }

      const cleanedSubsection: NonNullable<GeneratedSafetyPlanSection["subsections"]>[number] = {
        title: subsectionTitle ?? "Details",
        bullets: filteredBullets,
      };

      if (subsectionBody) {
        cleanedSubsection.body = subsectionBody;
      }

      return cleanedSubsection;
    })
    .filter(
      (
        subsection
      ): subsection is NonNullable<GeneratedSafetyPlanSection["subsections"]>[number] =>
        Boolean(subsection)
    );
  const table = section.table
    ? {
        columns: section.table.columns
          .map((column) => normalizeFinalExportText(column))
          .filter((column): column is string => Boolean(column)),
        rows: section.table.rows
          .map((row) =>
            row
              .map((cell) => normalizeFinalExportText(cell) ?? "N/A")
              .filter((cell): cell is string => Boolean(cell))
          )
          .filter((row) => row.length > 0),
      }
    : null;

  if (!summary && !body && bullets.length === 0 && subsections.length === 0 && !table?.rows.length) {
    return null;
  }

  return {
    ...section,
    title,
    summary: summary ?? undefined,
    body: body ?? undefined,
    bullets: bullets.length ? bullets : undefined,
    subsections: subsections.length ? subsections : undefined,
    table:
      table && table.columns.length && table.rows.length
        ? table
        : null,
  };
}

export function controlledTbd() {
  return CONTROLLED_TBD;
}
```

## lib\csepExportValidation.ts

```ts
function extractErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isCsepExportValidationError(error: unknown) {
  return extractErrorMessage(error)
    .toLowerCase()
    .startsWith("csep export validation failed:");
}

export function getCsepExportValidationDetail(error: unknown) {
  const message = extractErrorMessage(error).trim();
  if (!message) {
    return "the final CSEP export could not be validated.";
  }

  return message.replace(/^csep export validation failed:\s*/i, "").trim() || message;
}
```

## lib\csepExportQualityCheck.ts

```ts
/**
 * Final CSEP export quality gate: logs issues to the console and throws before
 * DOCX bytes are produced so poor-quality plans are not silently shipped.
 */

import { CSEP_APPENDIX_REGULATORY_REFERENCES_KEY } from "@/lib/csepRegulatoryReferenceIndex";
import { CANONICAL_CSEP_SECTION_ORDER } from "@/lib/csep/csep-section-order";
import type {
  CsepRenderModel,
  CsepTemplateSection,
  CsepTemplateSubsection,
} from "@/lib/csepDocxRenderer";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

/** Mirror of `lib/csepDocxRenderer` outline plan (kept local to avoid a circular import). */
type CsepOutlinePlanEntry =
  | { kind: "title_page"; ordinal: number }
  | { kind: "body_section"; ordinal: number; section: CsepTemplateSection }
  | { kind: "disclaimer"; ordinal: number };

function baseTitleForOutlineHeading(section: CsepTemplateSection) {
  return section.title.trim().replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
}

function displayOutlineSectionHeading(ordinal: number, section: CsepTemplateSection) {
  const base = baseTitleForOutlineHeading(section);
  return `${ordinal}. ${base}`.trim();
}

function buildCsepOutlinePlan(model: CsepRenderModel): CsepOutlinePlanEntry[] {
  let ordinal = 1;
  const entries: CsepOutlinePlanEntry[] = [];
  entries.push({ kind: "title_page", ordinal: ordinal++ });
  model.frontMatterSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.sections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.appendixSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  entries.push({ kind: "disclaimer", ordinal: ordinal++ });
  return entries;
}

function formatOutlineTocLine(entry: CsepOutlinePlanEntry): string {
  switch (entry.kind) {
    case "title_page":
      return `${entry.ordinal}. Title Page`;
    case "body_section":
      return displayOutlineSectionHeading(entry.ordinal, entry.section);
    case "disclaimer":
      return `${entry.ordinal}. Disclaimer`;
  }
}

const LOG_PREFIX = "[CSEP export quality]";

/** Maximum total subsection rows in main body; structured program modules expand the outline by design. */
export const CSEP_EXPORT_MAX_MAIN_BODY_SUBSECTIONS = 360;

const REQUIRED_FRONT_MATTER_KEYS: readonly string[] = CANONICAL_CSEP_SECTION_ORDER
  .filter((section) => section.kind === "front_matter")
  .map((section) => section.key);

const TASK_MODULE_SECTION_KEY_PATTERN = /task_modules_reference|steel_task_modules_reference/i;

const INTERNAL_GENERATOR_PATTERNS: readonly RegExp[] = [
  /\bmoduleKey\b/i,
  /\bGeneratedSafetyPlan\b/i,
  /\bSafetyReferenceModule\b/i,
  /\bplainText\b/i,
  /\bsectionHeadings\b/i,
  /\btriggerManifest\b/i,
  /\bApplicability\s*\/\s*trigger logic\b/i,
  /\bIncluded for this scope\b/i,
  /\bprimary exposure profile\b/i,
  /\bmain exposure profile\b/i,
  /\btask scope\s*&\s*work conditions\b/i,
];

const STEEL_SCOPE_TRADE_PATTERN =
  /\b(steel|structural\s+steel|ironwork|metal\s+deck|decking|steel\s+erection)\b/i;

const STEEL_KEYWORD_GROUPS: readonly { id: string; pattern: RegExp }[] = [
  {
    id: "CAZ / CDZ / controlled access or decking zone",
    pattern: /\b(caz|cdz|controlled\s+access\s+zone|controlled\s+decking\s+zone|decking\s+zone|ironworker\s+work\s+zones?)\b/i,
  },
  {
    id: "Suspended load / swing / load path",
    pattern: /\b(suspended\s+loads?|suspended\s+load|under\s+(a\s+)?suspended\s+load|swing\s+radius|load\s+path|crane\s+swing|hoisting)\b/i,
  },
  {
    id: "Fall protection / leading edge / tie-off",
    pattern: /\b(fall\s+protection|leading\s+edge|100%\s*tie|tie-?off|personal\s+fall)\b/i,
  },
  {
    id: "Rescue / fall arrest / emergency medical",
    pattern: /\b(rescue|fall\s+arrest|suspension\s+trauma|post-?arrest|911|emergency\s+response)\b/i,
  },
  { id: "HazCom / SDS", pattern: /\b(hazcom|hazard\s+communication|\bsds\b|safety\s+data\s+sheet)\b/i },
  {
    id: "Crane permit / lift plan / pick plan",
    pattern: /\b(crane\s+permit|lift\s+plan|pick\s+plan|critical\s+lift|site\s+lift\s+plan)\b/i,
  },
];
const COVER_REQUIRED_METADATA_LABELS = ["Project Name", "Project Address", "Contractor", "Date"] as const;
const HAZCOM_REFERENCE_ALLOWLIST = [
  "Follow the project Hazard Communication requirements defined in the HazCom section.",
  "Follow the project Hazard Communication requirements defined in the Hazard Communication and Environmental Protection section.",
  "Follow the project Hazard Communication requirements for sealants.",
];
const SECURITY_REFERENCE_ALLOWLIST = [
  "Follow the project Security at Site requirements defined in the Security at Site section.",
  "Follow the project-wide Site Access, Laydown, and Traffic Control requirements in the Security at Site section.",
  "Follow the project-wide Site Access, Laydown, and Traffic Control requirements in the Site Access, Security, Laydown, and Traffic Control section.",
  "Follow owner, GC/CM, and site-specific dress codes",
];
const IIPP_REFERENCE_ALLOWLIST = [
  "Follow the project IIPP / Emergency Response requirements defined in the IIPP / Emergency Response section.",
  "Follow the project IIPP, Incident Reporting, and Corrective Action requirements defined in the IIPP, Incident Reporting, and Corrective Action section.",
];
const OWNERSHIP_COMPANION_KEYS: Record<string, readonly string[]> = {
  iipp_incident_reporting_corrective_action: [
    "training_competency_and_certifications",
    "worker_conduct_fit_for_duty_disciplinary_program",
  ],
  site_access_security_laydown_traffic_control: [
    "trade_interaction_and_coordination",
    "high_risk_steel_erection_programs",
    "hazard_control_modules",
    "task_execution_modules",
  ],
};
const MAX_HAZARD_MODULE_COUNT = 100;

function templateSubsectionHasContent(subsection: CsepTemplateSubsection): boolean {
  return Boolean(
    subsection.paragraphs?.some((paragraph) => paragraph.trim()) ||
      subsection.items?.some((item) => item.trim()) ||
      subsection.table?.rows.some((row) => row.some((cell) => cell.trim()))
  );
}

function normalizeHeadingKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function flattenSectionTexts(sections: readonly CsepTemplateSection[]): string[] {
  const out: string[] = [];
  for (const section of sections) {
    out.push(section.title, section.descriptor ?? "");
    for (const sub of section.subsections) {
      out.push(sub.title, ...(sub.paragraphs ?? []), ...(sub.items ?? []));
      if (sub.table?.rows) {
        for (const row of sub.table.rows) {
          out.push(...row);
        }
      }
    }
  }
  return out;
}

function flattenModelText(model: CsepRenderModel): string {
  const chunks: string[] = [
    model.projectName,
    model.contractorName,
    model.tradeLabel ?? "",
    model.subTradeLabel ?? "",
    model.titlePageTaskSummary,
    ...model.coverSubtitleLines,
    ...model.approvalLines,
    ...model.disclaimerLines,
    ...flattenSectionTexts(model.frontMatterSections),
    ...flattenSectionTexts(model.sections),
    ...flattenSectionTexts(model.appendixSections),
  ];
  return chunks.join("\n");
}

function checkTocVsNumberLabels(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const plan = buildCsepOutlinePlan(model);
  for (const entry of plan) {
    if (entry.kind !== "body_section") continue;
    if (entry.section.key === "table_of_contents") continue;
    const nl = entry.section.numberLabel?.trim();
    if (!nl) continue;
    const m = nl.match(/^(\d+)/);
    if (!m) continue;
    const fromLabel = Number.parseInt(m[1]!, 10);
    if (fromLabel !== entry.ordinal) {
      issues.push(
        `TOC/body numbering drift: section key "${entry.section.title}" uses numberLabel prefix ${fromLabel} but outline ordinal is ${entry.ordinal} (TOC line: "${formatOutlineTocLine(entry)}").`
      );
    }
  }
  return issues;
}

function checkTocInternalConsistency(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const plan = buildCsepOutlinePlan(model);
  for (const entry of plan) {
    if (entry.kind !== "body_section" || entry.section.key === "table_of_contents") continue;
    const tocLine = formatOutlineTocLine(entry);
    const base = entry.section.title.trim().replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
    const expected = `${entry.ordinal}. ${base}`.trim();
    if (tocLine !== expected) {
      issues.push(`TOC line mismatch internal rule for "${entry.section.key}": got "${tocLine}", expected "${expected}".`);
    }
  }
  return issues;
}

function checkDocumentControlPlacement(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const key = "document_control_and_revision_history";
  const inFront = model.frontMatterSections.some((s) => s.key === key);
  const inAppendix = model.appendixSections.some((s) => s.key === key);
  if (inFront || inAppendix) {
    issues.push(
      "Document Control / revision history must appear only as Section 21, not in front matter or appendices."
    );
  }
  const mainIndex = model.sections.findIndex((s) => s.key === key);
  if (mainIndex !== model.sections.length - 1) {
    issues.push("Document Control and Revision History must be the final main body section.");
  }
  const earlyIndex = model.frontMatterSections.findIndex(
    (s) =>
      /\bdocument\s+control\b/i.test(s.title) ||
      normalizeHeadingKey(s.key).includes("document control") ||
      normalizeHeadingKey(s.key).includes("revision history")
  );
  if (earlyIndex >= 0 && earlyIndex < model.frontMatterSections.findIndex((s) => s.key === "table_of_contents")) {
    issues.push(
      "Document Control (or revision history) content appears before the Table of Contents in front matter â€” it belongs in appendix end matter after the main body."
    );
  }
  return issues;
}

function checkRequiredFrontMatter(model: CsepRenderModel): string[] {
  const keys = new Set(model.frontMatterSections.map((s) => s.key));
  return REQUIRED_FRONT_MATTER_KEYS.filter((k) => !keys.has(k)).map((k) => `Required front-matter section missing: "${k}".`);
}

function checkCoverPageBaseline(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  if ((model.projectName ?? "").trim().length === 0) {
    issues.push("Cover page baseline check failed: project name is empty.");
  }
  if ((model.statusLabel ?? "").trim().length === 0) {
    issues.push("Cover page baseline check failed: status label is empty.");
  }
  const labels = new Set(model.coverMetadataRows.map((row) => row.label.trim()));
  for (const label of COVER_REQUIRED_METADATA_LABELS) {
    if (!labels.has(label)) {
      issues.push(`Cover page baseline check failed: required metadata row "${label}" is missing.`);
    }
  }
  return issues;
}

function checkFrontMatterOrder(model: CsepRenderModel): string[] {
  const orderedKeys = model.frontMatterSections.map((section) => section.key);
  const ownerIndex = orderedKeys.findIndex((key) => key === "message_from_owner" || key === "owner_message");
  const indexes = [ownerIndex, orderedKeys.indexOf("sign_off_page"), orderedKeys.indexOf("table_of_contents")];
  if (indexes.some((index) => index < 0)) return [];
  if (!(indexes[0]! < indexes[1]! && indexes[1]! < indexes[2]!)) {
    return [
      "Front matter order invalid: Message from Owner, Sign-Off Page, and Table of Contents must appear in that sequence.",
    ];
  }
  return [];
}

function checkScopeSectionCleanliness(model: CsepRenderModel): string[] {
  const scope = model.sections.find((section) => section.key === "scope_of_work_section");
  if (!scope) return [];
  const badSub = scope.subsections.find((subsection) =>
    /\b(project information|contractor information)\b/i.test(subsection.title)
  );
  if (!badSub) return [];
  return [
    `Scope section includes disallowed administrative block "${badSub.title}". Scope should remain clean after section cleanup.`,
  ];
}

function checkHazardModuleReasonableCount(model: CsepRenderModel): string[] {
  const hazards = model.sections.find((section) => section.key === "hazard_control_modules");
  if (!hazards) return [];
  const moduleCount = hazards.subsections.filter((subsection) => /:\s*Risk$/i.test(subsection.title)).length;
  if (moduleCount <= MAX_HAZARD_MODULE_COUNT) return [];
  return [
    `Hazards and Controls contains ${moduleCount} hazard modules, exceeding reasonable limit ${MAX_HAZARD_MODULE_COUNT}.`,
  ];
}

function checkDuplicateLadderAuthorizationBlocks(model: CsepRenderModel): string[] {
  const hazards = model.sections.find((section) => section.key === "hazard_control_modules");
  if (!hazards) return [];
  const ladderBlocks = hazards.subsections
    .map((subsection) => normalizeHeadingKey(subsection.title))
    .filter((title) => title.includes("ladder authorization program"));
  if (ladderBlocks.length <= 1) return [];
  return ["Duplicate Ladder Authorization Program hazard blocks detected."];
}

function checkDuplicatePpeAcrossHazards(model: CsepRenderModel): string[] {
  const hazards = model.sections.find((section) => section.key === "hazard_control_modules");
  if (!hazards) return [];
  const ppeLines = hazards.subsections
    .flatMap((subsection) => [...(subsection.paragraphs ?? []), ...(subsection.items ?? [])])
    .map((line) => line.trim())
    .filter((line) => /\b(ppe|personal protective equipment|hard hat|safety glasses|hi[-\s]?vis|harness)\b/i.test(line))
    .map((line) => normalizeHeadingKey(line))
    .filter((line) => line.length >= 10);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  ppeLines.forEach((line) => {
    if (seen.has(line)) dupes.add(line);
    seen.add(line);
  });
  if (dupes.size <= 1) return [];
  return [
    `Duplicate PPE narrative detected across hazard modules (${dupes.size} duplicate line(s)); keep PPE references concise and non-repetitive.`,
  ];
}

function sectionText(section: CsepTemplateSection): string[] {
  return section.subsections.flatMap((subsection) => [
    subsection.title,
    ...(subsection.paragraphs ?? []),
    ...(subsection.items ?? []),
  ]);
}

function checkOwnedTopicIsolation(
  model: CsepRenderModel,
  ownerKey: string,
  topicPattern: RegExp,
  allowlist: string[]
): string[] {
  const allSections = [...model.frontMatterSections, ...model.sections];
  const leaks: string[] = [];
  const companionKeys = new Set(OWNERSHIP_COMPANION_KEYS[ownerKey] ?? []);
  for (const section of allSections) {
    if (section.key === ownerKey || companionKeys.has(section.key)) continue;
    for (const line of sectionText(section)) {
      if (!topicPattern.test(line)) continue;
      if (allowlist.some((entry) => line.includes(entry))) continue;
      leaks.push(`${section.title}: ${line.slice(0, 120)}`);
      if (leaks.length >= 5) break;
    }
    if (leaks.length >= 5) break;
  }
  if (!leaks.length) return [];
  return [`Topic ownership leak for "${ownerKey}" detected outside owner section: ${leaks.join(" | ")}`];
}

function checkPermitCoverageAndPlacement(model: CsepRenderModel, draft?: GeneratedSafetyPlanDraft): string[] {
  if (!draft) return [];
  const selectedPermits = Array.from(
    new Set(
      [
        ...(draft.ruleSummary?.permitTriggers ?? []),
        ...draft.operations.flatMap((op) => op.permitTriggers ?? []),
      ]
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  if (!selectedPermits.length) return [];

  const allSections = [...model.frontMatterSections, ...model.sections];
  const sectionPermitCounts = allSections.map((section) => ({
    key: section.key,
    count: sectionText(section).reduce((sum, line) => {
      const permitSignal = line.replace(/\bpermit\s+holder\b/gi, "");
      return sum + (/\bpermit|lift plan|pick plan|hot work\b/i.test(permitSignal) ? 1 : 0);
    }, 0),
  }));
  const sorted = [...sectionPermitCounts].sort((a, b) => b.count - a.count);
  const primary = sorted[0];
  if (!primary || primary.count === 0) {
    return ["Selected permit triggers are present in draft input but no permit content appears in the export body."];
  }
  const permittedReferenceSections = new Set([
    "regulatory_basis_and_references",
    "required_permits_and_hold_points",
    "high_risk_steel_erection_programs",
    "hazard_control_modules",
    "task_execution_modules",
  ]);
  const noisySections = sorted.filter(
    (entry) => entry.count > 0 && entry.key !== primary.key && !permittedReferenceSections.has(entry.key)
  );
  if (noisySections.length > 4) {
    return [
      `Permit content is scattered across too many sections (${1 + noisySections.length}); keep permits consolidated in one clean primary permit section and only brief relevant references elsewhere.`,
    ];
  }

  const modelText = flattenModelText(model).toLowerCase();
  const canonicalizePermit = (value: string) =>
    value
      .toLowerCase()
      .replace(/\bpermit\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const missing = selectedPermits.filter((permit) => {
    const full = permit.toLowerCase();
    const normalized = canonicalizePermit(permit);
    if (full && modelText.includes(full)) return false;
    if (normalized && modelText.includes(normalized)) return false;
    return true;
  });
  if (missing.length) {
    return [`Selected permit trigger(s) missing from export text: ${missing.join(", ")}.`];
  }
  return [];
}

function checkPpeDuplicates(model: CsepRenderModel): string[] {
  const ppeSection = model.frontMatterSections.find((s) => normalizeHeadingKey(s.key) === "required ppe");
  if (!ppeSection) return [];
  const lines: string[] = [];
  for (const sub of ppeSection.subsections) {
    lines.push(...(sub.items ?? []), ...(sub.paragraphs ?? []));
  }
  const normalized = lines.map((l) => normalizeHeadingKey(l)).filter(Boolean);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const line of normalized) {
    if (line.length < 4) continue;
    if (seen.has(line)) dupes.add(line);
    seen.add(line);
  }
  if (!dupes.size) return [];
  return [`Duplicate PPE lines detected in Required PPE section: ${[...dupes].slice(0, 8).join("; ")}${dupes.size > 8 ? " â€¦" : ""}.`];
}

function checkInternalGeneratorLanguage(model: CsepRenderModel): string[] {
  const haystack = flattenModelText(model);
  const hits: string[] = [];
  for (const pattern of INTERNAL_GENERATOR_PATTERNS) {
    if (pattern.test(haystack)) {
      hits.push(pattern.source);
    }
  }
  if (!hits.length) return [];
  return [`Internal generator / scaffold wording detected (patterns: ${hits.slice(0, 6).join(", ")}).`];
}

function checkTaskModuleSafetyControls(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const allSections = [...model.frontMatterSections, ...model.sections, ...model.appendixSections];
  for (const section of allSections) {
    if (!TASK_MODULE_SECTION_KEY_PATTERN.test(section.key)) continue;
    section.subsections.forEach((sub, index) => {
      if (!templateSubsectionHasContent(sub)) {
        issues.push(
          `Task module section "${section.title}" (${section.key}) has empty subsection #${index + 1} titled "${sub.title || "(untitled)"}" â€” safety controls or narrative must be present.`
        );
      }
    });
  }
  return issues;
}

function checkRegulatoryAppendixRNumbers(model: CsepRenderModel): string[] {
  const section = model.sections.find((s) => s.key === CSEP_APPENDIX_REGULATORY_REFERENCES_KEY);
  if (!section) return ["Regulatory Basis and References section is missing."];
  const issues: string[] = [];
  for (const sub of section.subsections) {
    const rows = sub.table?.rows ?? [];
    for (const row of rows) {
      const left = (row[0] ?? "").trim();
      const right = (row[1] ?? "").trim();
      const combined = `${left} ${right}`.trim();
      if (!combined) continue;
      if (/^(library area|intended use)\b/i.test(left) || /^intended use\b/i.test(right)) continue;
      if (/stable r-number citations/i.test(combined)) continue;
      const citesOsha = /\bOSHA\b.*\b29\s+CFR\b/i.test(right) || /\bOSHA\b.*\b29\s+CFR\b/i.test(left);
      if (!citesOsha) continue;
      const hasRCode = /^R\d+$/i.test(left) || /^R\d+$/i.test(right) || /\bR\d+\b/.test(left);
      if (!hasRCode) {
        issues.push(
          `Regulatory appendix row pairs OSHA text without a leading R-code column: "${left.slice(0, 40)}" / "${right.slice(0, 100)}${right.length > 100 ? "â€¦" : ""}"`
        );
      }
    }
  }
  return issues.slice(0, 25);
}

function matrixColumnIndex(columns: readonly string[], ...aliases: string[]): number {
  const normalized = columns.map((c) => normalizeHeadingKey(c));
  for (const alias of aliases) {
    const target = normalizeHeadingKey(alias);
    const idx = normalized.findIndex((c) => c === target || c.includes(target));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Appendix E flags identical long control prose across many task rows to catch
 * accidental copy-paste. Some controls are standard permit boilerplate and are
 * expected to repeat verbatim across unrelated tasks (e.g. hot work + fire watch
 * on welding, cutting, grinding, touch-up).
 */
function controlTextIsLegitimatelyReusableAcrossTasks(normalizedControl: string): boolean {
  if (normalizedControl.length < 24) return false;
  if (/\bhot\s+work\b/.test(normalizedControl) && /\bfire\s+watch\b/.test(normalizedControl)) return true;
  if (/\bhot\s+work\b/.test(normalizedControl) && /\b(permit|posted|authorization)\b/.test(normalizedControl))
    return true;
  if (
    /\b(welding|cutting|grinding|torch|brazing)\b/.test(normalizedControl) &&
    /\b(hot\s+work|fire\s+watch|combustible|spark|ignite)\b/.test(normalizedControl)
  ) {
    return true;
  }
  if (/\block\s*out\b/.test(normalizedControl) && /\btag\s*out\b/.test(normalizedControl)) return true;
  if (/\bloto\b/.test(normalizedControl) && /\b(energy|electrical|de\s*energ)\b/.test(normalizedControl)) return true;
  return false;
}

function checkAppendixEDuplicateControls(model: CsepRenderModel): string[] {
  const appendices = model.appendixSections.filter(
    (s) =>
      /appendix[_\s]*e/i.test(s.key) ||
      /appendix\s+e/i.test(s.title) ||
      (/task/i.test(s.title) && /hazard/i.test(s.title) && /matrix/i.test(s.title))
  );
  if (!appendices.length) return [];

  for (const appendix of appendices) {
  for (const sub of appendix.subsections) {
    const table = sub.table;
    if (!table?.rows.length || table.rows.length < 3) continue;

    const idx = matrixColumnIndex(table.columns, "Required Controls", "Controls", "Control");
    const taskIdx = matrixColumnIndex(table.columns, "Activity", "Task", "Task title");
    if (idx < 0) continue;

    const byControl = new Map<string, Set<string>>();
    for (const row of table.rows) {
      const control = normalizeHeadingKey(row[idx] ?? "");
      if (control.length < 24) continue;
      const taskKey = taskIdx >= 0 ? normalizeHeadingKey(row[taskIdx] ?? "") : normalizeHeadingKey(row.join("|"));
      if (!byControl.has(control)) byControl.set(control, new Set());
      byControl.get(control)!.add(taskKey || "unknown-task");
    }

    const problems: string[] = [];
    for (const [control, tasks] of byControl) {
      if (controlTextIsLegitimatelyReusableAcrossTasks(control)) continue;
      if (tasks.size >= 3) {
        problems.push(`"${control.slice(0, 80)}â€¦" reused across ${tasks.size} distinct task rows`);
      }
    }
    if (problems.length) {
      return [
        `Appendix E (taskâ€“hazardâ€“control matrix): identical or near-identical long control text appears across multiple unrelated tasks â€” ${problems.slice(0, 5).join(" | ")}`,
      ];
    }
  }
  }
  return [];
}

function checkMainBodySubsectionBudget(model: CsepRenderModel): string[] {
  const count = model.sections.reduce((sum, s) => sum + s.subsections.length, 0);
  if (count > CSEP_EXPORT_MAX_MAIN_BODY_SUBSECTIONS) {
    return [
      `Main body subsection count (${count}) exceeds the export limit (${CSEP_EXPORT_MAX_MAIN_BODY_SUBSECTIONS}); simplify program slices or hazard blocks before export.`,
    ];
  }
  return [];
}

function isSteelExportScope(model: CsepRenderModel, draft?: GeneratedSafetyPlanDraft): boolean {
  const bundle = `${model.tradeLabel ?? ""} ${model.subTradeLabel ?? ""} ${model.titlePageTaskSummary}`;
  if (STEEL_SCOPE_TRADE_PATTERN.test(bundle)) return true;
  if (!draft) return false;
  const extended = draft as GeneratedSafetyPlanDraft & {
    siteContext?: { metadata?: Record<string, unknown> };
  };
  const m = extended.siteContext?.metadata;
  if (m && typeof m === "object") {
    if (Array.isArray(m.steelTaskModules) && m.steelTaskModules.length) return true;
    if (Array.isArray(m.steelHazardModules) && m.steelHazardModules.length) return true;
  }
  return false;
}

function checkSteelRequiredTopics(model: CsepRenderModel, draft?: GeneratedSafetyPlanDraft): string[] {
  if (!isSteelExportScope(model, draft)) return [];
  const text = flattenModelText(model).toLowerCase();
  const missing = STEEL_KEYWORD_GROUPS.filter((g) => !g.pattern.test(text)).map((g) => g.id);
  if (!missing.length) return [];
  return [
    `Steel-related CSEP is missing expected safety topic coverage in export text: ${missing.join("; ")}.`,
  ];
}

export type CsepExportQualityIssue = {
  code: string;
  message: string;
};

/**
 * Runs export-time checks, logs every finding to stderr, and throws if any issue
 * is present so callers never return a DOCX buffer for a failed quality gate.
 */
export function assertCsepExportQuality(model: CsepRenderModel, options?: { draft?: GeneratedSafetyPlanDraft }): void {
  model = {
    ...model,
    frontMatterSections: model.frontMatterSections.filter(Boolean),
    sections: model.sections.filter(Boolean),
    appendixSections: model.appendixSections.filter(Boolean),
  };
  const issues: CsepExportQualityIssue[] = [];

  const add = (code: string, messages: string[]) => {
    for (const message of messages) {
      issues.push({ code, message });
    }
  };

  add("toc_number_label", checkTocVsNumberLabels(model));
  add("toc_consistency", checkTocInternalConsistency(model));
  add("cover_page_baseline", checkCoverPageBaseline(model));
  add("front_matter_order", checkFrontMatterOrder(model));
  add("document_control_placement", checkDocumentControlPlacement(model));
  add("front_matter_required", checkRequiredFrontMatter(model));
  add("scope_section_cleanliness", checkScopeSectionCleanliness(model));
  add("hazard_module_count", checkHazardModuleReasonableCount(model));
  add("ladder_authorization_duplicates", checkDuplicateLadderAuthorizationBlocks(model));
  add("hazard_ppe_duplicates", checkDuplicatePpeAcrossHazards(model));
  add("ppe_duplicates", checkPpeDuplicates(model));
  add("internal_generator_language", checkInternalGeneratorLanguage(model));
  add(
    "hazcom_isolation",
    checkOwnedTopicIsolation(
      model,
      "hazard_communication_and_environmental_protection",
      /\b(hazcom|hazard communication|sds|safety data sheet|chemical inventory|ghs|nfpa|secondary container)\b/i,
      HAZCOM_REFERENCE_ALLOWLIST
    )
  );
  add(
    "security_isolation",
    checkOwnedTopicIsolation(
      model,
      "site_access_security_laydown_traffic_control",
      /\b(worker access|visitor|badge|site entry|unauthorized access|uncontrolled access|site security)\b/i,
      SECURITY_REFERENCE_ALLOWLIST
    )
  );
  add(
    "iipp_isolation",
    checkOwnedTopicIsolation(
      model,
      "iipp_incident_reporting_corrective_action",
      /\b(incident reporting|fit[-\s]?for[-\s]?duty|drug|alcohol)\b/i,
      IIPP_REFERENCE_ALLOWLIST
    )
  );
  add("permit_coverage", checkPermitCoverageAndPlacement(model, options?.draft));
  add("task_module_empty", checkTaskModuleSafetyControls(model));
  add("regulatory_r_numbers", checkRegulatoryAppendixRNumbers(model));
  add("appendix_e_duplicate_controls", checkAppendixEDuplicateControls(model));
  add("main_body_subsection_budget", checkMainBodySubsectionBudget(model));
  add("steel_required_topics", checkSteelRequiredTopics(model, options?.draft));

  if (!issues.length) return;

  for (const issue of issues) {
    console.error(`${LOG_PREFIX} [${issue.code}] ${issue.message}`);
  }

  const summary = issues.map((i) => `[${i.code}] ${i.message}`).join("\n");
  throw new Error(`${LOG_PREFIX} Export blocked: ${issues.length} quality issue(s).\n${summary}`);
}
```

## lib\csepPrograms.ts

```ts
import {
  formatApplicableReferenceBullets,
  formatApplicableReferencesInline,
} from "@/lib/csepRegulatoryReferenceIndex";
import { CSEP_RESTART_AFTER_VERIFICATION, CSEP_STOP_WORK_UNIVERSAL_AUTHORITY } from "@/lib/csepStopWorkLanguage";
import type { CSEPRiskItem } from "@/lib/csepTradeSelection";
import type {
  CSEPProgramCategory,
  CSEPProgramConfig,
  CSEPProgramDefinition,
  CSEPProgramDefinitionContent,
  CSEPProgramModule,
  CSEPProgramSection,
  CSEPProgramSelection,
  CSEPProgramSelectionInput,
  CSEPProgramSelectionSource,
  CSEPProgramSubtypeConfig,
  CSEPProgramSubtypeGroup,
  CSEPProgramSubtypeValue,
} from "@/types/csep-programs";

type ProgramDefinition = CSEPProgramDefinition;

type BuildSelectionsParams = {
  selectedHazards: string[];
  selectedPermits: string[];
  selectedPpe: string[];
  tradeItems?: CSEPRiskItem[];
  selectedTasks?: string[];
  subtypeSelections?: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
};

/** Used for both the hazard program and the Ladder Permit program so the export shows one set of controls, not two divergent template blocks. */
const LADDER_USE_PROGRAM_SUMMARY =
  "Portable-ladder and step-ladder work under 29 CFR 1926 Subpart X: pick the right ladder class and length for the job, pre-use inspection, correct setup, and height/reach limits. Use a scaffold, lift, or stair when subpart- or site-rules cannot be met. Site ladder permits, if required, are part of the same control set, not a second program block.";

const LADDER_USE_CONTROLS = [
  "Use the correct type for the work (e.g., extension for height, step ladder only where its design and rating allow) and a duty rating that matches the load, including materials and tool belts, per the manufacturer and Subpart X.",
  "When electrical exposure is possible, use ladders with non-conductive side rails or other project-approved non-conductive access per site and utility rules for the work area.",
  "Follow project limits on use height, horizontal reach, and duration: portable ladders are for access and short work; do not overreach, stand on the top cap or a rung not designed for foot placement, or use a portable ladder as a work platform for sustained or heavy workâ€”shift to a scaffold, stair tower, or lift as approved.",
  "Pre-use and periodical inspection: check rails, feet, locks, spreaders, rungs, ropes, and labels; remove damaged, bent, or unlabeled equipment from service and tag/segment it so it is not re-used until repaired or scrapped.",
  "Setup: place on a stable, level base; set pitch per Subpart X (e.g., proper horizontal offset for extension ladders) and base securement; extend extension ladders at least 3 feet above a landing (unless an equivalent grab/transition is provided per plan) and tie, block, or hold to prevent movement.",
  "Use: maintain three points of contact; keep one person on a single ladder unless the equipment is designed for more; do not use side load or the ladder in a way the manufacturer or site plan forbids. Obey site prohibitions (e.g., specific ladder types or areas).",
] as const;

const LADDER_USE_RESPONSIBILITIES = [
  "Supervision confirms the ladder is authorized for the task and area, the correct type and length are selected, and a ladder permit or pre-use check is on file if the site or GC requires it. Workers and foremen remove bad ladders from service on first find.",
] as const;

const LADDER_USE_TRAINING = [
  "Workers are briefed on pre-use inspection, setup, tie-off or holding, and when to stop and use alternate access. Where a union, collective bargaining, or project-specific ladder rule applies, follow that rule first when it is stricter than this summary.",
] as const;

const LADDER_USE_APPLICABLE_WHEN = [
  "Portable or job-made ladders (where allowed) are used for access, short work, or a task the site or GC has approved for ladder work.",
] as const;

const CONFINED_SPACE_SUBTYPE_CONFIG: CSEPProgramSubtypeConfig = {
  group: "confined_space_classification",
  label: "Confined space classification",
  prompt: "Choose whether the confined-space scope is permit-required or non-permit.",
  options: [
    {
      value: "permit_required",
      label: "Permit-required confined space",
      description: "Use when entry requires a permit, attendant, atmospheric review, and rescue planning.",
    },
    {
      value: "non_permit",
      label: "Non-permit confined space",
      description: "Use when the space meets confined-space criteria but does not require a permit entry process.",
    },
  ],
};

const SUBTYPE_CONFIGS: Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeConfig> = {
  confined_space_classification: CONFINED_SPACE_SUBTYPE_CONFIG,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dedupe(values: readonly string[]) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean))];
}

function formatProgramParagraph(values: readonly string[], fallback?: string) {
  const items = dedupe(values);
  if (items.length > 0) {
    return items
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))
      .join(" ");
  }

  const text = fallback?.trim() || "";
  if (!text) return undefined;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

const PROGRAM_MODULE_SUBSECTION_TITLES = {
  risk: "Risk",
  requiredControls: "Required controls",
  verificationMethods: "How controls are met and verified",
  stopWorkTriggers: "Stop-work / hold-point triggers",
  applicableReferences: "Applicable references",
} as const;

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = dedupe(
    value.filter((item): item is string => typeof item === "string")
  );

  return normalized.length ? normalized : [...fallback];
}

function cloneDefinitionContent(
  definition: CSEPProgramDefinitionContent
): CSEPProgramDefinitionContent {
  return {
    title: definition.title,
    summary: definition.summary,
    oshaRefs: [...definition.oshaRefs],
    applicableWhen: [...definition.applicableWhen],
    responsibilities: [...definition.responsibilities],
    preTaskProcedures: [...definition.preTaskProcedures],
    workProcedures: [...definition.workProcedures],
    stopWorkProcedures: [...definition.stopWorkProcedures],
    closeoutProcedures: [...definition.closeoutProcedures],
    controls: [...definition.controls],
    training: [...definition.training],
  };
}

function cloneProgramDefinition(definition: CSEPProgramDefinition): CSEPProgramDefinition {
  return {
    category: definition.category,
    item: definition.item,
    ...cloneDefinitionContent(definition),
    ...(definition.subtypeGroup ? { subtypeGroup: definition.subtypeGroup } : {}),
    ...(definition.subtypeVariants
      ? {
          subtypeVariants: Object.fromEntries(
            Object.entries(definition.subtypeVariants).map(([key, value]) => [
              key,
              value ? cloneDefinitionContent({ ...cloneDefinitionContent(definition), ...value }) : value,
            ])
          ) as CSEPProgramDefinition["subtypeVariants"],
        }
      : {}),
    ...(definition.compactLayout ? { compactLayout: true } : {}),
  };
}

function normalizeSubtypeVariants(
  input: unknown,
  fallback: CSEPProgramDefinition["subtypeVariants"]
) {
  if (!fallback) {
    return undefined;
  }

  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const variants = Object.fromEntries(
    Object.entries(fallback).map(([key, value]) => {
      if (!value) {
        return [key, value];
      }

      const override =
        raw[key] && typeof raw[key] === "object" ? (raw[key] as Record<string, unknown>) : {};

      return [
        key,
        {
          title: normalizeText(override.title, value.title ?? ""),
          summary: normalizeText(override.summary, value.summary ?? ""),
          oshaRefs: normalizeTextList(override.oshaRefs, value.oshaRefs ?? []),
          applicableWhen: normalizeTextList(override.applicableWhen, value.applicableWhen ?? []),
          responsibilities: normalizeTextList(
            override.responsibilities,
            value.responsibilities ?? []
          ),
          preTaskProcedures: normalizeTextList(
            override.preTaskProcedures,
            value.preTaskProcedures ?? []
          ),
          workProcedures: normalizeTextList(override.workProcedures, value.workProcedures ?? []),
          stopWorkProcedures: normalizeTextList(
            override.stopWorkProcedures,
            value.stopWorkProcedures ?? []
          ),
          closeoutProcedures: normalizeTextList(
            override.closeoutProcedures,
            value.closeoutProcedures ?? []
          ),
          controls: normalizeTextList(override.controls, value.controls ?? []),
          training: normalizeTextList(override.training, value.training ?? []),
        },
      ];
    })
  ) as CSEPProgramDefinition["subtypeVariants"];

  return variants;
}

type ProgramProcedureFields = Pick<
  CSEPProgramDefinitionContent,
  "preTaskProcedures" | "workProcedures" | "stopWorkProcedures" | "closeoutProcedures"
>;

function createProcedureFields(
  overrides?: Partial<ProgramProcedureFields>
): ProgramProcedureFields {
  return {
    preTaskProcedures: normalizeTextList(overrides?.preTaskProcedures, []),
    workProcedures: normalizeTextList(overrides?.workProcedures, []),
    stopWorkProcedures: normalizeTextList(overrides?.stopWorkProcedures, []),
    closeoutProcedures: normalizeTextList(overrides?.closeoutProcedures, []),
  };
}

function applyProcedureFields<T extends object>(
  definition: T,
  overrides?: Partial<ProgramProcedureFields>
) {
  return {
    ...definition,
    ...createProcedureFields(overrides),
  };
}

const HAZARD_PROCEDURE_CONTENT: Record<string, ProgramProcedureFields> = {
  "Falls from height": createProcedureFields({
    // Fall program text is assembled in buildFallProtectionGoverningProgramSection; keep these
    // empty so catalog merges do not duplicate inspection / planning language in exports.
    preTaskProcedures: [],
    workProcedures: [],
    stopWorkProcedures: [],
    closeoutProcedures: [],
  }),
  "Electrical shock": createProcedureFields({
    preTaskProcedures: [
      "Identify all electrical sources, boundaries, temporary-power needs, and qualified-person responsibilities before work begins.",
      "Confirm lockout/tagout scope, test-instrument availability, cord routing, and GFCI protection before energization or troubleshooting starts.",
      "Inspect cords, tools, panels, covers, and work conditions for damage, moisture, and unauthorized modifications.",
    ],
    workProcedures: [
      "Keep electrical work limited to qualified personnel when tie-ins, troubleshooting, testing, or energized exposure is involved.",
      "Maintain dry, protected work conditions and keep cords, panels, and temporary power clear of damage, pinch points, and traffic exposure.",
      "Verify systems are in the expected condition before each phase of testing, startup, or re-energization.",
    ],
    stopWorkProcedures: [
      "Stop work if unexpected voltage, backfeed, damaged equipment, missing covers, or wet conditions create uncontrolled exposure.",
      "Stop work when lockout/tagout status is uncertain or when the required qualified worker or test equipment is not available.",
      "Do not continue until the system state is verified and electrical protection measures are restored.",
    ],
    closeoutProcedures: [
      "Return equipment to a guarded condition, remove temporary wiring or damaged components from service, and restore panel access.",
      "Coordinate controlled re-energization, communication to affected parties, and confirmation that tools and personnel are clear.",
      "Document electrical issues, damaged equipment, or abnormal conditions for follow-up before the area is turned over.",
    ],
  }),
  "Hot work / fire": createProcedureFields({
    // Governing text is in buildHotWorkGoverningProgramSection; keep arrays empty
    // so catalog merges do not duplicate hot-work content in exports.
    preTaskProcedures: [],
    workProcedures: [],
    stopWorkProcedures: [],
    closeoutProcedures: [],
  }),
  "Struck by equipment": createProcedureFields({
    preTaskProcedures: [
      "Review equipment routes, backing paths, delivery timing, spotter assignments, and exclusion-zone limits before movement starts.",
      "Confirm workers in the area understand travel paths, staging limits, and where pedestrian access is prohibited during equipment activity.",
      "Inspect the route for blind spots, soft ground, overhead obstructions, and conflicting trades before authorizing movement.",
    ],
    workProcedures: [
      "Use the planned route, maintain visual or radio communication with spotters, and keep unauthorized workers out of the controlled area.",
      "Position workers clear of swing radiuses, backing zones, and line-of-fire exposure while equipment is operating or repositioning.",
      "Pause movement when congestion, deliveries, or simultaneous work reduces visibility or route control.",
    ],
    stopWorkProcedures: [
      "Stop equipment movement immediately if spotter communication is lost, pedestrians enter the route, or visibility is no longer adequate.",
      "Stop work when route conditions change, surfaces become unstable, or adjacent activity creates uncontrolled struck-by exposure.",
      "Resume only after route control, communication, and personnel positioning are re-established.",
    ],
    closeoutProcedures: [
      "Park or stage equipment in the approved location and remove temporary traffic restrictions only after the movement hazard is gone.",
      "Restore pedestrian access routes and clear staging areas of materials that could create new struck-by exposure.",
      "Report near misses, blind-spot issues, or route conflicts so the next shift can adjust the traffic plan.",
    ],
  }),
  "Ladder misuse": createProcedureFields({
    preTaskProcedures: [
      "Select ladder type (e.g., extension, single, step), duty class, and length so the work stays within the manufacturer rating and 1926.1053 limits for the set-up; verify site electrical-minimums for non-conductive rails if exposure exists.",
      "Pre-use: inspect stiles, feet, rungs, locks, spreader bars, and labels; reject missing or out-of-service equipment before it is carried to the work area.",
      "Set up on firm, level footing; verify pitch and base/ top securement, landing extension (e.g., 3 feet past the top support where required), and control for doors, traffic, and overhead power lines or equipment.",
    ],
    workProcedures: [
      "Climb and work with the body between the rails, three points of contact, and no overreach; do not straddle, side-load, or use the top step/cap in violation of the manufacturer or site rule.",
      "If the work changes (longer reach, longer duration, heavier tool load, or both hands for material), move to a scaffold, lift, or stair that supports the new condition.",
      "One worker on the portable ladder except where the design allows two, per manufacturer. Keep non-essential people clear of the bight and the drop zone for tools.",
    ],
    stopWorkProcedures: [
      "Stop if the ladder shifts, slips, fails inspection mid-shift, is struck, or is no longer supported as first placed; stop in wind, weather, or traffic that the plan does not allow.",
      "Do not resume until the same ladder is re-set or a compliant alternate is in use and a competent person re-briefs the crew as needed.",
    ],
    closeoutProcedures: [
      "At task end, remove the ladder from travel paths, store or flag it so it is not used damaged, and clear debris, cords, and material from the access area.",
      "Log or close any ladder permit or site sign-off the shift required, and hand off to the next shift if the work continues.",
    ],
  }),
  "Confined spaces": createProcedureFields({
    preTaskProcedures: [
      "Identify the space, classify the entry, isolate hazards, and confirm entrant, attendant, and supervisor roles before entry begins.",
      "Review atmospheric testing, ventilation, communication, retrieval, and rescue expectations before authorizing access.",
      "Barricade the opening and control unauthorized entry while entry preparations are underway.",
    ],
    workProcedures: [
      "Maintain communication among entrants, attendants, and supervision for the full duration of the entry.",
      "Continue monitoring and reevaluate conditions whenever work scope, ventilation, tooling, or atmospheric conditions change.",
      "Keep the entry point controlled so only authorized personnel and equipment enter the space.",
    ],
    stopWorkProcedures: [
      "Stop entry immediately if atmospheric readings change, communication fails, rescue readiness is compromised, or unauthorized entry occurs.",
      "Stop work when isolation status changes or when the space can no longer be maintained in the reviewed condition.",
      "Remove entrants and re-evaluate the entry before work resumes.",
    ],
    closeoutProcedures: [
      "Account for all entrants, remove tools and materials, and secure the opening when the entry is complete.",
      "Close the permit or classification record and document any condition changes that occurred during the entry.",
      "Restore the area only after barricades, covers, and access controls are returned to a safe condition.",
    ],
  }),
  "Chemical exposure": createProcedureFields({
    preTaskProcedures: [
      "Review the SDS, product label, required PPE, ventilation needs, and spill-response expectations before chemical use begins.",
      "Verify containers are labeled, incompatible products are segregated, and the work area has the required wash, ventilation, or containment support.",
      "Stage spill kits, absorbents, and disposal containers before opening or mixing chemical products.",
    ],
    workProcedures: [
      "Use chemicals only as reviewed for the task and keep containers closed, labeled, and under control when not actively dispensing.",
      "Maintain ventilation, PPE, and housekeeping controls during mixing, application, transfer, and cleanup.",
      "Keep ignition sources, unauthorized workers, and incompatible materials away from the active chemical-use area.",
    ],
    stopWorkProcedures: [
      "Stop work if labels are missing, SDS information is unavailable, required PPE or ventilation is not in place, or incompatible materials are introduced.",
      "Stop work immediately for spills, uncontrolled release, symptoms of exposure, or any condition that exceeds the reviewed use plan.",
      "Do not resume until the exposure is contained, evaluated, and brought back under control.",
    ],
    closeoutProcedures: [
      "Seal and store remaining product correctly, and remove waste, rags, and contaminated materials using the approved disposal method.",
      "Clean tools, decontaminate the work area as required, and restock spill-response materials used during the task.",
      "Report spills, exposure symptoms, or product issues for follow-up before the area is released.",
    ],
  }),
  "Silica / dust exposure": createProcedureFields({
    preTaskProcedures: [
      "Review the dust-generating task, control method, respiratory requirements, and restricted-area needs before work starts.",
      "Inspect wet-cutting systems, vacuums, shrouds, hoses, filters, and power tools to confirm the selected control method will function as planned.",
      "Set access controls and position workers to reduce downstream dust exposure to adjacent crews.",
    ],
    workProcedures: [
      "Run wet methods, local exhaust, or vacuum systems continuously while the dust-generating task is active.",
      "Use the tool configuration and work method reviewed for the task, and avoid dry sweeping or uncontrolled compressed-air cleanup.",
      "Monitor visible dust migration and adjust access, positioning, or pace of work when airborne exposure increases.",
    ],
    stopWorkProcedures: [
      "Stop work if wet methods, vacuum systems, shrouds, or respiratory controls are missing, clogged, or no longer effective.",
      "Stop work when visible dust is no longer contained or when adjacent crews are exposed without control.",
      "Resume only after the dust-control setup is restored and the work area is re-evaluated.",
    ],
    closeoutProcedures: [
      "Clean the area using HEPA vacuuming, wet cleanup, or another approved low-dust method.",
      "Dispose of collected dust and debris in a controlled manner and service filters, hoses, or collection units as needed.",
      "Remove access restrictions only after airborne dust has settled or been controlled.",
    ],
  }),
  "Pressure / line break": createProcedureFields({
    preTaskProcedures: [
      "Identify system boundaries, energy sources, isolation points, drains, vents, and release paths before line-break or pressure work starts.",
      "Confirm lockout/tagout, zero-pressure verification, test medium, communication roles, and exclusion boundaries before opening or pressurizing the system.",
      "Inspect hoses, gauges, fittings, blinds, and test equipment for condition and compatibility with the planned pressure scope.",
    ],
    workProcedures: [
      "Open, loosen, vent, and pressurize systems in a controlled sequence while keeping personnel clear of potential release paths.",
      "Maintain communication with all affected workers before each pressure change, valve movement, test hold, or release step.",
      "Keep barriers, exclusion zones, and monitoring in place during testing, flushing, startup, or controlled release work.",
    ],
    stopWorkProcedures: [
      "Stop work immediately for unexpected pressure behavior, leaks, movement, noise, component distortion, or loss of boundary control.",
      "Stop work when gauges, restraints, isolation status, or communication can no longer be trusted.",
      "Do not continue until the system is returned to a verified safe condition and the release/test plan is rechecked.",
    ],
    closeoutProcedures: [
      "Depressurize or return the system to the approved operating condition before removing test equipment or temporary boundaries.",
      "Reinstall guards, caps, and permanent components, and verify drains and vents are left in the intended condition.",
      "Document abnormal pressure behavior, leaks, or equipment defects before turnover.",
    ],
  }),
  "Falling objects": createProcedureFields({
    preTaskProcedures: [
      "Review overhead work locations, drop-zone boundaries, protected access routes, and material-handling plans before the task starts.",
      "Verify tool tethering, toe boards, netting, canopies, barricades, or other overhead protection required for the work area.",
      "Clear or reroute workers below the active overhead area before materials or tools are moved into position.",
    ],
    workProcedures: [
      "Keep tools, materials, and debris secured while work is performed at elevation or above occupied areas.",
      "Maintain barricades and communicate with affected crews whenever work shifts to a new overhead exposure point.",
      "Control staging at edges and elevated platforms so loose material cannot roll, slide, or be kicked into lower levels.",
    ],
    stopWorkProcedures: [
      "Stop work if workers enter the drop zone without protection, material security is lost, or wind/conditions create uncontrolled displacement.",
      "Stop work when overhead protection or barricades are moved, removed, or no longer adequate for the active exposure.",
      "Do not resume until the drop zone and object-control measures are restored.",
    ],
    closeoutProcedures: [
      "Remove loose tools, scrap, and unsecured materials from elevated surfaces before the area is left unattended.",
      "Inspect the lower-level area for dropped debris and reopen access only after overhead exposure is eliminated.",
      "Store tethering and overhead-protection equipment so it remains ready for the next use.",
    ],
  }),
  "Crane lift hazards": createProcedureFields({
    preTaskProcedures: [
      "Review the lift scope, load path, ground conditions, rigging method, communication plan, and required lift documentation before the pick begins.",
      "Verify crane setup, outrigger support, swing radius, power-line clearance, and exclusion zones before the load is connected.",
      "Inspect rigging, hooks, tag lines, and connection points, and confirm only authorized personnel are assigned to signaling and rigging duties.",
    ],
    workProcedures: [
      "Conduct the lift using the planned signals or radio communication, and maintain clear separation from suspended loads and load paths.",
      "Control the load with the approved rigging and tag-line methods, and pause if balance, clearance, or weather conditions change.",
      "Keep the crane area, swing radius, and landing zone controlled until the load is set and stable.",
    ],
    stopWorkProcedures: [
      "Stop the lift immediately if communication is lost, the load shifts unexpectedly, wind or ground conditions deteriorate, or unauthorized personnel enter the controlled area.",
      "Stop work when rigging defects, clearance conflicts, or crane setup concerns are identified after the lift has started.",
      "Resume only after the lift plan and field conditions are revalidated.",
    ],
    closeoutProcedures: [
      "Land and secure the load, then remove rigging only after the load is stable and clear of pinch or shift hazards.",
      "Stow rigging gear, restore the swing radius, and inspect equipment that showed wear or abnormal loading during the pick.",
      "Capture lift issues, near misses, or changes needed for the next pick before releasing the area.",
    ],
  }),
  "Excavation collapse": createProcedureFields({
    preTaskProcedures: [
      "Confirm locate status, excavation limits, soil conditions, protective-system selection, and competent-person coverage before digging starts.",
      "Inspect trench boxes, shoring, sloping, access points, spoil-pile locations, and adjacent loads before workers enter the excavation.",
      "Review groundwater, weather, traffic, and utility conditions that could change the stability of the excavation during the shift.",
    ],
    workProcedures: [
      "Keep spoil piles, equipment, and surcharge loads back from the edge while maintaining the protective system and access/egress in place.",
      "Have the competent person reinspect as depth, soil, water, vibration, or adjacent activity changes during the day.",
      "Control entry so workers do not enter unprotected areas or move below suspended loads and unsupported faces.",
    ],
    stopWorkProcedures: [
      "Stop work immediately for cave-in indicators, sloughing, water accumulation, protective-system movement, unmarked utilities, or changing soil conditions.",
      "Stop entry when inspections are overdue or when access, egress, or atmospheric conditions are no longer acceptable.",
      "Do not resume until the competent person re-evaluates the excavation and required protections are restored.",
    ],
    closeoutProcedures: [
      "Secure, plate, backfill, or barricade the excavation before leaving the area unattended.",
      "Remove temporary access only after workers are out and the excavation is left in a controlled condition.",
      "Document inspection findings, utility conflicts, or ground-condition changes for the next shift.",
    ],
  }),
  "Slips trips falls": createProcedureFields({
    preTaskProcedures: [
      "Inspect walkways, stairs, access points, and work surfaces at the start of the shift for clutter, damage, lighting issues, and weather-related exposure.",
      "Plan material staging, hose and cord routing, waste collection, and cleanup responsibility before work begins.",
      "Review any areas likely to become wet, muddy, icy, or congested during the task and assign controls in advance.",
    ],
    workProcedures: [
      "Keep access routes open, clean as work progresses, and control cords, hoses, tools, and materials so they do not create new trip hazards.",
      "Address wet or uneven walking surfaces as they develop by cleaning, treating, barricading, or rerouting workers.",
      "Maintain lighting and visibility so workers can recognize changing surface conditions while moving through the area.",
    ],
    stopWorkProcedures: [
      "Stop work or reroute access when surfaces become too slick, obstructed, dark, or uneven to travel safely.",
      "Stop work when housekeeping controls break down and the area can no longer support safe movement or emergency egress.",
      "Resume only after the access route is restored or an alternate safe path is established.",
    ],
    closeoutProcedures: [
      "Remove scrap, packaging, cords, hoses, and stored materials from access routes at the end of the task.",
      "Leave stairs, ladders, and walkways in a clean, lit, and usable condition for the next crew.",
      "Document recurring housekeeping problem areas so site controls can be adjusted.",
    ],
  }),
};

const CONFINED_SPACE_SUBTYPE_PROCEDURE_CONTENT: Partial<
  Record<CSEPProgramSubtypeValue, ProgramProcedureFields>
> = {
  permit_required: createProcedureFields({
    preTaskProcedures: [
      "Complete the permit-required entry review, verify hazard isolation, and confirm attendant, entrant, and supervisor roles before entry begins.",
      "Validate atmospheric monitoring, retrieval setup, rescue readiness, and permit authorization before the opening is released for entry.",
      "Brief the crew on permit limits, communication signals, evacuation triggers, and entry duration controls.",
    ],
    workProcedures: [
      "Maintain the attendant outside the space for the entire entry and keep the permit, monitoring records, and communication method active.",
      "Continue atmospheric monitoring and reassess whenever work changes the atmosphere, configuration, or rescue complexity of the space.",
      "Control the opening and limit entry to authorized personnel and approved equipment only.",
    ],
    stopWorkProcedures: [
      "Stop entry immediately if permit conditions change, alarms activate, communication is lost, rescue readiness changes, or the attendant is unavailable.",
      "Remove entrants whenever monitoring, isolation, ventilation, or permit controls can no longer be maintained as written.",
      "Do not re-enter until the permit is updated and the entry supervisor reauthorizes the work.",
    ],
    closeoutProcedures: [
      "Cancel the permit after all entrants are accounted for and the work, monitoring, and rescue equipment are removed from service.",
      "Document any permit deviations, alarms, or condition changes that occurred during the entry.",
      "Secure the opening and return the space to a controlled condition before leaving the area.",
    ],
  }),
  non_permit: createProcedureFields({
    preTaskProcedures: [
      "Document the non-permit classification and verify the space remains free of atmospheric, engulfment, and configuration hazards before entry.",
      "Review access, communication, and reevaluation expectations with the crew before anyone enters the space.",
      "Establish controlled access and confirm the work to be performed will not introduce permit-required hazards.",
    ],
    workProcedures: [
      "Keep the space under observation and reevaluate conditions whenever tools, materials, or adjacent operations could change the hazard profile.",
      "Maintain orderly access and communication so entrants can exit immediately if conditions change.",
      "Limit the work to the reviewed non-permit scope and pause before introducing any new energy, chemicals, or heat source.",
    ],
    stopWorkProcedures: [
      "Stop work immediately if atmospheric concerns, engulfment potential, hazardous energy, or other permit-required conditions develop.",
      "Stop entry when the classification can no longer be supported or when changing work scope introduces new hazards.",
      "Reclassify the entry and upgrade controls before work continues.",
    ],
    closeoutProcedures: [
      "Document the completed non-permit entry review and note any conditions that nearly triggered reclassification.",
      "Remove temporary access controls and secure the space once tools and workers are clear.",
      "Report changing conditions so future entries start with the updated hazard picture.",
    ],
  }),
};

const BASE_PROGRAM_DEFINITIONS: Array<Omit<CSEPProgramDefinition, keyof ProgramProcedureFields>> = [
  {
    category: "hazard",
    item: "Falls from height",
    title: "Fall Protection Program",
    summary:
      "Governing fall protection for this CSEP. Hazards and Controls may add task detail; this program states equipment, tie-off, inspection, and stop-work requirements.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Fall to a lower level: edges, openings, leading deck, or incomplete floor.",
      "Steel, decking, or connector work where the plan or rules require a fall system or collective protection.",
      "Aerial lift, ladder, or scaffold work where the equipment or site rules require personal fall protection.",
    ],
    responsibilities: [],
    controls: [],
    training: [],
  },
  {
    category: "hazard",
    item: "Electrical shock",
    title: "Electrical Safety Program",
    summary: "This program defines controls required to prevent shock, arc, burn, and energized-equipment exposure during selected construction activities.",
    oshaRefs: ["OSHA 1926 Subpart K - Electrical"],
    applicableWhen: [
      "Selected work includes temporary power, terminations, testing, energization, or other electrical exposure.",
    ],
    responsibilities: [
      "Only qualified personnel shall perform tie-ins, troubleshooting, or energized-system work.",
      "Supervision shall verify hazardous energy isolation and equipment condition before work begins.",
    ],
    controls: [
      "Use GFCI protection where required.",
      "Remove damaged cords, tools, and electrical equipment from service.",
      "Follow LOTO procedures before servicing equipment with hazardous energy.",
      "Protect extension cords from damage, water, pinch points, and vehicle traffic.",
    ],
    training: [
      "Workers shall be trained on electrical hazard recognition, temporary power expectations, and LOTO requirements.",
    ],
  },
  {
    category: "hazard",
    item: "Hot work / fire",
    title: "Hot Work Program",
    summary:
      "Governing hot work and fire prevention for this CSEP. The project hot work permit and supporting forms own authorization; this program states the risk, field controls, verification, and closeout. Use Security at Site and IIPP / Emergency Response for access and response detail.",
    oshaRefs: ["OSHA 1926 Subpart J - Fire Protection and Prevention"],
    applicableWhen: [],
    responsibilities: [],
    controls: [],
    training: [],
  },
  {
    category: "hazard",
    item: "Struck by equipment",
    title: "Struck-By and Equipment Safety Program",
    summary: "This program establishes controls for worker exposure around moving equipment, haul routes, backing hazards, and blind spots.",
    oshaRefs: ["OSHA 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations"],
    applicableWhen: [
      "Selected tasks involve equipment movement, deliveries, haul routes, material staging, or work around mobile equipment.",
    ],
    responsibilities: [
      "Supervision shall define equipment routes, exclusion zones, and spotter expectations before the shift starts.",
      "Workers shall stay clear of moving equipment unless directly involved in the operation.",
    ],
    controls: [
      "Use spotters where visibility is restricted or site rules require them.",
      "Maintain equipment routes, swing radiuses, and exclusion zones.",
      "Wear high-visibility garments where equipment traffic is present.",
      "Do not position personnel between fixed objects and moving equipment.",
    ],
    training: [
      "Workers shall be trained on blind-spot awareness, site traffic rules, and spotter communication.",
    ],
  },
  {
    category: "hazard",
    item: "Ladder misuse",
    title: "Ladder Use Controls",
    summary: LADDER_USE_PROGRAM_SUMMARY,
    oshaRefs: ["OSHA 1926 Subpart X - Stairways and Ladders"],
    applicableWhen: [...LADDER_USE_APPLICABLE_WHEN],
    responsibilities: [...LADDER_USE_RESPONSIBILITIES],
    controls: [...LADDER_USE_CONTROLS],
    training: [...LADDER_USE_TRAINING],
    compactLayout: true,
  },
  {
    category: "hazard",
    item: "Confined spaces",
    title: "Confined Space Entry Program",
    summary: "This program establishes controls for limited-entry spaces requiring atmospheric review, role assignment, and entry coordination.",
    oshaRefs: ["OSHA 1926 Subpart AA - Confined Spaces in Construction"],
    applicableWhen: [
      "Selected work includes entry into spaces with limited access or egress.",
      "The selected task list includes vaults, manholes, tanks, or similar enclosed spaces.",
    ],
    responsibilities: [
      "Supervision shall classify the entry, verify acceptable entry conditions, and brief entrants and attendants before work starts.",
      "Workers shall not enter until monitoring, communication, and rescue expectations are confirmed.",
    ],
    controls: [
      "Identify the confined space before work begins.",
      "Perform atmospheric testing as required.",
      "Establish communication and rescue procedures before entry.",
      "Prevent unauthorized entry and reevaluate conditions when the work or atmosphere changes.",
    ],
    training: [
      "Entrants, attendants, and entry supervisors shall be trained on their role-specific responsibilities.",
    ],
    subtypeGroup: "confined_space_classification",
    subtypeVariants: {
      permit_required: {
        title: "Permit-Required Confined Space Entry Program",
        summary: "This program applies when confined-space entry requires a permit process, designated entry roles, atmospheric review, and rescue readiness.",
        applicableWhen: [
          "The selected confined-space work meets permit-required entry criteria.",
          "Entry hazards require documented authorization, attendant coverage, and rescue planning.",
        ],
        controls: [
          "Complete the permit-required confined-space authorization before entry.",
          "Verify continuous or interval atmospheric monitoring as required by the entry conditions.",
          "Maintain an attendant outside the entry space for the full duration of the entry.",
          "Confirm rescue equipment, emergency contacts, and retrieval expectations before entry.",
        ],
      },
      non_permit: {
        title: "Non-Permit Confined Space Entry Program",
        summary: "This program applies when confined-space entry is allowed under non-permit conditions but still requires identification, review, and controlled entry practices.",
        applicableWhen: [
          "The selected confined-space work is classified as non-permit entry.",
          "The space must still be identified, reviewed, and protected against changing conditions.",
        ],
        controls: [
          "Document the non-permit classification before entry begins.",
          "Verify the space remains free of permit-required hazards during the work.",
          "Maintain controlled access, communication, and reevaluation if conditions change.",
          "Stop work and reclassify the entry if hazards escalate or atmospheric concerns develop.",
        ],
      },
    },
  },
  {
    category: "hazard",
    item: "Chemical exposure",
    title: "Hazard Communication and Chemical Safety Program",
    summary: "This program establishes minimum requirements for chemical review, SDS access, labeling, handling, storage, and worker protection.",
    oshaRefs: ["OSHA 1926.59 - Hazard Communication"],
    applicableWhen: [
      "Selected work involves coatings, solvents, sealants, adhesives, or other hazardous chemicals.",
    ],
    responsibilities: [
      "Supervision shall verify SDS access, labeling, and storage controls before chemical use begins.",
      "Workers shall review chemical hazards before use and report spills or uncontrolled exposure immediately.",
    ],
    controls: [
      "Maintain Safety Data Sheets for products used on site.",
      "Label containers properly and segregate incompatible materials.",
      "Use required PPE and ventilation or containment controls.",
      "Maintain spill-response materials when required by the chemical scope.",
    ],
    training: [
      "Workers shall be trained on SDS review, labeling, PPE, and spill-response expectations.",
    ],
  },
  {
    category: "hazard",
    item: "Silica / dust exposure",
    title: "Silica and Dust Exposure Control Program",
    summary: "This program establishes controls for tasks that generate respirable dust, silica-containing debris, or airborne particulates during cutting, grinding, chipping, or surface preparation.",
    oshaRefs: ["OSHA 1926.1153 - Respirable Crystalline Silica", "OSHA 1926 Subpart D - Occupational Health and Environmental Controls"],
    applicableWhen: [
      "Selected work includes grinding, chipping, saw cutting, mortar work, grout handling, or abrasive surface preparation.",
      "Task execution creates visible dust, fine airborne particulate, or potential silica exposure.",
    ],
    responsibilities: [
      "Supervision shall verify dust-control methods, tool configuration, and respiratory requirements before dusty work begins.",
      "Workers shall stop dust-generating work when controls are missing, inoperable, or no longer effective.",
    ],
    controls: [
      "Use engineering controls such as wet methods or vacuum-equipped tools when dust is generated.",
      "Maintain housekeeping methods that avoid uncontrolled airborne dust.",
      "Use required respiratory and eye/face protection based on task exposure.",
      "Control adjacent access when dust migration creates exposure to other crews.",
    ],
    training: [
      "Workers shall be trained on silica and dust hazard recognition, control setup, and respiratory protection expectations.",
    ],
  },
  {
    category: "hazard",
    item: "Pressure / line break",
    title: "Pressure System and Line-Break Safety Program",
    summary: "This program establishes controls for pressurized systems, hydro/pressure testing, flushing, tie-ins, startup, and any task where stored pressure may be released.",
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions", "OSHA 1926 Subpart K - Electrical"],
    applicableWhen: [
      "Selected work includes pressure testing, flushing, startup, tie-ins, valve work, or line-break activities.",
      "The scope includes energized or pressurized systems that can release stored energy.",
    ],
    responsibilities: [
      "Supervision shall verify isolation points, release boundaries, and communication plans before pressurized work starts.",
      "Workers shall not perform line-break or pressure activities until isolation and release controls are confirmed.",
    ],
    controls: [
      "Verify isolation and lockout/tagout where required before opening or servicing systems.",
      "Use controlled release methods and keep personnel clear of potential release paths.",
      "Establish communication and exclusion boundaries during testing, flushing, and startup.",
      `${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} Stop work and reassess when pressure behavior, equipment condition, or scope changes unexpectedly. ${CSEP_RESTART_AFTER_VERIFICATION}`,
    ],
    training: [
      "Workers shall be trained on pressure hazards, controlled release methods, and line-break stop-work triggers.",
    ],
  },
  {
    category: "hazard",
    item: "Falling objects",
    title: "Falling Object and Overhead Work Safety Program",
    summary: "This program establishes controls to protect workers from falling tools, materials, debris, and overhead work activities, including controlled access where the work creates a fixed boundary (CAZ) below steel or similar scope.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work creates overhead exposure to crews below.",
    ],
    responsibilities: [
      "Supervision shall maintain drop-zone and controlled-access (CAZ) limits and protect adjacent workers before overhead work starts.",
      "Workers shall not enter suspended-load or overhead work zones unless authorized and protected.",
    ],
    controls: [
      "Use toe boards, debris nets, tool lanyards, or overhead protection where needed.",
      "Where a controlled access zone (CAZ) applies, establish and mark it with barricades, signage, or lines together with the drop or exclusion area; do not treat a drop zone as the only control when the work requires a CAZ for steel erection, decking, or access below.",
      "Barricade and maintain exclusion zones below overhead work; stop work if unauthorized workers enter a posted CAZ or uncontrolled line-of-fire path.",
      "Secure materials against displacement at edges and elevated work surfaces.",
      "Review dropped-object and CAZ / communication expectations during pre-task planning.",
    ],
    training: [
      `Workers shall be trained on overhead hazard recognition, CAZ and exclusion-zone rules, authorized entry, ${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} ${CSEP_RESTART_AFTER_VERIFICATION}`,
    ],
  },
  {
    category: "hazard",
    item: "Crane lift hazards",
    title: "Crane, Rigging, and Lift Safety Program",
    summary: "This program defines controls for crane activity, rigging, lifting operations, material picks, and suspended-load exposure.",
    oshaRefs: ["OSHA 1926 Subpart CC - Cranes and Derricks in Construction"],
    applicableWhen: [
      "Selected work includes crane activity, rigging, telehandler picks, or suspended-load exposure.",
    ],
    responsibilities: [
      "Supervision shall verify lift planning, crane setup, ground conditions, and communication methods before lifting begins.",
      "Only trained and authorized personnel shall rig loads or direct crane activity.",
    ],
    controls: [
      "Use lift plans when required by site rules or lift complexity.",
      "Inspect rigging before use.",
      "Keep workers clear of suspended loads and load paths.",
      "Use tag lines and exclusion zones where appropriate.",
    ],
    training: [
      "Workers shall be trained on rigging inspection, signaling, and suspended-load exclusion.",
    ],
  },
  {
    category: "hazard",
    item: "Excavation collapse",
    title: "Excavation and Trenching Safety Program",
    summary: "This program provides minimum controls for trenching, excavation support activities, underground utility work, and changing soil conditions.",
    oshaRefs: ["OSHA 1926 Subpart P - Excavations"],
    applicableWhen: [
      "Selected work includes excavation, trenching, shoring, utility installation, or other below-grade scope.",
    ],
    responsibilities: [
      "A competent person shall inspect excavations and protective systems as required.",
      "Supervision shall coordinate utility locate, access/egress, and spoil-pile control before work begins.",
    ],
    controls: [
      "Use protective systems where required by depth, soil, and field conditions.",
      "Keep spoil piles and materials back from the excavation edge.",
      "Maintain safe access and egress.",
      "Address utilities, water accumulation, surcharge loading, and changing ground conditions before work continues.",
    ],
    training: [
      "Workers shall be trained on trench hazards, protective systems, and competent-person requirements.",
    ],
  },
  {
    category: "hazard",
    item: "Slips trips falls",
    title: "Housekeeping and Slip, Trip, Fall Prevention Program",
    summary: "This program establishes housekeeping expectations to reduce same-level fall hazards, blocked access, and material clutter.",
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
    applicableWhen: [
      "Selected work or site conditions create walk-surface, housekeeping, or access-route exposure.",
    ],
    responsibilities: [
      "Supervision shall set housekeeping expectations and verify access routes remain clear during the shift.",
      "Workers shall report and correct slip, trip, and housekeeping hazards immediately.",
    ],
    controls: [
      "Keep walkways, access points, and work areas clear.",
      "Manage cords, hoses, and materials to prevent trip hazards.",
      "Address wet, muddy, icy, or uneven surfaces promptly.",
      "Maintain adequate lighting for safe travel and work.",
    ],
    training: [
      "Workers shall be trained on housekeeping expectations and same-level fall prevention.",
    ],
  },
  {
    category: "permit",
    item: "Ground Disturbance Permit",
    title: "Ground Disturbance Permit Program",
    summary: "This program establishes authorization and control requirements before earth disturbance, below-grade work, or utility-adjacent excavation begins.",
    oshaRefs: ["OSHA 1926 Subpart P - Excavations"],
    applicableWhen: [
      "Selected work disturbs soil, trench lines, excavation boundaries, or utility-adjacent ground conditions.",
      "Earth-disturbance activities require documented authorization before work begins.",
    ],
    responsibilities: [
      "Supervision shall confirm utility locate status, disturbance limits, and approved controls before authorizing work.",
    ],
    controls: [
      "Obtain ground-disturbance authorization before excavation, trenching, or utility-adjacent digging starts.",
      "Verify utility locate, clearance, and tolerance-zone requirements before disturbance.",
      "Stop work when unknown utilities, unstable conditions, or permit scope changes are encountered.",
    ],
    training: [
      "Workers shall be trained on ground-disturbance authorization, locate verification, and stop-work expectations.",
    ],
  },
  {
    category: "permit",
    item: "Hot Work Permit",
    title: "Hot Work Permit Program",
    summary: "This program defines the permit controls, authorization steps, and field verifications required before hot work begins.",
    oshaRefs: ["OSHA 1926 Subpart J - Fire Protection and Prevention"],
    applicableWhen: [
      "Selected work requires a hot-work permit because sparks, flame, or ignition sources are present.",
    ],
    responsibilities: [
      "Supervision shall verify the permit is complete, posted, and coordinated with fire-watch expectations.",
    ],
    controls: [
      "Obtain the hot-work permit before starting work.",
      "Verify combustibles control, extinguisher access, and fire-watch readiness.",
      "Stop work when permit conditions change or expire.",
    ],
    training: [
      "Workers shall be trained on hot-work permit expectations and fire-watch duties.",
    ],
  },
  {
    category: "permit",
    item: "Crane Permit",
    title: "Crane Permit Program",
    summary: "This program establishes the site-issued authorization required before a crane is set up, repositioned, or operated on the project.",
    oshaRefs: ["OSHA 1926 Subpart CC - Cranes and Derricks in Construction"],
    applicableWhen: [
      "Selected work uses a mobile, tower, or assist crane and the project or owner requires a site crane permit before setup or operation.",
    ],
    responsibilities: [
      "Supervision shall obtain the crane permit, confirm operator qualification, and coordinate setup location, swing radius, and surrounding work before operations begin.",
    ],
    controls: [
      "Secure the crane permit before the crane is positioned, rigged, or used for any pick.",
      "Confirm ground conditions, outrigger pads, swing radius, overhead clearances, and exclusion zones against the permit.",
      "Stop operations and re-permit when the crane is relocated, reconfigured, or conditions change beyond the permit terms.",
    ],
    training: [
      "Operators, riggers, and signal persons shall be trained on crane-permit expectations and site-specific setup rules.",
    ],
  },
  {
    category: "permit",
    item: "Pick Plan",
    title: "Pick Plan Program",
    summary: "This program establishes the written pick-plan controls for individual lifts, including rigging, load path, communications, and hold points.",
    oshaRefs: ["OSHA 1926 Subpart CC - Cranes and Derricks in Construction"],
    applicableWhen: [
      "Selected work includes lifts that require a written pick plan under the crane permit, critical-lift rules, or site terminology.",
    ],
    responsibilities: [
      "Supervision shall verify the pick plan is prepared, reviewed, and signed before the lift, and confirm the qualified rigger, signal person, and operator are assigned.",
    ],
    controls: [
      "Complete the pick plan before the lift and keep it at the crane and on the work deck.",
      "Control the load path and landing area so no employee works, stands, or travels beneath a suspended load.",
      "Pause and re-review the pick plan when load weight, radius, rigging, wind, or surrounding work changes.",
    ],
    training: [
      "Riggers, signal persons, and the lift crew shall be trained on pick-plan content and communication expectations.",
    ],
  },
  {
    category: "permit",
    item: "Elevated Work Notice",
    title: "Elevated Work Notice Program",
    summary: "This program establishes the notice and authorization expectations for work performed at height where the site requires a heads-up to affected trades and supervision.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work is performed at height and site rules require an elevated-work notice or equivalent heads-up to the controlling contractor.",
    ],
    responsibilities: [
      "Supervision shall issue the elevated-work notice, coordinate affected trades, and verify barricades, drop-zone controls, and fall protection before crews go up.",
    ],
    controls: [
      "Submit the elevated-work notice before elevated work begins and keep it current as the work face moves.",
      "Maintain drop-zone barricades, overhead protection, and access controls below the work.",
      "Stop elevated work when the notice lapses, the drop zone is compromised, or fall protection cannot be maintained.",
    ],
    training: [
      "Workers shall be trained on elevated-work notice expectations, fall protection, and drop-zone coordination.",
    ],
  },
  {
    category: "permit",
    item: "Confined Space Permit",
    title: "Confined Space Permit Program",
    summary: "This program defines the permit documentation, role assignments, atmospheric review, and rescue readiness required for confined-space entry.",
    oshaRefs: ["OSHA 1926 Subpart AA - Confined Spaces in Construction"],
    applicableWhen: [
      "Selected work requires a confined-space entry permit.",
    ],
    responsibilities: [
      "Supervision shall verify the permit, entry conditions, monitoring, and rescue readiness before authorizing entry.",
    ],
    controls: [
      "Complete the confined-space permit before entry begins.",
      "Document entrant, attendant, and supervisor assignments.",
      "Verify monitoring, communication, and rescue requirements before entry.",
    ],
    training: [
      "Entrants, attendants, and supervisors shall be trained on permit-entry duties.",
    ],
    subtypeGroup: "confined_space_classification",
    subtypeVariants: {
      permit_required: {
        title: "Permit-Required Confined Space Permit Program",
        summary: "This program applies when a permit-required confined-space entry permit is needed for the selected work.",
      },
      non_permit: {
        title: "Non-Permit Confined Space Entry Review Program",
        summary: "This program applies when the selected confined-space work is reviewed as non-permit entry but still requires documented classification and field controls.",
        applicableWhen: [
          "Selected confined-space work is classified as non-permit entry.",
        ],
        controls: [
          "Document the non-permit classification before entry begins.",
          "Verify conditions remain consistent with the non-permit classification.",
          "Escalate to permit-required entry if hazards change or increase.",
        ],
      },
    },
  },
  {
    category: "permit",
    item: "LOTO Permit",
    title: "Lockout / Tagout Program",
    summary: "This program establishes the isolation, verification, and coordination steps required before servicing or working around hazardous energy sources.",
    oshaRefs: ["OSHA 1926 Subpart K - Electrical"],
    applicableWhen: [
      "Selected work requires energy isolation before servicing, testing, or tie-in activities.",
    ],
    responsibilities: [
      "Supervision shall confirm isolation points, affected parties, and verification steps before work begins.",
    ],
    controls: [
      "Identify all hazardous energy sources before work starts.",
      "Apply lockout/tagout devices and verify zero-energy state before servicing.",
      "Control restart and re-energization through documented release steps.",
    ],
    training: [
      "Workers shall be trained on hazardous-energy recognition and lockout/tagout verification.",
    ],
  },
  {
    category: "permit",
    item: "Ladder Permit",
    title: "Ladder Use Controls",
    summary: LADDER_USE_PROGRAM_SUMMARY,
    oshaRefs: ["OSHA 1926 Subpart X - Stairways and Ladders"],
    applicableWhen: [
      "The project requires a signed ladder permit, GC tag, or pre-use authorization in addition to field rules for a given area or work package.",
    ],
    responsibilities: [...LADDER_USE_RESPONSIBILITIES],
    controls: [...LADDER_USE_CONTROLS],
    training: [...LADDER_USE_TRAINING],
    compactLayout: true,
  },
  {
    category: "permit",
    item: "AWP/MEWP Permit",
    title: "Aerial Work Platform / MEWP Program",
    summary: "This program establishes authorization, inspection, and operating controls for MEWPs and other aerial work platforms.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work uses an aerial work platform or MEWP for access or task execution.",
    ],
    responsibilities: [
      "Supervision shall verify operator authorization, equipment inspection, and travel path review before use.",
    ],
    controls: [
      "Inspect the lift before use.",
      "Use approved fall protection when required by the equipment or site rules.",
      "Control travel paths, overhead clearance, and exclusion zones while operating the lift.",
    ],
    training: [
      "Operators shall be trained and authorized for the specific lift type in use.",
    ],
  },
  {
    category: "permit",
    item: "Trench Inspection Permit",
    title: "Trench Inspection and Entry Program",
    summary: "This program establishes the inspection, authorization, and reinspection controls required before crews enter trench or excavation work areas.",
    oshaRefs: ["OSHA 1926 Subpart P - Excavations"],
    applicableWhen: [
      "Selected work requires trench or excavation inspection documentation before entry.",
    ],
    responsibilities: [
      "The competent person shall document inspections. Any worker shall stop work when conditions change; the competent person or assigned supervisor verifies and releases the work for restart per site rules.",
    ],
    controls: [
      "Inspect the excavation before each shift and after conditions change.",
      "Verify protective systems, access/egress, and spoil-pile controls before entry.",
      "Do not allow entry when inspections are incomplete or conditions are unsafe.",
    ],
    training: [
      "Workers shall be trained on excavation-entry limits and competent-person expectations.",
    ],
  },
  {
    category: "permit",
    item: "Chemical Permit",
    title: "Chemical Use Authorization Program",
    summary: "This program establishes authorization, review, and field controls when selected work uses chemicals requiring site approval.",
    oshaRefs: ["OSHA 1926.59 - Hazard Communication"],
    applicableWhen: [
      "Selected work includes chemical products that require project review or approval before use.",
    ],
    responsibilities: [
      "Supervision shall confirm SDS review, storage planning, and approval requirements before products are brought on site.",
    ],
    controls: [
      "Review the product SDS and labeling before use.",
      "Confirm required PPE, ventilation, and spill-response materials are in place.",
      "Do not use unapproved chemical products on site.",
    ],
    training: [
      "Workers shall be trained on approved chemical-use procedures and emergency response expectations.",
    ],
  },
  {
    category: "permit",
    item: "Motion Permit",
    title: "Equipment Motion and Traffic Control Program",
    summary: "This program establishes movement authorization and traffic-control expectations for cranes, equipment, forklifts, and delivery routes.",
    oshaRefs: ["OSHA 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations"],
    applicableWhen: [
      "Selected work requires controlled equipment movement, traffic routing, or material-transport authorization.",
    ],
    responsibilities: [
      "Supervision shall coordinate haul routes, spotters, and exclusion zones before movement begins.",
    ],
    controls: [
      "Review travel paths, blind spots, and exclusion zones before equipment moves.",
      "Use spotters or traffic control where required.",
      "Pause movement when routes are blocked or personnel enter the controlled area.",
    ],
    training: [
      "Workers shall be trained on traffic-control expectations and spotter communication.",
    ],
  },
  {
    category: "permit",
    item: "Temperature Permit",
    title: "Temperature Exposure Program",
    summary: "This program establishes planning and field controls for selected work performed under heat, cold, or temperature-sensitive permit conditions.",
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
    applicableWhen: [
      "Selected work is controlled by temperature-related site restrictions or permit requirements.",
    ],
    responsibilities: [
      "Supervision shall adjust work practices when temperature conditions increase worker exposure.",
    ],
    controls: [
      "Review temperature restrictions before work starts.",
      "Plan hydration, warm-up, cooldown, and rest-break expectations for the shift.",
      "Stop work when conditions exceed the approved permit or site limits.",
    ],
    training: [
      "Workers shall be trained on recognizing heat- and cold-stress exposure signs.",
    ],
  },
  {
    category: "permit",
    item: "Gravity Permit",
    title: "Overhead and Gravity Hazard Program",
    summary: "This program establishes controls for gravity-driven exposure such as dropped materials, edge exposure, and protected access below work areas, including CAZ (controlled access zone) use where the site or scope requires a clear boundary, not just a generic drop zone.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work creates overhead or gravity-driven exposure to people below or adjacent to the work area.",
    ],
    responsibilities: [
      `Supervision shall define drop zones, barricades, CAZ or exclusion limits, and protected access before overhead work begins. ${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} ${CSEP_RESTART_AFTER_VERIFICATION}`,
    ],
    controls: [
      "Maintain barricades, overhead protection, and signed exclusion limits; where a CAZ is required, align it with the same communication used for the drop or fall path so unauthorized ironworkers, laborers, and other trades stay out.",
      "Post and enforce the CAZ with barricades, warning line, or signage; coordinate re-briefs when overhead work, picks, or swing activity change.",
      "Secure tools, materials, and debris from displacement.",
      "Coordinate adjacent access so workers do not pass below uncontrolled overhead work or an inactive CAZ line.",
    ],
    training: [
      "Workers shall be trained on drop zone and CAZ discipline, and on overhead hazard and boundary communication.",
    ],
  },
  {
    category: "ppe",
    item: "Hard Hat",
    title: "Head Protection Program",
    summary: "This program establishes minimum requirements for head protection in areas with overhead work, falling-object exposure, or impact hazards.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: ["Selected work or site rules require head protection."],
    responsibilities: [
      "Supervision shall verify approved head protection is worn in designated work areas.",
    ],
    controls: [
      "Wear head protection that is in serviceable condition and appropriate for the hazard.",
      "Remove damaged or modified hard hats from service.",
      "Keep head protection on whenever overhead or impact exposure exists.",
    ],
    training: [
      "Workers shall be trained on inspection, fit, and use limits for head protection.",
    ],
  },
  {
    category: "ppe",
    item: "Safety Glasses",
    title: "Eye Protection Program",
    summary: "This program establishes minimum requirements for eye protection during work with flying particles, dust, splash, or impact exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work exposes crews to dust, debris, impact, splash, or other eye hazards.",
    ],
    responsibilities: [
      "Supervision shall verify eye protection is appropriate for the task and condition of the work area.",
    ],
    controls: [
      "Wear approved eye protection whenever eye hazards are present.",
      "Keep lenses clean and replace damaged eye protection immediately.",
      "Upgrade to face-shield or specialty protection when the task creates additional exposure.",
    ],
    training: [
      "Workers shall be trained on eye-hazard recognition and PPE selection for the task.",
    ],
  },
  {
    category: "ppe",
    item: "High Visibility Vest",
    title: "High-Visibility Apparel Program",
    summary: "This program establishes minimum requirements for high-visibility garments in areas with equipment traffic, deliveries, or vehicle exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work occurs around moving equipment, haul routes, or active traffic interfaces.",
    ],
    responsibilities: [
      "Supervision shall verify high-visibility apparel is worn in traffic-exposed work areas.",
    ],
    controls: [
      "Wear high-visibility garments that remain visible, clean, and in good condition.",
      "Replace garments that no longer provide effective visibility.",
      "Do not enter active traffic or equipment zones without the required visibility controls.",
    ],
    training: [
      "Workers shall be trained on site traffic-control expectations and high-visibility requirements.",
    ],
  },
  {
    category: "ppe",
    item: "Gloves",
    title: "Hand Protection Program",
    summary: "This program establishes minimum requirements for hand protection during material handling, tool use, and contact with sharp, rough, or hazardous surfaces.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work creates cut, abrasion, pinch-point, chemical, or handling exposure to the hands.",
    ],
    responsibilities: [
      "Supervision shall verify glove selection is appropriate for the hazard and task.",
    ],
    controls: [
      "Use glove types appropriate to the work being performed.",
      "Replace gloves that are damaged, saturated, or no longer protective.",
      "Do not rely on gloves where entanglement or rotating-equipment exposure makes them unsafe.",
    ],
    training: [
      "Workers shall be trained on glove selection and limitations for the selected task.",
    ],
  },
  {
    category: "ppe",
    item: "Steel Toe Boots",
    title: "Foot Protection Program",
    summary: "This program establishes minimum requirements for foot protection where impact, puncture, or material-handling exposure exists.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work includes material handling, equipment movement, uneven terrain, or puncture exposure.",
    ],
    responsibilities: [
      "Supervision shall verify workers wear approved protective footwear in designated work areas.",
    ],
    controls: [
      "Wear protective footwear appropriate for the work conditions.",
      "Keep soles, uppers, and toe protection in serviceable condition.",
      "Use slip-resistant or specialty footwear when site conditions require it.",
    ],
    training: [
      "Workers shall be trained on footwear expectations and condition checks.",
    ],
  },
  {
    category: "ppe",
    item: "Hearing Protection",
    title: "Hearing Conservation Program",
    summary: "This program establishes minimum requirements for hearing protection where selected work creates elevated noise exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work includes equipment, cutting, grinding, demolition, or other high-noise activity.",
    ],
    responsibilities: [
      "Supervision shall verify hearing protection is available and worn where noise exposure requires it.",
    ],
    controls: [
      "Wear hearing protection in designated high-noise areas.",
      "Inspect and replace disposable or damaged hearing protection as needed.",
      "Use task planning and equipment controls to reduce exposure duration where possible.",
    ],
    training: [
      "Workers shall be trained on noise exposure signs and proper hearing protection use.",
    ],
  },
  {
    category: "ppe",
    item: "Face Shield",
    title: "Face Protection Program",
    summary: "This program establishes minimum requirements for face protection when selected work creates splash, spark, arc, or flying-particle exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work creates additional face exposure beyond standard eye protection.",
    ],
    responsibilities: [
      "Supervision shall verify face protection is used with the correct supporting PPE for the task.",
    ],
    controls: [
      "Use face shields together with required eye protection when the task creates face exposure.",
      "Inspect shields before use and replace damaged equipment.",
      "Select face protection appropriate to the heat, chemical, or impact hazard.",
    ],
    training: [
      "Workers shall be trained on the tasks that require face protection and its limitations.",
    ],
  },
  {
    category: "ppe",
    item: "Respiratory Protection",
    title: "Respiratory Protection Program",
    summary: "This program establishes minimum requirements for respiratory protection when selected work creates dust, fume, vapor, or airborne contaminant exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work includes airborne contaminant exposure requiring respiratory protection.",
    ],
    responsibilities: [
      "Supervision shall verify respiratory protection requirements, fit expectations, and cartridge or filter selection before work begins.",
    ],
    controls: [
      "Use the respirator type specified for the selected exposure.",
      "Inspect respirators before use and replace damaged equipment, cartridges, or filters as required.",
      "Do not perform respiratory-protected work when fit, seal, or equipment condition is not acceptable.",
    ],
    training: [
      "Workers shall be trained on respirator selection, inspection, fit, and task-specific limitations.",
    ],
  },
  {
    category: "ppe",
    item: "Fall Protection Harness",
    title: "Personal Fall Arrest Equipment Program",
    summary: "This program establishes minimum requirements for harnesses, lanyards, SRLs, anchors, and personal fall arrest equipment.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: ["Selected work requires personal fall arrest equipment."],
    responsibilities: [
      "Supervision shall verify compatible anchor points and arrest equipment are identified before elevated work begins.",
    ],
    controls: [
      "Inspect harnesses, lanyards, SRLs, and connectors before each use.",
      "Use only approved anchorages and compatible components.",
      "Remove damaged or deployed arrest equipment from service immediately.",
    ],
    training: [
      "Workers shall be trained on inspection, fitting, anchorage selection, and equipment limits.",
    ],
  },
];

export const DEFAULT_PROGRAM_DEFINITIONS: CSEPProgramDefinition[] = BASE_PROGRAM_DEFINITIONS.map(
  (definition) =>
    applyProcedureFields(definition, definition.category === "hazard"
      ? HAZARD_PROCEDURE_CONTENT[definition.item]
      : undefined
    )
).map((definition) => ({
  ...definition,
  subtypeVariants: definition.subtypeVariants
    ? Object.fromEntries(
        Object.entries(definition.subtypeVariants).map(([key, value]) => [
          key,
          value
            ? applyProcedureFields(
                value,
                definition.category === "hazard" && definition.item === "Confined spaces"
                  ? CONFINED_SPACE_SUBTYPE_PROCEDURE_CONTENT[key as CSEPProgramSubtypeValue]
                  : undefined
              )
            : value,
        ])
      ) as CSEPProgramDefinition["subtypeVariants"]
    : undefined,
}));

const PROGRAM_DEFINITIONS = DEFAULT_PROGRAM_DEFINITIONS;

export function getProgramDefinitionKey(input: Pick<CSEPProgramDefinition, "category" | "item">) {
  return `${input.category}::${input.item}`;
}

export function getDefaultProgramDefinitions() {
  return PROGRAM_DEFINITIONS.map(cloneProgramDefinition);
}

export function normalizeCsepProgramConfig(input: unknown): CSEPProgramConfig {
  const rawDefinitions = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { definitions?: unknown }).definitions)
      ? (input as { definitions: unknown[] }).definitions
      : [];

  const overridesByKey = new Map<string, unknown>();

  for (const item of rawDefinitions) {
    if (!item || typeof item !== "object") continue;
    const category = typeof (item as { category?: unknown }).category === "string"
      ? ((item as { category: string }).category as CSEPProgramCategory)
      : null;
    const programItem =
      typeof (item as { item?: unknown }).item === "string"
        ? (item as { item: string }).item.trim()
        : "";
    if (!category || !programItem) continue;
    overridesByKey.set(getProgramDefinitionKey({ category, item: programItem }), item);
  }

  return {
    definitions: PROGRAM_DEFINITIONS.map((fallback) => {
      const override =
        overridesByKey.get(getProgramDefinitionKey(fallback)) as
          | (Partial<CSEPProgramDefinition> & Record<string, unknown>)
          | undefined;

      return {
        category: fallback.category,
        item: fallback.item,
        title: normalizeText(override?.title, fallback.title),
        summary: normalizeText(override?.summary, fallback.summary),
        oshaRefs: normalizeTextList(override?.oshaRefs, fallback.oshaRefs),
        applicableWhen: normalizeTextList(override?.applicableWhen, fallback.applicableWhen),
        responsibilities: normalizeTextList(
          override?.responsibilities,
          fallback.responsibilities
        ),
        preTaskProcedures: normalizeTextList(
          override?.preTaskProcedures,
          fallback.preTaskProcedures
        ),
        workProcedures: normalizeTextList(override?.workProcedures, fallback.workProcedures),
        stopWorkProcedures: normalizeTextList(
          override?.stopWorkProcedures,
          fallback.stopWorkProcedures
        ),
        closeoutProcedures: normalizeTextList(
          override?.closeoutProcedures,
          fallback.closeoutProcedures
        ),
        controls: normalizeTextList(override?.controls, fallback.controls),
        training: normalizeTextList(override?.training, fallback.training),
        ...(fallback.subtypeGroup ? { subtypeGroup: fallback.subtypeGroup } : {}),
        ...(fallback.subtypeVariants
          ? {
              subtypeVariants: normalizeSubtypeVariants(
                override?.subtypeVariants,
                fallback.subtypeVariants
              ),
            }
          : {}),
        ...(typeof override?.compactLayout === "boolean"
          ? { compactLayout: override.compactLayout }
          : fallback.compactLayout
          ? { compactLayout: true }
          : {}),
      };
    }),
  };
}

function fallbackDefinition(category: CSEPProgramCategory, item: string): ProgramDefinition {
  if (category === "permit") {
    return {
      category,
      item,
      title: `${item} Program`,
      summary: `This program establishes the minimum authorization, review, and field controls required for ${item.toLowerCase()}.`,
      oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
      applicableWhen: [`Selected work requires ${item.toLowerCase()}.`],
      responsibilities: [
        "Supervision shall review the permit expectations and verify required approvals before work begins.",
      ],
      preTaskProcedures: [],
      workProcedures: [],
      stopWorkProcedures: [],
      closeoutProcedures: [],
      controls: [
        "Obtain the required permit or authorization before work starts.",
        "Verify field conditions remain consistent with the permit requirements.",
        "Stop work when permit conditions change or cannot be maintained.",
      ],
      training: [
        "Workers shall be trained on permit expectations and stop-work triggers tied to the selected scope.",
      ],
    };
  }

  if (category === "ppe") {
    return {
      category,
      item,
      title: `${item} Protection Program`,
      summary: `This program establishes minimum use, inspection, and maintenance requirements for ${item.toLowerCase()}.`,
      oshaRefs: ["OSHA 1926 Subpart E - PPE"],
      applicableWhen: [`Selected work requires ${item.toLowerCase()}.`],
      responsibilities: [
        "Supervision shall verify the selected PPE is available, appropriate, and worn as required.",
      ],
      preTaskProcedures: [],
      workProcedures: [],
      stopWorkProcedures: [],
      closeoutProcedures: [],
      controls: [
        "Inspect PPE before use and replace damaged equipment immediately.",
        "Use PPE appropriate for the selected task and exposure.",
        "Stop work when required PPE is missing or no longer effective.",
      ],
      training: [
        "Workers shall be trained on PPE selection, inspection, use, and limitations.",
      ],
    };
  }

  return {
    category,
    item,
    title: `${item} Safety Program`,
    summary: `This program establishes minimum controls for ${item.toLowerCase()} exposure during the selected work.`,
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
    applicableWhen: [`Selected work creates ${item.toLowerCase()} exposure.`],
    responsibilities: [
      "Supervision shall review the hazard exposure and verify controls before work begins.",
    ],
    preTaskProcedures: [
      "Review the task scope, work area, and required hazard controls before starting the exposure.",
    ],
    workProcedures: [
      "Carry out the work using the planned control measures and keep affected workers informed as conditions change.",
    ],
    stopWorkProcedures: [
      "Stop work when the exposure changes or the planned controls are not effective.",
    ],
    closeoutProcedures: [
      "Leave the work area in a stable condition and report unresolved exposure concerns before turnover.",
    ],
    controls: [
      "Review the exposure during pre-task planning.",
      "Maintain required controls throughout the task.",
      "Stop work when conditions change or controls are not effective.",
    ],
    training: [
      "Workers shall be trained on hazard recognition and response expectations for the selected exposure.",
    ],
  };
}

function findDefinition(
  category: CSEPProgramCategory,
  item: string,
  definitions: CSEPProgramDefinition[] = PROGRAM_DEFINITIONS
) {
  return definitions.find((definition) => definition.category === category && definition.item === item);
}

function resolveDefinition(
  selection: CSEPProgramSelection,
  definitions: CSEPProgramDefinition[] = PROGRAM_DEFINITIONS
): ProgramDefinition {
  const base =
    findDefinition(selection.category, selection.item, definitions) ??
    fallbackDefinition(selection.category, selection.item);
  const subtypeVariant =
    selection.subtype && base.subtypeVariants ? base.subtypeVariants[selection.subtype] : null;

  return {
    ...base,
    ...(subtypeVariant ?? {}),
    oshaRefs: dedupe(subtypeVariant?.oshaRefs ?? base.oshaRefs),
    applicableWhen: dedupe(subtypeVariant?.applicableWhen ?? base.applicableWhen),
    responsibilities: dedupe(subtypeVariant?.responsibilities ?? base.responsibilities),
    preTaskProcedures: dedupe(subtypeVariant?.preTaskProcedures ?? base.preTaskProcedures),
    workProcedures: dedupe(subtypeVariant?.workProcedures ?? base.workProcedures),
    stopWorkProcedures: dedupe(
      subtypeVariant?.stopWorkProcedures ?? base.stopWorkProcedures
    ),
    closeoutProcedures: dedupe(
      subtypeVariant?.closeoutProcedures ?? base.closeoutProcedures
    ),
    controls: dedupe(subtypeVariant?.controls ?? base.controls),
    training: dedupe(subtypeVariant?.training ?? base.training),
  };
}

export function getProgramSelectionKey(
  category: CSEPProgramCategory,
  item: string,
  subtype?: CSEPProgramSubtypeValue | null
) {
  return [category, item, subtype ?? "base"].map(slugify).join("__");
}

export function getSubtypeConfig(group: CSEPProgramSubtypeGroup) {
  return SUBTYPE_CONFIGS[group];
}

export function getProgramSubtypeGroup(
  category: CSEPProgramCategory,
  item: string
): CSEPProgramSubtypeGroup | null {
  return findDefinition(category, item)?.subtypeGroup ?? null;
}

export function getRequiredProgramSubtypeGroups(items: Array<Pick<CSEPProgramSelection, "category" | "item">>) {
  const groups = new Set<CSEPProgramSubtypeGroup>();
  for (const item of items) {
    const group = getProgramSubtypeGroup(item.category, item.item);
    if (group) groups.add(group);
  }
  return [...groups].map((group) => SUBTYPE_CONFIGS[group]);
}

function buildSelection(
  category: CSEPProgramCategory,
  item: string,
  relatedTasks: string[],
  source: CSEPProgramSelectionSource,
  subtypeSelections?: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>
): CSEPProgramSelection {
  const subtypeGroup = getProgramSubtypeGroup(category, item);
  return {
    category,
    item,
    subtype: subtypeGroup ? subtypeSelections?.[subtypeGroup] ?? null : null,
    relatedTasks: dedupe(relatedTasks),
    source,
  };
}

export function findMissingProgramSubtypeGroups(
  selections: Array<Pick<CSEPProgramSelection, "category" | "item" | "subtype">>
) {
  const missing = new Set<CSEPProgramSubtypeGroup>();

  for (const selection of selections) {
    const group = getProgramSubtypeGroup(selection.category, selection.item);
    if (group && !selection.subtype) {
      missing.add(group);
    }
  }

  return [...missing].map((group) => SUBTYPE_CONFIGS[group]);
}

export function normalizeProgramSelections(inputs: CSEPProgramSelectionInput[]) {
  const byKey = new Map<string, CSEPProgramSelection>();

  for (const input of inputs) {
    const selection: CSEPProgramSelection = {
      category: input.category,
      item: input.item,
      subtype: input.subtype ?? null,
      source: input.source ?? "selected",
      relatedTasks: dedupe(input.relatedTasks ?? []),
    };
    const key = getProgramSelectionKey(selection.category, selection.item, selection.subtype);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, selection);
      continue;
    }
    existing.relatedTasks = dedupe([...existing.relatedTasks, ...selection.relatedTasks]);
  }

  return [...byKey.values()];
}

export function buildCsepProgramSelections(params: BuildSelectionsParams) {
  const tradeItems = params.tradeItems ?? [];
  const selectedTasks = dedupe(params.selectedTasks ?? []);
  const rawSelections: CSEPProgramSelectionInput[] = [];

  for (const hazard of dedupe(params.selectedHazards)) {
    rawSelections.push({
      category: "hazard",
      item: hazard,
      relatedTasks: tradeItems.filter((row) => row.hazard === hazard).map((row) => row.activity),
      source: "selected",
    });
  }

  for (const permit of dedupe(params.selectedPermits)) {
    const relatedPermitTasks = tradeItems.filter((row) => row.permit === permit).map((row) => row.activity);
    rawSelections.push({
      category: "permit",
      item: permit,
      relatedTasks: relatedPermitTasks.length ? relatedPermitTasks : selectedTasks,
      source: relatedPermitTasks.length ? "derived" : "selected",
    });
  }

  for (const ppe of dedupe(params.selectedPpe)) {
    rawSelections.push({
      category: "ppe",
      item: ppe,
      relatedTasks: selectedTasks,
      source: "selected",
    });
  }

  const selections = normalizeProgramSelections(
    rawSelections.map((selection) =>
      buildSelection(
        selection.category,
        selection.item,
        selection.relatedTasks ?? [],
        selection.source ?? "selected",
        params.subtypeSelections
      )
    )
  );

  return {
    selections,
    missingSubtypeGroups: findMissingProgramSubtypeGroups(selections),
  };
}

const FALL_CONTROL_LINES = {
  planning:
    "Verify the fall hazard, access method, anchorage plan, rescue path, and release authority before exposed work begins.",
  inspection:
    "Inspect harnesses, lanyards, SRLs, hooks, connectors, and anchors before each use. Remove damaged, defective, or deployed equipment from service immediately.",
  anchorage:
    "Use only approved anchorage points and compatible components rated for the intended application.",
  tieOff: "Maintain 100% tie-off where required by the activity, site rules, or fall exposure.",
  fallClearance:
    "Confirm adequate free-fall, swing, and lower-level clearance before work and whenever anchorage, position, or conditions change.",
  leadingEdge:
    "Use approved fall protection for leading-edge work, incomplete decking, connectors, and elevated access areas as defined in the pre-task plan.",
  damage: "Protect fall protection equipment from sharp edges, heat, welding exposure, chemicals, and physical damage.",
  training:
    "Workers shall be trained on inspection, fitting, anchorage selection, equipment limits, and rescue notification before use.",
  stopWork:
    "Stop work when anchor points, edge protection, access, rescue readiness, or equipment condition are not adequate for the task.",
} as const;

function sentenceize(value: string) {
  const t = value.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function compactProgramText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*Ã¢â‚¬â€\s*/g, " - ")
    .replace(/\s*â€”\s*/g, " - ")
    .trim();
}

function moduleItems(values: readonly string[], fallback: readonly string[] = []) {
  return dedupe([...values, ...fallback].map(compactProgramText).filter(Boolean)).map(sentenceize);
}

function moduleReferenceItems(values: readonly string[], fallback: readonly string[] = []) {
  return dedupe([...values, ...fallback].map(compactProgramText).filter(Boolean));
}

function shortProgramReferences(oshaRefs: readonly string[], fallback: string) {
  const references = formatApplicableReferenceBullets([...oshaRefs])
    .map((reference) => reference.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return references.length ? references : [fallback];
}

function summarizeProgramRisk(definition: CSEPProgramDefinition, fallback: string) {
  const parts = moduleItems([definition.summary, ...definition.applicableWhen]).slice(0, 2);
  return parts.join(" ") || fallback;
}

function buildVerificationMethods(
  definition: CSEPProgramDefinition,
  relatedTasks: string[],
  fallbackVerifier = "Foreman or competent person"
) {
  const taskNote = relatedTasks.length
    ? `Verification is tied to the daily pre-task plan for ${relatedTasks.join(", ")}.`
    : "Verification is tied to the daily pre-task plan for the selected scope.";
  return moduleItems(
    [
      `${fallbackVerifier} verifies required controls before work starts, when the work front moves, after weather or condition changes, and at shift turnover using the JHA, permit, inspection log, lift plan, rescue plan, daily pre-task plan, or direct field check.`,
      ...definition.responsibilities,
      ...definition.training,
      ...definition.closeoutProcedures,
      taskNote,
    ],
    []
  ).slice(0, 6);
}

function buildProgramSubsections(module: CSEPProgramModule): CSEPProgramSection["subsections"] {
  return [
    {
      title: PROGRAM_MODULE_SUBSECTION_TITLES.risk,
      body: module.risk,
      bullets: [],
    },
    {
      title: PROGRAM_MODULE_SUBSECTION_TITLES.requiredControls,
      bullets: module.requiredControls,
    },
    {
      title: PROGRAM_MODULE_SUBSECTION_TITLES.verificationMethods,
      bullets: module.verificationMethods,
    },
    {
      title: PROGRAM_MODULE_SUBSECTION_TITLES.stopWorkTriggers,
      bullets: module.stopWorkTriggers,
    },
    {
      title: PROGRAM_MODULE_SUBSECTION_TITLES.applicableReferences,
      bullets: module.applicableReferences,
    },
  ].filter((section) => Boolean(section.body?.trim()) || section.bullets.length > 0);
}

function createProgramModuleSection(params: {
  selection: CSEPProgramSelection;
  definition: CSEPProgramDefinition;
  relatedTasks: string[];
  riskFallback: string;
  requiredControls: string[];
  verificationMethods?: string[];
  stopWorkTriggers: string[];
  applicableReferences?: string[];
}): CSEPProgramSection {
  const programModule: CSEPProgramModule = {
    title: params.definition.title,
    risk: summarizeProgramRisk(params.definition, params.riskFallback),
    requiredControls: moduleItems(params.requiredControls, [
      "Maintain required controls throughout the task and adjust the plan when field conditions change.",
    ]),
    verificationMethods: params.verificationMethods?.length
      ? moduleItems(params.verificationMethods)
      : buildVerificationMethods(params.definition, params.relatedTasks),
    stopWorkTriggers: moduleItems(params.stopWorkTriggers, [
      "Stop work when required permits, competent-person verification, inspections, access controls, weather limits, or planned controls are missing, failed, or no longer match field conditions.",
    ]),
    applicableReferences:
      params.applicableReferences?.length
        ? moduleReferenceItems(params.applicableReferences)
        : shortProgramReferences(params.definition.oshaRefs, "Site permit or authorization if required by scope."),
  };
  if (params.selection.category === "ppe" && params.selection.item === "High Visibility Vest") {
    programModule.applicableReferences = ["R2"];
  }

  return {
    key: `program_${getProgramSelectionKey(
      params.selection.category,
      params.selection.item,
      params.selection.subtype
    )}`,
    category: params.selection.category,
    item: params.selection.item,
    subtype: params.selection.subtype ?? null,
    title: programModule.title,
    summary: params.definition.summary,
    relatedTasks: params.relatedTasks,
    programModule,
    risk: programModule.risk,
    requiredControls: programModule.requiredControls,
    verificationMethods: programModule.verificationMethods,
    stopWorkTriggers: programModule.stopWorkTriggers,
    applicableReferences: programModule.applicableReferences,
    subsections: buildProgramSubsections(programModule),
  };
}

function buildFallProtectionGoverningProgramSection(
  selection: CSEPProgramSelection,
  definition: CSEPProgramDefinition,
  relatedTasks: string[]
): CSEPProgramSection {
  const whenRequired = dedupe(
    definition.applicableWhen.length
      ? definition.applicableWhen
      : [
          "Fall to a lower level: edges, openings, leading deck, or incomplete floor.",
          "Steel, decking, or connector work where the plan or rules require a fall system or collective protection.",
        ]
  );

  let planningBody: string = FALL_CONTROL_LINES.planning;
  if (definition.preTaskProcedures.length) {
    planningBody = `${planningBody} ${definition.preTaskProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let trainingBody: string = FALL_CONTROL_LINES.training;
  if (definition.training.length) {
    trainingBody = `${trainingBody} ${definition.training.map(sentenceize).join(" ")}`.trim();
  }
  if (definition.responsibilities.length) {
    trainingBody = `${trainingBody} ${definition.responsibilities.map(sentenceize).join(" ")}`.trim();
  }

  let stopBody: string = FALL_CONTROL_LINES.stopWork;
  const addedStop = dedupe([...definition.stopWorkProcedures, ...definition.closeoutProcedures]);
  if (addedStop.length) {
    stopBody = `${stopBody} ${addedStop.map(sentenceize).join(" ")}`.trim();
  }
  const applicableReferences = shortProgramReferences(
    definition.oshaRefs,
    "Fall protection plan, rescue plan, and site fall-protection permit if required."
  );

  return createProgramModuleSection({
    selection,
    definition,
    relatedTasks,
    riskFallback:
      "Workers can be exposed to falls during elevated access, leading-edge work, incomplete decking, openings, and transitions where the planned fall controls are missing or no longer match field conditions.",
    requiredControls: [
      ...whenRequired,
      planningBody,
      FALL_CONTROL_LINES.inspection,
      FALL_CONTROL_LINES.anchorage,
      FALL_CONTROL_LINES.tieOff,
      FALL_CONTROL_LINES.fallClearance,
      FALL_CONTROL_LINES.leadingEdge,
      FALL_CONTROL_LINES.damage,
      ...definition.controls,
      ...definition.workProcedures,
    ],
    verificationMethods: [
      trainingBody,
      "Foreman, competent person, or safety lead verifies anchor points, edge protection, equipment inspection, access, and rescue readiness before exposed work starts, when the work front moves, after weather changes, and at shift turnover using the JHA, fall protection inspection, rescue plan, or daily pre-task plan.",
      ...(relatedTasks.length ? [`Verification is tied to the daily pre-task plan for ${relatedTasks.join(", ")}.`] : []),
    ],
    stopWorkTriggers: [stopBody],
    applicableReferences: applicableReferences.includes("R3")
      ? applicableReferences
      : [...applicableReferences, "R3"],
  });

}

const HOT_WORK_PURPOSE_WHEN = `Use this program whenever welding, cutting, grinding, brazing, soldering, or other spark- or flame-producing work is performed. The core risk is fire from open flame, sparks, or hot metal igniting combustibles, coatings, or concealed materialsâ€”and fire spread to nearby work areas, floors, or occupancies.`;

const HOT_WORK_PRE_TASK = `Confirm the hot work permit is active, combustibles are removed or protected, fire extinguishers are staged, ventilation is adequate, and the work area above, below, and on the opposite side is checked before starting.`;

const HOT_WORK_ACTIVE = `Maintain spark containment, fire-watch coverage, controlled access, orderly hose and lead routing, and protection of adjacent workers and materials while hot work is in progress.`;

const HOT_WORK_CLOSEOUT = `Complete the required fire-watch period, inspect the area for smoldering material, shut down equipment safely, and close out the permit before normal access is restored.`;

const HOT_WORK_STOP = `Stop work when fire-watch coverage, extinguishers, ventilation, permit conditions, spark containment, or area control are not adequate for the active task.`;

const HOT_WORK_CORE_BULLETS: string[] = [
  "Permit: Use an active, task- and location-appropriate hot work permit before ignition; follow the project permit process for authorization and posting (do not restate full permit language from the permit section here).",
  "Combustibles: Remove or protect combustibles in the heat and spark path; re-check when the work front moves, openings are created, or new materials enter.",
  "Extinguishers: Stage the required class and number of fire extinguishers in the immediate area; verify operability and access before starting.",
  "Fire watch: Assign fire watch when the permit, policy, or conditions require it; maintain continuous, trained coverage with relief as required.",
  "Overhead / below / opposite: Check exposure above, below, and on the opposite side of the work before start and when conditions change.",
  "Spark containment: Control sparks, slag, and spatter with shields, blankets, baffles, or screens as required.",
  "Cylinders, hoses, leads: Keep torch equipment, hoses, and leads in good condition, clear of hot metal and trip paths, per manufacturer and site rules.",
  "Ventilation: Provide ventilation suitable for the process and space (including fume control where required).",
  "Adjacent trades / occupancies: Coordinate to protect adjacent workers, materials, and occupancies; control access in the spark and heat path.",
  "Training: Train workers assigned to hot work or fire watch on permit rules, equipment checks, watch duties, and stop-work triggers before assignment.",
  "Cross-references: For permit templates, use the project hot work / permit section; for access and barricades, Security at Site; for alarms and emergency response, IIPP / Emergency Responseâ€”cite those sections instead of copying them here.",
];

function buildHotWorkGoverningProgramSection(
  selection: CSEPProgramSelection,
  definition: CSEPProgramDefinition,
  relatedTasks: string[]
): CSEPProgramSection {
  let purposeBody = HOT_WORK_PURPOSE_WHEN;
  if (definition.applicableWhen.length) {
    purposeBody = `${purposeBody} ${definition.applicableWhen.map(sentenceize).join(" ")}`.trim();
  }

  const coreBullets = dedupe([
    ...HOT_WORK_CORE_BULLETS,
    ...definition.training.map((line) => `Supplemental training: ${sentenceize(line)}`),
    ...definition.responsibilities.map((line) => `Supplemental roles: ${sentenceize(line)}`),
    ...definition.controls.map(sentenceize),
  ]);

  let preTaskBody = HOT_WORK_PRE_TASK;
  if (definition.preTaskProcedures.length) {
    preTaskBody = `${preTaskBody} ${definition.preTaskProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let workBody = HOT_WORK_ACTIVE;
  if (definition.workProcedures.length) {
    workBody = `${workBody} ${definition.workProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let closeoutBody = HOT_WORK_CLOSEOUT;
  if (definition.closeoutProcedures.length) {
    closeoutBody = `${closeoutBody} ${definition.closeoutProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let stopBody = HOT_WORK_STOP;
  if (definition.stopWorkProcedures.length) {
    stopBody = `${stopBody} ${definition.stopWorkProcedures.map(sentenceize).join(" ")}`.trim();
  }

  return createProgramModuleSection({
    selection,
    definition,
    relatedTasks,
    riskFallback: purposeBody,
    requiredControls: [preTaskBody, workBody, closeoutBody, ...coreBullets],
    verificationMethods: [
      "Permit holder, foreman, or fire watch verifies the hot work permit, extinguisher access, combustible protection, ventilation, fire-watch coverage, and spark containment before ignition, when the work front moves, and before release using the permit, JHA, fire-watch log, or direct field check.",
      ...definition.responsibilities,
      ...definition.training,
    ],
    stopWorkTriggers: [stopBody],
    applicableReferences: shortProgramReferences(definition.oshaRefs, "Hot work permit if required by site."),
  });
}

function buildCompactProgramSection(
  selection: CSEPProgramSelection,
  definition: CSEPProgramDefinition,
  relatedTasks: string[]
): CSEPProgramSection {
  const controlsParagraph = formatProgramParagraph(definition.controls);
  const applicabilityParagraph = formatProgramParagraph(definition.applicableWhen);
  const trainingParagraph = formatProgramParagraph(
    dedupe([...definition.responsibilities, ...definition.training])
  );
  const referenceParagraph = formatApplicableReferencesInline(definition.oshaRefs);

  return createProgramModuleSection({
    selection,
    definition,
    relatedTasks,
    riskFallback: applicabilityParagraph ?? definition.summary,
    requiredControls: [
      ...(controlsParagraph ? [controlsParagraph] : []),
      ...definition.preTaskProcedures,
      ...definition.workProcedures,
    ],
    verificationMethods: [
      ...(trainingParagraph ? [trainingParagraph] : []),
      ...buildVerificationMethods(definition, relatedTasks),
    ],
    stopWorkTriggers: definition.stopWorkProcedures,
    applicableReferences: referenceParagraph ? [referenceParagraph] : undefined,
  });
}

export function buildCsepProgramSection(
  selection: CSEPProgramSelection,
  options?: {
    definitions?: CSEPProgramDefinition[];
  }
): CSEPProgramSection {
  const definition = resolveDefinition(selection, options?.definitions);
  const relatedTasks = dedupe(selection.relatedTasks);

  if (definition.category === "hazard" && definition.item === "Falls from height") {
    return buildFallProtectionGoverningProgramSection(selection, definition, relatedTasks);
  }

  if (definition.category === "hazard" && definition.item === "Hot work / fire") {
    return buildHotWorkGoverningProgramSection(selection, definition, relatedTasks);
  }

  if (definition.compactLayout) {
    return buildCompactProgramSection(selection, definition, relatedTasks);
  }

  return createProgramModuleSection({
    selection,
    definition,
    relatedTasks,
    riskFallback:
      "Workers can be exposed when the selected task, permit, PPE, or hazard program is active and field conditions change before required controls are verified.",
    requiredControls: [
      ...definition.controls,
      ...definition.preTaskProcedures,
      ...definition.workProcedures,
    ],
    verificationMethods: buildVerificationMethods(definition, relatedTasks),
    stopWorkTriggers: definition.stopWorkProcedures,
  });
}

export function buildCsepProgramSections(
  selections: CSEPProgramSelection[],
  options?: {
    definitions?: CSEPProgramDefinition[];
  }
) {
  const hasLadderPermit = selections.some(
    (s) => s.category === "permit" && s.item === "Ladder Permit"
  );
  const effectiveSelections = hasLadderPermit
    ? selections.filter((s) => !(s.category === "hazard" && s.item === "Ladder misuse"))
    : selections;

  const hasFallsFromHeight = effectiveSelections.some(
    (s) => s.category === "hazard" && s.item === "Falls from height"
  );
  const withoutHarnessDuplicate = hasFallsFromHeight
    ? effectiveSelections.filter(
        (s) => !(s.category === "ppe" && s.item === "Fall Protection Harness")
      )
    : effectiveSelections;

  return withoutHarnessDuplicate.map((selection) => buildCsepProgramSection(selection, options));
}

export function listProgramTitles(
  selections: CSEPProgramSelection[],
  options?: {
    definitions?: CSEPProgramDefinition[];
  }
) {
  return buildCsepProgramSections(selections, options).map((section) => section.title);
}
```

## lib\csepProgramSettings.ts

```ts
import { createClient } from "@supabase/supabase-js";
import {
  getDefaultProgramDefinitions,
  normalizeCsepProgramConfig,
} from "@/lib/csepPrograms";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabaseAdmin";
import type { CSEPProgramConfig } from "@/types/csep-programs";

const CSEP_PROGRAM_SETTINGS_KEY = "csep_program_config";

type MessageError = { message?: string | null };
type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

function isMissingPlatformSettingsError(error?: { message?: string | null } | null) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    message.includes("platform_settings") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

export async function getProgramSettingsServiceRoleClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getCsepProgramConfig(supabase?: SupabaseLikeClient) {
  const client = supabase ?? (await getProgramSettingsServiceRoleClient());
  const fallback: CSEPProgramConfig = {
    definitions: getDefaultProgramDefinitions(),
  };

  const { data, error } = await (
    client.from("platform_settings") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: MessageError | null }>;
        };
      };
    }
  )
    .select("value")
    .eq("key", CSEP_PROGRAM_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingPlatformSettingsError(error)) {
      return fallback;
    }

    throw new Error(error.message ?? "Failed to load CSEP program settings.");
  }

  return normalizeCsepProgramConfig((data as { value?: unknown } | null)?.value ?? fallback);
}

export async function saveCsepProgramConfig(params: {
  supabase: SupabaseLikeClient;
  actorUserId: string;
  config: CSEPProgramConfig;
}) {
  const normalized = normalizeCsepProgramConfig(params.config);

  const result = await (
    params.supabase.from("platform_settings") as unknown as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).upsert(
    {
      key: CSEP_PROGRAM_SETTINGS_KEY,
      value: normalized,
      updated_at: new Date().toISOString(),
      updated_by: params.actorUserId,
    },
    {
      onConflict: "key",
    }
  );

  if (isMissingPlatformSettingsError(result.error)) {
    return {
      data: null,
      error: new Error(
        "The platform_settings table is missing. Apply the platform settings migration before saving CSEP program settings."
      ),
    };
  }

  return {
    data: normalized,
    error: result.error,
  };
}
```

## lib\csepTradeTemplates.ts

```ts
import type { CsepKind } from "@/lib/sharedTradeTaxonomy";

const DEFAULT_SUMMARY_FALLBACK =
  "Trade-specific work exposes workers to changing site conditions, equipment interaction, access challenges, and task-specific hazards that must be managed through planning, controls, and coordination.";

const DEFAULT_OSHA = [
  "OSHA 1926 Subpart E â€“ PPE",
  "OSHA 1926 Subpart M â€“ Fall Protection",
  "OSHA 1926 Subpart K â€“ Electrical",
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
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart P â€“ Excavations",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart K â€“ Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Hearing Protection", "Respiratory Protection"],
  },
  structural_steel_wood: {
    summary:
      "Structural framing and steel work involve falls from height, material hoisting, rigging, power tools, hot work, and multi-trade coordination in evolving structures.",
    oshaRefs: [
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart L â€“ Scaffolding",
      "OSHA 1926 Subpart R â€“ Steel Erection (where applicable)",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Fall Protection Harness", "Hearing Protection"],
  },
  structural_concrete_masonry: {
    summary:
      "Concrete, masonry, and foundation work involves formwork, rebar, pumping, lifting, silica exposure, wall bracing, and struck-by hazards from materials and equipment.",
    oshaRefs: [
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart L â€“ Scaffolding",
      "OSHA 1926 Subpart Q â€“ Concrete and Masonry Construction",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Face Shield", "Respiratory Protection"],
  },
  exterior_envelope: {
    summary:
      "Exterior envelope work includes leading-edge exposures, weather, sealants and adhesives, material handling at elevation, and coordination with ongoing interior and MEP activities.",
    oshaRefs: [
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart L â€“ Scaffolding",
      "OSHA 1926 Subpart K â€“ Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Fall Protection Harness"],
  },
  mep: {
    summary:
      "Mechanical, electrical, plumbing, fire protection, and low-voltage work exposes crews to energized parts, confined spaces, overhead installation, lifting, and multi-system tie-ins.",
    oshaRefs: [
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart K â€“ Electrical",
      "OSHA 1926 Subpart M â€“ Fall Protection",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Face Shield", "Hearing Protection"],
  },
  interior_finishes: {
    summary:
      "Interior finishes involve overhead work, dust and fume sources, slips and trips, material handling in occupied buildings, and frequent ladder or lift use.",
    oshaRefs: [
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart L â€“ Scaffolding",
      "OSHA 1926 Subpart K â€“ Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Respiratory Protection"],
  },
  specialty_misc: {
    summary:
      "Specialty trades combine elevated work, rigging and hoisting, glass handling, welding and cutting hazards, and tight coordination with other crews in congested areas.",
    oshaRefs: [
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart K â€“ Electrical",
      "OSHA 1926 Subpart L â€“ Scaffolding",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Fall Protection Harness", "Face Shield", "Hearing Protection"],
  },
  heavy_civil: {
    summary:
      "Heavy civil and equipment operations involve large mobile equipment, haul routes, changing grades, material handling, traffic interfaces, and evolving site conditions that must be coordinated before work starts.",
    oshaRefs: [
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart O â€“ Motor Vehicles, Mechanized Equipment, and Marine Operations",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart C â€“ General Safety and Health Provisions",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE, "Hearing Protection", "Respiratory Protection"],
  },
  gc_cm: {
    summary:
      "General contractor and construction management roles coordinate multiple trades, site logistics, temporary utilities, access control, and evolving hazards across the full project lifecycle.",
    oshaRefs: [
      "OSHA 1926 Subpart C â€“ General Safety and Health Provisions",
      "OSHA 1926 Subpart E â€“ PPE",
      "OSHA 1926 Subpart M â€“ Fall Protection",
      "OSHA 1926 Subpart K â€“ Electrical",
    ],
    defaultPPE: [...DEFAULT_PPE_BASE],
  },
  other_common: {
    summary:
      "Identify exposures through scope of work, site walkthrough, equipment and materials on site, and coordination with the GC safety team. Supplement with site-specific notes and applicable permit requirements.",
    oshaRefs: [
      ...DEFAULT_OSHA,
      "OSHA 1926 Subpart C â€“ General Safety and Health Provisions",
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
```

## lib\csepTradeSelection.ts

```ts
import {
  CONSTRUCTION_TRADE_LABELS,
  getSelectableSharedTasks,
  getSharedSubTradesForTrade,
  getSharedTradeDefinitionByLabel,
} from "@/lib/sharedTradeTaxonomy";
import { DEFAULT_CONFLICT_SEEDS } from "@/lib/safety-intelligence/conflicts/defaultPairs";
import { csepDefaultPpeForKind, csepOshaRefsForKind, csepSummaryForKind } from "@/lib/csepTradeTemplates";

export type RiskLevel = "Low" | "Medium" | "High";

export type CSEPRiskItem = {
  activity: string;
  hazard: string;
  risk: RiskLevel;
  controls: string[];
  permit: string;
};

export type CSEPTradeSelection = {
  tradeLabel: string;
  tradeCode: string;
  subTradeLabel: string | null;
  subTradeCode: string | null;
  subTradeDescription: string | null;
  sectionTitle: string;
  summary: string;
  oshaRefs: string[];
  defaultPPE: string[];
  items: CSEPRiskItem[];
  availableSubTrades: string[];
  availableTasks: string[];
  referenceTasks: string[];
  derivedHazards: string[];
  derivedPermits: string[];
  commonOverlappingTrades: string[];
  overlapPermitHints: string[];
};

function includesAny(haystack: string, needles: readonly string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function uniq(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

const UTILITY_SCOPE_TOKENS = [
  "utility",
  "pipe laying",
  "install pipe",
  "storm structures",
  "catch basins",
  "manhole",
  "vault",
  "site drainage",
  "locator wire",
  "duct bank",
  "conduit bank",
  "pull boxes",
  "fire main",
  "sanitary",
  "storm /",
  "water /",
] as const;

const EXCAVATION_SCOPE_TOKENS = [
  "excavat",
  "trench",
  "shoring",
  "bench/shore",
  "backfill",
  "bedding",
  "trench support",
  "dig",
  "groundbreaking",
  "ground breaking",
  "ground disturb",
] as const;

function hasUtilityScope(taskContext: string) {
  return includesAny(taskContext, UTILITY_SCOPE_TOKENS);
}

function hasExcavationScope(taskContext: string) {
  return includesAny(taskContext, EXCAVATION_SCOPE_TOKENS);
}

const TRENCH_SCOPE_TOKENS = [
  "trench",
  "shoring",
  "bench/shore",
  "trench support",
] as const;

function hasTrenchScope(taskContext: string) {
  return includesAny(taskContext, TRENCH_SCOPE_TOKENS);
}

type OverlapRule = {
  hazardMatch?: string[];
  permitMatch?: string[];
  tokenMatch?: string[];
  commonTrades: string[];
  permitHints: string[];
};

const CURATED_OVERLAP_RULES: OverlapRule[] = [
  {
    hazardMatch: ["Excavation collapse"],
    commonTrades: [
      "Underground Utilities",
      "Plumbing",
      "Electrical",
      "Survey / Layout",
      "General Conditions / Site Management",
    ],
    permitHints: ["Ground Disturbance Permit"],
  },
  {
    hazardMatch: ["Hot work / fire"],
    commonTrades: ["Painting / Coatings", "HVAC / Mechanical", "Fire Protection"],
    permitHints: ["Hot Work Permit"],
  },
  {
    hazardMatch: ["Crane lift hazards", "Falling objects"],
    commonTrades: ["Rigging / Crane / Hoisting", "Scaffolding / Access", "General Conditions / Site Management"],
    permitHints: ["Motion Permit", "Gravity Permit"],
  },
  {
    hazardMatch: ["Electrical shock", "Pressure / line break"],
    commonTrades: ["HVAC / Mechanical", "Plumbing", "Pipefitting / Process Piping", "Instrumentation / Controls / Automation"],
    permitHints: ["LOTO Permit"],
  },
];

const CONFLICT_TOKEN_TO_TRADE: Array<{ tokens: string[]; trade: string }> = [
  { tokens: ["painting", "flammables"], trade: "Painting / Coatings" },
  { tokens: ["electrical", "energized"], trade: "Electrical" },
  { tokens: ["mechanical", "startup"], trade: "HVAC / Mechanical" },
  { tokens: ["scaffold", "overhead_work"], trade: "Scaffolding / Access" },
  { tokens: ["welding", "hot_work"], trade: "Welding / Hot Work" },
  { tokens: ["excavation", "pedestrian", "active_work_zone", "shared_area"], trade: "General Conditions / Site Management" },
];

function deriveOverlapInsights(params: {
  tradeLabel: string;
  subTradeLabel: string | null;
  taskLabels: readonly string[];
  items: readonly CSEPRiskItem[];
  derivedPermits: readonly string[];
}) {
  const overlapTrades = new Set<string>();
  const permitHints = new Set<string>();
  const seedText = [
    params.tradeLabel,
    params.subTradeLabel ?? "",
    ...params.taskLabels,
    ...params.items.map((item) => `${item.hazard} ${item.permit} ${item.controls.join(" ")}`),
  ]
    .join(" ")
    .toLowerCase();

  for (const rule of CURATED_OVERLAP_RULES) {
    const hazardHit =
      rule.hazardMatch?.some((hazard) => params.items.some((item) => item.hazard === hazard)) ?? false;
    const permitHit =
      rule.permitMatch?.some((permit) => params.derivedPermits.includes(permit)) ?? false;
    const tokenHit = rule.tokenMatch?.some((token) => seedText.includes(token.toLowerCase())) ?? false;
    if (!hazardHit && !permitHit && !tokenHit) continue;
    rule.commonTrades.forEach((trade) => overlapTrades.add(trade));
    rule.permitHints.forEach((permit) => permitHints.add(permit));
  }

  for (const seed of DEFAULT_CONFLICT_SEEDS) {
    const leftHit = seed.leftMatch.some((token) => seedText.includes(token.toLowerCase()));
    if (!leftHit) continue;
    for (const mapping of CONFLICT_TOKEN_TO_TRADE) {
      const tokenMatch =
        mapping.tokens.some((token) => seed.rightMatch.some((right) => right.toLowerCase().includes(token))) ||
        mapping.tokens.some((token) => seed.rationale.toLowerCase().includes(token));
      if (tokenMatch) {
        overlapTrades.add(mapping.trade);
      }
    }
  }

  overlapTrades.delete(params.tradeLabel);
  return {
    commonOverlappingTrades: uniq([...overlapTrades]).sort((a, b) => a.localeCompare(b)),
    overlapPermitHints: uniq([...permitHints]).sort((a, b) => a.localeCompare(b)),
  };
}

function deriveAdditionalOshaRefs(items: readonly CSEPRiskItem[]) {
  const refs = new Set<string>();

  for (const item of items) {
    switch (item.hazard) {
      case "Excavation collapse":
        refs.add("OSHA 1926 Subpart P â€“ Excavations");
        break;
      case "Crane lift hazards":
        refs.add("OSHA 1926 Subpart CC â€“ Cranes and Derricks in Construction");
        break;
      case "Electrical shock":
        refs.add("OSHA 1926 Subpart K â€“ Electrical");
        break;
      case "Falls from height":
        refs.add("OSHA 1926 Subpart M â€“ Fall Protection");
        break;
      case "Hot work / fire":
        refs.add("OSHA 1926 Subpart J â€“ Fire Protection and Prevention");
        break;
      case "Confined spaces":
        refs.add("OSHA 1926 Subpart AA â€“ Confined Spaces in Construction");
        break;
      case "Struck by equipment":
        refs.add("OSHA 1926 Subpart O â€“ Motor Vehicles, Mechanized Equipment, and Marine Operations");
        break;
      default:
        break;
    }
  }

  return [...refs];
}

function buildDerivedSummary(items: readonly CSEPRiskItem[]) {
  const activityText = items.map((item) => `${item.activity} (${item.hazard})`).slice(0, 4).join(", ");
  const excavationActive = items.some((item) => item.hazard === "Excavation collapse");
  const utilityActive = items.some((item) => item.hazard === "Excavation collapse" && hasUtilityScope(item.activity.toLowerCase()));
  const craneActive = items.some((item) => item.hazard === "Crane lift hazards");
  const equipmentActive = items.some((item) => item.hazard === "Struck by equipment");

  const parts: string[] = [];
  if (activityText) {
    parts.push(`Selected work includes ${activityText}.`);
  }
  if (excavationActive) {
    parts.push("Excavation controls should stay tied to the actual earth-disturbance scope, competent person review, and access/egress planning.");
  }
  if (utilityActive) {
    parts.push("Underground utility coordination is required because the selected tasks include direct utility or structure work.");
  }
  if (craneActive) {
    parts.push("Lift planning and suspended-load controls are required for the selected material-handling scope.");
  }
  if (!excavationActive && equipmentActive) {
    parts.push("This selection emphasizes equipment movement and haul-route exposure rather than trenching or underground utility work.");
  }
  return parts.join(" ");
}

function profileForTask(
  tradeLabel: string,
  subTradeLabel: string,
  taskLabel: string
): Omit<CSEPRiskItem, "activity"> {
  const taskContext = taskLabel.toLowerCase();
  const context = `${tradeLabel} ${subTradeLabel} ${taskLabel}`.toLowerCase();

  if (
    includesAny(context, [
      "conduit",
      "wire",
      "termination",
      "panel",
      "switchgear",
      "lighting",
      "grounding",
      "energization",
      "megger",
      "control wiring",
      "sensor install",
      "network connection",
      "inverter",
      "ev charging",
      "backup power",
    ])
  ) {
    return {
      hazard: "Electrical shock",
      risk: "High",
      controls: ["LOTO", "GFCI protection", "Qualified workers only"],
      permit: "LOTO Permit",
    };
  }

  if (
    includesAny(context, [
      "weld",
      "braz",
      "torch",
      "grind",
      "cut",
      "saw cutting",
      "hot work",
      "spark",
      "fire watch",
      "orbital weld",
    ])
  ) {
    return {
      hazard: "Hot work / fire",
      risk: "High",
      controls: ["Fire watch", "Remove combustibles", "Spark containment"],
      permit: "Hot Work Permit",
    };
  }

  if (hasExcavationScope(taskContext) || hasUtilityScope(taskContext)) {
    return {
      hazard: "Excavation collapse",
      risk: "High",
      controls: hasUtilityScope(taskContext)
        ? [
            "Competent person review",
            "Protective systems",
            "Safe access and egress",
            "Verify utility locate / exposure controls",
          ]
        : ["Competent person review", "Protective systems", "Safe access and egress"],
      permit: hasTrenchScope(taskContext) ? "Trench Inspection Permit" : "Ground Disturbance Permit",
    };
  }

  if (
    includesAny(context, [
      "confined",
      "manhole",
      "vault",
      "negative air",
      "sanitized tie",
      "tank",
      "entry support",
    ])
  ) {
    return {
      hazard: "Confined spaces",
      risk: "High",
      controls: ["Air monitoring", "Entry review", "Rescue planning"],
      permit: "Confined Space Permit",
    };
  }

  if (
    includesAny(context, [
      "roof",
      "curtain wall",
      "window",
      "glazing",
      "aerial lift",
      "mewp",
      "ladder",
      "scaffold",
      "decking",
      "column erection",
      "beam setting",
      "fall protection",
      "suspended access",
    ])
  ) {
    return {
      hazard: "Falls from height",
      risk: "High",
      controls: ["Guardrails", "PFAS", "Pre-task planning"],
      permit: includesAny(context, ["aerial lift", "mewp"]) ? "AWP/MEWP Permit" : "Ladder Permit",
    };
  }

  if (
    includesAny(context, [
      "crane",
      "rigging",
      "pick",
      "outrigger",
      "tag line",
      "hoist",
      "signal person",
      "load path",
      "telehandler",
      "forklift",
      "loading/unloading",
    ])
  ) {
    return {
      hazard: "Crane lift hazards",
      risk: "High",
      controls: ["Lift plan", "Signal persons", "Exclusion zone"],
      permit: "Motion Permit",
    };
  }

  if (
    includesAny(context, [
      "coat",
      "paint",
      "sealant",
      "primer",
      "epoxy",
      "resinous",
      "abatement",
      "asbestos",
      "lead",
      "mold",
      "fireproofing",
      "caulking",
      "membrane",
      "passivation",
    ])
  ) {
    return {
      hazard: "Chemical exposure",
      risk: "Medium",
      controls: ["PPE", "SDS review", "Ventilation / containment"],
      permit: "Chemical Permit",
    };
  }

  if (includesAny(context, ["saw cutting", "chipping", "grinding", "mortar", "grout", "surface prep"])) {
    return {
      hazard: "Silica / dust exposure",
      risk: "Medium",
      controls: ["Dust control", "Respiratory protection", "Housekeeping"],
      permit: "None",
    };
  }

  if (
    includesAny(context, [
      "pressure testing",
      "hydro",
      "flushing",
      "tie-in",
      "valve install",
      "startup",
      "commissioning",
      "calibration",
      "loop checks",
    ])
  ) {
    return {
      hazard: "Pressure / line break",
      risk: "Medium",
      controls: ["Verify isolation", "Controlled release", "Communication / boundaries"],
      permit: "None",
    };
  }

  if (
    includesAny(context, [
      "deliveries",
      "material",
      "hauling",
      "grading",
      "compaction",
      "staging",
      "waste handling",
      "traffic control",
      "material movement",
      "equipment setting",
    ])
  ) {
    return {
      hazard: "Struck by equipment",
      risk: "High",
      controls: ["Spotters", "Equipment alarms", "Exclusion zones"],
      permit: "Motion Permit",
    };
  }

  return {
    hazard: "Slips trips falls",
    risk: "Medium",
    controls: ["Housekeeping", "Maintain clear access", "Daily walkdown"],
    permit: "None",
  };
}

/** Exported for CSEP document assembly (task-hazard matrix rows). */
export function buildRiskItem(tradeLabel: string, subTradeLabel: string, taskLabel: string): CSEPRiskItem {
  const profile = profileForTask(tradeLabel, subTradeLabel, taskLabel);
  return {
    activity: taskLabel,
    ...profile,
  };
}

export function buildCsepTradeSelection(
  tradeLabel: string,
  subTradeLabel?: string | null,
  taskLabels?: readonly string[]
): CSEPTradeSelection | null {
  const trade = getSharedTradeDefinitionByLabel(tradeLabel);
  if (!trade) return null;

  const subTrade = subTradeLabel ? trade.subTrades.find((row) => row.label === subTradeLabel) ?? null : null;
  const selectableTasks = subTrade ? getSelectableSharedTasks(trade.code, subTrade.code) : [];
  const requestedTaskLabels = uniq(taskLabels ?? []);
  const activeTaskLabels =
    subTrade && requestedTaskLabels.length > 0
      ? selectableTasks.filter((task) => requestedTaskLabels.includes(task.label)).map((task) => task.label)
      : [];

  const items = subTrade ? activeTaskLabels.map((taskLabel) => buildRiskItem(trade.label, subTrade.label, taskLabel)) : [];
  const derivedHazards = uniq(items.map((item) => item.hazard));
  const derivedPermitSet = new Set(items.map((item) => item.permit).filter((permit) => permit !== "None"));
  const hasExcavation = items.some((item) => item.hazard === "Excavation collapse");
  const hasTrench = items.some(
    (item) => item.hazard === "Excavation collapse" && hasTrenchScope(item.activity.toLowerCase())
  );
  if (hasExcavation) {
    derivedPermitSet.add("Ground Disturbance Permit");
  }
  if (hasTrench) {
    derivedPermitSet.add("Trench Inspection Permit");
  }
  const derivedPermits = uniq([...derivedPermitSet]);
  const overlapInsights = deriveOverlapInsights({
    tradeLabel: trade.label,
    subTradeLabel: subTrade?.label ?? null,
    taskLabels: activeTaskLabels,
    items,
    derivedPermits,
  });
  const additionalOshaRefs = deriveAdditionalOshaRefs(items);
  const summaryParts = [csepSummaryForKind(trade.csepKind)];
  if (subTrade) summaryParts.push(subTrade.description);
  if (activeTaskLabels.length > 0) {
    summaryParts.push(`Selected tasks include ${activeTaskLabels.slice(0, 5).join(", ")}.`);
    const derivedSummary = buildDerivedSummary(items);
    if (derivedSummary) {
      summaryParts.push(derivedSummary);
    }
  } else if (subTrade) {
    summaryParts.push("Select one or more tasks to generate hazards, permit triggers, and matrix rows.");
  }

  return {
    tradeLabel: trade.label,
    tradeCode: trade.code,
    subTradeLabel: subTrade?.label ?? null,
    subTradeCode: subTrade?.code ?? null,
    subTradeDescription: subTrade?.description ?? null,
    sectionTitle: `Site-Specific Safety Requirements - ${trade.label}`,
    summary: summaryParts.join(" "),
    oshaRefs: uniq([...csepOshaRefsForKind(trade.csepKind), ...additionalOshaRefs]),
    defaultPPE: csepDefaultPpeForKind(trade.csepKind),
    items,
    availableSubTrades: trade.subTrades.map((row) => row.label),
    availableTasks: selectableTasks.map((task) => task.label),
    referenceTasks: subTrade?.referenceTasks.map((task) => task.label) ?? [],
    derivedHazards,
    derivedPermits,
    commonOverlappingTrades: overlapInsights.commonOverlappingTrades,
    overlapPermitHints: overlapInsights.overlapPermitHints,
  };
}

export function getCsepTradeOptions(): string[] {
  return [...CONSTRUCTION_TRADE_LABELS];
}

export function getCsepSubTradeOptions(tradeLabel: string): string[] {
  const trade = getSharedTradeDefinitionByLabel(tradeLabel);
  if (!trade) return [];
  return getSharedSubTradesForTrade(trade.code).map((subTrade) => subTrade.label);
}

export function getCsepTaskOptions(
  tradeLabel: string,
  subTradeLabel: string
): { selectable: string[]; reference: string[] } {
  const trade = getSharedTradeDefinitionByLabel(tradeLabel);
  if (!trade) return { selectable: [], reference: [] };
  const subTrade = trade.subTrades.find((row) => row.label === subTradeLabel);
  if (!subTrade) return { selectable: [], reference: [] };
  return {
    selectable: getSelectableSharedTasks(trade.code, subTrade.code).map(
      (task) => task.label
    ),
    reference: subTrade.referenceTasks.map((task) => task.label),
  };
}
```

## lib\csepActivityMatrixAugmentations.ts

```ts
import { cleanFinalText } from "@/lib/csepFinalization";

type RiskProfile = { hazard: string; controls: readonly string[]; permit: string };

function normTask(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const cleaned = cleanFinalText(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/** Normalized short controls from profileForTask that the full task packs supersede. */
const GENERIC_CRANE_PROFILE = new Set(["lift plan", "signal persons", "exclusion zone"]);
const GENERIC_HOT_WORK_PROFILE = new Set(["fire watch", "remove combustibles", "spark containment"]);
const GENERIC_FALL_TRIPLET = new Set(["guardrails", "pfas", "pre-task planning"]);

function stripRedundantBaseControls(controls: readonly string[], redundant: Set<string>): string[] {
  return controls.filter((c) => {
    const key = cleanFinalText(c)?.toLowerCase().trim() ?? "";
    return key && !redundant.has(key);
  });
}

function tradeLooksLikeSteel(tradeLabel: string, subTradeLabel: string | null | undefined) {
  const s = `${tradeLabel} ${subTradeLabel ?? ""}`.toLowerCase();
  return (
    /\bsteel\b/.test(s) ||
    /\bironwork/.test(s) ||
    /structural steel/.test(s) ||
    /steel erection/.test(s) ||
    /metal deck/.test(s) ||
    /ornamental metal/.test(s)
  );
}

const CRANE_RIGGING_HAZARDS = [
  "Swing radius and load-path exposures; struck-by suspended loads",
  "Rigging failure, overload, loss of load control, or unstable crane support / ground",
] as const;

const CRANE_RIGGING_CONTROLS = [
  "Lift plan / pick plan in effect before the pick",
  "Crane permit where required by site / AHJ",
  "Qualified rigger for rigging selection and attachment",
  "Qualified signal person (voice, radio, or other verified method)",
  "Rigging inspection (pre-use; remove damaged gear from service)",
  "Load weight verification against chart and rigging capacity",
  "Crane setup and ground condition review (mats, blocking, subsurface, access)",
  "Swing radius control (barricades, controlled access, spotters as required)",
  "Load path control (tag lines, swing limits, clear swing zone)",
  "No employees under suspended loads at any time",
  "Wind / weather review before and during picks; stop when limits are exceeded",
  "Barricaded landing zone and controlled delivery path",
  "Communication method verified before lift and maintained during the sequence",
] as const;

const WELDING_HAZARDS = [
  "Ignition of combustibles; fire spread; hazardous weld / cut fumes; arc flash and burns",
] as const;

const WELDING_CONTROLS = [
  "Hot work permit active and posted where required",
  "Fire watch where required; maintain until safe cool-down",
  "Combustible material control (removal, wetting, shielding, covers) and re-check when the work front moves",
  "Welding screens / shields where arc exposure could reach workers or the public",
  "Fume control per process and space (local exhaust, ventilation limits, respiratory protection when required)",
  "Cylinder storage, transport, caps, chains, and separation from heat / traffic",
  "Burn protection for adjacent trades and surfaces; cool-down before leaving the area",
  "Eye / face protection appropriate to process and site rules",
  "Fire extinguisher availability sized and staged per permit and AHJ expectations",
] as const;

const DECKING_HAZARDS = [
  "Leading-edge and opening exposures during sheet placement; deck bundle instability",
  "Drop hazards from unsecured sheets, tools, and debris; wind-driven sheet movement",
] as const;

const DECKING_CONTROLS = [
  "Controlled decking zone (CDZ) only when used per written plan and competent-person limits",
  "Leading-edge controls (guardrail, safety net, PFAS, or approved combination) commensurate with exposure",
  "Opening protection for roof / floor openings created or uncovered during placement",
  "Deck bundle placement limits â€” land only where the steel can support bundles; do not overload bays",
  "Fall protection for connectors / installers until permanent edges or collective systems are in place",
  "Drop zone controls below active decking faces; restrict access until sheets are secured",
  "Weather / wind controls; stop or secure when manufacturer / site wind limits apply",
  "Secure sheets / bundles before release of cranes or before workers step away from leading edges",
] as const;

const STEEL_LIFT_COORD_HAZARDS = [
  "Suspended load swing and drop-zone exposure during steel placement",
] as const;

const STEEL_LIFT_COORD_CONTROLS = [
  "Coordinated pick / lift plan or sequence tied to ironworker work zone",
  "Qualified rigger and qualified signal person where hoisting supports steel placement",
  "Barricade / exclude personnel from swing, load path, and drop zones during sets",
  "No work or transit under suspended steel",
  "Tag lines and controlled landing as required by lift plan",
] as const;

const STEEL_CONNECTION_HAZARDS = [
  "Leading-edge / elevation exposure during connections; dropped objects from tools or hardware",
  "Frame stability until permanent connections and bracing are completed",
] as const;

const STEEL_CONNECTION_CONTROLS = [
  "PFAS or other approved fall protection for connectors and installers at leading edges",
  "Plumb / brace / temporary stability verified before releasing hoisting gear",
  "Tool tethering and housekeeping to limit dropped-object exposure below",
  "Bolt-up / fitting sequence per erection plan; no improvised structural releases",
  "Communication between ironworkers, crane, and supervision during each connection step",
] as const;

const STEEL_MATERIAL_HANDLING_HAZARDS = [
  "Struck-by loads and equipment; pinch / crush during unloading, sorting, and staging",
  "Stack instability, shifting bundles, and trip hazards in laydown and delivery areas",
] as const;

const STEEL_MATERIAL_HANDLING_CONTROLS = [
  "Stay clear of suspended loads; use tag lines and controlled landing zones",
  "Rigging inspection and qualified rigger when mobile crane / loader handles bundles",
  "Stacking limits, dunnage, and banding integrity verified before leaving loads unattended",
  "Spotters / traffic control when deliveries interact with equipment or pedestrian routes",
  "Housekeeping and clear walking paths between nested members",
  "Cut / sharp edge awareness and appropriate hand / foot protection",
] as const;

const STEEL_BOLTING_HAZARDS = [
  "Dropped bolts and tools; torque / pinch exposure; at-height reaching during bolt-up",
] as const;

const STEEL_BOLTING_CONTROLS = [
  "Tool tethering and debris nets / toe boards where drop zones are active below",
  "Torque guns and sockets inspected; pinch points guarded or briefed",
  "Fall protection maintained during bolt-up at leading edges or open bays",
  "Sequential bolt-up per connection detail; do not remove critical bolts prematurely",
] as const;

const STEEL_EMBED_HAZARDS = [
  "Trip / impalement from protruding embeds; opening and edge exposure during placement",
] as const;

const STEEL_EMBED_CONTROLS = [
  "Cap, bend, guard, or flag protruding reinforcing / embeds per site rules",
  "Opening and edge protection immediately after slab / deck penetrations are formed",
  "Coordination with concrete / carpentry so embed layout matches steel landing plan",
] as const;

function isCraneOrRiggingTask(t: string) {
  if (isUnloadOrSortTask(t)) return false;
  return (
    /\b(crane|pick|rigging|rigger|hoist|signal|tag line|outrigger|suspended|telehandler)\b/.test(t) ||
    t.includes("load path") ||
    t.includes("swing radius")
  );
}

function isWeldingOrCuttingTask(t: string, risk: RiskProfile) {
  if (risk.hazard === "Hot work / fire") return true;
  return (
    /\b(weld|braze|torch|hot work|tack|spark)\b/.test(t) ||
    (/\bcut\b/.test(t) && !/\bsaw cut/.test(t) && (t.includes("steel") || t.includes("metal") || t.includes("plate")))
  );
}

function isDeckingInstallTask(t: string) {
  return (
    t.includes("deck") ||
    t.includes("metal roof deck") ||
    t.includes("floor deck") ||
    t.includes("cdz") ||
    t.includes("bundle")
  );
}

function isColumnOrBeamTask(t: string) {
  if (t.includes("deck")) return false;
  return (
    t.includes("column") ||
    t.includes("beam") ||
    t.includes("girder") ||
    t.includes("joist") ||
    t.includes("erect")
  );
}

function isUnloadOrSortTask(t: string) {
  return (
    (t.includes("unload") && t.includes("steel")) ||
    (t.includes("sort") && t.includes("member")) ||
    t.includes("sort steel") ||
    t.includes("laydown") ||
    t.includes("staging steel")
  );
}

function isBoltingTask(t: string) {
  return t.includes("bolt");
}

function isEmbedTask(t: string) {
  return t.includes("embed");
}

/**
 * Adds task-specific hazards and controls for Appendix E / activity hazard matrix rows.
 * Crane, welding, and decking tasks receive full control packs; other steel tasks get tailored lists.
 */
export function augmentCsepActivityMatrixRow(params: {
  taskTitle: string;
  tradeLabel: string;
  subTradeLabel: string | null | undefined;
  risk: RiskProfile;
  base: { hazards: string[]; controls: string[] };
}): { hazards: string[]; controls: string[] } {
  const t = normTask(params.taskTitle);
  const steel = tradeLooksLikeSteel(params.tradeLabel, params.subTradeLabel);

  const extraHazards: string[] = [];
  const extraControls: string[] = [];
  let appliedCranePack = false;
  let appliedWeldingPack = false;
  let appliedDeckingPack = false;

  if (isCraneOrRiggingTask(t)) {
    extraHazards.push(...CRANE_RIGGING_HAZARDS);
    extraControls.push(...CRANE_RIGGING_CONTROLS);
    appliedCranePack = true;
  } else if (steel && isColumnOrBeamTask(t)) {
    extraHazards.push(...STEEL_LIFT_COORD_HAZARDS, ...STEEL_CONNECTION_HAZARDS);
    extraControls.push(...STEEL_LIFT_COORD_CONTROLS, ...STEEL_CONNECTION_CONTROLS);
  } else if (steel && isUnloadOrSortTask(t)) {
    extraHazards.push(...STEEL_MATERIAL_HANDLING_HAZARDS);
    extraControls.push(...STEEL_MATERIAL_HANDLING_CONTROLS);
  } else if (steel && isBoltingTask(t)) {
    extraHazards.push(...STEEL_BOLTING_HAZARDS);
    extraControls.push(...STEEL_BOLTING_CONTROLS);
  } else if (steel && isEmbedTask(t)) {
    extraHazards.push(...STEEL_EMBED_HAZARDS);
    extraControls.push(...STEEL_EMBED_CONTROLS);
  }

  if (isWeldingOrCuttingTask(t, params.risk)) {
    extraHazards.push(...WELDING_HAZARDS);
    extraControls.push(...WELDING_CONTROLS);
    appliedWeldingPack = true;
  }

  if (isDeckingInstallTask(t) || (steel && params.risk.hazard === "Falls from height" && t.includes("deck"))) {
    extraHazards.push(...DECKING_HAZARDS);
    extraControls.push(...DECKING_CONTROLS);
    appliedDeckingPack = true;
  }

  if (extraHazards.length === 0 && extraControls.length === 0) {
    return { hazards: params.base.hazards, controls: params.base.controls };
  }

  let baseControls = params.base.controls;
  if (appliedCranePack) {
    baseControls = stripRedundantBaseControls(baseControls, GENERIC_CRANE_PROFILE);
  }
  if (appliedWeldingPack) {
    baseControls = stripRedundantBaseControls(baseControls, GENERIC_HOT_WORK_PROFILE);
  }
  if (appliedDeckingPack) {
    baseControls = stripRedundantBaseControls(baseControls, GENERIC_FALL_TRIPLET);
  }

  return {
    hazards: dedupeStrings([...extraHazards, ...params.base.hazards]),
    controls: dedupeStrings([...extraControls, ...baseControls]),
  };
}
```

## lib\csepWorkAttireDefaults.ts

```ts
/**
 * Shared work-attire expectations for CSEP (clothing / dress code only â€” not PPE devices).
 */
export const CSEP_WORK_ATTIRE_SUBSECTION_BODY =
  "This subsection covers everyday work clothing and site dress expectations. Personal protective equipment (hard hats, safety glasses, gloves, harnesses, respirators, and similar) is listed only in Required PPE.";

export const CSEP_WORK_ATTIRE_DEFAULT_BULLETS: readonly string[] = [
  "Wear shirts with sleeves; do not work in tank tops, sleeveless shirts, or other apparel that does not protect the upper body in a construction environment.",
  "Wear durable long pants suitable for the task; shorts and non-work footwear are not acceptable unless the project owner or site rules explicitly authorize them for defined conditions.",
  "Dress for weather: add or remove layers, rain gear, and cold-weather clothing so workers stay capable and safe without compromising visibility or mobility where the site requires it.",
  "Avoid loose, torn, or baggy clothing, dangling drawstrings, jewelry, or other items that can catch on rotating equipment, hoist lines, steel edges, or power tools.",
  "Follow owner, GC/CM, and site-specific dress codes (logo shirts, visitor vests, flame-resistant clothing zones, clean-room rules, etc.) when those rules apply to the work area or task.",
];
```

## lib\csepSiteSpecificNotes.ts

```ts
/**
 * Narrative body for the CSEP "Project-Specific Safety Notes" block (builder key `site_specific_notes`).
 * Must not repeat the Scope Summary task list; use for site-only constraints and user-entered context.
 */

export const PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK =
  "No additional project-specific safety notes were provided. Field supervision shall confirm site conditions, owner requirements, and controlling-contractor rules before work begins.";

/**
 * Returns user-entered project-specific safety text, or the standard empty-state fallback.
 */
export function getProjectSpecificSafetyNotesNarrativeBody(input: {
  userText: string | null | undefined;
}): string {
  const t = (input.userText ?? "").trim();
  if (t) {
    return t;
  }
  return PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK;
}

/** @deprecated Prefer {@link getProjectSpecificSafetyNotesNarrativeBody}. `steelErectionInScope` is ignored. */
export function getSiteSpecificNotesNarrativeBody(input: {
  userText: string | null | undefined;
  steelErectionInScope?: boolean;
}): string {
  return getProjectSpecificSafetyNotesNarrativeBody({ userText: input.userText });
}
```

## lib\csepStopWorkLanguage.ts

```ts
/**
 * Shared CSEP language: universal stop-work and controlled restart verification.
 * Import from assemble, programs, builder text, and related generators.
 */

/** All workers may stop unsafe work; restart is verified by designated field roles. */
export const CSEP_STOP_WORK_UNIVERSAL_AUTHORITY =
  "Every worker has stop-work authority: anyone who observes unsafe conditions, missing controls, or a conflict with the approved plan shall stop work and notify supervision.";

export const CSEP_RESTART_AFTER_VERIFICATION =
  "Work may restart only after the competent person or assigned supervisor verifies the exposure has been corrected, required controls are in place, and the crew has been re-briefed.";
```

## lib\csepRegulatoryReferenceIndex.ts

```ts
export type CsepRegulatoryReferenceEntry = {
  code: string;
  citation: string;
};

export const CSEP_REGULATORY_REFERENCE_INDEX: readonly CsepRegulatoryReferenceEntry[] = [
  { code: "R1", citation: "OSHA 29 CFR 1926 Subpart C - General Safety and Health Provisions" },
  { code: "R2", citation: "OSHA 29 CFR 1926 Subpart M - Fall Protection" },
  { code: "R3", citation: "OSHA 29 CFR 1926 Subpart R - Steel Erection" },
  { code: "R4", citation: "OSHA 29 CFR 1926 Subpart CC - Cranes and Derricks in Construction" },
  { code: "R5", citation: "OSHA 29 CFR 1926 Subpart J - Fire Protection and Prevention" },
  { code: "R6", citation: "OSHA 29 CFR 1926 Subpart X - Stairways and Ladders" },
  { code: "R7", citation: "OSHA 29 CFR 1926 Subpart L - Scaffolds" },
  { code: "R8", citation: "OSHA 29 CFR 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations" },
  { code: "R9", citation: "OSHA 29 CFR 1926.59 - Hazard Communication" },
  { code: "R10", citation: "OSHA 29 CFR 1926 Subpart E - Personal Protective and Life Saving Equipment" },
  { code: "R11", citation: "OSHA 29 CFR 1926 Subpart K - Electrical" },
] as const;

const CODE_ORDER = new Map(CSEP_REGULATORY_REFERENCE_INDEX.map((entry, index) => [entry.code, index]));

export const CSEP_REGULATORY_R_CODE_TO_CITATION: Readonly<Record<string, string>> = Object.fromEntries(
  CSEP_REGULATORY_REFERENCE_INDEX.map((entry) => [entry.code, entry.citation])
) as Record<string, string>;

function normRef(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstMatchCode(normalized: string): string | null {
  if (/\bsubpart\s+c\b|\bgeneral\s+safety\s+and\s+health\b/.test(normalized)) return "R1";
  if (/\bsubpart\s+m\b|\bfall\s+protection\b/.test(normalized) && !/\b1926\s*759\b/.test(normalized)) return "R2";
  if (/\bsubpart\s+r\b|\bsteel\s+erection\b/.test(normalized)) return "R3";
  if (/\bsubpart\s+cc\b|\bcranes\s+and\s+derricks\b|\bderrick\b/.test(normalized)) return "R4";
  if (/\bsubpart\s+j\b|\bwelding\b|\bcutting\b|\bfire\s+protection\b|\bfire\s+prevention\b/.test(normalized)) return "R5";
  if (/\bsubpart\s+x\b|\bstairways?\b|\bladders?\b/.test(normalized)) return "R6";
  if (/\bsubpart\s+l\b|\bscaffolds?\b/.test(normalized)) return "R7";
  if (/\bsubpart\s+o\b|\bmotor\s+vehicle\b|\bmechanized\s+equipment\b|\bmarine\s+operations\b/.test(normalized)) return "R8";
  if (/\b1926\s*59\b|\bhazard\s+communication\b|\bhazcom\b/.test(normalized)) return "R9";
  if (/\bsubpart\s+e\b|\bpersonal\s+protective\b|\blife\s+saving\b|\bppe\b/.test(normalized)) return "R10";
  if (/\bsubpart\s+k\b|\belectrical\b/.test(normalized)) return "R11";
  return null;
}

export function mapOshaRefLineToRCode(line: string): string | null {
  const stripped = line.trim().replace(/^R\d+\s+/i, "").trim();
  if (!stripped) return null;

  const explicit = stripped.match(/^R(\d+)\b/i);
  if (explicit) {
    const code = `R${explicit[1]}`;
    return CSEP_REGULATORY_R_CODE_TO_CITATION[code] ? code : null;
  }

  return firstMatchCode(normRef(stripped));
}

export function dedupeSortedRCodes(codes: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const code of codes) {
    const normalized = code.trim().toUpperCase();
    if (/^R\d+$/.test(normalized) && CSEP_REGULATORY_R_CODE_TO_CITATION[normalized]) {
      out.add(normalized);
    }
  }
  return [...out].sort((a, b) => (CODE_ORDER.get(a) ?? 999) - (CODE_ORDER.get(b) ?? 999));
}

export function mapOshaRefStringsToSortedRCodes(refs: readonly string[]): string[] {
  return dedupeSortedRCodes(refs.flatMap((ref) => {
    const code = mapOshaRefLineToRCode(ref);
    return code ? [code] : [];
  }));
}

export function formatApplicableReferenceBullets(refs: readonly string[]): string[] {
  const codes = mapOshaRefStringsToSortedRCodes(refs);
  return codes.length ? codes : ["Confirm applicable OSHA references against the project regulatory register."];
}

export function mergeApplicableReferenceRCodeBullets(existing: string[] | undefined, additions: string[]) {
  return dedupeSortedRCodes([
    ...(existing ?? []).flatMap((line) => mapOshaRefLineToRCode(line) ?? []),
    ...additions.flatMap((line) => mapOshaRefLineToRCode(line) ?? []),
  ]);
}

export function formatApplicableReferencesInline(refs: readonly string[]): string {
  const codes = mapOshaRefStringsToSortedRCodes(refs);
  return codes.length ? `Applicable references: ${codes.join(", ")}.` : "";
}

export function substituteOshaCitationsWithRCodes(text: string): string {
  if (!text.trim() || /^\s*R\d+\s+OSHA\b/i.test(text)) return text;
  const code = mapOshaRefLineToRCode(text);
  return code ? text.replace(/\bOSHA\b.*$/i, code).replace(/\b(R\d+)\s*,\s*\1\b/gi, "$1") : text;
}

export const CSEP_APPENDIX_REGULATORY_REFERENCES_KEY = "regulatory_basis_and_references";
```

## lib\csepSafetyProgramReferenceRelocation.ts

```ts
import { CSEP_RESTART_AFTER_VERIFICATION, CSEP_STOP_WORK_UNIVERSAL_AUTHORITY } from "@/lib/csepStopWorkLanguage";
import type { GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

export const CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY = "appendix_safety_program_reference_pack";
export const CSEP_SAFETY_PROGRAM_REFERENCE_PACK_DISPLAY_REF =
  "Appendix F â€” Safety Program Reference Pack";
export const CSEP_SAFETY_PROGRAM_REFERENCE_PACK_TITLE =
  "Appendix F. Safety Program Reference Pack";

function normToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>, max: number) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const t = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Catalog / steel program titles whose full narratives are moved out of the main
 * Hazards and Controls flow into {@link CSEP_SAFETY_PROGRAM_REFERENCE_PACK_TITLE}.
 */
export function isSafetyProgramReferenceRelocationTargetTitle(rawTitle: string): boolean {
  const n = normToken(rawTitle);
  if (!n) return false;

  return (
    n === "fall protection program" ||
    (n.includes("ladder") && (n.includes("authorization") || n.includes("use controls"))) ||
    n === "hot work program" ||
    n === "hot work permit program" ||
    n === "overhead and gravity hazard program" ||
    n === "equipment motion and traffic control program" ||
    ((n.includes("aerial work platform") || n.includes("mewp")) && n.includes("program")) ||
    (n.includes("controlled decking zone") && n.includes("program")) ||
    (n.includes("crane") && n.includes("rigging") && n.includes("safety program")) ||
    (n.includes("multiple lift") && n.includes("rigging")) ||
    (n.includes("structural stability") && n.includes("bracing")) ||
    (n.includes("fall rescue") && n.includes("suspension trauma")) ||
    (n.includes("hoisting") && n.includes("rigging") && n.includes("multiple lift"))
  );
}

function pickFieldSummaryBullets(section: GeneratedSafetyPlanSection, max: number) {
  const fromSubs = (section.subsections ?? []).flatMap((s) => s.bullets ?? []);
  return uniqueStrings([...(section.bullets ?? []), ...fromSubs], max);
}

function flattenProgramToPackSubsections(full: GeneratedSafetyPlanSection) {
  const subs: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
  const prefix = full.title.trim() || "Program";
  if (full.summary?.trim()) {
    subs.push({ title: `${prefix} â€” overview`, body: full.summary.trim(), bullets: [] });
  }
  if (full.body?.trim()) {
    subs.push({ title: `${prefix} â€” narrative`, body: full.body.trim(), bullets: [] });
  }
  if (full.bullets?.length) {
    subs.push({ title: `${prefix} â€” checklist lines`, body: null, bullets: full.bullets });
  }
  for (const sub of full.subsections ?? []) {
    const st = sub.title?.trim() || "Program detail";
    subs.push({
      title: `${prefix} â€” ${st}`,
      body: sub.body?.trim() ?? null,
      bullets: sub.bullets ?? [],
    });
  }
  return subs;
}

function buildStubProgramSection(full: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection {
  const summary = full.summary?.trim();
  const bullets = pickFieldSummaryBullets(full, 4);
  return {
    ...full,
    summary: summary ? summary.slice(0, 420) : undefined,
    body: `Field use: follow the competent person, site permits, lift plans, daily briefing, and contract documents for this program. Full narrative, references, and detailed procedures: ${CSEP_SAFETY_PROGRAM_REFERENCE_PACK_DISPLAY_REF} under â€œ${full.title.trim()}â€.`,
    bullets:
      bullets.length > 0
        ? bullets
        : [
            "Confirm applicability with supervision before starting exposed work.",
            "Verify permits, inspections, and rescue or interface readiness per site rules.",
            `${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} ${CSEP_RESTART_AFTER_VERIFICATION}`,
          ],
    subsections: undefined,
  };
}

function buildStubSteelProgramSubsection(
  sub: NonNullable<GeneratedSafetyPlanSection["subsections"]>[number]
) {
  const title = sub.title?.trim() || "Program module";
  const keep = (sub.bullets ?? []).slice(0, 4);
  const lead = keep[0] ?? "Follow the steel erection plan, lift plan, and competent-person direction for this program.";
  return {
    title,
    body: `Summary: ${lead} Full program narrative: ${CSEP_SAFETY_PROGRAM_REFERENCE_PACK_DISPLAY_REF} under â€œ${title}â€.`,
    bullets: keep,
  };
}

function processSteelProgramModulesSection(
  section: GeneratedSafetyPlanSection,
  packPieces: NonNullable<GeneratedSafetyPlanSection["subsections"]>,
  seenFragmentTitles: Set<string>
): GeneratedSafetyPlanSection {
  const subs = section.subsections ?? [];
  if (!subs.length) return section;

  const nextSubs: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
  for (const sub of subs) {
    const st = sub.title ?? "";
    if (!isSafetyProgramReferenceRelocationTargetTitle(st)) {
      nextSubs.push(sub);
      continue;
    }
    const fragKey = normToken(st);
    if (!seenFragmentTitles.has(fragKey)) {
      seenFragmentTitles.add(fragKey);
      packPieces.push(
        ...flattenProgramToPackSubsections({
          key: `${section.key}__${fragKey || "module"}`,
          title: st,
          summary: null,
          body: null,
          bullets: [],
          subsections: [sub],
        })
      );
    }
    nextSubs.push(buildStubSteelProgramSubsection(sub));
  }

  return { ...section, subsections: nextSubs };
}

function processTopLevelProgramSection(
  section: GeneratedSafetyPlanSection,
  packPieces: NonNullable<GeneratedSafetyPlanSection["subsections"]>,
  seenFragmentTitles: Set<string>
): GeneratedSafetyPlanSection {
  if (!isSafetyProgramReferenceRelocationTargetTitle(section.title)) {
    return section;
  }
  const key = normToken(section.title);
  if (seenFragmentTitles.has(key)) {
    return buildStubProgramSection(section);
  }
  seenFragmentTitles.add(key);
  packPieces.push(...flattenProgramToPackSubsections(section));
  return buildStubProgramSection(section);
}

/**
 * Shortens matching program sections for Hazards and Controls and appends one
 * appendix section carrying the full narratives (stable key for DOCX appendix merge).
 */
export function relocateSafetyProgramReferencePacks(
  sections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const packPieces: NonNullable<GeneratedSafetyPlanSection["subsections"]> = [];
  const seenFragmentTitles = new Set<string>();

  const next = sections.map((section) => {
    const nk = normToken(section.key);
    if (nk === "steel program modules reference") {
      return processSteelProgramModulesSection(section, packPieces, seenFragmentTitles);
    }
    const isProgramKey =
      nk.startsWith("program hazard") || nk.startsWith("program permit") || nk.startsWith("program ppe");
    if (isProgramKey) {
      return processTopLevelProgramSection(section, packPieces, seenFragmentTitles);
    }
    return section;
  });

  if (!packPieces.length) {
    return next;
  }

  const packIdx = next.findIndex((s) => s.key === CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY);
  if (packIdx !== -1) {
    const existing = next[packIdx];
    const merged = [...next];
    merged[packIdx] = {
      ...existing,
      kind: "appendix",
      summary:
        existing.summary?.trim() ||
        "Detailed narratives for the selected safety programs below. The Hazards and Controls section keeps short field summaries; use this appendix for audit, training, and full procedure text.",
      subsections: [...(existing.subsections ?? []), ...packPieces],
    };
    return merged;
  }

  return [
    ...next,
    {
      key: CSEP_SAFETY_PROGRAM_REFERENCE_PACK_KEY,
      kind: "appendix" as const,
      order: 1000,
      title: CSEP_SAFETY_PROGRAM_REFERENCE_PACK_TITLE,
      summary:
        "Detailed narratives for the selected safety programs below. The Hazards and Controls section keeps short field summaries and pointers here for audit, training, and full procedure text.",
      body: null,
      bullets: [],
      subsections: packPieces,
    },
  ];
}
```

## lib\csepDraftSafetyPreservation.ts

```ts
import type { GeneratedSafetyPlanDraft, GeneratedSafetyPlanSection } from "@/types/safety-intelligence";

/**
 * Product-required safety concepts for CSEP drafts (deterministic assembler + structured builder).
 * When cleaning, deduplicating, or compacting CSEP output, **rephrase or reorganize**â€”do not delete
 * these ideas from generated content. CI enforces them via `csepDraftSafetyPreservation.test.ts`.
 *
 * Covered themes: HazCom; CAZ / CDZ; ironworkerâ€“connectorâ€“decking access; suspended loads and swing;
 * laydown and delivery drivers; fall rescue / suspension trauma and 911; crane permit / pick plan;
 * drugâ€“alcohol (including vehicle + union); end-matter document control.
 */
export const PRESERVED_CSEP_CONTENT_CHECKS: ReadonlyArray<{ id: string; pattern: RegExp; note: string }> = [
  { id: "hazcom_section", pattern: /hazard communication|\bHazCom\b/i, note: "Section 8.0 / HazCom body" },
  {
    id: "caz_definition",
    pattern: /Controlled Access Zone\s*\(CAZ\)|\bCAZ\b.*(restricted|boundary|authorized)/i,
    note: "Definitions or access text defining CAZ",
  },
  {
    id: "caz_requirements",
    pattern: /Use a CAZ|controlled access zone|CAZ (?:is|for|when)/i,
    note: "CAZ operational requirements",
  },
  {
    id: "ironworker_connector_decking_zones",
    pattern: /ironworker|connector|decking crew|Steel Erection Access Control/i,
    note: "Ironworker / connector / decking zone access",
  },
  {
    id: "controlled_decking_zone",
    pattern: /controlled decking zone|\bCDZ\b/i,
    note: "CDZ language",
  },
  {
    id: "suspended_load",
    pattern: /suspended load|under a suspended|beneath a suspended/i,
    note: "Suspended load restrictions",
  },
  {
    id: "crane_swing_load_path",
    pattern: /swing radius|load path|swing path/i,
    note: "Crane swing / load path",
  },
  {
    id: "laydown_controls",
    pattern: /laydown|Designated laydown|staging/i,
    note: "Laydown / staging controls",
  },
  {
    id: "driver_remain_in_vehicle",
    pattern: /remain-in-vehicle|stay in the cab|Drivers stay in the cab/i,
    note: "Driver remain-in-vehicle rule",
  },
  {
    id: "driver_ppe_exiting",
    pattern: /If the driver must exit|PPE if exiting|hard hat.*high-visibility.*exit/i,
    note: "Driver PPE when exiting vehicle",
  },
  {
    id: "fall_rescue_suspension_trauma",
    pattern: /Fall Rescue|fall rescue|suspension trauma|Suspension-trauma/i,
    note: "Fall rescue and suspension trauma response",
  },
  { id: "911_emergency", pattern: /\b911\b|Call 911/i, note: "911 emergency language" },
  {
    id: "crane_permit_pick_plan",
    pattern: /Crane Permit|Pick Plan|Lift Plan/i,
    note: "Crane permit / pick plan / lift plan",
  },
  {
    id: "drug_alcohol_vehicle_rule",
    pattern: /personal vehicles.*(construction site|project-controlled)|drug.*alcohol.*vehicle/i,
    note: "Drug/alcohol in vehicles on site",
  },
  {
    id: "union_drug_alcohol",
    pattern: /\bunion\b|reciprocal-body|collective bargaining/i,
    note: "Union-related drug/alcohol compliance",
  },
];

/** Flatten section map (and optional steel plan JSON) for substring / regex audits. */
export function flattenCsepSectionMapText(sections: readonly GeneratedSafetyPlanSection[]): string {
  const parts: string[] = [];
  const walk = (s: GeneratedSafetyPlanSection) => {
    parts.push(s.title, s.key);
    if (s.summary) parts.push(s.summary);
    if (s.body) parts.push(s.body);
    for (const b of s.bullets ?? []) parts.push(b);
    for (const sub of s.subsections ?? []) {
      parts.push(sub.title);
      if (sub.body) parts.push(sub.body);
      for (const b of sub.bullets ?? []) parts.push(b);
    }
    if (s.table) {
      parts.push(...s.table.columns, ...s.table.rows.flat());
    }
  };
  for (const s of sections) walk(s);
  return parts.join("\n");
}

function collectJsonStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 12) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, out, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectJsonStrings(v, out, depth + 1);
    }
  }
}

export function flattenGeneratedDraftForPreservationSearch(draft: GeneratedSafetyPlanDraft): string {
  const parts = [flattenCsepSectionMapText(draft.sectionMap)];
  if (draft.steelErectionPlan) {
    const strings: string[] = [];
    collectJsonStrings(draft.steelErectionPlan, strings);
    parts.push(strings.join("\n"));
  }
  return parts.join("\n");
}

export function findMissingPreservedCsepContent(haystack: string): string[] {
  return findMissingPreservedCsepContentInAnyHaystack([haystack]);
}

/** Each pattern must match at least one haystack (e.g. generated `sectionMap` plus structured export text). */
export function findMissingPreservedCsepContentInAnyHaystack(haystacks: readonly string[]): string[] {
  const missing: string[] = [];
  for (const { id, pattern } of PRESERVED_CSEP_CONTENT_CHECKS) {
    if (!haystacks.some((h) => pattern.test(h))) missing.push(id);
  }
  return missing;
}
```

## lib\csepDocxNarrativePolish.ts

```ts
/**
 * DOCX-only narrative polish for CSEP export: typography, light structure, and
 * common misspellings. Does not change regulatory meaning or obligations.
 */

export type CsepDocxNarrativePolishMode = "full" | "compact";

const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bDiscplianry\b/gi, "Disciplinary"],
  [/\bcontruction\b/gi, "construction"],
  [/\boccurence\b/gi, "occurrence"],
  [/\boccured\b/gi, "occurred"],
  [/\baccomodate\b/gi, "accommodate"],
  [/\baccomodation\b/gi, "accommodation"],
  [/\bimplimentation\b/gi, "implementation"],
  [/\bmaintainance\b/gi, "maintenance"],
  [/\benviroment\b/gi, "environment"],
  [/\benviromental\b/gi, "environmental"],
  [/\bgoverened\b/gi, "governed"],
  [/\bnoticable\b/gi, "noticeable"],
  [/\bprocedue\b/gi, "procedure"],
  [/\bprocedues\b/gi, "procedures"],
];

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

/** Short numbered outline labels (TOC, etc.) â€” no terminal period or clause splitting. */
function isCompactOutlineLabel(text: string): boolean {
  const t = text.trim();
  if (t.length > 120 || t.includes("\n")) return false;
  const outline = t.match(/^(\d+)\.\s+(.+)$/);
  if (!outline) return false;
  const rest = outline[2] ?? "";
  if (!rest.trim()) return false;
  // Sentence breaks inside the title (not the "13." outline delimiter).
  if (/[.!?]\s+[A-Za-z]/.test(rest)) return false;
  return true;
}

function replaceAwkwardStarts(text: string): string {
  let t = text;
  t = t.replace(/^\s*Are critical components\b/i, "Critical components");
  t = t.replace(/^\s*Are all critical\b/i, "All critical");
  t = t.replace(/^\s*Are required controls\b/i, "Required controls");
  return t;
}

function ensureTerminalPunctuation(text: string): string {
  const t = text.trim();
  if (!t) return t;
  if (/^n\/a$/i.test(t)) return t;
  if (!/\s/.test(t) && t.length <= 4) return t;
  if (/[.!?â€¦]["')\]]?$/.test(t)) return t;
  if (/[.!?â€¦]$/.test(t)) return t;
  if (!/[A-Za-z]$/.test(t)) return t;
  return `${t}.`;
}

function splitLongClauseSegments(text: string): string[] {
  const minTotal = 400;
  const minPart = 42;
  const t = text.trim();
  if (t.length < minTotal || !t.includes("; ")) return [t];
  const parts = t.split(/;\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.some((p) => p.length < minPart)) return [t];
  return parts;
}

export function polishCsepDocxNarrativeText(
  text: string,
  options?: { mode?: CsepDocxNarrativePolishMode; skipTerminalPunctuation?: boolean }
): string {
  const mode = options?.mode ?? "full";
  let t = collapseWhitespace(text).trim();
  if (!t) return t;

  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    t = t.replace(pattern, replacement);
  }

  if (mode === "compact" || isCompactOutlineLabel(t)) {
    return t;
  }

  t = replaceAwkwardStarts(t);
  if (options?.skipTerminalPunctuation) {
    return t;
  }
  return ensureTerminalPunctuation(t);
}

/**
 * Splits builder `body` on blank lines, collapses excessive breaks, optionally
 * breaks very long semicolon-heavy clauses into separate DOCX paragraphs.
 */
export function splitCsepDocxBodyIntoSegments(body: string): string[] {
  const normalized = collapseWhitespace(body);
  return normalized
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .flatMap((segment) => {
      const chunks = splitLongClauseSegments(segment);
      return chunks.map((chunk) => polishCsepDocxNarrativeText(chunk.trim())).filter(Boolean);
    });
}
```

## lib\csepDocxReadableParagraphs.ts

```ts
/**
 * Estimates DOCX body line count (Calibri ~11 pt, typical CSEP indent) and splits
 * long narrative so export paragraphs stay scannable in the field (~6 lines max).
 */

const DEFAULT_CHARS_PER_LINE = 82;

function hardWrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const w of words) {
    const next = buf ? `${buf} ${w}` : w;
    if (next.length <= maxChars) {
      buf = next;
    } else {
      if (buf) out.push(buf);
      buf = w.length > maxChars ? `${w.slice(0, maxChars - 1)}â€¦` : w;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Splits one narrative block into multiple DOCX paragraphs when estimated line
 * count exceeds `maxLines` (default 6).
 */
export function splitParagraphAtEstimatedDocxLineCount(
  text: string,
  options?: { maxLines?: number; charsPerLine?: number }
): string[] {
  const maxLines = options?.maxLines ?? 6;
  const charsPerLine = options?.charsPerLine ?? DEFAULT_CHARS_PER_LINE;
  const maxChars = maxLines * charsPerLine;
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z(0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return hardWrapWords(trimmed, maxChars);
  }

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxChars) {
        current = sentence;
      } else {
        chunks.push(...hardWrapWords(sentence, maxChars));
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Applies line-count splitting to every paragraph string. */
export function expandParagraphsForDocxReadability(paragraphs: string[] | undefined): string[] {
  return (paragraphs ?? []).flatMap((p) => splitParagraphAtEstimatedDocxLineCount(p));
}
```

## lib\csepLegacyDocx.ts

```ts
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
} from "@/lib/csep/csep-renderer";
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
  // Appendix E â€” keeping the main body readable instead of embedding the wide
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
```

## lib\csepGcCmPartners.ts

```ts
import { normalizeFinalExportText } from "@/lib/csepFinalization";

/**
 * Parses GC / CM / program partner entries from builder form data or draft JSON.
 * Accepts a string (legacy or textarea), a JSON array of strings, or a single-item array.
 * Preserves user order; trims entries; drops empty lines. Does not merge distinct partners.
 */
export function normalizeGcCmPartnerEntries(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.replace(/^\s*[-*â€¢]\s*/, "").trim() : ""))
      .filter(Boolean);
  }
  const raw = typeof value === "string" ? value : "";
  const parts = raw
    .replace(/\r\n?/g, "\n")
    .split(/\n|;/)
    .map((item) => item.replace(/^\s*[-*â€¢]\s*/, "").trim())
    .filter(Boolean);

  return parts;
}

/**
 * One partner â†’ plain text. Several â†’ leading-dash lines (Word line breaks via `\n`).
 * Empty â†’ `"N/A"`.
 */
export function formatGcCmPartnersForExport(entries: readonly string[]): string {
  const cleaned = entries
    .map((entry) => normalizeFinalExportText(entry)?.trim() ?? "")
    .filter(Boolean);
  if (!cleaned.length) return "N/A";
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.map((line) => `- ${line}`).join("\n");
}

export function gcCmPartnersHaystack(entries: readonly string[] | string | null | undefined): string {
  if (Array.isArray(entries)) {
    return entries.join(" ");
  }
  return typeof entries === "string" ? entries : "";
}
```

## lib\csepApiGuard.ts

```ts
import { NextResponse } from "next/server";
import { CSEP_PLAN_NAME } from "@/lib/workspaceProduct";

export function csepWorkspaceForbiddenResponse() {
  return NextResponse.json(
    {
      error:
        "This workspace is limited to CSEP. This feature is not available on your current workspace product.",
    },
    { status: 403 }
  );
}

type SubscriptionRow = { plan_name?: string | null };

/** Resolve whether the company's subscription is the CSEP-only tier. */
export async function companyHasCsepPlanName(
  supabase: unknown,
  companyId: string
): Promise<boolean> {
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: SubscriptionRow | null;
            error: { message?: string | null } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await client
    .from("company_subscriptions")
    .select("plan_name")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return ((data as SubscriptionRow).plan_name ?? "").trim() === CSEP_PLAN_NAME;
}

/**
 * Block full-product company module APIs for CSEP-only workspaces (plan_name = CSEP).
 * Do not use on routes that must stay available for CSEP (e.g. gc-program-document).
 */
export async function blockIfCsepOnlyCompany(
  supabase: unknown,
  companyId: string | null | undefined
): Promise<NextResponse | null> {
  if (!companyId) {
    return null;
  }
  if (await companyHasCsepPlanName(supabase, companyId)) {
    return csepWorkspaceForbiddenResponse();
  }
  return null;
}
```

## lib\csepCompletenessReviewBuilder.ts

```ts
import type {
  DocumentBuilderSectionTemplate,
  DocumentBuilderTextConfig,
} from "@/types/document-builder-text";

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeSection(
  section: DocumentBuilderSectionTemplate,
  depth = 0,
  sink: string[] = []
) {
  const prefix = depth > 0 ? `${section.label} under ${section.title}` : section.label;
  const paragraphText = section.paragraphs
    .map((paragraph) => compactWhitespace(paragraph))
    .filter(Boolean)
    .slice(0, 1);
  const bulletText = section.bullets
    .map((bullet) => compactWhitespace(bullet))
    .filter(Boolean)
    .slice(0, 2);

  const fragments = [...paragraphText, ...bulletText];
  if (fragments.length) {
    sink.push(`${prefix}: ${fragments.join(" ")}`.slice(0, 320));
  } else {
    sink.push(prefix);
  }

  for (const child of section.children) {
    summarizeSection(child, depth + 1, sink);
  }

  return sink;
}

export function buildCsepBuilderExpectationSummary(
  config: DocumentBuilderTextConfig,
  maxItems = 24
) {
  const sections = config.builders.csep.sections;
  const summary = sections.flatMap((section) => summarizeSection(section));
  return summary.filter(Boolean).slice(0, maxItems);
}
```

## lib\csepCompletenessReviewDocx.ts

```ts
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  LevelSuffix,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type {
  BuilderProgramAiReview,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";
import {
  getCsepFindingNoteFields,
  getCsepSectionNoteFields,
} from "@/lib/csepReviewNoteFormat";

const REVIEW_OUTLINE_REFERENCE = "review-outline";

function paragraph(
  text: string,
  options?: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bold?: boolean }
) {
  return new Paragraph({
    heading: options?.heading,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
      }),
    ],
  });
}

function summaryTable(rows: Array<[string, string]>) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                bottom: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                left: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                right: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
              },
              children: [paragraph(label, { bold: true })],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                bottom: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                left: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
                right: { style: BorderStyle.SINGLE, color: "D6E2F1", size: 1 },
              },
              children: [paragraph(value || "Not provided.")],
            }),
          ],
        })
    ),
  });
}

function sectionHeading(text: string) {
  return outlineParagraph(text, 0, {
    heading: HeadingLevel.HEADING_1,
    bold: true,
  });
}

function outlineParagraph(
  text: string,
  level: number,
  options?: {
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
  }
) {
  return new Paragraph({
    heading: options?.heading,
    numbering: {
      reference: REVIEW_OUTLINE_REFERENCE,
      level,
    },
    spacing: {
      before: level === 0 ? 280 : level === 1 ? 180 : 80,
      after: level === 0 ? 180 : level === 1 ? 120 : 80,
      line: 276,
      lineRule: LineRuleType.AUTO,
    },
    border:
      level === 0
        ? {
            bottom: {
              style: BorderStyle.SINGLE,
              color: "A7BED8",
              size: 3,
            },
          }
        : undefined,
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        italics: options?.italics,
      }),
    ],
  });
}

function outlineDetail(label: string, value: string) {
  return new Paragraph({
    numbering: {
      reference: REVIEW_OUTLINE_REFERENCE,
      level: 2,
    },
    spacing: {
      before: 60,
      after: 80,
      line: 276,
      lineRule: LineRuleType.AUTO,
    },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
      }),
      new TextRun({
        text: value || "Not provided.",
      }),
    ],
  });
}

function outlineListItem(text: string) {
  return outlineParagraph(text, 1);
}

function statusLabel(status: BuilderProgramAiReviewSectionNote["status"]) {
  if (status === "present") return "Present";
  if (status === "missing") return "Missing";
  return "Partial";
}

function topPriorityFindings(review: BuilderProgramAiReview) {
  return review.detailedFindings.slice(0, 5).flatMap((finding) => [
    outlineParagraph(finding.sectionLabel, 1, { heading: HeadingLevel.HEADING_2, bold: true }),
    ...getCsepFindingNoteFields(finding).map((field) => outlineDetail(field.label, field.value)),
  ]);
}

function sectionAuditBlock(note: BuilderProgramAiReviewSectionNote) {
  return [
    outlineParagraph(`${note.sectionLabel} (${statusLabel(note.status)})`, 1, {
      heading: HeadingLevel.HEADING_2,
      bold: true,
    }),
    ...getCsepSectionNoteFields(note).map((field) => outlineDetail(field.label, field.value)),
  ];
}

function findingBlock(finding: BuilderProgramAiReview["detailedFindings"][number]) {
  return [
    outlineParagraph(finding.sectionLabel, 1, {
      heading: HeadingLevel.HEADING_2,
      bold: true,
    }),
    ...getCsepFindingNoteFields(finding).map((field) => outlineDetail(field.label, field.value)),
  ];
}

export async function renderCsepCompletenessReviewNotesDocx(params: {
  sourceFileName: string;
  review: BuilderProgramAiReview;
  disclaimer: string;
  reviewerContext?: string | null;
  extractionSummary?: string | null;
  siteReferenceSummary?: string | null;
}) {
  const docChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: "Completed CSEP Review Notes",
          bold: true,
          size: 32,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [
        new TextRun({
          text: `Source document: ${params.sourceFileName}`,
          italics: true,
        }),
      ],
    }),
    summaryTable([
      ["Overall assessment", params.review.overallAssessment.replace(/_/g, " ")],
      ["Executive summary", params.review.executiveSummary],
      ["Scope / hazard coverage", params.review.scopeTradeAndHazardCoverage],
      ["Extraction summary", params.extractionSummary ?? "Not provided."],
      ["Site reference summary", params.siteReferenceSummary ?? "No site / GC reference file attached."],
      ["Reviewer context", params.reviewerContext?.trim() || "No additional reviewer context provided."],
    ]),
    sectionHeading("Missing-items checklist"),
    ...(params.review.missingItemsChecklist.length
      ? params.review.missingItemsChecklist.map((item) => outlineListItem(item))
      : [paragraph("No missing items were identified.")]),
    sectionHeading("Top priority fixes"),
    ...(params.review.detailedFindings.length
      ? topPriorityFindings(params.review)
      : [paragraph("No priority fixes were returned.")]),
    sectionHeading("Builder alignment notes"),
    ...(params.review.builderAlignmentNotes.length
      ? params.review.builderAlignmentNotes.map((item) => outlineListItem(item))
      : [paragraph("No builder alignment notes were returned.")]),
    sectionHeading("Section-by-section builder audit"),
    ...params.review.sectionReviewNotes.flatMap((item) => sectionAuditBlock(item)),
    sectionHeading("Document review findings"),
    ...params.review.detailedFindings.flatMap((finding) => findingBlock(finding)),
    sectionHeading("Document quality notes"),
    ...(params.review.documentQualityIssues?.length
      ? params.review.documentQualityIssues.map((item) => outlineListItem(item))
      : [paragraph("No document quality issues were flagged.")]),
    sectionHeading("Recommended edits"),
    ...(params.review.recommendedEditsBeforeApproval.length
      ? params.review.recommendedEditsBeforeApproval.map((item) => outlineListItem(item))
      : [paragraph("No recommended edits were returned.")]),
    sectionHeading("Embedded note coverage"),
    ...(params.review.noteCoverage?.length
      ? params.review.noteCoverage.map((item) => outlineListItem(item))
      : [paragraph("No embedded DOCX comment coverage was returned.")]),
    sectionHeading("Internal disclaimer"),
    paragraph(params.disclaimer),
  ];

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: REVIEW_OUTLINE_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              suffix: LevelSuffix.SPACE,
              style: {
                paragraph: {
                  indent: { left: 480, hanging: 240 },
                  spacing: { before: 280, after: 180 },
                },
                run: {
                  bold: true,
                  color: "1F3E63",
                  size: 28,
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: "%1.%2",
              alignment: AlignmentType.START,
              suffix: LevelSuffix.SPACE,
              style: {
                paragraph: {
                  indent: { left: 960, hanging: 360 },
                  spacing: { before: 180, after: 120 },
                },
                run: {
                  bold: true,
                  color: "1F3E63",
                  size: 24,
                },
              },
            },
            {
              level: 2,
              format: LevelFormat.DECIMAL,
              text: "%1.%2.%3",
              alignment: AlignmentType.START,
              suffix: LevelSuffix.SPACE,
              style: {
                paragraph: {
                  indent: { left: 1440, hanging: 420 },
                  spacing: { before: 80, after: 80 },
                },
                run: {
                  color: "1F1F1F",
                  size: 22,
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: docChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
```

## lib\annotateCsepReviewDocx.ts

```ts
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type {
  BuilderProgramAiReview,
  BuilderProgramAiReviewFinding,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";
import { formatCsepFindingNote } from "@/lib/csepReviewNoteFormat";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const COMMENTS_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
const COMMENTS_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
type XmlNodeLike = {
  nodeName?: string | null;
  textContent?: string | null;
  childNodes?: ArrayLike<XmlNodeLike>;
};

function localName(nodeName: string | null | undefined) {
  if (!nodeName) return "";
  const parts = nodeName.split(":");
  return parts[parts.length - 1] ?? "";
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function collectText(node: XmlNodeLike, parts: string[]) {
  const name = localName(node.nodeName);

  if (name === "t" || name === "delText") {
    if (node.textContent) parts.push(node.textContent);
    return;
  }

  if (name === "tab") {
    parts.push(" ");
    return;
  }

  if (name === "br" || name === "cr") {
    parts.push("\n");
    return;
  }

  const children = node.childNodes ?? [];
  for (let index = 0; index < children.length; index += 1) {
    collectText(children[index], parts);
  }

  if (name === "p") {
    parts.push("\n");
  }
}

function getElementsByLocalName(doc: Document, name: string): Element[] {
  const result: Element[] = [];
  const elements = doc.getElementsByTagName("*");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (localName(element.nodeName) === name) {
      result.push(element);
    }
  }
  return result;
}

function buildMatchTokens(text: string) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .slice(0, 18);
}

function paragraphScore(paragraphText: string, finding: ReviewCommentTarget) {
  const paragraphLower = paragraphText.toLowerCase();
  const exampleText = normalizeWhitespace(finding.documentExample.replace(/\.\.\./g, " "));
  const exampleLower = exampleText.toLowerCase();

  let score = 0;
  if (exampleLower && exampleLower.length >= 18 && paragraphLower.includes(exampleLower.slice(0, 80))) {
    score += 40;
  }

  for (const token of buildMatchTokens(`${finding.sectionLabel} ${finding.issue} ${exampleText}`)) {
    if (paragraphLower.includes(token)) {
      score += 4;
    }
  }

  if (paragraphLower.includes(finding.sectionLabel.toLowerCase())) {
    score += 12;
  }

  return score;
}

type ReviewCommentTarget = {
  sectionLabel: string;
  issue: string;
  documentExample: string;
  preferredExample: string;
  reviewerNote: string;
  referenceSupport?: string;
  whyItMatters?: string;
};

function sectionNoteToCommentTarget(note: BuilderProgramAiReviewSectionNote): ReviewCommentTarget {
  return {
    sectionLabel: note.sectionLabel,
    issue:
      note.status === "missing"
        ? `${note.sectionLabel} is missing or not clearly developed in the document.`
        : note.whatNeedsWork,
    documentExample: note.whatWasFound,
    preferredExample: note.suggestedBuilderTarget,
    reviewerNote: note.whatNeedsWork,
    referenceSupport: undefined,
    whyItMatters: undefined,
  };
}

function findingToCommentTarget(finding: BuilderProgramAiReviewFinding): ReviewCommentTarget {
  return {
    sectionLabel: finding.sectionLabel,
    issue: finding.issue,
    documentExample: finding.documentExample,
    preferredExample: finding.preferredExample,
    reviewerNote: finding.reviewerNote,
    referenceSupport: finding.referenceSupport,
    whyItMatters: finding.whyItMatters,
  };
}

function buildCommentTargets(review: BuilderProgramAiReview) {
  const targets: ReviewCommentTarget[] = [];
  const seen = new Set<string>();

  for (const note of review.sectionReviewNotes) {
    if (note.status === "present") continue;
    const target = sectionNoteToCommentTarget(note);
    const key = `${target.sectionLabel.toLowerCase()}::${normalizeWhitespace(target.issue).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }

  for (const finding of review.detailedFindings) {
    if (finding.sentiment === "positive") continue;
    const target = findingToCommentTarget(finding);
    const key = `${target.sectionLabel.toLowerCase()}::${normalizeWhitespace(target.issue).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }

  return targets;
}

function composeCommentText(target: ReviewCommentTarget, _index: number) {
  return formatCsepFindingNote({
    sectionLabel: target.sectionLabel,
    sentiment: "negative",
    issue: `${target.sectionLabel}: ${target.issue}`,
    problem: target.issue,
    documentExample: target.documentExample,
    preferredExample: target.preferredExample,
    reviewerNote: target.reviewerNote,
    requiredOutput: target.preferredExample,
    acceptanceCheck:
      "The updated paragraph is specific to the actual work, matches the section intent, and reads like final issue language.",
    doNot:
      "Do not leave this as a generic note, checklist fragment, or placeholder statement that is not tied to the paragraph.",
    referenceSupport: target.referenceSupport,
    whyItMatters: target.whyItMatters,
  });
}

function findBestParagraphIndex(
  paragraphTexts: string[],
  target: ReviewCommentTarget
) {
  let bestIndex = -1;
  let bestScore = 0;

  paragraphTexts.forEach((paragraphText, index) => {
    const score = paragraphScore(paragraphText, target);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0) {
    return bestIndex;
  }

  const sectionLabel = target.sectionLabel.toLowerCase();
  const headingIndex = paragraphTexts.findIndex((paragraphText) =>
    paragraphText.toLowerCase().includes(sectionLabel)
  );
  if (headingIndex >= 0) {
    return headingIndex;
  }
  return -1;
}

function ensureCommentsDocument(zip: JSZip) {
  const commentsFile = zip.file("word/comments.xml");
  if (commentsFile) {
    return commentsFile.async("text").then((xml) => new DOMParser().parseFromString(xml, "text/xml"));
  }

  return Promise.resolve(
    new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${WORD_NS}"></w:comments>`,
      "text/xml"
    )
  );
}

function ensureCommentsRelationship(relsDoc: Document) {
  const relationships = getElementsByLocalName(relsDoc, "Relationship");
  const hasCommentsRel = relationships.some(
    (rel) => rel.getAttribute("Type") === COMMENTS_REL_TYPE || rel.getAttribute("Target") === "comments.xml"
  );
  if (hasCommentsRel) return;

  const ids = relationships
    .map((rel) => rel.getAttribute("Id") ?? "")
    .filter(Boolean)
    .map((id) => Number(id.replace(/^rId/i, "")))
    .filter((value) => Number.isFinite(value));
  const nextId = ids.length ? Math.max(...ids) + 1 : 1;
  const relNode = relsDoc.createElementNS(REL_NS, "Relationship");
  relNode.setAttribute("Id", `rId${nextId}`);
  relNode.setAttribute("Type", COMMENTS_REL_TYPE);
  relNode.setAttribute("Target", "comments.xml");
  relsDoc.documentElement.appendChild(relNode);
}

function ensureCommentsContentType(contentTypesDoc: Document) {
  const overrides = getElementsByLocalName(contentTypesDoc, "Override");
  const hasOverride = overrides.some((node) => node.getAttribute("PartName") === "/word/comments.xml");
  if (hasOverride) return;

  const overrideNode = contentTypesDoc.createElement("Override");
  overrideNode.setAttribute("PartName", "/word/comments.xml");
  overrideNode.setAttribute("ContentType", COMMENTS_CONTENT_TYPE);
  contentTypesDoc.documentElement.appendChild(overrideNode);
}

function createCommentReferenceRun(doc: Document, commentId: string) {
  const run = doc.createElementNS(WORD_NS, "w:r");
  const runProps = doc.createElementNS(WORD_NS, "w:rPr");
  const runStyle = doc.createElementNS(WORD_NS, "w:rStyle");
  runStyle.setAttribute("w:val", "CommentReference");
  runProps.appendChild(runStyle);
  run.appendChild(runProps);

  const reference = doc.createElementNS(WORD_NS, "w:commentReference");
  reference.setAttribute("w:id", commentId);
  run.appendChild(reference);
  return run;
}

function appendCommentEntry(commentsDoc: Document, commentId: string, note: string) {
  const commentNode = commentsDoc.createElementNS(WORD_NS, "w:comment");
  commentNode.setAttribute("w:id", commentId);
  commentNode.setAttribute("w:author", "Safety360Docs Review");
  commentNode.setAttribute("w:initials", "SD");
  commentNode.setAttribute("w:date", new Date().toISOString());

  const paragraph = commentsDoc.createElementNS(WORD_NS, "w:p");
  const run = commentsDoc.createElementNS(WORD_NS, "w:r");
  const text = commentsDoc.createElementNS(WORD_NS, "w:t");
  text.appendChild(commentsDoc.createTextNode(note));
  run.appendChild(text);
  paragraph.appendChild(run);
  commentNode.appendChild(paragraph);
  commentsDoc.documentElement.appendChild(commentNode);
}

export async function annotateCsepReviewDocx(params: {
  buffer: Buffer;
  review: BuilderProgramAiReview;
}) {
  const zip = await JSZip.loadAsync(params.buffer);
  const documentXmlFile = zip.file("word/document.xml");
  const relsFile = zip.file("word/_rels/document.xml.rels");
  const contentTypesFile = zip.file("[Content_Types].xml");

  if (!documentXmlFile || !relsFile || !contentTypesFile) {
    throw new Error("Uploaded DOCX is missing required Word document parts.");
  }

  const [documentXml, relsXml, contentTypesXml, commentsDoc] = await Promise.all([
    documentXmlFile.async("text"),
    relsFile.async("text"),
    contentTypesFile.async("text"),
    ensureCommentsDocument(zip),
  ]);

  const documentDoc = new DOMParser().parseFromString(documentXml, "text/xml");
  const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
  const contentTypesDoc = new DOMParser().parseFromString(contentTypesXml, "text/xml");
  const paragraphs = getElementsByLocalName(documentDoc, "p");

  const paragraphTexts = paragraphs.map((paragraph) => {
    const parts: string[] = [];
    collectText(paragraph, parts);
    return normalizeWhitespace(parts.join(" "));
  });

  const commentTargets = buildCommentTargets(params.review);
  const commentPlacements: Array<{ paragraphIndex: number; target: ReviewCommentTarget }> = [];
  const usedParagraphIndexes = new Set<number>();
  for (const target of commentTargets) {
    const bestIndex = findBestParagraphIndex(paragraphTexts, target);
    if (bestIndex < 0) continue;
    usedParagraphIndexes.add(bestIndex);
    commentPlacements.push({ paragraphIndex: bestIndex, target });
  }

  const existingComments = getElementsByLocalName(commentsDoc, "comment");
  let nextCommentId = existingComments.length
    ? Math.max(
        ...existingComments.map((node) => Number(node.getAttribute("w:id") ?? node.getAttribute("id") ?? 0))
      ) + 1
    : 0;

  const sortedPlacements = [...commentPlacements].sort(
    (left, right) => right.paragraphIndex - left.paragraphIndex
  );
  for (let placementIndex = 0; placementIndex < sortedPlacements.length; placementIndex += 1) {
    const placement = sortedPlacements[placementIndex];
    const paragraph = paragraphs[placement.paragraphIndex];
    if (!paragraph) continue;

    const commentId = String(nextCommentId++);
    appendCommentEntry(
      commentsDoc,
      commentId,
      composeCommentText(placement.target, sortedPlacements.length - placementIndex)
    );

    const rangeStart = documentDoc.createElementNS(WORD_NS, "w:commentRangeStart");
    rangeStart.setAttribute("w:id", commentId);
    const rangeEnd = documentDoc.createElementNS(WORD_NS, "w:commentRangeEnd");
    rangeEnd.setAttribute("w:id", commentId);
    const referenceRun = createCommentReferenceRun(documentDoc, commentId);

    if (paragraph.firstChild) {
      paragraph.insertBefore(rangeStart, paragraph.firstChild);
    } else {
      paragraph.appendChild(rangeStart);
    }
    paragraph.appendChild(rangeEnd);
    paragraph.appendChild(referenceRun);
  }

  ensureCommentsRelationship(relsDoc);
  ensureCommentsContentType(contentTypesDoc);

  const serializer = new XMLSerializer();
  zip.file("word/document.xml", serializer.serializeToString(documentDoc));
  zip.file("word/comments.xml", serializer.serializeToString(commentsDoc));
  zip.file("word/_rels/document.xml.rels", serializer.serializeToString(relsDoc));
  zip.file("[Content_Types].xml", serializer.serializeToString(contentTypesDoc));

  return zip.generateAsync({ type: "nodebuffer" });
}
```

## lib\csepReviewNoteFormat.ts

```ts
import type {
  BuilderProgramAiReviewFinding,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";

function compactWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripSectionLabelPrefix(value: string | null | undefined, sectionLabel: string) {
  const normalized = compactWhitespace(value);
  if (!normalized || !sectionLabel) return normalized;
  return normalized.replace(new RegExp(`^${escapeRegExp(sectionLabel)}\\s*:\\s*`, "i"), "").trim();
}

function normalizeReferenceValue(referenceSupport?: string) {
  const normalized = compactWhitespace(referenceSupport);
  if (!normalized) return "";

  return normalized
    .replace(/^reference document(?: excerpt)?\s*:\s*/i, "")
    .replace(/^reference document\s*\([^)]+\)\s*:\s*/i, "")
    .trim();
}

/**
 * Concrete-language fallbacks used when a finding/section note is missing one
 * of the build-instruction fields. Mirrors the helpers in
 * lib/builderDocumentAiReview.ts so the rendered output never falls back to
 * vague editorial wording.
 */
function defaultProblemForSection(sectionLabel: string, statusOrSentiment?: string) {
  const label = sectionLabel.trim() || "this section";
  if (statusOrSentiment === "missing") {
    return `${label} is not present in the current CSEP output.`;
  }
  if (statusOrSentiment === "partial") {
    return `${label} is referenced but not built out in the current CSEP output.`;
  }
  return `${label} is in the document but does not yet match the required CSEP build target.`;
}

function defaultRequiredOutputForSection(sectionLabel: string) {
  const label = sectionLabel.trim() || "this section";
  return `Build ${label} as its own labeled section using the builder template structure with all required subsections populated from the project record.`;
}

function defaultAcceptanceCheck(sectionLabel: string, statusOrSentiment?: string) {
  const label = sectionLabel.trim() || "this section";
  if (statusOrSentiment === "missing") {
    return `${label} appears as its own labeled section in the body with the required structure populated and no placeholder wording.`;
  }
  return `${label} reads as a final, project-specific build instruction with the required structure populated and no vague filler.`;
}

function defaultDoNot(sectionLabel: string) {
  const label = sectionLabel.trim() || "this section";
  return `Do not leave ${label} as a vague editorial note, do not duplicate it in another section, and do not introduce 'tighten' / 'improve' / 'sounds generic' filler wording.`;
}

type ReviewNoteFields = {
  section: string;
  problem: string;
  requiredOutput: string;
  acceptanceCheck: string;
  doNot: string;
  reference: string;
};

function pickSectionNoteFields(note: BuilderProgramAiReviewSectionNote): ReviewNoteFields {
  const sectionLabel = note.sectionLabel?.trim() || "Unspecified section";
  const problem =
    compactWhitespace(note.problem) ||
    compactWhitespace(stripSectionLabelPrefix(note.whatWasFound, sectionLabel)) ||
    defaultProblemForSection(sectionLabel, note.status);
  const requiredOutput =
    compactWhitespace(stripSectionLabelPrefix(note.requiredOutput, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(note.suggestedBuilderTarget, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(note.whatNeedsWork, sectionLabel)) ||
    defaultRequiredOutputForSection(sectionLabel);
  const acceptanceCheck =
    compactWhitespace(note.acceptanceCheck) || defaultAcceptanceCheck(sectionLabel, note.status);
  const doNot = compactWhitespace(note.doNot) || defaultDoNot(sectionLabel);
  return {
    section: sectionLabel,
    problem,
    requiredOutput,
    acceptanceCheck,
    doNot,
    reference: normalizeReferenceValue(note.referenceSupport),
  };
}

function pickFindingFields(finding: BuilderProgramAiReviewFinding): ReviewNoteFields {
  const sectionLabel = finding.sectionLabel?.trim() || "Unspecified section";
  const problem =
    compactWhitespace(finding.problem) ||
    compactWhitespace(stripSectionLabelPrefix(finding.issue, sectionLabel)) ||
    defaultProblemForSection(sectionLabel, finding.sentiment);
  const requiredOutput =
    compactWhitespace(stripSectionLabelPrefix(finding.requiredOutput, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(finding.preferredExample, sectionLabel)) ||
    compactWhitespace(stripSectionLabelPrefix(finding.reviewerNote, sectionLabel)) ||
    defaultRequiredOutputForSection(sectionLabel);
  const acceptanceCheck =
    compactWhitespace(finding.acceptanceCheck) ||
    defaultAcceptanceCheck(sectionLabel, finding.sentiment === "positive" ? "present" : finding.sentiment);
  const doNot = compactWhitespace(finding.doNot) || defaultDoNot(sectionLabel);
  return {
    section: sectionLabel,
    problem,
    requiredOutput,
    acceptanceCheck,
    doNot,
    reference: normalizeReferenceValue(finding.referenceSupport),
  };
}

function fieldsToList(fields: ReviewNoteFields) {
  const list = [
    { label: "Section", value: fields.section },
    { label: "Problem", value: fields.problem },
    { label: "Required Output", value: fields.requiredOutput },
    { label: "Acceptance Check", value: fields.acceptanceCheck },
    { label: "Do Not", value: fields.doNot },
  ];
  if (fields.reference) {
    list.push({ label: "Reference", value: fields.reference });
  }
  return list;
}

function fieldsToString(fields: ReviewNoteFields) {
  const parts = [
    `Section: ${fields.section}`,
    `Problem: ${fields.problem}`,
    `Required Output: ${fields.requiredOutput}`,
    `Acceptance Check: ${fields.acceptanceCheck}`,
    `Do Not: ${fields.doNot}`,
  ];
  if (fields.reference) {
    parts.push(`Reference: ${fields.reference}`);
  }
  return parts.join("\n");
}

export function getCsepFindingNoteFields(finding: BuilderProgramAiReviewFinding) {
  return fieldsToList(pickFindingFields(finding));
}

export function formatCsepFindingNote(finding: BuilderProgramAiReviewFinding) {
  return fieldsToString(pickFindingFields(finding));
}

export function getCsepSectionNoteFields(note: BuilderProgramAiReviewSectionNote) {
  return fieldsToList(pickSectionNoteFields(note));
}

export function formatCsepSectionNote(note: BuilderProgramAiReviewSectionNote) {
  return fieldsToString(pickSectionNoteFields(note));
}
```

## lib\csepSurveyTest.ts

```ts
import { normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
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
  gc_cm: string | string[];
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
    `Project-specific safety notes: ${input.site_specific_notes.trim() || "Not provided."}`,
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
    gc_cm: normalizeGcCmPartnerEntries(input.gc_cm),
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
```

## lib\csepEnrichmentPricing.ts

```ts
import type {
  CSEPPricedItemCatalogEntry,
  CSEPPricedItemSelection,
} from "@/types/csep-priced-items";

type DerivePricedItemsParams = {
  trade?: string | null;
  subTrade?: string | null;
  tasks?: string[];
  selectedHazards?: string[];
  derivedHazards?: string[];
  selectedPermits?: string[];
};

type ResolvePricedItemsParams = {
  selectedKeys?: string[];
  eligibleItems?: CSEPPricedItemCatalogEntry[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean))];
}

function toCatalogSelection(item: CSEPPricedItemCatalogEntry): CSEPPricedItemSelection {
  return {
    key: item.key,
    label: item.label,
    category: item.category,
    price: item.price,
    source: "catalog",
  };
}

function matchesAny(targets: Set<string>, values?: string[]) {
  if (!values?.length) return false;
  return values.some((value) => targets.has(normalize(value)));
}

function includesTaskToken(taskText: string, tokens?: string[]) {
  if (!tokens?.length) return false;
  return tokens.some((token) => taskText.includes(normalize(token)));
}

export const CSEP_PRICED_ITEM_CATALOG: CSEPPricedItemCatalogEntry[] = [
  {
    key: "hot_work_permit",
    label: "Hot Work Permit",
    category: "permit",
    price: 85,
    triggers: {
      permits: ["Hot Work Permit"],
    },
  },
  {
    key: "confined_space_permit",
    label: "Confined Space Permit",
    category: "permit",
    price: 175,
    triggers: {
      permits: ["Confined Space Permit"],
    },
  },
  {
    key: "loto_permit",
    label: "LOTO Permit",
    category: "permit",
    price: 95,
    triggers: {
      permits: ["LOTO Permit"],
    },
  },
  {
    key: "ladder_permit",
    label: "Ladder Permit",
    category: "permit",
    price: 60,
    triggers: {
      permits: ["Ladder Permit"],
    },
  },
  {
    key: "awp_mewp_permit",
    label: "AWP/MEWP Permit",
    category: "permit",
    price: 145,
    triggers: {
      permits: ["AWP/MEWP Permit"],
    },
  },
  {
    key: "ground_disturbance_permit",
    label: "Ground Disturbance Permit",
    category: "permit",
    price: 210,
    triggers: {
      permits: ["Ground Disturbance Permit"],
    },
  },
  {
    key: "trench_inspection_permit",
    label: "Trench Inspection Permit",
    category: "permit",
    price: 185,
    triggers: {
      permits: ["Trench Inspection Permit"],
    },
  },
  {
    key: "chemical_permit",
    label: "Chemical Permit",
    category: "permit",
    price: 70,
    triggers: {
      permits: ["Chemical Permit"],
    },
  },
  {
    key: "motion_permit",
    label: "Motion Permit",
    category: "permit",
    price: 120,
    triggers: {
      permits: ["Motion Permit"],
    },
  },
  {
    key: "temperature_permit",
    label: "Temperature Permit",
    category: "permit",
    price: 65,
    triggers: {
      permits: ["Temperature Permit"],
    },
  },
  {
    key: "gravity_permit",
    label: "Gravity Permit",
    category: "permit",
    price: 110,
    triggers: {
      permits: ["Gravity Permit"],
    },
  },
  {
    key: "fall_protection_rescue_plan",
    label: "Fall Protection Rescue Plan",
    category: "add_on",
    price: 450,
    triggers: {
      hazards: ["Falls from height"],
      permits: ["Ladder Permit", "AWP/MEWP Permit", "Gravity Permit"],
      taskTokens: [
        "roof",
        "ladder",
        "mewp",
        "elevat",
        "anchor",
        "fall protection",
        "scaffold",
        "steel erection",
      ],
    },
  },
];

export function formatCsepPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

export function deriveEligibleCsepPricedItems(
  params: DerivePricedItemsParams
): CSEPPricedItemCatalogEntry[] {
  const tradeTargets = new Set(uniq([params.trade ?? "", params.subTrade ?? ""]).map(normalize));
  const hazardTargets = new Set(
    uniq([...(params.selectedHazards ?? []), ...(params.derivedHazards ?? [])]).map(normalize)
  );
  const permitTargets = new Set(uniq(params.selectedPermits ?? []).map(normalize));
  const taskText = uniq(params.tasks ?? []).join(" ").toLowerCase();

  return CSEP_PRICED_ITEM_CATALOG.filter((item) => {
    const tradeMatch =
      matchesAny(tradeTargets, item.triggers.trades) ||
      matchesAny(tradeTargets, item.triggers.subTrades);
    const hazardMatch = matchesAny(hazardTargets, item.triggers.hazards);
    const permitMatch = matchesAny(permitTargets, item.triggers.permits);
    const taskMatch = includesTaskToken(taskText, item.triggers.taskTokens);

    return tradeMatch || hazardMatch || permitMatch || taskMatch;
  });
}

export function resolveSelectedCsepPricedItems(
  params: ResolvePricedItemsParams
): CSEPPricedItemSelection[] {
  const selectedKeys = new Set(uniq(params.selectedKeys ?? []));
  if (selectedKeys.size === 0) return [];

  return (params.eligibleItems ?? [])
    .filter((item) => selectedKeys.has(item.key))
    .map((item) => toCatalogSelection(item));
}

export function normalizePricedItemSelections(value: unknown): CSEPPricedItemSelection[] {
  if (!Array.isArray(value)) return [];

  const catalogByKey = new Map(CSEP_PRICED_ITEM_CATALOG.map((item) => [item.key, item]));
  const selections = new Map<string, CSEPPricedItemSelection>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const key = typeof (entry as { key?: unknown }).key === "string"
      ? (entry as { key: string }).key.trim()
      : "";
    if (!key) continue;

    const catalogItem = catalogByKey.get(key);
    if (catalogItem) {
      selections.set(key, toCatalogSelection(catalogItem));
      continue;
    }

    const label = typeof (entry as { label?: unknown }).label === "string"
      ? (entry as { label: string }).label.trim()
      : "";
    const category = (entry as { category?: unknown }).category;
    const price = (entry as { price?: unknown }).price;

    if (!label) continue;
    if (category !== "permit" && category !== "add_on") continue;
    if (typeof price !== "number" || !Number.isFinite(price)) continue;

    selections.set(key, {
      key,
      label,
      category,
      price,
      source: "catalog",
    });
  }

  return [...selections.values()];
}
```

## lib\runAdHocCompletedCsepRebuild.ts

```ts
import { extractResponsesApiOutputText } from "@/lib/ai/responses";
import {
  CSEP_FORMAT_SECTION_OPTIONS,
  getCsepFormatDefinition,
} from "@/lib/csepBuilder";
import { renderGeneratedCsepDocx } from "@/lib/csep/csep-renderer";
import { normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import {
  extractBuilderReviewDocumentText,
  generateBuilderProgramAiReview,
  type BuilderProgramAiReview,
} from "@/lib/builderDocumentAiReview";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";
import { serverLog } from "@/lib/serverLog";
import type {
  GeneratedSafetyPlanDraft,
  GeneratedSafetyPlanSection,
  RiskBand,
} from "@/types/safety-intelligence";

const DEFAULT_REBUILD_MODEL = "gpt-4o-mini";
const MAX_SOURCE_TEXT = 85000;
const MAX_REFERENCE_TEXT = 45000;

type CompletedCsepRebuildSection = {
  key: (typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"];
  body: string;
  bullets: string[];
  subsections: Array<{
    title: string;
    body: string;
    bullets: string[];
  }>;
};

type CompletedCsepRebuildPayload = {
  title: string;
  documentControl: {
    documentNumber: string;
    revision: string;
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
  };
  projectOverview: {
    projectName: string;
    projectNumber: string;
    projectAddress: string;
    ownerClient: string;
    gcCm: string | string[];
    contractorCompany: string;
    schedule: string;
    location: string;
  };
  operations: {
    tradeLabel: string;
    subTradeLabel: string;
    taskTitles: string[];
    equipmentUsed: string[];
    workConditions: string[];
    hazardCategories: string[];
    permitTriggers: string[];
    ppeRequirements: string[];
    requiredControls: string[];
    siteRestrictions: string[];
    conflicts: string[];
  };
  trainingRequirements: string[];
  riskBand: RiskBand;
  riskPriorities: string[];
  sections: CompletedCsepRebuildSection[];
};

function compactWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStructuredText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => compactWhitespace(value)).filter(Boolean))
  );
}

function normalizeToken(value: string | null | undefined) {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueByNormalized(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(value);
  }
  return next;
}

function trimTo(value: string, max: number) {
  const normalized = compactWhitespace(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trim()}...`;
}

function trimStructuredText(value: string, max: number) {
  const normalized = normalizeStructuredText(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trim()}\n...`;
}

function buildSourceOutline(value: string, maxItems = 30) {
  const lines = normalizeStructuredText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const outline = lines.filter((line) => {
    if (line.length > 140) return false;
    if (/^\d+(?:\.\d+)*\s+/.test(line)) return true;
    if (/^(appendix|section)\b/i.test(line)) return true;
    if (/^[A-Z][A-Za-z/&,\- ]{4,}$/.test(line) && !line.endsWith(".")) return true;
    return false;
  });

  return uniqueStrings(outline).slice(0, maxItems);
}

type SourceSectionBlock = {
  heading: string;
  lines: string[];
};

const SOURCE_SECTION_ALIASES: Partial<
  Record<(typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"], string[]>
> = {
  company_overview_and_safety_philosophy: [
    "company overview",
    "safety philosophy",
    "policy statement",
    "goals and objectives",
  ],
  project_scope_and_trade_specific_activities: [
    "scope of work",
    "work scope",
    "trade activities",
    "project scope",
  ],
  roles_and_responsibilities: [
    "roles and responsibilities",
    "responsibilities",
    "project team",
    "contacts",
    "key personnel",
  ],
  regulatory_framework: [
    "regulatory framework",
    "osha references",
    "standards",
    "codes and standards",
  ],
  contractor_safety_meetings_and_engagement: [
    "training",
    "instruction",
    "competency",
    "orientation",
    "certification",
  ],
  emergency_preparedness_and_response: [
    "emergency",
    "incident response",
    "medical response",
    "rescue",
    "evacuation",
  ],
  personal_protective_equipment: [
    "personal protective equipment",
    "ppe",
    "protective equipment",
  ],
  hse_elements_and_site_specific_hazard_analysis: [
    "hazards and controls",
    "hazard controls",
    "hazard mitigation",
    "risk controls",
  ],
  safe_work_practices_and_trade_specific_procedures: [
    "safe work practices",
    "procedures",
    "work practices",
    "trade specific procedures",
  ],
  permits_and_forms: [
    "permits",
    "permit requirements",
    "permit coordination",
    "forms",
    "hot work",
    "lift plan",
  ],
  checklists_and_inspections: [
    "inspections",
    "quality control",
    "inspection process",
    "verification",
  ],
  environmental_execution_requirements: [
    "environmental",
    "environmental controls",
    "spill response",
    "stormwater",
  ],
  contractor_monitoring_audits_and_reporting: [
    "incident reporting",
    "incident investigation",
    "near miss",
    "reporting and investigation",
    "audits",
    "monitoring",
    "reporting",
    "program oversight",
    "recordkeeping",
    "records",
    "retention",
    "documentation",
  ],
  contractor_iipp: [
    "injury and illness prevention",
    "iipp",
    "program requirements",
  ],
};

function stripSourceHeadingNumber(value: string) {
  return value
    .replace(/^\s*(?:section\s+)?(?:appendix\s+[A-Z]\.?\s*)?(?:\d+(?:\.\d+)*\.?)\s*/i, "")
    .trim();
}

function isHeadingCandidate(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 140) return false;
  if (/^\d+(?:\.\d+)*\.?\s+[A-Z]/.test(trimmed)) return true;
  if (/^appendix\s+[A-Z]/i.test(trimmed)) return true;
  if (/^[A-Z][A-Za-z/&,\-() ]{4,}$/.test(trimmed) && !trimmed.endsWith(".")) return true;
  return false;
}

function extractSourceSectionBlocks(value: string) {
  const lines = normalizeStructuredText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: SourceSectionBlock[] = [];
  let current: SourceSectionBlock | null = null;

  for (const line of lines) {
    if (isHeadingCandidate(line)) {
      if (current && current.lines.length) {
        blocks.push(current);
      }
      current = { heading: line, lines: [] };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (current && current.lines.length) {
    blocks.push(current);
  }

  return blocks;
}

function scoreSourceBlockMatch(
  key: (typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"],
  heading: string,
  bodyLines: string[]
) {
  const definition = getCsepFormatDefinition(key);
  const headingToken = normalizeToken(stripSourceHeadingNumber(heading));
  const bodyToken = normalizeToken(bodyLines.slice(0, 6).join(" "));
  const titleTokens = uniqueStrings([
    definition?.title,
    definition?.shortTitle,
    ...(SOURCE_SECTION_ALIASES[key] ?? []),
  ]).map((value) => normalizeToken(value));

  let score = 0;
  for (const token of titleTokens) {
    if (!token) continue;
    if (headingToken === token) score += 10;
    else if (headingToken.includes(token) || token.includes(headingToken)) score += 7;
    else if (bodyToken.includes(token)) score += 3;
  }

  return score;
}

function mapSourceBlocksToSections(value: string) {
  const blocks = extractSourceSectionBlocks(value);
  const mapped = new Map<(typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"], SourceSectionBlock[]>();

  for (const block of blocks) {
    let bestKey: (typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"] | null = null;
    let bestScore = 0;

    for (const option of CSEP_FORMAT_SECTION_OPTIONS) {
      const score = scoreSourceBlockMatch(option.value, block.heading, block.lines);
      if (score > bestScore) {
        bestScore = score;
        bestKey = option.value;
      }
    }

    if (!bestKey || bestScore < 3) continue;
    const existing = mapped.get(bestKey) ?? [];
    existing.push(block);
    mapped.set(bestKey, existing);
  }

  return mapped;
}

function buildNarrativeFromSourceLines(lines: string[], maxParagraphs = 3) {
  return lines
    .filter((line) => !/^[-*â€¢]\s+/.test(line) && !/^[A-Za-z][A-Za-z /&()-]+:\s*$/.test(line))
    .slice(0, maxParagraphs)
    .join(" ")
    .trim();
}

function buildBulletsFromSourceLines(lines: string[], maxItems = 8) {
  const directBullets = lines
    .filter((line) => /^[-*â€¢]\s+/.test(line))
    .map((line) => line.replace(/^[-*â€¢]\s+/, "").trim());

  if (directBullets.length) {
    return uniqueByNormalized(directBullets).slice(0, maxItems);
  }

  const sentenceBullets = lines
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-Z])/))
    .map((line) => compactWhitespace(line))
    .filter((line) => line.length > 35 && line.length < 220);

  return uniqueByNormalized(sentenceBullets).slice(0, maxItems);
}

function buildSourceSections(value: string) {
  const mappedBlocks = mapSourceBlocksToSections(value);
  const sections: GeneratedSafetyPlanSection[] = [];

  for (const option of CSEP_FORMAT_SECTION_OPTIONS) {
    const blocks = mappedBlocks.get(option.value) ?? [];
    if (!blocks.length) continue;
    const definition = getCsepFormatDefinition(option.value);
    if (!definition) continue;

    const paragraphs = uniqueByNormalized(
      blocks
        .map((block) => buildNarrativeFromSourceLines(block.lines))
        .filter(Boolean)
    );

    const bullets = uniqueByNormalized(
      blocks.flatMap((block) => buildBulletsFromSourceLines(block.lines))
    );

    const subsections = blocks
      .map((block) => ({
        title: stripSourceHeadingNumber(block.heading) || definition.title,
        body: buildNarrativeFromSourceLines(block.lines, 2) || null,
        bullets: buildBulletsFromSourceLines(block.lines, 6),
      }))
      .filter((subsection) => subsection.body || subsection.bullets.length > 0);

    sections.push({
      key: option.value,
      kind: "main",
      order: definition.order,
      title: definition.title,
      numberLabel: definition.numberLabel ?? null,
      layoutKey: option.value,
      body: paragraphs.slice(0, 2).join(" ").trim(),
      bullets: bullets.slice(0, 10),
      subsections,
    });
  }

  return sections;
}

function mergeDraftWithSourceSections(
  draft: GeneratedSafetyPlanDraft,
  sourceSections: GeneratedSafetyPlanSection[]
) {
  const byKey = new Map(sourceSections.map((section) => [section.key, section]));
  const mergedSectionMap = draft.sectionMap.map((section) => {
    const source = byKey.get(section.key);
    if (!source) return section;

    const mergedBody = uniqueStrings([section.body, source.body]).join(" ").trim();
    const mergedBullets = uniqueByNormalized([
      ...(section.bullets ?? []),
      ...(source.bullets ?? []),
    ]);
    const mergedSubsections = [
      ...(section.subsections ?? []),
      ...((source.subsections ?? []).filter((candidate) => {
        const candidateTitle = normalizeToken(candidate.title);
        return !(
          section.subsections ?? []
        ).some((existing) => normalizeToken(existing.title) === candidateTitle);
      }) ?? []),
    ];

    return {
      ...section,
      body: mergedBody || section.body,
      bullets: mergedBullets,
      subsections: mergedSubsections,
    };
  });

  for (const sourceSection of sourceSections) {
    if (mergedSectionMap.some((section) => section.key === sourceSection.key)) continue;
    mergedSectionMap.push(sourceSection);
  }

  return {
    ...draft,
    sectionMap: mergedSectionMap.sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    builderSnapshot: {
      ...(draft.builderSnapshot ?? {}),
      selected_format_sections: uniqueStrings(
        mergedSectionMap.map((section) => section.key)
      ),
    },
  } satisfies GeneratedSafetyPlanDraft;
}

function fileStem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Rebuilt CSEP";
}

function allowedSectionList() {
  return CSEP_FORMAT_SECTION_OPTIONS.map((section) => `${section.value}: ${section.label}`).join("\n");
}

function summarizeReview(review: BuilderProgramAiReview) {
  return [
    `Overall assessment: ${review.overallAssessment}`,
    `Executive summary: ${compactWhitespace(review.executiveSummary)}`,
    review.missingItemsChecklist.length
      ? `Missing items:\n- ${review.missingItemsChecklist.join("\n- ")}`
      : null,
    review.recommendedEditsBeforeApproval.length
      ? `Recommended edits:\n- ${review.recommendedEditsBeforeApproval.join("\n- ")}`
      : null,
    review.detailedFindings.length
      ? `Detailed findings:\n${review.detailedFindings
          .slice(0, 12)
          .map(
            (finding, index) =>
              `${index + 1}. ${finding.sectionLabel}: ${compactWhitespace(
                [finding.issue, finding.reviewerNote, finding.referenceSupport, finding.whyItMatters]
                  .filter(Boolean)
                  .join(" ")
              )}`
          )
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildFallbackSections(
  review: BuilderProgramAiReview,
  builderExpectationSummary: string[],
  sourceText: string
): GeneratedSafetyPlanSection[] {
  const fallbackKeys: Array<(typeof CSEP_FORMAT_SECTION_OPTIONS)[number]["value"]> = [
    "company_overview_and_safety_philosophy",
    "project_scope_and_trade_specific_activities",
    "roles_and_responsibilities",
    "emergency_preparedness_and_response",
    "personal_protective_equipment",
    "safe_work_practices_and_trade_specific_procedures",
    "permits_and_forms",
    "checklists_and_inspections",
  ];

  return fallbackKeys.map((key, index) => {
    const definition = getCsepFormatDefinition(key);
    const matchingFinding = review.detailedFindings.find((item) =>
      compactWhitespace(item.sectionLabel).toLowerCase().includes(
        definition?.title.toLowerCase().split(" ").slice(1, 3).join(" ") ?? ""
      )
    );
    const matchingExpectation =
      builderExpectationSummary.find((item) =>
        item.toLowerCase().includes((definition?.shortTitle ?? definition?.title ?? "").toLowerCase())
      ) ?? builderExpectationSummary[index] ?? "";
    const body = compactWhitespace(
      [
        matchingFinding?.preferredExample,
        matchingExpectation,
        sourceText ? `Source reference: ${trimTo(sourceText, 220)}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );

    const subsections =
      key === "emergency_preparedness_and_response"
        ? [
            {
              title: "Emergency Procedures",
              body: body || null,
              bullets: uniqueStrings([
                "Notify the superintendent and project supervision immediately.",
                "Move crews to the primary assembly point when evacuation or shelter instructions are issued.",
              ]),
            },
          ]
        : key === "permits_and_forms"
          ? [
              {
                title: "Permits",
                body: body || null,
                bullets: uniqueStrings([
                  "Confirm required permits before work starts.",
                  "Keep permits available for field verification and closeout.",
                ]),
              },
            ]
          : undefined;

    return {
      key,
      kind: "main",
      order: definition?.order ?? index + 1,
      title: definition?.title ?? key,
      numberLabel: definition?.numberLabel ?? null,
      layoutKey: key,
      body,
      bullets: uniqueStrings([
        ...(matchingFinding?.whyItMatters ? [matchingFinding.whyItMatters] : []),
        ...(matchingFinding?.referenceSupport ? [matchingFinding.referenceSupport] : []),
      ]),
      subsections,
    };
  });
}

function buildFallbackDraft(params: {
  fileName: string;
  review: BuilderProgramAiReview;
  builderExpectationSummary: string[];
  documentText: string;
}): GeneratedSafetyPlanDraft {
  const projectName = fileStem(params.fileName);
  const sectionMap = buildFallbackSections(
    params.review,
    params.builderExpectationSummary,
    params.documentText
  );
  const selectedSectionKeys = sectionMap.map((section) => section.key);
  const contractorCompany =
    compactWhitespace(
      params.review.builderAlignmentNotes.find((note) =>
        note.toLowerCase().includes("contractor")
      )
    ) || "TBD by contractor before issue";

  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: `${projectName} Rebuilt CSEP`,
    documentControl: {
      issueDate: new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
      documentNumber: "",
      revision: "1.0",
      preparedBy: contractorCompany,
      reviewedBy: "",
      approvedBy: "TBD by contractor before issue",
    },
    projectOverview: {
      projectName,
      projectNumber: "",
      projectAddress: "",
      ownerClient: "",
      gcCm: "",
      contractorCompany,
      schedule: "",
      location: "",
    },
    operations: [
      {
        operationId: "rebuild-op-1",
        tradeLabel: "Contractor Work Scope",
        subTradeLabel: "",
        taskTitle: "Rebuilt external CSEP scope",
        workAreaLabel: "",
        locationGrid: "",
        equipmentUsed: [],
        workConditions: [],
        hazardCategories: [],
        permitTriggers: [],
        ppeRequirements: [],
        requiredControls: [],
        siteRestrictions: [],
        prohibitedEquipment: [],
        conflicts: [],
      },
    ],
    ruleSummary: {
      permitTriggers: [],
      ppeRequirements: [],
      requiredControls: [],
      hazardCategories: [],
      siteRestrictions: [],
      prohibitedEquipment: [],
      trainingRequirements: [],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 0,
      intraDocument: 0,
      external: 0,
      highestSeverity: "none",
      items: [],
    },
    riskSummary: {
      score: params.review.overallAssessment === "sufficient" ? 20 : 55,
      band:
        params.review.overallAssessment === "sufficient"
          ? "low"
          : params.review.overallAssessment === "needs_work"
            ? "moderate"
            : "high",
      priorities: uniqueStrings([
        ...params.review.missingItemsChecklist,
        ...params.review.recommendedEditsBeforeApproval,
      ]).slice(0, 8),
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {},
    sectionMap,
    builderSnapshot: {
      selected_format_sections: selectedSectionKeys,
    },
    provenance: {
      source: "superadmin_completed_csep_rebuild_fallback",
      rebuiltFrom: params.fileName,
    },
  };
}

function withCoreSectionsFilled(params: {
  draft: GeneratedSafetyPlanDraft;
  review: BuilderProgramAiReview;
  builderExpectationSummary: string[];
  documentText: string;
  fileName: string;
}) {
  const fallbackSections = buildFallbackSections(
    params.review,
    params.builderExpectationSummary,
    params.documentText
  );
  const mergedSectionMap = [...params.draft.sectionMap];

  fallbackSections.forEach((section) => {
    if (!mergedSectionMap.some((existing) => existing.key === section.key)) {
      mergedSectionMap.push(section);
    }
  });

  const selectedSectionKeys = uniqueStrings(
    mergedSectionMap.map((section) => section.key)
  );
  const contractorCompany =
    compactWhitespace(params.draft.projectOverview.contractorCompany) ||
    fileStem(params.fileName);

  return {
    ...params.draft,
    projectOverview: {
      ...params.draft.projectOverview,
      contractorCompany,
    },
    documentControl: {
      ...params.draft.documentControl,
      preparedBy:
        compactWhitespace(params.draft.documentControl?.preparedBy) || contractorCompany,
      approvedBy:
        compactWhitespace(params.draft.documentControl?.approvedBy) ||
        "TBD by contractor before issue",
    },
    sectionMap: mergedSectionMap.sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0)
    ),
    builderSnapshot: {
      ...(params.draft.builderSnapshot ?? {}),
      selected_format_sections: selectedSectionKeys,
    },
  } satisfies GeneratedSafetyPlanDraft;
}

function buildDraftFromPayload(
  payload: CompletedCsepRebuildPayload,
  fileName: string
): GeneratedSafetyPlanDraft {
  const sectionMap = payload.sections.reduce<GeneratedSafetyPlanSection[]>((sections, section) => {
      const definition = getCsepFormatDefinition(section.key);
      const body = compactWhitespace(section.body);
      const bullets = uniqueStrings(section.bullets);
      const subsections = (section.subsections ?? [])
        .map((subsection) => ({
          title: compactWhitespace(subsection.title),
          body: compactWhitespace(subsection.body),
          bullets: uniqueStrings(subsection.bullets),
        }))
        .filter(
          (subsection) =>
            subsection.title &&
            (subsection.body || subsection.bullets.length > 0)
        );

      if (!definition) {
        return sections;
      }

      if (!body && !bullets.length && !subsections.length) {
        return sections;
      }

      sections.push({
        key: section.key,
        kind: "main" as const,
        order: definition.order,
        title: definition.title,
        numberLabel: definition.numberLabel ?? null,
        layoutKey: section.key,
        body,
        bullets,
        subsections,
      });
      return sections;
    }, []);

  const selectedSectionKeys = sectionMap.map((section) => section.key);
  const taskTitles = uniqueStrings(payload.operations.taskTitles);
  const tradeLabel = compactWhitespace(payload.operations.tradeLabel) || "Contractor Work Scope";
  const subTradeLabel = compactWhitespace(payload.operations.subTradeLabel);
  const priorities = uniqueStrings(payload.riskPriorities);

  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: compactWhitespace(payload.title) || `${fileStem(fileName)} Rebuilt CSEP`,
    documentControl: {
      issueDate: new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
      documentNumber: compactWhitespace(payload.documentControl.documentNumber),
      revision: compactWhitespace(payload.documentControl.revision) || "1.0",
      preparedBy:
        compactWhitespace(payload.documentControl.preparedBy) ||
        compactWhitespace(payload.projectOverview.contractorCompany) ||
        "TBD by contractor before issue",
      reviewedBy: compactWhitespace(payload.documentControl.reviewedBy),
      approvedBy:
        compactWhitespace(payload.documentControl.approvedBy) ||
        "TBD by contractor before issue",
    },
    projectOverview: {
      projectName: compactWhitespace(payload.projectOverview.projectName) || fileStem(fileName),
      projectNumber: compactWhitespace(payload.projectOverview.projectNumber),
      projectAddress: compactWhitespace(payload.projectOverview.projectAddress),
      ownerClient: compactWhitespace(payload.projectOverview.ownerClient),
      gcCm: normalizeGcCmPartnerEntries(payload.projectOverview.gcCm).map((entry) =>
        compactWhitespace(entry)
      ),
      contractorCompany: compactWhitespace(payload.projectOverview.contractorCompany),
      schedule: compactWhitespace(payload.projectOverview.schedule),
      location: compactWhitespace(payload.projectOverview.location),
    },
    operations: (taskTitles.length ? taskTitles : ["Rebuilt external CSEP scope"]).map(
      (taskTitle, index) => ({
        operationId: `rebuild-op-${index + 1}`,
        tradeLabel,
        subTradeLabel,
        taskTitle,
        workAreaLabel: "",
        locationGrid: "",
        equipmentUsed: uniqueStrings(payload.operations.equipmentUsed),
        workConditions: uniqueStrings(payload.operations.workConditions),
        hazardCategories: uniqueStrings(payload.operations.hazardCategories),
        permitTriggers: uniqueStrings(payload.operations.permitTriggers),
        ppeRequirements: uniqueStrings(payload.operations.ppeRequirements),
        requiredControls: uniqueStrings(payload.operations.requiredControls),
        siteRestrictions: uniqueStrings(payload.operations.siteRestrictions),
        prohibitedEquipment: [],
        conflicts: uniqueStrings(payload.operations.conflicts),
      })
    ),
    ruleSummary: {
      permitTriggers: uniqueStrings(payload.operations.permitTriggers),
      ppeRequirements: uniqueStrings(payload.operations.ppeRequirements),
      requiredControls: uniqueStrings(payload.operations.requiredControls),
      hazardCategories: uniqueStrings(payload.operations.hazardCategories),
      siteRestrictions: uniqueStrings(payload.operations.siteRestrictions),
      prohibitedEquipment: [],
      trainingRequirements: uniqueStrings(payload.trainingRequirements),
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: uniqueStrings(payload.operations.conflicts).length,
      intraDocument: 0,
      external: uniqueStrings(payload.operations.conflicts).length,
      highestSeverity: uniqueStrings(payload.operations.conflicts).length ? "medium" : "none",
      items: [],
    },
    riskSummary: {
      score:
        payload.riskBand === "critical"
          ? 90
          : payload.riskBand === "high"
            ? 75
            : payload.riskBand === "moderate"
              ? 55
              : 25,
      band: payload.riskBand,
      priorities,
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: uniqueStrings(payload.trainingRequirements),
    },
    narrativeSections: {},
    sectionMap,
    builderSnapshot: {
      selected_format_sections: selectedSectionKeys,
    },
    provenance: {
      source: "superadmin_completed_csep_rebuild",
      rebuiltFrom: fileName,
    },
  };
}

async function generateCompletedCsepRebuildDraft(params: {
  fileName: string;
  documentText: string;
  siteReferenceText: string;
  builderExpectationSummary: string[];
  review: BuilderProgramAiReview;
}) {
  const buildLocalFallback = () =>
    buildFallbackDraft({
      fileName: params.fileName,
      review: params.review,
      builderExpectationSummary: params.builderExpectationSummary,
      documentText: normalizedDocumentText,
    });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const normalizedDocumentText = normalizeStructuredText(params.documentText);
  const normalizedReferenceText = normalizeStructuredText(params.siteReferenceText);
  if (!apiKey || normalizedDocumentText.length < 120) {
    return buildLocalFallback();
  }

  const sourceOutline = buildSourceOutline(normalizedDocumentText);
  const referenceOutline = buildSourceOutline(normalizedReferenceText);

  const prompt = [
    "You are rebuilding an uploaded external contractor CSEP into the Safety360 CSEP format.",
    "This is a true document conversion task, not a short summary.",
    "Use the uploaded completed CSEP as the main source of project facts, scope, procedures, contacts, emergency content, PPE, permits, inspections, responsibilities, and other field controls.",
    "Transfer as much usable source content as possible into the matching Safety360 format sections, even when the original headings are different.",
    "Use the review findings to fix weak, missing, duplicated, or unclear content so the rebuilt result reads like a complete contractor-issued document.",
    "Use the live builder expectations as the target structure and tone for the rebuilt document.",
    "Important output rules:",
    "- Rewrite into final issued-document language, not review-note language.",
    "- Preserve project-specific facts, names, addresses, emergency instructions, phone/contact details, scope details, permits, PPE, and inspection requirements when they appear in the uploaded CSEP.",
    "- Do not collapse the source into generic summaries if the uploaded CSEP already contains usable detail.",
    "- Keep self-performed scope separate from adjacent interface trades.",
    "- Prefer project-specific facts from the uploaded document and uploaded reference documents.",
    "- If a project fact is not available, leave the project field blank instead of inventing it.",
    "- Never output internal drafting notes, AI notes, placeholders like test/null/undefined, or raw labels such as [Platform Fill Field].",
    "- Rebuild a complete Safety360 CSEP body. Include every relevant main section you can support from the source, the references, and reasonable builder-based completion logic.",
    "- Do not create empty section stubs. If a section is included, it should contain meaningful final content.",
    "- If source content is weak but the section is needed for a complete issued CSEP, write a short but complete project-specific version using the available facts plus the review corrections.",
    "- Use only these allowed Safety360 section keys and titles:",
    allowedSectionList(),
    "",
    "--- Live builder expectations ---",
    params.builderExpectationSummary.join("\n"),
    "",
    sourceOutline.length ? `--- Uploaded CSEP source outline ---\n${sourceOutline.join("\n")}` : "",
    "",
    "--- Completed-CSEP review findings to fix during rebuild ---",
    summarizeReview(params.review),
    "",
    referenceOutline.length
      ? `--- Uploaded reference document outline ---\n${referenceOutline.join("\n")}`
      : "",
    "",
    params.siteReferenceText
      ? `--- Uploaded reference documents ---\n${trimStructuredText(
          normalizedReferenceText,
          MAX_REFERENCE_TEXT
        )}`
      : "",
    "",
    `--- Uploaded completed CSEP source (${params.fileName}) ---`,
    trimStructuredText(normalizedDocumentText, MAX_SOURCE_TEXT),
    "",
    "Return strict JSON matching the schema.",
  ]
    .filter(Boolean)
    .join("\n");

  const sectionEnum = CSEP_FORMAT_SECTION_OPTIONS.map((section) => section.value);
  const preferredModel = (
    process.env.COMPANY_AI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_REBUILD_MODEL
  ).trim();
  const modelCandidates = [preferredModel, DEFAULT_REBUILD_MODEL].filter(
    (model, index, list) => Boolean(model) && list.indexOf(model) === index
  );

  let res: Response | null = null;
  let errText = "";

  for (const candidate of modelCandidates) {
    res = await fetch(`${getOpenAiApiBaseUrl()}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveOpenAiCompatibleModelId(candidate),
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "completed_csep_rebuild",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                documentControl: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    documentNumber: { type: "string" },
                    revision: { type: "string" },
                    preparedBy: { type: "string" },
                    reviewedBy: { type: "string" },
                    approvedBy: { type: "string" },
                  },
                  required: [
                    "documentNumber",
                    "revision",
                    "preparedBy",
                    "reviewedBy",
                    "approvedBy",
                  ],
                },
                projectOverview: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    projectName: { type: "string" },
                    projectNumber: { type: "string" },
                    projectAddress: { type: "string" },
                    ownerClient: { type: "string" },
                    gcCm: {
                      oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, maxItems: 24 }],
                    },
                    contractorCompany: { type: "string" },
                    schedule: { type: "string" },
                    location: { type: "string" },
                  },
                  required: [
                    "projectName",
                    "projectNumber",
                    "projectAddress",
                    "ownerClient",
                    "gcCm",
                    "contractorCompany",
                    "schedule",
                    "location",
                  ],
                },
                operations: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    tradeLabel: { type: "string" },
                    subTradeLabel: { type: "string" },
                    taskTitles: { type: "array", items: { type: "string" }, maxItems: 12 },
                    equipmentUsed: { type: "array", items: { type: "string" }, maxItems: 16 },
                    workConditions: { type: "array", items: { type: "string" }, maxItems: 12 },
                    hazardCategories: { type: "array", items: { type: "string" }, maxItems: 16 },
                    permitTriggers: { type: "array", items: { type: "string" }, maxItems: 12 },
                    ppeRequirements: { type: "array", items: { type: "string" }, maxItems: 16 },
                    requiredControls: { type: "array", items: { type: "string" }, maxItems: 16 },
                    siteRestrictions: { type: "array", items: { type: "string" }, maxItems: 16 },
                    conflicts: { type: "array", items: { type: "string" }, maxItems: 12 },
                  },
                  required: [
                    "tradeLabel",
                    "subTradeLabel",
                    "taskTitles",
                    "equipmentUsed",
                    "workConditions",
                    "hazardCategories",
                    "permitTriggers",
                    "ppeRequirements",
                    "requiredControls",
                    "siteRestrictions",
                    "conflicts",
                  ],
                },
                trainingRequirements: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 16,
                },
                riskBand: {
                  type: "string",
                  enum: ["low", "moderate", "high", "critical"],
                },
                riskPriorities: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 10,
                },
                sections: {
                  type: "array",
                  minItems: 10,
                  maxItems: 19,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      key: {
                        type: "string",
                        enum: sectionEnum,
                      },
                      body: { type: "string" },
                      bullets: {
                        type: "array",
                        items: { type: "string" },
                        maxItems: 10,
                      },
                      subsections: {
                        type: "array",
                        maxItems: 8,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            title: { type: "string" },
                            body: { type: "string" },
                            bullets: {
                              type: "array",
                              items: { type: "string" },
                              maxItems: 8,
                            },
                          },
                          required: ["title", "body", "bullets"],
                        },
                      },
                    },
                    required: ["key", "body", "bullets", "subsections"],
                  },
                },
              },
              required: [
                "title",
                "documentControl",
                "projectOverview",
                "operations",
                "trainingRequirements",
                "riskBand",
                "riskPriorities",
                "sections",
              ],
            },
          },
        },
      }),
    });

    if (res.ok) {
      break;
    }

    errText = await res.text().catch(() => "");
    const shouldRetryOnFallback =
      candidate !== DEFAULT_REBUILD_MODEL &&
      (errText.includes("model_not_found") ||
        errText.includes("does not have access to model") ||
        errText.includes("invalid_request_error"));
    if (!shouldRetryOnFallback) {
      break;
    }
  }

  if (!res || !res.ok) {
    serverLog("warn", "ad_hoc_completed_csep_rebuild_model_fallback", {
      fileName: params.fileName,
      reason: `OpenAI request failed (${res?.status ?? 502})`,
    });
    return buildLocalFallback();
  }

  const json: unknown = await res.json();
  const rawText = extractResponsesApiOutputText(json);
  if (!rawText) {
    throw new Error("Empty model output.");
  }

  let parsed: CompletedCsepRebuildPayload;
  try {
    parsed = JSON.parse(rawText) as CompletedCsepRebuildPayload;
  } catch {
    serverLog("warn", "ad_hoc_completed_csep_rebuild_parse_fallback", {
      fileName: params.fileName,
      reason: "Could not parse rebuilt CSEP JSON.",
    });
    return buildLocalFallback();
  }

  return withCoreSectionsFilled({
    draft: buildDraftFromPayload(parsed, params.fileName),
    review: params.review,
    builderExpectationSummary: params.builderExpectationSummary,
    documentText: normalizedDocumentText,
    fileName: params.fileName,
  });
}

export async function runAdHocCompletedCsepRebuild(params: {
  document: { buffer: Buffer; fileName: string };
  additionalReviewerContext: string;
  siteDocuments?: Array<{ buffer: Buffer; fileName: string }> | null;
  builderExpectationSummary?: string[] | null;
}) {
  try {
    const extracted = await extractBuilderReviewDocumentText(
      params.document.buffer,
      params.document.fileName
    );
    if (!extracted.ok) {
      return {
        ok: false as const,
        status: 400,
        error: extracted.error,
      };
    }

    const siteReferenceBlocks: string[] = [];
    for (const siteDocument of params.siteDocuments ?? []) {
      if (!siteDocument?.buffer?.length) {
        continue;
      }

      const extractedReference = await extractBuilderReviewDocumentText(
        siteDocument.buffer,
        siteDocument.fileName
      );
      if (!extractedReference.ok) {
        return {
          ok: false as const,
          status: 400,
          error: `Site reference file "${siteDocument.fileName}": ${extractedReference.error}`,
        };
      }

      siteReferenceBlocks.push(
        [`Reference file: ${siteDocument.fileName}`, extractedReference.text.trim()]
          .filter(Boolean)
          .join("\n")
      );
    }

    const { review } = await generateBuilderProgramAiReview({
      documentText: extracted.text,
      programLabel: "CSEP",
      projectName: fileStem(params.document.fileName),
      documentTitle: params.document.fileName,
      additionalReviewerContext: params.additionalReviewerContext,
      annotations: extracted.annotations,
      siteReferenceText: siteReferenceBlocks.length ? siteReferenceBlocks.join("\n\n---\n\n") : null,
      siteReferenceFileName: siteReferenceBlocks.length
        ? (params.siteDocuments ?? []).map((item) => item.fileName).join(", ")
        : null,
      reviewMode: "csep_completeness",
      builderExpectationSummary: params.builderExpectationSummary,
    });

    const draft = await generateCompletedCsepRebuildDraft({
      fileName: params.document.fileName,
      documentText: extracted.text,
      siteReferenceText: siteReferenceBlocks.join("\n\n---\n\n"),
      builderExpectationSummary: params.builderExpectationSummary ?? [],
      review,
    });
    const sourceSections = buildSourceSections(extracted.text);
    const referenceSections = buildSourceSections(siteReferenceBlocks.join("\n\n"));
    const finalDraft = mergeDraftWithSourceSections(
      mergeDraftWithSourceSections(draft, sourceSections),
      referenceSections
    );
    const rendered = await renderGeneratedCsepDocx(finalDraft);

    return {
      ok: true as const,
      filename: rendered.filename.replace(/\.docx$/i, "_rebuilt.docx"),
      body: rendered.body,
      draft: finalDraft,
      review,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "CSEP rebuild failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    serverLog("error", "ad_hoc_completed_csep_rebuild_failed", {
      fileName: params.document.fileName,
      status: isConfig ? 503 : 502,
      errorKind: e instanceof Error ? e.name : "unknown",
    });
    return {
      ok: false as const,
      status: isConfig ? 503 : 502,
      error: message,
    };
  }
}
```

## lib\runAdHocCsepCompletenessReview.ts

```ts
import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";
import {
  extractBuilderReviewDocumentText,
  generateBuilderProgramAiReview,
} from "@/lib/builderDocumentAiReview";
import { serverLog } from "@/lib/serverLog";

export type AdHocReviewExtraction =
  | { ok: true; method: string; truncated: boolean; annotations: ReviewDocumentAnnotation[] }
  | { ok: false; error: string };

export type AdHocSiteReferenceExtraction =
  Array<{
      fileName: string;
      ok: true;
      method: string;
      truncated: boolean;
      annotations: ReviewDocumentAnnotation[];
    }>;

export async function runAdHocCsepCompletenessReview(params: {
  document: { buffer: Buffer; fileName: string };
  additionalReviewerContext: string;
  siteDocuments?: Array<{ buffer: Buffer; fileName: string }> | null;
  builderExpectationSummary?: string[] | null;
}) {
  try {
    const extracted = await extractBuilderReviewDocumentText(
      params.document.buffer,
      params.document.fileName
    );
    const documentText = extracted.ok ? extracted.text : "";
    const extractionMeta: AdHocReviewExtraction = extracted.ok
      ? {
          ok: true,
          method: extracted.method,
          truncated: extracted.truncated,
          annotations: extracted.annotations,
        }
      : { ok: false, error: extracted.error };

    const siteReferenceExtraction: AdHocSiteReferenceExtraction = [];
    const siteReferenceBlocks: string[] = [];

    for (const siteDocument of params.siteDocuments ?? []) {
      if (!siteDocument?.buffer?.length) {
        continue;
      }

      const refName = siteDocument.fileName?.trim() || `site-reference-${siteReferenceExtraction.length + 1}.pdf`;
      const siteExtracted = await extractBuilderReviewDocumentText(siteDocument.buffer, refName);
      if (!siteExtracted.ok) {
        return {
          ok: false as const,
          status: 400,
          error: `Site reference file "${refName}": ${siteExtracted.error}`,
        };
      }

      siteReferenceExtraction.push({
        fileName: refName,
        ok: true,
        method: siteExtracted.method,
        truncated: siteExtracted.truncated,
        annotations: siteExtracted.annotations,
      });
      siteReferenceBlocks.push(
        [`Reference file: ${refName}`, siteExtracted.text.trim()].filter(Boolean).join("\n")
      );
    }

    const { review, disclaimer } = await generateBuilderProgramAiReview({
      documentText,
      programLabel: "CSEP",
      projectName: params.document.fileName.replace(/\.[^.]+$/, ""),
      documentTitle: params.document.fileName,
      additionalReviewerContext: params.additionalReviewerContext,
      annotations: extracted.ok ? extracted.annotations : [],
      siteReferenceText: siteReferenceBlocks.length ? siteReferenceBlocks.join("\n\n---\n\n") : null,
      siteReferenceFileName: siteReferenceExtraction.length
        ? siteReferenceExtraction.map((item) => item.fileName).join(", ")
        : null,
      reviewMode: "csep_completeness",
      builderExpectationSummary: params.builderExpectationSummary,
    });

    return {
      ok: true as const,
      review,
      disclaimer,
      extraction: extractionMeta,
      siteReferenceExtraction,
      fileName: params.document.fileName,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI review failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    serverLog("error", "ad_hoc_csep_completeness_review_failed", {
      fileName: params.document.fileName,
      status: isConfig ? 503 : 502,
      errorKind: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false as const, status: isConfig ? 503 : 502, error: message };
  }
}
```

## app\(app)\csep\page.tsx

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
  StatusBadge,
  WorkflowPath,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import {
  CSEP_BUILDER_BLOCK_LABELS,
  CSEP_BUILDER_BLOCK_OPTIONS,
  CSEP_FORMAT_SECTION_OPTIONS,
  buildLegacyIncludedSectionLabelsFromFormatSections,
  buildCsepBuilderAiPrompt,
  hasBlockingCsepCoverageAudit,
  getCsepBuilderAiSectionConfig,
  resolveIncludedSectionLabelsForAiSection,
  parseCsepAiTextResponse,
  parseCsepWeatherSectionAiResponse,
  type CsepBuilderAiSectionId,
} from "@/lib/csepBuilder";
import {
  buildCsepProgramSelections,
  getSubtypeConfig,
  listProgramTitles,
} from "@/lib/csepPrograms";
import {
  deriveEligibleCsepPricedItems,
  formatCsepPrice,
  resolveSelectedCsepPricedItems,
} from "@/lib/csepEnrichmentPricing";
import { buildCsepTradeSelection, getCsepTradeOptions } from "@/lib/csepTradeSelection";
import { getJurisdictionStateOptions, resolveBuilderJurisdiction } from "@/lib/jurisdictionStandards/catalog";
import type { PermissionMap } from "@/lib/rbac";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL,
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
} from "@/lib/safetyBlueprintLabels";
import { OWNER_MESSAGE_PRESETS, getOwnerMessagePreset } from "@/lib/ownerMessagePresets";
import type { ChecklistEvaluationResponse } from "@/lib/compliance/evaluation";
import {
  useCompanyWorkspaceData,
  type CompanyJobsite,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import type { CsepFormatSectionKey, CsepWeatherSectionInput } from "@/types/csep-builder";
import type { CSEPPricedItemCatalogEntry } from "@/types/csep-priced-items";
import type { CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue } from "@/types/csep-programs";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

type CSEPForm = {
  jobsite_id: string;
  project_name: string;
  project_number: string;
  project_address: string;
  governing_state: string;
  project_delivery_type: string;
  owner_client: string;
  owner_message_text: string;
  /** One string per GC / CM / program partner or interface role. */
  gc_cm: string[];
  contractor_company: string;
  contractor_contact: string;
  contractor_phone: string;
  contractor_email: string;
  trade: string;
  subTrade: string;
  tasks: string[];
  scope_of_work: string;
  site_specific_notes: string;
  emergency_procedures: string;
  weather_requirements: CsepWeatherSectionInput;
  required_ppe: string[];
  additional_permits: string[];
  priced_attachment_keys: string[];
  selected_hazards: string[];
  program_subtype_selections: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
  selected_format_sections: CsepFormatSectionKey[];
  included_sections: string[];
  document_number: string;
  document_revision: string;
  issue_date: string;
  prepared_by: string;
  reviewed_by: string;
  approved_by: string;
  roles_and_responsibilities_text: string;
  security_and_access_text: string;
  health_and_wellness_text: string;
  incident_reporting_and_investigation_text: string;
  training_and_instruction_text: string;
  drug_and_alcohol_testing_text: string;
  enforcement_and_corrective_action_text: string;
  recordkeeping_text: string;
  continuous_improvement_text: string;
};

type MultiSelectField =
  | "required_ppe"
  | "additional_permits"
  | "priced_attachment_keys"
  | "selected_hazards"
  | "tasks";

type OptionGridItem = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
};

type CsepPreviewState = {
  generatedDocumentId: string;
  builderInputHash: string;
  draft: GeneratedSafetyPlanDraft;
  payloadSignature: string;
};

type BuilderAiMessageTone = "success" | "warning" | "error";

type BuilderAiSectionState = {
  loading: boolean;
  message: string;
  tone: BuilderAiMessageTone;
};

const supabase = getSupabaseBrowserClient();

const tradeOptions = getCsepTradeOptions();
const jurisdictionStateOptions = getJurisdictionStateOptions();
const projectDeliveryOptions = [
  { value: "ground_up", label: "Ground-Up New Build" },
  { value: "renovation", label: "Building Refurbishment / Renovation" },
];
const ppeOptions = [
  "Hard Hat",
  "Safety Glasses",
  "High Visibility Vest",
  "Gloves",
  "Steel Toe Boots",
  "Hearing Protection",
  "Face Shield",
  "Respiratory Protection",
  "Fall Protection Harness",
];
const permitOptions = [
  "Hot Work Permit",
  "Confined Space Permit",
  "LOTO Permit",
  "Ladder Permit",
  "AWP/MEWP Permit",
  "Ground Disturbance Permit",
  "Trench Inspection Permit",
  "Chemical Permit",
  "Motion Permit",
  "Temperature Permit",
  "Gravity Permit",
];
const legacyCsepSectionLabels = CSEP_BUILDER_BLOCK_OPTIONS.map((option) => option.label);
const csepFormatSectionOptionItems: OptionGridItem[] = CSEP_FORMAT_SECTION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: option.description,
}));
const workflowDefinition = [
  {
    title: "Trade selection",
    detail: "Choose the live trade path this CSEP will follow.",
  },
  {
    title: "Sub-trade",
    detail: "Lock the builder to the active sub-trade before tasks are picked.",
  },
  {
    title: "Select sections",
    detail: "Choose which 19-section CSEP package sections belong in the final format.",
  },
  {
    title: "Selectable tasks",
    detail: "Pick the exact work tasks that drive hazards and controls.",
  },
  {
    title: "Intelligence enrichment",
    detail: "Review hazards, PPE, permits, pricing, OSHA references, and program outputs tied to the selected tasks.",
  },
  {
    title: "Task-driven sections",
    detail: "Complete project details and the task-driven sections that unlock after tasks are selected.",
  },
  {
    title: "Draft review",
    detail: "Generate the live draft, review the selected sections, and approve the current version.",
  },
  {
    title: "Submit document",
    detail: "Accept the terms and submit the approved CSEP into review.",
  },
];

const workflowCategoryDefinition = [
  {
    title: "Setup",
    stepIndexes: [0, 1] as number[],
  },
  {
    title: "Scope",
    stepIndexes: [2, 3] as number[],
  },
  {
    title: "Build",
    stepIndexes: [4, 5] as number[],
  },
  {
    title: "Review & Submit",
    stepIndexes: [6, 7] as number[],
  },
];

const TASK_DRIVEN_SECTION_LABELS = new Set([
  "Scope Summary",
  "Scope of Work",
  "Project-Specific Safety Notes",
  "Site Specific Notes",
  "Emergency Procedures",
  "Weather Requirements and Severe Weather Response",
  "Roles and Responsibilities",
  "Security and Access",
  "Health and Wellness",
  "Incident Reporting and Investigation",
  "Training and Instruction",
  CSEP_BUILDER_BLOCK_LABELS.drug_and_alcohol_testing,
  "Drug and Alcohol Testing",
  "Enforcement and Corrective Action",
  "Recordkeeping",
  "Continuous Improvement",
]);

function formIncludesDrugAlcoholSection(includedSections: readonly string[]) {
  return (
    includedSections.includes(CSEP_BUILDER_BLOCK_LABELS.drug_and_alcohol_testing) ||
    includedSections.includes("Drug and Alcohol Testing")
  );
}

const ENRICHMENT_DRIVEN_SECTION_LABELS = new Set([
  "Required PPE",
  "Additional Permits",
  "Common Overlapping Trades",
  "OSHA References",
  "Selected Hazards",
  "Activity / Hazard Matrix",
]);

const initialForm: CSEPForm = {
  jobsite_id: "",
  project_name: "",
  project_number: "",
  project_address: "",
  governing_state: "",
  project_delivery_type: "",
  owner_client: "",
  owner_message_text: "",
  gc_cm: [""],
  contractor_company: "",
  contractor_contact: "",
  contractor_phone: "",
  contractor_email: "",
  trade: "",
  subTrade: "",
  tasks: [],
  scope_of_work: "",
  site_specific_notes: "",
  emergency_procedures: "",
  weather_requirements: {},
  required_ppe: [],
  additional_permits: [],
  priced_attachment_keys: [],
  selected_hazards: [],
  program_subtype_selections: {},
  selected_format_sections: CSEP_FORMAT_SECTION_OPTIONS.map((option) => option.value),
  included_sections: [...legacyCsepSectionLabels],
  document_number: "",
  document_revision: "1.0",
  issue_date: "",
  prepared_by: "",
  reviewed_by: "",
  approved_by: "",
  roles_and_responsibilities_text: "",
  security_and_access_text: "",
  health_and_wellness_text: "",
  incident_reporting_and_investigation_text: "",
  training_and_instruction_text: "",
  drug_and_alcohol_testing_text: "",
  enforcement_and_corrective_action_text: "",
  recordkeeping_text: "",
  continuous_improvement_text: "",
};

const OFFLINE_DEMO_EMAIL = "demo.20260425@safety360docs.local";
const OFFLINE_DEMO_CSEP_PREFILL: Partial<CSEPForm> = {
  jobsite_id: "demo-jobsite-1",
  project_name: "North Tower",
  project_number: "SR-1042",
  project_address: "4100 Industrial Way, Austin, TX 78701",
  governing_state: "TX",
  project_delivery_type: "ground_up",
  owner_client: "Summit Ridge Constructors",
  owner_message_text:
    "Demo-only project data. All names, contacts, operations, and controls are fictional for visual walkthrough.",
  gc_cm: ["Summit Ridge Constructors"],
  contractor_company: "Summit Ridge Field Services",
  contractor_contact: "Jordan Lee",
  contractor_phone: "555-0140",
  contractor_email: "demo@safety360docs.com",
  trade: "Structural Steel and Erection",
  subTrade: "Steel Erection and Decking",
  tasks: ["Hoisting and Rigging", "Steel Erection", "Welding and Cutting", "Work at Heights"],
  scope_of_work:
    "Install structural steel and decking, execute hot-work welding, and coordinate crane picks in an active multi-trade zone.",
  site_specific_notes:
    "Demo site rules: maintain exclusion zones under suspended loads, enforce controlled access near leading edges, and require pre-task lift briefings.",
  emergency_procedures:
    "Stop work, notify supervision via radio channel 1, call 911 for life-threatening events, and report all incidents in SafetyDocs360 before shift closeout.",
  required_ppe: ["Hard Hat", "Safety Glasses", "High Visibility Vest", "Gloves", "Steel Toe Boots", "Fall Protection Harness"],
  additional_permits: ["Hot Work Permit", "AWP/MEWP Permit", "LOTO Permit"],
  selected_hazards: ["Falls", "Struck-by", "Caught-in/between", "Electrical"],
  document_number: "CSEP-DEMO-20260425",
  document_revision: "1.0",
  prepared_by: "Jordan Lee",
  reviewed_by: "Maria Chen",
  approved_by: "Avery Patel",
  roles_and_responsibilities_text:
    "Foremen verify controls before each task; all crew members retain stop-work authority; competent persons release work restart after corrective actions.",
  security_and_access_text:
    "Controlled access zones established for hoisting and leading-edge work. Only authorized crew may enter active steel erection areas.",
  health_and_wellness_text:
    "Hydration breaks every two hours in hot conditions, fatigue checks before night work, and respiratory protection readiness for welding fume exposure.",
  incident_reporting_and_investigation_text:
    "Near misses and incidents are logged in-platform immediately. Supervisor-led investigation begins same shift with corrective action ownership assigned.",
  training_and_instruction_text:
    "Daily toolbox briefings cover crane picks, fall controls, hot-work fire watch, and emergency escalation paths.",
  drug_and_alcohol_testing_text:
    "Reasonable-cause and post-incident testing applies per site policy and applicable labor agreements.",
  enforcement_and_corrective_action_text:
    "Unsafe acts trigger immediate stop-work and documented corrective actions. Repeat violations escalate to removal from task assignment.",
  recordkeeping_text:
    "Permits, inspections, orientation records, and corrective actions are retained in SafetyDocs360 for audit and handoff.",
  continuous_improvement_text:
    "Weekly leadership review analyzes recurring hazards and updates task controls for the next work cycle.",
};

const csepDerivedRequestPayloadKeys = [
  "tradeItems",
  "derivedHazards",
  "derivedPermits",
  "overlapPermitHints",
  "priced_attachments",
  "common_overlapping_trades",
  "programSelections",
  "tradeSummary",
  "oshaRefs",
] as const;

function buildCompactCsepRequestFormData(
  formData: Record<string, unknown>,
  options: { includeLogo?: boolean } = {}
) {
  const compact = { ...formData };

  csepDerivedRequestPayloadKeys.forEach((key) => {
    delete compact[key];
  });

  if (!options.includeLogo) {
    delete compact.company_logo_data_url;
    delete compact.company_logo_file_name;
  }

  return compact;
}

function buildOfflineDemoJobsiteScenario(jobsite: CompanyJobsite | undefined): Partial<CSEPForm> {
  const name = (jobsite?.name ?? "").toLowerCase();

  if (name.includes("warehouse")) {
    return {
      project_name: jobsite?.name || "Warehouse Retrofit",
      project_number: jobsite?.projectNumber || "SR-2210",
      project_address: jobsite?.location || "Round Rock, TX",
      trade: "Electrical and Instrumentation",
      subTrade: "Panel and distribution systems",
      tasks: ["Electrical Work", "Energized Work Boundaries", "LOTO Activities", "Work at Heights"],
      selected_hazards: ["Electrical", "Arc flash", "Falls", "Struck-by"],
      additional_permits: ["LOTO Permit", "AWP/MEWP Permit", "Hot Work Permit"],
      scope_of_work:
        "Retrofit and replace electrical distribution panels with lockout verification and phased energization controls.",
      site_specific_notes:
        "Night shift work windows with controlled access around energized rooms and dedicated boundary spotters.",
      emergency_procedures:
        "Immediate de-energization where possible, isolate exposure area, call emergency services, and escalate through site incident chain.",
      document_number: "CSEP-DEMO-WH-20260425",
    };
  }

  if (name.includes("clinic")) {
    return {
      project_name: jobsite?.name || "South Clinic Buildout",
      project_number: jobsite?.projectNumber || "SR-3097",
      project_address: jobsite?.location || "San Marcos, TX",
      trade: "General Construction",
      subTrade: "Interior buildout and fit-off",
      tasks: ["Material Handling", "Ladder Work", "Housekeeping", "Site Access Control"],
      selected_hazards: ["Slips, trips, and falls", "Struck-by", "Ergonomic strain"],
      additional_permits: ["Ladder Permit", "Motion Permit"],
      required_ppe: ["Hard Hat", "Safety Glasses", "High Visibility Vest", "Gloves", "Steel Toe Boots"],
      scope_of_work:
        "Interior fit-out, material movement, and phased coordination with adjacent active healthcare areas.",
      site_specific_notes:
        "Maintain sterile boundary protections, preserve clear egress lanes, and coordinate deliveries with owner schedule windows.",
      emergency_procedures:
        "Stop work on any patient-area impact, notify supervisor and facility contact, then follow emergency escalation matrix.",
      document_number: "CSEP-DEMO-CL-20260425",
    };
  }

  return {
    project_name: jobsite?.name || OFFLINE_DEMO_CSEP_PREFILL.project_name || "North Tower",
    project_number: jobsite?.projectNumber || OFFLINE_DEMO_CSEP_PREFILL.project_number || "SR-1042",
    project_address: jobsite?.location || OFFLINE_DEMO_CSEP_PREFILL.project_address || "Austin, TX",
    trade: "Structural Steel and Erection",
    subTrade: "Steel Erection and Decking",
    tasks: ["Hoisting and Rigging", "Steel Erection", "Welding and Cutting", "Work at Heights"],
    selected_hazards: ["Falls", "Struck-by", "Caught-in/between", "Electrical"],
    additional_permits: ["Hot Work Permit", "AWP/MEWP Permit", "LOTO Permit"],
    scope_of_work:
      "Install structural steel and decking, execute hot-work welding, and coordinate crane picks in an active multi-trade zone.",
    site_specific_notes:
      "Demo site rules: maintain exclusion zones under suspended loads, enforce controlled access near leading edges, and require pre-task lift briefings.",
    emergency_procedures:
      "Stop work, notify supervision via radio channel 1, call 911 for life-threatening events, and report all incidents in SafetyDocs360 before shift closeout.",
    document_number: "CSEP-DEMO-20260425",
  };
}

function withOfflineDemoPrefill(form: CSEPForm): CSEPForm {
  return {
    ...form,
    ...OFFLINE_DEMO_CSEP_PREFILL,
    weather_requirements: {
      ...form.weather_requirements,
      monitoringSources: ["NOAA weather radar", "Site anemometer checks each shift"],
      dailyReviewNotes:
        "Pause crane picks for lightning alerts or sustained winds above manufacturer/site limits.",
      heatControls: [
        "Water, shade, and rest schedule with supervisor verification during elevated heat index windows.",
      ],
    },
    selected_format_sections:
      OFFLINE_DEMO_CSEP_PREFILL.selected_format_sections ?? form.selected_format_sections,
    included_sections: OFFLINE_DEMO_CSEP_PREFILL.included_sections ?? form.included_sections,
  };
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toOptionGridItems(items: string[]): OptionGridItem[] {
  return items.map((item) => ({
    value: item,
    label: item,
  }));
}

function parseCommaSeparatedList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildJobsiteSelectLabel(jobsite: CompanyJobsite) {
  return [jobsite.name, jobsite.projectNumber, jobsite.location].filter(Boolean).join(" | ");
}

export default function CSEPPage() {
  const { jobsites, loading: jobsitesLoading } = useCompanyWorkspaceData();
  const [form, setForm] = useState<CSEPForm>(initialForm);
  const [step, setStep] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [previewState, setPreviewState] = useState<CsepPreviewState | null>(null);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [companyLogoPreviewUrl, setCompanyLogoPreviewUrl] = useState<string | null>(null);
  const [companyLogoFileName, setCompanyLogoFileName] = useState<string | null>(null);
  const [ownerMessagePresetId, setOwnerMessagePresetId] = useState("");
  const [agreedToSubmissionTerms, setAgreedToSubmissionTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [sectionAiState, setSectionAiState] = useState<
    Partial<Record<CsepBuilderAiSectionId, BuilderAiSectionState>>
  >({});
  const [checklistEvaluation, setChecklistEvaluation] = useState<ChecklistEvaluationResponse | null>(
    null
  );
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
  const [isOfflineDemoPrefillEnabled, setIsOfflineDemoPrefillEnabled] = useState(false);
  const [csepHandoffComplete, setCsepHandoffComplete] = useState(false);
  const [csepHandoffAt, setCsepHandoffAt] = useState<string | null>(null);
  const checklistRequestRef = useRef(0);
  const checklistAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Error loading user:", error.message);
          return;
        }

        if (!user) return;

        setUserId(user.id);
        const userEmail = (user.email ?? "").trim().toLowerCase();
        const isOfflineDemoUser =
          userEmail === OFFLINE_DEMO_EMAIL ||
          process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1";
        setIsOfflineDemoPrefillEnabled(isOfflineDemoUser);

        const sessionResult = await supabase.auth.getSession();
        const accessToken = sessionResult.data.session?.access_token;
        if (!accessToken) return;

        const meResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const meData = (await meResponse.json().catch(() => null)) as
          | {
              user?: {
                permissionMap?: PermissionMap;
                companyProfile?: { state_region?: string | null } | null;
              };
            }
          | null;

        if (!meResponse.ok) return;

        setPermissionMap(meData?.user?.permissionMap ?? null);

        const companyState = meData?.user?.companyProfile?.state_region?.trim() ?? "";
        if (companyState) {
          setForm((prev) => (prev.governing_state ? prev : { ...prev, governing_state: companyState }));
        }
        if (isOfflineDemoUser) {
          setForm((prev) => withOfflineDemoPrefill(prev));
          setMessage("Offline demo mode: CSEP blocks prefilled with fictional visual data.");
          setMessageTone("success");
        }
      } catch (error) {
        console.error("Unexpected auth error:", error);
      } finally {
        setAuthLoading(false);
      }
    }

    void loadUser();
  }, []);

  const selectedTrade = useMemo(() => {
    if (!form.trade) return null;
    return buildCsepTradeSelection(form.trade, form.subTrade, form.tasks);
  }, [form.subTrade, form.tasks, form.trade]);

  const derivedHazards = useMemo(() => selectedTrade?.derivedHazards ?? [], [selectedTrade]);
  const derivedPermits = useMemo(() => selectedTrade?.derivedPermits ?? [], [selectedTrade]);
  const overlapPermitHints = useMemo(() => selectedTrade?.overlapPermitHints ?? [], [selectedTrade]);
  const commonOverlappingTrades = useMemo(
    () => selectedTrade?.commonOverlappingTrades ?? [],
    [selectedTrade]
  );
  const displayedTradeItems = useMemo(() => {
    if (!selectedTrade) return [];
    if (form.selected_hazards.length === 0) return selectedTrade.items;
    return selectedTrade.items.filter((item) => form.selected_hazards.includes(item.hazard));
  }, [form.selected_hazards, selectedTrade]);
  const selectedPermitItems = useMemo(
    () => uniq([...form.additional_permits, ...derivedPermits, ...overlapPermitHints]),
    [derivedPermits, form.additional_permits, overlapPermitHints]
  );
  const jobsiteOptions = useMemo(
    () =>
      jobsites
        .filter((jobsite) => jobsite.source === "table")
        .map((jobsite) => ({
          value: jobsite.id,
          label: buildJobsiteSelectLabel(jobsite),
        })),
    [jobsites]
  );
  const eligiblePricedAttachments = useMemo<CSEPPricedItemCatalogEntry[]>(
    () =>
      deriveEligibleCsepPricedItems({
        trade: selectedTrade?.tradeLabel ?? form.trade,
        subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
        tasks: form.tasks,
        selectedHazards: form.selected_hazards,
        derivedHazards,
        selectedPermits: selectedPermitItems,
      }),
    [
      derivedHazards,
      form.selected_hazards,
      form.subTrade,
      form.tasks,
      form.trade,
      selectedPermitItems,
      selectedTrade?.subTradeLabel,
      selectedTrade?.tradeLabel,
    ]
  );
  const selectedPricedAttachments = useMemo(
    () =>
      resolveSelectedCsepPricedItems({
        selectedKeys: form.priced_attachment_keys,
        eligibleItems: eligiblePricedAttachments,
      }),
    [eligiblePricedAttachments, form.priced_attachment_keys]
  );
  const pricedAttachmentOptions = useMemo<OptionGridItem[]>(
    () =>
      eligiblePricedAttachments.map((item) => ({
        value: item.key,
        label: item.label,
        description:
          item.category === "permit" ? "Permit pricing" : "Trade-linked add-on pricing",
        badge: formatCsepPrice(item.price),
      })),
    [eligiblePricedAttachments]
  );
  const selectedPricedAttachmentTotal = useMemo(
    () => selectedPricedAttachments.reduce((total, item) => total + item.price, 0),
    [selectedPricedAttachments]
  );
  const eligiblePricedAttachmentTotal = useMemo(
    () => eligiblePricedAttachments.reduce((total, item) => total + item.price, 0),
    [eligiblePricedAttachments]
  );
  const programSelectionState = useMemo(
    () =>
      buildCsepProgramSelections({
        selectedHazards: form.selected_hazards,
        selectedPermits: selectedPermitItems,
        selectedPpe: form.required_ppe,
        tradeItems: displayedTradeItems,
        selectedTasks: form.tasks,
        subtypeSelections: form.program_subtype_selections,
      }),
    [
      displayedTradeItems,
      form.program_subtype_selections,
      form.required_ppe,
      form.selected_hazards,
      form.tasks,
      selectedPermitItems,
    ]
  );
  const autoPrograms = useMemo(() => listProgramTitles(programSelectionState.selections), [programSelectionState.selections]);
  const missingProgramSubtypeGroups = useMemo(
    () => programSelectionState.missingSubtypeGroups,
    [programSelectionState.missingSubtypeGroups]
  );

  useEffect(() => {
    const eligibleKeys = new Set(eligiblePricedAttachments.map((item) => item.key));

    setForm((prev) => {
      const nextKeys = prev.priced_attachment_keys.filter((key) => eligibleKeys.has(key));
      return nextKeys.length === prev.priced_attachment_keys.length
        ? prev
        : { ...prev, priced_attachment_keys: nextKeys };
    });
  }, [eligiblePricedAttachments]);

  const jurisdictionProfile = useMemo(
    () => resolveBuilderJurisdiction({ governingState: form.governing_state }),
    [form.governing_state]
  );

  const canUseBuilder = Boolean(permissionMap?.can_create_documents && permissionMap?.can_edit_documents);
  const canSubmitDocuments = Boolean(permissionMap?.can_submit_documents);

  const checklistFormData = useMemo(
    () => ({
      ...form,
      governing_state: form.governing_state,
      trade: selectedTrade?.tradeLabel ?? form.trade,
      subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
      tradeItems: displayedTradeItems,
      selected_hazards: form.selected_hazards,
      additional_permits: selectedPermitItems,
      required_ppe: form.required_ppe,
      overlapPermitHints,
      common_overlapping_trades: commonOverlappingTrades,
    }),
    [
      commonOverlappingTrades,
      displayedTradeItems,
      form,
      overlapPermitHints,
      selectedPermitItems,
      selectedTrade?.subTradeLabel,
      selectedTrade?.tradeLabel,
    ]
  );

  const refreshChecklistEvaluation = useCallback(async () => {
    if (authLoading || !canUseBuilder) return;
    const requestId = checklistRequestRef.current + 1;
    checklistRequestRef.current = requestId;
    checklistAbortControllerRef.current?.abort();
    const controller = new AbortController();
    checklistAbortControllerRef.current = controller;
    setChecklistLoading(true);
    setChecklistError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in to evaluate checklist coverage.");
      }
      const response = await fetch("/api/company/checklist/evaluate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface: "csep",
          formData: checklistFormData,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | ChecklistEvaluationResponse
        | null;
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "Checklist evaluation failed.");
      }
      if (requestId !== checklistRequestRef.current) return;
      setChecklistEvaluation(payload as ChecklistEvaluationResponse);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      if (requestId !== checklistRequestRef.current) return;
      setChecklistError(error instanceof Error ? error.message : "Checklist evaluation failed.");
    } finally {
      if (requestId !== checklistRequestRef.current) return;
      setChecklistLoading(false);
    }
  }, [authLoading, canUseBuilder, checklistFormData]);

  useEffect(() => {
    if (authLoading || !canUseBuilder) return;
    const timeout = window.setTimeout(() => {
      void refreshChecklistEvaluation();
    }, 700);
    return () => {
      window.clearTimeout(timeout);
      checklistAbortControllerRef.current?.abort();
    };
  }, [authLoading, canUseBuilder, refreshChecklistEvaluation]);

  const csepReady =
    Boolean(form.trade.trim()) &&
    Boolean(form.project_delivery_type) &&
    Boolean(form.subTrade.trim()) &&
    form.tasks.length > 0 &&
    form.selected_hazards.length > 0 &&
    missingProgramSubtypeGroups.length === 0;
  const taskDrivenStepNumber = workflowDefinition.findIndex((item) => item.title === "Task-driven sections") + 1;
  const reviewStepNumber = workflowDefinition.findIndex((item) => item.title === "Draft review") + 1;

  const selectedSectionStatuses = useMemo(
    () =>
      csepFormatSectionOptionItems.map((section) => {
        const included = form.selected_format_sections.includes(section.value as CsepFormatSectionKey);
        const label = section.label;
        const dependency = TASK_DRIVEN_SECTION_LABELS.has(label)
          ? "Requires tasks"
          : ENRICHMENT_DRIVEN_SECTION_LABELS.has(label)
            ? "Requires hazards/program setup"
            : "Ready now";

        return { ...section, included, dependency };
      }),
    [form.selected_format_sections]
  );

  const unlockedTaskDrivenSections = selectedSectionStatuses.filter(
    (section) => section.included && section.dependency !== "Requires hazards/program setup"
  );

  const submissionFormData = useMemo(
    () => ({
      ...form,
      gc_cm: form.gc_cm.map((line) => line.trim()).filter(Boolean),
      company_logo_data_url: companyLogoPreviewUrl,
      company_logo_file_name: companyLogoFileName,
      governing_state: form.governing_state,
      jurisdiction_code: jurisdictionProfile.jurisdictionCode,
      jurisdiction_plan_type: jurisdictionProfile.jurisdictionPlanType,
      trade: selectedTrade?.tradeLabel ?? form.trade,
      subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
      tradeSummary: selectedTrade?.summary ?? "",
      oshaRefs: selectedTrade?.oshaRefs ?? [],
      tasks: [...form.tasks],
      tradeItems: displayedTradeItems,
      derivedHazards,
      derivedPermits,
      overlapPermitHints,
      priced_attachment_keys: [...form.priced_attachment_keys],
      priced_attachments: selectedPricedAttachments,
      common_overlapping_trades: commonOverlappingTrades,
      selected_format_sections: form.selected_format_sections,
      programSelections: programSelectionState.selections,
      program_subtype_selections: form.program_subtype_selections,
      weather_requirements: form.weather_requirements,
      document_number: form.document_number,
      document_revision: form.document_revision,
      issue_date: form.issue_date,
      prepared_by: form.prepared_by,
      reviewed_by: form.reviewed_by,
      approved_by: form.approved_by,
      owner_message_text: form.owner_message_text,
      roles_and_responsibilities_text: form.roles_and_responsibilities_text,
      security_and_access_text: form.security_and_access_text,
      health_and_wellness_text: form.health_and_wellness_text,
      incident_reporting_and_investigation_text: form.incident_reporting_and_investigation_text,
      training_and_instruction_text: form.training_and_instruction_text,
      drug_and_alcohol_testing_text: form.drug_and_alcohol_testing_text,
      enforcement_and_corrective_action_text: form.enforcement_and_corrective_action_text,
      recordkeeping_text: form.recordkeeping_text,
      continuous_improvement_text: form.continuous_improvement_text,
      includedContent: {
        project_information: form.included_sections.includes("Project Information"),
        contractor_information: form.included_sections.includes("Contractor Information"),
        trade_summary: form.included_sections.includes("Trade Summary"),
        scope_of_work:
          form.included_sections.includes("Scope Summary") ||
          form.included_sections.includes("Scope of Work"),
        site_specific_notes:
          form.included_sections.includes("Project-Specific Safety Notes") ||
          form.included_sections.includes("Site Specific Notes"),
        emergency_procedures: form.included_sections.includes("Emergency Procedures"),
        weather_requirements_and_severe_weather_response: form.included_sections.includes(
          "Weather Requirements and Severe Weather Response"
        ),
        required_ppe: form.included_sections.includes("Required PPE"),
        additional_permits: form.included_sections.includes("Additional Permits"),
        common_overlapping_trades: form.included_sections.includes("Common Overlapping Trades"),
        osha_references: form.included_sections.includes("OSHA References"),
        selected_hazards: form.included_sections.includes("Selected Hazards"),
        activity_hazard_matrix: form.included_sections.includes("Activity / Hazard Matrix"),
        roles_and_responsibilities: form.included_sections.includes("Roles and Responsibilities"),
        security_and_access: form.included_sections.includes("Security and Access"),
        health_and_wellness: form.included_sections.includes("Health and Wellness"),
        incident_reporting_and_investigation: form.included_sections.includes(
          "Incident Reporting and Investigation"
        ),
        training_and_instruction: form.included_sections.includes("Training and Instruction"),
        drug_and_alcohol_testing: formIncludesDrugAlcoholSection(form.included_sections),
        enforcement_and_corrective_action: form.included_sections.includes(
          "Enforcement and Corrective Action"
        ),
        recordkeeping: form.included_sections.includes("Recordkeeping"),
        continuous_improvement: form.included_sections.includes("Continuous Improvement"),
      },
    }),
    [
      commonOverlappingTrades,
      companyLogoFileName,
      companyLogoPreviewUrl,
      derivedHazards,
      derivedPermits,
      displayedTradeItems,
      form,
      jurisdictionProfile.jurisdictionCode,
      jurisdictionProfile.jurisdictionPlanType,
      overlapPermitHints,
      selectedPricedAttachments,
      programSelectionState.selections,
      selectedTrade?.oshaRefs,
      selectedTrade?.subTradeLabel,
      selectedTrade?.summary,
      selectedTrade?.tradeLabel,
    ]
  );

  const payloadSignature = useMemo(() => JSON.stringify(submissionFormData), [submissionFormData]);
  const previewIsCurrent = previewState?.payloadSignature === payloadSignature;
  const previewHasBlockingCoverageGaps = hasBlockingCsepCoverageAudit(
    previewState?.draft.coverageAudit
  );
  const previewReadyForSubmit = Boolean(
    previewState && previewIsCurrent && previewApproved && !previewHasBlockingCoverageGaps
  );
  const nextRequiredInput = !form.trade.trim()
    ? "Choose a trade to start the live CSEP path."
    : !form.project_delivery_type
      ? "Set the project delivery type to complete the trade setup step."
      : !form.subTrade.trim()
        ? "Choose the active sub-trade so the task list can load."
        : form.selected_format_sections.length === 0
          ? "Select at least one CSEP section for the final document layout."
          : form.tasks.length === 0
            ? `Pick at least one task to unlock task-driven sections in Step ${taskDrivenStepNumber}.`
            : form.selected_hazards.length === 0
              ? "Review hazards in intelligence enrichment so the draft can include the right matrix and controls."
              : missingProgramSubtypeGroups.length > 0
                ? "Finish the required program classifications in intelligence enrichment."
                : !previewState
                  ? `Generate the draft in Step ${reviewStepNumber}.`
                  : !previewIsCurrent
                    ? `Inputs changed after the last draft. Regenerate and approve the current draft in Step ${reviewStepNumber}.`
                    : !previewApproved
                      ? `Approve the current draft in Step ${reviewStepNumber}.`
                      : !agreedToSubmissionTerms
                        ? "Accept the legal terms before submitting the document."
                        : "The builder is ready for submission.";
  const csepAiBaseContext = useMemo(
    () => ({
      surface: "csep_builder",
      currentStep: workflowDefinition[step]?.title ?? null,
      project_name: form.project_name,
      project_number: form.project_number,
      project_address: form.project_address,
      governing_state: form.governing_state,
      project_delivery_type: form.project_delivery_type,
      owner_client: form.owner_client,
      owner_message_text: form.owner_message_text,
      gc_cm: form.gc_cm,
      contractor_company: form.contractor_company,
      contractor_contact: form.contractor_contact,
      contractor_phone: form.contractor_phone,
      contractor_email: form.contractor_email,
      trade: selectedTrade?.tradeLabel ?? form.trade,
      subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
      tasks: form.tasks,
      selected_hazards: form.selected_hazards,
      required_ppe: form.required_ppe,
      selected_permits: selectedPermitItems,
      weather_requirements: form.weather_requirements,
      checklistEvaluationSummary: checklistEvaluation?.summary ?? null,
      checklistNeedsUserInput:
        checklistEvaluation?.rows
          .filter((row) => row.coverage === "needs_user_input")
          .slice(0, 10)
          .map((row) => ({
            item: row.item,
            missingFields: row.missingFields,
          })) ?? [],
      ai_task_first_rule:
        "Selected tasks are the primary drafting anchor. Broader trade or project content should only be used when it directly supports those tasks.",
    }),
    [
      checklistEvaluation,
      form.contractor_company,
      form.contractor_contact,
      form.contractor_email,
      form.contractor_phone,
      form.gc_cm,
      form.governing_state,
      form.owner_client,
      form.owner_message_text,
      form.project_address,
      form.project_delivery_type,
      form.project_name,
      form.project_number,
      form.required_ppe,
      form.selected_hazards,
      form.subTrade,
      form.tasks,
      form.trade,
      form.weather_requirements,
      selectedPermitItems,
      selectedTrade?.subTradeLabel,
      selectedTrade?.tradeLabel,
      step,
    ]
  );

  useEffect(() => {
    if (!previewState) return;
    if (previewState.payloadSignature === payloadSignature) return;
    setPreviewApproved(false);
  }, [payloadSignature, previewState]);

  useEffect(() => {
    if (step !== 3) return;
    if (form.tasks.length === 0) return;
    setMessageTone("success");
    setMessage(
      `Tasks selected. Finish intelligence enrichment next, then complete the task-driven sections in Step ${taskDrivenStepNumber}.`
    );
  }, [form.tasks.length, step, taskDrivenStepNumber]);

  function handleCompanyLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCompanyLogoPreviewUrl(typeof reader.result === "string" ? reader.result : null);
      setCompanyLogoFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function clearCompanyLogo() {
    setCompanyLogoPreviewUrl(null);
    setCompanyLogoFileName(null);
  }

  function updateField<K extends keyof CSEPForm>(field: K, value: CSEPForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateGcCmPartnerLine(index: number, value: string) {
    setForm((prev) => {
      const next = [...prev.gc_cm];
      next[index] = value;
      return { ...prev, gc_cm: next };
    });
  }

  function addGcCmPartnerLine() {
    setForm((prev) => ({ ...prev, gc_cm: [...prev.gc_cm, ""] }));
  }

  function removeGcCmPartnerLine(index: number) {
    setForm((prev) => {
      if (prev.gc_cm.length <= 1) {
        return { ...prev, gc_cm: [""] };
      }
      return { ...prev, gc_cm: prev.gc_cm.filter((_, i) => i !== index) };
    });
  }

  function applyJobsiteToForm(jobsiteId: string) {
    const selectedJobsite = jobsites.find((jobsite) => jobsite.id === jobsiteId);

    setForm((prev) => {
      if (!selectedJobsite) {
        return { ...prev, jobsite_id: "" };
      }

      const scenario = isOfflineDemoPrefillEnabled
        ? buildOfflineDemoJobsiteScenario(selectedJobsite)
        : null;
      return {
        ...prev,
        ...(scenario ?? {}),
        jobsite_id: selectedJobsite.id,
        project_name: selectedJobsite.name,
        project_number: selectedJobsite.projectNumber || prev.project_number,
        project_address: selectedJobsite.location || prev.project_address,
        site_specific_notes: selectedJobsite.notes || prev.site_specific_notes,
        prepared_by: selectedJobsite.projectManager || prev.prepared_by,
        reviewed_by: selectedJobsite.safetyLead || prev.reviewed_by,
      };
    });
  }

  function handleOwnerMessagePresetChange(value: string) {
    setOwnerMessagePresetId(value);
    const preset = getOwnerMessagePreset(value);
    if (preset) {
      updateField("owner_message_text", preset.message);
    }
  }

  function updateWeatherField<K extends keyof CsepWeatherSectionInput>(
    field: K,
    value: CsepWeatherSectionInput[K]
  ) {
    setForm((prev) => ({
      ...prev,
      weather_requirements: {
        ...prev.weather_requirements,
        [field]: value,
      },
    }));
  }

  function setArrayValues(field: MultiSelectField, values: string[]) {
    setForm((prev) => ({ ...prev, [field]: uniq(values) }));
  }

  function toggleArrayValue(field: MultiSelectField, value: string) {
    setForm((prev) => {
      const current = prev[field];
      const exists = current.includes(value);

      return {
        ...prev,
        [field]: exists ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  }

  function applyAllValues(field: MultiSelectField, values: string[]) {
    setArrayValues(field, values);
  }

  function clearAllValues(field: MultiSelectField) {
    setArrayValues(field, []);
  }

  function applySelectedFormatSections(values: CsepFormatSectionKey[]) {
    const nextLegacySections = buildLegacyIncludedSectionLabelsFromFormatSections(values);
    setForm((prev) => ({
      ...prev,
      selected_format_sections: values,
      included_sections: nextLegacySections,
    }));
  }

  function toggleSelectedFormatSection(value: string) {
    setForm((prev) => {
      const key = value as CsepFormatSectionKey;
      const exists = prev.selected_format_sections.includes(key);
      const nextFormatSections = exists
        ? prev.selected_format_sections.filter((item) => item !== key)
        : [...prev.selected_format_sections, key];

      return {
        ...prev,
        selected_format_sections: nextFormatSections,
        included_sections: buildLegacyIncludedSectionLabelsFromFormatSections(nextFormatSections),
      };
    });
  }

  function updateProgramSubtypeSelection(
    group: CSEPProgramSubtypeGroup,
    value: CSEPProgramSubtypeValue | ""
  ) {
    setForm((prev) => ({
      ...prev,
      program_subtype_selections: {
        ...prev.program_subtype_selections,
        [group]: value || undefined,
      },
    }));
  }

  function applyTradeDefaults() {
    if (!selectedTrade) return;

    setForm((prev) => ({
      ...prev,
      required_ppe: uniq([...prev.required_ppe, ...selectedTrade.defaultPPE]),
      additional_permits: uniq([...prev.additional_permits, ...derivedPermits]),
      selected_hazards: uniq([...prev.selected_hazards, ...derivedHazards]),
    }));
  }

  function resetBuilder() {
    setForm(initialForm);
    setStep(0);
    setPreviewState(null);
    setPreviewApproved(false);
    clearCompanyLogo();
    setOwnerMessagePresetId("");
    setAgreedToSubmissionTerms(false);
    setCsepHandoffComplete(false);
    setCsepHandoffAt(null);
    setMessage("");
    setSectionAiState({});
  }

  function setBuilderAiSectionState(
    sectionId: CsepBuilderAiSectionId,
    next: Partial<BuilderAiSectionState>
  ) {
    setSectionAiState((prev) => ({
      ...prev,
      [sectionId]: {
        loading: false,
        message: "",
        tone: "success",
        ...prev[sectionId],
        ...next,
      },
    }));
  }

  function getBuilderAiSectionState(sectionId: CsepBuilderAiSectionId): BuilderAiSectionState {
    return (
      sectionAiState[sectionId] ?? {
        loading: false,
        message: "",
        tone: "success",
      }
    );
  }

  function canUseBuilderAi(sectionId: CsepBuilderAiSectionId) {
    const labels = resolveIncludedSectionLabelsForAiSection(sectionId);
    return (
      canUseBuilder &&
      form.tasks.length > 0 &&
      labels.some((label) => form.included_sections.includes(label))
    );
  }

  function shouldShowBuilderAiAction(sectionId: CsepBuilderAiSectionId) {
    const labels = resolveIncludedSectionLabelsForAiSection(sectionId);
    return labels.some((label) => form.included_sections.includes(label));
  }

  function renderBuilderAiAction(sectionId: CsepBuilderAiSectionId, idleLabel?: string) {
    const config = getCsepBuilderAiSectionConfig(sectionId);
    const aiState = getBuilderAiSectionState(sectionId);
    const aiEnabled = canUseBuilderAi(sectionId);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleAiFillSection(sectionId)}
            disabled={aiState.loading || !aiEnabled}
            className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-50"
          >
            {aiState.loading
              ? `Drafting ${config.title.toLowerCase()}...`
              : idleLabel ?? `Smart draft ${config.title.toLowerCase()}`}
          </button>
          {!form.tasks.length ? (
            <span className="text-xs text-[var(--app-text)]">
              Select at least one task to unlock smart drafting for this section in Step {taskDrivenStepNumber}.
            </span>
          ) : null}
        </div>
        {aiState.message ? <InlineMessage tone={aiState.tone}>{aiState.message}</InlineMessage> : null}
      </div>
    );
  }

  async function handleAiFillSection(sectionId: CsepBuilderAiSectionId) {
    try {
      const config = getCsepBuilderAiSectionConfig(sectionId);
      setMessage("");
      setBuilderAiSectionState(sectionId, { loading: true, message: "", tone: "success" });

      if (!canUseBuilder) {
        const warningMessage = `Your current role cannot edit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} builder fields.`;
        setMessageTone("warning");
        setMessage(warningMessage);
        setBuilderAiSectionState(sectionId, {
          loading: false,
          message: warningMessage,
          tone: "warning",
        });
        return;
      }

      if (form.tasks.length === 0) {
        const warningMessage = `Select at least one task before using smart drafting in Step ${taskDrivenStepNumber}.`;
        setMessageTone("warning");
        setMessage(warningMessage);
        setBuilderAiSectionState(sectionId, {
          loading: false,
          message: warningMessage,
          tone: "warning",
        });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sign in to use smart drafting.");
      }

      const currentValue =
        config.kind === "weather" ? form.weather_requirements : form[config.fieldKey];
      const prompt = buildCsepBuilderAiPrompt({
        sectionId,
        currentValue,
        context: {
          project_name: form.project_name,
          project_number: form.project_number,
          project_address: form.project_address,
          governing_state: form.governing_state,
          project_delivery_type: form.project_delivery_type,
          owner_client: form.owner_client,
          gc_cm: form.gc_cm,
          contractor_company: form.contractor_company,
          contractor_contact: form.contractor_contact,
          contractor_phone: form.contractor_phone,
          contractor_email: form.contractor_email,
          trade: selectedTrade?.tradeLabel ?? form.trade,
          subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
          tasks: form.tasks,
          selected_hazards: form.selected_hazards,
          required_ppe: form.required_ppe,
          selected_permits: selectedPermitItems,
        },
      });
      const structuredContext = JSON.stringify({
        ...csepAiBaseContext,
        ai_section: {
          id: config.id,
          title: config.title,
          kind: config.kind,
          included_section_label: config.includedSectionLabel,
          current_value: currentValue,
          selected_tasks_are_primary: true,
        },
      });

      const response = await fetch("/api/company/ai/assist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface: "csep",
          message: prompt,
          context: structuredContext,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; text?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Smart drafting failed.");
      }

      if (config.kind === "weather") {
        const parsed = parseCsepWeatherSectionAiResponse(payload?.text ?? "");

        if (!parsed) {
          throw new Error(
            "Smart fill could not read the AI reply as structured weather fields (for example, it may have returned plain paragraphs instead of the required JSON). Click Smart fill again, or type into the fields below."
          );
        }

        if (Object.keys(parsed).length === 0) {
          throw new Error(
            "The AI reply did not include any recognizable weather overlay values. Try Smart fill again or enter the fields manually."
          );
        }

        setForm((prev) => ({
          ...prev,
          weather_requirements: {
            ...prev.weather_requirements,
            ...parsed,
          },
        }));
      } else {
        const parsed = parseCsepAiTextResponse(payload?.text ?? "", config.title);
        if (!parsed) {
          throw new Error(`The smart drafting response did not include usable ${config.title.toLowerCase()} content.`);
        }

        setForm((prev) => ({
          ...prev,
          [config.fieldKey]: parsed,
        }));
      }

      setMessageTone("success");
      setMessage(`Smart drafting updated the ${config.title.toLowerCase()} section.`);
      setBuilderAiSectionState(sectionId, {
        loading: false,
        message: `${config.title} was updated.`,
        tone: "success",
      });
    } catch (error) {
      setMessageTone("error");
      const errorMessage = error instanceof Error ? error.message : "Smart drafting failed.";
      setMessage(errorMessage);
      setBuilderAiSectionState(sectionId, {
        loading: false,
        message: errorMessage,
        tone: "error",
      });
    } finally {
      setSectionAiState((prev) => ({
        ...prev,
        [sectionId]: {
          loading: false,
          message: prev[sectionId]?.message ?? "",
          tone: prev[sectionId]?.tone ?? "success",
        },
      }));
    }
  }

  async function handleGenerateDraft() {
    try {
      setMessage("");

      if (!canUseBuilder) {
        setMessageTone("warning");
        setMessage(`Your current role cannot generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} drafts.`);
        return;
      }

      if (!csepReady) {
        setMessageTone("warning");
        setMessage("Complete the trade, tasks, hazards, and program setup before generating the draft.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      setPreviewLoading(true);
      const previewFormData = buildCompactCsepRequestFormData(submissionFormData);

      const response = await fetch("/api/company/csep/preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_name: form.project_name,
          form_data: previewFormData,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            generated_document_id?: string;
            builder_input_hash?: string;
            draft?: GeneratedSafetyPlanDraft;
          }
        | null;

      if (!response.ok) {
        const detail =
          payload?.error ||
          `Failed to generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} smart draft (${response.status}).`;
        if (response.status === 409) {
          console.warn(
            "[CSEP preview] Export validation failed â€” open the message below in the banner, fix the issue, then regenerate.",
            detail
          );
        } else {
          console.warn("[CSEP preview] Request failed", { status: response.status, detail });
        }
        throw new Error(detail);
      }

      if (!payload?.generated_document_id || !payload.builder_input_hash || !payload.draft) {
        throw new Error("Smart draft response was incomplete. Please try again.");
      }

      setPreviewState({
        generatedDocumentId: payload.generated_document_id,
        builderInputHash: payload.builder_input_hash,
        draft: payload.draft,
        payloadSignature,
      });
      setPreviewApproved(false);
      setMessageTone("success");
      setMessage("Smart draft generated. Review the selected sections, then approve the current version.");
    } catch (error) {
      setPreviewApproved(false);
      setMessageTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : `Failed to generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} smart draft.`
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmitForReview() {
    try {
      setMessage("");

      if (!permissionMap?.can_submit_documents) {
        setMessageTone("warning");
        setMessage(`Your current role cannot submit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} records into review.`);
        return;
      }

      if (!userId) {
        setMessageTone("error");
        setMessage("No logged-in user was found. Please log in again.");
        return;
      }

      if (!agreedToSubmissionTerms) {
        setMessageTone("warning");
        setMessage(
          `You must agree to the Terms of Service, Liability Waiver, and Licensing Agreement before submitting your ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}.`
        );
        return;
      }

      if (!previewState || !previewIsCurrent || !previewApproved) {
        setMessageTone("warning");
        setMessage("Generate, review, and approve a current smart draft before submitting this CSEP.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      setSubmitLoading(true);
      const submitFormData = buildCompactCsepRequestFormData(submissionFormData, {
        includeLogo: true,
      });

      const response = await fetch("/api/documents/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: form.project_name,
          generated_document_id: previewState.generatedDocumentId,
          builder_input_hash: previewState.builderInputHash,
          form_data: submitFormData,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Failed to submit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}.`);
      }

      setCsepHandoffComplete(true);
      setCsepHandoffAt(new Date().toISOString());
      setMessageTone("success");
      setMessage(`${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} submitted successfully for admin review.`);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : `Failed to submit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}.`);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleOpenDemoPackFolder() {
    try {
      const response = await fetch("/api/offline/demo-pack/open", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Could not open demo pack folder.");
      }
    } catch (error) {
      setMessageTone("warning");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not open demo pack folder."
      );
    }
  }

  const readinessChecklist = [
    { label: "Trade selected", done: Boolean(form.trade.trim()) },
    { label: "Sub-trade selected", done: Boolean(form.subTrade.trim()) },
    { label: "At least one section selected", done: form.selected_format_sections.length > 0 },
    { label: "At least one task selected", done: form.tasks.length > 0 },
    { label: "Hazards selected", done: form.selected_hazards.length > 0 },
    { label: "Program classifications complete", done: missingProgramSubtypeGroups.length === 0 },
    { label: "Task-driven sections unlocked", done: form.tasks.length > 0 && unlockedTaskDrivenSections.length > 0 },
    { label: "Smart draft approved", done: previewReadyForSubmit },
  ];

  const workflowSteps = workflowDefinition.map((item, index) => ({
    label: item.title,
    detail: item.detail,
    active: step === index,
    complete:
      index === 0
        ? Boolean(form.trade.trim()) && Boolean(form.project_delivery_type)
        : index === 1
          ? Boolean(form.subTrade.trim())
          : index === 2
            ? form.selected_format_sections.length > 0
          : index === 3
              ? form.tasks.length > 0
              : index === 4
                ? csepReady
                : index === 5
                  ? Boolean(form.project_name.trim()) &&
                    Boolean(form.contractor_company.trim()) &&
                    unlockedTaskDrivenSections.length > 0
                  : index === 6
                    ? Boolean(previewState && previewIsCurrent && previewApproved)
                    : csepHandoffComplete,
  }));
  const activeWorkflowCategory =
    workflowCategoryDefinition.find((category) => category.stepIndexes.includes(step)) ??
    workflowCategoryDefinition[0];

  function canProceed(currentStep: number) {
    if (currentStep === 0) return Boolean(form.trade.trim()) && Boolean(form.project_delivery_type);
    if (currentStep === 1) return Boolean(form.subTrade.trim());
    if (currentStep === 2) return form.selected_format_sections.length > 0;
    if (currentStep === 3) return form.tasks.length > 0;
    if (currentStep === 4) return csepReady;
    if (currentStep === 5) return Boolean(form.project_name.trim()) && Boolean(form.contractor_company.trim());
    if (currentStep === 6) return Boolean(previewState && previewIsCurrent && previewApproved);
    return true;
  }

  /** Highest step index reachable via sequential gates (same as repeated "Next step"). Used so category tabs cannot skip ahead of `canProceed`. */
  function maxReachableStepIndex(): number {
    let max = 0;
    for (let i = 0; i < workflowDefinition.length - 1; i++) {
      if (!canProceed(i)) break;
      max = i + 1;
    }
    return max;
  }

  function goToStep(nextIndex: number) {
    const max = maxReachableStepIndex();
    if (nextIndex > max) {
      setMessageTone("warning");
      setMessage(
        nextIndex >= 6
          ? `Draft review and submission stay locked until earlier steps are complete. ${nextRequiredInput}`
          : `That step is not unlocked yet. ${nextRequiredInput}`
      );
      setStep(max);
      return;
    }
    setStep(nextIndex);
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Builder Workspace"
        title={CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL}
        description="Use the forward-only CSEP workflow: trade selection, sub-trade, selected sections, selectable tasks, intelligence enrichment, task-driven sections, draft review, then submission."
        actions={
          <div className="flex flex-wrap gap-2">
            {!isOfflineDemoPrefillEnabled ? (
              <>
                <StatusBadge label={form.trade || "Trade not set"} tone={form.trade ? "info" : "warning"} />
                <StatusBadge
                  label={`${form.selected_format_sections.length} sections`}
                  tone={form.selected_format_sections.length ? "success" : "warning"}
                />
                <StatusBadge
                  label={`${form.tasks.length} tasks`}
                  tone={form.tasks.length ? "success" : "warning"}
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={resetBuilder}
              className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
            >
              Reset builder
            </button>
          </div>
        }
      />

      {!authLoading && !canUseBuilder ? (
        <InlineMessage tone="warning">
          Your current role can review {CONTRACTOR_SAFETY_BLUEPRINT_TITLE} workflow information, but it cannot create or edit live drafts.
        </InlineMessage>
      ) : null}

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <SectionCard
        title="Builder Navigation"
        description="Move through the builder by main category first, then the active subcategory."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 border-b border-[var(--app-border)] pb-4">
            {workflowCategoryDefinition.map((category) => {
              const isActive = category.stepIndexes.includes(step);
              return (
                <button
                  key={category.title}
                  type="button"
                  onClick={() => goToStep(category.stepIndexes[0] ?? 0)}
                  className={`border-b-2 px-1 pb-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-[var(--app-accent-primary)] text-[var(--app-accent-primary)]"
                      : "border-transparent text-[var(--app-text)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)]"
                  }`}
                >
                  {category.title}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeWorkflowCategory.stepIndexes.map((stepIndex) => {
              const stepItem = workflowDefinition[stepIndex];
              const isActive = stepIndex === step;
              return (
                <button
                  key={`${activeWorkflowCategory.title}-${stepItem.title}`}
                  type="button"
                  onClick={() => goToStep(stepIndex)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
                      : "border-[var(--app-border)] bg-white text-[var(--app-text)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)]"
                  }`}
                >
                  {stepItem.title}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SectionCard
            title={`Step ${step + 1}: ${workflowDefinition[step].title}`}
            description={workflowDefinition[step].detail}
          >
            <fieldset disabled={authLoading || !canUseBuilder} className="space-y-6 disabled:opacity-60">
              {step === 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Trade"
                    value={form.trade}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        trade: value,
                        subTrade: "",
                        tasks: [],
                        priced_attachment_keys: [],
                        selected_hazards: [],
                        program_subtype_selections: {},
                      }))
                    }
                    options={tradeOptions.map((option) => ({ value: option, label: option }))}
                    placeholder="Choose trade"
                  />
                  <SelectField
                    label="Project delivery type"
                    value={form.project_delivery_type}
                    onChange={(value) => updateField("project_delivery_type", value)}
                    options={projectDeliveryOptions}
                    placeholder="Choose delivery type"
                  />
                  <SelectField
                    label="Governing state"
                    value={form.governing_state}
                    onChange={(value) => updateField("governing_state", value)}
                    options={jurisdictionStateOptions.map((option) => ({
                      value: option.code,
                      label: option.name,
                    }))}
                    placeholder="Choose state"
                  />
                  <InfoCard label="Jurisdiction profile" value={jurisdictionProfile.jurisdictionLabel} />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <SelectField
                    label="Sub-trade"
                    value={form.subTrade}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        subTrade: value,
                        tasks: [],
                        priced_attachment_keys: [],
                        selected_hazards: [],
                        program_subtype_selections: {},
                      }))
                    }
                    options={(selectedTrade?.availableSubTrades ?? []).map((option) => ({
                      value: option,
                      label: option,
                    }))}
                    placeholder="Choose sub-trade"
                    disabled={!form.trade}
                  />
                  {selectedTrade ? (
                    <InfoCard
                      label="Sub-trade summary"
                      value={
                        selectedTrade.subTradeDescription ??
                        "Choose a sub-trade to show the scope description for this selection."
                      }
                    />
                  ) : (
                    <InlineMessage tone="warning">
                      Choose a trade first so the live sub-trade list can be loaded.
                    </InlineMessage>
                  )}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <OptionGrid
                    items={csepFormatSectionOptionItems}
                    selectedItems={form.selected_format_sections}
                    onToggle={toggleSelectedFormatSection}
                    onApplyAll={() =>
                      applySelectedFormatSections(
                        CSEP_FORMAT_SECTION_OPTIONS.map((option) => option.value)
                      )
                    }
                    onClearAll={() => applySelectedFormatSections([])}
                  />
                  <SectionCard
                    title="Section dependency guide"
                    description="This step only controls which sections appear in the final draft. Task-driven sections open later after tasks are selected."
                  >
                    <div className="space-y-3">
                      {selectedSectionStatuses.map((section) => (
                        <InfoCard
                          key={`dependency-${section.value}`}
                          label={section.label}
                          value={
                            section.included
                              ? `${section.dependency}.`
                              : "Excluded from the draft."
                          }
                        />
                      ))}
                    </div>
                  </SectionCard>
                  {form.selected_format_sections.some((value) =>
                    TASK_DRIVEN_SECTION_LABELS.has(
                      csepFormatSectionOptionItems.find((section) => section.value === value)?.label ?? ""
                    )
                  ) ? (
                    <InlineMessage>
                      Task-driven sections stay locked until you choose the active task set, so you can move forward without bouncing back into this step.
                    </InlineMessage>
                  ) : null}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  {!form.subTrade ? (
                    <InlineMessage tone="warning">
                      Choose a sub-trade first so the task list can be loaded.
                    </InlineMessage>
                  ) : (
                    <>
                      <OptionGrid
                        items={toOptionGridItems(selectedTrade?.availableTasks ?? [])}
                        selectedItems={form.tasks}
                        onToggle={(value) => toggleArrayValue("tasks", value)}
                        onApplyAll={() => applyAllValues("tasks", selectedTrade?.availableTasks ?? [])}
                        onClearAll={() => clearAllValues("tasks")}
                      />
                      {(selectedTrade?.referenceTasks?.length ?? 0) > 0 ? (
                        <InfoCard
                          label="Reference tasks"
                          value={selectedTrade?.referenceTasks.join(", ") ?? ""}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={applyTradeDefaults}
                      disabled={!selectedTrade}
                      className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:opacity-50"
                    >
                      Apply trade defaults
                    </button>
                  </div>

                  <SectionBucket
                    title="Hazards to include"
                    items={toOptionGridItems(derivedHazards)}
                    selectedItems={form.selected_hazards}
                    onToggle={(value) => toggleArrayValue("selected_hazards", value)}
                    onApplyAll={() => applyAllValues("selected_hazards", derivedHazards)}
                    onClearAll={() => clearAllValues("selected_hazards")}
                    emptyLabel="Select a trade, sub-trade, and task to derive hazards."
                  />
                  <SectionBucket
                    title="Required PPE"
                    items={toOptionGridItems(ppeOptions)}
                    selectedItems={form.required_ppe}
                    onToggle={(value) => toggleArrayValue("required_ppe", value)}
                    onApplyAll={() => applyAllValues("required_ppe", ppeOptions)}
                    onClearAll={() => clearAllValues("required_ppe")}
                  />
                  <SectionBucket
                    title="Additional permits"
                    items={toOptionGridItems(permitOptions)}
                    selectedItems={form.additional_permits}
                    onToggle={(value) => toggleArrayValue("additional_permits", value)}
                    onApplyAll={() => applyAllValues("additional_permits", permitOptions)}
                    onClearAll={() => clearAllValues("additional_permits")}
                  />
                  <SectionBucket
                    title="Priced attached requirements"
                    items={pricedAttachmentOptions}
                    selectedItems={form.priced_attachment_keys}
                    onToggle={(value) => toggleArrayValue("priced_attachment_keys", value)}
                    onApplyAll={() =>
                      applyAllValues(
                        "priced_attachment_keys",
                        eligiblePricedAttachments.map((item) => item.key)
                      )
                    }
                    onClearAll={() => clearAllValues("priced_attachment_keys")}
                    summaryValue={
                      selectedPricedAttachments.length
                        ? `${selectedPricedAttachments.length} selected | ${formatCsepPrice(selectedPricedAttachmentTotal)}`
                        : eligiblePricedAttachments.length
                          ? `${eligiblePricedAttachments.length} available | ${formatCsepPrice(eligiblePricedAttachmentTotal)}`
                          : "No trade-linked pricing items are available yet."
                    }
                    emptyLabel="Select a trade path and task set to reveal permit pricing and add-on pricing."
                  />
                  <InfoCard label="OSHA references" value={(selectedTrade?.oshaRefs ?? []).join(" | ") || "None loaded yet"} />
                  <InfoCard label="Auto-generated programs" value={autoPrograms.join(" | ") || "None triggered yet"} />
                  <InfoCard
                    label="Common overlapping trades"
                    value={commonOverlappingTrades.join(" | ") || "None inferred yet"}
                  />
                  {overlapPermitHints.length ? (
                    <InlineMessage>
                      High-risk overlap permit hints: {overlapPermitHints.join(", ")}.
                    </InlineMessage>
                  ) : null}

                  <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                    <div className="text-sm font-semibold text-[var(--app-text-strong)]">Program classifications</div>
                    <div className="mt-4 space-y-4">
                      {programSelectionState.selections.length === 0 ? (
                        <div className="text-sm text-[var(--app-text)]">
                          Select hazards, permits, or PPE items to reveal any required classifications.
                        </div>
                      ) : missingProgramSubtypeGroups.length === 0 ? (
                        <div className="text-sm text-[var(--app-text)]">
                          The active program set does not need any extra subtype classifications right now.
                        </div>
                      ) : (
                        missingProgramSubtypeGroups.map((group) => {
                          const config = getSubtypeConfig(group.group);

                          return (
                            <div key={group.group} className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
                              <div className="text-sm font-semibold text-[var(--app-text-strong)]">{config.label}</div>
                              <p className="mt-1 text-sm text-[var(--app-text)]">{config.prompt}</p>
                              <select
                                className={`${appNativeSelectClassName} mt-3 w-full`}
                                value={form.program_subtype_selections[group.group] ?? ""}
                                onChange={(event) =>
                                  updateProgramSubtypeSelection(
                                    group.group,
                                    event.target.value as CSEPProgramSubtypeValue | ""
                                  )
                                }
                              >
                                <option value="">Select classification</option>
                                {config.options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                    <div className="text-sm font-semibold text-[var(--app-text-strong)]">Activity / hazard matrix</div>
                    <div className="mt-4 space-y-3">
                      {displayedTradeItems.length ? (
                        displayedTradeItems.map((item, index) => (
                          <div key={`${item.activity}-${item.hazard}-${index}`} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                            <div className="text-sm font-semibold text-[var(--app-text-strong)]">{item.activity}</div>
                            <div className="mt-2 text-sm text-[var(--app-text)]">Hazard: {item.hazard}</div>
                            <div className="text-sm text-[var(--app-text)]">Risk: {item.risk}</div>
                            <div className="text-sm text-[var(--app-text)]">Controls: {item.controls.join(", ")}</div>
                            <div className="text-sm text-[var(--app-text)]">Permit: {item.permit}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--app-text)]">
                          Select hazards to preview the task matrix rows that will feed the live draft.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-5">
                  <InlineMessage>
                    These fields unlock after task selection so smart drafting stays anchored to the actual work instead of forcing you back to earlier steps.
                  </InlineMessage>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <SelectField
                        label="Fill from jobsite"
                        value={form.jobsite_id}
                        onChange={applyJobsiteToForm}
                        options={jobsiteOptions}
                        placeholder={jobsitesLoading ? "Loading jobsites" : "Choose a saved jobsite"}
                        disabled={jobsitesLoading || jobsiteOptions.length === 0}
                      />
                    </div>
                    <InputField label="Project name" value={form.project_name} onChange={(value) => updateField("project_name", value)} />
                    <InputField label="Project number" value={form.project_number} onChange={(value) => updateField("project_number", value)} />
                    <InputField label="Project address" value={form.project_address} onChange={(value) => updateField("project_address", value)} />
                    <TextAreaField label="Owners / Clients" value={form.owner_client} onChange={(value) => updateField("owner_client", value)} />
                    <SelectField
                      label="Owner Message Template"
                      value={ownerMessagePresetId}
                      onChange={handleOwnerMessagePresetChange}
                      options={OWNER_MESSAGE_PRESETS.map((preset) => ({
                        value: preset.id,
                        label: preset.title,
                      }))}
                      placeholder="Choose owner message"
                    />
                    <TextAreaField
                      label="Owner Message"
                      value={form.owner_message_text}
                      onChange={(value) => updateField("owner_message_text", value)}
                    />
                    <div className="md:col-span-2 space-y-2">
                      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                        GC / CM / program partners
                      </div>
                      <p className="text-xs text-[var(--app-text)]">
                        Add each organization or interface role separately (for example general contractor,
                        construction manager, owner representative, or program partner). The export lists each on
                        its own line; if you only enter one, the document shows a single value.
                      </p>
                      <div className="space-y-2">
                        {form.gc_cm.map((line, index) => (
                          <div key={`gc-cm-${index}`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <label className="block min-w-0 flex-1">
                              <span className="sr-only">GC / CM / program partner {index + 1}</span>
                              <input
                                type="text"
                                value={line}
                                onChange={(event) => updateGcCmPartnerLine(index, event.target.value)}
                                placeholder="Organization or role"
                                className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
                              />
                            </label>
                            <button
                              type="button"
                              className="shrink-0 rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-muted)]"
                              onClick={() => removeGcCmPartnerLine(index)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="w-full rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-2.5 text-sm font-medium text-[var(--app-text-strong)] transition hover:border-[var(--app-accent-primary)]"
                          onClick={addGcCmPartnerLine}
                        >
                          Add organization or role
                        </button>
                      </div>
                    </div>
                    <InputField label="Contractor company" value={form.contractor_company} onChange={(value) => updateField("contractor_company", value)} />
                    <InputField label="Contractor contact" value={form.contractor_contact} onChange={(value) => updateField("contractor_contact", value)} />
                    <InputField label="Contractor phone" value={form.contractor_phone} onChange={(value) => updateField("contractor_phone", value)} />
                    <InputField label="Contractor email" value={form.contractor_email} onChange={(value) => updateField("contractor_email", value)} />
                  </div>
                  <SectionCard
                    title="Document control"
                    description="These fields populate the standalone Document Control and Revision History section at the end of the formatted CSEP package."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField label="Document number" value={form.document_number} onChange={(value) => updateField("document_number", value)} />
                      <InputField label="Revision" value={form.document_revision} onChange={(value) => updateField("document_revision", value)} />
                      <InputField label="Issue date" value={form.issue_date} onChange={(value) => updateField("issue_date", value)} />
                      <InputField label="Prepared by" value={form.prepared_by} onChange={(value) => updateField("prepared_by", value)} />
                      <InputField label="Reviewed by" value={form.reviewed_by} onChange={(value) => updateField("reviewed_by", value)} />
                      <InputField label="Approved by" value={form.approved_by} onChange={(value) => updateField("approved_by", value)} />
                    </div>
                  </SectionCard>
                  <SectionCard
                    title="Cover logo"
                    description="Upload the contractor or company logo you want shown on the cover and carried into the issued CSEP export."
                  >
                    <LogoInsertField
                      fileName={companyLogoFileName}
                      hasLogo={Boolean(companyLogoPreviewUrl)}
                      onChange={handleCompanyLogoChange}
                      onClear={clearCompanyLogo}
                    />
                  </SectionCard>
                  {form.selected_format_sections.includes(
                    "weather_requirements_and_severe_weather_response"
                  ) ? (
                    <SectionCard
                      title="Weather overlay"
                      description="These fields add project-specific thresholds and notes on top of the shared weather language in your CSEP. Smart fill uses your selected tasks and project context to suggest values for the fields below; you should still review and edit them before issuing."
                    >
                      <div className="mb-4">{renderBuilderAiAction("weather", "Smart fill weather section")}</div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InputField
                          label="Monitoring sources"
                          value={(form.weather_requirements.monitoringSources ?? []).join(", ")}
                          onChange={(value) =>
                            updateWeatherField("monitoringSources", parseCommaSeparatedList(value))
                          }
                        />
                        <InputField
                          label="Communication methods"
                          value={(form.weather_requirements.communicationMethods ?? []).join(", ")}
                          onChange={(value) =>
                            updateWeatherField(
                              "communicationMethods",
                              parseCommaSeparatedList(value)
                            )
                          }
                        />
                        <InputField
                          label="High-wind threshold / rule"
                          value={form.weather_requirements.highWindThresholdText ?? ""}
                          onChange={(value) => updateWeatherField("highWindThresholdText", value)}
                        />
                        <InputField
                          label="Lightning shelter note"
                          value={form.weather_requirements.lightningShelterNotes ?? ""}
                          onChange={(value) => updateWeatherField("lightningShelterNotes", value)}
                        />
                        <InputField
                          label="Lightning stop radius (miles)"
                          value={
                            form.weather_requirements.lightningRadiusMiles !== undefined &&
                            form.weather_requirements.lightningRadiusMiles !== null
                              ? String(form.weather_requirements.lightningRadiusMiles)
                              : ""
                          }
                          onChange={(value) =>
                            updateWeatherField(
                              "lightningRadiusMiles",
                              value.trim() ? Number(value) : null
                            )
                          }
                        />
                        <InputField
                          label="Lightning all-clear (minutes)"
                          value={
                            form.weather_requirements.lightningAllClearMinutes !== undefined &&
                            form.weather_requirements.lightningAllClearMinutes !== null
                              ? String(form.weather_requirements.lightningAllClearMinutes)
                              : ""
                          }
                          onChange={(value) =>
                            updateWeatherField(
                              "lightningAllClearMinutes",
                              value.trim() ? Number(value) : null
                            )
                          }
                        />
                        <InputField
                          label="Heat trigger"
                          value={form.weather_requirements.heatTriggerText ?? ""}
                          onChange={(value) => updateWeatherField("heatTriggerText", value)}
                        />
                        <InputField
                          label="Cold / wind-chill trigger"
                          value={form.weather_requirements.coldTriggerText ?? ""}
                          onChange={(value) => updateWeatherField("coldTriggerText", value)}
                        />
                        <InputField
                          label="Storm / tornado shelter"
                          value={form.weather_requirements.tornadoStormShelterNotes ?? ""}
                          onChange={(value) =>
                            updateWeatherField("tornadoStormShelterNotes", value)
                          }
                        />
                        <InputField
                          label="Union / accountability note"
                          value={form.weather_requirements.unionAccountabilityNotes ?? ""}
                          onChange={(value) =>
                            updateWeatherField("unionAccountabilityNotes", value)
                          }
                        />
                        <TextAreaField
                          label="Daily review note"
                          value={form.weather_requirements.dailyReviewNotes ?? ""}
                          onChange={(value) => updateWeatherField("dailyReviewNotes", value)}
                        />
                        <TextAreaField
                          label="Project override notes"
                          value={(form.weather_requirements.projectOverrideNotes ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "projectOverrideNotes",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="High-wind controls"
                          value={(form.weather_requirements.highWindControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "highWindControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Heat controls"
                          value={(form.weather_requirements.heatControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "heatControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Cold controls"
                          value={(form.weather_requirements.coldControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "coldControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Storm controls"
                          value={(form.weather_requirements.tornadoStormControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "tornadoStormControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Environmental controls"
                          value={(form.weather_requirements.environmentalControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "environmentalControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Contractor responsibility notes"
                          value={(
                            form.weather_requirements.contractorResponsibilityNotes ?? []
                          ).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "contractorResponsibilityNotes",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                      </div>
                    </SectionCard>
                  ) : null}
                  <div className="space-y-3">
                    {shouldShowBuilderAiAction("scope_of_work")
                      ? renderBuilderAiAction("scope_of_work")
                      : null}
                    <TextAreaField
                      label="Scope Summary (optional narrative)"
                      value={form.scope_of_work}
                      onChange={(value) => updateField("scope_of_work", value)}
                    />
                    <p className="text-xs text-[var(--app-text)]">
                      Trade, sub-trade, and selected tasks are generated automatically. Use this box only for
                      short contractor narrative that clarifies scope boundariesâ€”do not repeat the task list here.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {shouldShowBuilderAiAction("site_specific_notes")
                      ? renderBuilderAiAction("site_specific_notes")
                      : null}
                    <TextAreaField
                      label="Project-Specific Safety Notes"
                      value={form.site_specific_notes}
                      onChange={(value) => updateField("site_specific_notes", value)}
                    />
                    <p className="text-xs text-[var(--app-text)]">
                      Site constraints, owner or GC rules, access limits, logistics, and weather concerns onlyâ€”do not
                      repeat the Scope Summary task list.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {shouldShowBuilderAiAction("emergency_procedures")
                      ? renderBuilderAiAction("emergency_procedures")
                      : null}
                    <TextAreaField
                      label="Emergency procedures"
                      value={form.emergency_procedures}
                      onChange={(value) => updateField("emergency_procedures", value)}
                    />
                  </div>
                  {form.included_sections.includes("Roles and Responsibilities") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("roles_and_responsibilities_text")}
                      <TextAreaField
                        label="Roles and responsibilities notes"
                        value={form.roles_and_responsibilities_text}
                        onChange={(value) => updateField("roles_and_responsibilities_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Security and Access") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("security_and_access_text")}
                      <TextAreaField
                        label="Security and access notes"
                        value={form.security_and_access_text}
                        onChange={(value) => updateField("security_and_access_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Health and Wellness") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("health_and_wellness_text")}
                      <TextAreaField
                        label="Health and wellness notes"
                        value={form.health_and_wellness_text}
                        onChange={(value) => updateField("health_and_wellness_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Incident Reporting and Investigation") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("incident_reporting_and_investigation_text")}
                      <TextAreaField
                        label="Incident reporting and investigation notes"
                        value={form.incident_reporting_and_investigation_text}
                        onChange={(value) =>
                          updateField("incident_reporting_and_investigation_text", value)
                        }
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Training and Instruction") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("training_and_instruction_text")}
                      <TextAreaField
                        label="Training and instruction notes"
                        value={form.training_and_instruction_text}
                        onChange={(value) => updateField("training_and_instruction_text", value)}
                      />
                    </div>
                  ) : null}
                  {formIncludesDrugAlcoholSection(form.included_sections) ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("drug_and_alcohol_testing_text")}
                      <TextAreaField
                        label="Drug, alcohol, and fit-for-duty notes"
                        value={form.drug_and_alcohol_testing_text}
                        onChange={(value) => updateField("drug_and_alcohol_testing_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Enforcement and Corrective Action") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("enforcement_and_corrective_action_text")}
                      <TextAreaField
                        label="Enforcement and corrective action notes"
                        value={form.enforcement_and_corrective_action_text}
                        onChange={(value) =>
                          updateField("enforcement_and_corrective_action_text", value)
                        }
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Recordkeeping") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("recordkeeping_text")}
                      <TextAreaField
                        label="Recordkeeping notes"
                        value={form.recordkeeping_text}
                        onChange={(value) => updateField("recordkeeping_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Continuous Improvement") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("continuous_improvement_text")}
                      <TextAreaField
                        label="Continuous improvement notes"
                        value={form.continuous_improvement_text}
                        onChange={(value) => updateField("continuous_improvement_text", value)}
                      />
                    </div>
                  ) : null}
                  <InlineMessage>
                    Task-driven content is ready. Continue to draft review when the project details and section notes look right.
                  </InlineMessage>
                </div>
              ) : null}

              {step === 6 ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text-strong)]">Draft approval</div>
                        <div className="mt-1 text-sm text-[var(--app-text)]">
                          Generate or refresh the draft here, review the selected sections, and approve the current version before moving to submission.
                        </div>
                      </div>
                      <StatusBadge
                        label={
                          previewState
                            ? previewIsCurrent
                              ? "Current draft"
                              : "Regenerate needed"
                            : "Draft needed"
                        }
                        tone={
                          previewState
                            ? previewIsCurrent
                              ? "success"
                              : "warning"
                            : "warning"
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleGenerateDraft}
                        disabled={!csepReady || previewLoading}
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-60"
                      >
                        {previewLoading
                          ? "Generating smart draft..."
                          : previewState
                            ? "Regenerate smart draft"
                            : "Generate smart draft"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewApproved(true)}
                        disabled={
                          !previewState ||
                          !previewIsCurrent ||
                          previewApproved ||
                          previewHasBlockingCoverageGaps
                        }
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-60"
                      >
                        {previewApproved && previewIsCurrent ? "Draft approved" : "Approve current draft"}
                      </button>
                      {isOfflineDemoPrefillEnabled ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenDemoPackFolder();
                          }}
                          className="inline-flex rounded-xl border border-[var(--app-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
                        >
                          Open demo documents folder
                        </button>
                      ) : null}
                    </div>
                    {!csepReady && !previewLoading ? (
                      <div className="mt-4">
                        <InlineMessage tone="warning">
                          Smart draft stays disabled until the live form matches the generator gate: trade, project delivery type,
                          sub-trade, at least one task, at least one hazard, and required program classifications.{" "}
                          <span className="font-medium">{nextRequiredInput}</span>
                        </InlineMessage>
                      </div>
                    ) : null}
                    {previewState && !previewIsCurrent ? (
                      <div className="mt-4">
                        <InlineMessage tone="warning">
                          Builder inputs changed after this draft was generated. Regenerate the draft, then approve the new version before submitting.
                        </InlineMessage>
                      </div>
                    ) : null}
                  </div>
                  {previewState ? (
                    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--app-text-strong)]">Smart draft preview</div>
                          <div className="mt-1 text-sm text-[var(--app-text)]">
                            Review the generated sections for the current live CSEP selection.
                          </div>
                        </div>
                        <StatusBadge label={previewIsCurrent ? "Current" : "Stale"} tone={previewIsCurrent ? "success" : "warning"} />
                      </div>
                      {previewState.draft.coverageAudit?.findings?.length ? (
                        <div className="mt-4">
                          <CsepCoverageAuditPanel audit={previewState.draft.coverageAudit} />
                        </div>
                      ) : null}
                      {previewHasBlockingCoverageGaps ? (
                        <div className="mt-4">
                          <InlineMessage tone="warning">
                            Resolve all required coverage findings before approving this draft.
                          </InlineMessage>
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-4">
                        {previewState.draft.sectionMap.map((section) => (
                          <CsepDraftSectionPreview key={section.key} section={section} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <InlineMessage>
                      Generate the draft here after completing enrichment and the task-driven sections so submission stays clean and simple.
                    </InlineMessage>
                  )}
                </div>
              ) : null}

              {step === 7 ? (
                <div className="space-y-5">
                  {csepHandoffComplete ? (
                    <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-6 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                            Completed {CONTRACTOR_SAFETY_BLUEPRINT_TITLE}
                          </div>
                          <h3 className="mt-1 text-lg font-semibold text-[var(--app-text-strong)]">
                            Handoff display â€” use for screen share or walkthrough
                          </h3>
                          <p className="mt-2 text-sm text-[var(--app-text)]">
                            This CSEP is submitted. Below is a compact issued summary you can read aloud or show on the final slide.
                            {csepHandoffAt ? (
                              <span className="block pt-1 text-xs text-slate-600">
                                Recorded: {new Date(csepHandoffAt).toLocaleString()}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <StatusBadge label="Handoff ready" tone="success" />
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <InfoCard
                          label="Project"
                          value={form.project_name.trim() || "â€”"}
                        />
                        <InfoCard
                          label="Document / reference"
                          value={
                            [form.document_number?.trim() || "â€”", form.project_number?.trim() ? `Project # ${form.project_number}` : null]
                              .filter(Boolean)
                              .join(" Â· ") || "â€”"
                          }
                        />
                        <InfoCard
                          label="Revision & issue"
                          value={[form.document_revision?.trim() || "â€”", form.issue_date?.trim() || null]
                            .filter(Boolean)
                            .join(" Â· ")}
                        />
                        <InfoCard
                          label="Trade & sub-trade"
                          value={
                            (selectedTrade?.tradeLabel ?? form.trade) && (selectedTrade?.subTradeLabel ?? form.subTrade)
                              ? `${selectedTrade?.tradeLabel ?? form.trade} â€” ${selectedTrade?.subTradeLabel ?? form.subTrade}`
                              : "â€”"
                          }
                        />
                        <InfoCard
                          label="Owner / client"
                          value={form.owner_client.trim() || "â€”"}
                        />
                        <InfoCard
                          label="Contractor"
                          value={form.contractor_company.trim() || "â€”"}
                        />
                      </div>
                      {isOfflineDemoPrefillEnabled ? (
                        <div className="mt-5 rounded-xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm text-[var(--app-text)]">
                          <span className="font-semibold text-[var(--app-text-strong)]">Offline demo pack:</span> a finished Word
                          example is generated next to the project folder, e.g.{" "}
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            â€¦\safety360_offline_demo_pack\deliverables\North_Tower_Issued_CSEP_Summit_Ridge.docx
                          </code>{" "}
                          (use the same handoff you built with the desktop installer).
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void handleOpenDemoPackFolder();
                                }}
                                className="inline-flex rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
                              >
                                Open demo documents folder
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={resetBuilder}
                          className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
                        >
                          Start a new {CONTRACTOR_SAFETY_BLUEPRINT_TITLE} build
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!csepHandoffComplete ? (
                    <LegalAcceptanceBlock checked={agreedToSubmissionTerms} onChange={setAgreedToSubmissionTerms} />
                  ) : (
                    <InlineMessage tone="success">Terms, privacy, and waiver were accepted for this submission.</InlineMessage>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={previewReadyForSubmit ? "Draft approved" : "Draft approval required"} tone={previewReadyForSubmit ? "success" : "warning"} />
                    <StatusBadge label={canSubmitDocuments ? "Submit access ready" : "Submit access missing"} tone={canSubmitDocuments ? "success" : "warning"} />
                    {csepHandoffComplete ? <StatusBadge label="Submitted" tone="success" /> : null}
                    {previewHasBlockingCoverageGaps ? (
                      <StatusBadge label="Required gaps must be resolved" tone="warning" />
                    ) : null}
                  </div>
                  {!previewReadyForSubmit && !csepHandoffComplete ? (
                    <InlineMessage tone="warning">
                      Return to Step {reviewStepNumber} to generate, refresh, or approve the draft before submitting.
                    </InlineMessage>
                  ) : null}
                  {previewState ? (
                    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                      <div className="text-sm font-semibold text-[var(--app-text-strong)]">Current draft preview</div>
                      {previewState.draft.coverageAudit?.findings?.length ? (
                        <div className="mt-4">
                          <CsepCoverageAuditPanel audit={previewState.draft.coverageAudit} />
                        </div>
                      ) : null}
                      {previewHasBlockingCoverageGaps ? (
                        <div className="mt-4">
                          <InlineMessage tone="warning">
                            Submission is blocked until all required coverage findings are resolved in the draft.
                          </InlineMessage>
                        </div>
                      ) : null}
                      <div className="mt-4 rounded-xl border border-slate-300 bg-white px-6 py-6 shadow-sm">
                        <div className="border-b border-slate-200 pb-4 text-center">
                          <div className="csep-doc-heading text-base font-semibold">
                            Contractor Safety &amp; Environmental Plan
                          </div>
                          <div className="mt-1 text-sm italic text-slate-500">
                            Preview styled to match the clean steel-erection document format
                          </div>
                        </div>
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6">
                          {companyLogoPreviewUrl ? (
                            <div className="flex flex-col items-center gap-4 text-center">
                              <div className="csep-doc-heading text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Company Logo
                              </div>
                              {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL preview; Next Image cannot optimize it. */}
                              <img
                                src={companyLogoPreviewUrl}
                                alt="Company logo preview"
                                className="max-h-28 w-auto max-w-full object-contain"
                              />
                              <div className="text-xs text-slate-500">
                                {companyLogoFileName ?? "Uploaded company logo"}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="csep-doc-heading text-xs font-semibold uppercase tracking-[0.18em]">
                                Add Company Logo
                              </div>
                              <div className="mt-2 text-sm text-slate-500">
                                Upload a contractor or company logo in the Cover logo block so the cover preview shows a real branded insert.
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-6 space-y-6">
                          {previewState.draft.sectionMap.map((section) => (
                            <CsepDraftSectionPreview key={`finish-${section.key}`} section={section} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {!csepHandoffComplete ? (
                    <button
                      type="button"
                      onClick={handleSubmitForReview}
                      disabled={submitLoading || !agreedToSubmissionTerms || !canSubmitDocuments || !previewReadyForSubmit}
                      className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:opacity-60"
                    >
                      {submitLoading ? "Submitting..." : "Submit for review"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 border-t border-[var(--app-border)] pt-2">
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  disabled={step === 0}
                  className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:opacity-50"
                >
                  Back
                </button>
                {step < workflowDefinition.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((current) => current + 1)}
                    disabled={!canProceed(step)}
                    className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Next step
                  </button>
                ) : null}
              </div>
            </fieldset>
          </SectionCard>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <WorkflowPath
            title="Forward-only workflow"
            description="The builder now stays task-first: choose the section layout early, unlock task-driven content after tasks, then review and submit without doubling back."
            steps={workflowSteps}
          />
          <StartChecklist title="Readiness checklist" items={readinessChecklist} />
          <SectionCard title="Builder snapshot" description="Live view of what the generator has assembled so far.">
            <InfoCard label="Next required input" value={nextRequiredInput} />
            <InfoCard label="Jurisdiction" value={jurisdictionProfile.jurisdictionLabel} />
            <InfoCard label="Trade" value={(selectedTrade?.tradeLabel ?? form.trade) || "Not selected"} />
            <InfoCard label="Sub-trade" value={(selectedTrade?.subTradeLabel ?? form.subTrade) || "Not selected"} />
            <InfoCard label="Tasks" value={form.tasks.length ? `${form.tasks.length} selected` : "None selected"} />
            <InfoCard label="Hazards" value={form.selected_hazards.length ? `${form.selected_hazards.length} selected` : "None selected"} />
            <InfoCard label="Programs" value={autoPrograms.length ? `${autoPrograms.length} generated` : "None generated"} />
            <InfoCard
              label="Unlocked task-driven sections"
              value={
                unlockedTaskDrivenSections.length
                  ? unlockedTaskDrivenSections
                      .filter((section) => section.dependency === "Requires tasks")
                      .map((section) => section.label)
                      .join(" | ") || "None selected"
                  : "None selected"
              }
            />
          </SectionCard>
          <SectionCard
            title="Selected document layout"
            description="Each included section shows whether it is ready now, task-driven, or tied to hazards/program setup."
          >
            <div className="space-y-3">
              {selectedSectionStatuses.map((section) => (
                <InfoCard
                  key={section.value}
                  label={section.label}
                  value={
                    section.included
                      ? `${section.dependency}.`
                      : "Excluded from the draft."
                  }
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <select
        className={`${appNativeSelectClassName} w-full`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function LogoInsertField({
  fileName,
  hasLogo,
  onChange,
  onClear,
}: {
  fileName: string | null;
  hasLogo: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]">
          Upload logo
          <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        </label>
        {hasLogo ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-white"
          >
            Clear logo
          </button>
        ) : null}
      </div>
      <div className="mt-3 text-sm text-[var(--app-text)]">
        {fileName
          ? `Current logo: ${fileName}`
          : "Use a PNG or JPG logo file to place a branded image on the CSEP cover and export."}
      </div>
    </div>
  );
}

function OptionGrid({
  items,
  selectedItems,
  onToggle,
  onApplyAll,
  onClearAll,
}: {
  items: OptionGridItem[];
  selectedItems: string[];
  onToggle: (value: string) => void;
  onApplyAll?: () => void;
  onClearAll?: () => void;
}) {
  return (
    <div className="space-y-3">
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {onApplyAll ? (
            <button
              type="button"
              onClick={onApplyAll}
              className="rounded-full border border-[var(--app-border-strong)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
            >
              Apply all
            </button>
          ) : null}
          {onClearAll ? (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text)] transition hover:bg-white"
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <label
            key={item.value}
            className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-4"
          >
            <input
              type="checkbox"
              checked={selectedItems.includes(item.value)}
              onChange={() => onToggle(item.value)}
              className="mt-1 h-4 w-4"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--app-text-strong)]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              {item.description ? (
                <div className="mt-1 text-xs leading-5 text-[var(--app-text)]">{item.description}</div>
              ) : null}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--app-text)]">{value}</div>
    </div>
  );
}

function SectionBucket({
  title,
  items,
  selectedItems,
  onToggle,
  onApplyAll,
  onClearAll,
  summaryValue,
  emptyLabel = "Nothing selected yet.",
}: {
  title: string;
  items: OptionGridItem[];
  selectedItems: string[];
  onToggle: (value: string) => void;
  onApplyAll?: () => void;
  onClearAll?: () => void;
  summaryValue?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</div>
      {summaryValue ? (
        <div className="mt-1 text-sm text-[var(--app-text)]">{summaryValue}</div>
      ) : null}
      <div className="mt-4">
        {items.length ? (
          <OptionGrid
            items={items}
            selectedItems={selectedItems}
            onToggle={onToggle}
            onApplyAll={onApplyAll}
            onClearAll={onClearAll}
          />
        ) : (
          <div className="text-sm text-[var(--app-text)]">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function parseKeySectionBullet(bullet: string) {
  const match = bullet.match(/^(?:Key sections|Review these sections first):\s*(.+?)(?:\.)?$/i);
  if (!match) return null;

  const options = match[1]
    .split(/,\s+(?=\d+(?:\.\d+)*\s)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const numberMatch = item.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
      return {
        value: item,
        label: item,
        number: numberMatch?.[1] ?? null,
        title: numberMatch?.[2] ?? item,
      };
    });

  return options.length ? options : null;
}

function parseInterfacesWithBullet(bullet: string) {
  const match = bullet.match(/^(?:Interfaces With|Interfaces to coordinate):\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

function ReferencePackDetailBullet({
  bullet,
  numberedLabel,
}: {
  bullet: string;
  numberedLabel: string;
}) {
  const interfacesBody = parseInterfacesWithBullet(bullet);

  if (interfacesBody) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold leading-6 text-slate-700">
          {numberedLabel} Coordination Notes
        </div>
        <p className="text-sm leading-7 text-slate-700">{interfacesBody}</p>
      </div>
    );
  }

  const keySectionOptions = parseKeySectionBullet(bullet);
  if (keySectionOptions) {
    return <KeySectionsBullet bullet={bullet} />;
  }

  return <p className="text-sm leading-7 text-slate-700">{bullet}</p>;
}

function KeySectionsBullet({ bullet }: { bullet: string }) {
  const options = parseKeySectionBullet(bullet);

  if (!options) {
    return <p className="text-sm leading-7 text-slate-700">{bullet}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold leading-6 text-slate-700">
        17.1.1 Review Focus
      </div>
      <div className="space-y-1 pl-4">
        {options.map((option, index) => (
          <div key={option.value} className="text-sm leading-6 text-slate-700">
            <span className="csep-doc-number-text mr-2 font-semibold">
              {String.fromCharCode(97 + index)}.
            </span>
            {option.title}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatGeneratedSectionTableRow(columns: string[], row: string[]) {
  return columns.map((column, columnIndex) => ({
    label: column.trim(),
    value: row[columnIndex]?.trim() || "N/A",
  }));
}

function splitReadableParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .flatMap((block) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) {
        return [];
      }

      const sentences = trimmedBlock
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

      if (sentences.length <= 2 && trimmedBlock.length <= 240) {
        return [trimmedBlock];
      }

      const paragraphs: string[] = [];
      let current = "";

      for (const sentence of sentences) {
        const candidate = current ? `${current} ${sentence}` : sentence;
        if (!current || (current.length < 240 && candidate.length <= 320)) {
          current = candidate;
          continue;
        }

        paragraphs.push(current);
        current = sentence;
      }

      if (current) {
        paragraphs.push(current);
      }

      return paragraphs;
    });
}

function GeneratedSectionCopy({ text }: { text: string }) {
  const paragraphs = splitReadableParagraphs(text);

  return (
    <div className="mt-3 max-w-[74ch] space-y-3">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p
          key={`${paragraph.slice(0, 24)}-${paragraphIndex}`}
          className="whitespace-pre-wrap text-sm leading-7 text-slate-700"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function GeneratedSectionTableRow({
  columns,
  row,
  rowLabel,
}: {
  columns: string[];
  row: string[];
  rowLabel: string;
}) {
  const cells = formatGeneratedSectionTableRow(columns, row);

  return (
    <div className="csep-soft-elevated rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="csep-doc-number-badge inline-flex w-fit min-w-[3.25rem] justify-center rounded-full px-2.5 py-1 text-xs font-bold tracking-[0.12em]">
          {rowLabel}
        </span>
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-3">
          {cells.map((cell) => (
            <div
              key={`${rowLabel}-${cell.label}`}
              className="rounded-xl bg-slate-50 px-3 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {cell.label}
              </div>
              <div className="mt-1 text-sm leading-6 text-slate-700">{cell.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CsepDraftSectionPreview({
  section,
}: {
  section: GeneratedSafetyPlanDraft["sectionMap"][number];
}) {
  function sanitizeNumberedTitle(title: string) {
    return title.replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
  }

  function getNumberDepth(value?: string | null) {
    if (!value) return 0;
    return value.replace(/\.$/, "").split(".").filter(Boolean).length;
  }

  function normalizeComparableText(value?: string | null) {
    return sanitizeNumberedTitle(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function shouldRenderSubsectionHeading(
    subsection: NonNullable<GeneratedSafetyPlanDraft["sectionMap"][number]["subsections"]>[number]
  ) {
    const title = sanitizeNumberedTitle(subsection.title).trim();
    if (!title) return false;
    if (normalizeComparableText(title) === normalizeComparableText(section.title)) return false;

    const comparableContent = Array.from(
      new Set(
        [subsection.body, ...subsection.bullets]
          .map((value) => normalizeComparableText(value))
          .filter(Boolean)
      )
    );

    return !(comparableContent.length === 1 && comparableContent[0] === normalizeComparableText(title));
  }

  const topLevelSubsectionBulletTotal =
    section.subsections?.reduce(
      (acc, subsection) => acc + (shouldRenderSubsectionHeading(subsection) ? 0 : subsection.bullets.length),
      0
    ) ?? 0;
  const numberedItemsBeforeTable = (section.bullets?.length ?? 0) + topLevelSubsectionBulletTotal;

  const sectionMetaLabel =
    section.kind === "front_matter"
      ? "Front matter"
      : section.kind === "appendix"
        ? "Appendix"
        : section.kind === "gap"
          ? "Coverage callout"
          : null;
  const cleanTitle = section.numberLabel && section.title.startsWith(section.numberLabel)
    ? section.title
    : section.numberLabel
      ? `${section.numberLabel} ${sanitizeNumberedTitle(section.title)}`
      : section.title;
  const sectionPrefix = section.numberLabel
    ? section.numberLabel.replace(/\.0$/, "")
    : null;
  const sectionDepth = getNumberDepth(sectionPrefix);
  const sectionIndentClass =
    sectionDepth >= 3 ? "pl-8" : sectionDepth === 2 ? "pl-5" : "pl-0";

  return (
    <section className={`border-b border-slate-200 pb-8 last:border-b-0 ${sectionIndentClass}`}>
      {sectionMetaLabel ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {sectionMetaLabel}
        </div>
      ) : null}
      <div className="mt-2 min-w-0">
        <div className="csep-doc-heading text-[15px] font-semibold">{cleanTitle}</div>
      </div>
      {section.summary ? <GeneratedSectionCopy text={section.summary} /> : null}
      {section.body ? <GeneratedSectionCopy text={section.body} /> : null}
      {section.bullets?.length ? (
        <div className="mt-3 space-y-2">
          {section.bullets.map((bullet, bulletIndex) => (
            <div
              key={`${section.key}-bullet-${bulletIndex}`}
              className="rounded-xl bg-slate-50/70 px-3 py-2"
            >
              <p className="max-w-[72ch] text-sm leading-7 text-slate-700">{bullet}</p>
            </div>
          ))}
        </div>
      ) : null}
      {section.subsections?.length ? (
        <div className="mt-5 space-y-5">
          {(() => {
            let runningTopLevelItemIndex = section.bullets?.length ?? 0;

            return section.subsections.map((subsection, subsectionIndex) => {
            const subsectionPrefix = sectionPrefix
              ? `${sectionPrefix}.${subsectionIndex + 1}`
              : `${subsectionIndex + 1}`;
            const subsectionDepth = getNumberDepth(subsectionPrefix);
            const showSubsectionHeading = shouldRenderSubsectionHeading(subsection);
            const subsectionHeading = showSubsectionHeading
              ? `${subsectionPrefix} ${sanitizeNumberedTitle(subsection.title)}`
              : null;

            return (
              <div
                key={`${section.key}-subsection-${subsectionIndex}`}
                className={
                  subsectionDepth >= 3
                    ? "border-l border-slate-200 pl-5"
                    : "border-l border-slate-200 pl-4"
                }
              >
                {subsectionHeading ? (
                  <div className="csep-doc-number-text text-sm font-semibold">{subsectionHeading}</div>
                ) : null}
                {subsection.body ? <GeneratedSectionCopy text={subsection.body} /> : null}
                {subsection.bullets.length ? (
                  <div className="mt-2 space-y-2">
                    {subsection.bullets.map((bullet, bulletIndex) => (
                      (() => {
                        const numberedLabel = subsectionHeading
                          ? `${subsectionPrefix}.${bulletIndex + 1}`
                          : (() => {
                              runningTopLevelItemIndex += 1;
                              return sectionPrefix
                                ? `${sectionPrefix}.${runningTopLevelItemIndex}`
                                : `${runningTopLevelItemIndex}`;
                            })();

                        return (
                          <div
                            key={`${section.key}-subsection-${subsectionIndex}-bullet-${bulletIndex}`}
                            className="rounded-xl bg-slate-50/70 px-3 py-2"
                          >
                            <ReferencePackDetailBullet bullet={bullet} numberedLabel={numberedLabel} />
                          </div>
                        );
                      })()
                    ))}
                  </div>
                ) : null}
              </div>
            );
            });
          })()}
        </div>
      ) : null}
      {section.table?.rows?.length ? (
        <div className="mt-5 space-y-3">
          {section.table.rows.map((row, rowIndex) => {
            const n = numberedItemsBeforeTable + rowIndex + 1;
            const rowLabel = sectionPrefix ? `${sectionPrefix}.${n}` : `${n}.`;
            return (
              <GeneratedSectionTableRow
                key={`${section.key}-table-row-${rowIndex}`}
                columns={section.table!.columns}
                row={row}
                rowLabel={rowLabel}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function CsepCoverageAuditPanel({
  audit,
}: {
  audit: NonNullable<GeneratedSafetyPlanDraft["coverageAudit"]>;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">Coverage audit</div>
      <div className="mt-1 text-sm text-[var(--app-text)]">
        Required: {audit.unresolvedRequiredCount} | Warnings: {audit.unresolvedWarningCount}
      </div>
      <div className="mt-4 space-y-2">
        {audit.findings.map((finding) => (
          <div
            key={finding.key}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-strong)]">
              {finding.severity}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">
              {finding.title}
            </div>
            <div className="mt-1 text-sm leading-6 text-[var(--app-text)]">{finding.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## app\api\company\csep\preview\route.ts

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { buildStructuredCsepDraft } from "@/lib/csepBuilder";
import { getCsepExportValidationDetail, isCsepExportValidationError } from "@/lib/csepExportValidation";
import { renderGeneratedCsepDocx } from "@/lib/csep/csep-renderer";
import { demoCompanyProfile } from "@/lib/demoWorkspace";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";
import { authorizeRequest } from "@/lib/rbac";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { serverLog } from "@/lib/serverLog";
import { ensureSafetyPlanGenerationContext } from "@/lib/safety-intelligence/documentIntake";
import { runSafetyPlanDocumentPipeline } from "@/lib/safety-intelligence/documents/pipeline";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { JsonObject } from "@/types/safety-intelligence";

export const runtime = "nodejs";

function extractErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function stripClientGenerationContext(formData: Record<string, unknown>) {
  const sanitized = { ...formData };
  delete sanitized.generationContext;
  return sanitized;
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest(request, {
      requireAnyPermission: ["can_create_documents", "can_edit_documents"],
    });

    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const rawFormData =
      body.form_data && typeof body.form_data === "object"
        ? (body.form_data as Record<string, unknown>)
        : (body as Record<string, unknown>);
    const formData = stripClientGenerationContext(rawFormData);
    const projectName =
      typeof body.project_name === "string" && body.project_name.trim()
        ? body.project_name.trim()
        : typeof formData.project_name === "string" && formData.project_name.trim()
          ? formData.project_name.trim()
          : "";

    if (!projectName || !formData) {
      return NextResponse.json({ error: "Project name and form data are required." }, { status: 400 });
    }

    const isDemoCsepPreviewRequest =
      auth.role === "sales_demo" ||
      (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
    const admin = createSupabaseAdminClient();
    const supabase: SupabaseClient = isDemoCsepPreviewRequest
      ? (admin ?? auth.supabase)
      : auth.supabase;
    if (isDemoCsepPreviewRequest && typeof supabase.from !== "function") {
      return NextResponse.json(
        {
          error:
            "Full CSEP preview uses the same generator as production. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment (or use a normal cloud login session) so the draft pipeline can run.",
        },
        { status: 503 }
      );
    }

    let companyScope = await getCompanyScope({
      supabase,
      userId: auth.user.id,
      fallbackTeam: auth.team,
      authUser: auth.user,
    });
    if (!companyScope.companyId && isDemoCsepPreviewRequest) {
      companyScope = {
        companyId: demoCompanyProfile.id,
        companyName: demoCompanyProfile.name?.trim() || "Demo company",
        source: "team_fallback",
      } as unknown as Awaited<ReturnType<typeof getCompanyScope>>;
    }

    if (!companyScope.companyId) {
      return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
    }

    const generationContext = ensureSafetyPlanGenerationContext({
      documentType: "csep",
      formData: {
        ...formData,
        project_name: projectName,
      },
      companyId: companyScope.companyId,
      jobsiteId:
        typeof formData.jobsite_id === "string" && formData.jobsite_id.trim()
          ? formData.jobsite_id.trim()
          : null,
    });
    generationContext.documentProfile.source = "csep_preview";

    const riskMemory = await buildRiskMemoryStructuredContext(
      supabase,
      companyScope.companyId,
      {
        jobsiteId: generationContext.siteContext.jobsiteId ?? null,
        days: 90,
      }
    ).catch((riskMemoryError) => {
      serverLog("warn", "company_csep_preview_risk_memory_fallback", {
        userId: auth.user.id,
        companyId: companyScope.companyId,
        message: extractErrorMessage(riskMemoryError).slice(0, 200),
      });
      return null;
    });

    const pipeline = await runSafetyPlanDocumentPipeline({
      supabase,
      actorUserId: auth.user.id,
      companyId: companyScope.companyId,
      jobsiteId: generationContext.siteContext.jobsiteId ?? null,
      sourceDocumentId: null,
      generationContext,
      intakePayload: {
        document_type: "CSEP",
        project_name: projectName,
        form_data: formData,
      },
      riskMemorySummary: (riskMemory ?? null) as JsonObject | null,
    });

    let structuredDraft = pipeline.draft;
    try {
      structuredDraft = buildStructuredCsepDraft(pipeline.draft);
    } catch {
      structuredDraft = pipeline.draft;
    }

    try {
      await renderGeneratedCsepDocx(pipeline.draft, { footerCompanyName: companyScope.companyName });
    } catch (renderError) {
      if (isCsepExportValidationError(renderError)) {
        return NextResponse.json(
          {
            error: `This CSEP draft is not ready for final issue: ${getCsepExportValidationDetail(
              renderError
            )} Update the builder inputs and regenerate the draft.`,
          },
          { status: 409 }
        );
      }
      throw renderError;
    }

    return NextResponse.json({
      generated_document_id: pipeline.generatedDocumentId,
      builder_input_hash: generationContext.builderInstructions?.builderInputHash ?? null,
      draft: structuredDraft,
      html_preview: pipeline.document.htmlPreview,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate CSEP preview." },
      { status: 400 }
    );
  }
}
```

## app\api\csep\export\route.ts

```ts
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
import { renderCsepRenderModel, renderGeneratedCsepDocx } from "@/lib/csep/csep-renderer";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
  getSafetyBlueprintDraftFilename,
} from "@/lib/safetyBlueprintLabels";
import { formatGcCmPartnersForExport, normalizeGcCmPartnerEntries } from "@/lib/csepGcCmPartners";
import { buildCsepPpeSectionBullets } from "@/lib/csepFinalization";
import {
  CSEP_WORK_ATTIRE_DEFAULT_BULLETS,
  CSEP_WORK_ATTIRE_SUBSECTION_BODY,
} from "@/lib/csepWorkAttireDefaults";
import { PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK } from "@/lib/csepSiteSpecificNotes";
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

type IncludedContent = {
  project_information?: boolean;
  contractor_information?: boolean;
  trade_summary?: boolean;
  scope_of_work?: boolean;
  site_specific_notes?: boolean;
  emergency_procedures?: boolean;
  weather_requirements_and_severe_weather_response?: boolean;
  work_attire_requirements?: boolean;
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
  owner_message_text?: string;
  /** One organization per entry; legacy callers may still send a single string. */
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
      "GC / CM / program partners",
      formatGcCmPartnersForExport(normalizeGcCmPartnerEntries(form.gc_cm)),
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
    work_attire_requirements: true,
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

const CATALOG_PROGRAM_GROUPS: Array<{
  category: CSEPProgramSection["category"];
  title: string;
  summary: string;
}> = [
  {
    category: "hazard",
    title: "Hazard Control Programs",
    summary: "The following hazard-control programs apply to the selected contractor work scope.",
  },
  {
    category: "permit",
    title: "Permit and Authorization Programs",
    summary: "The following permit and authorization programs apply to the selected contractor work scope.",
  },
  {
    category: "ppe",
    title: "Personal Protective Equipment Programs",
    summary: "The following PPE programs apply to the selected contractor work scope.",
  },
];

function appendProgramModule(children: Paragraph[], program: CSEPProgramSection) {
  const programModule = program.programModule;

  children.push(body("Risk:"));
  children.push(body(programModule.risk));

  const groups = [
    ["Required controls", programModule.requiredControls],
    ["How controls are met and verified", programModule.verificationMethods],
    ["Stop-work / hold-point triggers", programModule.stopWorkTriggers],
    ["Applicable references", programModule.applicableReferences],
  ] as const;

  groups.forEach(([label, items]) => {
    children.push(body(`${label}:`));
    items.forEach((item, index) => {
      children.push(body(`${index + 1}. ${item}`));
    });
  });
}

function appendCatalogProgramGroups(
  children: Paragraph[],
  sectionNumber: number,
  programSections: CSEPProgramSection[]
) {
  let nextSectionNumber = sectionNumber;

  CATALOG_PROGRAM_GROUPS.forEach((group) => {
    const groupedPrograms = programSections.filter((program) => program.category === group.category);
    if (!groupedPrograms.length) return;

    children.push(heading1(`${nextSectionNumber}. ${group.title}`));
    children.push(body(group.summary));

    groupedPrograms.forEach((program, programIndex) => {
      const programPrefix = `${nextSectionNumber}.${programIndex + 1}`;
      children.push(heading2(`${programPrefix} ${program.title}`));
      appendProgramModule(children, program);
    });

    nextSectionNumber += 1;
  });

  return nextSectionNumber;
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
  const ownerMessageText = normalizeOptionalText(form.owner_message_text);

  if (ownerMessageText) {
    children.push(heading1(`${sectionNumber}. Leadership Commitment`));
    children.push(body(ownerMessageText));
    sectionNumber++;
  }

  if (includedContent.scope_of_work) {
    const section = getResolvedCsepSection(builderTextConfig, "scope_of_work");
    children.push(heading1(`${sectionNumber}. ${section?.title ?? "Scope Summary"}`));
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
    children.push(heading1(`${sectionNumber}. ${section?.title ?? "Project-Specific Safety Notes"}`));
    children.push(
      body(
        valueOrNA(form.site_specific_notes) === "N/A"
          ? section?.paragraphs[0] ?? PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK
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

  if (includedContent.work_attire_requirements) {
    children.push(heading1(`${sectionNumber}. Work Attire Requirements`));
    children.push(body(CSEP_WORK_ATTIRE_SUBSECTION_BODY));
    appendNumberedItems(children, String(sectionNumber), [...CSEP_WORK_ATTIRE_DEFAULT_BULLETS]);
    sectionNumber++;
  }

  if (includedContent.required_ppe) {
    const section = getResolvedCsepSection(builderTextConfig, "required_ppe");
    children.push(
      heading1(
        `${sectionNumber}. ${section?.title ?? "Required PPE"}`
      )
    );
    appendNumberedItems(
      children,
      String(sectionNumber),
      buildCsepPpeSectionBullets(requiredPPE, [])
    );
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
          ? "This contractorâ€™s work includes trade-specific exposures that require planning, supervision, appropriate PPE, safe access, and hazard controls throughout execution of the work."
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
    const matrixBodyParagraphs =
      section?.paragraphs?.length
        ? section.paragraphs
        : [
            "See Appendix E â€“ Task-Hazard-Control Matrix for the task-specific hazard, control, PPE, permit, and competency breakdown. The full matrix is not repeated in the body.",
            "If no matrix appears in the appendix, add a trade, sub-trade, tasks, and hazards on the CSEP page so the plan can generate it.",
          ];
    matrixBodyParagraphs.forEach((paragraph) => {
      children.push(body(paragraph));
    });
    sectionNumber++;
  }

  if (programSections.length) {
    children.push(createCsepPageBreak());
    sectionNumber = appendCatalogProgramGroups(children, sectionNumber, programSections);
  }

  if (includedContent.drug_and_alcohol_testing) {
    appendNarrativeSection({
      children,
      sectionNumber,
      section: getResolvedCsepSection(builderTextConfig, "drug_and_alcohol_testing"),
      fallbackTitle: "Drug, Alcohol, and Fit-for-Duty Controls",
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
    gc_cm: normalizeGcCmPartnerEntries(form.gc_cm ?? []),
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
        children.push(heading2("2.C Project-specific safety notes"));
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
  options?: {
    supabase?: GeneratedDocumentDraftLoaderClient;
    companyId?: string | null;
    /** Workspace company name for every-page DOCX footer (falls back to Safety360Docs when empty). */
    footerCompanyName?: string | null;
  }
) {
  let rendered: { body: Uint8Array; filename: string } | null = null;

  if (hasGeneratedDraftPayload(form)) {
    rendered = await renderGeneratedCsepDocx(form.draft, {
      footerCompanyName: options?.footerCompanyName,
    });
  } else if (hasGeneratedDocumentReference(form) && options?.supabase) {
    if (!options.companyId) {
      // Do not leak row existence across tenants: mirror the generic error
      // thrown when the row is not found for the caller's company.
      throw new Error("Generated document not found.");
    }
    const draft = await loadGeneratedDocumentDraft(
      options.supabase,
      form.generatedDocumentId,
      options.companyId
    );
    rendered = await renderGeneratedCsepDocx(draft, {
      footerCompanyName: options?.footerCompanyName,
    });
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
        footerCompanyName: options?.footerCompanyName,
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
    const auth = await authorizeRequest(req, {
      requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
    });

    if ("error" in auth) {
      return auth.error;
    }

    const form = (await req.json()) as CSEPInput | {
      generatedDocumentId?: string | null;
      draft?: GeneratedSafetyPlanDraft | null;
    };

    const companyScope = await getCompanyScope({
      supabase: auth.supabase as unknown as { from: (table: string) => unknown },
      userId: auth.user.id,
      fallbackTeam: auth.team,
      authUser: auth.user,
    });

    let companyId: string | null = null;
    if (hasGeneratedDocumentReference(form) && !hasGeneratedDraftPayload(form)) {
      if (!companyScope.companyId) {
        return new NextResponse(
          JSON.stringify({ error: "Generated document not found." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      companyId = companyScope.companyId;
    }

    return await generateCsepDocx(form, {
      supabase: auth.supabase,
      companyId,
      footerCompanyName: companyScope.companyName,
    });
  } catch (error) {
    console.error(`${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} export error:`, error);

    const message =
      error instanceof Error ? error.message : `Failed to generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} document.`;

    // `loadGeneratedDocumentDraft` throws "Generated document not found." for
    // both "row missing" and "row belongs to another tenant" cases. Map that
    // to a 404 instead of a 500 so the response is honest about scope without
    // leaking existence.
    const status = message === "Generated document not found." ? 404 : 500;

    return new NextResponse(JSON.stringify({ error: message }), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
```

## app\api\superadmin\csep-completeness-review\route.ts

```ts
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { normalizeAppRole } from "@/lib/rbac";
import { buildCsepBuilderExpectationSummary } from "@/lib/csepCompletenessReviewBuilder";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import { parseCompletedCsepCompletenessReviewPostBody } from "@/lib/parseGcProgramAiReviewPostBody";
import { runAdHocCsepCompletenessReview } from "@/lib/runAdHocCsepCompletenessReview";

export const runtime = "nodejs";
export const maxDuration = 120;

function canRunCompletedCsepReview(role: string) {
  const normalized = normalizeAppRole(role);
  return normalized === "super_admin" || normalized === "internal_reviewer";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canRunCompletedCsepReview(auth.role)) {
    return NextResponse.json(
      { error: "Completed CSEP AI review can only be run by super admins or internal reviewers." },
      { status: 403 }
    );
  }

  const parsedBody = await parseCompletedCsepCompletenessReviewPostBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const builderConfig = await getDocumentBuilderTextConfig(auth.supabase);
  const builderExpectationSummary = buildCsepBuilderExpectationSummary(builderConfig);
  const result = await runAdHocCsepCompletenessReview({
    ...parsedBody.data,
    builderExpectationSummary,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    review: result.review,
    disclaimer: result.disclaimer,
    extraction: result.extraction,
    siteReferenceExtractions: result.siteReferenceExtraction,
    fileName: result.fileName,
  });
}
```

## app\api\superadmin\csep-completeness-review\download-notes\route.ts

```ts
import { NextResponse } from "next/server";
import type { BuilderProgramAiReview } from "@/lib/builderDocumentAiReview";
import { annotateCsepReviewDocx } from "@/lib/annotateCsepReviewDocx";
import { renderCsepCompletenessReviewNotesDocx } from "@/lib/csepCompletenessReviewDocx";
import { normalizeAppRole, authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";
export const maxDuration = 120;

function canRunCompletedCsepReview(role: string) {
  const normalized = normalizeAppRole(role);
  return normalized === "super_admin" || normalized === "internal_reviewer";
}

function safeFilePart(value: string, fallback: string) {
  const cleaned = value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

function isDocxFileName(fileName: string) {
  return fileName.trim().toLowerCase().endsWith(".docx");
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canRunCompletedCsepReview(auth.role)) {
    return NextResponse.json(
      { error: "Completed CSEP AI review can only be run by super admins or internal reviewers." },
      { status: 403 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const rawDocument = form?.get("document");
    const rawReview = form?.get("review");
    const rawFileName = form?.get("fileName");

    if (!(rawDocument instanceof File) || typeof rawReview !== "string") {
      return NextResponse.json(
        { error: "A completed DOCX upload and serialized review are required." },
        { status: 400 }
      );
    }

    const fileName =
      (typeof rawFileName === "string" && rawFileName.trim()) || rawDocument.name?.trim() || "completed-csep.docx";

    let review: BuilderProgramAiReview;
    try {
      review = JSON.parse(rawReview) as BuilderProgramAiReview;
    } catch {
      return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
    }

    if (!isDocxFileName(fileName)) {
      return NextResponse.json(
        { error: "Inline comments are currently available for DOCX uploads only." },
        { status: 400 }
      );
    }

    const annotated = await annotateCsepReviewDocx({
      buffer: Buffer.from(await rawDocument.arrayBuffer()),
      review,
    });
    const baseName = safeFilePart(fileName.replace(/\.[^.]+$/, ""), "completed_csep");
    return new NextResponse(new Uint8Array(annotated), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}_annotated_review.docx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        fileName?: string;
        disclaimer?: string;
        reviewerContext?: string;
        extractionSummary?: string;
        siteReferenceSummary?: string;
        review?: BuilderProgramAiReview;
      }
    | null;

  if (!body?.review || !body.fileName?.trim()) {
    return NextResponse.json(
      { error: "A completed review and source file name are required to download notes." },
      { status: 400 }
    );
  }

  const buffer = await renderCsepCompletenessReviewNotesDocx({
    sourceFileName: body.fileName.trim(),
    review: body.review,
    disclaimer: body.disclaimer?.trim() || "",
    reviewerContext: body.reviewerContext?.trim() || "",
    extractionSummary: body.extractionSummary?.trim() || "",
    siteReferenceSummary: body.siteReferenceSummary?.trim() || "",
  });

  const baseName = safeFilePart(body.fileName.replace(/\.[^.]+$/, ""), "completed_csep");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${baseName}_review_notes.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
```

## app\api\superadmin\csep-completeness-review\rebuild\route.ts

```ts
import { NextResponse } from "next/server";
import { buildCsepBuilderExpectationSummary } from "@/lib/csepCompletenessReviewBuilder";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import { parseCompletedCsepCompletenessReviewPostBody } from "@/lib/parseGcProgramAiReviewPostBody";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { runAdHocCompletedCsepRebuild } from "@/lib/runAdHocCompletedCsepRebuild";

export const runtime = "nodejs";
export const maxDuration = 120;

function canRunCompletedCsepReview(role: string) {
  const normalized = normalizeAppRole(role);
  return normalized === "super_admin" || normalized === "internal_reviewer";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canRunCompletedCsepReview(auth.role)) {
    return NextResponse.json(
      { error: "Completed CSEP rebuild can only be run by super admins or internal reviewers." },
      { status: 403 }
    );
  }

  const parsedBody = await parseCompletedCsepCompletenessReviewPostBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const builderConfig = await getDocumentBuilderTextConfig(auth.supabase);
  const builderExpectationSummary = buildCsepBuilderExpectationSummary(builderConfig);
  const result = await runAdHocCompletedCsepRebuild({
    ...parsedBody.data,
    builderExpectationSummary,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(Buffer.from(result.body), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
```

## app\api\superadmin\csep-programs\config\route.ts

```ts
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCsepProgramConfig, saveCsepProgramConfig } from "@/lib/csepProgramSettings";
import { normalizeCsepProgramConfig } from "@/lib/csepPrograms";

export const runtime = "nodejs";

function requireSuperAdmin(role: string) {
  return role.trim().toLowerCase() === "super_admin";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const config = await getCsepProgramConfig(auth.supabase);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load CSEP program settings.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const config = normalizeCsepProgramConfig(body);
    const result = await saveCsepProgramConfig({
      supabase: auth.supabase,
      actorUserId: auth.user.id,
      config,
    });

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save CSEP program settings.",
      },
      { status: 500 }
    );
  }
}
```

## app\api\superadmin\csep-survey-test\export\route.ts

```ts
import { NextResponse } from "next/server";
import {
  buildSurveyTestExportPayload,
  type SurveyTestFormData,
} from "@/lib/csepSurveyTest";
import { authorizeRequest } from "@/lib/rbac";
import { generateCsepDocx } from "@/app/api/csep/export/route";

export const runtime = "nodejs";

function requireSuperAdmin(role: string) {
  return role.trim().toLowerCase() === "super_admin";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as SurveyTestFormData;
    return await generateCsepDocx(buildSurveyTestExportPayload(body), {
      supabase: auth.supabase,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Survey Test CSEP export.",
      },
      { status: 500 }
    );
  }
}
```

## app\api\superadmin\csep-survey-test\review\route.ts

```ts
import { NextResponse } from "next/server";
import { generateBuilderProgramAiReview } from "@/lib/builderDocumentAiReview";
import {
  buildSurveyTestEnrichment,
  buildSurveyTestReviewSeedText,
  type SurveyTestFormData,
} from "@/lib/csepSurveyTest";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

function requireSuperAdmin(role: string) {
  return role.trim().toLowerCase() === "super_admin";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as SurveyTestFormData;
    const enrichment = buildSurveyTestEnrichment(body);
    const { review, disclaimer } = await generateBuilderProgramAiReview({
      documentText: buildSurveyTestReviewSeedText(body, enrichment),
      programLabel: "Survey Test CSEP",
      projectName: body.project_name?.trim() || "Survey Test CSEP",
      documentTitle: "Survey / Layout requirements overview",
      companyName: body.contractor_company?.trim() || "SafetyDocs360",
      additionalReviewerContext:
        "This is a superadmin-only survey test builder. Review whether the derived hazards, permits, training, and document package are ready for a trial DOCX export before live rollout.",
    });

    return NextResponse.json({
      review,
      disclaimer,
      enrichment,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Survey Test CSEP AI review.",
      },
      { status: 500 }
    );
  }
}
```

## app\(app)\superadmin\csep-completeness-review\page.tsx

```ts
"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
  StatusBadge,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import type {
  BuilderProgramAiReview,
  BuilderProgramAiReviewFinding,
  BuilderProgramAiReviewSectionNote,
} from "@/lib/builderDocumentAiReview";
import {
  formatCsepFindingNote,
  getCsepSectionNoteFields,
} from "@/lib/csepReviewNoteFormat";
import {
  parseContentDispositionFilename,
  triggerBrowserDownload,
} from "@/lib/browserDownload";

const supabase = getSupabaseBrowserClient();

const steps = [
  {
    title: "Upload completed CSEP",
    detail: "Add the completed PDF or DOCX you want the intelligence reviewer to check for missing content.",
  },
  {
    title: "Add context",
    detail: "Optionally add reviewer notes and a GC/site reference file for comparison.",
  },
  {
    title: "Run missing-items review",
    detail: "Generate the checklist of missing, incomplete, or weak CSEP content.",
  },
] as const;

type FeedbackTone = "neutral" | "success" | "warning" | "error";
type ExtractionMeta =
  | { ok: true; method: string; truncated: boolean; annotations: Array<{ note: string }> }
  | { ok: false; error: string };
type SiteExtractionMeta = Array<{
  fileName: string;
  ok: true;
  method: string;
  truncated: boolean;
}>;

export default function SuperadminCsepCompletenessReviewPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [siteDocumentFiles, setSiteDocumentFiles] = useState<File[]>([]);
  const [reviewerContext, setReviewerContext] = useState("");
  const [review, setReview] = useState<BuilderProgramAiReview | null>(null);
  const [reviewDisclaimer, setReviewDisclaimer] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [extraction, setExtraction] = useState<ExtractionMeta | null>(null);
  const [siteExtraction, setSiteExtraction] = useState<SiteExtractionMeta>([]);

  const readinessChecklist = useMemo(
    () => [
      {
        label: documentFile
          ? `Completed CSEP ready: ${documentFile.name}`
          : "Upload a completed CSEP PDF or DOCX.",
        done: Boolean(documentFile),
      },
      {
        label: siteDocumentFiles.length
          ? `${siteDocumentFiles.length} reference file${siteDocumentFiles.length === 1 ? "" : "s"} attached`
          : "Optional: attach GC/site reference files for comparison.",
        done: siteDocumentFiles.length > 0,
      },
      {
        label: review
          ? "Intelligence completeness review is ready."
          : "Run the review to generate the missing-items checklist.",
        done: Boolean(review),
      },
    ],
    [documentFile, review, siteDocumentFiles]
  );

  const workflowSteps = steps.map((item, index) => ({
    label: item.title,
    detail: item.detail,
    active: step === index,
    complete: index < step || (index === 2 && Boolean(review)),
  }));

  const setFeedbackMessage = useCallback(
    (message: string, tone: FeedbackTone = "neutral") => {
      setFeedback(message);
      setFeedbackTone(tone);
    },
    []
  );

  const extractionSummary = useMemo(() => {
    if (!extraction) return "";
    if (!extraction.ok) return `Extraction warning: ${extraction.error}`;
    return `Completed CSEP extracted via ${extraction.method}${extraction.truncated ? " (truncated)" : ""}.`;
  }, [extraction]);

  const siteExtractionSummary = useMemo(() => {
    if (!siteExtraction.length) return "";
    return siteExtraction
      .map(
        (item) =>
          `Reference file ${item.fileName} extracted via ${item.method}${item.truncated ? " (truncated)" : ""}.`
      )
      .join(" ");
  }, [siteExtraction]);

  const complianceSummary = useMemo(() => {
    if (!review) return null;
    return review.complianceSummary;
  }, [review]);

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          setUserRole(null);
          return;
        }

        const meResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const meData = (await meResponse.json().catch(() => null)) as
          | { user?: { role?: string } }
          | null;

        if (meResponse.ok) {
          setUserRole(meData?.user?.role ?? null);
        }
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as a super admin.");
    }

    return session.access_token;
  }, []);

  async function runReview() {
    if (!documentFile) {
      setFeedbackMessage("Upload a completed CSEP file before running the review.", "warning");
      return;
    }

    setReviewLoading(true);
    setFeedbackMessage("");
    setReview(null);
    setReviewDisclaimer("");
    setExtraction(null);
    setSiteExtraction([]);

    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("document", documentFile);
      formData.append("additionalReviewerContext", reviewerContext);
      for (const siteDocumentFile of siteDocumentFiles) {
        formData.append("siteDocument", siteDocumentFile);
      }

      const response = await fetch("/api/superadmin/csep-completeness-review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            disclaimer?: string;
            extraction?: ExtractionMeta;
            siteReferenceExtractions?: SiteExtractionMeta;
            review?: BuilderProgramAiReview;
          }
        | null;

      if (!response.ok || !data?.review) {
        throw new Error(data?.error || "Failed to run completed CSEP review.");
      }

      setReview(data.review);
      setReviewDisclaimer(data.disclaimer ?? "");
      setExtraction(data.extraction ?? null);
      setSiteExtraction(data.siteReferenceExtractions ?? []);
      setFeedbackMessage("Completed CSEP review is ready.", "success");
      setStep(2);
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to run completed CSEP review.",
        "error"
      );
    } finally {
      setReviewLoading(false);
    }
  }

  async function downloadNotesDocument() {
    if (!review || !documentFile) {
      setFeedbackMessage("Run the completed CSEP review before downloading notes.", "warning");
      return;
    }

    setDownloadLoading(true);

    try {
      const token = await getAccessToken();
      const shouldRequestInlineComments = documentFile.name.toLowerCase().endsWith(".docx");
      const response = shouldRequestInlineComments
        ? await (async () => {
            const formData = new FormData();
            formData.append("document", documentFile);
            formData.append("fileName", documentFile.name);
            formData.append("review", JSON.stringify(review));
            return fetch("/api/superadmin/csep-completeness-review/download-notes", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });
          })()
        : await fetch("/api/superadmin/csep-completeness-review/download-notes", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: documentFile.name,
              disclaimer: reviewDisclaimer,
              reviewerContext,
              extractionSummary,
              siteReferenceSummary: siteExtractionSummary,
              review,
            }),
          });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to download the review notes document.");
      }

      const blob = await response.blob();
      const fallbackName = documentFile.name.toLowerCase().endsWith(".docx")
        ? `${documentFile.name.replace(/\.[^.]+$/, "")}_annotated_review.docx`
        : `${documentFile.name.replace(/\.[^.]+$/, "")}_review_notes.docx`;
      const fileName =
        parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
        fallbackName;
      triggerBrowserDownload(blob, fileName);
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to download the review notes document.",
        "error"
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  async function downloadRebuiltDocument() {
    if (!documentFile) {
      setFeedbackMessage("Upload a completed CSEP file before rebuilding it.", "warning");
      return;
    }

    setRebuildLoading(true);

    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("document", documentFile);
      formData.append("additionalReviewerContext", reviewerContext);
      for (const siteDocumentFile of siteDocumentFiles) {
        formData.append("siteDocument", siteDocumentFile);
      }

      const response = await fetch("/api/superadmin/csep-completeness-review/rebuild", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to rebuild the completed CSEP.");
      }

      const blob = await response.blob();
      const fileName =
        parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
        `${documentFile.name.replace(/\.[^.]+$/, "")}_Safety360_rebuilt.docx`;
      triggerBrowserDownload(blob, fileName);
      setFeedbackMessage(
        "Rebuilt Safety360 CSEP is ready. Review it and make sure the project-specific facts look right before issue.",
        "success"
      );
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to rebuild the completed CSEP.",
        "error"
      );
    } finally {
      setRebuildLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / CSEP review"
          title="Completed CSEP Review"
          description="Loading the completed-CSEP review workspace."
        />
        <InlineMessage>Loading access...</InlineMessage>
      </div>
    );
  }

  if (userRole !== "super_admin") {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / CSEP review"
          title="Completed CSEP Review"
          description="This review tool is only available to the Super Admin role."
        />
        <InlineMessage tone="warning">
          Super Admin access is required to upload a completed CSEP and run the missing-items review.
        </InlineMessage>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Superadmin / CSEP review"
        title="Completed CSEP Missing-Items Review"
        description="Upload a completed external CSEP, optionally attach site/GC requirements, and have the intelligence reviewer call out what appears missing, incomplete, or unclear relative to the current CSEP process."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={documentFile ? "Document attached" : "No CSEP uploaded"}
              tone={documentFile ? "success" : "warning"}
            />
            <StatusBadge
              label={
                siteDocumentFiles.length
                  ? `${siteDocumentFiles.length} reference${siteDocumentFiles.length === 1 ? "" : "s"} attached`
                  : "No reference files"
              }
              tone={siteDocumentFiles.length ? "info" : "neutral"}
            />
            <StatusBadge
              label={review ? "Review ready" : "Review pending"}
              tone={review ? "success" : "warning"}
            />
          </div>
        }
      />

      {feedback ? <InlineMessage tone={feedbackTone}>{feedback}</InlineMessage> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SectionCard
            title={`Step ${step + 1}: ${steps[step].title}`}
            description={steps[step].detail}
          >
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Completed CSEP file
                  </label>
                  <p className="mt-1 text-xs text-[var(--app-text)]">
                    Upload a completed contractor CSEP in PDF or DOCX format.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="mt-3 block w-full max-w-xl text-sm text-[var(--app-text)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-panel)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--app-text-strong)]"
                    onChange={(event) => {
                      setDocumentFile(event.target.files?.[0] ?? null);
                      setReview(null);
                    }}
                  />
                </div>
                {documentFile ? (
                  <InlineMessage tone="success">{documentFile.name}</InlineMessage>
                ) : (
                  <InlineMessage>
                    This is an ad hoc superadmin diagnostic tool. It does not create a document record or touch the live CSEP builder flow.
                  </InlineMessage>
                )}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">
                    Reviewer context
                  </div>
                  <textarea
                    rows={5}
                    value={reviewerContext}
                    onChange={(event) => setReviewerContext(event.target.value)}
                    placeholder="Optional: owner redlines, project-specific requirements, suspected gaps to verify, or expected CSEP sections."
                    className="w-full rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
                  />
                </label>
                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Site / GC reference documents
                  </label>
                  <p className="mt-1 text-xs text-[var(--app-text)]">
                    Optional PDF or DOCX files. The intelligence reviewer will compare the completed CSEP against all uploaded references as well as baseline CSEP expectations.
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="mt-3 block w-full max-w-xl text-sm text-[var(--app-text)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--app-panel)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--app-text-strong)]"
                    onChange={(event) => {
                      setSiteDocumentFiles(Array.from(event.target.files ?? []));
                      setReview(null);
                    }}
                  />
                </div>
                {siteDocumentFiles.length ? (
                  <InlineMessage tone="success">
                    {siteDocumentFiles.length} reference file
                    {siteDocumentFiles.length === 1 ? "" : "s"} attached:{" "}
                    {siteDocumentFiles.map((file) => file.name).join(", ")}
                  </InlineMessage>
                ) : (
                  <InlineMessage>
                    No site references attached. The review will focus on the uploaded CSEP and baseline completeness checks.
                  </InlineMessage>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => void runReview()}
                  disabled={reviewLoading || !documentFile}
                  className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewLoading ? "Running missing-items review..." : "Run missing-items review"}
                </button>

                {extraction ? (
                  <p className="text-xs text-[var(--app-text)]">
                    {extraction.ok
                      ? `Completed CSEP text extracted (${extraction.method}${extraction.truncated ? ", truncated" : ""}).`
                      : `Extraction warning: ${extraction.error}`}
                  </p>
                ) : null}
                {siteExtraction.length ? (
                  <div className="space-y-1 text-xs text-[var(--app-text)]">
                    {siteExtraction.map((item) => (
                      <p key={item.fileName}>
                        Reference file ({item.fileName}) extracted via {item.method}
                        {item.truncated ? ", truncated" : ""}.
                      </p>
                    ))}
                  </div>
                ) : null}
                {reviewDisclaimer ? <InlineMessage>{reviewDisclaimer}</InlineMessage> : null}

                {review ? (
                  <div className="space-y-4">
                    <InlineMessage tone={review.overallAssessment === "sufficient" ? "success" : "warning"}>
                      {review.executiveSummary}
                    </InlineMessage>
                    {complianceSummary ? (
                      <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white p-4 shadow-[var(--app-shadow-soft)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                              Compliance coverage
                            </div>
                            <p className="mt-1 text-sm text-[var(--app-text)]">
                              Weighted from the section audit below: present sections count fully, partial sections count halfway.
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold tracking-tight text-[var(--app-text-strong)]">
                              {complianceSummary.compliancePercent}%
                            </div>
                            <p className="mt-1 text-xs text-[var(--app-text)]">
                              {complianceSummary.totalSections} audited section
                              {complianceSummary.totalSections === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <StatusBadge
                            label={`${complianceSummary.presentCount} present`}
                            tone="success"
                          />
                          <StatusBadge
                            label={`${complianceSummary.partialCount} partial`}
                            tone="info"
                          />
                          <StatusBadge
                            label={`${complianceSummary.missingCount} missing`}
                            tone="warning"
                          />
                        </div>
                      </div>
                    ) : null}
                    <Bucket
                      title="Missing items checklist"
                      items={review.missingItemsChecklist}
                      emptyLabel="No missing items were identified."
                    />
                    <Bucket
                      title="Builder review notes"
                      items={review.builderAlignmentNotes}
                      emptyLabel="No builder alignment notes were returned."
                    />
                    <SectionAuditBucket items={review.sectionReviewNotes} />
                    <FindingBucket items={review.detailedFindings} />
                    <Bucket
                      title="Gaps / ambiguities / weak sections"
                      items={review.gapsRisksOrClarifications}
                    />
                    <Bucket
                      title="Recommended edits before approval"
                      items={review.recommendedEditsBeforeApproval}
                    />
                    <Bucket
                      title="Document quality issues"
                      items={review.documentQualityIssues ?? []}
                      emptyLabel="No document quality issues flagged."
                    />
                    <Bucket
                      title="Checklist delta"
                      items={review.checklistDelta ?? []}
                      emptyLabel="No checklist delta items flagged."
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void downloadNotesDocument()}
                        disabled={downloadLoading}
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {downloadLoading
                          ? "Preparing review download..."
                          : documentFile?.name.toLowerCase().endsWith(".docx")
                            ? "Download annotated DOCX"
                            : "Download notes packet"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadRebuiltDocument()}
                        disabled={rebuildLoading}
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {rebuildLoading
                          ? "Rebuilding Safety360 CSEP..."
                          : "Download rebuilt Safety360 CSEP"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <InlineMessage>
                    Run the review to generate the missing-items checklist for the uploaded completed CSEP.
                  </InlineMessage>
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 border-t border-[var(--app-border)] pt-2">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0}
                className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current + 1)}
                  disabled={(step === 0 && !documentFile) || reviewLoading}
                  className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next step
                </button>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <WorkflowPath
            title="Completed-CSEP review flow"
            description="Upload the finished file, add any reference context, and run the checklist review without entering the live builder flow."
            steps={workflowSteps}
          />

          <StartChecklist title="Readiness checklist" items={readinessChecklist} />

          <SectionCard
            title="Review focus"
            description="What the intelligence review prioritizes in this mode."
          >
            <Bucket
              title="Primary checks"
              items={[
                "Missing or incomplete CSEP sections",
                "Weak scope, hazard, control, PPE, and permit coverage",
                "Missing responsibilities, emergency procedures, training, inspections, and environmental controls",
              ]}
            />
            <Bucket
              title="Rebuild mode"
              items={[
                "Uses the uploaded completed CSEP as the source document",
                "Runs the builder-style review first so the rebuild fixes the main gaps",
                "Returns a Safety360-formatted DOCX you can review and issue",
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Bucket({
  title,
  items,
  emptyLabel = "No items to show.",
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</div>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
          {items.map((item) => (
            <li key={item} className="rounded-xl bg-[var(--semantic-neutral-bg)] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--app-text)]">{emptyLabel}</p>
      )}
    </div>
  );
}

function FindingBucket({ items }: { items: BuilderProgramAiReviewFinding[] }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
        Document review findings
      </div>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.sectionLabel}-${index}`}
              className="rounded-2xl border border-[var(--app-border)] bg-white p-4"
            >
              <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                {index + 1}. {item.sectionLabel}
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[var(--semantic-neutral-bg)] px-3 py-3 text-sm leading-6 text-[var(--app-text)]">
                {buildHumanFindingParagraph(item)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--app-text)]">
          No detailed findings were returned.
        </p>
      )}
    </div>
  );
}

function buildHumanFindingParagraph(item: BuilderProgramAiReviewFinding) {
  return formatCsepFindingNote(item);
}

function SectionAuditBucket({ items }: { items: BuilderProgramAiReviewSectionNote[] }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
        Section-by-section builder audit
      </div>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.sectionLabel}-${index}`}
              className="rounded-2xl border border-[var(--app-border)] bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                  {index + 1}. {item.sectionLabel}
                </div>
                <StatusBadge
                  label={
                    item.status === "present"
                      ? "Present"
                      : item.status === "missing"
                        ? "Missing"
                        : "Partial"
                  }
                  tone={
                    item.status === "present"
                      ? "success"
                      : item.status === "missing"
                        ? "warning"
                        : "info"
                  }
                />
              </div>
              <div className="mt-3 space-y-3 text-sm text-[var(--app-text)]">
                {getCsepSectionNoteFields(item).map((field) => (
                  <FindingField key={field.label} label={field.label} value={field.value} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--app-text)]">
          No section-by-section builder audit was returned.
        </p>
      )}
    </div>
  );
}

function FindingField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--semantic-neutral-bg)] px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-text-muted)]">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--app-text)]">{value}</div>
    </div>
  );
}
```

## app\(app)\superadmin\csep-programs\page.tsx

```ts
"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getDefaultProgramDefinitions,
  getProgramDefinitionKey,
} from "@/lib/csepPrograms";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import type {
  CSEPProgramConfig,
  CSEPProgramDefinition,
  CSEPProgramDefinitionContent,
  CSEPProgramSubtypeValue,
} from "@/types/csep-programs";

const supabase = getSupabaseBrowserClient();

type ProgramArrayField = keyof Pick<
  CSEPProgramDefinitionContent,
  | "applicableWhen"
  | "oshaRefs"
  | "responsibilities"
  | "preTaskProcedures"
  | "workProcedures"
  | "stopWorkProcedures"
  | "closeoutProcedures"
  | "training"
  | "controls"
>;

const ARRAY_FIELDS: Array<{
  field: ProgramArrayField;
  label: string;
  help: string;
}> = [
  {
    field: "applicableWhen",
    label: "When It Applies",
    help: "One bullet per line.",
  },
  {
    field: "oshaRefs",
    label: "Applicable References",
    help: "One OSHA reference per line.",
  },
  {
    field: "responsibilities",
    label: "Responsibilities",
    help: "One responsibility bullet per line.",
  },
  {
    field: "preTaskProcedures",
    label: "Pre-Task Setup",
    help: "One procedure bullet per line.",
  },
  {
    field: "workProcedures",
    label: "Work Execution",
    help: "One procedure bullet per line.",
  },
  {
    field: "stopWorkProcedures",
    label: "Stop-Work / Escalation",
    help: "One procedure bullet per line.",
  },
  {
    field: "closeoutProcedures",
    label: "Post-Task / Closeout",
    help: "One procedure bullet per line.",
  },
  {
    field: "training",
    label: "Training",
    help: "One training bullet per line.",
  },
  {
    field: "controls",
    label: "Minimum Required Controls",
    help: "One control bullet per line.",
  },
];

function cloneProgramDefinitions(definitions: CSEPProgramDefinition[]) {
  return definitions.map((definition) => ({
    ...definition,
    oshaRefs: [...definition.oshaRefs],
    applicableWhen: [...definition.applicableWhen],
    responsibilities: [...definition.responsibilities],
    preTaskProcedures: [...definition.preTaskProcedures],
    workProcedures: [...definition.workProcedures],
    stopWorkProcedures: [...definition.stopWorkProcedures],
    closeoutProcedures: [...definition.closeoutProcedures],
    training: [...definition.training],
    controls: [...definition.controls],
    subtypeVariants: definition.subtypeVariants
      ? Object.fromEntries(
          Object.entries(definition.subtypeVariants).map(([key, value]) => [
            key,
            value
              ? {
                  ...value,
                  oshaRefs: [...(value.oshaRefs ?? [])],
                  applicableWhen: [...(value.applicableWhen ?? [])],
                  responsibilities: [...(value.responsibilities ?? [])],
                  preTaskProcedures: [...(value.preTaskProcedures ?? [])],
                  workProcedures: [...(value.workProcedures ?? [])],
                  stopWorkProcedures: [...(value.stopWorkProcedures ?? [])],
                  closeoutProcedures: [...(value.closeoutProcedures ?? [])],
                  training: [...(value.training ?? [])],
                  controls: [...(value.controls ?? [])],
                }
              : value,
          ])
        ) as CSEPProgramDefinition["subtypeVariants"]
      : undefined,
  }));
}

function linesToText(values: string[]) {
  return values.join("\n");
}

function parseLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export default function SuperadminCsepProgramsPage() {
  const [config, setConfig] = useState<CSEPProgramConfig>({
    definitions: getDefaultProgramDefinitions(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");
  const [selectedKey, setSelectedKey] = useState(
    getProgramDefinitionKey(getDefaultProgramDefinitions()[0])
  );

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as a super admin.");
    }

    return session.access_token;
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/csep-programs/config", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json().catch(() => null)) as
        | (CSEPProgramConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load CSEP program settings.");
      }

      if (data?.definitions) {
        setConfig({
          definitions: cloneProgramDefinitions(data.definitions),
        });
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load CSEP program settings."
      );
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!config.definitions.some((definition) => getProgramDefinitionKey(definition) === selectedKey)) {
      const first = config.definitions[0];
      if (first) {
        setSelectedKey(getProgramDefinitionKey(first));
      }
    }
  }, [config.definitions, selectedKey]);

  const selectedProgram = useMemo(() => {
    return (
      config.definitions.find((definition) => getProgramDefinitionKey(definition) === selectedKey) ??
      config.definitions[0] ??
      null
    );
  }, [config.definitions, selectedKey]);

  function updateProgram(
    key: string,
    updater: (definition: CSEPProgramDefinition) => CSEPProgramDefinition
  ) {
    setConfig((prev) => ({
      definitions: prev.definitions.map((definition) =>
        getProgramDefinitionKey(definition) === key ? updater(definition) : definition
      ),
    }));
  }

  function updateSelectedTextField(
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) {
    if (!selectedProgram) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      [field]: value,
    }));
  }

  function updateSelectedArrayField(
    field: ProgramArrayField,
    value: string
  ) {
    if (!selectedProgram) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      [field]: parseLines(value),
    }));
  }

  function updateSubtypeTextField(
    subtype: CSEPProgramSubtypeValue,
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) {
    if (!selectedProgram?.subtypeVariants?.[subtype]) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      subtypeVariants: {
        ...definition.subtypeVariants,
        [subtype]: {
          ...definition.subtypeVariants?.[subtype],
          [field]: value,
        },
      },
    }));
  }

  function updateSubtypeArrayField(
    subtype: CSEPProgramSubtypeValue,
    field: ProgramArrayField,
    value: string
  ) {
    if (!selectedProgram?.subtypeVariants?.[subtype]) return;
    const key = getProgramDefinitionKey(selectedProgram);
    updateProgram(key, (definition) => ({
      ...definition,
      subtypeVariants: {
        ...definition.subtypeVariants,
        [subtype]: {
          ...definition.subtypeVariants?.[subtype],
          [field]: parseLines(value),
        },
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/csep-programs/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      const data = (await res.json().catch(() => null)) as
        | (CSEPProgramConfig & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save CSEP program settings.");
      }

      if (data?.definitions) {
        setConfig({
          definitions: cloneProgramDefinitions(data.definitions),
        });
      }

      setMessage("CSEP program settings saved. New documents will use the updated program blocks.");
      setMessageTone("success");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save CSEP program settings."
      );
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    await loadConfig();
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Super Admin"
        title="CSEP Program Settings"
        description="Edit the live contractor safety plan program blocks used by the document generator. Changes here control the section title, summary, references, responsibilities, procedures, training, and controls for each program."
        actions={
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Program Settings"}
            </button>
            <button
              type="button"
              onClick={() =>
                setConfig({
                  definitions: getDefaultProgramDefinitions(),
                })
              }
              disabled={loading || saving}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || saving}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Reload
            </button>
          </>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
        <SectionCard
          title="Program Picker"
          description="Choose the exact program block you want to review or rewrite."
        >
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-300">
              Program
              <select
                value={selectedKey}
                onChange={(event) => setSelectedKey(event.target.value)}
                className={`mt-2 w-full ${appNativeSelectClassName}`}
              >
                {config.definitions.map((definition) => (
                  <option key={getProgramDefinitionKey(definition)} value={getProgramDefinitionKey(definition)}>
                    {definition.category.toUpperCase()} Â· {definition.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedProgram ? (
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                <div>
                  <span className="font-semibold text-slate-200">Trigger item:</span>{" "}
                  {selectedProgram.item}
                </div>
                <div className="mt-2">
                  <span className="font-semibold text-slate-200">Category:</span>{" "}
                  {selectedProgram.category}
                </div>
                {selectedProgram.subtypeGroup ? (
                  <div className="mt-2">
                    <span className="font-semibold text-slate-200">Subtype group:</span>{" "}
                    {selectedProgram.subtypeGroup}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>

        {selectedProgram ? (
          <div className="space-y-6">
            <ProgramEditorCard
              title="Base Program Block"
              description="This is the default text used for the selected program."
              definition={selectedProgram}
              onTextChange={updateSelectedTextField}
              onArrayChange={updateSelectedArrayField}
            />

            {selectedProgram.subtypeVariants
              ? (Object.entries(selectedProgram.subtypeVariants) as Array<
                  [CSEPProgramSubtypeValue, NonNullable<CSEPProgramDefinition["subtypeVariants"]>[CSEPProgramSubtypeValue]]
                >).map(([subtype, value]) =>
                  value ? (
                    <ProgramVariantEditorCard
                      key={subtype}
                      subtype={subtype}
                      value={value}
                      onTextChange={updateSubtypeTextField}
                      onArrayChange={updateSubtypeArrayField}
                    />
                  ) : null
                )
              : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProgramEditorCard({
  title,
  description,
  definition,
  onTextChange,
  onArrayChange,
}: {
  title: string;
  description: string;
  definition: CSEPProgramDefinition;
  onTextChange: (
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) => void;
  onArrayChange: (field: ProgramArrayField, value: string) => void;
}) {
  return (
    <SectionCard title={title} description={description}>
      <div className="mt-6 space-y-5">
        <Field label="Program Title">
          <input
            type="text"
            value={definition.title}
            onChange={(event) => onTextChange("title", event.target.value)}
            className="app-dark-input"
          />
        </Field>

        <Field label="Summary">
          <textarea
            value={definition.summary}
            onChange={(event) => onTextChange("summary", event.target.value)}
            rows={4}
            className="app-dark-input"
          />
        </Field>

        {ARRAY_FIELDS.map((field) => (
          <Field key={field.field} label={field.label} help={field.help}>
            <textarea
              value={linesToText(definition[field.field])}
              onChange={(event) => onArrayChange(field.field, event.target.value)}
              rows={
                field.field === "controls" ||
                field.field === "preTaskProcedures" ||
                field.field === "workProcedures" ||
                field.field === "stopWorkProcedures" ||
                field.field === "closeoutProcedures"
                  ? 6
                  : 4
              }
              className="app-dark-input"
            />
          </Field>
        ))}
      </div>
    </SectionCard>
  );
}

function ProgramVariantEditorCard({
  subtype,
  value,
  onTextChange,
  onArrayChange,
}: {
  subtype: CSEPProgramSubtypeValue;
  value: Partial<CSEPProgramDefinitionContent>;
  onTextChange: (
    subtype: CSEPProgramSubtypeValue,
    field: keyof Pick<CSEPProgramDefinitionContent, "title" | "summary">,
    value: string
  ) => void;
  onArrayChange: (subtype: CSEPProgramSubtypeValue, field: ProgramArrayField, value: string) => void;
}) {
  return (
    <SectionCard
      title={`Subtype Override Â· ${subtype}`}
      description="These values override the base program block when this subtype is selected."
    >
      <div className="mt-6 space-y-5">
        <Field label="Subtype Title">
          <input
            type="text"
            value={value.title ?? ""}
            onChange={(event) => onTextChange(subtype, "title", event.target.value)}
            className="app-dark-input"
          />
        </Field>

        <Field label="Subtype Summary">
          <textarea
            value={value.summary ?? ""}
            onChange={(event) => onTextChange(subtype, "summary", event.target.value)}
            rows={4}
            className="app-dark-input"
          />
        </Field>

        {ARRAY_FIELDS.map((field) => (
          <Field key={`${subtype}-${field.field}`} label={field.label} help={field.help}>
            <textarea
              value={linesToText(value[field.field] ?? [])}
              onChange={(event) => onArrayChange(subtype, field.field, event.target.value)}
              rows={
                field.field === "controls" ||
                field.field === "preTaskProcedures" ||
                field.field === "workProcedures" ||
                field.field === "stopWorkProcedures" ||
                field.field === "closeoutProcedures"
                  ? 6
                  : 4
              }
              className="app-dark-input"
            />
          </Field>
        ))}
      </div>
    </SectionCard>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-slate-300">{label}</div>
      {children}
      {help ? <div className="mt-2 text-xs text-slate-500">{help}</div> : null}
    </label>
  );
}
```

## app\(app)\superadmin\csep-survey-test\page.tsx

```ts
"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
  StatusBadge,
  WorkflowPath,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import type { BuilderProgramAiReview } from "@/lib/builderDocumentAiReview";
import {
  buildSurveyTestEnrichment,
  createDefaultSurveyTestForm,
  getSurveyTestSubTradeOptions,
  getSurveyTestTaskOptions,
  getSurveyTestTradeOptions,
  SURVEY_TEST_LAYOUT_SECTIONS,
  type SurveyTestFormData,
} from "@/lib/csepSurveyTest";

const supabase = getSupabaseBrowserClient();

const steps = [
  { title: "Trade selection", detail: "Lock the workflow to the survey / layout trade." },
  { title: "Sub-trade", detail: "Choose the active survey sub-trade for this test build." },
  { title: "Select sections", detail: "Choose which survey layout sections belong in the DOCX." },
  { title: "Selectable tasks", detail: "Pick the work tasks that drive the intelligence enrichment." },
  { title: "Intelligence enrichment", detail: "Review OSHA, SOR, injury, permits, training, hazards, and PPE outputs." },
  { title: "Intelligence review", detail: "Run the review summary before you finish the document." },
  { title: "Finish document", detail: "Capture project metadata and download the survey test CSEP." },
];

type FeedbackTone = "neutral" | "success" | "warning" | "error";

export default function SuperadminCsepSurveyTestPage() {
  const [form, setForm] = useState<SurveyTestFormData>(createDefaultSurveyTestForm());
  const [step, setStep] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [review, setReview] = useState<BuilderProgramAiReview | null>(null);
  const [reviewDisclaimer, setReviewDisclaimer] = useState("");

  const tradeOptions = useMemo(() => getSurveyTestTradeOptions(), []);
  const subTradeOptions = useMemo(() => getSurveyTestSubTradeOptions(), []);
  const taskOptions = useMemo(
    () => getSurveyTestTaskOptions(form.subTrade),
    [form.subTrade]
  );
  const enrichment = useMemo(() => buildSurveyTestEnrichment(form), [form]);

  const setFeedbackMessage = useCallback(
    (message: string, tone: FeedbackTone = "neutral") => {
      setFeedback(message);
      setFeedbackTone(tone);
    },
    []
  );

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          setUserRole(null);
          return;
        }

        const meResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const meData = (await meResponse.json().catch(() => null)) as
          | { user?: { role?: string } }
          | null;

        if (meResponse.ok) {
          setUserRole(meData?.user?.role ?? null);
        }
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as a super admin.");
    }

    return session.access_token;
  }, []);

  function updateField<K extends keyof SurveyTestFormData>(field: K, value: SurveyTestFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field !== "project_name" && review) {
      setReview(null);
      setReviewDisclaimer("");
    }
  }

  function toggleArrayValue(field: "tasks" | "selectedLayoutSections", value: string) {
    setForm((prev) => {
      const current = prev[field];
      const exists = current.includes(value as never);

      return {
        ...prev,
        [field]: exists
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });

    if (review) {
      setReview(null);
      setReviewDisclaimer("");
    }
  }

  function canProceed(currentStep: number) {
    if (currentStep === 0) return Boolean(form.trade.trim());
    if (currentStep === 1) return Boolean(form.subTrade.trim());
    if (currentStep === 2) return form.selectedLayoutSections.length > 0;
    if (currentStep === 3) return form.tasks.length > 0;
    if (currentStep === 4) return enrichment.hazards.length > 0;
    if (currentStep === 5) return Boolean(review);
    return true;
  }

  async function runReview() {
    setReviewLoading(true);
    setFeedbackMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/superadmin/csep-survey-test/review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            disclaimer?: string;
            review?: BuilderProgramAiReview;
          }
        | null;

      if (!response.ok || !data?.review) {
        throw new Error(data?.error || "Failed to generate intelligence review.");
      }

      setReview(data.review);
      setReviewDisclaimer(data.disclaimer ?? "");
      setFeedbackMessage("Intelligence review is ready for the final download step.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to generate intelligence review.",
        "error"
      );
    } finally {
      setReviewLoading(false);
    }
  }

  async function downloadDocument() {
    setDownloadLoading(true);
    setFeedbackMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/superadmin/csep-survey-test/export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Failed to export Survey Test CSEP.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || "Survey_Test_CSEP.docx";
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
      setFeedbackMessage("Survey Test CSEP downloaded successfully.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to export Survey Test CSEP.",
        "error"
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  const workflowSteps = steps.map((item, index) => ({
    label: item.title,
    detail: item.detail,
    active: step === index,
    complete: index < step || (index === 5 && Boolean(review)),
  }));

  if (authLoading) {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / Survey test"
          title="Survey Test CSEP"
          description="Loading the superadmin survey test workspace."
        />
        <InlineMessage>Loading access...</InlineMessage>
      </div>
    );
  }

  if (userRole !== "super_admin") {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Superadmin / Survey test"
          title="Survey Test CSEP"
          description="This test builder is only available to the Super Admin role."
        />
        <InlineMessage tone="warning">
          Super Admin access is required to use the survey test builder, run the intelligence review, and export the DOCX.
        </InlineMessage>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Superadmin / Survey test"
        title="Survey Test CSEP"
        description="Use the hand-drawn process as the workflow: trade selection, sub-trade, sections, tasks, intelligence enrichment, intelligence review, then finish the survey-layout document without touching the live CSEP flow."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={form.trade} tone="info" />
            <StatusBadge
              label={`${form.selectedLayoutSections.length} sections`}
              tone={form.selectedLayoutSections.length ? "success" : "warning"}
            />
            <StatusBadge
              label={`${form.tasks.length} tasks`}
              tone={form.tasks.length ? "success" : "warning"}
            />
          </div>
        }
      />

      {feedback ? <InlineMessage tone={feedbackTone}>{feedback}</InlineMessage> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SectionCard
            title={`Step ${step + 1}: ${steps[step].title}`}
            description={steps[step].detail}
          >
            {step === 0 ? (
              <div className="space-y-4">
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">
                    Trade
                  </div>
                  <select
                    className={`${appNativeSelectClassName} w-full`}
                    value={form.trade}
                    onChange={(event) => updateField("trade", event.target.value)}
                  >
                    {tradeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <InlineMessage>
                  This test builder is intentionally locked to <strong>Survey / Layout</strong> so the workflow and DOCX can be validated without touching the live multi-trade CSEP builder.
                </InlineMessage>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">
                    Survey sub-trade
                  </div>
                  <select
                    className={`${appNativeSelectClassName} w-full`}
                    value={form.subTrade}
                    onChange={(event) => {
                      updateField("subTrade", event.target.value);
                      updateField("tasks", []);
                    }}
                  >
                    <option value="">Choose sub-trade</option>
                    {subTradeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <InlineMessage>
                  Pick the survey sub-trade first so the selectable task list and intelligence enrichment stay tied to the correct taxonomy.
                </InlineMessage>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-3">
                {SURVEY_TEST_LAYOUT_SECTIONS.map((section) => (
                  <label
                    key={section.key}
                    className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-4"
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedLayoutSections.includes(section.key)}
                      onChange={() => toggleArrayValue("selectedLayoutSections", section.key)}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                        {section.number}. {section.title}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-text)]">{section.summary}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                {!form.subTrade ? (
                  <InlineMessage tone="warning">
                    Choose a survey sub-trade first so the task list can be loaded.
                  </InlineMessage>
                ) : (
                  <>
                    <div className="grid gap-3">
                      {taskOptions.selectable.map((task) => (
                        <label
                          key={task}
                          className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-4"
                        >
                          <input
                            type="checkbox"
                            checked={form.tasks.includes(task)}
                            onChange={() => toggleArrayValue("tasks", task)}
                            className="mt-1 h-4 w-4"
                          />
                          <span className="text-sm font-medium text-[var(--app-text-strong)]">
                            {task}
                          </span>
                        </label>
                      ))}
                    </div>
                    {taskOptions.reference.length ? (
                      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--semantic-neutral-bg)] px-4 py-4">
                        <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                          Reference tasks
                        </div>
                        <div className="mt-2 text-sm text-[var(--app-text)]">
                          {taskOptions.reference.join(", ")}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                <Bucket title="OSHA data" items={enrichment.oshaData} />
                <Bucket title="SOR data" items={enrichment.sorData} />
                <Bucket title="Injury data" items={enrichment.injuryData} />
                <Bucket title="Required training" items={enrichment.requiredTraining} />
                <Bucket title="Permits required" items={enrichment.permitsRequired} emptyLabel="No permits currently triggered." />
                <Bucket title="Elements required" items={enrichment.elementsRequired} />
                <Bucket title="Hazards" items={enrichment.hazards} />
                <Bucket title="PPE" items={enrichment.ppe} />
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                  <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                    Review input snapshot
                  </div>
                  <div className="mt-2 text-sm text-[var(--app-text)]">
                    {enrichment.tradeLabel} / {enrichment.subTradeLabel ?? "No sub-trade selected"} with{" "}
                    {enrichment.selectedTasks.length} selected task{enrichment.selectedTasks.length === 1 ? "" : "s"}.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runReview()}
                  disabled={reviewLoading || !enrichment.selectedTasks.length || !form.subTrade}
                  className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewLoading ? "Running intelligence review..." : "Run intelligence review"}
                </button>
                {review ? (
                  <div className="space-y-4">
                    <InlineMessage tone={review.overallAssessment === "sufficient" ? "success" : "warning"}>
                      {review.executiveSummary}
                    </InlineMessage>
                    <Bucket title="Strengths" items={review.regulatoryAndProgramStrengths} />
                    <Bucket title="Gaps / risks / clarifications" items={review.gapsRisksOrClarifications} />
                    <Bucket title="Recommended edits before approval" items={review.recommendedEditsBeforeApproval} />
                    {review.checklistDelta?.length ? (
                      <Bucket title="Checklist delta" items={review.checklistDelta} />
                    ) : null}
                    {reviewDisclaimer ? <InlineMessage>{reviewDisclaimer}</InlineMessage> : null}
                  </div>
                ) : (
                  <InlineMessage>
                    Run the review after checking the enrichment buckets so the finish step has a reviewer-style summary.
                  </InlineMessage>
                )}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Project name"
                    value={form.project_name}
                    onChange={(value) => updateField("project_name", value)}
                  />
                  <Input
                    label="Project number"
                    value={form.project_number}
                    onChange={(value) => updateField("project_number", value)}
                  />
                  <Input
                    label="Project address"
                    value={form.project_address}
                    onChange={(value) => updateField("project_address", value)}
                  />
                  <Input
                    label="Owner / Client"
                    value={form.owner_client}
                    onChange={(value) => updateField("owner_client", value)}
                  />
                  <Input
                    label="GC / CM"
                    value={Array.isArray(form.gc_cm) ? form.gc_cm.join(", ") : form.gc_cm}
                    onChange={(value) => updateField("gc_cm", value)}
                  />
                  <Input
                    label="Contractor company"
                    value={form.contractor_company}
                    onChange={(value) => updateField("contractor_company", value)}
                  />
                  <Input
                    label="Contractor contact"
                    value={form.contractor_contact}
                    onChange={(value) => updateField("contractor_contact", value)}
                  />
                  <Input
                    label="Contractor phone"
                    value={form.contractor_phone}
                    onChange={(value) => updateField("contractor_phone", value)}
                  />
                  <Input
                    label="Contractor email"
                    value={form.contractor_email}
                    onChange={(value) => updateField("contractor_email", value)}
                  />
                </div>
                <TextArea
                  label="Scope of work"
                  value={form.scope_of_work}
                  onChange={(value) => updateField("scope_of_work", value)}
                />
                <TextArea
                  label="Project-Specific Safety Notes"
                  value={form.site_specific_notes}
                  onChange={(value) => updateField("site_specific_notes", value)}
                />
                <TextArea
                  label="Emergency procedures"
                  value={form.emergency_procedures}
                  onChange={(value) => updateField("emergency_procedures", value)}
                />
                <button
                  type="button"
                  onClick={() => void downloadDocument()}
                  disabled={
                    downloadLoading ||
                    !review ||
                    !form.subTrade.trim() ||
                    !form.tasks.length ||
                    !form.selectedLayoutSections.length
                  }
                  className="rounded-xl bg-[var(--app-accent-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadLoading ? "Generating DOCX..." : "Finish and download Survey Test CSEP"}
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 border-t border-[var(--app-border)] pt-2">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0}
                className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current + 1)}
                  disabled={!canProceed(step)}
                  className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next step
                </button>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <WorkflowPath
            title="Picture-driven workflow"
            description="This test route follows the hand-drawn process instead of the live single-page builder."
            steps={workflowSteps}
          />

          <StartChecklist title="Readiness checklist" items={enrichment.readinessChecklist} />

          <SectionCard
            title="Builder snapshot"
            description="Live view of what the survey test builder has assembled so far."
          >
            <Snapshot label="Sub-trade" value={enrichment.subTradeLabel ?? "Not selected"} />
            <Snapshot
              label="Tasks"
              value={
                enrichment.selectedTasks.length
                  ? `${enrichment.selectedTasks.length} selected`
                  : "None selected"
              }
            />
            <Snapshot
              label="Hazards"
              value={enrichment.hazards.length ? `${enrichment.hazards.length} derived` : "None"}
            />
            <Snapshot
              label="Permits"
              value={
                enrichment.permitsRequired.length
                  ? `${enrichment.permitsRequired.length} derived`
                  : "None"
              }
            />
            <Snapshot
              label="PPE"
              value={enrichment.ppe.length ? `${enrichment.ppe.length} listed` : "None"}
            />
            <Snapshot
              label="Sections"
              value={`${enrichment.selectedSections.length} selected`}
            />
          </SectionCard>

          <SectionCard
            title="Reference layout"
            description="The DOCX export mirrors the uploaded survey layout section structure."
          >
            <div className="space-y-3">
              {SURVEY_TEST_LAYOUT_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3"
                >
                  <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                    {section.number}. {section.title}
                  </div>
                  <div className="mt-1 text-sm text-[var(--app-text)]">{section.summary}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Bucket({
  title,
  items,
  emptyLabel = "Nothing generated yet.",
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${title}:${item}`}
              className="rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)]"
            >
              {item}
            </div>
          ))
        ) : (
          <div className="text-sm text-[var(--app-text)]">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3">
      <span className="text-sm text-[var(--app-text)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--app-text-strong)]">{value}</span>
    </div>
  );
}
```

## components\csep\GcRequiredProgramUpload.tsx

```ts
"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { InlineMessage, SectionCard } from "@/components/WorkspacePrimitives";
import type { PermissionMap } from "@/lib/rbac";

const supabase = getSupabaseBrowserClient();

type GcDoc = {
  id: string;
  document_title: string | null;
  file_name: string | null;
  file_path: string | null;
  final_file_path?: string | null;
  created_at: string | null;
};

type GcGetResponse = {
  document?: GcDoc | null;
  pendingReview?: boolean;
  submittedAt?: string | null;
  error?: string;
};

export function GcRequiredProgramUpload({
  permissionMap,
  authLoading,
  /** CSEP project name when filled; stored on the document row for NOT NULL project_name. */
  projectName,
}: {
  permissionMap: PermissionMap | null;
  authLoading: boolean;
  projectName?: string;
}) {
  const [doc, setDoc] = useState<GcDoc | null>(null);
  const [pendingReview, setPendingReview] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [dragActive, setDragActive] = useState(false);

  const canUpload = Boolean(
    permissionMap?.can_submit_documents || permissionMap?.can_create_documents
  );

  const loadCurrent = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/company/gc-program-document", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = (await res.json().catch(() => null)) as GcGetResponse | null;
    if (res.ok) {
      setDoc(data?.document ?? null);
      setPendingReview(Boolean(data?.pendingReview));
      setSubmittedAt(data?.submittedAt ?? null);
    } else {
      setPendingReview(false);
      setSubmittedAt(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCurrent();
  }, [loadCurrent]);

  async function uploadFile(file: File) {
    setMessage("");
    if (!canUpload) {
      setMessageTone("warning");
      setMessage("Your role cannot upload files.");
      return;
    }
    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessageTone("error");
        setMessage("Session expired. Sign in again.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) {
        formData.append("title", title.trim());
      }
      if (projectName?.trim()) {
        formData.append("project_name", projectName.trim().slice(0, 200));
      }
      const res = await fetch("/api/company/gc-program-document", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        success?: boolean;
        pendingReview?: boolean;
      } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Upload failed.");
        return;
      }
      setMessageTone("success");
      setMessage(
        data?.pendingReview
          ? "Your file was submitted for review. You will see it here after a platform administrator approves it."
          : "GC-required document saved. It applies to your companyâ€™s work on top of OSHA."
      );
      setTitle("");
      await loadCurrent();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc() {
    setMessage("");
    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessageTone("error");
        setMessage("Session expired.");
        return;
      }
      const res = await fetch("/api/company/gc-program-document", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Could not remove file.");
        return;
      }
      setDoc(null);
      setPendingReview(false);
      setSubmittedAt(null);
      setMessageTone("success");
      setMessage("Pending submission withdrawn.");
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  }

  return (
    <SectionCard
      title="GC-required program document"
      description="Upload the document your General Contractor requires your company to follow on this jobâ€”in addition to OSHA and regulatory baselines. PDF or Office files; one active file per company (replaces any previous upload)."
    >
      {message ? (
        <div className="mb-4">
          <InlineMessage tone={messageTone}>{message}</InlineMessage>
        </div>
      ) : null}

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-300">
          Label (optional)
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Site safety plan addendum, exhibit A"
            disabled={authLoading || !canUpload || uploading}
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={[
            "rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
            dragActive ? "border-sky-400 bg-sky-500/15" : "border-slate-700/80 bg-slate-950/50",
            !canUpload || uploading ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
        >
          <p className="text-sm font-semibold text-slate-200">Drop a file here</p>
          <p className="mt-1 text-xs text-slate-500">or choose a file (max 40 MB)</p>
          <label className="mt-4 inline-block">
            <span className="cursor-pointer rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
              {uploading ? "Uploadingâ€¦" : "Choose file"}
            </span>
            <input
              type="file"
              className="hidden"
              disabled={authLoading || !canUpload || uploading}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loadingâ€¦</p>
        ) : pendingReview && !doc ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/35 bg-amber-950/40/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-amber-900">
                Submitted â€” awaiting review
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Your upload is pending review by a platform administrator. The file is hidden from this workspace
                until it is approved.
              </p>
              {submittedAt ? (
                <div className="mt-2 text-xs text-slate-400">
                  Submitted {new Date(submittedAt).toLocaleString()}
                </div>
              ) : null}
            </div>
            {canUpload ? (
              <button
                type="button"
                onClick={() => void removeDoc()}
                disabled={uploading}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/50 disabled:opacity-50"
              >
                Withdraw submission
              </button>
            ) : null}
          </div>
        ) : doc ? (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-100">On file</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">
                {doc.document_title || doc.file_name || "GC document"}
              </div>
              <div className="text-xs text-slate-400">
                {doc.file_name}
                {doc.created_at ? ` Â· ${new Date(doc.created_at).toLocaleString()}` : ""}
              </div>
            </div>
            {canUpload && !doc.final_file_path ? (
              <button
                type="button"
                onClick={() => void removeDoc()}
                disabled={uploading}
                className="shrink-0 rounded-lg border border-red-500/35 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/40 disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No GC-required document on file yet.</p>
        )}

        {!canUpload && !authLoading ? (
          <p className="text-xs text-slate-500">
            Your role can view this page but cannot upload. Ask a company admin or safety lead to add the GC document.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
```

