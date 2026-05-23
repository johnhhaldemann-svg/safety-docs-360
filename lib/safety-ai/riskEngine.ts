import { buildSafetyExplanation } from "@/lib/safety-ai/explanations";
import { buildSafetyControlRecommendations } from "@/lib/safety-ai/controlRecommendations";
import { buildSafetyRecommendations } from "@/lib/safety-ai/recommendations";
import type {
  RiskDriver,
  RiskDriverImpact,
  SafetyAiAssessment,
  SafetyAiScoreExplanation,
  SafetyAiInput,
  SafetyAiScoreBreakdown,
  SafetyAiSignal,
  SafetyRecommendation,
  SafetyRiskLevel,
} from "@/lib/safety-ai/types";

const SCORE_WEIGHTS = {
  severity: 0.4,
  likelihood: 0.25,
  exposureFrequency: 0.15,
  controlGap: 0.1,
  dataConfidenceConcern: 0.1,
} as const;

type HazardProfile = {
  id: string;
  label: string;
  keywords: string[];
  controlTerms: string[];
  criticalControls: string[];
  highConsequence: boolean;
};

type HazardProfileFinding = {
  profile: HazardProfile;
  signalCount: number;
  sourceTypes: string[];
  missingControls: string[];
};

type HazardProfileAnalysis = {
  matchedProfiles: HazardProfileFinding[];
  criticalControlGaps: string[];
  reviewTriggers: string[];
  convergenceCount: number;
  repeatedHazardCount: number;
  highConsequenceGap: boolean;
};

const HAZARD_PROFILES: HazardProfile[] = [
  {
    id: "fall_exposure",
    label: "Fall exposure",
    keywords: ["fall", "height", "roof", "leading edge", "open edge", "mezzanine", "aerial lift", "mewp", "scaffold", "ladder"],
    controlTerms: ["guardrail", "anchor", "tie off", "tie-off", "pfas", "harness", "lanyard", "rescue plan", "scaffold inspection"],
    criticalControls: ["guardrails or verified tie-off", "rescue plan", "competent-person inspection"],
    highConsequence: true,
  },
  {
    id: "excavation_trenching",
    label: "Excavation or trenching",
    keywords: ["excavat", "trench", "shoring", "shore", "bench", "slope", "shield", "cave in", "cave-in"],
    controlTerms: ["shore", "shoring", "shield", "trench box", "slope", "bench", "egress", "ladder", "competent person"],
    criticalControls: ["protective system", "safe access or egress", "competent-person inspection"],
    highConsequence: true,
  },
  {
    id: "energized_electrical",
    label: "Energized electrical or LOTO",
    keywords: ["energized", "electrical", "temporary power", "loto", "lockout", "tagout", "arc flash", "breaker", "panel"],
    controlTerms: ["lockout", "loto", "de-energ", "test before touch", "verify zero energy", "qualified", "arc flash", "barricade"],
    criticalControls: ["de-energization or LOTO verification", "qualified-worker review", "barricade or arc-flash controls"],
    highConsequence: true,
  },
  {
    id: "confined_space",
    label: "Confined space",
    keywords: ["confined", "tank", "vessel", "manhole", "permit space", "atmosphere", "oxygen", "entrant"],
    controlTerms: ["air monitor", "atmospheric", "attendant", "rescue", "ventilation", "entry permit", "retrieval"],
    criticalControls: ["entry permit", "atmospheric monitoring", "attendant and rescue plan"],
    highConsequence: true,
  },
  {
    id: "hot_work",
    label: "Hot work or fire exposure",
    keywords: ["hot work", "weld", "welding", "cutting", "burn", "torch", "spark", "grind", "fire watch"],
    controlTerms: ["hot work permit", "fire watch", "extinguisher", "combustible", "spark containment", "gas test"],
    criticalControls: ["hot-work permit", "fire watch", "combustible control"],
    highConsequence: false,
  },
  {
    id: "crane_rigging",
    label: "Crane, rigging, or suspended load",
    keywords: ["crane", "rigging", "critical lift", "suspended load", "hoist", "tag line", "line of fire", "lifting"],
    controlTerms: ["lift plan", "qualified rigger", "signal person", "exclusion zone", "tag line", "load chart", "pre lift"],
    criticalControls: ["lift plan", "qualified rigger or signal person", "exclusion zone"],
    highConsequence: true,
  },
  {
    id: "mobile_equipment",
    label: "Mobile equipment or struck-by exposure",
    keywords: ["forklift", "telehandler", "loader", "skid steer", "backing", "struck", "traffic", "equipment route"],
    controlTerms: ["spotter", "traffic plan", "barricade", "separation", "exclusion zone", "backup alarm", "pedestrian"],
    criticalControls: ["pedestrian separation", "traffic plan", "spotter or exclusion zone"],
    highConsequence: false,
  },
  {
    id: "chemical_respiratory",
    label: "Chemical, silica, or respiratory exposure",
    keywords: ["chemical", "silica", "dust", "solvent", "respirator", "sds", "hazcom", "asbestos", "lead"],
    controlTerms: ["sds", "ventilation", "wet method", "hepa", "respirator", "fit test", "containment", "exposure control"],
    criticalControls: ["exposure control method", "ventilation or containment", "respiratory protection verification"],
    highConsequence: false,
  },
];

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function score1to5(value: unknown, fallback = 1) {
  if (typeof value === "number") return clamp(Math.round(value), 1, 5);
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("catastrophic") || raw.includes("fatal") || raw.includes("critical") || raw.includes("urgent")) return 5;
  if (raw.includes("high") || raw.includes("serious")) return 4;
  if (raw.includes("medium") || raw.includes("moderate")) return 3;
  if (raw.includes("low") || raw.includes("minor")) return 2;
  return fallback;
}

