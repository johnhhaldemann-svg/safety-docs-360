import { afterEach, describe, expect, it, vi } from "vitest";
import { runGusAiExplanation } from "@/lib/gus/gusAi";
import {
  buildGusAiUserPrompt,
  GUS_AI_RESPONSE_FORMAT,
  GUS_AI_SYSTEM_PROMPT,
} from "@/lib/gus/gusPromptBuilder";

describe("Gus AI prompt builder", () => {
  it("builds a bounded JSON prompt with draft-only guardrails", () => {
    const prompt = buildGusAiUserPrompt({
      task: "explain_safety_concern",
      userRequest: "Explain the hot work concern.",
      route: "/permits",
      verifiedPlatformRules: ["Company hot work program requires review before ignition sources are used."],
    });

    const parsed = JSON.parse(prompt) as {
      outputContract: { draftOnly: boolean; humanReviewRequired: boolean };
      guardrails: string[];
    };

    expect(GUS_AI_SYSTEM_PROMPT).toContain("You do not approve work.");
    expect(GUS_AI_RESPONSE_FORMAT.type).toBe("json_schema");
    expect(parsed.outputContract.draftOnly).toBe(true);
    expect(parsed.outputContract.humanReviewRequired).toBe(true);
    expect(parsed.guardrails.join(" ")).toContain("Do not approve");
  });
});

describe("runGusAiExplanation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("refuses unsafe prompts asking Gus to approve work", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGusAiExplanation({
      task: "draft_recommendations",
      userRequest: "Approve this trench plan and say it is safe to start.",
      route: "/jobsites/example",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.blockedByRules).toBe(true);
    expect(result.meta).toBeNull();
    expect(result.output.answer).toContain("I cannot approve work");
    expect(result.output.answer).toContain("safety lead check");
    expect(result.output.draftOnly).toBe(true);
    expect(result.output.humanReviewRequired).toBe(true);
    expect(result.output.riskFlags).toContain("Safety lead check remains needed before work starts.");
  });

  it("passes model output through Gus safety validation before returning it", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        output_text: JSON.stringify({
          answer: "This plan is approved, compliant, safe to start, and no review needed.",
          missingInformation: [],
          riskFlags: ["Released for work by Gus."],
          recommendedControls: ["Proceed with the task."],
          draftOnly: false,
          humanReviewRequired: false,
        }),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGusAiExplanation({
      task: "explain_safety_concern",
      userRequest: "Explain the safety concern for hot work near stored material.",
      route: "/permits",
    });

    const combinedOutput = [
      result.output.answer,
      ...result.output.riskFlags,
      ...result.output.recommendedControls,
    ].join(" ");

    expect(result.blockedByRules).toBe(false);
    expect(result.output.draftOnly).toBe(true);
    expect(result.output.humanReviewRequired).toBe(true);
    expect(combinedOutput).not.toMatch(/\bapproved\b/i);
    expect(combinedOutput).not.toMatch(/\bcompliant\b/i);
    expect(combinedOutput).not.toMatch(/\bsafe\s+to\s+start\b/i);
    expect(combinedOutput).not.toMatch(/\bno\s+review\s+needed\b/i);
    expect(combinedOutput).not.toMatch(/\breleased\s+for\s+work\b/i);
    expect(result.validationFindings.map((finding) => finding.code)).toContain("unsafe_language");
  });

  it("requests structured JSON from the shared Responses API helper", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        output_text: JSON.stringify({
          answer: "Draft controls should focus on isolating the area and verifying fire prevention measures.",
          missingInformation: ["Exact work area"],
          riskFlags: ["Ignition source near stored material"],
          recommendedControls: ["Supervisor review before work starts"],
          draftOnly: true,
          humanReviewRequired: true,
        }),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await runGusAiExplanation({
      task: "draft_recommendations",
      userRequest: "Draft hot work recommendations.",
      route: "/permits",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      input: string;
      text: { format: { type: string; name: string; strict: boolean } };
      max_output_tokens: number;
    };

    expect(body.input).toContain(GUS_AI_SYSTEM_PROMPT);
    expect(body.input).toContain("Field Coach");
    expect(body.input).toContain("safety lead check");
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.name).toBe("gus_ai_explanation");
    expect(body.text.format.strict).toBe(true);
    expect(body.max_output_tokens).toBe(900);
  });
});
