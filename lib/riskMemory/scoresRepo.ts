/**
 * `public.company_risk_scores` (created in 20260415123000_safety_intelligence_platform.sql)
 * was dormant — schema existed but no app code wrote/read it. This module
 * activates the company-scope row (one per company per day) so the Analytics
 * page can render a 30-day trend without recomputing from facets at read time.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskBand } from "@/lib/riskMemory/score";
import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";

export type CompanyRiskScorePoint = {
  scoreDate: string;
  score: number;
  band: RiskBand;
  windowDays: number;
  components: Record<string, unknown>;
  trendHints: Record<string, unknown>;
};

function buildComponents(ctx: RiskMemoryStructuredContext) {
  return {
    facetCount: ctx.facetCount,
    baselineScore: ctx.aggregated.score,
    baselineBand: ctx.aggregated.band,
    baselineMatchCount: ctx.baselineHints.length,
    derivedRollupConfidence: ctx.derivedRollupConfidence,
    topScopeCodes: ctx.topScopes.slice(0, 5).map((row) => row.code).filter(Boolean),
    topHazardCodes: ctx.topHazards.slice(0, 5).map((row) => row.code).filter(Boolean),
    openCorrectiveStyleStatuses: ctx.openCorrectiveFacetHints.openStyleStatuses,
  } as Record<string, unknown>;
}

function buildTrendHints(ctx: RiskMemoryStructuredContext) {
  return {
    score: ctx.aggregatedWithBaseline?.score ?? ctx.aggregated.score,
    band: ctx.aggregatedWithBaseline?.band ?? ctx.aggregated.band,
    sampleSize: ctx.aggregated.sampleSize,
  } as Record<string, unknown>;
}

/**
 * Upsert one company-scope row for `score_date` (default today). Idempotent via the
 * partial unique index on (company_id, score_date) for the `company` scope.
 */
export async function upsertCompanyRiskScoreFromContext(params: {
  admin: SupabaseClient;
  companyId: string;
  ctx: RiskMemoryStructuredContext;
  scoreDate?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const scoreDate = params.scoreDate ?? new Date().toISOString().slice(0, 10);
  const score = params.ctx.aggregatedWithBaseline?.score ?? params.ctx.aggregated.score;
  const band = params.ctx.aggregatedWithBaseline?.band ?? params.ctx.aggregated.band;

  const row = {
    company_id: params.companyId,
    jobsite_id: null,
    bucket_run_id: null,
    bucket_item_id: null,
    score_scope: "company",
    score: Number(score.toFixed(2)),
    band,
    score_date: scoreDate,
    score_window_days: params.ctx.windowDays,
    trade_code: null,
    task_code: null,
    work_area_id: null,
    components: buildComponents(params.ctx),
    trend_hints: buildTrendHints(params.ctx),
    created_by: null,
  };

  const res = await params.admin
    .from("company_risk_scores")
    .upsert(row, { onConflict: "company_id,score_date" });

  if (res.error) {
    return { ok: false, error: res.error.message ?? "company_risk_scores_upsert_failed" };
  }
  return { ok: true };
}

/**
 * Load a chronological company-scope trend (oldest first). Caps at 365 days.
 * Returns an empty array on missing-table errors so callers can degrade gracefully.
 */
export async function loadCompanyRiskScoreTrend(params: {
  supabase: SupabaseClient;
  companyId: string;
  days: number;
}): Promise<CompanyRiskScorePoint[]> {
  const days = Math.max(1, Math.min(365, Math.floor(params.days)));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const res = await params.supabase
    .from("company_risk_scores")
    .select("score_date, score, band, score_window_days, components, trend_hints")
    .eq("company_id", params.companyId)
    .eq("score_scope", "company")
    .is("jobsite_id", null)
    .is("bucket_run_id", null)
    .is("bucket_item_id", null)
    .gte("score_date", since)
    .order("score_date", { ascending: true });

  if (res.error) {
    const msg = (res.error.message ?? "").toLowerCase();
    if (msg.includes("company_risk_scores") || msg.includes("schema cache")) {
      return [];
    }
    return [];
  }

  const rows = (res.data ?? []) as Array<{
    score_date: string;
    score: number | string;
    band: RiskBand;
    score_window_days: number;
    components: Record<string, unknown> | null;
    trend_hints: Record<string, unknown> | null;
  }>;

  return rows.map((row) => ({
    scoreDate: String(row.score_date),
    score: typeof row.score === "string" ? Number(row.score) : row.score,
    band: row.band,
    windowDays: row.score_window_days,
    components: row.components ?? {},
    trendHints: row.trend_hints ?? {},
  }));
}

/** Delta between latest score and first score in the trend. Null when trend has < 2 points. */
export function summarizeTrendDelta(points: CompanyRiskScorePoint[]): {
  latest: CompanyRiskScorePoint | null;
  earliest: CompanyRiskScorePoint | null;
  deltaScore: number | null;
  direction: "up" | "down" | "flat" | null;
} {
  if (points.length === 0) {
    return { latest: null, earliest: null, deltaScore: null, direction: null };
  }
  const earliest = points[0];
  const latest = points[points.length - 1];
  if (points.length === 1) {
    return { latest, earliest, deltaScore: null, direction: null };
  }
  const delta = Number((latest.score - earliest.score).toFixed(2));
  const direction = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
  return { latest, earliest, deltaScore: delta, direction };
}
