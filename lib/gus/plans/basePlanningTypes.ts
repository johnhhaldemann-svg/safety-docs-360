import type { GusPlanStatus } from "@/lib/gus/gusTypes";

export type GusDraftDocumentType =
  | "safe_work_plan"
  | "jsa"
  | "permit_checklist"
  | "pretask_briefing";

export type GusPlanningQuestion = {
  id: string;
  prompt: string;
  helperText?: string;
  required: boolean;
};

export type GusChecklistItem = {
  id: string;
  label: string;
  helperText?: string;
};

export type GusWorkType = {
  id: string;
  label: string;
  description: string;
  commonHazards: string[];
  suggestedControls: string[];
  possiblePermits: string[];
  possibleTraining: string[];
  preStartInspections: string[];
  defaultReviewers: string[];
};

export type GusPlanValidationRule = {
  id: string;
  description: string;
  severity: "info" | "warning" | "critical";
};

export type GusPlanModule = {
  moduleId: string;
  displayName: string;
  description: string;
  triggerKeywords: string[];
  requiredQuestions: string[];
  hazardCategories: string[];
  commonControls: string[];
  possiblePermits: string[];
  possibleTrainingRequirements: string[];
  requiredReviewRoles: string[];
  stopWorkTriggers: string[];
  draftPlanSections: string[];
  validationRules: GusPlanValidationRule[];
};

export type GusPlanModuleEvaluationInput = {
  taskDescription: string;
  answers: Record<string, string>;
};

export type GusPlanModuleEvaluation = {
  moduleId: string;
  missingInformation: string[];
  draftOnlyRecommendations: string[];
  humanReviewRequired: true;
  requiredReviewRoles: string[];
  officialRecordCreated: false;
};

export type GusWorkTypeDetection = {
  id: string;
  displayName: string;
  confidence: number;
  kind: "module" | "planning_signal";
  matchedKeywords: string[];
  reason: string;
};

export type GusWorkTypeDetectionResult = {
  matches: GusWorkTypeDetection[];
  confidence: number;
  lowConfidence: boolean;
  clarificationQuestion?: string;
};

export type GusPlanningSessionInput = {
  workTypeId: string;
  taskDescription: string;
  jobsiteId?: string;
  jobsiteName?: string;
  crewTrade: string;
  equipmentToolsMaterials: string;
  questionAnswers: Record<string, string>;
  selectedHazards: string[];
  selectedControls: string[];
  requestedDraftDocuments: GusDraftDocumentType[];
};

export type GusDraftSafeWorkPlan = {
  planId: string;
  status: GusPlanStatus;
  title: string;
  summary: string;
  workType: GusWorkType;
  location: string;
  crewTrade: string;
  equipmentToolsMaterials: string;
  hazards: string[];
  controls: string[];
  possiblePermits: string[];
  possibleTraining: string[];
  preStartInspections: string[];
  environmentalConditions: string[];
  stopWorkTriggers: string[];
  emergencyResponseConsiderations: string[];
  missingInformation: string[];
  requiredReviewers: string[];
  requestedDraftDocuments: GusDraftDocumentType[];
  humanReviewRequired: true;
  officialRecordCreated: false;
};
