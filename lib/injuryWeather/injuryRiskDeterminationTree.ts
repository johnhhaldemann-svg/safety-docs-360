/**
 * Target logic tree for injury risk determination (product / comms).
 * See `riskModel.ts` + `service.ts` for what is implemented vs roadmap.
 * Full target system architecture: `docs/AIInjuryForecastSystem.md` (hybrid: deterministic
 * evidence engines + AI final review as the contextual predictor; see doc intro).
 */

export type InjuryRiskTreeLayer = {
  step: number;
  title: string;
  inputs: string[];
  leadsTo: string;
  /** Where this layer shows up in the current engine (high level). */
  inCodeSummary: string;
};

export type InjuryRiskTreeFinalEngine = {
  title: string;
  factors: string[];
  leadsTo: string;
};

export type InjuryRiskTreeOutput = {
  title: string;
  bands: string[];
  /** Note when UI uses fewer bands than the target model. */
  bandNote: string;
};

export const INJURY_RISK_TREE_LAYERS: InjuryRiskTreeLayer[] = [
  {
    step: 1,
    title: "Historical Injury Data",
    inputs: [
      "Total past injury events",
      "Injury types",
      "Trade involved",
      "Month of event",
      "Season of event",
      "Severity level",
      "Frequency over time",
    ],
    leadsTo: "Historical Baseline Risk",
    inCodeSummary:
      "Leading-indicator blend from SOR / corrective actions / incidents (severity, concentration, repeats, optional workforce density). Feeds `historicalBaseline` in `predictedRisk` and structural score.",
  },
  {
    step: 2,
    title: "Time-Based Pattern Layer",
    inputs: [
      "Current month",
      "Current season",
      "Does this month historically show elevated events?",
      "Does this season match a known injury pattern?",
      "Does this injury type spike in this period?",
    ],
    leadsTo: "Monthly / Seasonal Risk Multiplier",
    inCodeSummary:
      "`seasonalFactor` and calendar-month stress in `siteConditionFactor` (`MONTHLY_BEHAVIOR_FACTOR`, `SEASONAL_FACTOR`).",
  },
  {
    step: 3,
    title: "Real-Time Site Signal Layer",
    inputs: [
      "Current SOR count",
      "High-risk observations this week",
      "Repeated unsafe behaviors",
      "Open corrective actions",
      "Overdue corrective actions",
      "Permit failures",
      "DAP quality issues",
      "Training gaps",
      "Near misses",
      "Repeat offenders",
    ],
    leadsTo: "Live Behavior / Site Condition Multiplier",
    inCodeSummary:
      "Live rows from `company_sor_records`, `company_corrective_actions`, `company_incidents` in the record window. Optional `behaviorSignals` (fatigue, rush, new workers, OT). Not all bullet inputs are separate DB feeds yet.",
  },
  {
    step: 4,
    title: "Environmental Layer",
    inputs: [
      "Temperature",
      "Heat index",
      "Wind speed",
      "Rain / snow / ice",
      "Humidity",
      "Visibility",
      "Surface conditions",
    ],
    leadsTo: "Weather / Exposure Multiplier",
    inCodeSummary:
      "Regional climate and trade-mix weights (`weatherRiskMultiplier`, `tradeWeatherWeight`), not live weather station data.",
  },
  {
    step: 5,
    title: "Operational Exposure Layer",
    inputs: [
      "Current trade activity",
      "Work at height",
      "Material handling",
      "Heavy equipment activity",
      "Overtime hours",
      "Crew size",
      "New worker ratio",
      "Task complexity",
      "7-day work week & hours per day (schedule)",
    ],
    leadsTo: "Exposure Multiplier",
    inCodeSummary:
      "Workforce / hours worked for normalization; `behaviorSignals`; `scheduleExposureFactor` from weekly hours vs 40h reference. Trade-activity detail is implicit in signal mix, not a separate equipment feed.",
  },
  {
    step: 6,
    title: "Pattern Match Check",
    inputs: [
      "Do live conditions match historical injury patterns?",
      "Do this month’s known risks match current site observations?",
      "Is the same injury type trending again?",
      "Are multiple indicators pointing to the same outcome?",
    ],
    leadsTo: "Confidence Adjustment",
    inCodeSummary:
      "AI Safety Advisor confidence (rubric from data density) and qualitative validation—not yet a separate numeric multiplier in the risk product.",
  },
];

export const INJURY_RISK_FINAL_ENGINE: InjuryRiskTreeFinalEngine = {
  title: "Final Risk Engine",
  factors: [
    "Historical Baseline Risk",
    "× Monthly / Seasonal Multiplier",
    "× Live Behavior Multiplier",
    "× Weather Multiplier",
    "× Exposure Multiplier",
    "× Confidence Adjustment",
  ],
  leadsTo: "Final Predicted Risk Score",
};

export const INJURY_RISK_OUTPUT: InjuryRiskTreeOutput = {
  title: "Output Result",
  bands: ["Low", "Moderate", "Elevated", "High", "Critical"],
  bandNote:
    "This dashboard labels overall risk as LOW, MODERATE, HIGH, or CRITICAL from structural score cuts. Treat “Elevated” as the upper Moderate range until a fifth band is added.",
};
