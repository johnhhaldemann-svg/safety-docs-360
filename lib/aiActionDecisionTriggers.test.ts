import { describe, expect, it } from "vitest";
import { buildAiActionDecisionTriggers } from "@/lib/aiActionDecisionTriggers";

describe("buildAiActionDecisionTriggers", () => {
  it("maps safety action words into deterministic decision intents", () => {
    const triggers = buildAiActionDecisionTriggers({
      source: "user_message",
      sourceText: "Escalate this, assign a reviewer, inspect the trench, then resolve only after verification.",
      targetModule: "command_center",
      riskLevel: "high",
      humanReviewRequired: true,
    });

    expect(triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionWord: "escalate", intent: "request_escalation", humanReviewRequired: true }),
        expect.objectContaining({ actionWord: "inspect", intent: "request_field_verification", humanReviewRequired: true }),
        expect.objectContaining({ actionWord: "assign", intent: "request_assignment", requiresConfirmation: true }),
        expect.objectContaining({ actionWord: "resolve", intent: "request_resolution", requiresConfirmation: true }),
      ]),
    );
  });

  it("blocks authority words and remaps them to human review", () => {
    const triggers = buildAiActionDecisionTriggers({
      source: "user_message",
      sourceText: "Approve the permit and declare compliant before releasing the work.",
      targetModule: "permit",
    });

    expect(triggers[0]).toEqual(
      expect.objectContaining({
        intent: "blocked_authority",
        blocked: true,
        humanReviewRequired: true,
        requiresConfirmation: true,
      }),
    );
    expect(triggers.map((trigger) => trigger.actionWord)).toEqual(
      expect.arrayContaining(["approve", "declare compliant", "release"]),
    );
  });

  it("requires a reasoned human decision for dismiss and ignore language", () => {
    const triggers = buildAiActionDecisionTriggers({
      source: "ai_action_queue",
      sourceText: "Dismiss this duplicate or ignore it for this project after supervisor review.",
      targetModule: "predictive_risk",
      riskLevel: "moderate",
    });

    expect(triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionWord: "dismiss", intent: "request_dismissal", requiresConfirmation: true }),
        expect.objectContaining({ actionWord: "ignore", intent: "suppress_or_ignore", requiresConfirmation: true }),
      ]),
    );
  });
});
