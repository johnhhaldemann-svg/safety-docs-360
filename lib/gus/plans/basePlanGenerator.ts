import type {
  GusDraftSafeWorkPlan,
  GusPlanningSessionInput,
} from "@/lib/gus/plans/basePlanningTypes";
import {
  buildPlanControls,
  buildPlanHazards,
  buildRequiredReviewers,
  findMissingPlanningInformation,
} from "@/lib/gus/plans/baseSafetyRules";
import { getGusWorkType } from "@/lib/gus/plans/workTypeRegistry";

function answerFor(input: GusPlanningSessionInput, id: string) {
  return input.questionAnswers[id]?.trim() ?? "";
}

function splitAnswer(value: string) {
  return value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function generateBaseSafeWorkPlan(input: GusPlanningSessionInput): GusDraftSafeWorkPlan {
  const workType = getGusWorkType(input.workTypeId);
  const missingInformation = findMissingPlanningInformation(input);
  const location = input.jobsiteName?.trim() || answerFor(input, "work_location") || "Location needs review";
  const taskSummary = input.taskDescription.trim() || answerFor(input, "work_performed") || "Task needs review";

  return {
    planId: `gus-plan-${Date.now()}`,
    status: missingInformation.length > 0 ? "draft_incomplete" : "draft_ready_for_review",
    title: `${workType.label}: ${taskSummary}`,
    summary: taskSummary,
    workType,
    location,
    crewTrade: input.crewTrade.trim() || answerFor(input, "crew") || "Crew or trade needs review",
    equipmentToolsMaterials:
      input.equipmentToolsMaterials.trim() ||
      answerFor(input, "equipment_energy_sources") ||
      "Equipment, tools, materials, chemicals, or energy sources need review",
    hazards: buildPlanHazards(input, workType),
    controls: buildPlanControls(input, workType),
    possiblePermits: Array.from(new Set([...workType.possiblePermits, ...splitAnswer(answerFor(input, "permits"))])),
    possibleTraining: Array.from(new Set([...workType.possibleTraining, ...splitAnswer(answerFor(input, "training"))])),
    preStartInspections: Array.from(new Set([...workType.preStartInspections, ...splitAnswer(answerFor(input, "inspections"))])),
    environmentalConditions: splitAnswer(answerFor(input, "site_conditions")),
    stopWorkTriggers: splitAnswer(answerFor(input, "stop_work")),
    emergencyResponseConsiderations: splitAnswer(answerFor(input, "emergency_response")),
    missingInformation,
    requiredReviewers: buildRequiredReviewers(input, workType),
    requestedDraftDocuments: input.requestedDraftDocuments,
    humanReviewRequired: true,
    officialRecordCreated: false,
  };
}

