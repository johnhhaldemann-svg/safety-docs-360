export * from "@/types/safety-intelligence";

import type {
  ConflictSeverity,
  HazardFamily,
  PermitTriggerType,
  RiskBand,
  SafetyIntelligenceDocumentType,
  WeatherSensitivity,
} from "@/types/safety-intelligence";

export const SAFETY_INTELLIGENCE_DOCUMENT_TYPES: SafetyIntelligenceDocumentType[] = [
  "jsa",
  "csep",
  "peshep",
  "pshsep",
  "permit",
  "sop",
  "work_plan",
  "safety_narrative",
];

export const HAZARD_FAMILIES: HazardFamily[] = [
  "hot_work",
  "fire",
  "fumes",
  "electrical",
  "arc_flash",
  "excavation",
  "collapse",
  "utility_strike",
  "fall",
  "overhead_work",
  "line_of_fire",
  "flammables",
  "struck_by",
  "weather",
  "unknown",
];

export const PERMIT_TRIGGER_TYPES: PermitTriggerType[] = [
  "hot_work_permit",
  "energized_electrical_permit",
  "excavation_permit",
  "confined_space_permit",
  "lift_plan",
  "elevated_work_notice",
  "hot_work_exclusion_zone",
  "none",
];

export const WEATHER_SENSITIVITIES: WeatherSensitivity[] = ["low", "medium", "high"];
export const CONFLICT_SEVERITIES: ConflictSeverity[] = ["low", "medium", "high", "critical"];
export const RISK_BANDS: RiskBand[] = ["low", "moderate", "high", "critical"];

