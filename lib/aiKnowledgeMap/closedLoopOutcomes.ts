import { buildClosedLoopSeparationMetadata, requireClosedLoopHumanReview } from "@/lib/aiKnowledgeMap/closedLoop";
import { calculateRiskReductionPoints } from "@/lib/riskActionPlan";
import type { RiskActionPriority } from "@/types/risk-action-plan";

export type CorrectiveActionOutcomeStatus =
  | "risk_reduced"
  | "risk_unchanged"
  | "risk_increased"
  | "issue_returned"
  | "not_enough_data"
  | "pending_verification";

export type ClosedLoopRecommendationRow = {
  id: string;
  company_id?: string | null;
  jobsite_id?: string | null;
  title?: string | null;
  body?: string | null;
  status?: string | null;
  priority?: RiskActionPriority | string | null;
  mitigation_state?: string | null;
  risk_reduction_points?: number | null;
  verification_required?: boolean | null;
  evidence_summary?: unknown;
};

export type ClosedLoopCorrectiveActionRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  severity?: RiskActionPriority | string | null;
  priority?: RiskActionPriority | string | null;
  sif_potential?: boolean | null;
  created_at?: string | null;
  closed_at?: string | null;
  time_to_close_hours?: number | null;
  manager_override_close?: boolean | null;
  manager_override_reason?: string | null;
};

export type ClosedLoopOutcome = {
  recommendationId: string;
  correctiveActionId: string;
  outcomeStatus: CorrectiveActionOutcomeStatus;
  beforeRiskScore: number | null;
  afterRiskScore: number | null;
  riskDelta: number | null;
  riskReductionPoints: number;
  wasEffective: boolean | null;
  issueReturned: boolean;
  daysToClose: number | null;
  confidenceScore: number;
  evidenceSummary: string;
  humanReviewRequired: boolean;
  reviewReasons: string[];
  reviewStatus: "approved_for_audit_only" | "pending_review";
  trustedMemoryWrite: false;
};

export type ClosedLoopLearningEvent = {
  recommendationId: string;
  correctiveActionId: string;
  learningType:
    | "control_effectiveness"
    | "corrective_action_failure"
    | "repeat_hazard"
    | "positive_trend"
    | "not_enough_data";
  patternDetected: string;
  lessonLearned: string;
  recommendedRuleUpdate: string | null;
  confidenceScore: number;
  humanReviewRequired: boolean;
  reviewStatus: "approved_for_audit_only" | "pending_review";
  trustedMemoryWrite: false;
};

const PRIORITY_BASE_RISK: Record<string, number> = {
  low: 20,
  medium: 45,
  moderate: 45,
  high: 70,
  critical: 88,
};

function cleanText(value: unknown, max = 300) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeRiskLevel(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "critical" || raw === "high" || raw === "medium" || raw === "moderate" || raw === "low") return raw;
  return "medium";
}

function riskScoreFromEvidence(evidence: unknown): number | null {
  if (!evidence || typeof evidence !== "object") return null;
  const obj = evidence as Record<string, unknown>;
  const direct = obj.riskScore ?? obj.risk_score ?? obj.beforeRiskScore ?? obj.before_risk_score;
  const score = Number(direct);
  if (Number.isFinite(score)) return clamp(score, 0, 0, 100);
  const nested = obj.riskMemory;
  if (nested && typeof nested === "object") {
    const nestedScore = Number((nested as Record<string, unknown>).score);
    if (Number.isFinite(nestedScore)) return clamp(nestedScore, 0, 0, 100);
  }
  return null;
}

function daysBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Number(Math.max(0, (endMs - startMs) / (1000 * 60 * 60 * 24)).toFixed(2));
}

function isClosed(status: unknown) {
  const normalized = String(status ?? "").toLowerCase();
  return normalized === "verified_closed" || normalized === "closed" || normalized === "resolved" || normalized === "complete" || normalized === "completed";
}

function deriveOutcomeStatus(params: {
  actionClosed: boolean;
  beforeRiskScore: number | null;
  afterRiskScore: number | null;
  managerOverride: boolean;
}): CorrectiveActionOutcomeStatus {
  if (!params.actionClosed) return "pending_verification";
  if (params.beforeRiskScore == null || params.afterRiskScore == null) return "not_enough_data";
  if (params.managerOverride) return "issue_returned";
  if (params.afterRiskScore < params.beforeRiskScore) return "risk_reduced";
  if (params.afterRiskScore > params.beforeRiskScore) return "risk_increased";
  return "risk_unchanged";
}

