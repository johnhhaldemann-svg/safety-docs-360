import { describe, expect, it } from "vitest";
import { buildPreventionLogicResult } from "@/lib/safety-intelligence/engine/preventionLogic";
import { detectConflicts } from "@/lib/safety-intelligence/conflicts";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import type { RawTaskInput } from "@/types/safety-intelligence";

describe("buildPreventionLogicResult", () => {
  it("includes repeat patterns from risk memory summary", () => {
    const input: RawTaskInput = {
      companyId: "c1",
      jobsiteId: null,
      sourceModule: "manual",
      taskTitle: "Welding",
      hazardFamilies: ["fire"],
      requiredControls: ["fire_watch"],
      permitTriggers: ["hot_work_permit"],
      trainingRequirementCodes: ["welding_safety"],
    };
    const bucket = buildBucketedWorkItem(input);
    const rules = evaluateRules(input, bucket);
    const conflicts = detectConflicts(bucket, rules, [bucket], [rules]);
    const p = buildPreventionLogicResult({
      input,
      bucket,
      rules,
      conflicts,
      riskMemorySummary: {
        topScopes: [{ code: "steel", count: 4 }],
        topHazards: [{ code: "fire", count: 2 }],
      },
    });
    expect(p.repeatRiskPatterns.some((x) => x.includes("steel"))).toBe(true);
    expect(p.permitRecommendations.length).toBeGreaterThan(0);
  });
});
