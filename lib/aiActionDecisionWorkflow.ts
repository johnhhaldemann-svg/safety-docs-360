import type {
  AiActionDecisionIntent,
  AiActionDecisionTrigger,
} from "@/lib/aiActionDecisionTriggers";
import type { RiskActionExecuteType } from "@/types/risk-action-plan";

export type AiActionDecisionWorkflowAction =
  | RiskActionExecuteType
  | "sync_actions";

export type AiActionDecisionWorkflowMapping = {
  intent: AiActionDecisionIntent;
  workflowAction: AiActionDecisionWorkflowAction | null;
  blocked: boolean;
  blockedReason: string | null;
  requiresRecommendation: boolean;
  requiredConfirmationFields: string[];
  humanReviewRequired: boolean;
  executionLabel: string;
};

export type AiActionDecisionExecutionInput = {
  recommendationId?: string | null;
  triggerId?: string | null;
  intent?: string | null;
  trigger?: Partial<AiActionDecisionTrigger> | null;
  confirmation?: boolean | string | null;
  ownerUserId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  dismissReason?: string | null;
  fieldVerificationSummary?: string | null;
  days?: number | null;
  jobsiteId?: string | null;
};

export type AiActionDecisionExecutionValidation =
  | {
      ok: true;
      mapping: AiActionDecisionWorkflowMapping;
      requiredConfirmationFields: string[];
    }
  | {
      ok: false;
      mapping: AiActionDecisionWorkflowMapping | null;
      error: string;
      blockedReason: string | null;
      requiredConfirmationFields: string[];
    };

const BLOCKED_AUTHORITY_REASON =
  "AI cannot approve, clear, release, certify, or declare compliance. Human review and field verification are required before work proceeds.";

const VALID_INTENTS = new Set<AiActionDecisionIntent>([
  "request_review",
  "request_field_verification",
  "request_assignment",
  "request_escalation",
  "draft_record",
  "create_action",
  "sync_actions",
  "prepare_briefing",
  "draft_notification",
  "request_resolution",
  "request_dismissal",
  "suppress_or_ignore",
  "pause_or_hold_work",
  "stop_work_review",
  "resequence_work",
  "blocked_authority",
]);

function clean(value: unknown, max = 700) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizedIntent(value: unknown): AiActionDecisionIntent | null {
  const raw = clean(value, 80) as AiActionDecisionIntent;
  return VALID_INTENTS.has(raw) ? raw : null;
}

function isConfirmed(value: unknown) {
  if (value === true) return true;
  const text = clean(value, 40).toLowerCase();
  return text === "true" || text === "confirmed" || text === "confirm";
}

