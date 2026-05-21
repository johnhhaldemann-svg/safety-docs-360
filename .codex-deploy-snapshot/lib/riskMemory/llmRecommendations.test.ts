import { afterEach, describe, expect, it, vi } from "vitest";

const serverLog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/serverLog", () => ({
  serverLog,
}));

import { buildLlmRiskRecommendations, parseRecommendationDraftsFromModelText } from "@/lib/riskMemory/llmRecommendations";

describe("parseRecommendationDraftsFromModelText", () => {
  it("parses a JSON array into recommendation drafts", () => {
    const drafts = parseRecommendationDraftsFromModelText(
      JSON.stringify([
        { kind: "priority_focus", title: "Tighten permit review", body: "Review active permits this week.", confidence: 0.9 },
      ])
    );

    expect(drafts).toEqual([
      {
        kind: "priority_focus",
        title: "Tighten permit review",
        body: "Review active permits this week.",
        confidence: 0.9,
      },
    ]);
  });
});

describe("buildLlmRiskRecommendations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the shared response helper flow and returns metadata", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          output_text: JSON.stringify([
            {
              kind: "llm_insight",
              title: "Verify top hazards",
              body: "Cross-check the recurring hazard families before the next shift.",
              confidence: 0.72,
            },
          ]),
        }),
      })
    );

    const result = await buildLlmRiskRecommendations({
      facetCount: 3,
      windowDays: 90,
      aggregatedWithBaseline: { band: "Moderate", score: 52 },
      topScopes: [],
      topHazards: [],
      topLocationGrids: [],
      topLocationAreas: [],
      openCorrectiveFacetHints: { openStyleStatuses: [] },
      baselineHints: [],
      derivedRollupConfidence: "medium",
    } as never);

    expect(result.drafts).toHaveLength(1);
    expect(result.meta?.model).toBe("gpt-4o-mini");
    expect(result.meta?.fallbackUsed).toBe(false);
  });
});
