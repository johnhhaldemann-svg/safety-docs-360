import type {
  AiSafetyActionQueue,
  AiSafetyActionQueueItem,
  AiSafetyCalibrationSummary,
  AiSafetyFeedbackInfluence,
  AiSafetyMemoryInfluence,
} from "@/lib/aiSafetyActionQueue";
import type { AiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";
import type {
  DailyRiskBriefing,
  PredictiveSafetyEvidenceRef,
} from "@/lib/predictiveSafetyEngine";
import type { GusPhotoReviewOutput } from "@/lib/gus/gusTypes";
import type {
  SafetyAiAssessment,
  SafetyAiConfidence,
  SafetyRiskLevel,
} from "@/lib/safety-ai/types";

export type AiSafetyReasoningEvidence = {
  label: string;
  detail: string;
  source: string;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
};

export type AiSafetyReasoningHypothesis = {
  id: string;
  label: string;
  riskLevel: SafetyRiskLevel;
  confidence: SafetyAiConfidence;
  basis: string;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
  missingInformation: string[];
};

export type AiSafetyReasoningNextBestAction = {
  id: string;
  priority: "routine" | "same_shift" | "before_work" | "immediate";
  title: string;
  detail: string;
  ownerRole: AiSafetyActionQueueItem["ownerRole"] | "safety_manager";
  targetHref: string | null;
  humanReviewRequired: boolean;
  reason: string;
};

export type AiSafetyDecisionQuality = {
  score: number;
  level: "low" | "medium" | "high";
  evidenceCoverage: number;
  missingDataBurden: number;
  conflictingSignalCount: number;
  feedbackDirection: AiSafetyFeedbackInfluence["confidenceAdjustment"];
  calibrationSupport: "supported" | "limited" | "insufficient_data";
  humanReviewSeverity: SafetyRiskLevel;
};

export type AiSafetyUncertaintySummary = {
  level: "low" | "medium" | "high";
  summary: string;
  drivers: string[];
};

export type AiSafetyFieldEvidenceSignal = {
  id: string;
  source: "gus_photo_review" | "field_note";
  sourceKey?: string;
  persistedRecommendationId?: string | null;
  jobsiteId?: string | null;
  userNote?: string | null;
  linkedWorkItemId?: string | null;
  linkedWorkTitle?: string | null;
  linkedConflictId?: string | null;
  linkedConflictTitle?: string | null;
  riskLevel: SafetyRiskLevel | "unknown";
  confidence: SafetyAiConfidence;
  concerns: string[];
  criticalFlags: string[];
  missingInformation: string[];
  recommendedControls: string[];
  nextActions: string[];
  limitations: string[];
  evidenceRefs: PredictiveSafetyEvidenceRef[];
  needsFieldVerification: true;
};

export type AiSafetyOperatingPlan = {
  generatedAt: string;
  headline: string;
  priorities: string[];
  followUps: string[];
  morningBriefing: string[];
  noExternalNotifications: true;
};

export type AiSafetyReasoningFrame = {
  goal: string;
  hypotheses: AiSafetyReasoningHypothesis[];
  supportingEvidence: AiSafetyReasoningEvidence[];
  conflictingEvidence: AiSafetyReasoningEvidence[];
  missingInformation: string[];
  uncertainty: AiSafetyUncertaintySummary;
  decisionBasis: string[];
  nextBestActions: AiSafetyReasoningNextBestAction[];
  humanReviewRequired: boolean;
  doNotClaim: string[];
  decisionQuality: AiSafetyDecisionQuality;
  operatingPlan: AiSafetyOperatingPlan;
  fieldEvidenceSignals: AiSafetyFieldEvidenceSignal[];
};

export type BuildAiSafetyReasoningFrameInput = {
  safetyAiAssessment: SafetyAiAssessment;
  dailyBriefing: DailyRiskBriefing;
  conflictMap: AiSafetyConflictMap;
  actionQueue: AiSafetyActionQueue;
  memoryInfluence: AiSafetyMemoryInfluence;
  feedbackInfluence: AiSafetyFeedbackInfluence;
  calibrationSummary: AiSafetyCalibrationSummary;
  fieldEvidenceSignals?: AiSafetyFieldEvidenceSignal[];
  now?: Date;
};

const RISK_RANK: Record<SafetyRiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const DO_NOT_CLAIM = [
  "Do not approve permits or release work.",
  "Do not declare final OSHA compliance.",
  "Do not provide legal advice.",
  "Do not claim work is safe, cleared, or guaranteed.",
  "Do not replace safety-manager, supervisor, or competent-person judgment.",
];

function riskMax(a: SafetyRiskLevel, b: SafetyRiskLevel): SafetyRiskLevel {
  return RISK_RANK[b] > RISK_RANK[a] ? b : a;
}

function riskFromPhoto(level: GusPhotoReviewOutput["riskLevel"]): SafetyRiskLevel | "unknown" {
  if (level === "critical" || level === "high" || level === "moderate" || level === "low") return level;
  return "unknown";
}

function confidenceFromNumber(value: number | null | undefined): SafetyAiConfidence {
  const normalized = Number(value ?? 0);
  if (normalized >= 0.78) return "high";
  if (normalized >= 0.48) return "medium";
  return "low";
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function unique(values: Array<string | null | undefined>, limit = 12) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const item = clean(value);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function uniqueRefs(refs: PredictiveSafetyEvidenceRef[], limit = 10) {
  const seen = new Set<string>();
  const out: PredictiveSafetyEvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.sourceModule}:${ref.sourceId}:${ref.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (out.length >= limit) break;
  }
  return out;
}

function nextPriority(item: AiSafetyActionQueueItem): AiSafetyReasoningNextBestAction["priority"] {
  if (item.priority === "critical") return "immediate";
  if (item.priority === "high" || item.humanApprovalRequired) return "before_work";
  if (item.priority === "medium") return "same_shift";
  return "routine";
}

function buildHypotheses(input: BuildAiSafetyReasoningFrameInput): AiSafetyReasoningHypothesis[] {
  const topWork = input.dailyBriefing.highRiskWork.slice(0, 4).map((work): AiSafetyReasoningHypothesis => ({
    id: `work-${work.id}`,
    label: `${work.title} may need pre-start intervention.`,
    riskLevel: work.riskLevel,
    confidence: work.assessment.confidence,
    basis: work.scoreExplanation.reason,
    evidenceRefs: work.evidenceRefs,
    missingInformation: unique([...work.scoreExplanation.missingInformation, ...work.assessment.missingData], 6),
  }));
  const conflicts = input.conflictMap.findings.slice(0, 4).map((conflict): AiSafetyReasoningHypothesis => ({
    id: `conflict-${conflict.id}`,
    label: `${conflict.title} may create a workface conflict.`,
    riskLevel: conflict.riskLevel,
    confidence: conflict.confidence,
    basis: conflict.reason,
    evidenceRefs: conflict.evidenceRefs,
    missingInformation: conflict.missingInformation,
  }));
  const field = (input.fieldEvidenceSignals ?? []).slice(0, 3).map((signal): AiSafetyReasoningHypothesis => ({
    id: `field-${signal.id}`,
    label: "Field/photo evidence may indicate visible hazards needing verification.",
    riskLevel: signal.riskLevel === "unknown" ? "moderate" : signal.riskLevel,
    confidence: signal.confidence,
    basis: unique([...signal.criticalFlags, ...signal.concerns], 4).join("; ") || "Photo review output is available as field evidence only.",
    evidenceRefs: signal.evidenceRefs,
    missingInformation: unique([
      ...signal.missingInformation,
      "Field verification is required before acting on photo evidence.",
    ], 6),
  }));
  return [...topWork, ...conflicts, ...field].slice(0, 10);
}

function buildSupportingEvidence(input: BuildAiSafetyReasoningFrameInput): AiSafetyReasoningEvidence[] {
  const topDrivers = input.safetyAiAssessment.topDrivers.slice(0, 4).map((driver): AiSafetyReasoningEvidence => ({
    label: driver.label,
    detail: driver.explanation,
    source: `safety_ai.${driver.category}`,
    evidenceRefs: [],
  }));
  const workEvidence = input.dailyBriefing.highRiskWork.slice(0, 4).map((work): AiSafetyReasoningEvidence => ({
    label: work.title,
    detail: work.whyItMatters,
    source: "daily_briefing.high_risk_work",
    evidenceRefs: work.evidenceRefs,
  }));
  const conflictEvidence = input.conflictMap.findings.slice(0, 4).map((conflict): AiSafetyReasoningEvidence => ({
    label: conflict.title,
    detail: conflict.reason,
    source: `conflict_map.${conflict.type}`,
    evidenceRefs: conflict.evidenceRefs,
  }));
  const fieldEvidence = (input.fieldEvidenceSignals ?? []).slice(0, 3).map((signal): AiSafetyReasoningEvidence => ({
    label: "Gus photo review field evidence",
    detail: unique([...signal.criticalFlags, ...signal.concerns, ...signal.limitations], 5).join("; ") || "Photo review output needs field verification.",
    source: signal.source,
    evidenceRefs: signal.evidenceRefs,
  }));
  return [...topDrivers, ...workEvidence, ...conflictEvidence, ...fieldEvidence].slice(0, 14);
}

function buildConflictingEvidence(input: BuildAiSafetyReasoningFrameInput): AiSafetyReasoningEvidence[] {
  const rows: AiSafetyReasoningEvidence[] = [];
  if (input.feedbackInfluence.confidenceAdjustment === "decrease") {
    rows.push({
      label: "Reviewer feedback lowered confidence",
      detail: input.feedbackInfluence.learningSignals[0] ?? input.feedbackInfluence.summary,
      source: "feedback_influence",
      evidenceRefs: [],
    });
  }
  if (input.calibrationSummary.status === "needs_outcome_data") {
    rows.push({
      label: "Calibration needs outcome data",
      detail: input.calibrationSummary.summary,
      source: "calibration",
      evidenceRefs: [],
    });
  }
  for (const signal of input.fieldEvidenceSignals ?? []) {
    if (signal.limitations.length > 0 || signal.riskLevel === "unknown") {
      rows.push({
        label: "Photo evidence has limitations",
        detail: unique([...signal.limitations, ...signal.missingInformation], 4).join("; "),
        source: signal.source,
        evidenceRefs: signal.evidenceRefs,
      });
    }
  }
  return rows.slice(0, 8);
}

function buildNextBestActions(input: BuildAiSafetyReasoningFrameInput): AiSafetyReasoningNextBestAction[] {
  const queueActions = input.actionQueue.items.slice(0, 6).map((item): AiSafetyReasoningNextBestAction => ({
    id: `queue-${item.id}`,
    priority: nextPriority(item),
    title: item.title,
    detail: item.recommendedControl,
    ownerRole: item.ownerRole,
    targetHref: item.targetHref,
    humanReviewRequired: item.humanApprovalRequired,
    reason: item.humanApprovalReason ?? item.detail,
  }));
  const fieldActions = (input.fieldEvidenceSignals ?? []).flatMap((signal) =>
    signal.nextActions.slice(0, 2).map((action, index): AiSafetyReasoningNextBestAction => ({
      id: `field-${signal.id}-${index}`,
      priority: signal.riskLevel === "critical" ? "immediate" : signal.riskLevel === "high" ? "before_work" : "same_shift",
      title: "Verify photo-review finding in the field",
      detail: action,
      ownerRole: "safety_manager",
      targetHref: null,
      humanReviewRequired: true,
      reason: "Photo review is evidence input only and needs field verification.",
    })),
  );
  const missingDataAction =
    input.dailyBriefing.missingData.length > 0
      ? [{
          id: "missing-data-verification",
          priority: "before_work" as const,
          title: "Verify missing AI Engine inputs",
          detail: input.dailyBriefing.missingData.slice(0, 4).join("; "),
          ownerRole: "safety_manager" as const,
          targetHref: "/command-center",
          humanReviewRequired: input.dailyBriefing.escalationRequired || input.dailyBriefing.stopWorkReviewRecommended,
          reason: "Missing information lowers certainty and should be resolved before relying on the recommendation.",
        }]
      : [];
  return [...queueActions, ...fieldActions, ...missingDataAction].slice(0, 10);
}

function decisionQuality(input: BuildAiSafetyReasoningFrameInput, conflictingCount: number, missingCount: number): AiSafetyDecisionQuality {
  const evidenceCount =
    input.safetyAiAssessment.scoreExplanation.dataInputs.length +
    input.dailyBriefing.evidenceRefs.length +
    input.conflictMap.findings.reduce((sum, item) => sum + item.evidenceRefs.length, 0) +
    input.actionQueue.items.reduce((sum, item) => sum + item.evidenceRefs.length, 0);
  const sourceFamilies = [
    input.safetyAiAssessment.scoreExplanation.dataInputs.length > 0,
    input.dailyBriefing.highRiskWork.length > 0,
    input.conflictMap.findings.length > 0,
    input.actionQueue.items.length > 0,
    input.memoryInfluence.memoryItemCount > 0,
    input.feedbackInfluence.feedbackSignalCount > 0,
    input.calibrationSummary.status === "active",
    (input.fieldEvidenceSignals ?? []).length > 0,
  ].filter(Boolean).length;
  const evidenceCoverage = Math.min(100, Math.round((sourceFamilies / 8) * 100 + Math.min(20, evidenceCount)));
  const missingDataBurden = Math.min(100, missingCount * 8);
  const feedbackPenalty = input.feedbackInfluence.confidenceAdjustment === "decrease" ? 10 : 0;
  const feedbackBoost = input.feedbackInfluence.confidenceAdjustment === "increase" ? 5 : 0;
  const calibrationSupport = input.calibrationSummary.status === "active" ? "supported" : "insufficient_data";
  const calibrationPenalty = calibrationSupport === "supported" ? 0 : 10;
  const humanReviewSeverity = [
    input.safetyAiAssessment.level,
    ...input.dailyBriefing.highRiskWork.map((work) => work.riskLevel),
    ...input.conflictMap.findings.map((conflict) => conflict.riskLevel),
  ].reduce<SafetyRiskLevel>((max, level) => riskMax(max, level), "low");
  const severityPenalty = humanReviewSeverity === "critical" ? 4 : humanReviewSeverity === "high" ? 2 : 0;
  const score = Math.max(
    0,
    Math.min(100, Math.round(evidenceCoverage - missingDataBurden * 0.45 - conflictingCount * 7 - feedbackPenalty - calibrationPenalty - severityPenalty + feedbackBoost)),
  );
  return {
    score,
    level: score >= 75 ? "high" : score >= 50 ? "medium" : "low",
    evidenceCoverage,
    missingDataBurden,
    conflictingSignalCount: conflictingCount,
    feedbackDirection: input.feedbackInfluence.confidenceAdjustment,
    calibrationSupport,
    humanReviewSeverity,
  };
}

function uncertaintySummary(missingInformation: string[], conflictingEvidence: AiSafetyReasoningEvidence[]): AiSafetyUncertaintySummary {
  const drivers = unique([
    ...missingInformation.slice(0, 5),
    ...conflictingEvidence.map((item) => item.label),
  ], 8);
  const level = missingInformation.length >= 5 || conflictingEvidence.length >= 3 ? "high" : missingInformation.length > 0 || conflictingEvidence.length > 0 ? "medium" : "low";
  return {
    level,
    summary:
      level === "high"
        ? "Decision certainty is limited by missing or conflicting signals; field verification should come first."
        : level === "medium"
          ? "Decision certainty is usable for prioritization, but selected inputs should be verified before work proceeds."
          : "Decision certainty is supported by the loaded evidence, while recommendations remain advisory.",
    drivers,
  };
}

function operatingPlan(input: BuildAiSafetyReasoningFrameInput, nextBestActions: AiSafetyReasoningNextBestAction[]): AiSafetyOperatingPlan {
  const urgent = input.actionQueue.items.filter((item) => item.priority === "critical" || item.priority === "high");
  const followUps = unique([
    ...urgent.slice(0, 4).map((item) => `Follow up on ${item.title}: ${item.approvalState.replace(/_/g, " ")}.`),
    ...input.conflictMap.findings
      .filter((finding) => finding.riskLevel === "critical" || finding.riskLevel === "high")
      .slice(0, 3)
      .map((finding) => `Verify conflict controls for ${finding.title}.`),
  ], 8);
  const priorities = unique(nextBestActions.map((item) => `${item.title}: ${item.detail}`), 6);
  return {
    generatedAt: input.now?.toISOString() ?? input.dailyBriefing.generatedAt,
    headline:
      nextBestActions.length > 0
        ? `${nextBestActions.length} next-best AI safety action${nextBestActions.length === 1 ? "" : "s"} are ready for review.`
        : "No next-best actions were generated from the current evidence.",
    priorities,
    followUps,
    morningBriefing: unique([...input.actionQueue.morningBriefing, ...priorities.slice(0, 3)], 8),
    noExternalNotifications: true,
  };
}

export function fieldEvidenceSignalsFromGusPhotoReviews(photoReviews: GusPhotoReviewOutput[] | undefined): AiSafetyFieldEvidenceSignal[] {
  return (photoReviews ?? []).map((review, index): AiSafetyFieldEvidenceSignal => ({
    id: `gus-photo-review-${index + 1}`,
    source: "gus_photo_review",
    riskLevel: riskFromPhoto(review.riskLevel),
    confidence: confidenceFromNumber(review.confidence),
    concerns: review.concerns,
    criticalFlags: review.criticalFlags,
    missingInformation: unique([
      ...review.missingInformation,
      ...review.limitations,
      "Field verification is required before treating photo-review concerns as field-verified conditions.",
    ], 8),
    recommendedControls: review.recommendedControls,
    nextActions: review.nextActions,
    limitations: review.limitations,
    evidenceRefs: [],
    needsFieldVerification: true,
  }));
}

export function buildAiSafetyReasoningFrame(input: BuildAiSafetyReasoningFrameInput): AiSafetyReasoningFrame {
  const hypotheses = buildHypotheses(input);
  const supportingEvidence = buildSupportingEvidence(input);
  const conflictingEvidence = buildConflictingEvidence(input);
  const missingInformation = unique([
    ...input.safetyAiAssessment.missingData,
    ...input.safetyAiAssessment.scoreExplanation.missingInformation,
    ...input.dailyBriefing.missingData,
    ...input.conflictMap.missingData,
    ...input.actionQueue.missingData,
    ...input.memoryInfluence.missingMemoryData,
    ...input.feedbackInfluence.missingFeedbackData,
    ...input.calibrationSummary.missingOutcomeData,
    ...(input.fieldEvidenceSignals ?? []).flatMap((signal) => signal.missingInformation),
  ], 14);
  const uncertainty = uncertaintySummary(missingInformation, conflictingEvidence);
  const nextBestActions = buildNextBestActions(input);
  const humanReviewRequired =
    input.safetyAiAssessment.humanApprovalRequired ||
    input.safetyAiAssessment.escalationRequired ||
    input.safetyAiAssessment.stopWorkReviewRecommended ||
    input.dailyBriefing.escalationRequired ||
    input.dailyBriefing.stopWorkReviewRecommended ||
    input.actionQueue.approvalRequiredCount > 0 ||
    input.conflictMap.findings.some((finding) => finding.humanApprovalRequired || finding.riskLevel === "critical") ||
    (input.fieldEvidenceSignals ?? []).some((signal) => signal.riskLevel === "critical" || signal.criticalFlags.length > 0);
  const quality = decisionQuality(input, conflictingEvidence.length, missingInformation.length);
  const plan = operatingPlan(input, nextBestActions);

  return {
    goal: "Prioritize today and tomorrow jobsite safety work using evidence-grounded, rules-first reasoning before incidents happen.",
    hypotheses,
    supportingEvidence: supportingEvidence.map((item) => ({ ...item, evidenceRefs: uniqueRefs(item.evidenceRefs, 6) })),
    conflictingEvidence: conflictingEvidence.map((item) => ({ ...item, evidenceRefs: uniqueRefs(item.evidenceRefs, 6) })),
    missingInformation,
    uncertainty,
    decisionBasis: unique([
      input.safetyAiAssessment.scoreExplanation.reason,
      input.dailyBriefing.headline,
      input.conflictMap.summary,
      input.actionQueue.headline,
      input.memoryInfluence.summary,
      input.feedbackInfluence.summary,
      input.calibrationSummary.summary,
      ...(input.fieldEvidenceSignals ?? []).length > 0
        ? ["Gus photo review outputs are treated as field evidence signals that need verification."]
        : [],
    ], 10),
    nextBestActions,
    humanReviewRequired,
    doNotClaim: DO_NOT_CLAIM,
    decisionQuality: quality,
    operatingPlan: plan,
    fieldEvidenceSignals: input.fieldEvidenceSignals ?? [],
  };
}
