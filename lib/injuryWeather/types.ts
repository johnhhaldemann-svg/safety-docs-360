import type { InjuryType } from "@/lib/incidents/injuryType";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

/** Derived from incident injury/exposure fields in the current signal window. */
export type LikelyInjuryInsight = {
  headline: string;
  secondaryLine: string | null;
  detailNote: string;
  hasData: boolean;
};

/** Named inputs to `predictedRisk` (six-factor product). See `computePredictedRiskProduct` in `riskModel.ts`. */
export type PredictedRiskFactors = {
  historicalBaseline: number;
  seasonalFactor: number;
  realTimeBehaviorFactor: number;
  /** Weekly hours vs a 5×8h reference week; 1 when schedule inputs are absent or match baseline. */
  scheduleExposureFactor: number;
  siteConditionFactor: number;
  weatherFactor: number;
};

/**
 * Optional site schedule for exposure / fatigue — likelihood path only (not raw signal counts).
 * Compares weekly hours to a 40h reference (5 days × 8h).
 */
export type WorkScheduleInputs = {
  workSevenDaysPerWeek: boolean;
  /** Typical shift length; null = use 8 when computing weekly hours from day count. */
  hoursPerDay: number | null;
};

/**
 * Dashboard headline metrics — intentionally split:
 * - `structuralRiskScore`: leading-indicator composite (no weather).
 * - `increasedIncidentRiskPercent`: next-~30-day **likelihood index** (structural × weather); not a calibrated probability.
 * - `predictedInjuriesNextMonth`: **projected case estimate** for prioritization; not equated with structural score.
 */
/** How strongly signal density in the latest snapshot supports the headline estimate (not the same axis as `overallRiskLevel`). */
export type DataConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

/**
 * `baseline_only` — no signal rows in scope: `predictedRisk` = baseline × monthly × trade only.
 * `live_adjusted` — at least one row in the daily snapshot: adds behavior (incl. schedule) and weather to the product.
 * (Name is historical; UI should use `forecastModeDisplayLabel` — data is refreshed on a schedule, not a live stream.)
 */
export type InjuryWeatherForecastMode = "baseline_only" | "live_adjusted";

/**
 * User-selected scope for a forecast run (evidence pack / MasterEvidencePack `ForecastContext`).
 * Aligns with `docs/AIInjuryForecastSystem.md` section 5.1.
 */
export type ForecastContext = {
  selectedMonth: string;
  selectedState: string;
  selectedProject?: string;
  selectedTrades: string[];
  forecastWindowDays: number;
  hoursWorked?: number;
};

/**
 * Deterministic outputs from each engine in `docs/AIInjuryForecastSystem.md` section 4.
 * Component shapes are filled incrementally; use `Record<string, unknown>` until fields are modeled.
 */
export type BaselineEvidence = Record<string, unknown>;
export type LossPressureEvidence = Record<string, unknown>;
export type LeadingIndicatorEvidence = Record<string, unknown>;
export type EnvironmentalEvidence = Record<string, unknown>;
export type ExposureEvidence = Record<string, unknown>;
export type ControlEffectivenessEvidence = Record<string, unknown>;
export type PatternAlignmentEvidence = Record<string, unknown>;
export type ConfidenceEvidence = Record<string, unknown>;

export type DeterministicEvidence = {
  baselineEvidence: BaselineEvidence;
  lossPressureEvidence: LossPressureEvidence;
  leadingIndicatorEvidence: LeadingIndicatorEvidence;
  environmentalEvidence: EnvironmentalEvidence;
  exposureEvidence: ExposureEvidence;
  controlEffectivenessEvidence: ControlEffectivenessEvidence;
  patternAlignmentEvidence: PatternAlignmentEvidence;
  confidenceEvidence: ConfidenceEvidence;
};

/**
 * Structured AI review output (`docs/AIInjuryForecastSystem.md` section 6.4).
 * String literals are model-facing labels — not the same as internal `RiskLevel` / `InjuryWeatherForecastMode`.
 */
export type AIFinalPrediction = {
  predictedRiskLevel: "Low" | "Moderate" | "Elevated" | "High" | "Critical";
  predictedRiskScoreBand: string;
  likelyInjuryType: string;
  secondaryLikelyInjuryType?: string;
  confidenceLevel: "Low" | "Medium" | "High";
  forecastMode:
    | "BaselineOnly"
    | "BaselinePlusSignals"
    | "StrongSignalForecast"
    | "LimitedDataForecast";
  topRiskDrivers: string[];
  topProtectiveDrivers: string[];
  explanationNarrative: string;
  whyThisMonthMatters: string;
  whyThisTradeMixMatters: string;
  whyCurrentSignalsMatter: string;
  criticalUnknowns: string[];
  recommendedActions: string[];
  recommendedInspectionFocus: string[];
};

