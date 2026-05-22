import { describe, expect, it } from "vitest";
import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";
import { evaluateGusPlanModule } from "@/lib/gus/plans/moduleEvaluator";
import { generalPreTask } from "@/lib/gus/plans/modules/generalPreTask";
import { hotWork } from "@/lib/gus/plans/modules/hotWork";
import { loto } from "@/lib/gus/plans/modules/loto";
import { trenching } from "@/lib/gus/plans/modules/trenching";
import { workAtHeight } from "@/lib/gus/plans/modules/workAtHeight";

const firstFiveModules: Array<{ module: GusPlanModule; sampleTask: string }> = [
  {
    module: generalPreTask,
    sampleTask: "Daily pre-task briefing for a crew moving materials near active equipment.",
  },
  {
    module: hotWork,
    sampleTask: "Hot work welding bracket supports near a mechanical room.",
  },
  {
    module: loto,
    sampleTask: "LOTO maintenance on a conveyor with electrical and stored mechanical energy.",
  },
  {
    module: workAtHeight,
    sampleTask: "Work at height from a lift to install overhead hangers.",
  },
  {
    module: trenching,
    sampleTask: "Trenching for underground conduit near an active driveway.",
  },
];

describe("first five Gus safety planning modules", () => {
  it.each(firstFiveModules)("outputs draft-only planning support for $module.moduleId", ({ module, sampleTask }) => {
    const evaluation = evaluateGusPlanModule(module, {
      taskDescription: sampleTask,
      answers: {
        [module.requiredQuestions[0] ?? ""]: sampleTask,
      },
    });

    console.info(
      `${module.moduleId} output: missing=${evaluation.missingInformation.length}; reviewers=${evaluation.requiredReviewRoles.join(", ")}; recommendations=${evaluation.draftOnlyRecommendations.length}`,
    );

    expect(module.triggerKeywords.length).toBeGreaterThanOrEqual(8);
    expect(module.requiredQuestions.length).toBeGreaterThanOrEqual(8);
    expect(module.hazardCategories.length).toBeGreaterThanOrEqual(7);
    expect(module.commonControls.length).toBeGreaterThanOrEqual(7);
    expect(module.possiblePermits.length).toBeGreaterThanOrEqual(1);
    expect(module.possibleTrainingRequirements.length).toBeGreaterThanOrEqual(2);
    expect(module.requiredReviewRoles.some((role) => /review required/i.test(role))).toBe(true);
    expect(module.stopWorkTriggers.length).toBeGreaterThanOrEqual(5);
    expect(module.draftPlanSections).toContain("Missing information");
    expect(module.validationRules.some((rule) => /missing information/i.test(rule.description))).toBe(true);
    expect(module.validationRules.some((rule) => /draft only/i.test(rule.description))).toBe(true);

    expect(evaluation.missingInformation.length).toBeGreaterThan(0);
    expect(evaluation.draftOnlyRecommendations.length).toBeGreaterThan(0);
    expect(evaluation.draftOnlyRecommendations.every((recommendation) => recommendation.startsWith("Draft only:"))).toBe(true);
    expect(evaluation.humanReviewRequired).toBe(true);
    expect(evaluation.officialRecordCreated).toBe(false);

    const combinedOutput = [
      ...module.commonControls,
      ...module.validationRules.map((rule) => rule.description),
      ...evaluation.draftOnlyRecommendations,
    ].join(" ");
    expect(combinedOutput).not.toMatch(/\bapproved\b|\bcompliant\b|\bsafe to start\b|\breleased for work\b/i);
  });
});

