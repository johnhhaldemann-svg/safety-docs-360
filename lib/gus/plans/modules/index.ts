import type { GusPlanModule } from "@/lib/gus/plans/basePlanningTypes";
import { chemicalHazcom } from "@/lib/gus/plans/modules/chemicalHazcom";
import { concrete } from "@/lib/gus/plans/modules/concrete";
import { confinedSpace } from "@/lib/gus/plans/modules/confinedSpace";
import { craneRigging } from "@/lib/gus/plans/modules/craneRigging";
import { demolition } from "@/lib/gus/plans/modules/demolition";
import { electrical } from "@/lib/gus/plans/modules/electrical";
import { emergencyResponse } from "@/lib/gus/plans/modules/emergencyResponse";
import { generalPreTask } from "@/lib/gus/plans/modules/generalPreTask";
import { heavyEquipment } from "@/lib/gus/plans/modules/heavyEquipment";
import { hotWork } from "@/lib/gus/plans/modules/hotWork";
import { housekeeping } from "@/lib/gus/plans/modules/housekeeping";
import { incidentFollowUp } from "@/lib/gus/plans/modules/incidentFollowUp";
import { ladders } from "@/lib/gus/plans/modules/ladders";
import { loto } from "@/lib/gus/plans/modules/loto";
import { mewp } from "@/lib/gus/plans/modules/mewp";
import { scaffold } from "@/lib/gus/plans/modules/scaffold";
import { steelErection } from "@/lib/gus/plans/modules/steelErection";
import { trenching } from "@/lib/gus/plans/modules/trenching";
import { weather } from "@/lib/gus/plans/modules/weather";
import { workAtHeight } from "@/lib/gus/plans/modules/workAtHeight";

export const gusPlanModules: GusPlanModule[] = [
  generalPreTask,
  trenching,
  hotWork,
  electrical,
  loto,
  workAtHeight,
  ladders,
  mewp,
  craneRigging,
  confinedSpace,
  heavyEquipment,
  chemicalHazcom,
  concrete,
  steelErection,
  demolition,
  scaffold,
  weather,
  emergencyResponse,
  housekeeping,
  incidentFollowUp,
];

export const gusPlanModuleIds = gusPlanModules.map((module) => module.moduleId);

export function getGusPlanModule(moduleId: string) {
  return gusPlanModules.find((module) => module.moduleId === moduleId) ?? generalPreTask;
}

export function findGusPlanModulesForText(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return [generalPreTask];

  const matches = gusPlanModules
    .map((planModule) => {
      const matchedKeywords = planModule.triggerKeywords.filter((keyword) =>
        normalized.includes(keyword.toLowerCase()),
      );
      const keywordWeight = matchedKeywords.reduce((total, keyword) => total + keyword.length, 0);
      return { planModule, score: matchedKeywords.length * 100 + keywordWeight };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((match) => match.planModule);

  return matches.length > 0 ? matches : [generalPreTask];
}