export function buildClosedLoopOutcomeRecord(params: {
  recommendation: ClosedLoopRecommendationRow;
  correctiveAction: ClosedLoopCorrectiveActionRow;
  evidenceCount?: number | null;
  closureNote?: string | null;
}) {
  const priority = normalizeRiskLevel(params.recommendation.priority ?? params.correctiveAction.priority ?? params.correctiveAction.severity);
  const beforeRiskScore =
    riskScoreFromEvidence(params.recommendation.evidence_summary) ??
    PRIORITY_BASE_RISK[priority] ??
    PRIORITY_BASE_RISK.medium;
  const actionClosed = isClosed(params.correctiveAction.status);
  const riskReductionPoints = actionClosed
    ? calculateRiskReductionPoints({
        priority,
        status: "resolved",
        mitigationState: "resolved",
        verificationRequired: params.recommendation.verification_required,
      })
    : 0;
  const afterRiskScore = actionClosed ? Math.max(0, beforeRiskScore - riskReductionPoints) : null;
  const outcomeStatus = deriveOutcomeStatus({
    actionClosed,
    beforeRiskScore,
    afterRiskScore,
    managerOverride: Boolean(params.correctiveAction.manager_override_close),
  });
  const confidenceScore = actionClosed
    ? clamp(0.72 + Math.min(0.15, (params.evidenceCount ?? 0) * 0.05) - (params.correctiveAction.manager_override_close ? 0.18 : 0), 0.65, 0, 1)
    : 0.45;
  const review = requireClosedLoopHumanReview({
    itemType: "learning_event",
    riskLevel: priority,
    confidenceScore,
    conflictingSource: Boolean(params.correctiveAction.manager_override_close),
  });
  const evidenceSummary = [
    cleanText(params.recommendation.title, 120),
    `Corrective action ${params.correctiveAction.id} is ${actionClosed ? "verified closed" : "not verified closed"}.`,
    `${params.evidenceCount ?? 0} closure evidence item${params.evidenceCount === 1 ? "" : "s"} reviewed.`,
    params.closureNote ? `Closure note: ${cleanText(params.closureNote, 180)}` : null,
    params.correctiveAction.manager_override_close ? "Manager override was used, so learning requires review." : null,
  ].filter(Boolean).join(" ");

  const outcome: ClosedLoopOutcome = {
    recommendationId: params.recommendation.id,
    correctiveActionId: params.correctiveAction.id,
    outcomeStatus,
    beforeRiskScore,
    afterRiskScore,
    riskDelta: afterRiskScore == null ? null : afterRiskScore - beforeRiskScore,
    riskReductionPoints,
    wasEffective: outcomeStatus === "risk_reduced" ? true : outcomeStatus === "pending_verification" || outcomeStatus === "not_enough_data" ? null : false,
    issueReturned: outcomeStatus === "issue_returned",
    daysToClose: daysBetween(params.correctiveAction.created_at, params.correctiveAction.closed_at),
    confidenceScore,
    evidenceSummary,
    humanReviewRequired: review.required,
    reviewReasons: review.reasons,
    reviewStatus: review.required ? "pending_review" : "approved_for_audit_only",
    trustedMemoryWrite: false,
  };
  return outcome;
}

export function buildClosedLoopLearningEvent(outcome: ClosedLoopOutcome): ClosedLoopLearningEvent {
  const learningType =
    outcome.outcomeStatus === "risk_reduced"
      ? "control_effectiveness"
      : outcome.outcomeStatus === "pending_verification" || outcome.outcomeStatus === "not_enough_data"
        ? "not_enough_data"
        : "corrective_action_failure";
  const lessonLearned =
    learningType === "control_effectiveness"
      ? "The linked corrective action was verified closed and risk was reduced. Keep this as an audit learning event until Human Review decides whether it should become trusted memory."
      : learningType === "not_enough_data"
        ? "The system could not verify enough before/after evidence to learn from this recommendation yet."
        : "The linked corrective action did not show a verified risk reduction. Human Review should inspect the controls, evidence, and possible repeat exposure before memory changes.";

  return {
    recommendationId: outcome.recommendationId,
    correctiveActionId: outcome.correctiveActionId,
    learningType,
    patternDetected: `${outcome.outcomeStatus}; before risk ${outcome.beforeRiskScore ?? "unknown"}; after risk ${outcome.afterRiskScore ?? "unknown"}`,
    lessonLearned,
    recommendedRuleUpdate: outcome.humanReviewRequired
      ? "Do not update trusted AI memory until Super Admin Human Review approves this outcome."
      : null,
    confidenceScore: outcome.confidenceScore,
    humanReviewRequired: outcome.humanReviewRequired,
    reviewStatus: outcome.reviewStatus,
    trustedMemoryWrite: false,
  };
}

export function buildClosedLoopEventMetadata(params: {
  outcome: ClosedLoopOutcome;
  learningEvent: ClosedLoopLearningEvent;
}) {
  return {
    closedLoopOutcome: params.outcome,
    closedLoopLearningEvent: params.learningEvent,
    ...buildClosedLoopSeparationMetadata({
      sourceKind: "relationship",
      memoryCategory: "outcome",
      riskLevel: params.outcome.beforeRiskScore != null && params.outcome.beforeRiskScore >= 80 ? "critical" : params.outcome.beforeRiskScore != null && params.outcome.beforeRiskScore >= 60 ? "high" : "moderate",
    }),
    trustedMemoryWrite: false,
    officialMapWriteAllowed: false,
    recommendationUseAllowed: false,
    riskScoringUseAllowed: false,
  };
}
