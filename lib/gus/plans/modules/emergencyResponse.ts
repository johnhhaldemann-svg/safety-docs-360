import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const emergencyResponse: GusPlanModule = {
  moduleId: "emergencyResponse",
  displayName: "Emergency response",
  description: "Emergency response planning for rescue, first aid, evacuation, and communication.",
  triggerKeywords: ["emergency", "rescue", "first aid", "evacuation", "muster", "medical"],
  requiredQuestions: [
    "What emergency scenarios are credible for this task?",
    "Where is the muster or access point?",
    "Who will call for help?",
    "What rescue or first aid resources are needed?",
  ],
  hazardCategories: ["Delayed rescue", "Medical emergency", "Evacuation barrier", "Communication failure"],
  commonControls: ["Emergency contacts", "Muster point", "Rescue equipment", "Communication check"],
  possiblePermits: ["Rescue plan attachment when required by task permit"],
  possibleTrainingRequirements: ["First aid or CPR when required", "Rescue role briefing"],
  requiredReviewRoles: ["Supervisor", "Authorized safety representative"],
  stopWorkTriggers: ["Rescue plan missing", "Emergency access blocked", "Communication unavailable"],
  draftPlanSections: ["Emergency scenarios", "Contacts", "Muster point", "Rescue resources"],
  validationRules: [
    {
      id: "emergency_response_access",
      description: "Emergency response drafts should identify access and communication methods.",
      severity: "warning",
    },
  ],
};

