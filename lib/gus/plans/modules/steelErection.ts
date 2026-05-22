import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const steelErection: GusPlanModule = {
  moduleId: "steelErection",
  displayName: "Steel erection",
  description: "Structural steel setting, bolting, decking, connecting, and related access work.",
  triggerKeywords: ["steel", "erection", "connector", "bolting", "decking", "beam"],
  requiredQuestions: [
    "What steel activity is planned?",
    "What lifting or rigging is involved?",
    "What fall exposure exists?",
    "Who must review the sequence?",
  ],
  hazardCategories: ["Falls", "Dropped objects", "Crush hazard", "Structural instability"],
  commonControls: ["Fall protection", "Controlled decking zone review", "Rigging controls", "Sequence review"],
  possiblePermits: ["Critical lift permit when applicable", "Work at height permit when required by site procedure"],
  possibleTrainingRequirements: ["Fall protection", "Rigging", "Steel erection task training"],
  requiredReviewRoles: ["Qualified person", "Competent person", "Supervisor"],
  stopWorkTriggers: ["Unclear sequence", "Fall protection missing", "Uncontrolled suspended load", "Weather concern"],
  draftPlanSections: ["Steel sequence", "Fall protection", "Rigging", "Exclusion zones"],
  validationRules: [
    {
      id: "steel_sequence_review",
      description: "Steel erection drafts should include sequence and reviewer information.",
      severity: "critical",
    },
  ],
};

