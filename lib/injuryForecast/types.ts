/**
 * Dynamic Injury Forecast Engine — typed inputs/outputs for the layered Poisson-style model.
 * Kept free of React/DB imports; map from `NormalizedLiveSignalRow` in `legacyMapper.ts`.
 */

import type { ProjectPhaseKey } from "./benchmarkDefaults";

export type TrendDirection = "rising" | "stable" | "falling";

export type ForecastDataMode = "FULL_DATA" | "PARTIAL_DATA" | "BENCHMARK_FALLBACK";

/** Volume / quality context for mode detection and blending (built in `legacyMapper.ts`). */
export type ForecastRunContext = {
  signalRowCount: number;
  incidentCount: number;
  sorCount: number;
  correctiveActionCount: number;
  laborHours: number;
  distinctMonthsOfHistory: number;
  inspectionProxyCount: number;
  completeness01: number;
  dataRecencyScore01: number;
  dominantTradeLabels: string[];
  monthIndex0: number;
  projectPhase: ProjectPhaseKey | null;
  highRiskTaskTags: string[];
  stateRateIndex: number | null;
};

export type DynamicRiskBand = "Low" | "Moderate" | "High" | "Critical";

/** Canonical injury families for the type-scoring layer (UI + rules). */
export type CanonicalInjuryCategory =
  | "slip_trip_fall"
  | "struck_by"
  | "caught_between"
  | "overexertion"
  | "electrical"
  | "rigging_material_handling"
  | "heat_illness"
  | "hand_injury"
  | "laceration"
  | "vehicle_equipment";

export type RiskDriver = {
  id: string;
  label: string;
  /** Relative contribution 0–1 after normalization (for ranking). */
  contribution: number;
  detail: string;
};

export type InjuryTypeScore = {
  category: CanonicalInjuryCategory;
  displayLabel: string;
  score: number;
  /** 0–100 heuristic confidence in this rank (data volume + specificity). */
  confidence: number;
  explanation: string;
};

export type ControlMetric = {
  id: string;
  label: string;
  /** 0 = failed, 1 = healthy */
  value: number;
  assumed?: boolean;
};

export type DataQualityMetric = {
  id: string;
  label: string;
  /** 0–1 where 1 is ideal */
  value: number;
  assumed?: boolean;
};

export type CompanyHistoricalRateInput = {
  /** Recordable-style events in the analytic window (incidents in scope). */
  incidentCount: number;
  /** Person-hours or similar exposure denominator; optional. */
  hoursWorked?: number;
  headcount?: number;
};

export type TradeBenchmark = { tradeId: string; rateIndex: number; note?: string };
export type StateBenchmark = { stateCode: string; rateIndex: number; note?: string };
export type MonthlyBenchmark = { monthIndex0: number; rateIndex: number };

export type BaselineLayerInput = {
  company: CompanyHistoricalRateInput;
  /** Industry / national prior as annualized rate index (~0.02 = 2% injury-year proxy). */
  industryBenchmarkRate: number;
  tradeBenchmark?: TradeBenchmark | null;
  stateBenchmark?: StateBenchmark | null;
  monthlyBenchmark?: MonthlyBenchmark | null;
  /**
   * When set (from composite data-volume credibility), replaces incident-count-only z in the baseline layer.
   */
  credibilityZOverride?: number;
};

export type ExposureLayerInput = {
  totalLaborHours: number;
  activeHeadcount: number;
  highRiskTaskCount: number;
  simultaneousTrades: number;
  equipmentOperationsCount: number;
  /** Fields filled with assumptions when unknown */
  assumed?: Partial<Record<keyof Omit<ExposureLayerInput, "assumed">, boolean>>;
};

export type LeadingIndicatorInput = {
  sorCount: number;
  nearMissCount: number;
  correctiveOpenCount: number;
  correctiveOverdueCount: number;
  failedInspectionCount: number;
  permitFailureCount: number;
  jsaQualityScore: number;
  housekeepingDeficiencyRate: number;
  severityCounts: { low: number; medium: number; high: number; critical: number };
  totalHoursForNormalization: number;
  assumed?: Partial<Record<string, boolean>>;
};

