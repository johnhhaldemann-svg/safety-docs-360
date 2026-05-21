export type RiskActionRecommendationStatus =
  | "active"
  | "accepted"
  | "assigned"
  | "field_used"
  | "resolved"
  | "dismissed";

export type RiskActionPriority = "low" | "medium" | "high" | "critical";

export type RiskActionTargetModule =
  | "predictive_risk"
  | "field_issue"
  | "corrective_action"
  | "incident"
  | "permit"
  | "jsa"
  | "training"
  | "jobsite"
  | "risk_memory"
  | "command_center";

export type RiskActionEvidenceRef = {
  id: string;
  label: string;
  sourceModule: RiskActionTargetModule | string;
  sourceId?: string | null;
  href?: string | null;
  detail?: string | null;
};

export type RiskActionEvidencePackSummary = {
  generatedAt: string;
  days: number;
  jobsiteId: string | null;
  sourceCoverage: Array<{
    key: string;
    label: string;
    count: number;
    status: "connected" | "missing";
  }>;
  topDrivers: Array<{ label: string; count: number; percent?: number | null }>;
  topLocations: Array<{ id: string; label: string; riskScore: number; trendDelta: number }>;
  riskMemory: {
    facetCount: number;
    band: string | null;
    score: number | null;
    confidence: number | null;
  };
  memorySnippetCount: number;
  evidenceRefs: RiskActionEvidenceRef[];
};

export type RiskActionPlanDraft = {
  kind: string;
  title: string;
  body: string;
  confidence: number;
  priority: RiskActionPriority;
  targetModule: RiskActionTargetModule;
  targetHref: string;
  evidenceRefs: RiskActionEvidenceRef[];
};

export type RiskActionRecommendation = RiskActionPlanDraft & {
  id: string;
  status: RiskActionRecommendationStatus;
  ownerUserId: string | null;
  dueAt: string | null;
  createdAt: string;
  acceptedAt: string | null;
  fieldUsedAt: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
};

export type RiskActionPlanResponse = {
  recommendations: RiskActionRecommendation[];
  evidencePackSummary: RiskActionEvidencePackSummary;
  warnings: string[];
  mode: "rules" | "llm" | "both";
};
