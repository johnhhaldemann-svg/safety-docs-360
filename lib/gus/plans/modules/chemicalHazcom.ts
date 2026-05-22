import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";

export const chemicalHazcom: GusPlanModule = {
  moduleId: "chemicalHazcom",
  displayName: "Chemical / HazCom",
  description: "Chemical handling, transfer, cleanup, use, or exposure planning.",
  triggerKeywords: ["chemical", "hazcom", "sds", "solvent", "paint", "epoxy", "spill"],
  requiredQuestions: [
    "What chemical or material is involved?",
    "Has the SDS been reviewed?",
    "What exposure route is possible?",
    "What spill response is needed?",
  ],
  hazardCategories: ["Chemical exposure", "Incompatible materials", "Spill", "Ventilation concern"],
  commonControls: ["SDS review", "PPE selection", "Ventilation", "Spill kit staged"],
  possiblePermits: ["Chemical work permit when required by site procedure"],
  possibleTrainingRequirements: ["Hazard communication", "PPE use", "Spill response"],
  requiredReviewRoles: ["Supervisor", "Authorized safety representative"],
  stopWorkTriggers: ["Unknown chemical", "SDS unavailable", "Ventilation inadequate", "Spill controls missing"],
  draftPlanSections: ["Material details", "Exposure controls", "PPE", "Spill response"],
  validationRules: [
    {
      id: "chemical_sds_review",
      description: "Chemical drafts should identify SDS review and PPE selection.",
      severity: "warning",
    },
  ],
};

