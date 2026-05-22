import { requireHumanReview } from "@/lib/gus/gusSafetyGate";
import type { GusPlanStatus } from "@/lib/gus/gusTypes";
import { validateGusOutput } from "@/lib/gus/gusValidation";
import type { GusPlanModule, GusWorkTypeDetection } from "@/lib/gus/plans/basePlanningTypes";
import { detectGusWorkTypes } from "@/lib/gus/plans/detectWorkType";
import { evaluateGusPlanModule } from "@/lib/gus/plans/moduleEvaluator";
import { getGusPlanModule } from "@/lib/gus/plans/modules";

export type GusSafeWorkPlanInput = {
  taskDescription: string;
  workArea?: string;
  crewTrades?: string;
  equipmentToolsMaterials?: string;
  answers?: Record<string, string>;
  selectedModuleIds?: string[];
  ppe?: string[];
  environmentalConditions?: string[];
  emergencyResponse?: string[];
};

export type GusSafeWorkPlanSection = {
  title: string;
  items: string[];
};

export type GusGeneratedSafeWorkPlan = {
  planId: string;
  status: GusPlanStatus;
  title: string;
  generatedAt: string;
  detectedWorkTypes: GusWorkTypeDetection[];
  sections: GusSafeWorkPlanSection[];
  missingInformation: string[];
  draftOnly: true;
  humanReviewRequired: true;
  officialRecordCreated: false;
};

export type GusGenerateSafeWorkPlanResult = {
  plan: GusGeneratedSafeWorkPlan;
  validationFindings: ReturnType<typeof validateGusOutput<GusGeneratedSafeWorkPlan>>["findings"];
};

const REQUIRED_SECTION_TITLES = [
  "Task Summary",
  "Work Area",
  "Crew / Trades",
  "Equipment / Tools / Materials",
  "Primary Hazards",
  "Required Controls",
  "Required Permits / Reviews",
  "Required Training / Qualifications",
  "Inspection Requirements",
  "PPE",
  "Environmental / Weather Considerations",
  "Emergency Response Considerations",
  "Stop-Work Triggers",
  "Pre-Task Briefing Talking Points",
  "Missing Information",
  "Draft JSA Items",
  "Gus Recommendation",
  "Human Review Required",
] as const;