/** V2 normalized signal row (SOR trade primary; category inference only as fallback). */
export type NormalizedLiveSignalRow = {
  tradeId: string;
  tradeLabel: string;
  categoryId: string | null;
  categoryLabel: string;
  severity: "low" | "medium" | "high" | "critical";
  created_at: string;
  source: "sor" | "corrective_action" | "incident";
  status?: "open" | "closed";
  usedCategoryInference?: boolean;
  /** Incident rows: derived from `occurred_at` UTC when present. */
  injuryMonth?: number | null;
  injurySeason?: string | null;
  injuryDayOfWeek?: string | null;
  injuryTimeOfDay?: string | null;
  /** Incident rows: when set on `company_incidents`. */
  injuryType?: InjuryType | null;
  exposureEventType?: string | null;
};

/** Defensible breakdown for exports, UI, and AI grounding — numeric score is model-authored, not LLM. */
export type RiskEngineV2Explainability = {
  riskEngineVersion: string;
  includedRowCount: number;
  excludedRowCount: number;
  tradeNormalizationSummary: string;
  sourceMix: { sor: number; corrective_action: number; incident: number };
  leadingIndicatorWeightedScore: number;
  correctivePressureScore: number;
  laggingIndicatorScore: number;
  severityMix: { low: number; medium: number; high: number; critical: number };
  weightedTotals: {
    sourceFactorMass: number;
    severityFactorMass: number;
    recencyFactorMass: number;
    seasonalityFactorMass: number;
    rowRiskScoreSum: number;
  };
  componentScoresRaw: {
    totalSignalScore: number;
    highSeveritySignalScore: number;
    incidentPressureScore: number;
    recurrenceScore: number;
    unresolvedCorrectiveActionScore: number;
  };
  componentScoresScaled: {
    totalSignalScore: number;
    highSeveritySignalScore: number;
    incidentPressureScore: number;
    recurrenceScore: number;
    unresolvedCorrectiveActionScore: number;
  };
  recentTrendSlope: number;
  daysSinceLastIncident: number | null;
  tradeCategoryRepeatClusters: number;
  finalRiskScore: number;
  bandLabel: "Low" | "Moderate" | "High" | "Severe";
  /** 0–1 heuristic from row volume, recurrence, and incident presence — not statistical power. */
  modelConfidenceHint: number;
  /** Share of total `rowRiskScore` mass by source (sums to ~1 when scored rows exist). */
  sourceRiskScoreShare: { sor: number; corrective_action: number; incident: number };
  /** Average per-row recency multiplier (for explainability). */
  meanRecencyWeight: number;
  /** Average per-row seasonality multiplier vs forecast month. */
  meanSeasonalityWeight: number;
};

export type DashboardSummary = {
  month: string;
  /** Rows included after trade-ID filter (not weighted mass). */
  riskSignalCount: number;
  /** Count of high + critical severity rows in the included set. */
  highSeveritySignalCount: number;
  /** V2 weighted 0–100 headline score (defensible blend). */
  finalRiskScore?: number;
  /** V2 band label before mapping to `overallRiskLevel`. */
  riskBandLabelV2?: "Low" | "Moderate" | "High" | "Severe";
  /** Projected case-load style count (next ~30 days); illustrative until calibrated against outcomes. */
  predictedInjuriesNextMonth: number;
  /**
   * Incident likelihood index (0–100), next ~30 days — derived from structural score × weather exposure.
   * ASSUMPTION: mapping from structural score is a placeholder until validation.
   */
  increasedIncidentRiskPercent: number;
  overallRiskLevel: RiskLevel;
  /**
   * Evidence strength for the estimate (sparse signals → LOW). Pair with `overallRiskLevel` using
   * `riskBandMeaningForDataConfidence` — LOW confidence does not mean “low risk.”
   */
  dataConfidence: DataConfidenceLevel;
  /** `baseline_only` when there are no recent signals in the current scope (see `riskSignalCount`). */
  forecastMode: InjuryWeatherForecastMode;
  /**
   * Scalar confidence for this forecast path (not the same as `dataConfidence` rubric): **0.4** when
   * `baseline_only`, **0.8** when live signals adjust the headline product.
   */
  forecastConfidenceScore: number;
  lastUpdatedAt: string;
  /**
   * Structural leading-indicator score 0–100 (severity, trend, momentum, concentration, repeats, optional workforce density).
   * VALIDATED only when backtests show correlation with future incidents — until then, interpret as relative rank.
   */
  structuralRiskScore: number;
  /**
   * Risk engine version string (see `INJURY_WEATHER_MODEL.VERSION` in `riskModel.ts`).
   * CONFIG: bump when weights change.
   */
  riskModelVersion: string;
  /**
   * Dimensionless index — not equated with structural score. **baseline_only:** `baseline × monthly × trade`
   * (`computePredictedRiskProductWhenNoObservations`). **live_adjusted:** `baseline × monthly × trade × behavior × weather`
   * where behavior = realtime behavior × schedule exposure (`computePredictedRiskProduct`).
   */
  predictedRisk: number;
  /** Breakdown for transparency / exports. */
  predictedRiskFactors: PredictedRiskFactors;
  /**
   * @deprecated Use `structuralRiskScore`. Kept for short-term JSON compatibility.
   */
  overallRiskScore?: number;
  /** Most likely injury nature from incident history / exposure priors in this scope. */
  likelyInjuryInsight: LikelyInjuryInsight;
};

