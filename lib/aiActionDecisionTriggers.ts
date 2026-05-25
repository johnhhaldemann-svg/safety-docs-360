import type { PredictiveSafetyEvidenceRef } from "@/lib/predictiveSafetyEngine";
import type { SafetyRiskLevel } from "@/lib/safety-ai/types";
import type { RiskActionTargetModule } from "@/types/risk-action-plan";

export type AiActionDecisionTriggerSource =
  | "user_message"
  | "gus_message"
  | "ai_recommendation"
  | "ai_action_queue"
  | "daily_briefing"
  | "conflict"
  | "field_evidence"
  | "system";

export type AiActionDecisionIntent =
  | "request_review"
  | "request_field_verification"
  | "request_assignment"
  | "request_escalation"
  | "draft_record"
  | "create_action"
  | "sync_actions"
  | "prepare_briefing"
  | "draft_notification"
  | "request_resolution"
  | "request_dismissal"
  | "suppress_or_ignore"
  | "pause_or_hold_work"
  | "stop_work_review"
  | "resequence_work"
  | "blocked_authority";

export type AiActionDecisionTargetModule = RiskActionTargetModule | "weather" | "command_center" | "gus" | "unknown";

export type AiActionDecisionTrigger = {
  id: string;
  source: AiActionDecisionTriggerSource;
  sourceId: string | null;
  sourceText: string;
  actionWord: string;
  intent: AiActionDecisionIntent;
  targetModule: AiActionDecisionTargetModule;
  riskLevel: SafetyRiskLevel | null;
  requiresConfirmation: boolean;
  humanReviewRequired: boolean;
  blocked: boolean;
  blockedReason: string | null;
  recommendedSafeAction: string;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
};

export type BuildAiActionDecisionTriggersInput = {
  source: AiActionDecisionTriggerSource;
  sourceText: string | string[];
  sourceId?: string | null;
  targetModule?: AiActionDecisionTargetModule | null;
  riskLevel?: SafetyRiskLevel | null;
  humanReviewRequired?: boolean;
  evidenceRefs?: PredictiveSafetyEvidenceRef[];
  limit?: number;
};

type ActionWordRule = {
  actionWord: string;
  intent: AiActionDecisionIntent;
  patterns: RegExp[];
  requiresConfirmation: boolean;
  humanReviewRequired?: boolean;
  blocked?: boolean;
  blockedReason?: string;
  recommendedSafeAction: string;
};

const BLOCKED_AUTHORITY_REASON =
  "AI cannot approve, clear, release, certify, or declare compliance. Human review and field verification are required before work proceeds.";

