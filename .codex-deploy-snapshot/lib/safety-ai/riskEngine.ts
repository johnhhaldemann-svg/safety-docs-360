import { buildSafetyExplanation } from "@/lib/safety-ai/explanations";
import { buildSafetyRecommendations } from "@/lib/safety-ai/recommendations";
import type {
  RiskDriver,
  RiskDriverImpact,
  SafetyAiAssessment,
  SafetyAiInput,
  SafetyAiScoreBreakdown,
  SafetyAiSignal,
  SafetyRiskLevel,
} from "@/lib/safety-ai/types";

const SCORE_WEIGHTS = {
  severity: 0.4,
  likelihood: 0.25,
  exposureFrequency: 0.15,
  controlGap: 0.1,
  dataConfidenceConcern: 0.1,
} as const;

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

function deriveSeverity(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  const explicit = input.scores?.severity;
  if (explicit != null) return score1to5(explicit);
  if (input.fatalityOrCatastrophicPotential || signals.some((signal) => signal.fatalityOrCatastrophicPotential)) return 5;
  const signalSeverity = Math.max(1, ...signals.map((signal) => score1to5(signal.severity, 1)));
  if (input.highRiskWorkCategories?.length || signals.some((signal) => signal.highRisk)) return Math.max(signalSeverity, 4);
  return signalSeverity;
}

function deriveLikelihood(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  const explicit = input.scores?.likelihood;
  if (explicit != null) return score1to5(explicit);
  const openSignals = signals.filter((signal) => isOpenStatus(signal.status)).length;
  const severeSignals = signals.filter((signal) => score1to5(signal.severity, 1) >= 4).length;
  const incidentSignals = signals.filter((signal) => signal.type === "incident" || signal.type === "near_miss").length;
  const explicitLikelihood = Math.max(1, ...signals.map((signal) => score1to5(signal.likelihood, 1)));
  const volumeLikelihood = 1 + Math.min(4, Math.floor((openSignals + severeSignals + incidentSignals) / 2));
  return clamp(Math.max(explicitLikelihood, volumeLikelihood), 1, 5);
}

function deriveExposureFrequency(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  const explicit = input.scores?.exposureFrequency;
  if (explicit != null) return score1to5(explicit);
  const crewExposure = clamp(Math.ceil((input.crewExposure ?? Math.max(0, ...signals.map((signal) => signal.crewSize ?? 0))) / 5), 0, 4);
  const scheduledHighRisk = signals.filter((signal) => signal.type === "high_risk_work" || signal.highRisk).length;
  const explicitExposure = Math.max(1, ...signals.map((signal) => score1to5(signal.exposureFrequency, 1)));
  return clamp(Math.max(explicitExposure, 1 + crewExposure, scheduledHighRisk >= 2 ? 4 : 1), 1, 5);
}

function deriveControlGap(input: SafetyAiInput, signals: SafetyAiSignal[]) {
  const explicit = input.scores?.controlGap;
  if (explicit != null) return score1to5(explicit);
  const effectiveness = input.controlEffectiveness;
  let base = effectiveness === "missing" ? 5 : effectiveness === "ineffective" ? 5 : effectiveness === "partial" ? 3 : effectiveness === "effective" ? 1 : 2;
  if (signals.some((signal) => score1to5(signal.controlGap, 0) >= 4)) base = Math.max(base, 4);
  if (signals.some((signal) => signal.missingRequiredPermit || signal.missingRequiredTraining || signal.missingCompetentPersonReview)) base = Math.max(base, 4);
  if (signals.some((signal) => signal.type === "corrective_action" && isOpenStatus(signal.status))) base = Math.max(base, 3);
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

function buildDrivers(params: {
  input: SafetyAiInput;
  signals: SafetyAiSignal[];
  breakdown: SafetyAiScoreBreakdown;
  missingData: string[];
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
  const severity = deriveSeverity(input, signals);
  const likelihood = deriveLikelihood(input, signals);
  const exposureFrequency = deriveExposureFrequency(input, signals);
  const controlGap = deriveControlGap(input, signals);
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
  if (fatalOverride || imminentDanger) level = "critical";

  const score = Math.max(weighted.score, minimumScoreForLevel(level));
  const confidence = confidenceFor(input, signals, missingData, dataConfidenceConcern);
  const topDrivers = buildDrivers({
    input,
    signals,
    breakdown,
    missingData,
    imminentDanger,
    fatalOverride,
    gapEscalation,
  });
  const escalationRequired = level === "high" || level === "critical";
  const stopWorkReviewRecommended = level === "critical" || imminentDanger;
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

  return {
    score,
    level,
    confidence,
    topDrivers,
    recommendations,
    escalationRequired,
    stopWorkReviewRecommended,
    explanation,
    missingData,
  };
}

export { classifySafetyRisk };
