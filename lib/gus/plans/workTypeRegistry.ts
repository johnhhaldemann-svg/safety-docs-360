import type { GusWorkType } from "@/lib/gus/plans/basePlanningTypes";
import {
  findGusPlanModulesForText,
  getGusPlanModule,
  gusPlanModuleIds,
  gusPlanModules,
} from "@/lib/gus/plans/modules";

export const gusWorkTypes: GusWorkType[] = [
  {
    id: "general_work",
    label: "General field work",
    description: "Routine field work that still needs task, hazard, control, and reviewer clarity.",
    commonHazards: ["Line of fire", "Slip, trip, and fall", "Manual handling", "Changing site conditions"],
    suggestedControls: ["Pre-task briefing", "Housekeeping", "Barricades or work-zone control", "Supervisor review"],
    possiblePermits: ["Site-specific permit review"],
    possibleTraining: ["Site orientation", "Task-specific training"],
    preStartInspections: ["Work area inspection", "Tool and equipment inspection"],
    defaultReviewers: ["Supervisor", "Authorized safety representative"],
  },
  {
    id: "excavation",
    label: "Excavation or trenching",
    description: "Ground disturbance, excavation, trenching, or work near an excavation.",
    commonHazards: ["Cave-in", "Underground utilities", "Mobile equipment", "Water accumulation"],
    suggestedControls: ["Competent person inspection", "Protective system review", "Utility locate", "Access and egress"],
    possiblePermits: ["Excavation permit", "Utility permit"],
    possibleTraining: ["Excavation competent person", "Utility awareness"],
    preStartInspections: ["Excavation inspection", "Atmospheric check when indicated", "Access and egress check"],
    defaultReviewers: ["Competent person", "Supervisor"],
  },
  {
    id: "hot_work",
    label: "Hot work",
    description: "Welding, cutting, grinding, brazing, or spark-producing work.",
    commonHazards: ["Fire", "Burns", "Fumes", "Stored energy"],
    suggestedControls: ["Fire watch", "Combustible material removal", "Fire extinguisher staged", "Ventilation"],
    possiblePermits: ["Hot work permit"],
    possibleTraining: ["Hot work training", "Fire watch training"],
    preStartInspections: ["Fire watch readiness", "Extinguisher inspection", "Atmospheric check when indicated"],
    defaultReviewers: ["Supervisor", "Authorized safety representative"],
  },
  {
    id: "confined_space",
    label: "Confined space",
    description: "Entry or support work involving a confined or potentially restricted space.",
    commonHazards: ["Atmospheric hazard", "Engulfment", "Entrapment", "Limited rescue access"],
    suggestedControls: ["Entry permit review", "Atmospheric monitoring", "Attendant", "Rescue plan"],
    possiblePermits: ["Confined space permit"],
    possibleTraining: ["Entrant training", "Attendant training", "Rescue awareness"],
    preStartInspections: ["Atmospheric test", "Ventilation check", "Rescue equipment check"],
    defaultReviewers: ["Competent person", "Supervisor", "Authorized safety representative"],
  },
  {
    id: "electrical",
    label: "Electrical work",
    description: "Electrical installation, troubleshooting, energized work planning, or lockout work.",
    commonHazards: ["Shock", "Arc flash", "Stored energy", "Unexpected startup"],
    suggestedControls: ["Energy isolation", "Lockout/tagout", "Qualified person review", "Arc flash boundary control"],
    possiblePermits: ["Energized electrical work permit", "LOTO permit or checklist"],
    possibleTraining: ["Electrical qualified person", "Lockout/tagout"],
    preStartInspections: ["Meter check", "PPE inspection", "Isolation verification"],
    defaultReviewers: ["Qualified person", "Supervisor"],
  },
  {
    id: "lifting_rigging",
    label: "Lifting or rigging",
    description: "Crane, hoist, forklift, material lift, or rigging activity.",
    commonHazards: ["Dropped load", "Crush hazard", "Swing radius", "Ground bearing condition"],
    suggestedControls: ["Lift plan", "Rigging inspection", "Exclusion zone", "Signal person assignment"],
    possiblePermits: ["Critical lift permit when applicable"],
    possibleTraining: ["Qualified rigger", "Signal person", "Equipment operator"],
    preStartInspections: ["Rigging inspection", "Equipment inspection", "Ground condition check"],
    defaultReviewers: ["Qualified person", "Supervisor"],
  },
  {
    id: "work_at_heights",
    label: "Work at heights",
    description: "Work from ladders, lifts, scaffolds, roofs, edges, or elevated surfaces.",
    commonHazards: ["Fall from elevation", "Dropped objects", "Unprotected edge", "Weather exposure"],
    suggestedControls: ["Fall protection plan", "Anchor point review", "Tool tethering", "Rescue planning"],
    possiblePermits: ["Work at heights permit when required by site procedure"],
    possibleTraining: ["Fall protection", "Lift or scaffold training"],
    preStartInspections: ["Harness inspection", "Anchor inspection", "Scaffold or lift inspection"],
    defaultReviewers: ["Competent person", "Supervisor"],
  },
  {
    id: "chemical_work",
    label: "Chemical or hazardous material work",
    description: "Handling, transfer, cleanup, or use of chemicals or hazardous materials.",
    commonHazards: ["Chemical exposure", "Incompatible materials", "Spill", "Ventilation concern"],
    suggestedControls: ["SDS review", "PPE selection", "Spill response setup", "Ventilation"],
    possiblePermits: ["Chemical work permit when required by site procedure"],
    possibleTraining: ["Hazard communication", "Spill response", "PPE use"],
    preStartInspections: ["Container label check", "PPE inspection", "Spill kit check"],
    defaultReviewers: ["Supervisor", "Authorized safety representative"],
  },
];

export function getGusWorkType(workTypeId: string) {
  return gusWorkTypes.find((workType) => workType.id === workTypeId) ?? gusWorkTypes[0];
}

export {
  findGusPlanModulesForText,
  getGusPlanModule,
  gusPlanModuleIds,
  gusPlanModules,
};
