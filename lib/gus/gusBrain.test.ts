import { describe, expect, it } from "vitest";
import { decideGusBehavior } from "@/lib/gus/gusBrain";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusMessage } from "@/lib/gus/gusTypes";

const routeMessage: GusMessage = {
  messageId: "route-tip",
  category: "safety_tip",
  priority: 3,
  message: "I can help review safety planning details.",
  reason: "Draft guidance only.",
  actionLabel: "Review dashboard",
  actionHref: "/dashboard",
  actionKey: "guide_to_dashboard",
};

function context(overrides: Partial<GusContext> = {}): GusContext {
  return {
    currentPage: "SafePredict",
    route: "/safe-predict",
    ...overrides,
  };
}

describe("decideGusBehavior", () => {
  it("surfaces severe risk as an active warning", () => {
    const decision = decideGusBehavior({
      context: context({
        riskLevel: "severe",
        riskDrivers: ["Open leading edge", "Expired permit"],
      }),
      routeMessage,
    });

    expect(decision.kind).toBe("warning");
    expect(decision.botState).toBe("warning");
    expect(decision.attentionLevel).toBe("critical");
    expect(decision.shouldOpen).toBe(true);
    expect(decision.message.shouldSpeak).toBe(true);
    expect(decision.message.message).toMatch(/Severe risk/i);
    expect(decision.message.message).not.toMatch(/\bapproved\b|\bcompliant\b|\bsafe to start\b/i);
  });

  it("prioritizes permit gaps before generic route tips", () => {
    const decision = decideGusBehavior({
      context: context({
        riskLevel: "low",
        missingPermitTypes: ["Hot Work Permit", "Excavation Permit"],
      }),
      routeMessage,
    });

    expect(decision.kind).toBe("warning");
    expect(decision.botState).toBe("pointing");
    expect(decision.message.category).toBe("permit_alert");
    expect(decision.message.shouldSpeak).toBe(true);
    expect(decision.actions.map((item) => item.actionKey)).toContain("guide_to_permits");
  });

  it("surfaces training gaps as review items", () => {
    const decision = decideGusBehavior({
      context: context({
        expiredTrainingCount: 2,
      }),
      routeMessage,
    });

    expect(decision.kind).toBe("warning");
    expect(decision.message.category).toBe("training_alert");
    expect(decision.signals[0]).toMatchObject({ source: "training", count: 2 });
  });

  it("keeps quiet mode silent and muted", () => {
    const decision = decideGusBehavior({
      context: context({ riskLevel: "severe" }),
      routeMessage,
      quietMode: true,
    });

    expect(decision.kind).toBe("silent");
    expect(decision.botState).toBe("muted");
    expect(decision.attentionLevel).toBe("none");
    expect(decision.shouldOpen).toBe(false);
  });

  it("lowers generic tip priority after not helpful feedback without suppressing safety rules", () => {
    const generic = decideGusBehavior({
      context: context({ riskLevel: "low" }),
      routeMessage,
      feedback: "not_helpful",
    });
    const warning = decideGusBehavior({
      context: context({ riskLevel: "high", riskDrivers: ["Open corrective action"] }),
      routeMessage,
      feedback: "not_helpful",
    });

    expect(generic.message.priority).toBe(4);
    expect(warning.kind).toBe("warning");
    expect(warning.message.priority).toBe(2);
  });

  it("filters forbidden companion actions", () => {
    const decision = decideGusBehavior({
      context: context(),
      routeMessage: {
        ...routeMessage,
        actionKey: "approve_permit",
      },
    });

    expect(decision.actions).toEqual([]);
    expect(decision.message.actionKey).toBe("recommend_review");
  });
});
