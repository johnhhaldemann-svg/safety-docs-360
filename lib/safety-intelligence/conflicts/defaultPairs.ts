import type { ConflictEvaluation, RulesEvaluation } from "@/types/safety-intelligence";

export type ConflictSeed = {
  code: string;
  type: ConflictEvaluation["conflicts"][number]["type"];
  leftMatch: string[];
  rightMatch: string[];
  severity: ConflictEvaluation["conflicts"][number]["severity"];
  rationale: string;
  controls: string[];
};

export const DEFAULT_CONFLICT_SEEDS: ConflictSeed[] = [
  {
    code: "welding_near_painters",
    type: "trade_vs_trade",
    leftMatch: ["welding", "hot_work"],
    rightMatch: ["painting", "flammables"],
    severity: "critical",
    rationale: "Welding near painters creates ignition and flammable vapor exposure.",
    controls: ["separate_work_windows", "fire_watch", "ventilation"],
  },
  {
    code: "scaffold_above_electricians",
    type: "hazard_propagation",
    leftMatch: ["scaffold", "overhead_work"],
    rightMatch: ["electrical"],
    severity: "high",
    rationale: "Scaffold work above electricians creates dropped-object exposure.",
    controls: ["drop_zone_control", "toe_boards", "sequence_shift"],
  },
  {
    code: "excavation_pedestrian_route",
    type: "location_overlap",
    leftMatch: ["excavation"],
    rightMatch: ["pedestrian"],
    severity: "high",
    rationale: "Excavation near pedestrian routes requires rerouting and hard barricades.",
    controls: ["reroute_pedestrians", "barricade", "spotter"],
  },
  {
    code: "crane_pick_active_work_zone",
    type: "permit_conflict",
    leftMatch: ["crane", "lift"],
    rightMatch: ["active_work_zone"],
    severity: "critical",
    rationale: "Crane picks over active work zones require exclusion zones and lift planning.",
    controls: ["lift_plan", "exclusion_zone", "signal_person"],
  },
  {
    code: "energized_mechanical_startup",
    type: "task_vs_task",
    leftMatch: ["energized", "electrical"],
    rightMatch: ["startup", "mechanical"],
    severity: "critical",
    rationale: "Energized electrical work near mechanical startup creates unexpected energization risk.",
    controls: ["loto", "startup_hold", "coordination_meeting"],
  },
];

export function includeRulesTokens(
  taskText: string,
  rules: RulesEvaluation
) {
  const hazardFamilies = Array.isArray(rules.hazardFamilies) ? rules.hazardFamilies : [];
  const permitTriggers = Array.isArray(rules.permitTriggers) ? rules.permitTriggers : [];
  const requiredControls = Array.isArray(rules.requiredControls) ? rules.requiredControls : [];

  return `${taskText} ${hazardFamilies.join(" ")} ${permitTriggers.join(" ")} ${requiredControls.join(" ")}`.toLowerCase();
}
