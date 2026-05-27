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
      prompt: "Who is the safety lead for this item, and what controls should they field-check first?",
      actionLabel: "Ask safety lead question",
    });
  }

  if ((context.aiEngineCriticalControlGaps?.length ?? 0) > 0 || (context.aiEngineReviewTriggers?.length ?? 0) > 0) {
    base.push({
      followUpId: "ai-engine-control-check",
      prompt: `Help me turn these safety cues into field questions for the safety lead: ${compactList(
        [...(context.aiEngineCriticalControlGaps ?? []), ...(context.aiEngineReviewTriggers ?? [])],
        "control gaps or review triggers",
      )}.`,
      actionLabel: "Draft lead questions",
    });
  }

  if ((context.missingPermitTypes?.length ?? 0) > 0) {
    base.push({
      followUpId: "draft-permit-review",
      prompt: `Help me draft a permit field-check list for ${compactList(context.missingPermitTypes, "this work")}.`,
      actionLabel: "Draft permit check",
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
      prompt: "Help me draft the missing JSA field questions for this task.",
      actionLabel: "Draft JSA questions",
    });
  }

  base.push({
    followUpId: "next-safe-step",
    prompt: "Give me the next three safety lead steps for this page.",
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
    teachingMoment: {
      notice: sanitizeGusTriggerLanguage(directive.teachingMoment.notice),
      why: sanitizeGusTriggerLanguage(directive.teachingMoment.why),
      fieldQuestion: sanitizeGusTriggerLanguage(directive.teachingMoment.fieldQuestion),
      nextStep: sanitizeGusTriggerLanguage(directive.teachingMoment.nextStep),
    },
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
          ? "Do not continue until the safety lead walks the critical controls now."
          : "Have the safety lead walk these control items before work moves forward.",
      whyItMatters: `Review items: ${compactList(
        [...(context.aiEngineCriticalControlGaps ?? []), ...(context.aiEngineReviewTriggers ?? [])],
        "critical control gaps or review triggers",
      )}.`,
      teachingMoment: {
        notice: `I see control items that need a closer look: ${compactList(
          [...(context.aiEngineCriticalControlGaps ?? []), ...(context.aiEngineReviewTriggers ?? [])],
          "critical controls or field triggers",
        )}.`,
        why: "Critical controls are the pieces that keep a bad day from becoming a serious injury.",
        fieldQuestion: "Who is walking the controls on site, and what evidence will show each one is in place?",
        nextStep:
          context.aiEngineActionTimeframe === "immediate"
            ? "Hold the affected work area and bring the safety lead to the controls before anyone continues."
            : "Walk the controls with the safety lead before the next work step.",
      },
      recommendedActionLabel: action?.label ?? "Review safety risk",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_risk",
    };
  }

  if (decision.message.category === "permit_alert") {
    return {
      title: "Permit review comes first",
      instruction: "Check permit status and signatures before work moves forward.",
      whyItMatters: `Permit items need a safety lead check: ${compactList(context.missingPermitTypes, "permit readiness")}.`,
      teachingMoment: {
        notice: `Permit readiness is unclear for ${compactList(context.missingPermitTypes, "this work")}.`,
        why: "A missing permit detail can mean the controls, signatures, or limits are not lined up yet.",
        fieldQuestion: "Which permit condition would stop this job if it is missing or unsigned?",
        nextStep: "Open the permit record and walk the missing item with the person in charge.",
      },
      recommendedActionLabel: action?.label ?? "Review permits",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_permits",
    };
  }

  if (decision.message.category === "training_alert") {
    return {
      title: "Check crew readiness",
      instruction: "Field-check training readiness before naming people for this work.",
      whyItMatters: `${context.expiredTrainingCount ?? 0} expired training item${context.expiredTrainingCount === 1 ? "" : "s"} need a safety lead check.`,
      teachingMoment: {
        notice: `${context.expiredTrainingCount ?? 0} training item${context.expiredTrainingCount === 1 ? "" : "s"} look expired or incomplete.`,
        why: "Training gaps can put the wrong person into a hazard they are not ready to control.",
        fieldQuestion: "Which worker is affected, and what task are they being asked to do?",
        nextStep: "Check the training record before the crew assignment is made.",
      },
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
          ? "Do not continue until the safety lead walks the risk drivers."
          : "Walk the top drivers and field-check controls before the next shift.",
      whyItMatters: `Current drivers: ${compactList(context.riskDrivers, decision.message.reason ?? "risk drivers need review")}.`,
      teachingMoment: {
        notice: `The risk drivers are pointing at ${compactList(context.riskDrivers, decision.message.reason ?? "the current work pattern")}.`,
        why: "Risk drivers are clues; the field walk decides whether the controls match the actual work.",
        fieldQuestion: "What changed on site that could make this risk show up right now?",
        nextStep:
          decision.attentionLevel === "critical"
            ? "Bring the safety lead to the workface before the next task step."
            : "Walk the drivers and write down which control owns each one.",
      },
      recommendedActionLabel: action?.label ?? "Review risk",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_risk",
    };
  }

  if (decision.kind === "planning_offer") {
    return {
      title: "Finish the draft plan",
      instruction: "Fill the missing planning details before the safety lead checks the JSA or safe work plan.",
      whyItMatters: `Missing items: ${compactList(context.incompleteJsaFields, "task, hazards, controls, or safety lead")}.`,
      teachingMoment: {
        notice: `The draft is missing ${compactList(context.incompleteJsaFields, "task, hazards, controls, or safety lead")}.`,
        why: "A plan teaches the crew only when the task, hazards, controls, and owner are clear.",
        fieldQuestion: "What would the crew need to know before they could explain the safe way to do this work?",
        nextStep: "Fill the missing fields, then hand the draft to the safety lead for the final check.",
      },
      recommendedActionLabel: action?.label ?? "Plan work with Gus",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "open_planning_mode",
    };
  }

  if ((context.openHighPriorityActionCount ?? 0) > 0 || (context.openCorrectiveActionCount ?? 0) > 0) {
    const count = context.openHighPriorityActionCount ?? context.openCorrectiveActionCount ?? 0;
    return {
      title: "Assign open action ownership",
      instruction: "Name the owner, due date, and evidence needed for open safety items.",
      whyItMatters: `${count} open safety item${count === 1 ? "" : "s"} can hide risk if ownership is unclear.`,
      teachingMoment: {
        notice: `${count} open safety item${count === 1 ? "" : "s"} still need ownership or evidence.`,
        why: "An open item without an owner becomes background noise instead of a control.",
        fieldQuestion: "Who owns the closeout, and what evidence will prove it is done?",
        nextStep: "Name the owner and due date, then attach the evidence target.",
      },
      recommendedActionLabel: action?.label ?? "Open actions",
      recommendedActionHref: action?.href,
      recommendedActionKey: action?.actionKey ?? "guide_to_actions",
    };
  }

  return {
    title: "Keep the review moving",
    instruction: "Check the current page for missing safety items and ask Gus to draft next-step notes if needed.",
    whyItMatters: "Small checks now keep missing information visible for the safety lead.",
    teachingMoment: {
      notice: "I am watching for missing safety details on this page.",
      why: "Small gaps are easier to fix before they turn into rushed field decisions.",
      fieldQuestion: "What detail would a safety lead ask for before trusting this plan?",
      nextStep: "Ask Gus for draft notes or open the item that needs attention.",
    },
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
    teachingMethod: "field_coach",
    teachingMoment: text.teachingMoment,
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
