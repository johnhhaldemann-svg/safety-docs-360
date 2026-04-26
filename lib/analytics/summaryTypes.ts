/** Shared shapes for `/api/company/analytics/summary` and the Risk Trends UI. */

export type AnalyticsSummary = {
  totals?: {
    correctiveActions?: number;
    incidents?: number;
    permits?: number;
    daps?: number;
    dapActivities?: number;
  };
  closureTimes?: {
    averageHours?: number;
    sampleSize?: number;
  };
  topHazardCategories?: Array<{ category: string; count: number }>;
  observationTrends?: Array<{ date: string; count: number }>;
  sifDashboard?: {
    potentialCount: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  jobsiteRiskScore?: Array<{
    jobsiteId: string;
    score: number;
    incidents: number;
    sif: number;
    stopWork: number;
    overdue: number;
  }>;
  companyDashboard?: {
    totalActiveJobsites?: number;
    totalOpenObservations?: number;
    totalHighRiskObservations?: number;
    sifCount?: number;
    averageClosureTimeHours?: number;
    openIncidents?: number;
    observationPriorityBands?: { high: number; medium: number; low: number };
    dapCompletionToday?: { completed: number; total: number; percent: number };
  };
  safetyLeadership?: {
    trendOfObservationsByWeek: Array<{ week: string; count: number }>;
    positiveNegativeObservationRatio: { positive: number; negative: number; ratio: number };
  };
  recentReports?: Array<{ id: string; title: string; tag: string }>;
  observationBreakdown?: {
    nearMiss: number;
    hazard: number;
    positive: number;
    other: number;
    inspections: number;
    daps: number;
  };
  riskHeatmap?: {
    rowLabels: string[];
    colLabels: string[];
    cells: number[][];
    max: number;
  };
  benchmarking?: {
    industryCode: string | null;
    industryInjuryRate: number | null;
    tradeInjuryRate: number | null;
    hoursWorked: number | null;
    incidentsForRate: number;
    incidentRate: number | null;
    industryBenchmarkRates?: {
      naicsPrefix: string;
      recordableCasesPer200kHours: number | null;
      dartCasesPer200kHours: number | null;
      fatalityPer200kHours: number | null;
      sourceNote: string;
      injuryFactsIndustryProfilesUrl: string;
      injuryFactsIncidentTrendsUrl: string;
      historicalTrendSummary: string;
      referenceDataNote: string;
      unitEquivalenceNote: string;
    };
  };
  injuryAnalytics?: {
    averageSeverityScore: number;
    severitySampleSize: number;
    sorToInjuryRatio: number | null;
    sorCount: number;
    injuryIncidentCount: number;
    observationToInjuryConversionRate: number | null;
    injuryPredictionModelUrl: string;
  };
  riskMemory?: {
    engine: string;
    windowDays: number;
    facetCount: number;
    topScopes: Array<{ code: string | null; count: number }>;
    topHazards: Array<{ code: string | null; count: number }>;
    openCorrectiveFacetHints: { openStyleStatuses: number };
    aggregated: {
      score: number;
      band: string;
      sampleSize: number;
      baselineContribution: number;
    };
    baselineHints: Array<{
      scope_code: string;
      hazard_code: string;
      signals: Record<string, unknown>;
    }>;
    aggregatedWithBaseline: { score: number; band: string };
    topLocationGrids?: Array<{ label: string; count: number }>;
    topLocationAreas?: Array<{ label: string; count: number }>;
    derivedRollupConfidence?: number;
  } | null;
  riskMemoryRecommendations?: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    confidence: number;
    created_at: string;
  }>;
  riskMemoryTrend?: {
    points: Array<{ date: string; score: number; band: string; windowDays: number }>;
    latest: { date: string; score: number; band: string } | null;
    earliest: { date: string; score: number; band: string } | null;
    deltaScore: number | null;
    direction: "up" | "down" | "flat" | null;
  };
  /** Injury-type counts for category `incident` in the selected window (excludes forecaster-synthetic rows). */
  healthIssueRollup?: Array<{ injuryType: string; label: string; count: number }>;
  /** Present when `injuryType` query param matches rollup data. */
  healthIssueFocus?: {
    injuryType: string;
    label: string;
    count: number;
    severityBands: { high: number; medium: number; low: number };
    recentItems: Array<{ id: string; title: string; created_at: string; severity: string | null }>;
  };
};

export type LikelyInjuryInsightPayload = {
  headline: string;
  secondaryLine: string | null;
  detailNote: string;
  hasData: boolean;
};

export type AnalyticsTabId =
  | "overview"
  | "near_misses"
  | "hazards"
  | "inspections"
  | "health_issues";

export type AnalyticsFocusTabId = Exclude<AnalyticsTabId, "overview" | "health_issues">;
