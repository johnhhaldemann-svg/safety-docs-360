import { describe, expect, it } from "vitest";
import { buildSafetyReviewRow } from "@/lib/safety-intelligence/review";
import { buildLiveSafetyReviewRows } from "@/lib/safety-intelligence/review";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
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

describe("buildLiveSafetyReviewRows", () => {
  it("drops corrupt or mismatched persisted bucket peers before review", () => {
    const bucket = buildBucketedWorkItem({
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      sourceModule: "manual",
      sourceId: "valid-row",
      taskTitle: "Welding",
      hazardFamilies: ["hot_work"],
      permitTriggers: ["hot_work_permit"],
    });
    const rules = evaluateRules(buildRawInput({ taskTitle: "Welding", hazardFamilies: ["hot_work"] }), bucket);
    const otherBucket = buildBucketedWorkItem({
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      sourceModule: "manual",
      sourceId: "other-row",
      taskTitle: "Crane lift",
    });
    const otherRules = evaluateRules(buildRawInput({ taskTitle: "Crane lift" }), otherBucket);

    const rows = buildLiveSafetyReviewRows({
      bucketItems: [
        {
          id: "valid-row",
          jobsite_id: "jobsite-1",
          bucket_key: bucket.bucketKey,
          source_module: "manual",
          source_id: "valid-row",
          bucket_payload: bucket,
          rule_results: rules,
        },
        {
          id: "missing-title",
          jobsite_id: "jobsite-1",
          bucket_key: "bad",
          source_module: "manual",
          source_id: "bad",
          bucket_payload: {
            bucketKey: "bad",
            bucketType: "task_execution",
            companyId: "company-1",
            source: { module: "manual", id: "bad" },
          } as any,
          rule_results: rules,
        },
        {
          id: "mismatch",
          jobsite_id: "jobsite-1",
          bucket_key: bucket.bucketKey,
          source_module: "manual",
          source_id: "mismatch",
          bucket_payload: bucket,
          rule_results: otherRules,
        },
      ],
      trainingMatrixRequirements: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("live:valid-row");
    expect(rows[0]?.permitTriggers).toContain("hot_work_permit");
  });
});
