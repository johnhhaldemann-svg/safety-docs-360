import type {
  DailyRiskBriefing,
  PredictiveSafetyEvidenceRef,
  PredictiveSafetyMemoryItemRow,
  PredictiveSafetyReadinessBlocker,
  PredictiveSafetyWorkItem,
} from "@/lib/predictiveSafetyEngine";
import type { PredictiveRiskMitigationRow } from "@/lib/predictiveRisk";
import type { SafetyRiskLevel } from "@/lib/safety-ai/types";
import type { RiskActionTargetModule } from "@/types/risk-action-plan";
import type { AiSafetyConflictFinding } from "@/lib/aiSafetyConflictMap";
import type { AiSafetyFieldEvidenceSignal } from "@/lib/aiSafetyReasoningFrame";
import {
  canSuppressAiSafetyActionByFeedback,
  feedbackSignalsForAction,
  type AiSafetyFeedbackConfidenceAdjustment,
  type AiSafetyFeedbackSignal,
} from "@/lib/aiSafetyFeedbackInfluence";
import {
  buildAiActionDecisionTriggers,
  type AiActionDecisionTrigger,
} from "@/lib/aiActionDecisionTriggers";

export type AiSafetyApprovalState =
  | "review_required"
  | "assigned"
  | "reviewed"
  | "verified_in_field"
  | "resolved"
  | "dismissed_with_reason";

export type AiSafetyActionCategory =
  | "missing_permit"
  | "missing_or_expired_training"
  | "competent_person_review"
  | "weak_jsa_or_control_gap"
  | "weather_sensitive_work"
  | "open_corrective_action"
  | "repeated_observation_pattern"
  | "workface_conflict_review"
  | "field_evidence_review"
  | "high_risk_work";

export type AiSafetyActionPriority = "low" | "medium" | "high" | "critical";

export type AiSafetyActionQueueItem = {
  id: string;
  sourceKey: string;
  title: string;
  detail: string;
  category: AiSafetyActionCategory;
  riskLevel: SafetyRiskLevel;
  priority: AiSafetyActionPriority;
  ownerRole: "field_supervisor" | "safety_manager" | "competent_person";
  dueAt: string | null;
  approvalState: AiSafetyApprovalState;
  recommendedControl: string;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
  missingInformation: string[];
  humanApprovalRequired: boolean;
  humanApprovalReason: string | null;
  sourceWorkItemId: string | null;
  sourceWorkTitle: string | null;
  jobsiteId: string | null;
  jobsiteName: string | null;
  trade: string | null;
  area: string | null;
  targetModule: RiskActionTargetModule | "weather";
  targetHref: string | null;
  feedbackInfluence: string[];
  feedbackConfidenceAdjustment: AiSafetyFeedbackConfidenceAdjustment;
  memoryInfluence: string[];
  decisionTriggers?: AiActionDecisionTrigger[];
  reasoningMetadata?: {
    decisionQualityScore: number;
    decisionQualityLevel: "low" | "medium" | "high";
    uncertaintyLevel: "low" | "medium" | "high";
    uncertaintySummary: string;
    nextBestActions: string[];
    humanReviewRequired: boolean;
  };
};

export type AiSafetyApprovalSummary = {
  overallState: AiSafetyApprovalState;
  reviewRequiredCount: number;
  assignedCount: number;
  reviewedCount: number;
  verifiedInFieldCount: number;
  resolvedCount: number;
  dismissedWithReasonCount: number;
  humanReviewRequired: boolean;
  humanReviewReason: string | null;
};

export type AiSafetyActionQueue = {
  generatedAt: string;
  headline: string;
  items: AiSafetyActionQueueItem[];
  approvalRequiredCount: number;
  urgentCount: number;
  suppressedDuplicateCount: number;
  suppressedFeedbackCount: number;
  missingData: string[];
  recommendedSupervisorActions: string[];
  morningBriefing: string[];
};

export type AiSafetyFeedbackInfluence = {
  summary: string;
  confidenceAdjustment: "increase" | "neutral" | "decrease";
  fieldUsedCount: number;
  resolvedCount: number;
  dismissedCount: number;
  suppressedDuplicateCount: number;
  feedbackSignalCount: number;
  learningSignals: string[];
  missingFeedbackData: string[];
};

export type AiSafetyMemoryInfluenceItem = {
  label: string;
  category: string;
  basis: "company_policy" | "jobsite_rule" | "uploaded_document" | "platform_rule" | "general_best_practice" | "unknown";
  detail: string;
};

export type AiSafetyMemoryInfluence = {
  summary: string;
  memoryItemCount: number;
  basisCounts: Record<AiSafetyMemoryInfluenceItem["basis"], number>;
  influencedRecommendations: AiSafetyMemoryInfluenceItem[];
  missingMemoryData: string[];
};

export type AiSafetyCalibrationSummary = {
  status: "active" | "needs_outcome_data";
  summary: string;
  predictedHighRiskCount: number;
  predictedCriticalCount: number;
  fieldUsedControlCount: number;
  resolvedActionCount: number;
  riskReductionPoints: number;
  trackedMetrics: string[];
  missingOutcomeData: string[];
};

