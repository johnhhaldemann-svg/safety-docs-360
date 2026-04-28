/**
 * Shared TypeScript types for safety dashboard analytics payloads.
 * No runtime data — definitions only.
 */

/** Normalized 0–100 percentage where applicable. */
export type Percent0to100 = number;

/** Traffic-light style used by engine health and similar indicators. */
export type TrafficLightStatus = "green" | "yellow" | "red";

/** Risk / priority band for categorization UI. */
export type RiskSeverityBand = "low" | "medium" | "high" | "critical";

/** Direction of change for a category or KPI. */
export type TrendDirection = "up" | "down" | "flat";

/** Optional severity filter for overview rollups. */
export type DashboardOverviewRiskLevel = "all" | "high" | "medium" | "low";

export type DashboardSummary = {
  /** Composite safety health indicator (scale defined by the producer API). */
  safetyHealthScore: number;
  openHighRiskItems: number;
  overdueCorrectiveActions: number;
  incidentCount: number;
  nearMissCount: number;
  /** Observed permit compliance as a percentage 0–100. */
  permitComplianceRate: Percent0to100;
  /** JSA / daily activity plan completion as a percentage 0–100. */
  jsaCompletionRate: Percent0to100;
  /** Training coverage or readiness vs requirements, 0–100. */
  trainingReadinessRate: Percent0to100;
  /** Document pipeline health vs expectations, 0–100. */
  documentReadinessRate: Percent0to100;
};

export type TrendPoint = {
  date: string;
  value: number;
  label?: string;
};

export type RiskCategory = {
  name: string;
  count: number;
  severity: RiskSeverityBand;
  trend: TrendDirection;
  recommendation: string;
};

export type ContractorRiskScore = {
  contractorName: string;
  riskScore: number;
  openItems: number;
  overdueItems: number;
  observations: number;
  incidents: number;
  /** 0–100 where the data source supports it. */
  trainingCompliance: Percent0to100;
  /** 0–100 where the data source supports it. */
  permitCompliance: Percent0to100;
};

export type CorrectiveActionStatus = {
  open: number;
  overdue: number;
  closed: number;
  /** Mean calendar days from open to closed; null if not computable. */
  averageDaysToClose: number | null;
};

/** One permit family or type bucket for compliance rollups. */
export type PermitCompliance = {
  permitType: string;
  required: number;
  completed: number;
  missing: number;
  /** 0–100; typically completed over required when there is required volume. */
  complianceRate: Percent0to100;
};

/** Document lifecycle and gap signals for the dashboard. */
export type DocumentReadiness = {
  draft: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
  missingRequired: number;
  expiringSoon: number;
};

export type EngineHealthItem = {
  moduleName: string;
  status: TrafficLightStatus;
  /** ISO 8601 timestamp of last check. */
  lastChecked: string;
  message: string;
  /** In-app route to investigate or fix (e.g. `/settings/...`). */
  route?: string;
};

/** Short narrative insight for the overview panel (rules-generated or curated; not required to be LLM output). */
export type DashboardAiInsight = {
  id: string;
  title: string;
  body: string;
  /** Optional link for drill-down. */
  href?: string;
};

export type DashboardPerformanceScore = {
  value: number;
  band: TrafficLightStatus;
  label: string;
  trend?: TrendDirection;
  contributors: Array<{
    key: string;
    label: string;
    score: number;
    weight: number;
    band: TrafficLightStatus;
  }>;
};

export type DashboardImprovementDriver = {
  id: string;
  title: string;
  detail: string;
  severity: RiskSeverityBand | "info";
  metric?: string;
  href?: string;
};

/** Sample row for overdue corrective follow-up UI (subset of corrective columns). */
export type OverdueCorrectiveSample = {
  id: string;
  category?: string | null;
  due_at?: string | null;
  observation_type?: string | null;
};

/** Repeated observation / hazard categories from corrective rows in the window. */
export type ObservationCategoryCount = {
  name: string;
  count: number;
};

/** Contractor credential timing signals (from compliance documents with expiry). */
export type CredentialGapSummary = {
  expiredCredentials: number;
  expiringSoonCredentials: number;
};

export type DashboardOverview = {
  summary: DashboardSummary;
  performanceScore?: DashboardPerformanceScore;
  improvementDrivers?: DashboardImprovementDriver[];
  incidentTrend: TrendPoint[];
  observationTrend: TrendPoint[];
  correctiveActionStatus: CorrectiveActionStatus;
  topRisks: RiskCategory[];
  contractorRiskScores: ContractorRiskScore[];
  permitCompliance: PermitCompliance[];
  documentReadiness: DocumentReadiness;
  engineHealth: EngineHealthItem[];
  aiInsights: DashboardAiInsight[];
  /** Open correctives past due_at (capped for dashboard display). */
  overdueCorrectiveSamples?: OverdueCorrectiveSample[];
  /** Top observation categories by volume in the selected window. */
  observationCategoryTop?: ObservationCategoryCount[];
  /** Expired vs soon-to-expire contractor credentials when doc rows exist. */
  credentialGaps?: CredentialGapSummary;
};
