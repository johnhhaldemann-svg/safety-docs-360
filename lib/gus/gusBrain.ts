import type { GusContext } from "@/lib/gus/gusContext";
import { isForbiddenGusAction } from "@/lib/gus/gusTrustRules";
import { validateGusOutput } from "@/lib/gus/gusValidation";
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
  return actions.filter((item) => !isForbiddenGusAction(item.actionKey));
}

function safeMessage(message: GusMessage): GusMessage {
  const validation = validateGusOutput(message);
  return validation.sanitizedOutput as GusMessage;
}

function signal(params: GusContextSignal): GusContextSignal {
  return params;
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