export type AiSafetyClosedLoopPayload = {
  aiSafetyActionQueue: AiSafetyActionQueue;
  approvalState: AiSafetyApprovalSummary;
  feedbackInfluence: AiSafetyFeedbackInfluence;
  memoryInfluence: AiSafetyMemoryInfluence;
  calibrationSummary: AiSafetyCalibrationSummary;
};

type BuildAiSafetyClosedLoopInput = {
  dailyBriefing: DailyRiskBriefing;
  conflictFindings?: AiSafetyConflictFinding[];
  fieldEvidenceSignals?: AiSafetyFieldEvidenceSignal[];
  riskMitigations?: PredictiveRiskMitigationRow[];
  memoryItems?: PredictiveSafetyMemoryItemRow[];
  feedbackSignals?: AiSafetyFeedbackSignal[];
  now?: Date;
};

const RISK_RANK: Record<SafetyRiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const EMPTY_BASIS_COUNTS: AiSafetyMemoryInfluence["basisCounts"] = {
  company_policy: 0,
  jobsite_rule: 0,
  uploaded_document: 0,
  platform_rule: 0,
  general_best_practice: 0,
  unknown: 0,
};

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: Array<string | null | undefined>, limit = 8) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = String(value ?? "").trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function priorityForRisk(level: SafetyRiskLevel): AiSafetyActionPriority {
  if (level === "critical") return "critical";
  if (level === "high") return "high";
  if (level === "moderate") return "medium";
  return "low";
}

function dueAtForWork(work: PredictiveSafetyWorkItem | null) {
  if (!work?.date) return null;
  return `${work.date}T07:00:00.000Z`;
}

function categoryForBlocker(blocker: PredictiveSafetyReadinessBlocker): AiSafetyActionCategory {
  if (/repeated/i.test(`${blocker.label} ${blocker.detail}`)) return "repeated_observation_pattern";
  if (blocker.type === "permit") return "missing_permit";
  if (blocker.type === "training") return "missing_or_expired_training";
  if (blocker.type === "competent_person") return "competent_person_review";
  if (blocker.type === "weather") return "weather_sensitive_work";
  if (blocker.type === "corrective_action") return "open_corrective_action";
  return "weak_jsa_or_control_gap";
}

function targetForCategory(category: AiSafetyActionCategory): RiskActionTargetModule | "weather" {
  if (category === "missing_permit") return "permit";
  if (category === "missing_or_expired_training") return "training";
  if (category === "open_corrective_action") return "corrective_action";
  if (category === "competent_person_review" || category === "weak_jsa_or_control_gap") return "jsa";
  if (category === "weather_sensitive_work") return "weather";
  if (category === "repeated_observation_pattern") return "field_issue";
  if (category === "workface_conflict_review") return "command_center";
  if (category === "field_evidence_review") return "command_center";
  return "predictive_risk";
}

function ownerForCategory(category: AiSafetyActionCategory): AiSafetyActionQueueItem["ownerRole"] {
  if (category === "competent_person_review") return "competent_person";
  if (category === "missing_permit" || category === "missing_or_expired_training" || category === "open_corrective_action") {
    return "safety_manager";
  }
  return "field_supervisor";
}

function fallbackControlForCategory(category: AiSafetyActionCategory, detail: string) {
  if (category === "missing_permit") return "Verify the required permit is reviewed before work proceeds.";
  if (category === "missing_or_expired_training") return "Verify assigned workers have required training before the task starts.";
  if (category === "competent_person_review") return "Confirm competent-person review and document field verification before entry or exposure.";
  if (category === "weather_sensitive_work") return "Review weather limits, delay criteria, and crew communication before work starts.";
  if (category === "open_corrective_action") return "Review the open corrective action and verify controls in the field before related work proceeds.";
  if (category === "repeated_observation_pattern") return "Brief the crew on the repeated observation pattern and verify corrective controls are working.";
  if (category === "workface_conflict_review") return "Review the predicted workface conflict and verify sequencing, separation, and controls before work proceeds.";
  if (category === "field_evidence_review") return "Review the field evidence summary and verify visible conditions before work proceeds.";
  return detail || "Verify critical controls before work starts.";
}

function sourceKeyForAction(parts: {
  category: AiSafetyActionCategory;
  workId: string | null;
  blockerId?: string | null;
  jobsiteId: string | null;
  dueAt: string | null;
}) {
  return [
    "ai-safety-action",
    parts.category,
    parts.jobsiteId ?? "all-jobsites",
    parts.workId ?? "unlinked-work",
    parts.blockerId ?? "work-review",
    parts.dueAt?.slice(0, 10) ?? "no-due-date",
  ].join(":");
}

