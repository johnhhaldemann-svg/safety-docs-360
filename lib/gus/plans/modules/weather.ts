import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const weather: GusPlanModule = {
  moduleId: "weather",
  displayName: "Weather and environmental conditions",
  description: "Weather-sensitive work planning for heat, cold, wind, lightning, rain, and visibility.",
  triggerKeywords: ["weather", "wind", "lightning", "heat", "cold", "rain", "storm"],
  requiredQuestions: [
    "What weather conditions could affect the task?",
    "What monitoring source will be used?",
    "What stop-work thresholds apply?",
    "How will the crew be notified if conditions change?",
  ],
  hazardCategories: ["Heat stress", "Cold stress", "Wind exposure", "Lightning", "Reduced visibility"],
  commonControls: ["Weather monitoring", "Hydration or warming plan", "Wind limits", "Communication plan"],
  possiblePermits: ["Weather-sensitive activity review when required by site procedure"],
  possibleTrainingRequirements: ["Heat illness awareness", "Severe weather response"],
  requiredReviewRoles: ["Supervisor", "Authorized safety representative"],
  stopWorkTriggers: ["Lightning in area", "Wind above task limit", "Heat illness concern", "Visibility unsafe"],
  draftPlanSections: ["Weather risks", "Monitoring", "Thresholds", "Crew communication"],
  validationRules: [
    {
      id: "weather_stop_work_thresholds",
      description: "Weather-sensitive drafts should list stop-work thresholds.",
      severity: "warning",
    },
  ],
};

