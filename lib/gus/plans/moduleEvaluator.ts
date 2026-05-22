import type {
  GusPlanModule,
  GusPlanModuleEvaluation,
  GusPlanModuleEvaluationInput,
} from "@/lib/gus/plans/basePlanningTypes";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function answerFor(input: GusPlanModuleEvaluationInput, question: string) {
  return input.answers[question]?.trim() ?? "";
}

function missingQuestionLabel(question: string) {
  return question.replace(/\?$/, "");
}

export function evaluateGusPlanModule(
  module: GusPlanModule,
  input: GusPlanModuleEvaluationInput,
): GusPlanModuleEvaluation {
  const missingInformation = module.requiredQuestions
    .filter((question) => answerFor(input, question).length === 0)
    .map(missingQuestionLabel);
  const taskText = normalize(input.taskDescription);
  const hasKeywordSignal = module.triggerKeywords.some((keyword) => taskText.includes(normalize(keyword)));

  if (!hasKeywordSignal) {
    missingInformation.push(`Confirm whether ${module.displayName.toLowerCase()} applies to this task`);
  }

  return {
    moduleId: module.moduleId,
    missingInformation: Array.from(new Set(missingInformation)),
    draftOnlyRecommendations: module.commonControls.map(
      (control) => `Draft only: ${control}. Verify against company policy and complete human review before work starts.`,
    ),
    humanReviewRequired: true,
    requiredReviewRoles: module.requiredReviewRoles,
    officialRecordCreated: false,
  };
}

