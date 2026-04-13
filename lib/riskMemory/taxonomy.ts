/**
 * Phase 1 taxonomy for Safety360 Risk Memory Engine.
 * Primary hazard codes align with `exposure_event_type` / `lib/incidents/exposureEventType`.
 */

import { EXPOSURE_EVENT_TYPES, type ExposureEventType, normalizeExposureEventType } from "@/lib/incidents/exposureEventType";

export const PRIMARY_HAZARD_CODES = EXPOSURE_EVENT_TYPES;
export type PrimaryHazardCode = ExposureEventType;

export { normalizeExposureEventType as normalizePrimaryHazardCode };

export const SCOPE_OF_WORK_CODES = [
  "general_site_operations",
  "excavation_trenching",
  "utility_installation",
  "concrete_formwork",
  "steel_erection",
  "structural_work",
  "electrical_work",
  "loto_energy_isolation",
  "hot_work",
  "confined_space",
  "work_at_height",
  "roofing",
  "scaffold_work",
  "ladder_work",
  "mewp_awp",
  "crane_rigging_critical_lift",
  "material_handling",
  "demolition",
  "interior_buildout",
  "traffic_control",
  "equipment_operation",
  "civil_earthwork",
  "environmental_work",
  "commissioning_startup",
  "maintenance_work",
] as const;

export type ScopeOfWorkCode = (typeof SCOPE_OF_WORK_CODES)[number];

export const SCOPE_OF_WORK_LABELS: Record<ScopeOfWorkCode, string> = {
  general_site_operations: "General site operations",
  excavation_trenching: "Excavation / trenching",
  utility_installation: "Utility installation",
  concrete_formwork: "Concrete / formwork",
  steel_erection: "Steel erection",
  structural_work: "Structural work",
  electrical_work: "Electrical work",
  loto_energy_isolation: "LOTO / energy isolation",
  hot_work: "Hot work",
  confined_space: "Confined space",
  work_at_height: "Work at height",
  roofing: "Roofing",
  scaffold_work: "Scaffold work",
  ladder_work: "Ladder work",
  mewp_awp: "MEWP / AWP",
  crane_rigging_critical_lift: "Crane / rigging / critical lift",
  material_handling: "Material handling",
  demolition: "Demolition",
  interior_buildout: "Interior buildout",
  traffic_control: "Traffic control",
  equipment_operation: "Equipment operation",
  civil_earthwork: "Civil / earthwork",
  environmental_work: "Environmental work",
  commissioning_startup: "Commissioning / startup",
  maintenance_work: "Maintenance work",
};

export const TRADE_CODES = [
  "laborers",
  "operators",
  "ironworkers",
  "electricians",
  "pipefitters",
  "plumbers",
  "carpenters",
  "roofers",
  "masons",
  "millwrights",
  "welders",
  "painters_coatings",
  "hvac",
  "insulators",
  "scaffold_builders",
  "demo_crews",
  "concrete_crews",
  "truck_drivers",
  "riggers_signal_persons",
  "safety_staff",
  "supervisors_foremen",
  "subcontractor_management",
  "other",
] as const;

export type TradeCode = (typeof TRADE_CODES)[number];

export const TRADE_LABELS: Record<TradeCode, string> = {
  laborers: "Laborers",
  operators: "Operators",
  ironworkers: "Ironworkers",
  electricians: "Electricians",
  pipefitters: "Pipefitters",
  plumbers: "Plumbers",
  carpenters: "Carpenters",
  roofers: "Roofers",
  masons: "Masons",
  millwrights: "Millwrights",
  welders: "Welders",
  painters_coatings: "Painters / coatings",
  hvac: "HVAC",
  insulators: "Insulators",
  scaffold_builders: "Scaffold builders",
  demo_crews: "Demo crews",
  concrete_crews: "Concrete crews",
  truck_drivers: "Truck drivers",
  riggers_signal_persons: "Riggers / signal persons",
  safety_staff: "Safety staff",
  supervisors_foremen: "Supervisors / foremen",
  subcontractor_management: "Subcontractor management",
  other: "Other / mixed",
};

