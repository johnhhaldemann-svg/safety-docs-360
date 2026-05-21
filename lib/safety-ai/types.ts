export type SafetyRiskLevel = "low" | "moderate" | "high" | "critical";

export type SafetyAiConfidence = "low" | "medium" | "high";

export type RiskDriverCategory =
  | "severity"
  | "likelihood"
  | "exposure"
  | "controls"
  | "training"
  | "permit"
  | "corrective_action"
  | "inspection"
  | "data_quality";

export type RiskDriverImpact = "low" | "medium" | "high" | "critical";

export type SafetyRecommendationPriority = "low" | "medium" | "high" | "urgent";

export type SafetyControlType =
  | "elimination"
  | "substitution"
  | "engineering"
  | "administrative"
  | "ppe"
  | "competent_person_review";

export type SafetyOwnerRole =
  | "company_admin"
  | "safety_manager"
  | "field_supervisor"
  | "competent_person";

export type SafetySignalType =
  | "incident"
  | "near_miss"
  | "observation"
  | "inspection_failure"
  | "corrective_action"
  | "training_gap"
  | "permit_gap"
  | "high_risk_work"
  | "environment";

export type RiskDriver = {
  label: string;
  category: RiskDriverCategory;
  impact: RiskDriverImpact;
  explanation: string;
};

export type SafetyRecommendation = {
  title: string;
  priority: SafetyRecommendationPriority;
  controlType: SafetyControlType;
  reason: string;
  suggestedOwnerRole: SafetyOwnerRole;
};

export type SafetyAiSignal = {
  id?: string | null;
  type: SafetySignalType;
  label: string;
  hazard?: string | null;
  severity?: number | string | null;
  likelihood?: number | string | null;
  exposureFrequency?: number | string | null;
  controlGap?: number | string | null;
  status?: string | null;
  createdAt?: string | null;
  jobsiteId?: string | null;
  trade?: string | null;
  task?: string | null;
  crewSize?: number | null;
  highRisk?: boolean | null;
  imminentDanger?: boolean | null;
  fatalityOrCatastrophicPotential?: boolean | null;
  missingRequiredTraining?: boolean | null;
  missingRequiredPermit?: boolean | null;
  missingCompetentPersonReview?: boolean | null;
  overdueCorrectiveAction?: boolean | null;
};

export type SafetyAiInput = {
  jobsiteId?: string | null;
  jobsiteName?: string | null;
  location?: string | null;
  trade?: string | null;
  taskType?: string | null;
  equipment?: string[] | null;
  crewExposure?: number | null;
  highRiskWorkCategories?: string[];
  controlEffectiveness?: "missing" | "ineffective" | "partial" | "effective" | "unknown" | null;
  dataCompleteness?: number | null;
  missingData?: string[];
  signals?: SafetyAiSignal[];
  scores?: Partial<{
    severity: number;
    likelihood: number;
    exposureFrequency: number;
    controlGap: number;
    dataConfidenceConcern: number;
  }>;
  imminentDanger?: boolean | null;
  fatalityOrCatastrophicPotential?: boolean | null;
  missingRequiredTraining?: boolean | null;
  missingRequiredPermit?: boolean | null;
  missingCompetentPersonReview?: boolean | null;
  overdueCorrectiveActionForHazard?: boolean | null;
};

export type SafetyAiAssessment = {
  score: number;
  level: SafetyRiskLevel;
  confidence: SafetyAiConfidence;
  topDrivers: RiskDriver[];
  recommendations: SafetyRecommendation[];
  escalationRequired: boolean;
  stopWorkReviewRecommended: boolean;
  explanation: string;
  missingData: string[];
};

export type SafetyAiScoreBreakdown = {
  severity: number;
  likelihood: number;
  exposureFrequency: number;
  controlGap: number;
  dataConfidenceConcern: number;
  weightedAverage: number;
};
