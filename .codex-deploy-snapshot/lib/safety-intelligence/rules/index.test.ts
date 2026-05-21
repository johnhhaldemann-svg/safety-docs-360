import { describe, expect, it } from "vitest";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
import type { RuleTemplateRecord } from "@/types/safety-intelligence";

describe("evaluateRules", () => {
  it("triggers hot work permit, controls, and training for welding", () => {
    const input = {
      companyId: "company-1",
      sourceModule: "manual" as const,
      taskTitle: "Welding and hot work on structural steel",
      description: "Active work near paint operations",
      tradeCode: "welding",
      hazardFamilies: [],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    };

    const bucket = buildBucketedWorkItem(input);
    const result = evaluateRules(input, bucket);

    expect(result.permitTriggers).toContain("hot_work_permit");
    expect(result.requiredControls).toContain("fire_watch");
    expect(result.trainingRequirements).toContain("hot_work_training");
    expect(result.hazardFamilies).toContain("hot_work");
    expect(result.band === "moderate" || result.band === "high" || result.band === "critical").toBe(true);
  });

  it("adds excavation weather restrictions", () => {
    const input = {
      companyId: "company-1",
      sourceModule: "manual" as const,
      taskTitle: "Excavation trenching",
      description: "Storm risk and wet conditions",
      tradeCode: "excavation",
      weatherConditionCode: "storm",
      hazardFamilies: [],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    };

    const bucket = buildBucketedWorkItem(input);
    const result = evaluateRules(input, bucket);

    expect(result.permitTriggers).toContain("excavation_permit");
    expect(result.weatherRestrictions).toContain("stop_for_heavy_rain");
    expect(result.findings.some((finding) => finding.code === "storm_pause")).toBe(true);
  });

  it("does not add utility-locate controls for non-utility heavy equipment scope", () => {
    const input = {
      companyId: "company-1",
      sourceModule: "manual" as const,
      taskTitle: "Grading and material movement",
      description: "Heavy equipment work in an open site area",
      tradeCode: "equipment_operations",
      hazardFamilies: [],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    };

    const bucket = buildBucketedWorkItem(input);
    const result = evaluateRules(input, bucket);

    expect(result.requiredControls).not.toContain("locate_utilities");
    expect(result.hazardFamilies).not.toContain("utility_strike");
  });

  it("resolves platform, company, and jobsite rule precedence with restrictions", () => {
    const templates: RuleTemplateRecord[] = [
      {
        code: "platform_hot_work",
        label: "Platform hot work",
        sourceType: "platform",
        precedence: 100,
        version: "v1",
        mergeBehavior: "extend",
        selectors: { taskKeywords: ["weld"] },
        outputs: {
          permitTriggers: ["hot_work_permit"],
          requiredControls: ["fire_watch"],
        },
      },
      {
        code: "company_hot_work_restrictions",
        label: "Company hot work restrictions",
        sourceType: "company",
        sourceId: "company-1",
        precedence: 200,
        version: "v1",
        mergeBehavior: "extend",
        selectors: { taskKeywords: ["weld"] },
        outputs: {
          siteRestrictions: ["No A-frame ladders."],
          requiredControls: ["sparks_contained"],
        },
      },
      {
        code: "jobsite_ladder_ban",
        label: "Jobsite ladder ban",
        sourceType: "jobsite",
        sourceId: "jobsite-1",
        precedence: 300,
        version: "v1",
        mergeBehavior: "extend",
        selectors: { taskKeywords: ["weld"] },
        outputs: {
          prohibitedEquipment: ["a_frame_ladder"],
        },
      },
    ];
    const input = {
      companyId: "company-1",
      jobsiteId: "jobsite-1",
      sourceModule: "manual" as const,
      taskTitle: "Weld support steel",
      description: "Interior fit-out",
      tradeCode: "steel",
      hazardFamilies: [],
      permitTriggers: [],
      requiredControls: [],
      trainingRequirementCodes: [],
    };

    const bucket = buildBucketedWorkItem(input);
    const result = evaluateRules(input, bucket, templates);

    expect(result.permitTriggers).toContain("hot_work_permit");
    expect(result.requiredControls).toContain("fire_watch");
    expect(result.siteRestrictions).toContain("No A-frame ladders.");
    expect(result.prohibitedEquipment).toContain("a_frame_ladder");
    expect(result.sourceBreakdown?.map((row) => row.sourceType)).toEqual(
      expect.arrayContaining(["platform", "company", "jobsite"])
    );
  });
});