const ACTION_WORD_RULES: ActionWordRule[] = [
  {
    actionWord: "approve",
    intent: "blocked_authority",
    patterns: [/\bapprov(?:e|ed|al|ing)\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    blocked: true,
    blockedReason: BLOCKED_AUTHORITY_REASON,
    recommendedSafeAction: "Route this to the responsible human reviewer and verify evidence before work proceeds.",
  },
  {
    actionWord: "declare compliant",
    intent: "blocked_authority",
    patterns: [/\bdeclare(?:d)?\s+compliant\b/i, /\b(?:osha\s+)?compliant\b/i, /\bcompliance\s+(?:approved|certified|guaranteed)\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    blocked: true,
    blockedReason: BLOCKED_AUTHORITY_REASON,
    recommendedSafeAction: "Use verified policy or regulatory references and send the record for qualified human review.",
  },
  {
    actionWord: "clear",
    intent: "blocked_authority",
    patterns: [/\bclear(?:ed|ing)?\s+(?:this|it|work|permit|task|crew|job|area|for\s+work|to\s+proceed)\b/i, /\bsafe\s+to\s+start\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    blocked: true,
    blockedReason: BLOCKED_AUTHORITY_REASON,
    recommendedSafeAction: "Convert the request into a review and verification step before work proceeds.",
  },
  {
    actionWord: "release",
    intent: "blocked_authority",
    patterns: [/\breleas(?:e|ed|ing)\s+(?:this|it|work|permit|task|crew|job|area)\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    blocked: true,
    blockedReason: BLOCKED_AUTHORITY_REASON,
    recommendedSafeAction: "Ask the responsible reviewer to verify controls and document the decision.",
  },
  {
    actionWord: "certify",
    intent: "blocked_authority",
    patterns: [/\bcertif(?:y|ied|ication)\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    blocked: true,
    blockedReason: BLOCKED_AUTHORITY_REASON,
    recommendedSafeAction: "Keep AI output advisory and route certification questions to a qualified human authority.",
  },
  {
    actionWord: "stop",
    intent: "stop_work_review",
    patterns: [/\bstop(?:\s+work)?\b/i, /\bstand\s*down\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    recommendedSafeAction: "Recommend immediate human review and possible stop-work evaluation.",
  },
  {
    actionWord: "pause",
    intent: "pause_or_hold_work",
    patterns: [/\bpause\b/i, /\bhold\b/i, /\bfreeze\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    recommendedSafeAction: "Hold the affected work for supervisor or safety-manager verification.",
  },
  {
    actionWord: "escalate",
    intent: "request_escalation",
    patterns: [/\bescalat(?:e|ed|ion|ing)\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    recommendedSafeAction: "Escalate to the responsible safety manager, supervisor, or competent person for review.",
  },
  {
    actionWord: "verify",
    intent: "request_field_verification",
    patterns: [/\bverify\b/i, /\bfield\s+verif(?:y|ication)\b/i],
    requiresConfirmation: false,
    humanReviewRequired: true,
    recommendedSafeAction: "Verify the condition, control, or document in the field before work proceeds.",
  },
  {
    actionWord: "inspect",
    intent: "request_field_verification",
    patterns: [/\binspect(?:ion|ed|ing)?\b/i],
    requiresConfirmation: false,
    humanReviewRequired: true,
    recommendedSafeAction: "Request field inspection by the responsible reviewer before work proceeds.",
  },
  {
    actionWord: "confirm",
    intent: "request_field_verification",
    patterns: [/\bconfirm(?:ed|ing)?\b/i],
    requiresConfirmation: false,
    humanReviewRequired: true,
    recommendedSafeAction: "Confirm the required control or readiness item with a responsible person.",
  },
  {
    actionWord: "assign",
    intent: "request_assignment",
    patterns: [/\bassign(?:ed|ment|ing)?\b/i],
    requiresConfirmation: true,
    recommendedSafeAction: "Draft an assignment for the responsible reviewer without bypassing review.",
  },
  {
    actionWord: "review",
    intent: "request_review",
    patterns: [/\breview(?:ed|ing)?\b/i],
    requiresConfirmation: false,
    humanReviewRequired: true,
    recommendedSafeAction: "Send this item for human safety review before work proceeds.",
  },
  {
    actionWord: "draft",
    intent: "draft_record",
    patterns: [/\bdraft(?:ed|ing)?\b/i],
    requiresConfirmation: false,
    recommendedSafeAction: "Prepare draft-only safety language for human review.",
  },
  {
    actionWord: "create",
    intent: "create_action",
    patterns: [/\bcreate\b/i, /\bgenerate\b/i],
    requiresConfirmation: true,
    recommendedSafeAction: "Create a reviewable action or draft record with evidence attached.",
  },
  {
    actionWord: "sync",
    intent: "sync_actions",
    patterns: [/\bsync(?:ed|ing)?\b/i],
    requiresConfirmation: true,
    recommendedSafeAction: "Sync AI safety actions into the recommendation workflow for human tracking.",
  },
  {
    actionWord: "brief",
    intent: "prepare_briefing",
    patterns: [/\bbrief(?:ing)?\b/i],
    requiresConfirmation: false,
    recommendedSafeAction: "Prepare a crew briefing with risks, missing data, and controls to verify.",
  },
  {
    actionWord: "notify",
    intent: "draft_notification",
    patterns: [/\bnotif(?:y|ication)\b/i, /\bsend\s+(?:an?\s+)?alert\b/i],
    requiresConfirmation: true,
    recommendedSafeAction: "Draft an advisory notification for human review before sending externally.",
  },
  {
    actionWord: "resolve",
    intent: "request_resolution",
    patterns: [/\bresolve(?:d|ing)?\b/i],
    requiresConfirmation: true,
    recommendedSafeAction: "Require documented field verification before marking this resolved.",
  },
  {
    actionWord: "dismiss",
    intent: "request_dismissal",
    patterns: [/\bdismiss(?:ed|ing)?\b/i],
    requiresConfirmation: true,
    recommendedSafeAction: "Require a human reason before dismissing this recommendation.",
  },
  {
    actionWord: "ignore",
    intent: "suppress_or_ignore",
    patterns: [/\bignore\b/i, /\bsuppress\b/i],
    requiresConfirmation: true,
    recommendedSafeAction: "Require reviewer feedback and keep critical risk visible even if duplicates are suppressed.",
  },
  {
    actionWord: "resequence",
    intent: "resequence_work",
    patterns: [/\bresequenc(?:e|ed|ing)\b/i, /\bsequence\s+(?:the\s+)?work\b/i],
    requiresConfirmation: true,
    humanReviewRequired: true,
    recommendedSafeAction: "Review sequencing, separation, and conflicting work before work proceeds.",
  },
];

const INTENT_RANK: Record<AiActionDecisionIntent, number> = {
  blocked_authority: 100,
  stop_work_review: 95,
  pause_or_hold_work: 88,
  request_escalation: 84,
  request_field_verification: 72,
  request_review: 70,
  request_assignment: 56,
  request_resolution: 54,
  request_dismissal: 52,
  suppress_or_ignore: 50,
  create_action: 42,
  sync_actions: 40,
  draft_notification: 38,
  draft_record: 35,
  resequence_work: 34,
  prepare_briefing: 30,
};

function clean(value: string | null | undefined, max = 700) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slug(value: string) {
  return clean(value, 90).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "trigger";
}

function riskRequiresHumanReview(level: SafetyRiskLevel | null | undefined) {
  return level === "critical" || level === "high";
}

export function sanitizeAiActionDecisionTrigger(trigger: AiActionDecisionTrigger): AiActionDecisionTrigger {
  const blocked = trigger.blocked || trigger.intent === "blocked_authority";
  return {
    ...trigger,
    sourceText: clean(trigger.sourceText),
    actionWord: clean(trigger.actionWord, 60),
    targetModule: trigger.targetModule ?? "unknown",
    requiresConfirmation: trigger.requiresConfirmation || blocked,
    humanReviewRequired: true,
    blocked,
    blockedReason: blocked ? trigger.blockedReason ?? BLOCKED_AUTHORITY_REASON : trigger.blockedReason,
    recommendedSafeAction: blocked
      ? "Route this to the responsible human reviewer and verify evidence before work proceeds."
      : clean(trigger.recommendedSafeAction) || "Verify this recommendation with a responsible human reviewer.",
    evidenceRefs: (trigger.evidenceRefs ?? []).slice(0, 8),
  };
}

export function buildAiActionDecisionTriggers(input: BuildAiActionDecisionTriggersInput): AiActionDecisionTrigger[] {
  const texts = (Array.isArray(input.sourceText) ? input.sourceText : [input.sourceText])
    .map((text) => clean(text))
    .filter(Boolean);
  const seen = new Set<string>();
  const triggers: AiActionDecisionTrigger[] = [];

  for (const text of texts) {
    for (const rule of ACTION_WORD_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
      const key = `${rule.intent}:${rule.actionWord}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const trigger = sanitizeAiActionDecisionTrigger({
        id: `action-word-${slug(input.source)}-${slug(input.sourceId ?? rule.actionWord)}-${slug(rule.actionWord)}`,
        source: input.source,
        sourceId: input.sourceId ?? null,
        sourceText: text,
        actionWord: rule.actionWord,
        intent: rule.intent,
        targetModule: input.targetModule ?? "unknown",
        riskLevel: input.riskLevel ?? null,
        requiresConfirmation: rule.requiresConfirmation,
        humanReviewRequired: Boolean(rule.humanReviewRequired) || riskRequiresHumanReview(input.riskLevel) || Boolean(input.humanReviewRequired),
        blocked: Boolean(rule.blocked),
        blockedReason: rule.blockedReason ?? null,
        recommendedSafeAction: rule.recommendedSafeAction,
        evidenceRefs: input.evidenceRefs ?? [],
      });
      triggers.push(trigger);
    }
  }

  return triggers
    .sort((a, b) => INTENT_RANK[b.intent] - INTENT_RANK[a.intent] || a.actionWord.localeCompare(b.actionWord))
    .slice(0, Math.max(1, input.limit ?? 8));
}
