import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOR_HAZARD_TO_EXPOSURE_EVENTS,
  isSorHazardCategoryCode,
  type SorHazardCategoryCode,
} from "@/lib/incidents/sorHazardCategory";
import { serverLog } from "@/lib/serverLog";
import { resolveContractorIdForCompany } from "@/lib/riskMemory/contractorScope";
import { resolveCrewIdForCompany } from "@/lib/riskMemory/crewScope";
import {
  actualOutcomeFromIncidentCategory,
  normalizeFailedControlCode,
  normalizePermitStatusSummary,
  normalizePpeStatusSummary,
  normalizeRootCauseLevel1,
  normalizeRootCauseLevel2,
  normalizeScopeOfWorkCode,
  normalizeSecondaryHazardCodes,
  normalizeSeverityPotentialCode,
  normalizeTradeCode,
  normalizeWeatherConditionCode,
  normalizePrimaryHazardCode,
  potentialSeverityFromIncidentSeverity,
  primaryHazardFromSifCategory,
  type PermitStatusSummaryCode,
} from "@/lib/riskMemory/taxonomy";
import {
  normalizeBehaviorCategory,
  normalizeCostImpactBand,
  normalizeSupervisionStatus,
  normalizeTrainingStatus,
  parseContractorUuid,
  parseCrewUuid,
  parseForecastConfidence,
} from "@/lib/riskMemory/taxonomyPhase2";

function permitStatusFromRow(status: string | null | undefined): PermitStatusSummaryCode {
  const st = String(status ?? "").toLowerCase();
  if (st === "active" || st === "closed") return "complete";
  if (st === "draft") return "incomplete";
  if (st === "expired") return "incomplete";
  return "unknown";
}

export type RiskMemorySourceModule =
  | "incident"
  | "corrective_action"
  | "jsa_activity"
  | "permit"
  | "sor_record";

export type CompanyRiskMemoryFacetInsert = {
  company_id: string;
  jobsite_id: string | null;
  source_module: RiskMemorySourceModule;
  source_id: string;
  scope_of_work_code: string | null;
  trade_code: string | null;
  primary_hazard_code: string | null;
  secondary_hazard_codes: string[];
  root_cause_level1: string | null;
  root_cause_level2: string | null;
  failed_control_code: string | null;
  weather_condition_code: string | null;
  potential_severity_code: string | null;
  actual_outcome_severity_code: string | null;
  contractor_label: string | null;
  location_area: string | null;
  time_of_day_band: string | null;
  permit_status_summary: string | null;
  ppe_status_summary: string | null;
  corrective_action_status: string | null;
  contractor_id: string | null;
  behavior_category: string | null;
  training_status: string | null;
  supervision_status: string | null;
  equipment_type: string | null;
  cost_impact_band: string | null;
  forecast_confidence: number | null;
  location_grid: string | null;
  crew_id: string | null;
  details: Record<string, unknown>;
};

function str(input: unknown): string | null {
  const s = String(input ?? "").trim();
  return s || null;
}

export function parseRiskMemoryPayload(body: Record<string, unknown> | null | undefined): Partial<CompanyRiskMemoryFacetInsert> | null {
  const raw = body?.riskMemory;
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const l1 = normalizeRootCauseLevel1(m.rootCauseLevel1);
  const l2 = normalizeRootCauseLevel2(l1, m.rootCauseLevel2);
  const secondary = normalizeSecondaryHazardCodes(m.secondaryHazards);
  const cid = parseContractorUuid(m.contractorId);
  const crewId = parseCrewUuid(m.crewId);
  return {
    scope_of_work_code: normalizeScopeOfWorkCode(m.scopeOfWork),
    trade_code: normalizeTradeCode(m.trade),
    primary_hazard_code: normalizePrimaryHazardCode(m.primaryHazard),
    secondary_hazard_codes: secondary.length ? secondary : [],
    root_cause_level1: l1,
    root_cause_level2: l2,
    failed_control_code: normalizeFailedControlCode(m.failedControl),
    weather_condition_code: normalizeWeatherConditionCode(m.weather),
    potential_severity_code: normalizeSeverityPotentialCode(m.potentialSeverity),
    actual_outcome_severity_code: normalizeSeverityPotentialCode(m.actualOutcomeSeverity),
    contractor_label: str(m.contractor),
    contractor_id: cid,
    behavior_category: normalizeBehaviorCategory(m.behaviorCategory),
    training_status: normalizeTrainingStatus(m.trainingStatus),
    supervision_status: normalizeSupervisionStatus(m.supervisionStatus),
    equipment_type: str(m.equipmentType),
    cost_impact_band: normalizeCostImpactBand(m.costImpactBand),
    forecast_confidence: parseForecastConfidence(m.forecastConfidence),
    location_grid: str(m.locationGrid),
    crew_id: crewId,
    location_area: str(m.locationArea),
    time_of_day_band: str(m.timeOfDay),
    permit_status_summary: normalizePermitStatusSummary(m.permitStatus),
    ppe_status_summary: normalizePpeStatusSummary(m.ppeStatus),
    corrective_action_status: str(m.correctiveActionStatus),
    details:
      typeof m.details === "object" && m.details !== null && !Array.isArray(m.details)
        ? (m.details as Record<string, unknown>)
        : {},
  };
}

