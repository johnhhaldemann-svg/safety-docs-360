import type { GusPlanStatus } from "@/lib/gus/gusTypes";
import {
  FORBIDDEN_GUS_OUTPUT_PATTERNS,
  isForbiddenGusAction,
} from "@/lib/gus/gusTrustRules";

const DEFAULT_DRAFT_ONLY_STATUS: GusPlanStatus = "blocked_missing_critical_info";

const DRAFT_ONLY_STATUS_MAP: Record<string, GusPlanStatus> = {
  draft_incomplete: "draft_incomplete",
  draft_ready_for_review: "draft_ready_for_review",
  needs_supervisor_review: "needs_supervisor_review",
  needs_competent_person_review: "needs_competent_person_review",
  needs_qualified_person_review: "needs_qualified_person_review",
  blocked_missing_critical_info: "blocked_missing_critical_info",
};

export function sanitizeGusMessage(message: string): string {
  return FORBIDDEN_GUS_OUTPUT_PATTERNS.reduce(
    (nextMessage, rule) => nextMessage.replace(rule.pattern, rule.replacement),
    message
  );
}

export function enforceDraftOnlyStatus(status: string): GusPlanStatus {
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return DRAFT_ONLY_STATUS_MAP[normalized] ?? DEFAULT_DRAFT_ONLY_STATUS;
}

export type GusHumanReviewPlan = {
  humanReviewRequired?: boolean;
  status?: string;
  actionKey?: string;
  [key: string]: unknown;
};

export function requireHumanReview<TPlan extends GusHumanReviewPlan>(plan: TPlan) {
  const nextStatus =
    typeof plan.status === "string"
      ? enforceDraftOnlyStatus(plan.status)
      : "needs_supervisor_review";

  const nextPlan = {
    ...plan,
    humanReviewRequired: true,
    status: nextStatus,
  };

  if (typeof nextPlan.actionKey === "string" && isForbiddenGusAction(nextPlan.actionKey)) {
    return {
      ...nextPlan,
      actionKey: "recommend_review",
    };
  }

  return nextPlan;
}
