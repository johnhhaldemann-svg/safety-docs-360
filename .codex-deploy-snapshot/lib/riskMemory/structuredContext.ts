import type { SupabaseClient } from "@supabase/supabase-js";
import {
  baselineWeatherAugmentationPoints,
  fetchRiskBaselineProfiles,
  matchBaselinesForTopPatterns,
} from "@/lib/riskMemory/baseline";
import { aggregateFacetScores, riskBandFromScore, type FacetScoreInput } from "@/lib/riskMemory/score";

export type RiskMemoryStructuredContext = {
  engine: "Safety360 Risk Memory Engine";
  windowDays: number;
  facetCount: number;
  topScopes: Array<{ code: string | null; count: number }>;
  topHazards: Array<{ code: string | null; count: number }>;
  /** Non-empty `location_grid` values from facets (map / grid refs). */
  topLocationGrids: Array<{ label: string; count: number }>;
  /** Non-empty free-text `location_area` values. */
  topLocationAreas: Array<{ label: string; count: number }>;
  openCorrectiveFacetHints: { openStyleStatuses: number };
  aggregated: ReturnType<typeof aggregateFacetScores>;
  /** Industry baseline rows whose scope+hazard match top company patterns. */
  baselineHints: Array<{
    scope_code: string;
    hazard_code: string;
    signals: Record<string, unknown>;
  }>;
  /** Facet rollup score + baseline weather-sensitivity adjustment (capped). */
  aggregatedWithBaseline: { score: number; band: ReturnType<typeof riskBandFromScore> };
  /**
   * Heuristic 0–1: how much to trust this rollup as a “forecast” of emphasis (score + sample size).
   * Not a clinical prediction; complements optional manual `forecast_confidence` on facets.
   */
  derivedRollupConfidence: number;
};

function isMissingFacetsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_risk_memory_facets");
}

const FACET_SELECT_WITH_LOCATION =
  "scope_of_work_code, primary_hazard_code, failed_control_code, weather_condition_code, potential_severity_code, corrective_action_status, source_module, updated_at, location_grid, location_area";

const FACET_SELECT_BASE =
  "scope_of_work_code, primary_hazard_code, failed_control_code, weather_condition_code, potential_severity_code, corrective_action_status, source_module, updated_at";

function shouldRetryFacetSelectWithoutLocationColumns(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  if (m.includes("location_grid") || m.includes("location_area")) return true;
  if (m.includes("column") && m.includes("does not exist")) return true;
  return false;
}

async function fetchCompanyRiskFacetRows(
  supabase: SupabaseClient,
  companyId: string,
  since: string,
  jobsiteId?: string | null
): Promise<{ data: unknown[] | null; error: { message?: string | null } | null }> {
  let query = supabase
    .from("company_risk_memory_facets")
    .select(FACET_SELECT_WITH_LOCATION)
    .eq("company_id", companyId)
    .gte("updated_at", since);
  if (jobsiteId) {
    query = query.eq("jobsite_id", jobsiteId);
  }
  const first = await query;
  if (!first.error) {
    return { data: (first.data ?? []) as unknown[], error: null };
  }
  if (isMissingFacetsTable(first.error.message)) {
    return { data: null, error: first.error };
  }
  if (shouldRetryFacetSelectWithoutLocationColumns(first.error.message)) {
    let q2 = supabase
      .from("company_risk_memory_facets")
      .select(FACET_SELECT_BASE)
      .eq("company_id", companyId)
      .gte("updated_at", since);
    if (jobsiteId) {
      q2 = q2.eq("jobsite_id", jobsiteId);
    }
    const second = await q2;
    if (second.error) {
      if (isMissingFacetsTable(second.error.message)) return { data: null, error: second.error };
      return { data: null, error: second.error };
    }
    return { data: (second.data ?? []) as unknown[], error: null };
  }
  return { data: null, error: first.error };
}

