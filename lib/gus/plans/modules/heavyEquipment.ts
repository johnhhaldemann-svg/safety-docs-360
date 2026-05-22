import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const heavyEquipment: GusPlanModule = {
  moduleId: "heavyEquipment",
  displayName: "Heavy equipment",
  description: "Operation or interaction with loaders, excavators, forklifts, trucks, and similar equipment.",
  triggerKeywords: ["heavy equipment", "excavator", "loader", "forklift", "truck", "equipment operation"],
  requiredQuestions: [
    "What equipment is being used?",
    "Who is the operator?",
    "What traffic or pedestrian interface exists?",
    "What backup or spotter controls apply?",
  ],
  hazardCategories: ["Struck-by", "Caught-between", "Blind spot", "Tip-over"],
  commonControls: ["Operator inspection", "Traffic control", "Spotter", "Exclusion zone"],
  possiblePermits: ["Mobile equipment permit when required by site procedure"],
  possibleTrainingRequirements: ["Equipment operator qualification", "Spotter training"],
  requiredReviewRoles: ["Supervisor", "Equipment operator"],
  stopWorkTriggers: ["Pedestrian interface uncontrolled", "Equipment defect", "Unstable ground", "Unqualified operator"],
  draftPlanSections: ["Equipment", "Traffic plan", "Exclusion zones", "Inspections"],
  validationRules: [
    {
      id: "heavy_equipment_traffic_plan",
      description: "Heavy equipment drafts should address traffic and pedestrian controls.",
      severity: "warning",
    },
  ],
};