export type TradeForecast = {
  trade: string;
  categories: {
    name: string;
    predictedCount: number;
    riskLevel: RiskLevel;
    note?: string;
    /** Raw SOR + corrective action + incident rows for this trade+category in the record window (live only). */
    sourceObservationCount?: number;
    /** Share of this category among the top categories shown for the trade (0–100). */
    shareOfTradeTopCategoriesPct?: number;
  }[];
  footerNote?: string;
  /** Cases allocated to this trade from the headline estimate before splitting by category (live only). */
  tradeCaseAllocation?: number;
  /** `live` = from your data; `demo` = illustration when no matching signals. */
  forecastProvenance?: "live" | "demo";
};

export type DashboardAlert = {
  id: string;
  title: string;
  severity: RiskLevel;
  note?: string;
  dueLabel?: string;
};

export type TrendPoint = {
  month: string;
  value: number;
  highRisk?: boolean;
};

/**
 * Optional workforce / behavioral leading indicators (supply via API when you have them).
 * Fed into likelihood only — not structural score — until calibrated.
 */
export type BehaviorSignals = {
  fatigueIndicators: number;
  rushingIndicators: number;
  /** New or short-tenure workers as percent of crew (0–100); behavior score uses ÷100 as 0–1 ratio. */
  newWorkerRatio: number;
  overtimeHours: number;
};

export type InjuryWeatherLocation = {
  stateCode: string | null;
  displayName: string;
  /** Site / regional climate multiplier (state-based) — CONFIG in `locationWeather.ts`. */
  weatherRiskMultiplier: number;
  impactNote: string;
  /** Signal-weighted trade sensitivity to outdoor/climate stress — ASSUMPTION heuristics. */
  tradeWeatherWeight?: number;
  /** tradeWeatherWeight × weatherRiskMultiplier — applied to likelihood index only, not structural score. */
  combinedWeatherFactor?: number;
};

/** How high-severity share, concentration, and repeat rate are scaled for the overall risk blend. */
export type InjuryWeatherBlendNormalization = {
  kind: "row_counts" | "workforce" | "hours";
  /** Workforce size or hours worked used as denominator when kind is workforce or hours */
  denominator?: number;
};

/** Where the injury-weather model drew its rows (after month + trade filters). */
/** NSC / NAICS benchmark context for Injury Weather (platform companies with `industry_code`). */
export type InjuryWeatherIndustryBenchmarkContext = {
  injuryFactsIndustryProfilesUrl: string;
  injuryFactsIncidentTrendsUrl: string;
  /** Mode of 2-digit NAICS among companies with `industry_code` set; null if none or empty. */
  dominantNaicsPrefix: string | null;
  /** One `companies.industry_code` value that maps to `dominantNaicsPrefix`, for display. */
  exampleIndustryCode: string | null;
  /** From `getIndustryBenchmarkRates` when a dominant prefix exists. */
  recordableCasesPer200kHours: number | null;
  /** Short explanation for the dashboard (data availability + link hint). */
  benchmarkSummary: string;
};

export type InjuryWeatherSignalProvenance = {
  mode: "live" | "seed";
  sorRecords: number;
  correctiveActions: number;
  incidents: number;
  /** When mode is seed: workbook rows used after filters */
  seedWorkbookRows?: number;
  /** Human-readable scope for the record window */
  recordWindowLabel: string;
  /** Dashboard alert cards are not logged open items; controls are playbook themes */
  alertsAreIllustrative: true;
  /** When set, overall risk blend uses per-workforce or per-hour rates instead of raw row shares */
  blendNormalization?: InjuryWeatherBlendNormalization;
};

