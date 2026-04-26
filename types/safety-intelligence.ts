import type { CSEPProgramSelection } from "@/types/csep-programs";
import type { CSEPPricedItemSelection } from "@/types/csep-priced-items";
import type {
  CsepBuilderInstructions,
  CsepCoverageAudit,
  CsepDocumentControlFields,
  CsepFormatEntryKey,
  CsepFormatSectionKey,
} from "@/types/csep-builder";
import type {
  JurisdictionCode,
  JurisdictionPlanType,
} from "@/types/jurisdiction-standards";

export type SafetyIntelligenceDocumentType =
  | "jsa"
  | "csep"
  | "peshep"
  | "pshsep"
  | "permit"
  | "sop"
  | "work_plan"
  | "safety_narrative";

export type SafetyPlanDocumentType = "csep" | "pshsep";
export type ProjectDeliveryType = "ground_up" | "renovation";

export type HazardFamily =
  | "hot_work"
  | "fire"
  | "fumes"
  | "electrical"
  | "arc_flash"
  | "excavation"
  | "collapse"
  | "utility_strike"
  | "fall"
  | "overhead_work"
  | "line_of_fire"
  | "flammables"
  | "struck_by"
  | "weather"
  | "unknown";

export type PermitTriggerType =
  | "hot_work_permit"
  | "energized_electrical_permit"
  | "excavation_permit"
  | "confined_space_permit"
  | "lift_plan"
  | "elevated_work_notice"
  | "hot_work_exclusion_zone"
  | "none";

export type WeatherSensitivity = "low" | "medium" | "high";
export type ConflictSeverity = "low" | "medium" | "high" | "critical";
export type RiskBand = "low" | "moderate" | "high" | "critical";
export type TrainingScope = "trade" | "task" | "position" | "equipment";
export type RuleSourceType = "platform" | "company" | "jobsite" | "input";
export type RuleMergeBehavior = "extend" | "override" | "block";
export type ConflictSourceScope = "intra_document" | "external_jobsite";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type SafetyReferenceModuleContext = JsonObject & {
  title: string;
  moduleKey: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
  trade?: string | null;
  subTrade?: string | null;
  taskNames?: string[];
  matchedReasons?: string[];
};

export type SafetyPlanSiteMetadata = JsonObject & {
  taskModulePackKey?: string | null;
  taskModuleTitles?: string[];
  taskModules?: SafetyReferenceModuleContext[];
  hazardModulePackKey?: string | null;
  hazardModuleTitles?: string[];
  hazardModules?: SafetyReferenceModuleContext[];
  steelTaskModulePackKey?: string | null;
  steelTaskModuleTitles?: string[];
  steelTaskModules?: SafetyReferenceModuleContext[];
  steelHazardModulePackKey?: string | null;
  steelHazardModuleTitles?: string[];
  steelHazardModules?: SafetyReferenceModuleContext[];
  steelProgramModulePackKey?: string | null;
  steelProgramModuleTitles?: string[];
  steelProgramModules?: SafetyReferenceModuleContext[];
};

export type TradeLibraryEntry = {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  subTrades: Array<{
    code: string;
    name: string;
    description?: string | null;
  }>;
  taskTemplates: TaskTemplateDefinition[];
  equipmentUsed: string[];
  workConditions: string[];
  hazardFamilies: HazardFamily[];
  requiredControls: string[];
  permitTriggers: PermitTriggerType[];
  trainingRequirements: string[];
  metadata?: JsonObject;
};

export type TaskTemplateDefinition = {
  code: string;
  name: string;
  tradeCode?: string | null;
  subTradeCode?: string | null;
  equipmentUsed: string[];
  workConditions: string[];
  hazardFamilies: HazardFamily[];
  requiredControls: string[];
  permitTriggers: PermitTriggerType[];
  trainingRequirements: string[];
  weatherSensitivity: WeatherSensitivity;
  metadata?: JsonObject;
};

