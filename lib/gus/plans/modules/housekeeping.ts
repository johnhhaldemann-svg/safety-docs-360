import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const housekeeping: GusPlanModule = {
  moduleId: "housekeeping",
  displayName: "Housekeeping",
  description: "Work area organization, access, material storage, and slip/trip prevention.",
  triggerKeywords: ["housekeeping", "cleanup", "debris", "access", "storage", "trip"],
  requiredQuestions: [
    "What access routes must stay clear?",
    "What materials or debris will be generated?",
    "Who owns cleanup during and after the task?",
  ],
  hazardCategories: ["Slip, trip, and fall", "Blocked access", "Falling material", "Poor storage"],
  commonControls: ["Clear walkways", "Debris removal", "Material storage plan", "End-of-shift cleanup"],
  possiblePermits: ["None typically; review site-specific requirements"],
  possibleTrainingRequirements: ["Site orientation", "Material handling awareness"],
  requiredReviewRoles: ["Supervisor"],
  stopWorkTriggers: ["Emergency access blocked", "Walking surface unsafe", "Material storage unstable"],
  draftPlanSections: ["Access routes", "Debris handling", "Storage", "Cleanup owner"],
  validationRules: [
    {
      id: "housekeeping_access",
      description: "Housekeeping drafts should identify access route controls.",
      severity: "info",
    },
  ],
};

