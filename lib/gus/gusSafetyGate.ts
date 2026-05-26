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

const GUS_TRIGGER_LANGUAGE_PATTERNS = [
  { pattern: /\bHuman\s+reviewer(s)?\b/g, replacement: (_match: string, plural?: string) => `Safety lead${plural ? "s" : ""}` },
  { pattern: /\bHuman\s+review\b/g, replacement: "Human safety check" },
  { pattern: /\bReview\s+risk\b/g, replacement: "Risk safety check" },
  { pattern: /\bReview\s+critical\s+controls\b/g, replacement: "Critical controls safety check" },
  { pattern: /\bPermit\s+review\b/g, replacement: "Permit safety check" },
  { pattern: /\bVerify\b/g, replacement: "Field-check" },
  { pattern: /\bConfirm\b/g, replacement: "Make sure" },
  { pattern: /\bPause\b/g, replacement: "Do not continue" },
  { pattern: /\bhuman\s+review\b/gi, replacement: "human safety check" },
  { pattern: /\bhuman\s+reviewer(s)?\b/gi, replacement: (_match: string, plural?: string) => `safety lead${plural ? "s" : ""}` },
  { pattern: /\breview\s+risk\b/gi, replacement: "risk safety check" },
  { pattern: /\breview\s+critical\s+controls\b/gi, replacement: "critical controls safety check" },
  { pattern: /\bpermit\s+review\b/gi, replacement: "permit safety check" },
  { pattern: /\baction\s+words?\b/gi, replacement: "safety cue" },
  { pattern: /\bhigh-priority\s+actions?\b/gi, replacement: "high-priority safety items" },
  { pattern: /\bopen\s+actions?\b/gi, replacement: "open safety items" },
  { pattern: /\bcorrective\s+actions?\b/gi, replacement: "corrective safety items" },
  { pattern: /\bnext\s+actions?\b/gi, replacement: "next safe steps" },
  { pattern: /\baction(s)?\b/gi, replacement: (_match: string, plural?: string) => `safe step${plural ? "s" : ""}` },
  { pattern: /\breviewer(s)?\b/gi, replacement: (_match: string, plural?: string) => `safety lead${plural ? "s" : ""}` },
  { pattern: /\breviewed\b/gi, replacement: "checked by a person" },
  { pattern: /\breviewing\b/gi, replacement: "checking" },
  { pattern: /\breview\b/gi, replacement: "human safety check" },
  { pattern: /\bverified\b/gi, replacement: "field checked" },
  { pattern: /\bverifying\b/gi, replacement: "field checking" },
  { pattern: /\bverification\b/gi, replacement: "field check" },
  { pattern: /\bverify\b/gi, replacement: "field-check" },
  { pattern: /\bconfirmed\b/gi, replacement: "made sure" },
  { pattern: /\bconfirming\b/gi, replacement: "making sure" },
  { pattern: /\bconfirmation\b/gi, replacement: "documented check" },
  { pattern: /\bconfirm\b/gi, replacement: "make sure" },
  { pattern: /\binspection(s)?\b/gi, replacement: (_match: string, plural?: string) => `field check${plural ? "s" : ""}` },
  { pattern: /\binspected\b/gi, replacement: "field checked" },
  { pattern: /\binspecting\b/gi, replacement: "field checking" },
  { pattern: /\binspect\b/gi, replacement: "field-check" },
  { pattern: /\bassignment(s)?\b/gi, replacement: (_match: string, plural?: string) => `owner note${plural ? "s" : ""}` },
  { pattern: /\bassigned\b/gi, replacement: "owned" },
  { pattern: /\bassigning\b/gi, replacement: "naming an owner" },
  { pattern: /\bassign\b/gi, replacement: "name an owner for" },
  { pattern: /\bresolved\b/gi, replacement: "closed out with evidence" },
  { pattern: /\bresolve\b/gi, replacement: "close out with evidence" },
  { pattern: /\bdismissal\b/gi, replacement: "set-aside decision" },
  { pattern: /\bdismiss(?:ed|ing)?\b/gi, replacement: "set aside with a reason" },
  { pattern: /\bignor(?:e|ed|ing)\b/gi, replacement: "leave unaddressed" },
  { pattern: /\bpaused\b/gi, replacement: "not continued" },
  { pattern: /\bpausing\b/gi, replacement: "not continuing" },
  { pattern: /\bpause\b/gi, replacement: "do not continue" },
  { pattern: /\bstop[-\s]?work\b/gi, replacement: "do-not-continue" },
  { pattern: /\bstopped\b/gi, replacement: "not continued" },
  { pattern: /\bstopping\b/gi, replacement: "not continuing" },
  { pattern: /\bstop\b/gi, replacement: "do not continue" },
  { pattern: /\bholding\b/gi, replacement: "not continuing" },
  { pattern: /\bhold\b/gi, replacement: "do not continue" },
  { pattern: /\bcleared\b/gi, replacement: "sent through the safety check" },
  { pattern: /\bclear\b/gi, replacement: "send through the safety check" },
  { pattern: /\bescalated\b/gi, replacement: "raised to a safety lead" },
  { pattern: /\bescalation\b/gi, replacement: "safety-lead handoff" },
  { pattern: /\bescalate\b/gi, replacement: "raise to a safety lead" },
  { pattern: /\bsync(?:ed|ing)?\b/gi, replacement: "update" },
  { pattern: /\bbriefings?\b/gi, replacement: "crew discussion" },
  { pattern: /\bbrief\b/gi, replacement: "crew discussion" },
  { pattern: /\bcreated\b/gi, replacement: "prepared" },
  { pattern: /\bcreating\b/gi, replacement: "preparing" },
  { pattern: /\bcreate\b/gi, replacement: "prepare" },
  { pattern: /\bgenerated\b/gi, replacement: "prepared" },
  { pattern: /\bgenerating\b/gi, replacement: "preparing" },
  { pattern: /\bgenerate\b/gi, replacement: "prepare" },
] as const;

export function sanitizeGusMessage(message: string): string {
  return FORBIDDEN_GUS_OUTPUT_PATTERNS.reduce(
    (nextMessage, rule) => nextMessage.replace(rule.pattern, rule.replacement),
    message
  );
}

export function sanitizeGusTriggerLanguage(message: string): string {
  return GUS_TRIGGER_LANGUAGE_PATTERNS.reduce(
    (nextMessage, rule) => nextMessage.replace(rule.pattern, rule.replacement),
    message
  )
    .replace(/\bhuman\s+review\b/gi, "human safety check")
    .replace(/\bno\s+human\s+safety\s+check\s+needed\b/gi, "human safety check is required")
    .replace(/\breview\b/gi, "human safety check")
    .replace(/\bverify\b/gi, "field-check")
    .replace(/\bconfirm\b/gi, "make sure")
    .replace(/\baction(s)?\b/gi, (_match, plural?: string) => `safe step${plural ? "s" : ""}`)
    .replace(/\s+/g, " ")
    .trim();
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