export type SafetyPlanOperationInput = {
  operationId: string;
  tradeCode?: string | null;
  tradeLabel?: string | null;
  subTradeCode?: string | null;
  subTradeLabel?: string | null;
  taskCode?: string | null;
  taskTitle: string;
  description?: string | null;
  equipmentUsed: string[];
  workConditions: string[];
  hazardHints: HazardFamily[];
  requiredControlHints: string[];
  permitHints: PermitTriggerType[];
  ppeHints: string[];
  workAreaLabel?: string | null;
  locationGrid?: string | null;
  locationLabel?: string | null;
  weatherConditionCode?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  crewSize?: number | null;
  metadata?: JsonObject;
};

export type SafetyPlanGenerationContext = {
  project: {
    projectName: string;
    projectNumber?: string | null;
    projectAddress?: string | null;
    ownerClient?: string | null;
    /**
     * GC / CM / program partners; each array entry is one organization or role label.
     * A legacy single string may still appear when hydrating older saved contexts.
     */
    gcCm?: string[] | string | null;
    contractorCompany?: string | null;
    contractorContact?: string | null;
    contractorPhone?: string | null;
    contractorEmail?: string | null;
  };
  scope: {
    trades: string[];
    subTrades: string[];
    tasks: string[];
    equipment: string[];
    location?: string | null;
    schedule?: {
      startAt?: string | null;
      endAt?: string | null;
      label?: string | null;
    };
  };
  operations: SafetyPlanOperationInput[];
  siteContext: {
    jobsiteId?: string | null;
    location?: string | null;
    workConditions: string[];
    siteRestrictions: string[];
    simultaneousOperations: string[];
    weather?: {
      conditionCode?: string | null;
      summary?: string | null;
    };
    metadata?: SafetyPlanSiteMetadata;
  };
  programSelections?: CSEPProgramSelection[];
  pricedAttachments?: CSEPPricedItemSelection[];
  builderInstructions?: CsepBuilderInstructions | null;
  documentProfile: {
    documentType: SafetyPlanDocumentType;
    projectDeliveryType: ProjectDeliveryType;
    requestedLabel?: string | null;
    title?: string | null;
    companyId?: string | null;
    jobsiteId?: string | null;
    governingState?: string | null;
    jurisdictionCode?: JurisdictionCode | null;
    jurisdictionLabel?: string | null;
    jurisdictionPlanType?: JurisdictionPlanType | null;
    jurisdictionStandardsApplied?: string[];
    source: "builder_submit" | "csep_preview" | "api" | "legacy_adapter";
  };
  legacyFormSnapshot: JsonObject;
};

export type RawTaskInput = {
  companyId: string;
  jobsiteId?: string | null;
  sourceModule: "manual" | "company_jsa_activity" | "company_permit" | "company_incident";
  sourceId?: string | null;
  operationId?: string | null;
  tradeCode?: string | null;
  subTradeCode?: string | null;
  taskCode?: string | null;
  taskTitle: string;
  description?: string | null;
  equipmentUsed?: string[];
  workConditions?: string[];
  hazardFamilies?: HazardFamily[];
  hazardCategories?: string[];
  requiredControls?: string[];
  permitTriggers?: PermitTriggerType[];
  ppeRequirements?: string[];
  trainingRequirementCodes?: string[];
  siteRestrictions?: string[];
  prohibitedEquipment?: string[];
  workAreaLabel?: string | null;
  locationGrid?: string | null;
  weatherConditionCode?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  crewSize?: number | null;
  metadata?: JsonObject;
};

export type BucketedWorkItem = {
  bucketKey: string;
  bucketType: "task_execution" | "permit_context" | "incident_signal";
  companyId: string;
  jobsiteId?: string | null;
  operationId?: string | null;
  taskTitle: string;
  tradeCode?: string | null;
  subTradeCode?: string | null;
  taskCode?: string | null;
  workAreaLabel?: string | null;
  locationGrid?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  weatherConditionCode?: string | null;
  equipmentUsed: string[];
  workConditions: string[];
  siteRestrictions: string[];
  prohibitedEquipment: string[];
  hazardFamilies: HazardFamily[];
  permitTriggers: PermitTriggerType[];
  requiredControls: string[];
  ppeRequirements: string[];
  trainingRequirementCodes: string[];
  payload: JsonObject;
  source: {
    module: RawTaskInput["sourceModule"];
    id?: string | null;
  };
};