export const ROOT_CAUSE_LEVEL1 = [
  "human_factors",
  "planning_factors",
  "training_factors",
  "supervision_factors",
  "process_system_factors",
  "equipment_environment_factors",
] as const;

export type RootCauseLevel1 = (typeof ROOT_CAUSE_LEVEL1)[number];

export const ROOT_CAUSE_LEVEL2_BY_L1: Record<RootCauseLevel1, readonly string[]> = {
  human_factors: [
    "rushed_work",
    "distraction",
    "shortcut_taken",
    "poor_positioning",
    "improper_body_mechanics",
    "lack_awareness",
  ],
  planning_factors: [
    "poor_pre_task_planning",
    "incomplete_jsa",
    "scope_changed_field",
    "no_weather_contingency",
    "no_lift_plan",
    "incomplete_sequence_planning",
  ],
  training_factors: [
    "not_trained",
    "insufficient_training",
    "not_task_qualified",
    "orientation_gap",
    "refresher_overdue",
  ],
  supervision_factors: [
    "inadequate_oversight",
    "no_follow_up",
    "poor_enforcement",
    "unclear_expectations",
    "production_pressure",
  ],
  process_system_factors: [
    "procedure_missing",
    "procedure_not_followed",
    "permit_missing",
    "inspection_missing",
    "poor_handoff",
    "poor_communication",
  ],
  equipment_environment_factors: [
    "tool_failure",
    "equipment_defect",
    "poor_lighting",
    "bad_ground_conditions",
    "weather_change",
    "layout_congestion",
  ],
};

export const FAILED_CONTROL_CODES = [
  "ppe_not_used",
  "ppe_incorrect",
  "guardrail_missing",
  "cover_missing",
  "barricade_missing",
  "warning_line_missing",
  "permit_not_issued",
  "permit_incomplete",
  "jsa_missing",
  "jsa_poor_quality",
  "inspection_not_completed",
  "equipment_not_inspected",
  "spotter_missing",
  "fire_watch_missing",
  "competent_person_not_involved",
  "supervisor_approval_missing",
  "training_expired",
  "lockout_incomplete",
  "exclusion_zone_failed",
  "housekeeping_not_maintained",
  "weather_monitoring_not_performed",
  "anchor_point_missing",
  "poor_access_egress",
] as const;

export type FailedControlCode = (typeof FAILED_CONTROL_CODES)[number];

export const WEATHER_CONDITION_CODES = [
  "clear",
  "rain",
  "heavy_rain",
  "snow",
  "ice",
  "windy",
  "high_wind",
  "lightning_risk",
  "extreme_heat",
  "high_humidity",
  "extreme_cold",
  "fog_low_visibility",
  "muddy_conditions",
  "wet_surfaces",
  "dusty_conditions",
  "unknown",
] as const;

export type WeatherConditionCode = (typeof WEATHER_CONDITION_CODES)[number];

export const SEVERITY_POTENTIAL_CODES = [
  "positive_prevented",
  "low_potential",
  "moderate_potential",
  "high_potential",
  "critical_potential",
  "first_aid",
  "medical_treatment",
  "restricted_duty",
  "recordable",
  "lost_time",
  "none",
] as const;

export type SeverityPotentialCode = (typeof SEVERITY_POTENTIAL_CODES)[number];

export const PERMIT_STATUS_SUMMARY_CODES = ["complete", "incomplete", "missing", "not_required", "unknown"] as const;
export type PermitStatusSummaryCode = (typeof PERMIT_STATUS_SUMMARY_CODES)[number];

export const PPE_STATUS_SUMMARY_CODES = ["aligned", "deficient", "not_assessed", "unknown"] as const;
export type PpeStatusSummaryCode = (typeof PPE_STATUS_SUMMARY_CODES)[number];

