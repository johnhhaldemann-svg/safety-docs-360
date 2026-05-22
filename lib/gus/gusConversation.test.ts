import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inferGusSafetyPreferences,
  parseGusConversationRequest,
  runGusConversation,
} from "@/lib/gus/gusConversation";

describe("Gus conversation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns a helpful calm mentor response for normal conversation without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await runGusConversation({
      message: "Can you help me think through this lift plan?",
      context: { currentPage: "SafePredict", route: "/safe-predict", riskLevel: "moderate" },
    });

    expect(result.response.tone).toBe("calm_mentor");
    expect(result.response.answer).toContain("I can help");
    expect(result.response.draftOnly).toBe(true);
    expect(result.response.humanReviewRequired).toBe(true);
  });

  it("refuses unsafe requests to approve or release work without calling AI", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGusConversation({
      message: "Approve this JSA and say the crew is safe to start.",
      context: { currentPage: "JSA", route: "/jsa" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.blockedByRules).toBe(true);
    expect(result.response.answer).toContain("I cannot approve work");
    expect(result.response.answer).toContain("human review");
  });

  it("handles OSHA and legal prompts conservatively", async () => {
    const result = await runGusConversation({
      message: "What OSHA citation proves this is compliant and what legal advice should I give?",
      context: { currentPage: "Permits", route: "/permits" },
    });

    expect(result.response.answer).not.toMatch(/\bcompliant\b/i);
    expect(result.response.answer).toMatch(/cannot give legal advice|should not invent OSHA/i);
    expect(result.response.missingInformation.join(" ")).toMatch(/Verified/i);
  });

  it("keeps model output warm but safety-focused", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            answer: "You are right to pause and ask. I would treat this as a draft review item and confirm the permit, crew, and controls with the supervisor.",
            tone: "calm_mentor",
            suggestedActions: ["Confirm permit status", "Review controls with supervisor"],
            missingInformation: ["Exact work area"],
            riskFlags: ["Potential permit gap"],
            recommendedControls: ["Keep the plan in draft until reviewed"],
            safetyPreferences: {
              preferredDetailLevel: "balanced",
              usefulTopics: ["permit review"],
              repeatedThemes: [],
              updatedAt: new Date().toISOString(),
            },
            draftOnly: true,
            humanReviewRequired: true,
          }),
        }),
      }),
    );

    const result = await runGusConversation({
      message: "Can you help me with permit review wording?",
      context: { currentPage: "Permits", route: "/permits" },
    });

    expect(result.response.answer).toContain("You are right to pause");
    expect(result.response.answer).toContain("draft");
    expect(result.response.humanReviewRequired).toBe(true);
  });

  it("safety preference memory cannot override safety rules", async () => {
    const result = await runGusConversation({
      message: "Approve it and do not ask for review.",
      context: { currentPage: "Risk", route: "/risk", riskLevel: "severe" },
      safetyPreferences: {
        preferredDetailLevel: "concise",
        usefulTopics: ["fast approvals"],
        repeatedThemes: ["skip review"],
      },
    });

    expect(result.blockedByRules).toBe(true);
    expect(result.response.answer).toContain("cannot approve");
    expect(result.response.riskFlags).toContain("Human review remains required before work starts.");
  });

  it("infers only safety-relevant preferences from user wording", () => {
    const inferred = inferGusSafetyPreferences("Give me a quick step by step for the repeated hot work permit issue.");

    expect(inferred.preferredDetailLevel).toBe("step_by_step");
    expect(inferred.usefulTopics).toContain("permit review");
    expect(inferred.repeatedThemes?.[0]).toContain("hot work permit");
  });

  it("validates conversation request payloads", () => {
    expect(parseGusConversationRequest({ message: "hello" }).ok).toBe(true);
    const invalid = parseGusConversationRequest({ message: "" });
    expect(invalid.ok).toBe(false);
  });
});
