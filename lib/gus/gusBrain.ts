import type { GusContext } from "@/lib/gus/gusContext";
import { sanitizeGusTriggerLanguage } from "@/lib/gus/gusSafetyGate";
import { isForbiddenGusAction } from "@/lib/gus/gusTrustRules";
import { validateGusOutput } from "@/lib/gus/gusValidation";
import type { AiActionDecisionTrigger } from "@/lib/aiActionDecisionTriggers";
import type {
  GusBotState,
  GusCompanionAction,
  GusContextSignal,
  GusDecision,
  GusDecisionKind,
  GusMessage,
} from "@/lib/gus/gusTypes";

export type GusBrainInput = {
  context: GusContext;
  routeMessage: GusMessage;
  feedback?: "helpful" | "not_helpful" | null;
  quietMode?: boolean;
};

function action(label: string, href: string, actionKey: string): GusCompanionAction {
  return { label, href, actionKey };
}

function safeActions(actions: GusCompanionAction[]) {
  return actions.filter((item) => !isForbiddenGusAction(item.actionKey)).map((item) => ({
    ...item,
    label: sanitizeGusTriggerLanguage(item.label),
  }));
}

function safeMessage(message: GusMessage): GusMessage {
  const validation = validateGusOutput(message);
  const sanitized = validation.sanitizedOutput as GusMessage;
  return {
    ...sanitized,
    message: sanitizeGusTriggerLanguage(sanitized.message),
    spokenText: sanitized.spokenText ? sanitizeGusTriggerLanguage(sanitized.spokenText) : sanitized.spokenText,
    reason: sanitized.reason ? sanitizeGusTriggerLanguage(sanitized.reason) : sanitized.reason,
    actionLabel: sanitized.actionLabel ? sanitizeGusTriggerLanguage(sanitized.actionLabel) : sanitized.actionLabel,
  };
}

function signal(params: GusContextSignal): GusContextSignal {
  return {
    ...params,
    label: sanitizeGusTriggerLanguage(params.label),
    detail: params.detail ? sanitizeGusTriggerLanguage(params.detail) : params.detail,
  };
}

function compactList(items: string[] | undefined, fallback: string) {
  const values = (items ?? []).filter(Boolean).slice(0, 3);
  return values.length > 0 ? values.join(", ") : fallback;
}

function decision(params: {
  decisionId: string;
  kind: GusDecisionKind;
  botState: GusBotState;
  attentionLevel: GusDecision["attentionLevel"];
  message: GusMessage;
  reason?: string;
  signals?: GusContextSignal[];
  actions?: GusCompanionAction[];
  shouldOpen?: boolean;
  shouldSpeak?: boolean;
}): GusDecision {
  const message = safeMessage(params.message);

  return {
    decisionId: params.decisionId,
    kind: params.kind,
    botState: params.botState,
    attentionLevel: params.attentionLevel,
    message,
    reason: params.reason ?? message.reason,
    signals: params.signals ?? [],
    actions: safeActions(params.actions ?? []),
    shouldOpen: params.shouldOpen ?? false,
    shouldSpeak: params.shouldSpeak ?? false,
  };
}

function routeHref(route: string, fallback: string) {
  return route.startsWith("/safe-predict") ? "/safe-predict/predictive-risk" : fallback;
}