function clean(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function splitText(value: string | undefined) {
  return unique((value ?? "").split(/\n|;/));
}

function answerMap(input: GusSafeWorkPlanInput) {
  return input.answers ?? {};
}

function answersForModule(module: GusPlanModule, input: GusSafeWorkPlanInput) {
  const answers = answerMap(input);
  return Object.fromEntries(module.requiredQuestions.map((question) => [question, answers[question] ?? ""]));
}

function selectedModules(input: GusSafeWorkPlanInput, detections: GusWorkTypeDetection[]) {
  const explicitIds = input.selectedModuleIds ?? [];
  const detectedIds = detections.filter((match) => match.kind === "module").map((match) => match.id);
  const ids = unique([...explicitIds, ...detectedIds]);
  return ids.length > 0 ? ids.map(getGusPlanModule) : [getGusPlanModule("generalPreTask")];
}

function deriveStatus(modules: GusPlanModule[], missingInformation: string[]): GusPlanStatus {
  if (missingInformation.length > 0) return "draft_incomplete";
  if (modules.some((module) => module.requiredReviewRoles.some((role) => /qualified person/i.test(role)))) {
    return "needs_qualified_person_review";
  }
  if (modules.some((module) => module.requiredReviewRoles.some((role) => /competent person/i.test(role)))) {
    return "needs_competent_person_review";
  }
  if (modules.some((module) => module.requiredReviewRoles.some((role) => /supervisor/i.test(role)))) {
    return "needs_supervisor_review";
  }
  return "draft_ready_for_review";
}

function section(title: (typeof REQUIRED_SECTION_TITLES)[number], items: string[]): GusSafeWorkPlanSection {
  return { title, items: items.length > 0 ? items : ["Needs human review."] };
}

export function generateSafeWorkPlan(input: GusSafeWorkPlanInput): GusGenerateSafeWorkPlanResult {
  const detections = detectGusWorkTypes(input.taskDescription);
  const modules = selectedModules(input, detections.matches);
  const moduleEvaluations = modules.map((module) =>
    evaluateGusPlanModule(module, {
      taskDescription: input.taskDescription,
      answers: answersForModule(module, input),
    }),
  );
  const missingInformation = unique([
    ...moduleEvaluations.flatMap((evaluation) => evaluation.missingInformation),
    !input.taskDescription.trim() ? "Task summary" : undefined,
    !input.workArea?.trim() ? "Work area" : undefined,
    !input.crewTrades?.trim() ? "Crew / trades" : undefined,
    !input.equipmentToolsMaterials?.trim() ? "Equipment / tools / materials" : undefined,
  ]);
  const hazards = unique(modules.flatMap((module) => module.hazardCategories));
  const controls = unique(modules.flatMap((module) => module.commonControls));
  const permits = unique(modules.flatMap((module) => module.possiblePermits));
  const training = unique(modules.flatMap((module) => module.possibleTrainingRequirements));
  const reviewers = unique(modules.flatMap((module) => module.requiredReviewRoles));
  const stopWorkTriggers = unique(modules.flatMap((module) => module.stopWorkTriggers));
  const draftPlanSections = unique(modules.flatMap((module) => module.draftPlanSections));
  const status = deriveStatus(modules, missingInformation);
  const ppe = unique([
    ...(input.ppe ?? []),
    detections.matches.some((match) => match.id === "ppe") ? "PPE selection must be verified against company policy" : undefined,
    hazards.some((hazard) => /fall|dropped/i.test(hazard)) ? "Head protection and fall-related PPE review may be needed" : undefined,
    hazards.some((hazard) => /fire|burn|fume/i.test(hazard)) ? "Hot work PPE and eye/face protection review may be needed" : undefined,
  ]);
  const environmental = unique([
    ...splitText(input.environmentalConditions?.join(";")),
    detections.matches.some((match) => match.id === "weather" || match.id === "heatStress")
      ? "Weather and heat stress controls may require review"
      : undefined,
  ]);
  const emergency = unique([
    ...splitText(input.emergencyResponse?.join(";")),
    "Confirm emergency access, communication method, and escalation contacts before work starts",
  ]);

  const planDraft: GusGeneratedSafeWorkPlan = {
    planId: `gus-swp-${Date.now()}`,
    status,
    title: `Draft Safe Work Plan: ${clean(input.taskDescription, "Task needs review")}`,
    generatedAt: new Date().toISOString(),
    detectedWorkTypes: detections.matches,
    sections: [
      section("Task Summary", [clean(input.taskDescription, "Task summary needs review")]),
      section("Work Area", [clean(input.workArea, "Work area needs review")]),
      section("Crew / Trades", [clean(input.crewTrades, "Crew and trade information needs review")]),
      section("Equipment / Tools / Materials", [
        clean(input.equipmentToolsMaterials, "Equipment, tools, materials, chemicals, or energy sources need review"),
      ]),
      section("Primary Hazards", hazards),
      section("Required Controls", controls),
      section("Required Permits / Reviews", permits),
      section("Required Training / Qualifications", training),
      section("Inspection Requirements", [
        ...draftPlanSections.filter((item) => /inspection|review|verification|check/i.test(item)),
        "Verify inspection requirements against company policy",
      ]),
      section("PPE", ppe),
      section("Environmental / Weather Considerations", environmental),
      section("Emergency Response Considerations", emergency),
      section("Stop-Work Triggers", stopWorkTriggers),
      section("Pre-Task Briefing Talking Points", [
        "Review task scope, crew roles, hazards, controls, stop-work triggers, and missing information",
        "Confirm supervisor or required reviewer has reviewed this draft before work starts",
      ]),
      section("Missing Information", missingInformation),
      section("Draft JSA Items", [
        ...hazards.slice(0, 8).map((hazard) => `Draft JSA hazard item: ${hazard}`),
        ...controls.slice(0, 8).map((control) => `Draft JSA control item: ${control}`),
      ]),
      section("Gus Recommendation", [
        "Draft only: verify this plan against company policy and have the required human reviewer complete review before work starts.",
      ]),
      section("Human Review Required", reviewers),
    ],
    missingInformation,
    draftOnly: true,
    humanReviewRequired: true,
    officialRecordCreated: false,
  };

  const reviewedPlan = requireHumanReview(planDraft);
  const validation = validateGusOutput<GusGeneratedSafeWorkPlan>(reviewedPlan);

  return {
    plan: validation.sanitizedOutput,
    validationFindings: validation.findings,
  };
}

export { REQUIRED_SECTION_TITLES as GUS_SAFE_WORK_PLAN_SECTION_TITLES };