export type RuleSelector = {
  tradeCodes?: string[];
  subTradeCodes?: string[];
  taskCodes?: string[];
  taskKeywords?: string[];
  equipmentTokens?: string[];
  workConditionTokens?: string[];
  locationTokens?: string[];
  weatherTokens?: string[];
  scheduleLabels?: string[];
};

export type RuleOutputSet = {
  permitTriggers?: PermitTriggerType[];
  ppeRequirements?: string[];
  requiredControls?: string[];
  hazardFamilies?: HazardFamily[];
  hazardCategories?: string[];
  siteRestrictions?: string[];
  prohibitedEquipment?: string[];
  trainingRequirements?: string[];
  weatherRestrictions?: string[];
  equipmentChecks?: string[];
};

export type RuleTemplateRecord = {
  id?: string | null;
  code: string;
  label: string;
  sourceType: RuleSourceType;
  sourceId?: string | null;
  precedence: number;
  version: string;
  mergeBehavior: RuleMergeBehavior;
  selectors: RuleSelector;
  outputs: RuleOutputSet;
  metadata?: JsonObject;
};

export type RulesFinding = {
  code: string;
  label: string;
  severity: ConflictSeverity;
  detail: string;
  requirementType:
    | "permit_trigger"
    | "hazard_family"
    | "hazard_category"
    | "ppe_requirement"
    | "equipment_check"
    | "weather_restriction"
    | "required_control"
    | "training_requirement"
    | "site_restriction"
    | "prohibited_equipment";
  requirementCode?: string | null;
  sourceType?: RuleSourceType;
  sourceRuleCode?: string | null;
  metadata?: JsonObject;
};

export type RulesEvaluation = {
  bucketKey: string;
  operationId?: string | null;
  findings: RulesFinding[];
  permitTriggers: PermitTriggerType[];
  hazardFamilies: HazardFamily[];
  hazardCategories: string[];
  ppeRequirements: string[];
  equipmentChecks: string[];
  weatherRestrictions: string[];
  requiredControls: string[];
  siteRestrictions: string[];
  prohibitedEquipment: string[];
  trainingRequirements: string[];
  score: number;
  band: RiskBand;
  evaluationVersion: string;
  sourceBreakdown?: Array<{
    sourceType: RuleSourceType;
    sourceId?: string | null;
    ruleCodes: string[];
  }>;
};

export type ResolvedRuleSet = RulesEvaluation;

export type SafetyReviewDomain = "permit" | "training" | "ppe";

export type SafetyReviewGapCode =
  | "permit_missing"
  | "training_missing"
  | "ppe_missing"
  | "permit_removed_by_override"
  | "training_removed_by_override"
  | "ppe_removed_by_override";

export type SafetyReviewSource = "platform" | "company" | "live";

export type SafetyReviewGap = {
  code: SafetyReviewGapCode;
  domain: SafetyReviewDomain;
  severity: ConflictSeverity;
  detail: string;
  expectedValues: string[];
  currentValues: string[];
};

export type SafetyReviewAction = {
  domain: SafetyReviewDomain;
  label: string;
  href: string;
};

export type SafetyReviewRow = {
  id: string;
  source: SafetyReviewSource;
  scope: "company" | "jobsite";
  jobsiteId?: string | null;
  sourceLabel: string;
  taskTitle: string;
  tradeCode?: string | null;
  subTradeCode?: string | null;
  taskCode?: string | null;
  workAreaLabel?: string | null;
  permitTriggers: PermitTriggerType[];
  trainingRequirements: string[];
  ppeRequirements: string[];
  expectedPermitTriggers: PermitTriggerType[];
  expectedTrainingRequirements: string[];
  expectedPpeRequirements: string[];
  applicableTrainingMatrixCodes: string[];
  gaps: SafetyReviewGap[];
  actions: SafetyReviewAction[];
  score: number;
  band: RiskBand;
  sourceBreakdown?: RulesEvaluation["sourceBreakdown"];
};

