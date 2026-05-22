import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const demolition: GusPlanModule = {
  moduleId: "demolition",
  displayName: "Demolition",
  description: "Selective demolition, removal, dismantling, or tear-out work.",
  triggerKeywords: ["demolition", "demo", "tear out", "remove", "dismantle"],
  requiredQuestions: [
    "What is being removed?",
    "What utilities or stored energy may remain?",
    "What structural concerns exist?",
    "How will debris and exposure be controlled?",
  ],
  hazardCategories: ["Structural instability", "Hidden utilities", "Dust", "Falling debris"],
  commonControls: ["Utility isolation", "Structural review", "Dust control", "Debris management"],
  possiblePermits: ["Demolition permit when required by site procedure", "Hot work permit when applicable"],
  possibleTrainingRequirements: ["Demolition task training", "HazCom when materials are involved"],
  requiredReviewRoles: ["Competent person", "Supervisor"],
  stopWorkTriggers: ["Unknown utility", "Unexpected structural condition", "Uncontrolled dust", "Public interface uncontrolled"],
  draftPlanSections: ["Demolition scope", "Utilities", "Structural concerns", "Debris controls"],
  validationRules: [
    {
      id: "demolition_utility_review",
      description: "Demolition drafts should identify utility isolation or missing information.",
      severity: "critical",
    },
  ],
};