function mergeFacet(
  base: CompanyRiskMemoryFacetInsert,
  partial: Partial<CompanyRiskMemoryFacetInsert> | null
): CompanyRiskMemoryFacetInsert {
  if (!partial) return base;
  return {
    ...base,
    scope_of_work_code: partial.scope_of_work_code ?? base.scope_of_work_code,
    trade_code: partial.trade_code ?? base.trade_code,
    primary_hazard_code: partial.primary_hazard_code ?? base.primary_hazard_code,
    secondary_hazard_codes:
      partial.secondary_hazard_codes && partial.secondary_hazard_codes.length > 0
        ? partial.secondary_hazard_codes
        : base.secondary_hazard_codes,
    root_cause_level1: partial.root_cause_level1 ?? base.root_cause_level1,
    root_cause_level2: partial.root_cause_level2 ?? base.root_cause_level2,
    failed_control_code: partial.failed_control_code ?? base.failed_control_code,
    weather_condition_code: partial.weather_condition_code ?? base.weather_condition_code,
    potential_severity_code: partial.potential_severity_code ?? base.potential_severity_code,
    actual_outcome_severity_code: partial.actual_outcome_severity_code ?? base.actual_outcome_severity_code,
    contractor_label: partial.contractor_label ?? base.contractor_label,
    location_area: partial.location_area ?? base.location_area,
    time_of_day_band: partial.time_of_day_band ?? base.time_of_day_band,
    permit_status_summary: partial.permit_status_summary ?? base.permit_status_summary,
    ppe_status_summary: partial.ppe_status_summary ?? base.ppe_status_summary,
    corrective_action_status: partial.corrective_action_status ?? base.corrective_action_status,
    contractor_id: partial.contractor_id ?? base.contractor_id,
    behavior_category: partial.behavior_category ?? base.behavior_category,
    training_status: partial.training_status ?? base.training_status,
    supervision_status: partial.supervision_status ?? base.supervision_status,
    equipment_type: partial.equipment_type ?? base.equipment_type,
    cost_impact_band: partial.cost_impact_band ?? base.cost_impact_band,
    forecast_confidence: partial.forecast_confidence ?? base.forecast_confidence,
    location_grid: partial.location_grid ?? base.location_grid,
    crew_id: partial.crew_id ?? base.crew_id,
    details: { ...base.details, ...partial.details },
  };
}

export function buildIncidentFacetRow(
  companyId: string,
  incident: Record<string, unknown>,
  body: Record<string, unknown> | null | undefined
): CompanyRiskMemoryFacetInsert {
  const partial = parseRiskMemoryPayload(body ?? undefined);
  const exposure = normalizePrimaryHazardCode(incident.exposure_event_type);
  const base: CompanyRiskMemoryFacetInsert = {
    company_id: companyId,
    jobsite_id: str(incident.jobsite_id),
    source_module: "incident",
    source_id: String(incident.id),
    scope_of_work_code: null,
    trade_code: null,
    primary_hazard_code: exposure,
    secondary_hazard_codes: [],
    root_cause_level1: null,
    root_cause_level2: null,
    failed_control_code: null,
    weather_condition_code: null,
    potential_severity_code: potentialSeverityFromIncidentSeverity(String(incident.severity ?? "")),
    actual_outcome_severity_code: actualOutcomeFromIncidentCategory(String(incident.category ?? "")),
    contractor_label: null,
    location_area: null,
    time_of_day_band: str(incident.injury_time_of_day),
    permit_status_summary: null,
    ppe_status_summary: null,
    corrective_action_status: null,
    contractor_id: null,
    behavior_category: null,
    training_status: null,
    supervision_status: null,
    equipment_type: null,
    cost_impact_band: null,
    forecast_confidence: null,
    location_grid: null,
    crew_id: null,
    details: {},
  };
  return mergeFacet(base, partial);
}

