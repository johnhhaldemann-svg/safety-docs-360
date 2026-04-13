import type { SupabaseClient } from "@supabase/supabase-js";

export type RiskBaselineProfileRow = {
  id: string;
  scope_code: string;
  hazard_code: string;
  trade_code: string;
  signals: Record<string, unknown>;
};

function isMissingBaselineTable(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return m.includes("risk_baseline_profiles") || m.includes("schema cache");
}

export async function fetchRiskBaselineProfiles(
  supabase: SupabaseClient
): Promise<RiskBaselineProfileRow[]> {
  const { data, error } = await supabase
    .from("risk_baseline_profiles")
    .select("id, scope_code, hazard_code, trade_code, signals");
  if (error) {
    if (isMissingBaselineTable(error.message)) return [];
    return [];
  }
  return (data ?? []) as RiskBaselineProfileRow[];
}

/**
 * Match global baseline rows when both scope and hazard appear in the company's top facet lists.
 */
export function matchBaselinesForTopPatterns(
  baselines: RiskBaselineProfileRow[],
  topScopes: Array<{ code: string | null; count: number }>,
  topHazards: Array<{ code: string | null; count: number }>
): RiskBaselineProfileRow[] {
  const scopeSet = new Set(
    topScopes.map((s) => s.code).filter((c): c is string => Boolean(c))
  );
  const hazardSet = new Set(
    topHazards.map((h) => h.code).filter((c): c is string => Boolean(c))
  );
  if (scopeSet.size === 0 || hazardSet.size === 0) return [];

  const seen = new Set<string>();
  const out: RiskBaselineProfileRow[] = [];
  for (const b of baselines) {
    if (b.trade_code && b.trade_code !== "") continue;
    if (!scopeSet.has(b.scope_code) || !hazardSet.has(b.hazard_code)) continue;
    const k = `${b.scope_code}:${b.hazard_code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

export function baselineWeatherAugmentationPoints(matched: RiskBaselineProfileRow[]): number {
  let add = 0;
  for (const row of matched) {
    const ws = row.signals?.weather_sensitivity;
    if (ws === "high") add += 0.5;
  }
  return Math.min(3, add);
}