export type SafetyReviewPayload = {
  scope: "company" | "jobsite";
  jobsiteId?: string | null;
  rowCount: number;
  summary: {
    totalGaps: number;
    permitGaps: number;
    trainingGaps: number;
    ppeGaps: number;
  };
  rows: SafetyReviewRow[];
  warning?: string | null;
};

export type ConflictMatrixItem = {
  code: string;
  type:
    | "trade_vs_trade"
    | "task_vs_task"
    | "location_overlap"
    | "schedule_overlap"
    | "weather_sensitive"
    | "permit_conflict"
    | "hazard_propagation";
  severity: ConflictSeverity;
  sourceScope: ConflictSourceScope;
  rationale: string;
  operationIds: string[];
  relatedBucketKeys: string[];
  requiredMitigations: string[];
  permitDependencies: string[];
  resequencingSuggestion?: string | null;
  metadata?: JsonObject;
};

export type ConflictEvaluation = {
  bucketKey: string;
  operationId?: string | null;
  conflicts: Array<{
    code: string;
    type:
      | "trade_vs_trade"
      | "task_vs_task"
      | "location_overlap"
      | "time_overlap"
      | "weather_sensitive"
      | "permit_conflict"
      | "hazard_propagation";
    severity: ConflictSeverity;
    rationale: string;
    relatedBucketKeys: string[];
    recommendedControls: string[];
    metadata?: JsonObject;
  }>;
  score: number;
  band: RiskBand;
  matrix?: ConflictMatrixItem[];
};

export type ConflictMatrix = {
  items: ConflictMatrixItem[];
  score: number;
  band: RiskBand;
  intraDocumentConflictCount: number;
  externalConflictCount: number;
};

export type GeneratedSafetyPlanSection = {
  key: string;
  title: string;
  order?: number | null;
  kind?: "front_matter" | "main" | "appendix" | "gap" | null;
  numberLabel?: string | null;
  parentSectionKey?: CsepFormatEntryKey | string | null;
  appendixKey?: string | null;
  layoutKey?: string | null;
  summary?: string | null;
  body?: string | null;
  bullets?: string[];
  subsections?: Array<{
    title: string;
    body?: string | null;
    bullets: string[];
  }>;
  table?: {
    columns: string[];
    rows: string[][];
  } | null;
};

export type SafetyPlanTrainingProgramRow = {
  operationId: string;
  tradeCode?: string | null;
  tradeLabel?: string | null;
  subTradeCode?: string | null;
  subTradeLabel?: string | null;
  taskCode?: string | null;
  taskTitle: string;
  trainingCode: string;
  trainingTitle: string;
  matchKeywords: string[];
  sourceLabels: string[];
  whySource: string;
};

export type SafetyPlanTrainingProgram = {
  rows: SafetyPlanTrainingProgramRow[];
  summaryTrainingTitles: string[];
};

export type CsepAiAssemblyDecisions = {
  frontMatterGuidance?: string | null;
  coverageGuidance?: string | null;
  sectionDecisions?: Partial<Record<CsepFormatSectionKey, string>>;
  decisionSource?: string | null;
};