function isOpenStatus(status?: string | null) {
  const value = String(status ?? "").trim().toLowerCase();
  return !["closed", "verified_closed", "complete", "completed", "resolved", "cancelled", "archived"].includes(value);
}

function isOverdue(signal: SafetyAiSignal) {
  if (signal.overdueCorrectiveAction) return true;
  const value = String(signal.status ?? "").toLowerCase();
  return value.includes("overdue") || value.includes("past_due");
}

function impactForScore(score: number): RiskDriverImpact {
  if (score >= 5) return "critical";
  if (score >= 4) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function classifySafetyRisk(score: number): SafetyRiskLevel {
  if (score >= 81) return "critical";
  if (score >= 61) return "high";
  if (score >= 41) return "moderate";
  return "low";
}

function increaseLevel(level: SafetyRiskLevel): SafetyRiskLevel {
  if (level === "low") return "moderate";
  if (level === "moderate") return "high";
  return "critical";
}

function minimumScoreForLevel(level: SafetyRiskLevel) {
  if (level === "critical") return 81;
  if (level === "high") return 61;
  if (level === "moderate") return 41;
  return 0;
}

function sourceCategoryCount(signals: SafetyAiSignal[]) {
  return new Set(signals.map((signal) => signal.type)).size;
}

function normalizeText(...values: unknown[]) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(text: string, term: string) {
  return text.includes(term.toLowerCase());
}

function signalText(signal: SafetyAiSignal) {
  return normalizeText(
    signal.label,
    signal.hazard,
    signal.task,
    signal.trade,
    signal.controls,
    signal.controlEvidence
  );
}

function inputHazardText(input: SafetyAiInput) {
  return normalizeText(input.taskType, input.trade, input.equipment, input.highRiskWorkCategories, input.observedControls);
}

function hasExplicitReadinessGap(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  return Boolean(
    input.missingRequiredTraining ||
      input.missingRequiredPermit ||
      input.missingCompetentPersonReview ||
      input.overdueCorrectiveActionForHazard ||
      signals.some((signal) =>
        Boolean(
          signal.missingRequiredTraining ||
            signal.missingRequiredPermit ||
            signal.missingCompetentPersonReview ||
            signal.overdueCorrectiveAction ||
            score1to5(signal.controlGap, 0) >= 4
        )
      )
  );
}

function controlsEvidenceText(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  return normalizeText(
    input.observedControls,
    signals.flatMap((signal) => signal.controls ?? []),
    signals.map((signal) => signal.controlEvidence)
  );
}

function repeatedHazardCount(signals: SafetyAiSignal[]) {
  const counts = new Map<string, number>();
  for (const signal of signals) {
    const key = normalizeText(signal.hazard ?? signal.task ?? signal.label)
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(" ")
      .filter((part) => part.length >= 4)
      .slice(0, 4)
      .join(" ");
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

function analyzeHazardProfiles(input: SafetyAiInput, signals: SafetyAiSignal[]): HazardProfileAnalysis {
  const allText = normalizeText(inputHazardText(input), signals.map(signalText));
  const controlText = controlsEvidenceText(input, signals);
  const readinessGap = hasExplicitReadinessGap(input, signals);
  const controlEffectiveness = input.controlEffectiveness ?? "unknown";
  const weakOrUnverifiedControls =
    readinessGap ||
    controlEffectiveness === "missing" ||
    controlEffectiveness === "ineffective" ||
    controlEffectiveness === "partial" ||
    controlEffectiveness === "unknown";

  const matchedProfiles = HAZARD_PROFILES.flatMap((profile): HazardProfileFinding[] => {
    const profileMatches = profile.keywords.some((keyword) => includesTerm(allText, keyword));
    if (!profileMatches) return [];

    const matchingSignals = signals.filter((signal) => profile.keywords.some((keyword) => includesTerm(signalText(signal), keyword)));
    const sourceTypes = [...new Set(matchingSignals.map((signal) => signal.type))];
    const hasAnyCriticalControl = profile.controlTerms.some((term) => includesTerm(controlText, term));
    const shouldVerifyCriticalControls =
      weakOrUnverifiedControls &&
      (profile.highConsequence ||
        input.highRiskWorkCategories?.some((category) => profile.keywords.some((keyword) => includesTerm(normalizeText(category), keyword))) ||
        matchingSignals.some((signal) => signal.highRisk));
    const missingControls = shouldVerifyCriticalControls && !hasAnyCriticalControl ? profile.criticalControls : [];

    return [
      {
        profile,
        signalCount: Math.max(matchingSignals.length, profileMatches ? 1 : 0),
        sourceTypes,
        missingControls,
      },
    ];
  });

  const convergenceCount = matchedProfiles.filter((finding) => finding.signalCount >= 2 || finding.sourceTypes.length >= 2).length;
  const criticalControlGaps = matchedProfiles
    .filter((finding) => finding.missingControls.length > 0)
    .map((finding) => `${finding.profile.label}: verify ${finding.missingControls.join(", ")}`);
  const repeatedCount = repeatedHazardCount(signals);
  const highConsequenceGap = matchedProfiles.some((finding) => finding.profile.highConsequence && finding.missingControls.length > 0);
  const reviewTriggers = [
    ...matchedProfiles
      .filter((finding) => finding.profile.highConsequence && finding.signalCount > 0)
      .map((finding) => `${finding.profile.label} identified in the available task or signal data.`),
    ...(convergenceCount > 0 ? ["Multiple signals point to the same high-risk hazard family."] : []),
    ...(criticalControlGaps.length > 0 ? criticalControlGaps : []),
  ];

  return {
    matchedProfiles,
    criticalControlGaps,
    reviewTriggers: [...new Set(reviewTriggers)].slice(0, 8),
    convergenceCount,
    repeatedHazardCount: repeatedCount,
    highConsequenceGap,
  };
}

function defaultMissingData(input: SafetyAiInput) {
  const missing = new Set(input.missingData ?? []);
  const signals = input.signals ?? [];
  if (!input.jobsiteId && !input.jobsiteName) missing.add("jobsite");
  if (!input.taskType && !signals.some((signal) => signal.task)) missing.add("task");
  if (!input.trade && !signals.some((signal) => signal.trade)) missing.add("trade");
  if (signals.length === 0) missing.add("recent safety signals");
  if ((!input.controlEffectiveness || input.controlEffectiveness === "unknown") && !signals.some((signal) => signal.controlGap != null)) {
    missing.add("control effectiveness");
  }
  if (input.dataCompleteness == null && sourceCategoryCount(signals) < 3) {
    missing.add("source coverage");
  }
  return [...missing];
}

function deriveSeverity(input: SafetyAiInput, signals: SafetyAiSignal[], hazardAnalysis: HazardProfileAnalysis) {
  const explicit = input.scores?.severity;
  if (explicit != null) return score1to5(explicit);
  if (input.fatalityOrCatastrophicPotential || signals.some((signal) => signal.fatalityOrCatastrophicPotential)) return 5;
  const signalSeverity = Math.max(1, ...signals.map((signal) => score1to5(signal.severity, 1)));
  if (hazardAnalysis.highConsequenceGap) return 5;
  if (input.highRiskWorkCategories?.length || signals.some((signal) => signal.highRisk)) return Math.max(signalSeverity, 4);
  return signalSeverity;
}

function deriveLikelihood(input: SafetyAiInput, signals: SafetyAiSignal[], hazardAnalysis: HazardProfileAnalysis) {
  const explicit = input.scores?.likelihood;
  if (explicit != null) return score1to5(explicit);
  const openSignals = signals.filter((signal) => isOpenStatus(signal.status)).length;
  const severeSignals = signals.filter((signal) => score1to5(signal.severity, 1) >= 4).length;
  const incidentSignals = signals.filter((signal) => signal.type === "incident" || signal.type === "near_miss").length;
  const explicitLikelihood = Math.max(1, ...signals.map((signal) => score1to5(signal.likelihood, 1)));
  const volumeLikelihood = 1 + Math.min(4, Math.floor((openSignals + severeSignals + incidentSignals) / 2));
  const convergenceLift = hazardAnalysis.convergenceCount > 0 ? 1 : 0;
  const repeatedLift = hazardAnalysis.repeatedHazardCount >= 3 ? 1 : 0;
  return clamp(Math.max(explicitLikelihood, volumeLikelihood) + convergenceLift + repeatedLift, 1, 5);
}

function deriveExposureFrequency(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  const explicit = input.scores?.exposureFrequency;
  if (explicit != null) return score1to5(explicit);
  const crewExposure = clamp(Math.ceil((input.crewExposure ?? Math.max(0, ...signals.map((signal) => signal.crewSize ?? 0))) / 5), 0, 4);
  const scheduledHighRisk = signals.filter((signal) => signal.type === "high_risk_work" || signal.highRisk).length;
  const explicitExposure = Math.max(1, ...signals.map((signal) => score1to5(signal.exposureFrequency, 1)));
  return clamp(Math.max(explicitExposure, 1 + crewExposure, scheduledHighRisk >= 2 ? 4 : 1), 1, 5);
}

function deriveControlGap(input: SafetyAiInput, signals: SafetyAiSignal[], hazardAnalysis: HazardProfileAnalysis) {
  const explicit = input.scores?.controlGap;
  if (explicit != null) return score1to5(explicit);
  const effectiveness = input.controlEffectiveness;
  let base = effectiveness === "missing" ? 5 : effectiveness === "ineffective" ? 5 : effectiveness === "partial" ? 3 : effectiveness === "effective" ? 1 : 2;
  if (signals.some((signal) => score1to5(signal.controlGap, 0) >= 4)) base = Math.max(base, 4);
  if (signals.some((signal) => signal.missingRequiredPermit || signal.missingRequiredTraining || signal.missingCompetentPersonReview)) base = Math.max(base, 4);
  if (signals.some((signal) => signal.type === "corrective_action" && isOpenStatus(signal.status))) base = Math.max(base, 3);
  if (hazardAnalysis.criticalControlGaps.length > 0) base = Math.max(base, hazardAnalysis.highConsequenceGap ? 5 : 4);
  return clamp(base, 1, 5);
}

function deriveDataConfidenceConcern(input: SafetyAiInput, signals: SafetyAiSignal[], missingData: string[]) {
  const explicit = input.scores?.dataConfidenceConcern;
  if (explicit != null) return score1to5(explicit);
  const completeness = typeof input.dataCompleteness === "number" ? clamp(input.dataCompleteness, 0, 1) : null;
  const sourceConcern = sourceCategoryCount(signals) >= 4 ? 1 : sourceCategoryCount(signals) >= 2 ? 2 : 4;
  const missingConcern = missingData.length === 0 ? 1 : missingData.length <= 2 ? 3 : 5;
  const completenessConcern = completeness == null ? 3 : completeness >= 0.8 ? 1 : completeness >= 0.5 ? 3 : 5;
  return clamp(Math.max(sourceConcern, missingConcern, completenessConcern), 1, 5);
}

function weightedScore(breakdown: Omit<SafetyAiScoreBreakdown, "weightedAverage">) {
  const weightedAverage =
    breakdown.severity * SCORE_WEIGHTS.severity +
    breakdown.likelihood * SCORE_WEIGHTS.likelihood +
    breakdown.exposureFrequency * SCORE_WEIGHTS.exposureFrequency +
    breakdown.controlGap * SCORE_WEIGHTS.controlGap +
    breakdown.dataConfidenceConcern * SCORE_WEIGHTS.dataConfidenceConcern;
  return {
    weightedAverage,
    score: clamp(Math.round((weightedAverage / 5) * 100), 0, 100),
  };
}

function confidenceFor(input: SafetyAiInput, signals: SafetyAiSignal[], missingData: string[], dataConfidenceConcern: number) {
  if (dataConfidenceConcern >= 5 || missingData.length >= 4) return "low";
  if (sourceCategoryCount(signals) >= 4 && missingData.length === 0 && (input.dataCompleteness ?? 1) >= 0.8) return "high";
  if (signals.length >= 2 && missingData.length <= 3) return "medium";
  return "low";
}

function driver(label: string, category: RiskDriver["category"], impact: RiskDriverImpact, explanation: string): RiskDriver {
  return { label, category, impact, explanation };
}

function labelForSignalType(type: SafetyAiSignal["type"]) {
  return type.replace(/_/g, " ");
}

function buildScoreDataInputs(signals: SafetyAiSignal[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const signal of signals) {
    const label = String(signal.label ?? "").trim();
    const hazard = String(signal.hazard ?? "").trim();
    const status = String(signal.status ?? "").trim();
    const value = [
      `${labelForSignalType(signal.type)}: ${label || hazard || "unnamed signal"}`,
      hazard && label.toLowerCase() !== hazard.toLowerCase() ? `hazard ${hazard}` : "",
      status ? `status ${status}` : "",
    ].filter(Boolean).join("; ");
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.slice(0, 8);
}

function recommendationPriorityRank(priority: SafetyRecommendation["priority"]) {
  if (priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function topRecommendedAction(recommendations: SafetyRecommendation[], actionTimeframe: SafetyAiAssessment["actionTimeframe"]) {
  const top = [...recommendations].sort((a, b) => recommendationPriorityRank(b.priority) - recommendationPriorityRank(a.priority))[0];
  if (top) return top.title;
  if (actionTimeframe === "immediate") return "Pause affected work for human review.";
  if (actionTimeframe === "before_work_continues") return "Verify controls before affected work continues.";
  if (actionTimeframe === "same_shift") return "Review risk controls during the current shift.";
  return "Continue monitoring and documenting field conditions.";
}

function humanApprovalReason(params: {
  level: SafetyRiskLevel;
  escalationRequired: boolean;
  stopWorkReviewRecommended: boolean;
  imminentDanger: boolean;
  missingRequiredTraining: boolean;
  missingRequiredPermit: boolean;
  missingCompetentPersonReview: boolean;
  criticalControlGaps: string[];
}) {
  const reasons: string[] = [];
  if (params.stopWorkReviewRecommended || params.imminentDanger) {
    reasons.push("Immediate human review is required because critical or imminent-danger indicators are present.");
  }
  if (params.level === "critical") {
    reasons.push("Critical AI Engine risk requires competent-person or safety-manager review before affected work proceeds.");
  }
  if (params.criticalControlGaps.length > 0) {
    reasons.push("Critical controls need human verification before the task is treated as controlled.");
  }
  if (params.missingRequiredPermit) {
    reasons.push("Permit readiness needs human verification before affected work proceeds.");
  }
  if (params.missingRequiredTraining) {
    reasons.push("Training readiness needs human verification before assignment to affected work.");
  }
  if (params.missingCompetentPersonReview) {
    reasons.push("A competent-person or supervisor review is missing for the affected work.");
  }
  if (params.escalationRequired && reasons.length === 0) {
    reasons.push("High AI Engine risk requires supervisor or safety-manager review before risk is treated as controlled.");
  }
  return reasons.length > 0 ? reasons.join(" ") : null;
}

function buildScoreExplanation(params: {
  score: number;
  level: SafetyRiskLevel;
  confidence: SafetyAiAssessment["confidence"];
  topDrivers: RiskDriver[];
  signals: SafetyAiSignal[];
  missingData: string[];
  recommendations: SafetyRecommendation[];
  actionTimeframe: SafetyAiAssessment["actionTimeframe"];
  humanApprovalRequired: boolean;
  humanApprovalReason: string | null;
}): SafetyAiScoreExplanation {
  const driverSummary = params.topDrivers.slice(0, 5).map((driver) => `${driver.label}: ${driver.explanation}`);
  const topReason = params.topDrivers[0]?.explanation;
  return {
    score: params.score,
    level: params.level,
    confidence: params.confidence,
    reason: topReason
      ? `${params.level} risk was assigned because ${topReason.charAt(0).toLowerCase()}${topReason.slice(1)}`
      : `${params.level} risk was assigned from the available AI Engine inputs and source coverage.`,
    dataInputs: buildScoreDataInputs(params.signals),
    missingInformation: params.missingData,
    recommendedAction: topRecommendedAction(params.recommendations, params.actionTimeframe),
    humanApprovalRequired: params.humanApprovalRequired,
    humanApprovalReason: params.humanApprovalReason,
    driverSummary,
  };
}

function buildDrivers(params: {
  input: SafetyAiInput;
  signals: SafetyAiSignal[];
  breakdown: SafetyAiScoreBreakdown;
  missingData: string[];
  hazardAnalysis: HazardProfileAnalysis;
  imminentDanger: boolean;
  fatalOverride: boolean;
  gapEscalation: boolean;
}) {
  const drivers: RiskDriver[] = [];
  const { input, signals, breakdown } = params;
  if (params.imminentDanger) {
    drivers.push(driver("Imminent danger indicator", "severity", "critical", "An imminent danger signal was present, so critical review is recommended."));
  }
  if (params.fatalOverride) {
    drivers.push(driver("Fatal or catastrophic potential with weak controls", "severity", "critical", "Fatality or catastrophic severity was paired with missing or ineffective controls."));
  }
  if (breakdown.severity >= 4) {
    drivers.push(driver("High severity potential", "severity", impactForScore(breakdown.severity), "The highest available severity signal is high or critical."));
  }
  if (breakdown.likelihood >= 3) {
    drivers.push(driver("Repeated or open risk signals", "likelihood", impactForScore(breakdown.likelihood), "Recent open items, incidents, or near misses increase likelihood."));
  }
  if (breakdown.exposureFrequency >= 3) {
    drivers.push(driver("Crew or task exposure", "exposure", impactForScore(breakdown.exposureFrequency), "Crew size, scheduled high-risk work, or exposure frequency increases risk."));
  }
  if (breakdown.controlGap >= 3) {
    drivers.push(driver("Control gap", "controls", impactForScore(breakdown.controlGap), "Controls are missing, partial, ineffective, or not verified in the available data."));
  }
  for (const gap of params.hazardAnalysis.criticalControlGaps.slice(0, 3)) {
    drivers.push(
      driver(
        "Critical control verification gap",
        "critical_control",
        params.hazardAnalysis.highConsequenceGap ? "critical" : "high",
        gap
      )
    );
  }
  if (params.hazardAnalysis.convergenceCount > 0) {
    drivers.push(
      driver(
        "Converging risk signals",
        "pattern",
        params.hazardAnalysis.highConsequenceGap ? "critical" : "high",
        "Multiple signal types or repeated records point to the same hazard family, increasing confidence that this needs field review."
      )
    );
  }
  if (params.hazardAnalysis.repeatedHazardCount >= 3) {
    drivers.push(
      driver(
        "Repeated hazard pattern",
        "pattern",
        "high",
        `${params.hazardAnalysis.repeatedHazardCount} available signals appear to reference the same hazard or task pattern.`
      )
    );
  }
  if (input.missingRequiredTraining || signals.some((signal) => signal.missingRequiredTraining || signal.type === "training_gap")) {
    drivers.push(driver("Training readiness gap", "training", "high", "Required or task-specific training appears missing or expired."));
  }
  if (input.missingRequiredPermit || signals.some((signal) => signal.missingRequiredPermit || signal.type === "permit_gap")) {
    drivers.push(driver("Permit readiness gap", "permit", "high", "Permit coverage appears missing, expired, or not linked to the high-risk task."));
  }
  if (input.overdueCorrectiveActionForHazard || signals.some(isOverdue)) {
    drivers.push(driver("Overdue corrective action tied to hazard", "corrective_action", "high", "An open or overdue corrective action may be tied to the same hazard exposure."));
  }
  if (params.gapEscalation) {
    drivers.push(driver("High-risk task gap escalation", "inspection", "high", "High-risk work has a missing training, permit, competent-person review, or related overdue corrective action."));
  }
  if (params.missingData.length > 0 || breakdown.dataConfidenceConcern >= 3) {
    drivers.push(driver("Data quality concern", "data_quality", impactForScore(breakdown.dataConfidenceConcern), `Missing or uncertain data: ${params.missingData.join(", ") || "source coverage"}.`));
  }
  return drivers.slice(0, 10);
}

export function assessSafetyRisk(input: SafetyAiInput): SafetyAiAssessment {
  const signals = input.signals ?? [];
  const missingData = defaultMissingData(input);
  const hazardAnalysis = analyzeHazardProfiles(input, signals);
  const severity = deriveSeverity(input, signals, hazardAnalysis);
  const likelihood = deriveLikelihood(input, signals, hazardAnalysis);
  const exposureFrequency = deriveExposureFrequency(input, signals);
  const controlGap = deriveControlGap(input, signals, hazardAnalysis);
  const dataConfidenceConcern = deriveDataConfidenceConcern(input, signals, missingData);
  const weighted = weightedScore({ severity, likelihood, exposureFrequency, controlGap, dataConfidenceConcern });
  const breakdown: SafetyAiScoreBreakdown = {
    severity,
    likelihood,
    exposureFrequency,
    controlGap,
    dataConfidenceConcern,
    weightedAverage: weighted.weightedAverage,
  };
  const imminentDanger = Boolean(input.imminentDanger || signals.some((signal) => signal.imminentDanger));
  const fatalOverride = Boolean(
    (input.fatalityOrCatastrophicPotential || signals.some((signal) => signal.fatalityOrCatastrophicPotential)) &&
      controlGap >= 4
  );
  const criticalControlOverride = hazardAnalysis.highConsequenceGap && controlGap >= 4;
  const highRiskTask = Boolean(input.highRiskWorkCategories?.length || signals.some((signal) => signal.highRisk || signal.type === "high_risk_work"));
  const gapEscalation = Boolean(
    highRiskTask &&
      (input.missingRequiredTraining ||
        input.missingRequiredPermit ||
        input.missingCompetentPersonReview ||
        input.overdueCorrectiveActionForHazard ||
        signals.some((signal) =>
          Boolean(
            signal.missingRequiredTraining ||
              signal.missingRequiredPermit ||
              signal.missingCompetentPersonReview ||
              signal.overdueCorrectiveAction ||
              isOverdue(signal)
          )
        ))
  );

  let level = classifySafetyRisk(weighted.score);
  if (gapEscalation) level = increaseLevel(level);
  if (criticalControlOverride && (level === "low" || level === "moderate")) level = "high";
  if (fatalOverride || imminentDanger || (criticalControlOverride && severity >= 5)) level = "critical";

  const score = Math.max(weighted.score, minimumScoreForLevel(level));
  const confidence = confidenceFor(input, signals, missingData, dataConfidenceConcern);
  const topDrivers = buildDrivers({
    input,
    signals,
    breakdown,
    missingData,
    hazardAnalysis,
    imminentDanger,
    fatalOverride,
    gapEscalation,
  });
  const escalationRequired = level === "high" || level === "critical";
  const stopWorkReviewRecommended = level === "critical" || imminentDanger;
  const actionTimeframe = stopWorkReviewRecommended
    ? "immediate"
    : escalationRequired
      ? "before_work_continues"
      : level === "moderate"
        ? "same_shift"
        : "routine";
  const recommendations = buildSafetyRecommendations({
    input,
    level,
    drivers: topDrivers,
    stopWorkReviewRecommended,
  });
  const explanation = buildSafetyExplanation({
    score,
    level,
    confidence,
    drivers: topDrivers,
    missingData,
    breakdown,
  });
  const missingRequiredTraining = Boolean(input.missingRequiredTraining || signals.some((signal) => signal.missingRequiredTraining || signal.type === "training_gap"));
  const missingRequiredPermit = Boolean(input.missingRequiredPermit || signals.some((signal) => signal.missingRequiredPermit || signal.type === "permit_gap"));
  const missingCompetentPersonReview = Boolean(input.missingCompetentPersonReview || signals.some((signal) => signal.missingCompetentPersonReview));
  const humanApprovalReasonValue = humanApprovalReason({
    level,
    escalationRequired,
    stopWorkReviewRecommended,
    imminentDanger,
    missingRequiredTraining,
    missingRequiredPermit,
    missingCompetentPersonReview,
    criticalControlGaps: hazardAnalysis.criticalControlGaps,
  });
  const humanApprovalRequired = Boolean(humanApprovalReasonValue);
  const scoreExplanation = buildScoreExplanation({
    score,
    level,
    confidence,
    topDrivers,
    signals,
    missingData,
    recommendations,
    actionTimeframe,
    humanApprovalRequired,
    humanApprovalReason: humanApprovalReasonValue,
  });
  const controlRecommendations = buildSafetyControlRecommendations({
    input,
    level,
    drivers: topDrivers,
    signals,
    missingInformation: missingData,
    confidence,
  });

  return {
    score,
    level,
    confidence,
    scoreExplanation,
    topDrivers,
    recommendations,
    controlRecommendations,
    escalationRequired,
    stopWorkReviewRecommended,
    humanApprovalRequired,
    humanApprovalReason: humanApprovalReasonValue,
    explanation,
    missingData,
    criticalControlGaps: hazardAnalysis.criticalControlGaps,
    reviewTriggers: hazardAnalysis.reviewTriggers,
    actionTimeframe,
  };
}

export { classifySafetyRisk };
