import { describe, expect, it } from "vitest";
import { parseRecommendationDraftsFromModelText } from "./llmRecommendations";

describe("parseRecommendationDraftsFromModelText", () => {
  it("parses a bare JSON array", () => {
    const raw = `[{"kind":"test","title":"T1","body":"B1","confidence":0.7}]`;
    const out = parseRecommendationDraftsFromModelText(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.title).toBe("T1");
    expect(out[0]?.confidence).toBe(0.7);
  });

  it("strips markdown fences", () => {
    const raw = "```json\n[{\"kind\":\"x\",\"title\":\"Hi\",\"body\":\"There.\",\"confidence\":0.5}]\n```";
    const out = parseRecommendationDraftsFromModelText(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("x");
  });

  it("drops invalid rows and clamps confidence", () => {
    const raw = `[{"title":"","body":"x"},{"title":"Ok","body":"Body","confidence":99}]`;
    const out = parseRecommendationDraftsFromModelText(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.confidence).toBe(1);
  });
});
