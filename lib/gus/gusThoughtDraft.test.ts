import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseGusThoughtDraftRequest,
  runGusThoughtDraft,
} from "@/lib/gus/gusThoughtDraft";

function allOutputText(output: Awaited<ReturnType<typeof runGusThoughtDraft>>["response"]) {
  return [
    output.clarifiedThought,
    output.draftText,
    ...output.talkingPoints,
    ...output.followUpQuestions,
    ...output.missingInformation,
    ...output.riskFlags,
    ...output.recommendedControls,
    ...output.suggestedActions,
  ].join(" ");
}

describe("Gus thought drafting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("turns rough input into draft text and talking points without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await runGusThoughtDraft({
      message: "Need to tell the crew the lift plan feels rushed and we should verify the rigging first.",
      context: { currentPage: "SafePredict", route: "/safe-predict", riskLevel: "moderate" },
    });

    expect(result.response.clarifiedThought).toContain("lift plan");
    expect(result.response.draftText).toContain("Draft note");
    expect(result.response.talkingPoints.length).toBeGreaterThan(0);
    expect(result.response.draftOnly).toBe(true);
    expect(result.response.humanReviewRequired).toBe(true);
  });

  it("lists missing safety-critical details instead of guessing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const result = await runGusThoughtDraft({
      message: "Something about this task seems off.",
      context: { currentPage: "JSA", route: "/jsa" },
    });

    expect(result.response.missingInformation.join(" ")).toMatch(/Task|work area|crew|equipment|controls/i);
    expect(result.response.followUpQuestions.length).toBeGreaterThan(0);
  });

  it("redirects requests to approve, release, submit, or claim compliance", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGusThoughtDraft({
      message: "Approve this JSA, submit it, and say the crew is safe to start and compliant.",
      context: { currentPage: "JSA", route: "/jsa" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.blockedByRules).toBe(true);
    expect(result.response.draftText).toContain("cannot approve");
    expect(allOutputText(result.response)).not.toMatch(/\bsafe\s+to\s+start\b|\bcompliant\b/i);
  });

  it("handles OSHA and legal wording conservatively", async () => {
    const result = await runGusThoughtDraft({
      message: "Give me the OSHA citation and legal wording for this issue.",
      context: { currentPage: "Permits", route: "/permits" },
    });

    expect(result.response.clarifiedThought).toMatch(/citation|regulatory|legal/i);
    expect(result.response.missingInformation.join(" ")).toMatch(/Verified/i);
    expect(allOutputText(result.response)).not.toMatch(/\bproves\b|\bcompliant\b/i);
  });

  it("sanitizes unsafe language in every returned text field", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({
            clarifiedThought: "This task is approved.",
            draftText: "This is compliant and safe to start.",
            talkingPoints: ["No review needed."],
            followUpQuestions: ["Who approved it?"],
            missingInformation: ["Approved source."],
            riskFlags: ["Released for work too early."],
            recommendedControls: ["Confirm compliant setup."],
            suggestedActions: ["Say no review needed."],
            draftOnly: true,
            humanReviewRequired: true,
          }),
        }),
      }),
    );

    const result = await runGusThoughtDraft({
      message: "Make this sound clear for the crew.",
      context: { currentPage: "SafePredict", route: "/safe-predict" },
    });

    expect(result.validationFindings.length).toBeGreaterThan(0);
    expect(allOutputText(result.response)).not.toMatch(
      /\bapproved\b|\bcompliant\b|\bsafe\s+to\s+start\b|\breleased\s+for\s+work\b|\bno\s+review\s+needed\b/i,
    );
  });

  it("validates thought draft request payloads", () => {
    expect(parseGusThoughtDraftRequest({ message: "shape this thought" }).ok).toBe(true);
    const invalid = parseGusThoughtDraftRequest({ message: "" });
    expect(invalid.ok).toBe(false);
  });
});