export function mapActionDecisionTriggerToWorkflowAction(
  triggerOrIntent: Pick<AiActionDecisionTrigger, "intent" | "blocked" | "humanReviewRequired"> | AiActionDecisionIntent | string | null | undefined,
): AiActionDecisionWorkflowMapping {
  const intent = normalizedIntent(typeof triggerOrIntent === "string" ? triggerOrIntent : triggerOrIntent?.intent);
  if (!intent) {
    return {
      intent: "blocked_authority",
      workflowAction: null,
      blocked: true,
      blockedReason: "Unknown action-word intent. Human review is required before any workflow change.",
      requiresRecommendation: false,
      requiredConfirmationFields: [],
      humanReviewRequired: true,
      executionLabel: "Blocked action word",
    };
  }

  if (intent === "blocked_authority") {
    return {
      intent,
      workflowAction: null,
      blocked: true,
      blockedReason: BLOCKED_AUTHORITY_REASON,
      requiresRecommendation: false,
      requiredConfirmationFields: [],
      humanReviewRequired: true,
      executionLabel: "Blocked authority request",
    };
  }

  const triggerReviewRequired =
    typeof triggerOrIntent === "object" && triggerOrIntent !== null
      ? Boolean(triggerOrIntent.humanReviewRequired || triggerOrIntent.blocked)
      : false;
  const base = {
    intent,
    blocked: false,
    blockedReason: null,
    requiresRecommendation: true,
    humanReviewRequired: triggerReviewRequired || intent === "stop_work_review" || intent === "request_escalation" || intent === "pause_or_hold_work",
  };

  if (intent === "sync_actions") {
    return {
      ...base,
      workflowAction: "sync_actions",
      requiresRecommendation: false,
      requiredConfirmationFields: ["confirmation"],
      executionLabel: "Sync AI safety actions",
    };
  }

  if (intent === "request_assignment") {
    return { ...base, workflowAction: "assign", requiredConfirmationFields: ["confirmation"], executionLabel: "Assign reviewer" };
  }
  if (intent === "request_field_verification") {
    return {
      ...base,
      workflowAction: "mark_field_used",
      requiredConfirmationFields: ["confirmation", "fieldVerificationSummary"],
      humanReviewRequired: true,
      executionLabel: "Record field verification",
    };
  }
  if (intent === "request_escalation" || intent === "stop_work_review" || intent === "pause_or_hold_work") {
    return {
      ...base,
      workflowAction: "stop_work_review",
      requiredConfirmationFields: ["confirmation", "notes"],
      humanReviewRequired: true,
      executionLabel: "Escalate for review",
    };
  }
  if (intent === "request_resolution") {
    return {
      ...base,
      workflowAction: "resolve",
      requiredConfirmationFields: ["confirmation", "fieldVerificationSummary"],
      humanReviewRequired: true,
      executionLabel: "Resolve with verification",
    };
  }
  if (intent === "request_dismissal" || intent === "suppress_or_ignore") {
    return {
      ...base,
      workflowAction: "dismiss",
      requiredConfirmationFields: ["confirmation", "dismissReason"],
      executionLabel: "Dismiss with reason",
    };
  }
  if (intent === "create_action") {
    return {
      ...base,
      workflowAction: "create_corrective_action",
      requiredConfirmationFields: ["confirmation"],
      executionLabel: "Create corrective action",
    };
  }
  if (intent === "request_review" || intent === "resequence_work") {
    return {
      ...base,
      workflowAction: "assign",
      requiredConfirmationFields: ["confirmation"],
      humanReviewRequired: true,
      executionLabel: "Route for review",
    };
  }

  return {
    ...base,
    workflowAction: null,
    blocked: true,
    blockedReason: "This action word is advisory in v1. Draft guidance can be shown, but no workflow record will be changed.",
    requiresRecommendation: false,
    requiredConfirmationFields: [],
    humanReviewRequired: true,
    executionLabel: "Advisory action word",
  };
}

export function validateActionDecisionExecution(input: AiActionDecisionExecutionInput): AiActionDecisionExecutionValidation {
  const mapping = mapActionDecisionTriggerToWorkflowAction(input.trigger?.intent ?? input.intent);
  if (mapping.blocked || !mapping.workflowAction) {
    return {
      ok: false,
      mapping,
      error: mapping.blockedReason ?? "Action-word decision cannot be executed.",
      blockedReason: mapping.blockedReason,
      requiredConfirmationFields: mapping.requiredConfirmationFields,
    };
  }

  const missing = mapping.requiredConfirmationFields.filter((field) => {
    if (field === "confirmation") return !isConfirmed(input.confirmation);
    if (field === "fieldVerificationSummary") return !clean(input.fieldVerificationSummary, 500);
    if (field === "dismissReason") return !clean(input.dismissReason, 500);
    if (field === "notes") return !clean(input.notes, 500);
    return false;
  });

  if (mapping.requiresRecommendation && !clean(input.recommendationId, 100)) {
    missing.push("recommendationId");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      mapping,
      error: `Missing required confirmation field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
      blockedReason: null,
      requiredConfirmationFields: [...new Set(missing)],
    };
  }

  return {
    ok: true,
    mapping,
    requiredConfirmationFields: [],
  };
}

export function buildActionDecisionForwardBody(input: AiActionDecisionExecutionInput, mapping: AiActionDecisionWorkflowMapping) {
  const notes = [
    clean(input.notes, 800),
    clean(input.fieldVerificationSummary, 800) ? `Field verification summary: ${clean(input.fieldVerificationSummary, 800)}` : "",
    clean(input.dismissReason, 800) ? `Dismiss reason: ${clean(input.dismissReason, 800)}` : "",
    clean(input.triggerId, 120) ? `Action decision trigger: ${clean(input.triggerId, 120)}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    actionType: mapping.workflowAction,
    ownerUserId: clean(input.ownerUserId, 100) || undefined,
    assignedUserId: clean(input.ownerUserId, 100) || undefined,
    dueAt: clean(input.dueAt, 100) || undefined,
    notes: notes || undefined,
    dismissReason: clean(input.dismissReason, 800) || undefined,
    fieldVerificationSummary: clean(input.fieldVerificationSummary, 800) || undefined,
    evidenceProvided: Boolean(clean(input.fieldVerificationSummary, 800)),
    actionDecisionIntent: mapping.intent,
    actionDecisionTriggerId: clean(input.triggerId, 120) || undefined,
    confirmation: true,
  };
}