export function buildCorrectiveActionFacetRow(
  companyId: string,
  row: Record<string, unknown>,
  body: Record<string, unknown> | null | undefined
): CompanyRiskMemoryFacetInsert {
  const partial = parseRiskMemoryPayload(body ?? undefined);
  const sifCat = str(row.sif_category);
  const fromSif = primaryHazardFromSifCategory(sifCat);
  const status = String(row.status ?? "").toLowerCase();
  const base: CompanyRiskMemoryFacetInsert = {
    company_id: companyId,
    jobsite_id: str(row.jobsite_id),
    source_module: "corrective_action",
    source_id: String(row.id),
    scope_of_work_code: null,
    trade_code: null,
    primary_hazard_code: fromSif,
    secondary_hazard_codes: [],
    root_cause_level1: null,
    root_cause_level2: null,
    failed_control_code: null,
    weather_condition_code: null,
    potential_severity_code: potentialSeverityFromIncidentSeverity(String(row.severity ?? "")),
    actual_outcome_severity_code: status === "verified_closed" ? "none" : "moderate_potential",
    contractor_label: null,
    location_area: null,
    time_of_day_band: null,
    permit_status_summary: null,
    ppe_status_summary: null,
    corrective_action_status: status || null,
    contractor_id: null,
    behavior_category: null,
    training_status: null,
    supervision_status: null,
    equipment_type: null,
    cost_impact_band: null,
    forecast_confidence: null,
    location_grid: null,
    crew_id: null,
    details: {
      observation_type: row.observation_type ?? null,
      category: row.category ?? null,
    },
  };
  return mergeFacet(base, partial);
}

export function buildPermitFacetRow(
  companyId: string,
  row: Record<string, unknown>,
  body: Record<string, unknown> | null | undefined
): CompanyRiskMemoryFacetInsert {
  const partial = parseRiskMemoryPayload(body ?? undefined);
  const base: CompanyRiskMemoryFacetInsert = {
    company_id: companyId,
    jobsite_id: str(row.jobsite_id),
    source_module: "permit",
    source_id: String(row.id),
    scope_of_work_code: null,
    trade_code: null,
    primary_hazard_code: null,
    secondary_hazard_codes: [],
    root_cause_level1: null,
    root_cause_level2: null,
    failed_control_code: null,
    weather_condition_code: null,
    potential_severity_code: potentialSeverityFromIncidentSeverity(String(row.severity ?? "")),
    actual_outcome_severity_code: null,
    contractor_label: null,
    location_area: null,
    time_of_day_band: null,
    permit_status_summary: permitStatusFromRow(String(row.status)),
    ppe_status_summary: null,
    corrective_action_status: null,
    contractor_id: null,
    behavior_category: null,
    training_status: null,
    supervision_status: null,
    equipment_type: null,
    cost_impact_band: null,
    forecast_confidence: null,
    location_grid: null,
    crew_id: null,
    details: {
      permit_type: row.permit_type ?? null,
      stop_work_status: row.stop_work_status ?? null,
      sif_flag: row.sif_flag ?? null,
      title: row.title ?? null,
    },
  };
  return mergeFacet(base, partial);
}

export function buildSorRecordFacetRow(companyId: string, row: Record<string, unknown>): CompanyRiskMemoryFacetInsert {
  const rawHazard = String(row.hazard_category_code ?? "").trim().toLowerCase();
  const sorCode = isSorHazardCategoryCode(rawHazard) ? (rawHazard as SorHazardCategoryCode) : null;
  const primary = sorCode ? SOR_HAZARD_TO_EXPOSURE_EVENTS[sorCode][0] : null;
  const tradeCode = normalizeTradeCode(row.trade);

  const base: CompanyRiskMemoryFacetInsert = {
    company_id: companyId,
    jobsite_id: null,
    source_module: "sor_record",
    source_id: String(row.id),
    scope_of_work_code: null,
    trade_code: tradeCode,
    primary_hazard_code: primary,
    secondary_hazard_codes: [],
    root_cause_level1: null,
    root_cause_level2: null,
    failed_control_code: null,
    weather_condition_code: null,
    potential_severity_code: potentialSeverityFromIncidentSeverity(String(row.severity ?? "")),
    actual_outcome_severity_code: null,
    contractor_label: null,
    location_area: str(row.location),
    time_of_day_band: null,
    permit_status_summary: null,
    ppe_status_summary: null,
    corrective_action_status: null,
    contractor_id: null,
    behavior_category: null,
    training_status: null,
    supervision_status: null,
    equipment_type: null,
    cost_impact_band: null,
    forecast_confidence: null,
    location_grid: null,
    crew_id: null,
    details: {
      sor_hazard_category_code: row.hazard_category_code ?? null,
      project: row.project ?? null,
      category: row.category ?? null,
    },
  };
  return base;
}

