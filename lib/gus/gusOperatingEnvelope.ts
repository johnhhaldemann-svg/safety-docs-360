import { isForbiddenGusAction } from "@/lib/gus/gusTrustRules";
import type {
  GusAutonomyAction,
  GusAutonomyDecision,
  GusAutonomyLevel,
  GusOperatingLimit,
} from "@/lib/gus/gusTypes";

const AUTONOMY_LEVEL: GusAutonomyLevel = "monitor_recommend";

const LEFT_LIMIT_ACTIONS = new Set([
  "observe_context",
  "prioritize_risk",
  "give_sitrep",
  "speak_if_enabled",
  "ask_followup",
  "coach_user",
  "prepare_draft_text",
  "guide_to_platform_page",
  "recommend_review",
  "explain_risk",
  "suggest_controls",
  "identify_missing_information",
  "guide_to_risk",
  "guide_to_permits",
  "guide_to_training",
  "guide_to_actions",
  "guide_to_jsa",
  "open_planning_mode",
]);

const CONFIRMATION_ACTIONS = new Set([
  "create_draft_after_confirmation",
  "create_draft_jsa",
  "create_draft_permit_checklist",
  "create_pretask_briefing",
  "save_planning_session",
  "send_email_alert",
]);

const RIGHT_LIMIT_ACTIONS = new Set([
  "approve_work",
  "approve_permit",
  "submit_record",
  "submit_jsa",
  "close_corrective_action",
  "delete_record",
  "release_work",
  "change_training_status",
  "modify_official_document",
  "claim_compliance",
  "give_legal_advice",
  "invent_osha_requirement",
]);

function normalizeActionKey(actionKey: string) {
  return actionKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function classifyGusOperatingLimit(actionKey: string): GusOperatingLimit {
  const normalized = normalizeActionKey(actionKey);
  if (!normalized) return "left";
  if (RIGHT_LIMIT_ACTIONS.has(normalized) || isForbiddenGusAction(normalized)) return "right";
  if (CONFIRMATION_ACTIONS.has(normalized)) return "confirmation";
  return "left";
}

export function buildGusAutonomyAction(actionKey: string, label = actionKey): GusAutonomyAction {
  const normalized = normalizeActionKey(actionKey);
  const limit = classifyGusOperatingLimit(normalized);

  return {
    actionKey: normalized || "recommend_review",
    label,
    limit,
    requiresConfirmation: limit === "confirmation",
    canModifyOfficialRecords: false,
  };
}

export function evaluateGusAutonomyAction(actionKey: string, label = actionKey): GusAutonomyDecision {
  const action = buildGusAutonomyAction(actionKey, label);
  const blocked = action.limit === "right";
  const requiresConfirmation = action.limit === "confirmation";

  return {
    decisionId: `gus-autonomy-${action.actionKey}`,
    level: AUTONOMY_LEVEL,
    action,
    allowed: !blocked && !requiresConfirmation,
    blocked,
    reason: blocked
      ? "Right-limit action blocked. Gus cannot take official or approval-like platform actions."
      : requiresConfirmation
        ? "Confirmation required before Gus can create drafts, save planning sessions, or send email alerts."
        : "Left-limit action allowed. Gus may monitor, coach, ask questions, and prepare draft text.",
    shouldOpen: false,
    shouldInterrupt: false,
    humanReviewRequired: true,
  };
}

export function isGusLeftLimitAction(actionKey: string) {
  const normalized = normalizeActionKey(actionKey);
  return LEFT_LIMIT_ACTIONS.has(normalized) || classifyGusOperatingLimit(normalized) === "left";
}
