import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const ladders: GusPlanModule = {
  moduleId: "ladders",
  displayName: "Ladders",
  description: "Portable, fixed, and step ladder work planning.",
  triggerKeywords: ["ladder", "step ladder", "extension ladder", "fixed ladder"],
  requiredQuestions: [
    "Why is a ladder the right access method?",
    "What ladder type and rating will be used?",
    "How will the ladder be inspected and secured?",
  ],
  hazardCategories: ["Fall from ladder", "Unstable setup", "Overreach", "Electrical contact"],
  commonControls: ["Ladder inspection", "Stable setup", "Three points of contact", "Maintain clearance"],
  possiblePermits: ["Work at height permit when required by site procedure"],
  possibleTrainingRequirements: ["Ladder safety", "Fall protection when applicable"],
  requiredReviewRoles: ["Supervisor", "Competent person when required"],
  stopWorkTriggers: ["Damaged ladder", "Unstable footing", "Unsafe reach", "Electrical clearance concern"],
  draftPlanSections: ["Access justification", "Inspection", "Setup", "Use limits"],
  validationRules: [
    {
      id: "ladder_inspection",
      description: "Ladder drafts should include pre-use inspection.",
      severity: "warning",
    },
  ],
};

