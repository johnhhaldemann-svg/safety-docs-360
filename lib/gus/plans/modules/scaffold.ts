import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const scaffold: GusPlanModule = {
  moduleId: "scaffold",
  displayName: "Scaffold",
  description: "Scaffold erection, use, modification, inspection, and dismantling.",
  triggerKeywords: ["scaffold", "scaffolding", "platform", "tag"],
  requiredQuestions: [
    "What scaffold type is involved?",
    "Who is inspecting or approving scaffold use?",
    "What access and fall protection apply?",
    "Will the scaffold be modified?",
  ],
  hazardCategories: ["Fall from scaffold", "Dropped object", "Collapse", "Unauthorized modification"],
  commonControls: ["Competent person inspection", "Scaffold tag review", "Guardrails", "Access control"],
  possiblePermits: ["Scaffold permit or tag system when required by site procedure"],
  possibleTrainingRequirements: ["Scaffold user training", "Competent person training when applicable"],
  requiredReviewRoles: ["Competent person", "Supervisor"],
  stopWorkTriggers: ["Missing tag", "Damaged scaffold", "Unauthorized modification", "Unsafe access"],
  draftPlanSections: ["Scaffold type", "Inspection", "Access", "Use limits"],
  validationRules: [
    {
      id: "scaffold_competent_person",
      description: "Scaffold drafts should identify inspection and competent person review.",
      severity: "warning",
    },
  ],
};