export type SteelErectionPlan = {
  onSiteTeam?: Array<{ name: string; role: string; phone?: string }>;
  offSiteTeam?: Array<{ name: string; role: string; phone?: string }>;
  fallProtection?: {
    tieOffPolicy?: string;
    leadingEdgeRule?: string;
    srlType?: string;
    hllRequired?: boolean;
    hllNotes?: string;
    cdzUsed?: boolean;
    perimeterCable?: boolean;
    perimeterCableHeights?: { topRail?: string; midRail?: string };
    flaggingInterval?: string;
    deckingRules?: string[];
    detailingRules?: string[];
  };
  fallRescue?: {
    emergencyCallText?: string;
    siteAccessInstructions?: string;
    notifyRoles?: string[];
    primaryRescueMethod?: string;
    secondaryRescueMethod?: string;
    rescueEquipment?: string[];
    /** PPE for authorized rescuers during fall rescue (separate from general task PPE). */
    rescuePpe?: string[];
    ladderStaged?: boolean;
    targetRescueTime?: string;
    suspensionTraumaRelief?: boolean;
    dailyReviewRequired?: boolean;
  };
  openingsAndPerimeters?: {
    coverRequiredAtOrAbove?: string;
    coverMarking?: string;
    coverLoadRequirement?: string;
    coverSecurement?: string;
    perimeterProtection?: string;
  };
  hazardMatrix?: Array<{
    activity: string;
    hazards: string[];
    controls: string[];
    ppe?: string[];
    permits?: string[];
    competency?: string[];
  }>;
  /**
   * When tasks are excluded from the matrix (e.g. punch list, embeds not in field scope), brief field-facing notes.
   */
  hazardMatrixScopeNotes?: string[];
  trainingAndCompetency?: {
    orientationRequired?: boolean;
    orientationSchedule?: string;
    requiredTraining?: string[];
    retrainingRules?: string[];
    attachmentRefs?: string[];
    competentPersons?: Array<{ name: string; title: string; phone?: string; quals?: string[] }>;
  };
  fallingObjectControl?: {
    barricadeType?: string;
    signageSpacing?: string;
    accessRestriction?: string;
  };
  workAttireAndTesting?: {
    attireRules?: string[];
    /** Minimum project PPE for steel—listed separately from clothing (see ppeList). */
    ppeList?: string[];
    drugTestingRules?: string[];
  };
  erectionExecution?: {
    siteAccessPlan?: string;
    laydownPlan?: string;
    erectionSequence?: string;
    cranePlan?: Array<{ area?: string; crane?: string; boom?: string; radius?: string; heaviestPick?: string }>;
    hoistingInspectionRule?: string;
    undergroundUtilityReview?: string;
    overheadLiftPlanning?: string[];
    alignmentAndStability?: string[];
    columnBeamReleaseCriteria?: string[];
    fastenerRequirements?: string[];
    falseworkRequired?: string;
    inspectionTestingPlan?: string[];
    attachmentRefs?: string[];
  };
};

export type GeneratedSafetyPlanDraft = {
  documentType: SafetyPlanDocumentType;
  projectDeliveryType: ProjectDeliveryType;
  title: string;
  documentControl?: Partial<CsepDocumentControlFields> | null;
  aiAssemblyDecisions?: CsepAiAssemblyDecisions | null;
  steelErectionPlan?: SteelErectionPlan | null;
  projectOverview: {
    projectName: string;
    projectNumber?: string | null;
    projectAddress?: string | null;
    ownerClient?: string | null;
    /** GC / CM / program partners (one string per organization). Legacy drafts may still store a single string. */
    gcCm?: string[] | string | null;
    contractorCompany?: string | null;
    schedule?: string | null;
    location?: string | null;
  };
  operations: Array<{
    operationId: string;
    tradeCode?: string | null;
    tradeLabel?: string | null;
    subTradeCode?: string | null;
    subTradeLabel?: string | null;
    taskTitle: string;
    workAreaLabel?: string | null;
    locationGrid?: string | null;
    equipmentUsed: string[];
    workConditions: string[];
    hazardCategories: string[];
    permitTriggers: string[];
    ppeRequirements: string[];
    requiredControls: string[];
    siteRestrictions: string[];
    prohibitedEquipment: string[];
    conflicts: string[];
  }>;
  ruleSummary: {
    permitTriggers: string[];
    ppeRequirements: string[];
    requiredControls: string[];
    hazardCategories: string[];
    siteRestrictions: string[];
    prohibitedEquipment: string[];
    trainingRequirements: string[];
    weatherRestrictions: string[];
  };
  conflictSummary: {
    total: number;
    intraDocument: number;
    external: number;
    highestSeverity: ConflictSeverity | "none";
    items: ConflictMatrixItem[];
  };
  riskSummary: {
    score: number;
    band: RiskBand;
    priorities: string[];
  };
  trainingProgram: SafetyPlanTrainingProgram;
  narrativeSections: Record<string, string>;
  sectionMap: GeneratedSafetyPlanSection[];
  coverageAudit?: CsepCoverageAudit | null;
  builderSnapshot?: JsonObject | null;
  provenance: JsonObject;
};