export async function buildRiskMemoryStructuredContext(
  supabase: SupabaseClient,
  companyId: string,
  options?: { days?: number; jobsiteId?: string | null }
): Promise<RiskMemoryStructuredContext | null> {
  const days = Math.min(Math.max(options?.days ?? 90, 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await fetchCompanyRiskFacetRows(supabase, companyId, since, options?.jobsiteId);
  if (error) {
    if (isMissingFacetsTable(error.message)) return null;
    return null;
  }
  const rows = data ?? [];
  const scopeCounts = new Map<string | null, number>();
  const hazardCounts = new Map<string | null, number>();
  const gridCounts = new Map<string, number>();
  const areaCounts = new Map<string, number>();
  let openStyleStatuses = 0;
  const scoreInputs: FacetScoreInput[] = [];

  for (const r of rows as Array<Record<string, unknown>>) {
    const scope = (r.scope_of_work_code as string | null) ?? null;
    scopeCounts.set(scope, (scopeCounts.get(scope) ?? 0) + 1);
    const haz = (r.primary_hazard_code as string | null) ?? null;
    hazardCounts.set(haz, (hazardCounts.get(haz) ?? 0) + 1);
    const grid = String(r.location_grid ?? "").trim();
    if (grid) gridCounts.set(grid, (gridCounts.get(grid) ?? 0) + 1);
    const area = String(r.location_area ?? "").trim();
    if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    const st = String(r.corrective_action_status ?? "").toLowerCase();
    if (st && st !== "verified_closed") openStyleStatuses += 1;
    scoreInputs.push({
      scope_of_work_code: scope,
      weather_condition_code: r.weather_condition_code as string | null,
      failed_control_code: r.failed_control_code as string | null,
      potential_severity_code: r.potential_severity_code as string | null,
    });
  }

  const topScopes = Array.from(scopeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));
  const topHazards = Array.from(hazardCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  const topLocationGrids = Array.from(gridCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));
  const topLocationAreas = Array.from(areaCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  const aggregated = aggregateFacetScores(scoreInputs);
  const baselines = await fetchRiskBaselineProfiles(supabase);
  const matchedBaselines = matchBaselinesForTopPatterns(baselines, topScopes, topHazards);
  const baselineAdjustment = baselineWeatherAugmentationPoints(matchedBaselines);
  const augmentedRaw = Math.min(24, aggregated.score + baselineAdjustment);
  const aggregatedWithBaseline = {
    score: Math.round(augmentedRaw * 10) / 10,
    band: riskBandFromScore(augmentedRaw),
  };

  const scoreNorm = Math.min(1, augmentedRaw / 24);
  const n = rows.length;
  const sampleFactor = n <= 0 ? 0 : Math.min(1, n / 40);
  const derivedRaw = 0.28 + 0.38 * scoreNorm + 0.34 * sampleFactor;
  const derivedRollupConfidence = Math.round(Math.min(0.9, Math.max(0.2, derivedRaw)) * 100) / 100;

  return {
    engine: "Safety360 Risk Memory Engine",
    windowDays: days,
    facetCount: rows.length,
    topScopes,
    topHazards,
    topLocationGrids,
    topLocationAreas,
    openCorrectiveFacetHints: { openStyleStatuses: openStyleStatuses },
    aggregated,
    baselineHints: matchedBaselines.map((b) => ({
      scope_code: b.scope_code,
      hazard_code: b.hazard_code,
      signals: (b.signals ?? {}) as Record<string, unknown>,
    })),
    aggregatedWithBaseline,
    derivedRollupConfidence,
  };
}

/** Merge Risk Memory summary into client-provided JSON context for AI assist. */
export async function augmentStructuredContextWithRiskMemory(
  supabase: SupabaseClient,
  companyId: string,
  surface: string,
  existingContext: string | null | undefined
): Promise<string | null> {
  const surfaces = new Set([
    "dashboard",
    "incidents",
    "permits",
    "jsa",
    "corrective_actions",
    "risk_memory",
  ]);
  if (!surfaces.has(surface.trim().toLowerCase())) {
    return existingContext ?? null;
  }
  const summary = await buildRiskMemoryStructuredContext(supabase, companyId, { days: 90 });
  if (!summary) {
    return existingContext ?? null;
  }
  let base: Record<string, unknown> = {};
  if (existingContext?.trim()) {
    try {
      const parsed = JSON.parse(existingContext) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch {
      base = { clientContext: existingContext.slice(0, 2000) };
    }
  }
  return JSON.stringify({
    ...base,
    riskMemoryEngine: summary,
  });
}
