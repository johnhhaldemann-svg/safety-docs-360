import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGusPhotoReview, runGusPhotoReview } from "@/lib/gus/gusPhotoReview";

describe("Gus photo review", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null for unreadable JSON", () => {
    expect(parseGusPhotoReview("not json")).toBeNull();
  });

  it("normalizes and enforces draft-only photo review output", () => {
    const parsed = parseGusPhotoReview(
      JSON.stringify({
        answer: "This looks approved and safe to start.",
        riskLevel: "critical",
        whatLooksRight: ["Guardrails appear visible"],
        concerns: ["Worker appears near an unprotected edge"],
        criticalFlags: ["Fall exposure needs immediate review"],
        missingInformation: ["Tie-off status"],
        recommendedControls: ["Verify fall protection controls"],
        nextActions: [],
        limitations: ["Photo cannot prove compliance"],
        confidence: 2,
        draftOnly: false,
        humanReviewRequired: false,
      }),
    );

    expect(parsed?.riskLevel).toBe("critical");
    expect(parsed?.draftOnly).toBe(true);
    expect(parsed?.humanReviewRequired).toBe(true);
    expect(parsed?.confidence).toBe(1);
    expect(parsed?.answer).not.toMatch(/approved|safe to start/i);
    expect(parsed?.nextActions.join(" ")).toMatch(/immediate human safety check/i);
  });

  it("sends jobsite photos to the Responses API as input_image with high detail", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        output_text: JSON.stringify({
          answer: "I see a serious fall exposure. Treat this as draft guidance and get human review now.",
          riskLevel: "critical",
          whatLooksRight: ["Hard hats appear to be in use"],
          concerns: ["Open edge exposure"],
          criticalFlags: ["Possible fall exposure without verified tie-off"],
          missingInformation: ["Guardrail continuity", "Tie-off verification"],
          recommendedControls: ["Verify guardrails or tie-off", "Confirm rescue plan"],
          nextActions: ["Pause and get a competent-person review"],
          limitations: ["Only visible conditions were reviewed"],
          confidence: 0.82,
          draftOnly: true,
          humanReviewRequired: true,
        }),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGusPhotoReview({
      dataUrl: "data:image/png;base64,abc123",
      fileName: "deck-edge.png",
      message: "Review this deck edge.",
      context: { currentPage: "SafePredict", route: "/safe-predict" },
    });

    expect(result.output?.riskLevel).toBe("critical");
    expect(result.output?.criticalFlags.join(" ")).toMatch(/fall exposure/i);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      model: string;
      input: Array<{ content: Array<Record<string, unknown>> }>;
      text: { format: { name: string; strict: boolean } };
    };
    const imagePart = body.input[0]?.content.find((part) => part.type === "input_image");

    expect(body.model).toBe("gpt-4o-mini");
    expect(body.text.format.name).toBe("gus_photo_review");
    expect(body.text.format.strict).toBe(true);
    expect(imagePart).toMatchObject({
      type: "input_image",
      image_url: "data:image/png;base64,abc123",
      detail: "high",
    });
  });
});