export type PreventionScore = {
  value: number;
  scale: "0-100";
  band: RiskBand;
  confidence?: number;
  source: "risk_memory" | "rules" | "blended";
};

export type RiskOutputRecord = {
  summary: string;
  exposures: string[];
  missingControls: string[];
  trendPatterns: string[];
  riskScores: Array<{
    scope: string;
    score: number;
    band: RiskBand;
  }>;
  forecastConflicts: string[];
  correctiveActions: string[];
  /** Normalized 0–100 headline aligned with Risk Memory rollup when facet data exists. */
  preventionScore?: PreventionScore | null;
  /** Canonical rollup from Risk Memory (authoritative when present). */
  canonicalRiskFromMemory?: { score: number; band: RiskBand; confidence?: number } | null;
  /** Explains how riskScores relate to canonical rollup. */
  riskScoresNote?: string | null;
};

/** Smart Safety diagram: structured thematic memory (incrementally populated). */
export const SAFETY_MEMORY_SNAPSHOT_VERSION = 1 as const;

export type SafetyMemoryBucketSlice = {
  refs: string[];
  notes?: string | null;
};

export type SafetyMemorySnapshot = {
  version: typeof SAFETY_MEMORY_SNAPSHOT_VERSION;
  generatedAt: string;
  company: SafetyMemoryBucketSlice & { companyId: string };
  jobsite: SafetyMemoryBucketSlice & { jobsiteId?: string | null };
  trade: { codes: string[]; labels?: string[] };
  hazard: { families: HazardFamily[]; categories: string[] };
  task: { titles: string[]; taskCodes: string[] };
  permit: { triggers: PermitTriggerType[] };
  training: { requirementCodes: string[] };
  incident: { signalCount: number; sourceModules: string[] };
  documentQuality: { hints: string[] };
};

/** Deterministic “prevention logic” layer before LLM (diagram 3A). */
export type PreventionLogicResult = {
  missingControls: string[];
  permitRecommendations: string[];
  trainingGaps: string[];
  repeatRiskPatterns: string[];
  documentQualityHints: string[];
};

export type SmartSafetyEngineProvenance = {
  version: string;
  stages: string[];
  inputHash: string;
};

export type DailyRiskBriefingLine = {
  label: string;
  detail: string;
  severity?: "info" | "watch" | "elevated";
};

export type DailyRiskBriefing = {
  generatedAt: string;
  companyId: string;
  jobsiteId?: string | null;
  headline: string;
  lines: DailyRiskBriefingLine[];
  preventionScore?: PreventionScore | null;
};

export type PreTaskChecklistItem = {
  id: string;
  text: string;
  source: "rule" | "permit" | "weather" | "memory" | "conflict";
  required: boolean;
};

export type AiReviewContext = {
  companyId: string;
  jobsiteId?: string | null;
  bucketRunId?: string | null;
  documentType?: SafetyIntelligenceDocumentType | null;
  buckets: BucketedWorkItem[];
  rulesEvaluations: RulesEvaluation[];
  conflictEvaluations: ConflictEvaluation[];
  riskMemorySummary?: JsonObject | null;
  companyContext?: JsonObject | null;
  templateContext?: JsonObject | null;
  safetyMemorySnapshot?: SafetyMemorySnapshot | null;
  preventionLogic?: PreventionLogicResult | null;
  smartSafetyProvenance?: SmartSafetyEngineProvenance | null;
  /** Company memory excerpts when SAFETY_INTELLIGENCE_RAG=1. */
  ragMemoryExcerpts?: Array<{ title: string; excerpt: string }> | null;
};