export type ControlReliabilityInput = {
  metrics: ControlMetric[];
}

export type TrendLayerInput = {
  recent30DaySignalRate: number;
  prior90DaySignalRate: number;
  baseline6MonthRate?: number;
};

export type FatigueScheduleInput = {
  avgShiftHours: number;
  avgWeeklyHours: number;
  consecutiveDaysWorked: number;
  nightShift: boolean;
  overtimeHeavy: boolean;
  assumed?: Partial<Record<string, boolean>>;
};

export type WeatherEnvironmentInput = {
  rainIndex: number;
  windIndex: number;
  heatStressIndex: number;
  coldStressIndex: number;
  lowVisibilityIndex: number;
  slipSurfaceIndex: number;
  seasonFactor: number;
  assumed?: Partial<Record<string, boolean>>;
};

export type DataQualityInput = {
  completeness: number;
  missingTradeMappingRate: number;
  lateEntryRate: number;
  missingSeverityRate: number;
  missingCloseoutRate: number;
  staleDataRate: number;
  assumed?: Partial<Record<string, boolean>>;
};

export type ForecastInput = {
  baseline: BaselineLayerInput;
  exposure: ExposureLayerInput;
  leadingIndicators: LeadingIndicatorInput;
  controls: ControlReliabilityInput;
  trend: TrendLayerInput;
  fatigue: FatigueScheduleInput;
  weather: WeatherEnvironmentInput;
  uncertainty: DataQualityInput;
};

export type LayerOutput<T> = {
  value: number;
  detail: string;
  raw: T;
};

export type BaselineLayerOutput = LayerOutput<{
  credibilityZ: number;
  companyRate: number;
  blendedBenchmarkRate: number;
  baselineRisk: number;
}>;

export type DynamicForecastLayerBundle = {
  baseline: BaselineLayerOutput;
  exposureMultiplier: LayerOutput<{ components: Record<string, number> }>;
  leadingIndicatorPressure: LayerOutput<{ severityWeightedObs: number; rates: Record<string, number> }>;
  controlFailurePressure: LayerOutput<{ reliability: number; weakest: ControlMetric[] }>;
  trendMultiplier: LayerOutput<{ direction: TrendDirection }>;
  fatigueMultiplier: LayerOutput<Record<string, boolean>>;
  weatherMultiplier: LayerOutput<{ indices: Record<string, number> }>;
  uncertaintyMultiplier: LayerOutput<{ confidenceScore: number; metrics: DataQualityMetric[] }>;
};

/** Second-stage ML calibration hook (placeholder: mirrors interpretable score). */
export type MlCalibrationHooks = {
  predictProbability: (ctx: { lambda30: number; interpretableProbability: number }) => number;
  predictInjuryTypes: (scores: InjuryTypeScore[]) => InjuryTypeScore[];
  calibrateWeights: (w: Record<string, number>) => Record<string, number>;
};

export type DynamicForecastOutput = {
  modelVersion: string;
  lambda30: number;
  /** P(at least one injury-like event in 30d) — Poisson arrival approximation. */
  probability30d: number;
  riskScore0_100: number;
  riskBand: DynamicRiskBand;
  interpretableProbability: number;
  mlCalibrationScore: number;
  blendedModelScore: number;
  topRiskDrivers: RiskDriver[];
  weakestControls: ControlMetric[];
  trendDirection: TrendDirection;
  confidenceScore: number;
  likelyInjuryTypes: InjuryTypeScore[];
  narrativeSummary: string;
  recommendedActions: string[];
  layers: DynamicForecastLayerBundle;
  assumptions: string[];
  /** Data sufficiency path for blending and UI. */
  forecastMode: ForecastDataMode;
  usedFallbackDefaults: boolean;
  fallbackReason: string;
  benchmarkSourcesUsed: string[];
  /** 0–1 weight applied to full hybrid λ before fallback λ (1 = all hybrid). */
  hybridBlendWeight: number;
  fallbackLambda30: number;
};

export type ForecastContextMeta = {
  forecastMonthLabel: string;
  recordWindowDays?: number;
};