const SCOPE_SET = new Set<string>(SCOPE_OF_WORK_CODES);
const TRADE_SET = new Set<string>(TRADE_CODES);
const ROOT_L1_SET = new Set<string>(ROOT_CAUSE_LEVEL1);
const FAILED_SET = new Set<string>(FAILED_CONTROL_CODES);
const WEATHER_SET = new Set<string>(WEATHER_CONDITION_CODES);
const SEVERITY_SET = new Set<string>(SEVERITY_POTENTIAL_CODES);
const PERMIT_SUM_SET = new Set<string>(PERMIT_STATUS_SUMMARY_CODES);
const PPE_SUM_SET = new Set<string>(PPE_STATUS_SUMMARY_CODES);

export function normalizeScopeOfWorkCode(input: unknown): ScopeOfWorkCode | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  return SCOPE_SET.has(v) ? (v as ScopeOfWorkCode) : null;
}

export function normalizeTradeCode(input: unknown): TradeCode | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  if (TRADE_SET.has(v)) return v as TradeCode;
  return null;
}

export function normalizeRootCauseLevel1(input: unknown): RootCauseLevel1 | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  return ROOT_L1_SET.has(v) ? (v as RootCauseLevel1) : null;
}

export function normalizeRootCauseLevel2(l1: RootCauseLevel1 | null, input: unknown): string | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  if (!l1 || !v) return null;
  const allowed = ROOT_CAUSE_LEVEL2_BY_L1[l1];
  return allowed.includes(v) ? v : null;
}

export function normalizeFailedControlCode(input: unknown): string | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  return FAILED_SET.has(v) ? v : null;
}

export function normalizeWeatherConditionCode(input: unknown): WeatherConditionCode | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  return WEATHER_SET.has(v) ? (v as WeatherConditionCode) : null;
}

export function normalizeSeverityPotentialCode(input: unknown): SeverityPotentialCode | null {
  const v = String(input ?? "").trim().toLowerCase().replace(/[/\s-]+/g, "_");
  return SEVERITY_SET.has(v) ? (v as SeverityPotentialCode) : null;
}

export function normalizePermitStatusSummary(input: unknown): PermitStatusSummaryCode | null {
  const v = String(input ?? "").trim().toLowerCase();
  return PERMIT_SUM_SET.has(v) ? (v as PermitStatusSummaryCode) : null;
}

export function normalizePpeStatusSummary(input: unknown): PpeStatusSummaryCode | null {
  const v = String(input ?? "").trim().toLowerCase();
  return PPE_SUM_SET.has(v) ? (v as PpeStatusSummaryCode) : null;
}

export function normalizeSecondaryHazardCodes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    const c = normalizeExposureEventType(item);
    if (c) out.push(c);
  }
  return [...new Set(out)];
}

/** Map SIF category on corrective actions to a primary hazard code when user did not set one. */
export function primaryHazardFromSifCategory(sifCategory: string | null | undefined): PrimaryHazardCode | null {
  const v = String(sifCategory ?? "").trim().toLowerCase();
  const map: Record<string, PrimaryHazardCode> = {
    fall_from_height: "fall_to_lower_level",
    struck_by: "struck_by_object",
    caught_between: "caught_in_between",
    electrical: "electrical",
    excavation_collapse: "excavation_collapse",
    confined_space: "confined_space",
    hazardous_energy: "contact_with_equipment",
    crane_rigging: "contact_with_equipment",
    line_of_fire: "struck_by_object",
  };
  return map[v] ?? null;
}

/** Derive potential severity band from incident severity label. */
export function potentialSeverityFromIncidentSeverity(severity: string | null | undefined): SeverityPotentialCode {
  const s = String(severity ?? "").trim().toLowerCase();
  if (s === "critical") return "critical_potential";
  if (s === "high") return "high_potential";
  if (s === "low") return "low_potential";
  return "moderate_potential";
}

export function actualOutcomeFromIncidentCategory(category: string | null | undefined): SeverityPotentialCode {
  const c = String(category ?? "").trim().toLowerCase();
  if (c === "near_miss") return "none";
  if (c === "hazard") return "low_potential";
  if (c === "incident") return "recordable";
  return "none";
}