function approvalReasonFor(work: PredictiveSafetyWorkItem, category: AiSafetyActionCategory, blocker?: PredictiveSafetyReadinessBlocker) {
  if (work.humanApprovalReason) return work.humanApprovalReason;
  if (work.riskLevel === "critical") return "Critical risk requires safety-manager or competent-person review before work proceeds.";
  if (work.riskLevel === "high") return "High-risk work requires human review and field verification before work proceeds.";
  if (category === "missing_permit") return "Permit-controlled work has a missing or unverified permit.";
  if (category === "missing_or_expired_training") return "Training readiness is missing or expired for scheduled work.";
  if (category === "competent_person_review") return "Competent-person review is required for this exposure.";
  if (category === "weather_sensitive_work") return "Weather-sensitive work requires supervisor review of current conditions.";
  if (category === "workface_conflict_review") return "Predicted workface conflict requires human review and field verification before work proceeds.";
  if (category === "field_evidence_review") return "Field/photo evidence requires human review and field verification before work proceeds.";
  return blocker?.severity === "high" || blocker?.severity === "critical" ? blocker.detail : null;
}

function hasResolvedDuplicate(title: string, work: PredictiveSafetyWorkItem, mitigations: PredictiveRiskMitigationRow[]) {
  const titleKey = normalize(title);
  const workKey = normalize(work.title);
  if (!titleKey && !workKey) return false;
  return mitigations.some((row) => {
    const status = normalize(row.status);
    if (status !== "resolved" && status !== "field used" && status !== "field_used") return false;
    const rowTitle = normalize(row.title);
    return Boolean(rowTitle && (rowTitle.includes(titleKey) || titleKey.includes(rowTitle) || rowTitle.includes(workKey)));
  });
}

function memoryInfluenceForWork(work: PredictiveSafetyWorkItem) {
  return unique(
    work.recommendedControls
      .filter((control) => control.basis !== "general_best_practice" && control.basis !== "unknown")
      .map((control) => `${control.basis.replace(/_/g, " ")} influenced ${control.title}`),
    4,
  );
}

function feedbackInfluenceSummary(signals: AiSafetyFeedbackSignal[]) {
  return unique(
    signals.map((signal) => {
      if (signal.kind === "correct") return "Reviewer feedback marked a similar recommendation correct; confidence is increased.";
      if (signal.kind === "partially_correct") return "Reviewer feedback marked a similar recommendation partially correct; verify missing context.";
      if (signal.kind === "not_correct") return "Reviewer feedback marked a similar recommendation not correct; stronger evidence is required.";
      if (signal.kind === "already_resolved") return "Similar recommendation was already resolved or field-used; verify duplicate status.";
      if (signal.kind === "missing_information") return "Reviewer feedback flagged missing information for similar recommendations.";
      if (signal.kind === "escalate") return "Reviewer feedback requested escalation and human review.";
      return "Reviewer feedback asked to ignore similar non-critical recommendations for this project.";
    }),
    4,
  );
}

function feedbackConfidenceAdjustment(signals: AiSafetyFeedbackSignal[]): AiSafetyFeedbackConfidenceAdjustment {
  if (signals.some((signal) => signal.confidenceAdjustment === "decrease")) return "decrease";
  if (signals.some((signal) => signal.confidenceAdjustment === "increase")) return "increase";
  return "neutral";
}

function applyFeedbackSignals(item: AiSafetyActionQueueItem, signals: AiSafetyFeedbackSignal[]) {
  const matching = feedbackSignalsForAction(item, signals);
  if (matching.length === 0) return { item, suppressed: false };
  const itemWithoutTriggers = item as Omit<AiSafetyActionQueueItem, "decisionTriggers">;
  const forceHumanReview = matching.some((signal) => signal.forceHumanReview);
  const missingInformation = unique([...item.missingInformation, ...matching.flatMap((signal) => signal.missingInformation)], 8);
  const feedbackInfluence = unique([...item.feedbackInfluence, ...feedbackInfluenceSummary(matching)], 6);
  const adjustedItem = withActionDecisionTriggers({
    ...itemWithoutTriggers,
    missingInformation,
    feedbackInfluence,
    feedbackConfidenceAdjustment: feedbackConfidenceAdjustment(matching),
    humanApprovalRequired: item.humanApprovalRequired || forceHumanReview,
    approvalState: item.humanApprovalRequired || forceHumanReview ? "review_required" : item.approvalState,
    humanApprovalReason:
      item.humanApprovalReason ??
      (forceHumanReview ? "Reviewer feedback requested escalation for a similar recommendation; human review is required before work proceeds." : null),
  });
  const suppressByFeedback =
    matching.some((signal) => signal.suppressNonCritical) &&
    canSuppressAiSafetyActionByFeedback(adjustedItem.riskLevel, adjustedItem.category, adjustedItem.humanApprovalRequired);
  return { item: adjustedItem, suppressed: suppressByFeedback };
}

function actionDecisionTriggersForItem(item: Omit<AiSafetyActionQueueItem, "decisionTriggers">): AiActionDecisionTrigger[] {
  return buildAiActionDecisionTriggers({
    source: "ai_action_queue",
    sourceId: item.id,
    sourceText: [
      item.title,
      item.detail,
      item.recommendedControl,
      item.humanApprovalReason ?? "",
      ...item.missingInformation,
      ...item.feedbackInfluence,
    ],
    targetModule: item.targetModule,
    riskLevel: item.riskLevel,
    humanReviewRequired: item.humanApprovalRequired || item.approvalState === "review_required",
    evidenceRefs: item.evidenceRefs,
    limit: 6,
  });
}

