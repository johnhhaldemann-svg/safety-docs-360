import { describe, expect, it } from "vitest";
import { evaluateGusAutonomyLoop } from "@/lib/gus/gusAutonomyLoop";
import type { GusCoachDirective, GusCoachLoopState, GusDecision } from "@/lib/gus/gusTypes";
import type { GusContext } from "@/lib/gus/gusContext";

const context: GusContext = {
  currentPage: "SafePredict",
  route: "/safe-predict/predictive-risk",
  riskLevel: "severe",
  riskDrivers: ["Open edge", "Missing permit review"],
};

const decision: GusDecision = {
  decisionId: "decision-critical-risk",
  kind: "warning",
  botState: "warning",
  attentionLevel: "critical",
  message: {
    messageId: "critical-risk",
    category: "risk_alert",
    priority: 1,
    message: "Severe risk is showing. Human review is required.",
    reason: "Top drivers need review.",
    actionKey: "guide_to_risk",
  },
  signals: [],
  actions: [{ actionKey: "guide_to_risk", label: "Review risk", href: "/safe-predict/predictive-risk" }],
  shouldOpen: true,
  shouldSpeak: true,
};

const directive: GusCoachDirective = {
  directiveId: "directive-critical-risk",
  priority: "critical",
  title: "Review risk now",
  instruction: "Review the critical risk items before work moves forward.",
  whyItMatters: "Severe risk can expose crews to serious injury if controls are not verified.",
  recommendedActionLabel: "Review risk",
  recommendedActionHref: "/safe-predict/predictive-risk",
  recommendedActionKey: "guide_to_risk",
  followUps: [
    {
      followUpId: "reviewer",
      prompt: "Who is reviewing this before work continues?",
      actionLabel: "Answer reviewer",
    },
  ],
  sourceDecisionId: decision.decisionId,
  unresolved: true,
  humanReviewRequired: true,
};

const loopState: GusCoachLoopState = {
  activeDirective: directive,
  unresolvedDirectives: [directive],
};

function baseInput(overrides: Partial<Parameters<typeof evaluateGusAutonomyLoop>[0]> = {}) {
  return {
    context,
    decision,
    coachDirective: directive,
    coachLoopState: loopState,
    isVisible: true,
    isOpen: false,
    isUserTyping: false,
    hasOpenModal: false,
    voiceAvailable: true,
    micAvailable: true,
    memoryAvailable: true,
    conversationAvailable: true,
    now: new Date("2026-05-22T12:00:00.000Z"),
    ...overrides,
  };
}

describe("Gus autonomy loop", () => {
  it("opens for critical review items when the UI is clear", () => {
    const result = evaluateGusAutonomyLoop(baseInput());

    expect(result.shouldOpen).toBe(true);
    expect(result.autonomyDecision.allowed).toBe(true);
    expect(result.autonomyDecision.action.limit).toBe("left");
    expect(result.autonomyDecision.shouldInterrupt).toBe(true);
    expect(result.status.state).toBe("waiting_on_review");
    expect(result.status.label).toBe("Waiting on review answer");
    expect(result.autonomyDecision.humanReviewRequired).toBe(true);
  });

  it("does not open while the user is typing or a modal is open", () => {
    const typing = evaluateGusAutonomyLoop(baseInput({ isUserTyping: true }));
    const modal = evaluateGusAutonomyLoop(baseInput({ hasOpenModal: true }));

    expect(typing.shouldOpen).toBe(false);
    expect(typing.autonomyDecision.shouldInterrupt).toBe(false);
    expect(modal.shouldOpen).toBe(false);
    expect(modal.autonomyDecision.shouldInterrupt).toBe(false);
  });

  it("follows up inside an open panel when a new unresolved high priority appears", () => {
    const result = evaluateGusAutonomyLoop(
      baseInput({
        isOpen: true,
        lastUnresolvedPriority: "medium",
      }),
    );

    expect(result.shouldOpen).toBe(false);
    expect(result.shouldFollowUp).toBe(true);
  });

  it("does not duplicate follow-ups for the same unresolved priority", () => {
    const result = evaluateGusAutonomyLoop(
      baseInput({
        isOpen: true,
        lastUnresolvedPriority: "critical",
      }),
    );

    expect(result.shouldFollowUp).toBe(false);
  });

  it("reports limited status on disabled or quiet routes", () => {
    const result = evaluateGusAutonomyLoop(baseInput({ isVisible: false }));

    expect(result.shouldOpen).toBe(false);
    expect(result.status.state).toBe("limited");
    expect(result.status.label).toBe("Coach paused");
  });
});
