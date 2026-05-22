import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const confinedSpace: GusPlanModule = {
  moduleId: "confinedSpace",
  displayName: "Confined space",
  description: "Confined or restricted-space entry and support work.",
  triggerKeywords: ["confined space", "entrant", "attendant", "vessel", "tank", "manhole"],
  requiredQuestions: [
    "What space is involved?",
    "What atmospheric or engulfment hazards may exist?",
    "Who are the entrant, attendant, and entry supervisor?",
    "What rescue plan applies?",
  ],
  hazardCategories: ["Atmospheric hazard", "Engulfment", "Entrapment", "Limited rescue access"],
  commonControls: ["Permit review", "Atmospheric monitoring", "Attendant", "Rescue plan"],
  possiblePermits: ["Confined space permit"],
  possibleTrainingRequirements: ["Entrant training", "Attendant training", "Entry supervisor training"],
  requiredReviewRoles: ["Competent person", "Supervisor", "Authorized safety representative"],
  stopWorkTriggers: ["Atmosphere outside limits", "Rescue plan missing", "Attendant unavailable", "Space conditions change"],
  draftPlanSections: ["Space description", "Atmosphere", "Roles", "Rescue plan"],
  validationRules: [
    {
      id: "confined_space_rescue",
      description: "Confined-space drafts must include rescue considerations.",
      severity: "critical",
    },
  ],
};