export const INJURY_WEATHER_ASSUMPTIONS =
  "Forecasts for the month you select use historical safety signals when that month has no or sparse data in the latest daily snapshot, and future months use past patterns until new snapshot data exists. The model blends SOR, corrective actions, and incidents with optional workforce or hours normalization and trade- and state-aware weather exposure (not live weather station feeds). Signal inputs refresh on a schedule (e.g. daily), not in real time. Outputs are not validated injury predictions until compared to your incident history. Use for prioritization and discussion, not as a compliance guarantee.";

export type InjuryWeatherDashboardData = {
  summary: DashboardSummary;
  tradeForecasts: TradeForecast[];
  alerts: DashboardAlert[];
  trend: TrendPoint[];
  recommendedControls: string[];
  monthlyTrainingRecommendations: string[];
  availableMonths: string[];
  availableTrades: string[];
  /** NSC Injury Facts / NAICS vs craft trades; from company `industry_code` distribution when DB available. */
  industryBenchmarkContext: InjuryWeatherIndustryBenchmarkContext;
  location: InjuryWeatherLocation;
  signalProvenance: InjuryWeatherSignalProvenance;
  /** Present for live Supabase-backed runs using the V2 weighted engine. */
  riskEngineV2Explainability?: RiskEngineV2Explainability | null;
  /** Values used in the likelihood path (zeros when not supplied). */
  behaviorSignals: BehaviorSignals;
  /** Echo of schedule inputs used for `scheduleExposureFactor` (defaults when omitted). */
  workSchedule: WorkScheduleInputs;
};

/** AI Safety Advisor: priority theme row (not verified open items). */
export type AiPriorityTheme = {
  title: string;
  dueLabel: string;
  severity: RiskLevel;
};

export type InjuryWeatherAiInsights = {
  headline: string;
  likelyInjuryDrivers: string[];
  priorityActions: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  /** AI-defined focus themes — grounded in trade/category signals, not logged CAPA items. */
  priorityThemes: AiPriorityTheme[];
  /** AI-defined training initiatives for the forecast month. */
  monthlyTrainingRecommendations: string[];
  /** AI-defined control / action lines (playbook style). */
  recommendedControls: string[];
};

/** One row of the month-ahead back-test: score from month M signals vs incidents recorded in M+1. */
export type InjuryWeatherBacktestRow = {
  scoreMonth: string;
  outcomeMonth: string;
  /** Likelihood index (same family as `increasedIncidentRiskPercent`). */
  injuryChancePct: number;
  structuralRiskScore: number | null;
  /** Projected case estimate used in that month’s run. */
  projectedCaseEstimate: number;
  overallRiskLevel: RiskLevel;
  signalRows: number;
  /** `company_incidents` rows with created_at in the outcome month */
  incidentsNextMonth: number;
};

export type InjuryWeatherBacktestRunSnapshot = {
  id: string;
  runAt: string;
  lookbackMonths: number;
  pearsonStructuralVsIncidents: number | null;
  spearmanStructuralVsIncidents: number | null;
  pearsonLikelihoodVsIncidents: number | null;
  spearmanLikelihoodVsIncidents: number | null;
  pearsonCasesVsIncidents: number | null;
  spearmanCasesVsIncidents: number | null;
};

export type InjuryWeatherBacktestResult = {
  generatedAt: string;
  lookbackMonths: number;
  methodology: string;
  rows: InjuryWeatherBacktestRow[];
  /** Pearson r — VALIDATED only in the sense of computed from your DB; causal interpretation is ASSUMPTION. */
  pearsonStructuralVsIncidents: number | null;
  spearmanStructuralVsIncidents: number | null;
  pearsonLikelihoodVsIncidents: number | null;
  spearmanLikelihoodVsIncidents: number | null;
  pearsonCasesVsIncidents: number | null;
  spearmanCasesVsIncidents: number | null;
  /** Prior runs (newest first). Populated when `injury_weather_backtest_runs` exists. */
  recentRuns?: InjuryWeatherBacktestRunSnapshot[];
  /**
   * Rough direction of calibration vs last stored run (same correlation family).
   * PLACEHOLDER heuristic — not statistical significance.
   */
  calibrationTrend?: "improving" | "flat" | "worsening" | "unknown";
};
