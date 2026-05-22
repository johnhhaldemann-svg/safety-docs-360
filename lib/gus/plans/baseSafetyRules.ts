import { basePlanningQuestions } from "@/lib/gus/plans/basePlanningQuestions";
import type {
  GusChecklistItem,
  GusPlanningSessionInput,
  GusWorkType,
} from "@/lib/gus/plans/basePlanningTypes";

export const universalHazardChecklist: GusChecklistItem[] = [
  { id: "line_of_fire", label: "Line of fire" },
  { id: "falls", label: "Falls or work at heights" },
  { id: "mobile_equipment", label: "Mobile equipment or traffic" },
  { id: "stored_energy", label: "Stored energy or unexpected startup" },
  { id: "hazardous_atmosphere", label: "Atmospheric hazard" },
  { id: "chemical_exposure", label: "Chemical exposure" },
  { id: "fire_explosion", label: "Fire or explosion potential" },
  { id: "weather", label: "Weather or environmental condition" },
  { id: "housekeeping", label: "Housekeeping or access issue" },
  { id: "public_interface", label: "Public, pedestrian, or customer interface" },
];

export const universalControlChecklist: GusChecklistItem[] = [
  { id: "eliminate_substitute", label: "Eliminate or substitute hazard where practical" },
  { id: "engineering_controls", label: "Engineering controls or physical protection" },
  { id: "isolation", label: "Isolation, barricades, or exclusion zone" },
  { id: "energy_control", label: "Energy isolation or lockout/tagout" },
  { id: "permit_review", label: "Permit review when indicated" },
  { id: "inspection", label: "Pre-use or pre-start inspection" },
  { id: "training_check", label: "Training or qualification check" },
  { id: "ppe", label: "PPE matched to task and exposure" },
  { id: "communication", label: "Communication plan and assigned roles" },
  { id: "emergency_response", label: "Emergency response and rescue considerations" },
];

function answerFor(input: GusPlanningSessionInput, id: string) {
  return input.questionAnswers[id]?.trim() ?? "";
}

export function findMissingPlanningInformation(input: GusPlanningSessionInput) {
  const missing: string[] = [];

  if (!input.taskDescription.trim()) missing.push("Task description");
  if (!input.jobsiteName?.trim() && !answerFor(input, "work_location")) missing.push("Work location");
  if (!input.crewTrade.trim() && !answerFor(input, "crew")) missing.push("Crew or trade");
  if (!input.equipmentToolsMaterials.trim() && !answerFor(input, "equipment_energy_sources")) {
    missing.push("Equipment, tools, materials, chemicals, or energy sources");
  }
  if (input.selectedHazards.length === 0 && !answerFor(input, "hazards")) missing.push("Hazards");
  if (input.selectedControls.length === 0 && !answerFor(input, "controls")) missing.push("Controls");

  for (const question of basePlanningQuestions) {
    if (question.required && !answerFor(input, question.id)) {
      missing.push(question.prompt.replace(/\?$/, ""));
    }
  }

  return Array.from(new Set(missing));
}

export function buildPlanHazards(input: GusPlanningSessionInput, workType: GusWorkType) {
  return Array.from(new Set([...input.selectedHazards, ...workType.commonHazards, answerFor(input, "hazards")].filter(Boolean)));
}

export function buildPlanControls(input: GusPlanningSessionInput, workType: GusWorkType) {
  return Array.from(
    new Set([...input.selectedControls, ...workType.suggestedControls, answerFor(input, "controls")].filter(Boolean)),
  );
}

export function buildRequiredReviewers(input: GusPlanningSessionInput, workType: GusWorkType) {
  return Array.from(new Set([answerFor(input, "required_reviewers"), ...workType.defaultReviewers].filter(Boolean)));
}

