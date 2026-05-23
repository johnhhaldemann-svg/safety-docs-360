import type { GusContext } from "@/lib/gus/gusContext";
import { evaluateGusAutonomyAction } from "@/lib/gus/gusOperatingEnvelope";
import type {
  GusAutonomyDecision,
  GusAutonomyStatus,
  GusCoachDirective,
  GusCoachLoopState,
  GusDecision,
} from "@/lib/gus/gusTypes";

type GusAutonomyLoopInput = {
  context: GusContext;
  decision: GusDecision;
  coachDirective?: GusCoachDirective;
  coachLoopState: GusCoachLoopState;
  isVisible: boolean;
  isOpen: boolean;
  isUserTyping: boolean;
  hasOpenModal: boolean;
  voiceAvailable: boolean;
  micAvailable: boolean;
  memoryAvailable: boolean;
  conversationAvailable: boolean;
  lastUnresolvedPriority?: string | null;
  now?: Date;
};

function priorityRank(priority: GusCoachDirective["priority"] | undefined) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

function statusLabel(input: GusAutonomyLoopInput) {
  if (!input.isVisible) return { state: "limited" as const, label: "Coach paused", detail: "Gus is outside an allowed coaching route or quiet state." };
  if (!input.conversationAvailable) return { state: "limited" as const, label: "Coach limited", detail: "Conversation support is unavailable right now." };
  if (input.coachDirective?.priority === "critical" || input.coachDirective?.priority === "high") {
    return {
      state: "waiting_on_review" as const,
      label: "Waiting on review answer",
      detail: input.coachDirective.instruction,
    };
  }
  return {
    state: "monitoring" as const,
    label: "Monitoring active work",
    detail: "Gus is checking context, coach items, voice, mic, memory, and conversation readiness.",
  };
}

function actionKeyForInput(input: GusAutonomyLoopInput) {
  if (input.coachDirective?.priority === "critical" || input.coachDirective?.priority === "high") return "ask_followup";
  if (input.decision.shouldOpen) return "coach_user";
  return "observe_context";
}

export function evaluateGusAutonomyLoop(input: GusAutonomyLoopInput): {
  autonomyDecision: GusAutonomyDecision;
  status: GusAutonomyStatus;
  shouldOpen: boolean;
  shouldFollowUp: boolean;
} {
  const now = input.now ?? new Date();
  const statusText = statusLabel(input);
  const actionDecision = evaluateGusAutonomyAction(actionKeyForInput(input), statusText.label);
  const criticalOrHigh = input.decision.attentionLevel === "critical" || input.decision.attentionLevel === "high";
  const unresolvedPriority = input.coachDirective?.priority;
  const unresolvedChanged = Boolean(
    unresolvedPriority &&
      unresolvedPriority !== input.lastUnresolvedPriority &&
      priorityRank(unresolvedPriority) >= priorityRank("high"),
  );
  const blockedByUi = input.isUserTyping || input.hasOpenModal;
  const shouldOpen =
    input.isVisible &&
    !input.isOpen &&
    !blockedByUi &&
    !actionDecision.blocked &&
    (criticalOrHigh || unresolvedChanged);
  const shouldFollowUp =
    input.isVisible &&
    input.isOpen &&
    !blockedByUi &&
    !actionDecision.blocked &&
    unresolvedChanged &&
    (input.coachLoopState.unresolvedDirectives?.length ?? 0) > 0;

  return {
    autonomyDecision: {
      ...actionDecision,
      shouldOpen,
      shouldInterrupt: criticalOrHigh && !blockedByUi,
    },
    status: {
      statusId: `gus-autonomy-status-${statusText.state}`,
      state: actionDecision.blocked ? "blocked" : statusText.state,
      label: actionDecision.blocked ? "Coach blocked" : statusText.label,
      detail: actionDecision.blocked ? actionDecision.reason : statusText.detail,
      voiceAvailable: input.voiceAvailable,
      micAvailable: input.micAvailable,
      contextAvailable: Boolean(input.context.route && input.context.currentPage),
      memoryAvailable: input.memoryAvailable,
      conversationAvailable: input.conversationAvailable,
      aiEngineAvailable: input.context.aiEngineLinked === true || Boolean(input.context.safetyAiAssessment),
      lastCheckedAt: now.toISOString(),
    },
    shouldOpen,
    shouldFollowUp,
  };
}