function withActionDecisionTriggers(item: Omit<AiSafetyActionQueueItem, "decisionTriggers">): AiSafetyActionQueueItem {
  return {
    ...item,
    decisionTriggers: actionDecisionTriggersForItem(item),
  };
}

function buildActionFromBlocker(
  work: PredictiveSafetyWorkItem,
  blocker: PredictiveSafetyReadinessBlocker,
  riskMitigations: PredictiveRiskMitigationRow[],
): { item: AiSafetyActionQueueItem; suppressed: boolean } {
  const category = categoryForBlocker(blocker);
  const recommendedControl = work.recommendedControls[0]?.recommendedAction ?? fallbackControlForCategory(category, blocker.detail);
  const title = `${blocker.label} - ${work.title}`;
  const suppressDuplicate = work.riskLevel !== "critical" && hasResolvedDuplicate(title, work, riskMitigations);
  const humanApprovalRequired =
    work.humanApprovalRequired ||
    RISK_RANK[work.riskLevel] >= RISK_RANK.high ||
    ["missing_permit", "missing_or_expired_training", "competent_person_review", "weather_sensitive_work"].includes(category);
  const evidenceRefs = blocker.evidenceRefs.length > 0 ? blocker.evidenceRefs : work.evidenceRefs;

  return {
    suppressed: suppressDuplicate,
    item: withActionDecisionTriggers({
      id: `ai-action-${work.id}-${blocker.id}`,
      sourceKey: sourceKeyForAction({
        category,
        workId: work.id,
        blockerId: blocker.id,
        jobsiteId: work.jobsiteId,
        dueAt: dueAtForWork(work),
      }),
      title,
      detail: blocker.detail,
      category,
      riskLevel: work.riskLevel,
      priority: priorityForRisk(work.riskLevel),
      ownerRole: ownerForCategory(category),
      dueAt: dueAtForWork(work),
      approvalState: humanApprovalRequired ? "review_required" : "assigned",
      recommendedControl,
      evidenceRefs,
      missingInformation: unique([...work.scoreExplanation.missingInformation, ...work.assessment.missingData], 6),
      humanApprovalRequired,
      humanApprovalReason: humanApprovalRequired ? approvalReasonFor(work, category, blocker) : null,
      sourceWorkItemId: work.id,
      sourceWorkTitle: work.title,
      jobsiteId: work.jobsiteId,
      jobsiteName: work.jobsiteName,
      trade: work.trade,
      area: work.area,
      targetModule: targetForCategory(category),
      targetHref: evidenceRefs.find((ref) => ref.href)?.href ?? null,
      feedbackInfluence: suppressDuplicate ? ["A similar recommendation was already resolved or field-used for this scope."] : [],
      feedbackConfidenceAdjustment: (suppressDuplicate ? "increase" : "neutral") as AiSafetyFeedbackConfidenceAdjustment,
      memoryInfluence: memoryInfluenceForWork(work),
    }),
  };
}

function buildActionFromWork(work: PredictiveSafetyWorkItem, riskMitigations: PredictiveRiskMitigationRow[]) {
  const recommendedControl = work.recommendedControls[0]?.recommendedAction ?? work.controlsToVerify[0] ?? "Verify critical controls before work starts.";
  const title = `Review high-risk work - ${work.title}`;
  const suppressDuplicate = work.riskLevel !== "critical" && hasResolvedDuplicate(title, work, riskMitigations);
  const humanApprovalRequired = work.humanApprovalRequired || RISK_RANK[work.riskLevel] >= RISK_RANK.high;
  return {
    suppressed: suppressDuplicate,
    item: withActionDecisionTriggers({
      id: `ai-action-${work.id}-high-risk-review`,
      sourceKey: sourceKeyForAction({
        category: "high_risk_work",
        workId: work.id,
        blockerId: "high-risk-review",
        jobsiteId: work.jobsiteId,
        dueAt: dueAtForWork(work),
      }),
      title,
      detail: work.whyItMatters,
      category: "high_risk_work" as const,
      riskLevel: work.riskLevel,
      priority: priorityForRisk(work.riskLevel),
      ownerRole: "field_supervisor" as const,
      dueAt: dueAtForWork(work),
      approvalState: (humanApprovalRequired ? "review_required" : "assigned") as AiSafetyApprovalState,
      recommendedControl,
      evidenceRefs: work.evidenceRefs,
      missingInformation: unique([...work.scoreExplanation.missingInformation, ...work.assessment.missingData], 6),
      humanApprovalRequired,
      humanApprovalReason: humanApprovalRequired ? approvalReasonFor(work, "high_risk_work") : null,
      sourceWorkItemId: work.id,
      sourceWorkTitle: work.title,
      jobsiteId: work.jobsiteId,
      jobsiteName: work.jobsiteName,
      trade: work.trade,
      area: work.area,
      targetModule: "predictive_risk" as const,
      targetHref: work.evidenceRefs.find((ref) => ref.href)?.href ?? "/analytics?tab=risk",
      feedbackInfluence: suppressDuplicate ? ["A similar high-risk review action was already resolved or field-used."] : [],
      feedbackConfidenceAdjustment: (suppressDuplicate ? "increase" : "neutral") as AiSafetyFeedbackConfidenceAdjustment,
      memoryInfluence: memoryInfluenceForWork(work),
    }),
  };
}

