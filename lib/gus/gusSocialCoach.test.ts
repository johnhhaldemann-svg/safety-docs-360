import { describe, expect, it } from "vitest";
import {
  createGusAutonomousMessage,
  createGusProactiveConversationLine,
  getGusSocialLineId,
  gusHumorRatio,
  shouldUseGusLightHumor,
} from "@/lib/gus/gusSocialCoach";
import type { GusContext } from "@/lib/gus/gusContext";
import type { GusDecision } from "@/lib/gus/gusTypes";

const context: GusContext = {
  currentPage: "Dashboard",
  route: "/dashboard",
};

const baseDecision: GusDecision = {
  decisionId: "test-decision",
  kind: "idle",
  botState: "idle",
  attentionLevel: "low",
  message: {
    messageId: "test-message",
    category: "safety_tip",
    priority: 3,
    message: "Review open safety signals before the next shift.",
    reason: "Draft guidance only.",
    shouldSpeak: true,
  },
  signals: [],
  actions: [],
  shouldOpen: false,
  shouldSpeak: false,
};

describe("Gus social coach", () => {
  it("keeps light humor near ten percent for non-critical check-ins", () => {
    const sampleSize = 1_000;
    const humorousCount = Array.from({ length: sampleSize }, (_, index) =>
      shouldUseGusLightHumor(`seed-${index}`),
    ).filter(Boolean).length;

    expect(gusHumorRatio()).toBe(0.1);
    expect(humorousCount).toBeGreaterThanOrEqual(70);
    expect(humorousCount).toBeLessThanOrEqual(130);
  });

  it("creates autonomous social check-ins without approval language", () => {
    const message = createGusAutonomousMessage(baseDecision, context, "normal-seed");

    expect(message.message).toMatch(/Gus|Coach|safety|review/i);
    expect(message.shouldSpeak).toBe(true);
    expect(getGusSocialLineId(message)).not.toBe(baseDecision.message.messageId);
    expect(message.message).not.toMatch(/approved|compliant|safe to start|released for work/i);
  });

  it("rotates away from recently used social line variants", () => {
    const first = createGusAutonomousMessage(baseDecision, context, "same-seed");
    const second = createGusAutonomousMessage(baseDecision, context, "same-seed", [getGusSocialLineId(first)]);

    expect(getGusSocialLineId(second)).not.toBe(getGusSocialLineId(first));
    expect(second.message).not.toBe(first.message);
  });

  it("does not use humor for high or critical safety warnings", () => {
    const warning: GusDecision = {
      ...baseDecision,
      kind: "warning",
      attentionLevel: "critical",
      message: {
        ...baseDecision.message,
        priority: 1,
        category: "warning",
        message: "Severe risk is showing. Human review is required.",
      },
    };

    const message = createGusAutonomousMessage(warning, context, "seed-that-might-be-funny");

    expect(message.message).not.toContain("Tiny joke");
    expect(message.message).toMatch(/review|reviewer|controls/i);
  });

  it("adds proactive conversation lines that keep Gus social and safety-focused", () => {
    const line = createGusProactiveConversationLine(baseDecision, context, "conversation-seed");

    expect(line).toMatch(/Gus|Coach|safety|review/i);
    expect(line).toContain("safety");
    expect(line).not.toMatch(/approve|submit|release/i);
  });
});
