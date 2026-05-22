import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const concrete: GusPlanModule = {
  moduleId: "concrete",
  displayName: "Concrete work",
  description: "Concrete placement, cutting, drilling, finishing, and curing work.",
  triggerKeywords: ["concrete", "pour", "finish", "cutting", "drilling", "silica"],
  requiredQuestions: [
    "What concrete activity is planned?",
    "What silica or chemical exposure may occur?",
    "What equipment will be used?",
    "How will access and washout be controlled?",
  ],
  hazardCategories: ["Silica dust", "Chemical burns", "Struck-by", "Manual handling"],
  commonControls: ["Wet methods or dust control", "PPE", "Equipment inspection", "Washout controls"],
  possiblePermits: ["Silica or dust-control plan when required by site procedure"],
  possibleTrainingRequirements: ["Silica awareness", "PPE use", "Equipment training"],
  requiredReviewRoles: ["Supervisor", "Authorized safety representative"],
  stopWorkTriggers: ["Dust controls unavailable", "Concrete contact not controlled", "Equipment defect"],
  draftPlanSections: ["Concrete task", "Dust controls", "PPE", "Access and washout"],
  validationRules: [
    {
      id: "concrete_silica_controls",
      description: "Concrete cutting or drilling drafts should address dust controls.",
      severity: "warning",
    },
  ],
};

