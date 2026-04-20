import { describe, expect, it } from "vitest";
import { buildSafetyReviewRow } from "@/lib/safety-intelligence/review";
import type { RawTaskInput, RulesEvaluation } from "@/types/safety-intelligence";

function buildRulesEvaluation(partial: Partial<RulesEvaluation> = {}): RulesEvaluation {
  return {
    bucketKey: "bucket-1",
    findings: [],
    permitTriggers: [],
    hazardFamilies: ["electrical"],
    hazardCategories: ["Electrical"],
    ppeRequirements: [],
    equipmentChecks: [],
    weatherRestrictions: [],
    requiredControls: ["loto"],
    siteRestrictions: [],
    prohibitedEquipment: [],
    trainingRequirements: [],
    score: 12,
    band: "moderate",
    evaluationVersion: "test",
    sourceBreakdown: [{ sourceType: "platform", sourceId: null, ruleCodes: ["platform-rule"] }],
    ...partial,
  };
}

function buildRawInput(partial: Partial<RawTaskInput> = {}): RawTaskInput {
  return {
    companyId: "company-1",
    sourceModule: "manual",
    taskTitle: "Energized switchgear work",
    tradeCode: "electrical",
    taskCode: "switchgear_work",
    hazardFamilies: ["electrical"],
    requiredControls: ["loto"],
    ...partial,
  };
}

describe("buildSafetyReviewRow", () => {
  it("keeps complete platform coverage without gaps", () => {
    const rawInput = buildRawInput();
    const baselineRules = buildRulesEvaluation({
      permitTriggers: ["energized_electrical_permit"],
      trainingRequirements: ["qualified_electrical_worker"],
      ppeRequirements: ["arc_flash_ppe"],
    });
    const mergedRules = buildRulesEvaluation({
      permitTriggers: ["energized_electrical_permit"],
      trainingRequirements: ["qualified_electrical_worker"],
      ppeRequirements: ["arc_flash_ppe"],
    });

    const row = buildSafetyReviewRow({
      id: "row-1",
      source: "platform",
      scope: "company",
      sourceLabel: "Platform template",
      rawInput,
      baselineRules,
      mergedRules,
    });

    expect(row.gaps).toEqual([]);
  });

  it("flags a single missing training domain", () => {
    const rawInput = buildRawInput();
    const baselineRules = buildRulesEvaluation({
      permitTriggers: ["energized_electrical_permit"],
      trainingRequirements: ["qualified_electrical_worker"],
      ppeRequirements: ["arc_flash_ppe"],
    });
    const mergedRules = buildRulesEvaluation({
      permitTriggers: ["energized_electrical_permit"],
      trainingRequirements: [],
      ppeRequirements: ["arc_flash_ppe"],
    });

    const row = buildSafetyReviewRow({
      id: "row-2",
      source: "platform",
      scope: "company",
      sourceLabel: "Platform template",
      rawInput,
      baselineRules,
      mergedRules,
    });

    expect(row.gaps.map((gap) => gap.code)).toEqual(["training_missing"]);
  });

  it("flags all three domains when coverage disappears", () => {
    const rawInput = buildRawInput();
    const baselineRules = buildRulesEvaluation({
      permitTriggers: ["energized_electrical_permit"],
      trainingRequirements: ["qualified_electrical_worker"],
      ppeRequirements: ["arc_flash_ppe"],
    });
    const mergedRules = buildRulesEvaluation({
      permitTriggers: [],
      trainingRequirements: [],
      ppeRequirements: [],
    });

    const row = buildSafetyReviewRow({
      id: "row-3",
      source: "platform",
      scope: "company",
      sourceLabel: "Platform template",
      rawInput,
      baselineRules,
      mergedRules,
    });

    expect(row.gaps.map((gap) => gap.code)).toEqual([
      "permit_missing",
      "training_missing",
      "ppe_missing",
    ]);
  });

  it("accepts company overrides that replace baseline values", () => {
    const rawInput = buildRawInput();
    const baselineRules = buildRulesEvaluation({
      permitTriggers: ["energized_electrical_permit"],
      trainingRequirements: ["qualified_electrical_worker"],
      ppeRequirements: ["arc_flash_ppe"],
    });
    const mergedRules = buildRulesEvaluation({
      permitTriggers: ["electrical_override_permit" as any],
      trainingRequirements: ["company_switchgear_training"],
      ppeRequirements: ["company_arc_flash_kit"],
      sourceBreakdown: [
        { sourceType: "platform", sourceId: null, ruleCodes: ["platform-rule"] },
        { sourceType: "company", sourceId: "company-1", ruleCodes: ["company-rule"] },
      ],
    });

    const row = buildSafetyReviewRow({
      id: "row-4",
      source: "company",
      scope: "company",
      sourceLabel: "Company task",
      rawInput,
      baselineRules,
      mergedRules,
    });

    expect(row.gaps).toEqual([]);
  });

  it("flags removed-by-override gaps when company rules wipe coverage", () => {
    const rawInput = buildRawInput();
    const baselineRules = buildRulesEvaluation({
      permitTriggers: ["energized_electrical_permit"],
      trainingRequirements: ["qualified_electrical_worker"],
      ppeRequirements: ["arc_flash_ppe"],
    });
    const mergedRules = buildRulesEvaluation({
      permitTriggers: [],
      trainingRequirements: [],
      ppeRequirements: [],
      sourceBreakdown: [{ sourceType: "company", sourceId: "company-1", ruleCodes: ["company-rule"] }],
    });

    const row = buildSafetyReviewRow({
      id: "row-5",
      source: "company",
      scope: "company",
      sourceLabel: "Company task",
      rawInput,
      baselineRules,
      mergedRules,
    });

    expect(row.gaps.map((gap) => gap.code)).toEqual([
      "permit_removed_by_override",
      "training_removed_by_override",
      "ppe_removed_by_override",
    ]);
  });
});