export function buildJsaActivityFacetRow(
  companyId: string,
  row: Record<string, unknown>,
  body: Record<string, unknown> | null | undefined
): CompanyRiskMemoryFacetInsert {
  const partial = parseRiskMemoryPayload(body ?? undefined);
  const tradeRaw = str(row.trade);
  const tradeCode = normalizeTradeCode(tradeRaw) ?? null;
  const hazardText = str(row.hazard_category);
  const primaryFromJsa = hazardText ? normalizePrimaryHazardCode(hazardText.replace(/[/\s-]+/g, "_")) : null;
  const base: CompanyRiskMemoryFacetInsert = {
    company_id: companyId,
    jobsite_id: str(row.jobsite_id),
    source_module: "jsa_activity",
    source_id: String(row.id),
    scope_of_work_code: null,
    trade_code: tradeCode,
    primary_hazard_code: primaryFromJsa,
    secondary_hazard_codes: [],
    root_cause_level1: null,
    root_cause_level2: null,
    failed_control_code: null,
    weather_condition_code: null,
    potential_severity_code: null,
    actual_outcome_severity_code: null,
    contractor_label: null,
    location_area: str(row.area),
    time_of_day_band: null,
    permit_status_summary: row.permit_required === true ? "unknown" : "not_required",
    ppe_status_summary: null,
    corrective_action_status: null,
    contractor_id: null,
    behavior_category: null,
    training_status: null,
    supervision_status: null,
    equipment_type: null,
    cost_impact_band: null,
    forecast_confidence: null,
    location_grid: null,
    crew_id: null,
    details: {
      activity_name: row.activity_name ?? null,
      trade_raw: tradeRaw,
    },
  };
  return mergeFacet(base, partial);
}

export async function upsertRiskMemoryFacet(
  supabase: SupabaseClient,
  row: CompanyRiskMemoryFacetInsert
): Promise<{ ok: boolean; error?: string }> {
  let contractor_id: string | null = row.contractor_id ?? null;
  if (contractor_id) {
    contractor_id = await resolveContractorIdForCompany(supabase, row.company_id, contractor_id);
  }

  let crew_id: string | null = row.crew_id ?? null;
  if (crew_id) {
    crew_id = await resolveCrewIdForCompany(supabase, row.company_id, row.jobsite_id, crew_id);
  }

  const payload = {
    company_id: row.company_id,
    jobsite_id: row.jobsite_id,
    source_module: row.source_module,
    source_id: row.source_id,
    scope_of_work_code: row.scope_of_work_code,
    trade_code: row.trade_code,
    primary_hazard_code: row.primary_hazard_code,
    secondary_hazard_codes: row.secondary_hazard_codes,
    root_cause_level1: row.root_cause_level1,
    root_cause_level2: row.root_cause_level2,
    failed_control_code: row.failed_control_code,
    weather_condition_code: row.weather_condition_code,
    potential_severity_code: row.potential_severity_code,
    actual_outcome_severity_code: row.actual_outcome_severity_code,
    contractor_label: row.contractor_label,
    contractor_id,
    crew_id,
    behavior_category: row.behavior_category,
    training_status: row.training_status,
    supervision_status: row.supervision_status,
    equipment_type: row.equipment_type,
    cost_impact_band: row.cost_impact_band,
    forecast_confidence: row.forecast_confidence,
    location_grid: row.location_grid,
    location_area: row.location_area,
    time_of_day_band: row.time_of_day_band,
    permit_status_summary: row.permit_status_summary,
    ppe_status_summary: row.ppe_status_summary,
    corrective_action_status: row.corrective_action_status,
    details: row.details,
  };

  const { error } = await supabase.from("company_risk_memory_facets").upsert(payload, {
    onConflict: "company_id,source_module,source_id",
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.toLowerCase().includes("company_risk_memory_facets") || msg.toLowerCase().includes("schema cache")) {
      serverLog("warn", "risk_memory_facet_upsert_skipped", {
        companyId: row.company_id,
        sourceModule: row.source_module,
        message: msg.slice(0, 200),
      });
    } else {
      serverLog("warn", "risk_memory_facet_upsert_failed", {
        companyId: row.company_id,
        sourceModule: row.source_module,
        message: msg.slice(0, 200),
      });
    }
    return { ok: false, error: msg };
  }

  return { ok: true };
}

export async function upsertRiskMemoryFacetSafe(
  supabase: SupabaseClient,
  row: CompanyRiskMemoryFacetInsert
): Promise<void> {
  await upsertRiskMemoryFacet(supabase, row);
}
