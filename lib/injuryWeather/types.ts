export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

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
export type DashboardSummary = {
  month: string;
  predictedObservations: number;
  potentialInjuryEvents: number;
  /** Projected case-load style count (next ~30 days); illustrative until calibrated against outcomes. */
  predictedInjuriesNextMonth: number;
  /**
   * Incident likelihood index (0–100), next ~30 days — derived from structural score × weather exposure.
   * ASSUMPTION: mapping from structural score is a placeholder until validation.
   */
  increasedIncidentRiskPercent: number;
  overallRiskLevel: RiskLevel;
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
   * `historicalBaseline × seasonalFactor × realTimeBehaviorFactor × siteConditionFactor × weatherFactor`
   * (dimensionless index; not equated with structural score).
   */
  predictedRisk: number;
  /** Breakdown for transparency / exports. */
  predictedRiskFactors: PredictedRiskFactors;
  /**
   * @deprecated Use `structuralRiskScore`. Kept for short-term JSON compatibility.
   */
  overallRiskScore?: number;
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
  "This view uses a leading-indicator model from safety signals (SOR, corrective actions, incidents), optional workforce or hours normalization, and trade- and state-aware weather exposure (not live weather data). Outputs are not validated injury predictions until compared to your incident history. Use for prioritization and discussion, not as a compliance guarantee.";

export type InjuryWeatherDashboardData = {
  summary: DashboardSummary;
  tradeForecasts: TradeForecast[];
  alerts: DashboardAlert[];
  trend: TrendPoint[];
  recommendedControls: string[];
  monthlyTrainingRecommendations: string[];
  availableMonths: string[];
  availableTrades: string[];
  location: InjuryWeatherLocation;
  signalProvenance: InjuryWeatherSignalProvenance;
  /** Values used in the likelihood path (zeros when not supplied). */
  behaviorSignals: BehaviorSignals;
  /** Echo of schedule inputs used for `scheduleExposureFactor` (defaults when omitted). */
  workSchedule: WorkScheduleInputs;
};

export type InjuryWeatherAiInsights = {
  headline: string;
  likelyInjuryDrivers: string[];
  priorityActions: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
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