function firstWorkForConflict(conflict: AiSafetyConflictFinding, dailyBriefing: DailyRiskBriefing) {
  return dailyBriefing.highRiskWork.find((work) => conflict.affectedWorkItemIds.includes(work.id)) ?? null;
}

function dueAtForConflict(conflict: AiSafetyConflictFinding, dailyBriefing: DailyRiskBriefing) {
  const work = firstWorkForConflict(conflict, dailyBriefing);
  return dueAtForWork(work);
}

function riskForFieldEvidence(signal: AiSafetyFieldEvidenceSignal): SafetyRiskLevel {
  return signal.riskLevel === "unknown" ? "moderate" : signal.riskLevel;
}

function workForFieldEvidence(signal: AiSafetyFieldEvidenceSignal, dailyBriefing: DailyRiskBriefing) {
  if (signal.linkedWorkItemId) {
    return dailyBriefing.highRiskWork.find((work) => work.id === signal.linkedWorkItemId) ?? null;
  }
  if (signal.linkedWorkTitle) {
    return dailyBriefing.highRiskWork.find((work) => normalize(work.title) === normalize(signal.linkedWorkTitle)) ?? null;
  }
  return null;
}

function buildActionFromFieldEvidence(
  signal: AiSafetyFieldEvidenceSignal,
  dailyBriefing: DailyRiskBriefing,
): AiSafetyActionQueueItem {
  const riskLevel = riskForFieldEvidence(signal);
  const work = workForFieldEvidence(signal, dailyBriefing);
  const sourceKey = sourceKeyForAction({
    category: "field_evidence_review",
    workId: work?.id ?? signal.linkedWorkItemId ?? null,
    blockerId: signal.sourceKey ?? signal.id,
    jobsiteId: signal.jobsiteId ?? work?.jobsiteId ?? null,
    dueAt: dueAtForWork(work),
  });
  const recommendedControl =
    signal.recommendedControls[0] ??
    signal.nextActions[0] ??
    fallbackControlForCategory("field_evidence_review", "");
  const concern = signal.criticalFlags[0] ?? signal.concerns[0] ?? "Photo/field evidence needs verification";
  return withActionDecisionTriggers({
    id: `ai-action-field-evidence-${normalize(signal.id || sourceKey).replace(/\s+/g, "-").slice(0, 80)}`,
    sourceKey,
    title: `Verify field evidence - ${work?.title ?? concern}`,
    detail: [
      concern,
      signal.linkedWorkTitle ? `Linked work: ${signal.linkedWorkTitle}.` : null,
      signal.linkedConflictTitle ? `Linked conflict: ${signal.linkedConflictTitle}.` : null,
      "Field/photo evidence is advisory and needs field verification.",
    ].filter(Boolean).join(" "),
    category: "field_evidence_review",
    riskLevel,
    priority: priorityForRisk(riskLevel),
    ownerRole: "safety_manager",
    dueAt: dueAtForWork(work),
    approvalState: "review_required",
    recommendedControl,
    evidenceRefs: signal.evidenceRefs,
    missingInformation: unique(signal.missingInformation, 8),
    humanApprovalRequired: true,
    humanApprovalReason:
      riskLevel === "critical" || signal.criticalFlags.length > 0
        ? "Critical field evidence requires human review and possible stop-work evaluation before work proceeds."
        : "Field/photo evidence requires human review and field verification before work proceeds.",
    sourceWorkItemId: work?.id ?? signal.linkedWorkItemId ?? null,
    sourceWorkTitle: work?.title ?? signal.linkedWorkTitle ?? null,
    jobsiteId: signal.jobsiteId ?? work?.jobsiteId ?? null,
    jobsiteName: work?.jobsiteName ?? null,
    trade: work?.trade ?? null,
    area: work?.area ?? null,
    targetModule: "command_center",
    targetHref: "/command-center",
    feedbackInfluence: [],
    feedbackConfidenceAdjustment: "neutral",
    memoryInfluence: [],
  });
}

