import { describe, expect, it } from "vitest";
import { buildGusCoachDirective, updateGusCoachLoopState } from "@/lib/gus/gusCoachLoop";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusDecision } from "@/lib/gus/gusTypes";

const baseContext: GusContext = {
  currentPage: "SafePredict",
  route: "/safe-predict/predictive-risk",
  riskLevel: "severe",
  riskDrivers: ["Drop Hazard 3rd Floor", "Open incident review"],
  missingPermitTypes: ["Hot Work"],
  expiredTrainingCount: 2,
  openHighPriorityActionCount: 1,
};

const baseDecision: GusDecision = {
  decisionId: "decision-1",
  kind: "warning",
  botState: "warning",
  attentionLevel: "critical",
  message: {
    messageId: "message-1",
    category: "warning",
    priority: 1,
    message: "Severe risk is showing. Human review is required.",
    reason: "Top drivers need review.",
    actionLabel: "Review risk",
    actionHref: "/safe-predict/predictive-risk",
    actionKey: "guide_to_risk",
  },
  signals: [],
  actions: [{ label: "Review risk", href: "/safe-predict/predictive-risk", actionKey: "guide_to_risk" }],
  shouldOpen: true,
  shouldSpeak: true,
};

describe("Gus coach loop", () => {
  it("turns severe risk into a firm advisory coach directive", () => {
    const directive = buildGusCoachDirective(baseDecision, baseContext);

    expect(directive.priority).toBe("critical");
    expect(directive.title).toBe("Review risk now");
    expect(directive.instruction).toContain("human safety review");
    expect(directive.whyItMatters).toContain("Drop Hazard 3rd Floor");
    expect(directive.humanReviewRequired).toBe(true);
    expect(directive.followUps.some((item) => item.prompt.includes("human reviewer"))).toBe(true);
  });

  it("creates permit and training follow-ups when context includes gaps", () => {
    const directive = buildGusCoachDirective(
      {
        ...baseDecision,
        message: {
          ...baseDecision.message,
          category: "permit_alert",
        },
      },
      baseContext,
    );

    expect(directive.title).toBe("Permit review comes first");
    expect(directive.followUps.map((item) => item.followUpId)).toContain("draft-permit-review");
    expect(directive.followUps.map((item) => item.followUpId)).toContain("training-readiness");
  });

  it("does not allow approval, release, compliance, or human identity language", () => {
    const directive = buildGusCoachDirective(baseDecision, baseContext);
    const combined = [
      directive.title,
      directive.instruction,
      directive.whyItMatters,
      ...directive.followUps.map((item) => item.prompt),
    ].join(" ");

    expect(combined).not.toMatch(/approved|compliant|safe to start|released for work|I am human|I'm human/i);
  });

  it("tracks unresolved coach items without duplicating the active directive", () => {
    const directive = buildGusCoachDirective(baseDecision, baseContext);
    const first = updateGusCoachLoopState({ unresolvedDirectives: [] }, directive);
    const second = updateGusCoachLoopState(first, directive);

    expect(first.unresolvedDirectives).toHaveLength(1);
    expect(second.unresolvedDirectives).toHaveLength(1);
    expect(second.activeDirective?.directiveId).toBe(directive.directiveId);
  });
});
