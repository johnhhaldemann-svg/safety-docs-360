export type ChecklistSurface = "csep" | "peshep";

export type ChecklistAppliesTo = ChecklistSurface | "both";

export type ChecklistRequirementType = "always" | "conditional" | "project_specific";

export type ChecklistCategory =
  | "Baseline"
  | "CompanyPolicy"
  | "WorkSpecificHSE"
  | "EnvGeneral"
  | "EnvRegulatory";

export type ChecklistAiAction = "validate" | "recommend" | "draft" | "manual_review";

export type ChecklistCoverageStatus =
  | "covered"
  | "partial"
  | "missing"
  | "needs_user_input"
  | "not_applicable";

export type ChecklistConfidence = "high" | "medium" | "low";

export type ChecklistTriggerMode = "always" | "keyword_any" | "field_truthy" | "field_list_nonempty";

export type ChecklistFieldRefs = {
  csep?: string[];
  peshep?: string[];
};

export type HseChecklistItem = {
  id: string;
  category: ChecklistCategory;
  item: string;
  appliesTo: ChecklistAppliesTo;
  requirementType: ChecklistRequirementType;
  outputSection: string;
  aiAction: ChecklistAiAction;
  requiredUserConfirmation: boolean;
  manualReviewDefault: boolean;
  requiredFields?: ChecklistFieldRefs;
  evidenceFields?: ChecklistFieldRefs;
  triggerMode?: ChecklistTriggerMode;
  triggerKeywords?: string[];
  triggerFields?: ChecklistFieldRefs;
};

export type ChecklistMatrixRow = {
  id: string;
  category: ChecklistCategory;
  item: string;
  appliesTo: ChecklistAppliesTo;
  requirementType: ChecklistRequirementType;
  outputSection: string;
  aiAction: ChecklistAiAction;
  requiredUserConfirmation: boolean;
  manualReviewNeeded: boolean;
  confidence: ChecklistConfidence;
  coverage: ChecklistCoverageStatus;
  currentFields: string[];
  missingFields: string[];
  notes: string[];
};

export type ChecklistEvaluationSummary = {
  total: number;
  covered: number;
  partial: number;
  missing: number;
  needsUserInput: number;
  manualReview: number;
};
