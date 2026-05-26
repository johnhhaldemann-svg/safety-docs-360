import type { GusContext } from "@/lib/gus/gusContext";
import { sanitizeGusTriggerLanguage } from "@/lib/gus/gusSafetyGate";
import { isForbiddenGusAction } from "@/lib/gus/gusTrustRules";
import { validateGusOutput } from "@/lib/gus/gusValidation";
import type {
  GusCoachDirective,
  GusCoachFollowUp,
  GusCoachLoopState,
  GusCoachPriority,
  GusDecision,
} from "@/lib/gus/gusTypes";

function priorityForDecision(decision: GusDecision): GusCoachPriority {
  if (decision.attentionLevel === "critical") return "critical";
  if (decision.attentionLevel === "high") return "high";
  if (decision.attentionLevel === "medium") return "medium";
  return "low";
}

function firstAction(decision: GusDecision) {
  return decision.actions.find((item) => !isForbiddenGusAction(item.actionKey));
}

function compactList(items: string[] | undefined, fallback: string) {
  const values = (items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  return values.length > 0 ? values.join(", ") : fallback;
}

function followUpsFor(decision: GusDecision, context: GusContext): GusCoachFollowUp[] {
  const base: GusCoachFollowUp[] = [];

  if (decision.attentionLevel === "critical" || decision.attentionLevel === "high") {
    base.push({
      followUpId: "reviewer-owner",
      prompt: "Who is the human reviewer for this item, and what controls should they verify first?",
      actionLabel: "Ask reviewer question",
    });
  }

  if ((context.aiEngineCriticalControlGaps?.length ?? 0) > 0 || (context.aiEngineReviewTriggers?.length ?? 0) > 0) {
    base.push({
      followUpId: "ai-engine-control-check",
      prompt: `Help me turn these safety review items into reviewer questions: ${compactList(
        [...(context.aiEngineCriticalControlGaps ?? []), ...(context.aiEngineReviewTriggers ?? [])],
        "control gaps or review triggers",
      )}.`,
      actionLabel: "Draft reviewer questions",
    });
  }

  if ((context.missingPermitTypes?.length ?? 0) > 0) {
    base.push({
      followUpId: "draft-permit-review",
      prompt: `Help me draft a permit review checklist for ${compactList(context.missingPermitTypes, "this work")}.`,
      actionLabel: "Draft permit review",
    });
  }

  if ((context.expiredTrainingCount ?? 0) > 0) {
    base.push({
      followUpId: "training-readiness",
      prompt: "What training readiness items should be checked before assigning this crew?",
      actionLabel: "Check training readiness",
    });
  }

  if ((context.incompleteJsaFields?.length ?? 0) > 0 || decision.kind === "planning_offer") {
    base.push({
      followUpId: "draft-jsa-review",
      prompt: "Help me draft the missing JSA review questions for this task.",
      actionLabel: "Draft JSA questions",
    });
  }

  base.push({
    followUpId: "next-safe-step",
    prompt: "Give me the next three safety review steps for this page.",
    actionLabel: "Next 3 steps",
  });

  return base.slice(0, 3).map((item) => ({
    ...item,
    prompt: sanitizeGusTriggerLanguage(item.prompt),
    actionLabel: sanitizeGusTriggerLanguage(item.actionLabel),
  }));
}

function sanitizeDirective(directive: GusCoachDirective): GusCoachDirective {
  return {
    ...directive,
    title: sanitizeGusTriggerLanguage(directive.title),
    instruction: sanitizeGusTriggerLanguage(directive.instruction),
    whyItMatters: sanitizeGusTriggerLanguage(directive.whyItMatters),
    recommendedActionLabel: sanitizeGusTriggerLanguage(directive.recommendedActionLabel),
    followUps: directive.followUps.map((item) => ({
      ...item,
      prompt: sanitizeGusTriggerLanguage(item.prompt),
      actionLabel: sanitizeGusTriggerLanguage(item.actionLabel),
    })),
  };
}

function directiveText(decision: GusDecision, context: GusContext) {
  const action = firstAction(decision);

  if (
    context.aiEngineLinked &&
    context.safetyAiAssessment &&
    (context.safetyAiAssessment.stopWorkReviewRecommended || (context.aiEngineCriticalControlGaps?.length ?? 0) > 0)
  ) {
    return {
      title: context.safetyAiAssessment.level === "critical" ? "Review critical controls now" : "Review safety controls next",
      instruction:
        context.aiEngineActionTimeframe === "immediate"
          ? "Pause and get the assigned human reviewer to verify critical controls now."
          : "Have the assigned human reviewer verify these review items before work moves forward.",
      whyItMatters: `Review items: ${compactList(
        [...(context.aiEngineCriticalControlGaps ?? []), ...(context.aiEngineReviewTriggers ?? [])],
        "critical control gaps or review triggers",
      )}.`,
      recommendedActionLabel: action?.label ?? "Review safety risk",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_risk",
    };
  }

  if (decision.message.category === "permit_alert") {
    return {
      title: "Permit review comes first",
      instruction: "Review the permit status and required signatures before work moves forward.",
      whyItMatters: `Permit items need human verification: ${compactList(context.missingPermitTypes, "permit readiness")}.`,
      recommendedActionLabel: action?.label ?? "Review permits",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_permits",
    };
  }

  if (decision.message.category === "training_alert") {
    return {
      title: "Check crew readiness",
      instruction: "Verify training readiness before assigning people to this work.",
      whyItMatters: `${context.expiredTrainingCount ?? 0} expired training item${context.expiredTrainingCount === 1 ? "" : "s"} need human review.`,
      recommendedActionLabel: action?.label ?? "Check training",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_training",
    };
  }

  if (decision.message.category === "risk_alert" || decision.message.category === "warning") {
    return {
      title: decision.attentionLevel === "critical" ? "Review risk now" : "Review risk next",
      instruction:
        decision.attentionLevel === "critical"
          ? "Pause and get human safety review before work moves forward."
          : "Review the top drivers and verify controls before the next shift.",
      whyItMatters: `Current drivers: ${compactList(context.riskDrivers, decision.message.reason ?? "risk drivers need review")}.`,
      recommendedActionLabel: action?.label ?? "Review risk",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_risk",
    };
  }

  if (decision.kind === "planning_offer") {
    return {
      title: "Finish the draft plan",
      instruction: "Fill the missing planning details before a reviewer checks the JSA or safe work plan.",
      whyItMatters: `Missing items: ${compactList(context.incompleteJsaFields, "task, hazards, controls, or review owner")}.`,
      recommendedActionLabel: action?.label ?? "Plan work with Gus",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "open_planning_mode",
    };
  }

  if ((context.openHighPriorityActionCount ?? 0) > 0 || (context.openCorrectiveActionCount ?? 0) > 0) {
    const count = context.openHighPriorityActionCount ?? context.openCorrectiveActionCount ?? 0;
    return {
      title: "Assign open action ownership",
      instruction: "Confirm owner, due date, and evidence needed for open safety actions.",
      whyItMatters: `${count} open action${count === 1 ? "" : "s"} can hide risk if ownership is unclear.`,
      recommendedActionLabel: action?.label ?? "Open actions",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_actions",
    };
  }

  return {
    title: "Keep the review moving",
    instruction: "Review the current page for missing safety items and ask Gus to draft next-step notes if needed.",
    whyItMatters: "Small checks now help keep missing information visible for the human reviewer.",
    recommendedActionLabel: action?.label ?? "Ask Gus",
    recommendedActionHref: action?.href,
    recommendedActionKey: action?.actionKey ?? "recommend_review",
  };
}

export function buildGusCoachDirective(decision: GusDecision, context: GusContext): GusCoachDirective {
  const text = directiveText(decision, context);
  const directive: GusCoachDirective = {
    directiveId: `coach-${decision.decisionId}-${decision.message.messageId}`,
    priority: priorityForDecision(decision),
    title: text.title,
    instruction: text.instruction,
    whyItMatters: text.whyItMatters,
    recommendedActionLabel: text.recommendedActionLabel,
    recommendedActionHref: text.recommendedActionHref,
    recommendedActionKey: isForbiddenGusAction(text.recommendedActionKey) ? "recommend_review" : text.recommendedActionKey,
    followUps: followUpsFor(decision, context),
    sourceDecisionId: decision.decisionId,
    unresolved: decision.attentionLevel === "critical" || decision.attentionLevel === "high" || decision.kind !== "idle",
    humanReviewRequired: true,
  };
  const validation = validateGusOutput(directive);

  return sanitizeDirective(validation.sanitizedOutput as GusCoachDirective);
}

export function updateGusCoachLoopState(
  previousState: GusCoachLoopState,
  directive: GusCoachDirective,
): GusCoachLoopState {
  const unresolved = [
    directive,
    ...(previousState.unresolvedDirectives ?? []).filter((item) => item.directiveId !== directive.directiveId),
  ]
    .filter((item) => item.unresolved)
    .slice(0, 5);

  return {
    activeDirective: directive,
    unresolvedDirectives: unresolved,
    lastFollowUpAt: previousState.lastFollowUpAt,
  };
}
