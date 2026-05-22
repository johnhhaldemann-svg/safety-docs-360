export const FORBIDDEN_GUS_ACTIONS = [
  "approve_permit",
  "submit_jsa",
  "close_corrective_action",
  "delete_record",
  "change_training_status",
  "modify_official_document",
  "send_notification",
  "give_legal_advice",
  "invent_osha_requirement",
  "state_compliant_without_verification",
] as const;

export const GUS_ALLOWED_ACTIONS = [
  "recommend_review",
  "ask_questions",
  "identify_missing_information",
  "explain_risk",
  "suggest_controls",
  "create_draft_after_confirmation",
  "guide_to_platform_page",
] as const;

export const FORBIDDEN_GUS_OUTPUT_PATTERNS = [
  {
    code: "approved",
    pattern: /\bapproved\b/gi,
    replacement: "ready for human review",
  },
  {
    code: "compliant",
    pattern: /\bcompliant\b/gi,
    replacement: "aligned with available platform checks and pending human review",
  },
  {
    code: "safe_to_start",
    pattern: /\bsafe\s+to\s+start\b/gi,
    replacement: "not ready to start until reviewed by a qualified human",
  },
  {
    code: "released_for_work",
    pattern: /\breleased\s+for\s+work\b/gi,
    replacement: "pending human release for work",
  },
  {
    code: "no_review_needed",
    pattern: /\bno\s+review\s+needed\b/gi,
    replacement: "human review is required",
  },
] as const;

function normalizeActionKey(actionKey: string) {
  return actionKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isForbiddenGusAction(actionKey: string): boolean {
  const normalized = normalizeActionKey(actionKey);
  if (!normalized) return false;

  if ((FORBIDDEN_GUS_ACTIONS as readonly string[]).includes(normalized)) {
    return true;
  }

  const tokens = new Set(normalized.split("_").filter(Boolean));
  return (
    (tokens.has("approve") && tokens.has("permit")) ||
    (tokens.has("submit") && tokens.has("jsa")) ||
    (tokens.has("close") && tokens.has("corrective") && tokens.has("action")) ||
    tokens.has("delete") ||
    (tokens.has("training") && tokens.has("status") && (tokens.has("change") || tokens.has("modify"))) ||
    (tokens.has("official") && tokens.has("document") && (tokens.has("modify") || tokens.has("change"))) ||
    (tokens.has("send") && tokens.has("notification")) ||
    (tokens.has("legal") && tokens.has("advice")) ||
    (tokens.has("invent") && tokens.has("osha")) ||
    (tokens.has("state") && tokens.has("compliant"))
  );
}
