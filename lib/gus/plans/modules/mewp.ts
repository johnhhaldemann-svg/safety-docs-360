import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const mewp: GusPlanModule = {
  moduleId: "mewp",
  displayName: "MEWP / aerial lift",
  description: "Mobile elevating work platforms, boom lifts, scissor lifts, and aerial lift tasks.",
  triggerKeywords: ["mewp", "aerial lift", "boom lift", "scissor lift", "manlift", "lift"],
  requiredQuestions: [
    "What lift type will be used?",
    "Who is the trained operator?",
    "What ground and overhead conditions exist?",
    "What rescue plan applies?",
  ],
  hazardCategories: ["Tip-over", "Fall from platform", "Overhead contact", "Crush point"],
  commonControls: ["Pre-use inspection", "Ground condition check", "Harness and lanyard when required", "Spotter when needed"],
  possiblePermits: ["Work at height permit when required by site procedure"],
  possibleTrainingRequirements: ["MEWP operator training", "Fall protection"],
  requiredReviewRoles: ["Supervisor", "Competent person when required"],
  stopWorkTriggers: ["Unsafe ground", "High wind", "Overhead conflict", "Untrained operator"],
  draftPlanSections: ["Lift selection", "Inspection", "Travel path", "Rescue plan"],
  validationRules: [
    {
      id: "mewp_operator_training",
      description: "MEWP drafts should identify the trained operator.",
      severity: "warning",
    },
  ],
};
