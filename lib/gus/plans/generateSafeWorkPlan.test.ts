import { describe, expect, it } from "vitest";
import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";
import {
  generateSafeWorkPlan,
  GUS_SAFE_WORK_PLAN_SECTION_TITLES,
  type GusSafeWorkPlanInput,
} from "@/lib/gus/plans/generateSafeWorkPlan";
import { hotWork } from "@/lib/gus/plans/modules/hotWork";
import { trenching } from "@/lib/gus/plans/modules/trenching";
import { workAtHeight } from "@/lib/gus/plans/modules/workAtHeight";

const allowedStatuses = new Set([
  "draft_incomplete",
  "draft_ready_for_review",
  "needs_supervisor_review",
  "needs_competent_person_review",
  "needs_qualified_person_review",
  "blocked_missing_critical_info",
]);

function answersFor(module: GusPlanModule, answer: string) {
  return Object.fromEntries(module.requiredQuestions.map((question) => [question, answer]));
}

function expectDraftOnlyPlan(input: GusSafeWorkPlanInput) {
  const result = generateSafeWorkPlan(input);
  const sectionTitles = result.plan.sections.map((section) => section.title);
  const serialized = JSON.stringify(result.plan);

  expect(allowedStatuses.has(result.plan.status)).toBe(true);
  expect(result.plan.draftOnly).toBe(true);
  expect(result.plan.humanReviewRequired).toBe(true);
  expect(result.plan.officialRecordCreated).toBe(false);
  expect(sectionTitles).toEqual([...GUS_SAFE_WORK_PLAN_SECTION_TITLES]);
  expect(serialized).not.toMatch(/\bapproved\b|\bcompliant\b|\bsafe_to_start\b|\bsafe to start\b|\breleased_for_work\b|\breleased for work\b/i);

  return result.plan;
}

describe("generateSafeWorkPlan", () => {
  it("generates a draft hot work plan", () => {
    const plan = expectDraftOnlyPlan({
      taskDescription: "Hot work grinding steel brackets near stored materials",
      workArea: "Mechanical room west wall",
      crewTrades: "Pipefitter and welder",
      equipmentToolsMaterials: "Grinder, welding screen, extinguisher, steel brackets",
      selectedModuleIds: ["hotWork"],
      answers: answersFor(hotWork, "Reviewed for draft planning; supervisor review required."),
    });

    expect(plan.detectedWorkTypes.map((match) => match.id)).toContain("hotWork");
    expect(plan.sections.find((section) => section.title === "Required Permits / Reviews")?.items.join(" ")).toMatch(/Hot work/i);
    expect(plan.sections.find((section) => section.title === "PPE")?.items.length).toBeGreaterThan(0);
  });

  it("generates a draft work-at-height plan", () => {
    const plan = expectDraftOnlyPlan({
      taskDescription: "Using a lift to install ductwork overhead",
      workArea: "Level 2 corridor",
      crewTrades: "Sheet metal crew",
      equipmentToolsMaterials: "MEWP, duct sections, hand tools, anchor points where applicable",
      selectedModuleIds: ["workAtHeight", "mewp"],
      answers: answersFor(workAtHeight, "Reviewed for draft planning; competent person review required."),
    });

    expect(plan.detectedWorkTypes.map((match) => match.id)).toContain("workAtHeight");
    expect(plan.sections.find((section) => section.title === "Stop-Work Triggers")?.items.join(" ")).toMatch(/Fall|Weather|Rescue/i);
  });

  it("generates a draft trench plan", () => {
    const plan = expectDraftOnlyPlan({
      taskDescription: "Trenching for underground conduit near an active driveway",
      workArea: "North entrance drive",
      crewTrades: "Civil crew and spotter",
      equipmentToolsMaterials: "Mini excavator, trench box if required by review, conduit, barricades",
      selectedModuleIds: ["trenching"],
      answers: answersFor(trenching, "Reviewed for draft planning; competent person review required."),
    });

    expect(plan.detectedWorkTypes.map((match) => match.id)).toContain("trenching");
    expect(plan.sections.find((section) => section.title === "Human Review Required")?.items.join(" ")).toMatch(/Competent person/i);
  });
});

