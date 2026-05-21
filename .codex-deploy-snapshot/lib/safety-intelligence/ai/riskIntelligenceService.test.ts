import { afterEach, describe, expect, it, vi } from "vitest";
import { generateRiskIntelligence } from "@/lib/safety-intelligence/ai/riskIntelligenceService";
import type { AiReviewContext } from "@/types/safety-intelligence";

const { runStructuredAiJsonMock } = vi.hoisted(() => ({
  runStructuredAiJsonMock: vi.fn(),
}));

vi.mock("@/lib/safety-intelligence/ai/utils", () => ({
  runStructuredAiJson: runStructuredAiJsonMock,
}));

function buildReviewContext(): AiReviewContext {
  return {
    companyId: "company-1",
    buckets: [
      {
        bucketKey: "manual:welding",
        bucketType: "task_execution",
        companyId: "company-1",
        taskTitle: "Welding",
        equipmentUsed: [],
        workConditions: [],
        siteRestrictions: [],
        prohibitedEquipment: [],
        hazardFamilies: ["hot_work"],
        permitTriggers: ["hot_work_permit"],
        requiredControls: ["fire_watch"],
        ppeRequirements: ["gloves"],
        trainingRequirementCodes: ["hot_work_training"],
        payload: {},
        source: { module: "manual", id: null },
      },
    ],
    rulesEvaluations: [
      {
        bucketKey: "manual:welding",
        findings: [],
        permitTriggers: ["hot_work_permit"],
        hazardFamilies: ["hot_work"],
        hazardCategories: ["Hot work"],
        ppeRequirements: ["gloves"],
        equipmentChecks: [],
        weatherRestrictions: [],
        requiredControls: ["fire_watch"],
        siteRestrictions: [],
        prohibitedEquipment: [],
        trainingRequirements: ["hot_work_training"],
        score: 16,
        band: "high",
        evaluationVersion: "test",
      },
    ],
    conflictEvaluations: [
      {
        bucketKey: "manual:welding",
        conflicts: [],
        score: 0,
        band: "low",
      },
    ],
  };
}

describe("generateRiskIntelligence", () => {
  afterEach(() => {
    runStructuredAiJsonMock.mockReset();
  });

  it("keeps deterministic fallback fields when valid AI JSON omits required fields", async () => {
    runStructuredAiJsonMock.mockResolvedValue({
      parsed: { summary: "AI summary only" },
      model: "test-model",
      promptHash: "prompt-hash",
      fallbackUsed: false,
    });

    const result = await generateRiskIntelligence({ reviewContext: buildReviewContext() });

    expect(result.record.summary).toBe("AI summary only");
    expect(result.record.exposures).toEqual(["hot_work"]);
    expect(result.record.missingControls).toEqual(["fire_watch"]);
    expect(result.record.riskScores).toEqual([
      { scope: "manual:welding", score: 16, band: "high" },
    ]);
    expect(result.model).toBe("test-model");
    expect(result.promptHash).toBe("prompt-hash");
  });
});