export type DocumentGenerationRequest = {
  reviewContext: AiReviewContext;
  documentType: SafetyIntelligenceDocumentType;
  title?: string | null;
};

export type DocumentRenderRequest = {
  generatedDocumentId?: string | null;
  draft?: GeneratedSafetyPlanDraft | null;
  legacyPayload?: JsonObject | null;
  documentType?: SafetyIntelligenceDocumentType | null;
};

export type GeneratedDocumentRecord = {
  documentType: SafetyIntelligenceDocumentType;
  title: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  htmlPreview: string;
  draftJson: JsonObject;
  provenance: JsonObject;
};

export type RiskIntelligenceRequest = {
  reviewContext: AiReviewContext;
};

export type SafetyIngestionSourceType =
  | "sor"
  | "jsa"
  | "incident_report"
  | "corrective_action"
  | "permit"
  | "observation"
  | "other";

export type StandardSeverity = "low" | "medium" | "high" | "critical";
export type SafetyIngestionValidationStatus = "accepted" | "rejected";
export type SafetyIngestionInsertStatus = "pending" | "inserted" | "skipped" | "failed";

export type SafetyIntakeValidationError = {
  field: string;
  code: string;
  message: string;
};

export type NormalizedSafetyIntakeRecord = {
  companyId: string;
  jobsiteId?: string | null;
  sourceType: SafetyIngestionSourceType;
  sourceRecordId?: string | null;
  title: string;
  summary?: string | null;
  description?: string | null;
  severity: StandardSeverity;
  trade?: string | null;
  category?: string | null;
  sourceCreatedAt: string;
  eventAt?: string | null;
  reportedAt?: string | null;
  dueAt?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  payload: JsonObject;
  metadata: JsonObject;
};

export type PreparedSafetyIntake = {
  companyId: string;
  jobsiteId?: string | null;
  sourceType: SafetyIngestionSourceType;
  sourceRecordId?: string | null;
  rawPayloadHash: string;
  validationStatus: SafetyIngestionValidationStatus;
  validationErrors: SafetyIntakeValidationError[];
  removedCompanyTokens: string[];
  sanitizedPayload: JsonObject;
  normalizedRecord: NormalizedSafetyIntakeRecord | null;
};

export type SafetyDataBucketRecord = {
  id: string;
  companyId: string;
  jobsiteId?: string | null;
  ingestionAuditLogId: string;
  sourceType: SafetyIngestionSourceType;
  sourceRecordId?: string | null;
  title: string;
  summary?: string | null;
  description?: string | null;
  severity: StandardSeverity;
  trade?: string | null;
  category?: string | null;
  sourceCreatedAt: string;
  eventAt?: string | null;
  reportedAt?: string | null;
  dueAt?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  rawPayloadHash: string;
  removedCompanyTokens: string[];
  sanitizedPayload: JsonObject;
  normalizedPayload: JsonObject;
  aiReady: boolean;
};

export type IngestionAuditLogRecord = {
  id: string;
  companyId: string;
  jobsiteId?: string | null;
  sourceType: SafetyIngestionSourceType;
  sourceRecordId?: string | null;
  validationStatus: SafetyIngestionValidationStatus;
  insertStatus: SafetyIngestionInsertStatus;
  validationErrors: SafetyIntakeValidationError[];
  rawPayloadHash: string;
  sanitizedPayload: JsonObject;
  removedCompanyTokens: string[];
  bucketId?: string | null;
  insertError?: string | null;
  actorUserId?: string | null;
  receivedAt: string;
  processedAt?: string | null;
};