function buildActionFromConflict(
  conflict: AiSafetyConflictFinding,
  dailyBriefing: DailyRiskBriefing,
  riskMitigations: PredictiveRiskMitigationRow[],
): { item: AiSafetyActionQueueItem; suppressed: boolean } {
  const work = firstWorkForConflict(conflict, dailyBriefing);
  const title = `Review predicted workface conflict - ${conflict.title}`;
  const suppressDuplicate =
    conflict.riskLevel !== "critical" &&
    (work ? hasResolvedDuplicate(title, work, riskMitigations) : false);
  const humanApprovalRequired =
    conflict.humanApprovalRequired ||
    conflict.riskLevel === "critical" ||
    conflict.riskLevel === "high";
  return {
    suppressed: suppressDuplicate,
    item: withActionDecisionTriggers({
      id: `ai-action-${conflict.id}`,
      sourceKey: sourceKeyForAction({
        category: "workface_conflict_review",
        workId: work?.id ?? conflict.affectedWorkItemIds[0] ?? null,
        blockerId: conflict.sourceKey,
        jobsiteId: conflict.jobsiteId,
        dueAt: dueAtForConflict(conflict, dailyBriefing),
      }),
      title,
      detail: conflict.reason,
      category: "workface_conflict_review",
      riskLevel: conflict.riskLevel,
      priority: priorityForRisk(conflict.riskLevel),
      ownerRole: conflict.type === "readiness_conflict" ? "safety_manager" : "field_supervisor",
      dueAt: dueAtForConflict(conflict, dailyBriefing),
      approvalState: humanApprovalRequired ? "review_required" : "assigned",
      recommendedControl: conflict.recommendedAction,
      evidenceRefs: conflict.evidenceRefs,
      missingInformation: conflict.missingInformation,
      humanApprovalRequired,
      humanApprovalReason:
        humanApprovalRequired
          ? conflict.humanApprovalReason ?? "Predicted workface conflict requires human review before work proceeds."
          : null,
      sourceWorkItemId: work?.id ?? conflict.affectedWorkItemIds[0] ?? null,
      sourceWorkTitle: work?.title ?? conflict.title,
      jobsiteId: conflict.jobsiteId,
      jobsiteName: conflict.jobsiteName,
      trade: conflict.trade,
      area: conflict.area,
      targetModule: "command_center",
      targetHref: "/command-center",
      feedbackInfluence: suppressDuplicate ? ["A similar conflict review action was already resolved or field-used."] : [],
      feedbackConfidenceAdjustment: (suppressDuplicate ? "increase" : "neutral") as AiSafetyFeedbackConfidenceAdjustment,
      memoryInfluence: [],
    }),
  };
}

