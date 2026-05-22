import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const craneRigging: GusPlanModule = {
  moduleId: "craneRigging",
  displayName: "Crane and rigging",
  description: "Crane, hoist, forklift, rigging, and suspended load planning.",
  triggerKeywords: ["crane", "rigging", "lift", "hoist", "sling", "signal person"],
  requiredQuestions: [
    "What is being lifted?",
    "What is the load weight and path?",
    "Who is the qualified rigger or signal person?",
    "What exclusion zone is needed?",
  ],
  hazardCategories: ["Dropped load", "Crush hazard", "Swing radius", "Ground bearing condition"],
  commonControls: ["Lift plan", "Rigging inspection", "Exclusion zone", "Signal person assignment"],
  possiblePermits: ["Critical lift permit when applicable"],
  possibleTrainingRequirements: ["Qualified rigger", "Signal person", "Equipment operator"],
  requiredReviewRoles: ["Qualified person", "Supervisor"],
  stopWorkTriggers: ["Unknown load weight", "Damaged rigging", "People under suspended load", "Wind or ground concern"],
  draftPlanSections: ["Load details", "Rigging", "Lift path", "Communication"],
  validationRules: [
    {
      id: "rigging_load_weight",
      description: "Rigging drafts should identify load weight or require review when unknown.",
      severity: "critical",
    },
  ],
};

