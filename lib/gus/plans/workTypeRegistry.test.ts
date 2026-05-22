import { describe, expect, it } from "vitest";
import {
  findGusPlanModulesForText,
  getGusPlanModule,
  gusPlanModuleIds,
  gusPlanModules,
} from "@/lib/gus/plans/workTypeRegistry";

describe("Gus universal safety work type registry", () => {
  it("prints and exposes the supported planning modules", () => {
    console.info(`Supported Gus plan modules: ${gusPlanModuleIds.join(", ")}`);

    expect(gusPlanModuleIds).toEqual([
      "generalPreTask",
      "trenching",
      "hotWork",
      "electrical",
      "loto",
      "workAtHeight",
      "ladders",
      "mewp",
      "craneRigging",
      "confinedSpace",
      "heavyEquipment",
      "chemicalHazcom",
      "concrete",
      "steelErection",
      "demolition",
      "scaffold",
      "weather",
      "emergencyResponse",
      "housekeeping",
      "incidentFollowUp",
    ]);
  });

  it("keeps each module structurally useful for draft planning", () => {
    for (const planModule of gusPlanModules) {
      expect(planModule.moduleId).toBeTruthy();
      expect(planModule.displayName).toBeTruthy();
      expect(planModule.triggerKeywords.length).toBeGreaterThan(0);
      expect(planModule.requiredQuestions.length).toBeGreaterThan(0);
      expect(planModule.hazardCategories.length).toBeGreaterThan(0);
      expect(planModule.commonControls.length).toBeGreaterThan(0);
      expect(planModule.requiredReviewRoles.length).toBeGreaterThan(0);
      expect(planModule.stopWorkTriggers.length).toBeGreaterThan(0);
      expect(planModule.draftPlanSections.length).toBeGreaterThan(0);
      expect(planModule.validationRules.length).toBeGreaterThan(0);
    }
  });

  it("finds modules by id and trigger keywords", () => {
    expect(getGusPlanModule("hotWork").displayName).toBe("Hot Work");
    expect(findGusPlanModulesForText("Need a lift plan with crane rigging")[0]?.moduleId).toBe("craneRigging");
    expect(findGusPlanModulesForText("")).toHaveLength(1);
    expect(findGusPlanModulesForText("")[0]?.moduleId).toBe("generalPreTask");
  });
});