function buildActionQueue(input: BuildAiSafetyClosedLoopInput): AiSafetyActionQueue {
  const rawItems: AiSafetyActionQueueItem[] = [];
  let suppressedDuplicateCount = 0;
  let suppressedFeedbackCount = 0;
  const feedbackSignals = input.feedbackSignals ?? [];

  for (const work of input.dailyBriefing.highRiskWork) {
    for (const blocker of work.blockers) {
      const { item, suppressed } = buildActionFromBlocker(work, blocker, input.riskMitigations ?? []);
      if (suppressed) {
        suppressedDuplicateCount += 1;
        continue;
      }
      const feedbackApplied = applyFeedbackSignals(item, feedbackSignals);
      if (feedbackApplied.suppressed) {
        suppressedFeedbackCount += 1;
        continue;
      }
      rawItems.push(feedbackApplied.item);
    }

    if (RISK_RANK[work.riskLevel] >= RISK_RANK.high || work.blockers.length === 0) {
      const { item, suppressed } = buildActionFromWork(work, input.riskMitigations ?? []);
      if (suppressed) {
        suppressedDuplicateCount += 1;
        continue;
      }
      const feedbackApplied = applyFeedbackSignals(item, feedbackSignals);
      if (feedbackApplied.suppressed) {
        suppressedFeedbackCount += 1;
        continue;
      }
      rawItems.push(feedbackApplied.item);
    }
  }

  for (const conflict of input.conflictFindings ?? []) {
    if (RISK_RANK[conflict.riskLevel] < RISK_RANK.high) continue;
    const { item, suppressed } = buildActionFromConflict(conflict, input.dailyBriefing, input.riskMitigations ?? []);
    if (suppressed) {
      suppressedDuplicateCount += 1;
      continue;
    }
    const feedbackApplied = applyFeedbackSignals(item, feedbackSignals);
    if (feedbackApplied.suppressed) {
      suppressedFeedbackCount += 1;
      continue;
    }
    rawItems.push(feedbackApplied.item);
  }

  for (const signal of input.fieldEvidenceSignals ?? []) {
    const riskLevel = riskForFieldEvidence(signal);
    if (RISK_RANK[riskLevel] < RISK_RANK.moderate && signal.concerns.length === 0 && signal.criticalFlags.length === 0) continue;
    const item = buildActionFromFieldEvidence(signal, input.dailyBriefing);
    const feedbackApplied = applyFeedbackSignals(item, feedbackSignals);
    if (feedbackApplied.suppressed && item.riskLevel !== "critical") {
      suppressedFeedbackCount += 1;
      continue;
    }
    rawItems.push(feedbackApplied.item);
  }

  const seen = new Set<string>();
  const items = rawItems
    .filter((item) => {
      const key = normalize(`${item.category} ${item.sourceWorkItemId} ${item.title}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const riskDelta = RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel];
      if (riskDelta !== 0) return riskDelta;
      return String(a.dueAt ?? "9999").localeCompare(String(b.dueAt ?? "9999"));
    })
    .slice(0, 24);

  const recommendedSupervisorActions = unique(
    items.map((item) => `${item.title}: ${item.recommendedControl}`),
    6,
  );

  const morningBriefing = unique(
    [
      input.dailyBriefing.headline,
      ...items.slice(0, 3).map((item) => `${item.priority.toUpperCase()}: ${item.title}. ${item.recommendedControl}`),
      ...(input.dailyBriefing.missingData.length > 0
        ? [`Missing data to verify: ${input.dailyBriefing.missingData.slice(0, 3).join("; ")}`]
        : []),
    ],
    6,
  );

  return {
    generatedAt: input.now?.toISOString() ?? input.dailyBriefing.generatedAt,
    headline:
      items.length > 0
        ? `${items.length} AI safety action${items.length === 1 ? "" : "s"} need review, assignment, or field verification.`
        : "No AI safety action queue items were generated from the current briefing.",
    items,
    approvalRequiredCount: items.filter((item) => item.humanApprovalRequired).length,
    urgentCount: items.filter((item) => item.priority === "critical" || item.priority === "high").length,
    suppressedDuplicateCount,
    suppressedFeedbackCount,
    missingData: input.dailyBriefing.missingData,
    recommendedSupervisorActions,
    morningBriefing,
  };
}

function buildApprovalSummary(queue: AiSafetyActionQueue, dailyBriefing: DailyRiskBriefing): AiSafetyApprovalSummary {
  const counts = queue.items.reduce(
    (acc, item) => {
      acc[item.approvalState] += 1;
      return acc;
    },
    {
      review_required: 0,
      assigned: 0,
      reviewed: 0,
      verified_in_field: 0,
      resolved: 0,
      dismissed_with_reason: 0,
    } satisfies Record<AiSafetyApprovalState, number>,
  );
  const humanReviewRequired = counts.review_required > 0 || dailyBriefing.escalationRequired || dailyBriefing.stopWorkReviewRecommended;

  return {
    overallState: humanReviewRequired ? "review_required" : counts.assigned > 0 ? "assigned" : "resolved",
    reviewRequiredCount: counts.review_required,
    assignedCount: counts.assigned,
    reviewedCount: counts.reviewed,
    verifiedInFieldCount: counts.verified_in_field,
    resolvedCount: counts.resolved,
    dismissedWithReasonCount: counts.dismissed_with_reason,
    humanReviewRequired,
    humanReviewReason: humanReviewRequired
      ? "One or more AI Engine actions require safety-manager, supervisor, or competent-person review before work proceeds."
      : null,
  };
}

function buildFeedbackInfluence(queue: AiSafetyActionQueue, mitigations: PredictiveRiskMitigationRow[]): AiSafetyFeedbackInfluence {
  const fieldUsedCount = mitigations.filter((row) => normalize(row.status) === "field used" || normalize(row.status) === "field_used").length;
  const resolvedCount = mitigations.filter((row) => normalize(row.status) === "resolved").length;
  const dismissedCount = mitigations.filter((row) => normalize(row.status) === "dismissed").length;
  const confidenceAdjustment =
    fieldUsedCount + resolvedCount > dismissedCount ? "increase" : dismissedCount > fieldUsedCount + resolvedCount ? "decrease" : "neutral";
  const learningSignals = unique(
    [
      fieldUsedCount > 0 ? `${fieldUsedCount} recommendation${fieldUsedCount === 1 ? "" : "s"} marked field-used increase confidence for similar patterns.` : null,
      resolvedCount > 0 ? `${resolvedCount} resolved recommendation${resolvedCount === 1 ? "" : "s"} suppress duplicate non-critical actions when scope matches.` : null,
      dismissedCount > 0 ? `${dismissedCount} dismissed recommendation${dismissedCount === 1 ? "" : "s"} require stronger evidence for similar future suggestions.` : null,
      queue.suppressedDuplicateCount > 0
        ? `${queue.suppressedDuplicateCount} duplicate non-critical action${queue.suppressedDuplicateCount === 1 ? "" : "s"} suppressed by prior resolution.`
        : null,
      queue.suppressedFeedbackCount > 0
        ? `${queue.suppressedFeedbackCount} non-critical action${queue.suppressedFeedbackCount === 1 ? "" : "s"} suppressed by reviewer feedback.`
        : null,
      ...unique(queue.items.flatMap((item) => item.feedbackInfluence), 4),
    ],
    6,
  );
  const feedbackSignalCount = queue.items.filter((item) => item.feedbackInfluence.length > 0).length + queue.suppressedFeedbackCount;

  return {
    summary:
      learningSignals.length > 0
        ? "Recent AI recommendation outcomes are influencing confidence and duplicate suppression."
        : "No recent recommendation outcome history was available to adjust this briefing.",
    confidenceAdjustment,
    fieldUsedCount,
    resolvedCount,
    dismissedCount,
    suppressedDuplicateCount: queue.suppressedDuplicateCount,
    feedbackSignalCount,
    learningSignals,
    missingFeedbackData:
      mitigations.length === 0 && feedbackSignalCount === 0
        ? ["No recommendation event history or AI-output feedback rows were available in this predictive payload."]
        : [],
  };
}

function basisFromMemoryItem(item: PredictiveSafetyMemoryItemRow): AiSafetyMemoryInfluenceItem["basis"] {
  const source = normalize(`${item.source_type} ${item.source} ${item.title}`);
  if (source.includes("company")) return "company_policy";
  if (source.includes("jobsite") || source.includes("site rule")) return "jobsite_rule";
  if (source.includes("upload") || source.includes("document") || source.includes("memory")) return "uploaded_document";
  return "unknown";
}

function buildMemoryInfluence(
  dailyBriefing: DailyRiskBriefing,
  memoryItems: PredictiveSafetyMemoryItemRow[],
): AiSafetyMemoryInfluence {
  const basisCounts = { ...EMPTY_BASIS_COUNTS };
  const controlItems = dailyBriefing.highRiskWork.flatMap((work) =>
    work.recommendedControls.map((control): AiSafetyMemoryInfluenceItem => {
      basisCounts[control.basis] += 1;
      return {
        label: control.title,
        category: control.hazardFamily,
        basis: control.basis,
        detail: control.verificationRequired,
      };
    }),
  );
  const memoryInfluences = memoryItems.slice(0, 6).map((item): AiSafetyMemoryInfluenceItem => {
    const basis = basisFromMemoryItem(item);
    basisCounts[basis] += 1;
    return {
      label: item.title ?? "Safety memory item",
      category: item.source_type ?? item.source ?? "memory",
      basis,
      detail: item.summary ?? item.body ?? item.content ?? "Memory item available for AI Engine context.",
    };
  });
  const influencedRecommendations = unique([...controlItems, ...memoryInfluences].map((item) => JSON.stringify(item)), 8).map(
    (item) => JSON.parse(item) as AiSafetyMemoryInfluenceItem,
  );

  return {
    summary:
      influencedRecommendations.length > 0
        ? `${influencedRecommendations.length} memory, rule, or control basis signal${influencedRecommendations.length === 1 ? "" : "s"} influenced recommendations.`
        : "No structured company or jobsite memory was available for this briefing.",
    memoryItemCount: memoryItems.length,
    basisCounts,
    influencedRecommendations,
    missingMemoryData:
      memoryItems.length === 0 ? ["No company/jobsite memory items were available; recommendations fall back to platform rules and general best practice."] : [],
  };
}

function buildCalibrationSummary(
  dailyBriefing: DailyRiskBriefing,
  mitigations: PredictiveRiskMitigationRow[],
): AiSafetyCalibrationSummary {
  const predictedHighRiskCount = dailyBriefing.highRiskWork.filter((work) => work.riskLevel === "high" || work.riskLevel === "critical").length;
  const predictedCriticalCount = dailyBriefing.highRiskWork.filter((work) => work.riskLevel === "critical").length;
  const fieldUsedControlCount = mitigations.filter((row) => normalize(row.status) === "field used" || normalize(row.status) === "field_used").length;
  const resolvedActionCount = mitigations.filter((row) => normalize(row.status) === "resolved").length;
  const riskReductionPoints = Math.max(
    0,
    Math.round(
      mitigations.reduce((sum, row) => {
        const status = normalize(row.status);
        if (status !== "field used" && status !== "field_used" && status !== "resolved") return sum;
        return sum + Math.max(0, Number(row.risk_reduction_points ?? 0));
      }, 0),
    ),
  );
  const hasOutcomeSignals = fieldUsedControlCount > 0 || resolvedActionCount > 0;

  return {
    status: hasOutcomeSignals ? "active" : "needs_outcome_data",
    summary: hasOutcomeSignals
      ? "Calibration is using field-used and resolved AI action outcomes while later incidents, observations, and corrective actions accumulate."
      : "Calibration needs later outcome data before the engine can compare predictions against field results.",
    predictedHighRiskCount,
    predictedCriticalCount,
    fieldUsedControlCount,
    resolvedActionCount,
    riskReductionPoints,
    trackedMetrics: [
      "true positives",
      "false positives",
      "missed high-risk events",
      "recommendation acceptance",
      "field-used controls",
      "repeat hazard reduction",
      "risk reduction points",
    ],
    missingOutcomeData: hasOutcomeSignals
      ? ["Incident, near-miss, observation, and corrective-action outcomes are not yet attached to every prediction."]
      : ["No later incident, near-miss, observation, corrective-action, or field-used control outcomes were available for this briefing."],
  };
}

export function buildAiSafetyClosedLoopPayload(input: BuildAiSafetyClosedLoopInput): AiSafetyClosedLoopPayload {
  const queue = buildActionQueue(input);
  return {
    aiSafetyActionQueue: queue,
    approvalState: buildApprovalSummary(queue, input.dailyBriefing),
    feedbackInfluence: buildFeedbackInfluence(queue, input.riskMitigations ?? []),
    memoryInfluence: buildMemoryInfluence(input.dailyBriefing, input.memoryItems ?? []),
    calibrationSummary: buildCalibrationSummary(input.dailyBriefing, input.riskMitigations ?? []),
  };
}
