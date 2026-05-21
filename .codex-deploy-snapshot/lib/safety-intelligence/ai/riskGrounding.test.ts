import { describe, expect, it } from "vitest";
import { mergeRiskOutputWithRiskMemory, preventionScoreFromRollup } from "@/lib/safety-intelligence/ai/riskGrounding";
import type { JsonObject, RiskOutputRecord } from "@/types/safety-intelligence";

describe("riskGrounding", () => {
  it("preventionScoreFromRollup maps 0–24 score to 0–100", () => {
    const p = preventionScoreFromRollup(12, "moderate", 0.7);
    expect(p.scale).toBe("0-100");
    expect(p.value).toBe(50);
    expect(p.band).toBe("moderate");
    expect(p.confidence).toBe(0.7);
  });

  it("mergeRiskOutputWithRiskMemory prepends canonical rollup when memory JSON present", () => {
    const base: RiskOutputRecord = {
      summary: "x",
      exposures: [],
      missingControls: [],
      trendPatterns: [],
      riskScores: [{ scope: "task", score: 5, band: "low" }],
      forecastConflicts: [],
      correctiveActions: [],
    };
    const merged = mergeRiskOutputWithRiskMemory(base, {
      aggregatedWithBaseline: { score: 18, band: "high" },
      derivedRollupConfidence: 0.55,
    } as JsonObject);
    expect(merged.riskScores[0]?.scope).toBe("risk_memory_rollup");
    expect(merged.riskScores[0]?.band).toBe("high");
    expect(merged.canonicalRiskFromMemory?.score).toBe(18);
    expect(merged.preventionScore?.value).toBe(75);
  });

  it("mergeRiskOutputWithRiskMemory leaves record unchanged without rollup", () => {
    const base: RiskOutputRecord = {
      summary: "x",
      exposures: [],
      missingControls: [],
      trendPatterns: [],
      riskScores: [{ scope: "task", score: 5, band: "low" }],
      forecastConflicts: [],
      correctiveActions: [],
    };
    const merged = mergeRiskOutputWithRiskMemory(base, null);
    expect(merged.riskScores).toEqual(base.riskScores);
    expect(merged.canonicalRiskFromMemory).toBeUndefined();
  });
});
