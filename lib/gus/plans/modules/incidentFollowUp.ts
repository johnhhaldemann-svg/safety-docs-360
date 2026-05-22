import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const incidentFollowUp: GusPlanModule = {
  moduleId: "incidentFollowUp",
  displayName: "Incident follow-up",
  description: "Planning work after an incident, near miss, observation, or corrective action signal.",
  triggerKeywords: ["incident", "near miss", "follow-up", "corrective action", "observation"],
  requiredQuestions: [
    "What event or observation triggered follow-up?",
    "What corrective action is open or recently closed?",
    "What controls need verification?",
    "Who must review before similar work resumes?",
  ],
  hazardCategories: ["Repeat event", "Unverified control", "Communication gap", "Open corrective action"],
  commonControls: ["Supervisor review", "Corrective action verification", "Crew briefing", "Control effectiveness check"],
  possiblePermits: ["Permit re-review when work scope or controls changed"],
  possibleTrainingRequirements: ["Refresher briefing", "Task-specific retraining when indicated"],
  requiredReviewRoles: ["Supervisor", "Authorized safety representative"],
  stopWorkTriggers: ["Corrective action not verified", "Repeat hazard present", "Crew not briefed"],
  draftPlanSections: ["Event summary", "Corrective actions", "Control verification", "Crew briefing"],
  validationRules: [
    {
      id: "incident_followup_verification",
      description: "Incident follow-up drafts should identify control verification steps.",
      severity: "warning",
    },
  ],
};