const TRIGGER_INTENT_RANK: Record<AiActionDecisionTrigger["intent"], number> = {
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

function topActionDecisionTrigger(context: GusContext) {
  return (context.aiEngineActionDecisionTriggers ?? [])
    .slice()
    .sort((a, b) => TRIGGER_INTENT_RANK[b.intent] - TRIGGER_INTENT_RANK[a.intent])[0];
}

function actionDecisionTriggerMessage(trigger: AiActionDecisionTrigger) {
  if (trigger.blocked) {
    return "I can turn that into a human safety check, but I cannot grant authorization or make final compliance decisions.";
  }
  if (trigger.intent === "request_escalation") return "I can help raise this to a safety lead and keep the recommendation advisory.";
  if (trigger.intent === "stop_work_review") return "This safety cue points to immediate human safety check and possible do-not-continue evaluation.";
  if (trigger.intent === "pause_or_hold_work") return "This safety cue points to not continuing the affected work until a responsible person field-checks it.";
  if (trigger.intent === "request_field_verification") return "This safety cue points to a field check before work proceeds.";
  if (trigger.intent === "request_assignment") return "I can draft the owner path, with a safety check still required for safety-critical work.";
  if (trigger.intent === "request_resolution") return "Closeout needs documented field check before the workflow is updated.";
  if (trigger.intent === "request_dismissal" || trigger.intent === "suppress_or_ignore") return "A set-aside or suppression choice needs a human reason and cannot hide critical risk.";
  return trigger.recommendedSafeAction;
}

function aiEngineNextStep(context: GusContext) {
  const reasoningAction = context.aiEngineNextBestActions?.[0];
  if (reasoningAction?.humanReviewRequired) return `Field check first: ${reasoningAction.detail}`;
  if (context.aiEngineActionTimeframe === "immediate") return "Do not continue until a human safety check happens now.";
  if (context.aiEngineActionTimeframe === "before_work_continues") return "Field-check controls before work moves forward.";
  if (context.aiEngineActionTimeframe === "same_shift") return "Run a human safety check during the current shift.";
  return "Keep this in the routine safety check.";
}

export function decideGusBehavior(input: GusBrainInput): GusDecision {
  const { context, routeMessage, feedback, quietMode } = input;
  const route = context.route || "/";

  if (quietMode) {
    return decision({
      decisionId: "gus-quiet-mode",
      kind: "silent",
      botState: "muted",
      attentionLevel: "none",
      message: {
        ...routeMessage,
        messageId: "gus-quiet-mode-message",
        category: "reminder",
        priority: 5,
        message: "Gus is muted for now.",
        reason: "Quiet mode is active.",
        shouldSpeak: false,
      },
    });
  }

  const actionDecisionTrigger = topActionDecisionTrigger(context);
  if (actionDecisionTrigger && (actionDecisionTrigger.blocked || actionDecisionTrigger.humanReviewRequired || actionDecisionTrigger.requiresConfirmation)) {
    const href = routeHref(route, "/command-center");
    const isCritical =
      actionDecisionTrigger.intent === "stop_work_review" ||
      actionDecisionTrigger.riskLevel === "critical" ||
      actionDecisionTrigger.blocked;
    return decision({
      decisionId: `gus-action-word-${actionDecisionTrigger.intent}`,
      kind: isCritical ? "warning" : "planning_offer",
      botState: isCritical ? "warning" : "planning",
      attentionLevel: isCritical ? "critical" : actionDecisionTrigger.riskLevel === "high" ? "high" : "medium",
      shouldOpen: true,
      message: {
        messageId: "gus-action-word-decision",
        category: isCritical ? "warning" : "planning",
        priority: isCritical ? 1 : 3,
        message: actionDecisionTriggerMessage(actionDecisionTrigger),
        spokenText: actionDecisionTrigger.blocked
          ? "Human review is required. I cannot grant authorization."
          : actionDecisionTrigger.recommendedSafeAction,
        reason: `Safety cue "${actionDecisionTrigger.actionWord}" was mapped to ${actionDecisionTrigger.intent.replace(/_/g, " ")}. ${actionDecisionTrigger.recommendedSafeAction}`,
        shouldSpeak: isCritical,
        actionLabel: "Open safety item",
        actionHref: href,
        actionKey: "recommend_review",
        confidence: actionDecisionTrigger.blocked ? 0.95 : 0.86,
      },
      signals: [
        signal({
          signalId: `action-word-${actionDecisionTrigger.actionWord}`,
          source: "action",
          label: `Safety cue: ${actionDecisionTrigger.actionWord}`,
          riskLevel: isCritical ? "severe" : actionDecisionTrigger.riskLevel === "high" ? "high" : "moderate",
          detail: actionDecisionTrigger.recommendedSafeAction,
          actionHref: href,
        }),
      ],
      actions: [action("Open safety item", href, "recommend_review")],
    });
  }

  if (
    context.aiEngineLinked &&
    context.safetyAiAssessment &&
    (context.safetyAiAssessment.stopWorkReviewRecommended || (context.aiEngineCriticalControlGaps?.length ?? 0) > 0)
  ) {
    const gaps = context.aiEngineCriticalControlGaps ?? [];
    const triggers = context.aiEngineReviewTriggers ?? [];
    const nextStep = aiEngineNextStep(context);
    const work = context.aiEngineTopHighRiskWork ? ` Top work: ${context.aiEngineTopHighRiskWork}.` : "";
    const recommendation = context.aiEngineRecommendedNextAction ? ` Next action: ${context.aiEngineRecommendedNextAction}` : "";
    const conflicts = context.aiEngineWorkfaceConflicts ?? [];
    const conflictNote = conflicts.length > 0 ? ` Workface conflict: ${compactList(conflicts, "predicted workface conflict")}.` : "";
    const fieldEvidence = context.aiEngineFieldEvidence ?? [];
    const fieldEvidenceNote = fieldEvidence.length > 0 ? ` Field evidence: ${compactList(fieldEvidence, "photo-review evidence needing verification")}.` : "";
    const uncertainty = context.aiEngineUncertaintySummary;
    const uncertaintyNote = uncertainty ? ` Uncertainty: ${uncertainty.summary}` : "";
    const evidenceNote = context.aiEngineReasoningFrame?.supportingEvidence?.length
      ? ` Evidence: ${compactList(context.aiEngineReasoningFrame.supportingEvidence.map((item) => item.label), "loaded AI Engine evidence")}.`
      : "";
    const unified = context.aiEngineUnifiedContext;
    const unifiedNote = unified
      ? ` Unified sources: ${compactList(unified.sourceCoverage.filter((item) => item.evidenceCount + item.conflictCount > 0).map((item) => item.label), "AI safety sources")}.`
      : "";
    const domainNote = context.aiEngineSafetyDisciplines?.length
      ? ` Safety field lens: ${compactList(context.aiEngineSafetyDisciplines, "recognized safety disciplines")}.`
      : "";

    return decision({
      decisionId: "gus-ai-engine-review-decision",
      kind: "warning",
      botState: "warning",
      attentionLevel: context.safetyAiAssessment.level === "critical" ? "critical" : "high",
      shouldOpen: true,
      message: {
        messageId: "gus-ai-engine-review",
        category: "risk_alert",
        priority: context.safetyAiAssessment.level === "critical" ? 1 : 2,
        message: `I'm flagging this for review.${work}${conflictNote}${fieldEvidenceNote} ${nextStep}`,
        spokenText: `I'm flagging this for review. ${nextStep}`,
        reason: `Review basis: ${compactList([...conflicts, ...gaps, ...triggers], "critical controls or review triggers")}.${evidenceNote}${unifiedNote}${domainNote}${uncertaintyNote} Human review required.`,
        shouldSpeak: context.safetyAiAssessment.level === "critical",
        actionLabel: "Review safety risk",
        actionHref: routeHref(route, "/risk"),
        actionKey: "guide_to_risk",
        confidence: context.safetyAiAssessment.confidence === "high" ? 0.92 : 0.84,
      },
      signals: [
        signal({
          signalId: "safety-ai-engine-review",
          source: "risk",
          label: "Safety review",
          riskLevel: context.safetyAiAssessment.level === "critical" ? "severe" : "high",
          detail: `${compactList([...conflicts, ...gaps, ...triggers], "review triggers")}.${recommendation}`,
          actionHref: routeHref(route, "/risk"),
        }),
      ],
      actions: [action("Review safety risk", routeHref(route, "/risk"), "guide_to_risk")],
    });
  }

  if (context.riskLevel === "severe") {
    return decision({
      decisionId: "gus-severe-risk-decision",
      kind: "warning",
      botState: "warning",
      attentionLevel: "critical",
      shouldOpen: true,
      message: {
        messageId: "gus-smart-severe-risk",
        category: "warning",
        priority: 1,
        message: "Severe risk is showing. Pause and get human safety review before work proceeds.",
        spokenText: "Severe risk is showing. Get human safety review before work proceeds.",
        reason: `Top drivers: ${compactList(context.riskDrivers, "severe predictive risk signals")}. Gus cannot release work.`,
        shouldSpeak: true,
        actionLabel: "Review risk",
        actionHref: routeHref(route, "/risk"),
        actionKey: "guide_to_risk",
        confidence: 0.92,
      },
      signals: [
        signal({
          signalId: "severe-risk",
          source: "risk",
          label: "Severe risk",
          riskLevel: "severe",
          detail: compactList(context.riskDrivers, "Severe predictive risk signals"),
          actionHref: routeHref(route, "/risk"),
        }),
      ],
      actions: [action("Review risk", routeHref(route, "/risk"), "guide_to_risk")],
    });
  }

  if ((context.missingPermitTypes?.length ?? 0) > 0) {
    const permits = context.missingPermitTypes ?? [];
    return decision({
      decisionId: "gus-permit-gap-decision",
      kind: "warning",
      botState: "pointing",
      attentionLevel: "high",
      shouldOpen: true,
      message: {
        messageId: "gus-smart-permit-gap",
        category: "permit_alert",
        priority: 2,
        message: `Permit review may be needed before this work continues: ${compactList(permits, "permit details")}.`,
        spokenText: "Permit review may be needed before this work continues.",
        reason: "Gus can point to the permit workspace, but a human reviewer must verify requirements.",
        shouldSpeak: true,
        actionLabel: "Review permits",
        actionHref: route.startsWith("/safe-predict") ? "/safe-predict/permits" : "/permits",
        actionKey: "guide_to_permits",
        confidence: 0.86,
      },
      signals: permits.map((permitType) =>
        signal({
          signalId: `permit-${permitType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          source: "permit",
          label: permitType,
          riskLevel: "high",
          detail: "Permit status or readiness needs review.",
          actionHref: route.startsWith("/safe-predict") ? "/safe-predict/permits" : "/permits",
        }),
      ),
      actions: [action("Review permits", route.startsWith("/safe-predict") ? "/safe-predict/permits" : "/permits", "guide_to_permits")],
    });
  }

  if ((context.expiredTrainingCount ?? 0) > 0) {
    return decision({
      decisionId: "gus-training-gap-decision",
      kind: "warning",
      botState: "pointing",
      attentionLevel: "high",
      shouldOpen: true,
      message: {
        messageId: "gus-smart-training-gap",
        category: "training_alert",
        priority: 2,
        message: `${context.expiredTrainingCount} expired training item${context.expiredTrainingCount === 1 ? "" : "s"} need review before assignment.`,
        spokenText: "Expired training items need review before assignment.",
        reason: "Training readiness should be checked by a responsible person before work starts.",
        shouldSpeak: true,
        actionLabel: "Check training",
        actionHref: route.startsWith("/safe-predict") ? "/safe-predict/training" : "/training",
        actionKey: "guide_to_training",
        confidence: 0.82,
      },
      signals: [
        signal({
          signalId: "expired-training",
          source: "training",
          label: "Expired training",
          count: context.expiredTrainingCount,
          riskLevel: "high",
          actionHref: route.startsWith("/safe-predict") ? "/safe-predict/training" : "/training",
        }),
      ],
      actions: [action("Check training", route.startsWith("/safe-predict") ? "/safe-predict/training" : "/training", "guide_to_training")],
    });
  }

  if (context.riskLevel === "high") {
    return decision({
      decisionId: "gus-high-risk-decision",
      kind: "warning",
      botState: "warning",
      attentionLevel: "high",
      shouldOpen: true,
      message: {
        messageId: "gus-smart-high-risk",
        category: "risk_alert",
        priority: 2,
        message: "High predictive risk is showing. Review the top drivers and verify controls before the next shift.",
        spokenText: "High predictive risk is showing. Review the top drivers and verify controls.",
        reason: `Top drivers: ${compactList(context.riskDrivers, "high-risk signals")}.`,
        shouldSpeak: false,
        actionLabel: "Review risk",
        actionHref: routeHref(route, "/risk"),
        actionKey: "guide_to_risk",
        confidence: 0.8,
      },
      signals: [
        signal({
          signalId: "high-risk",
          source: "risk",
          label: "High predictive risk",
          riskLevel: "high",
          detail: compactList(context.riskDrivers, "High-risk signals"),
          actionHref: routeHref(route, "/risk"),
        }),
      ],
      actions: [action("Review risk", routeHref(route, "/risk"), "guide_to_risk")],
    });
  }

  if ((context.incompleteJsaFields?.length ?? 0) > 0) {
    return decision({
      decisionId: "gus-jsa-quality-decision",
      kind: "planning_offer",
      botState: "planning",
      attentionLevel: "medium",
      message: {
        messageId: "gus-smart-jsa-fields",
        category: "planning",
        priority: 2,
        message: `JSA draft details are missing: ${compactList(context.incompleteJsaFields, "required planning fields")}.`,
        reason: "Gus can help draft missing planning notes, but a supervisor or required reviewer must check the final draft.",
        actionLabel: "Review JSAs",
        actionHref: "/jsa",
        actionKey: "guide_to_jsa",
        confidence: 0.74,
      },
      signals: (context.incompleteJsaFields ?? []).map((field) =>
        signal({
          signalId: `jsa-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          source: "jsa",
          label: field,
          detail: "Draft JSA information is incomplete.",
        }),
      ),
      actions: [
        { label: "Plan work with Gus", actionKey: "open_planning_mode", requiresConfirmation: false },
        action("Review JSAs", "/jsa", "guide_to_jsa"),
      ],
    });
  }

  if ((context.openHighPriorityActionCount ?? 0) > 0 || (context.openCorrectiveActionCount ?? 0) > 0) {
    const count = context.openHighPriorityActionCount ?? context.openCorrectiveActionCount ?? 0;
    return decision({
      decisionId: "gus-open-actions-decision",
      kind: "nudge",
      botState: "pointing",
      attentionLevel: count > 3 ? "high" : "medium",
      message: {
        messageId: "gus-smart-open-actions",
        category: "reminder",
        priority: 2,
        message: `${count} open action${count === 1 ? "" : "s"} need ownership, due dates, or verification.`,
        reason: "Open safety actions should connect to responsible owners and evidence before closure.",
        actionLabel: "Open actions",
        actionHref: route.startsWith("/safe-predict") ? "/safe-predict/corrective-actions" : "/dashboard",
        actionKey: "guide_to_actions",
        confidence: 0.72,
      },
      signals: [
        signal({
          signalId: "open-corrective-actions",
          source: "action",
          label: "Open actions",
          count,
          riskLevel: count > 3 ? "high" : "moderate",
        }),
      ],
      actions: [action("Open actions", route.startsWith("/safe-predict") ? "/safe-predict/corrective-actions" : "/dashboard", "guide_to_actions")],
    });
  }

  const adjustedPriority =
    feedback === "not_helpful" && routeMessage.category === "safety_tip"
      ? Math.min(5, routeMessage.priority + 1)
      : routeMessage.priority;
  const botState: GusBotState = routeMessage.category === "compliment" ? "wave" : routeMessage.category === "planning" ? "planning" : "idle";

  return decision({
    decisionId: "gus-route-awareness-decision",
    kind: adjustedPriority <= 2 ? "nudge" : "idle",
    botState,
    attentionLevel: adjustedPriority <= 2 ? "medium" : "low",
    message: {
      ...routeMessage,
      priority: adjustedPriority,
    },
    actions: routeMessage.actionKey
      ? [action(routeMessage.actionLabel ?? "Open", routeMessage.actionHref ?? route, routeMessage.actionKey)]
      : [],
  });
}
