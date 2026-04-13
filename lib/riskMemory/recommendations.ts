import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";

export type RiskRecommendationDraft = {
  kind: string;
  title: string;
  body: string;
  confidence: number;
};

function hasFallishHazard(ctx: RiskMemoryStructuredContext): boolean {
  return ctx.topHazards.some((h) => {
    const c = String(h.code ?? "").toLowerCase();
    return c.includes("fall") || c.includes("height") || c.includes("elev");
  });
}

/**
 * Deterministic, rule-based recommendations (no LLM). Safe for storage and dashboards.
 */
export function buildRuleBasedRiskRecommendations(ctx: RiskMemoryStructuredContext | null): RiskRecommendationDraft[] {
  if (!ctx) return [];
  const out: RiskRecommendationDraft[] = [];
  const band = ctx.aggregatedWithBaseline?.band ?? ctx.aggregated.band;

  if (band === "high" || band === "critical") {
    out.push({
      kind: "escalation_review",
      title: "Review elevated risk memory score",
      body: `Rollup band is ${band} (score ${ctx.aggregatedWithBaseline?.score ?? ctx.aggregated.score}). Prioritize leadership review of top scopes and hazards, and confirm controls on active work.`,
      confidence: 0.78,
    });
  }

  const open = ctx.openCorrectiveFacetHints?.openStyleStatuses ?? 0;
  if (open >= 4) {
    out.push({
      kind: "corrective_backlog",
      title: "Tighten corrective-action closure",
      body: `${open} facet rows still reference non-closed corrective styles. Focus on verifying closures and updating status so risk memory stays accurate.`,
      confidence: 0.7,
    });
  }

  if (hasFallishHazard(ctx)) {
    out.push({
      kind: "fall_protection",
      title: "Reinforce fall protection where exposure is frequent",
      body: "Fall-related exposure codes appear in your top hazard patterns. Confirm guardrails, PFAS, and rescue plans for recurring scopes.",
      confidence: 0.66,
    });
  }

  if (ctx.baselineHints.length > 0) {
    out.push({
      kind: "baseline_alignment",
      title: "Cross-check industry baseline signals",
      body: `Matched ${ctx.baselineHints.length} baseline scope+hazard pattern(s). Compare controls and training to those profiles when planning work.`,
      confidence: 0.62,
    });
  }

  if (ctx.facetCount > 0 && ctx.facetCount < 5) {
    out.push({
      kind: "coverage",
      title: "Grow structured risk memory coverage",
      body: "Few facet rows in the window. Encourage teams to complete optional Risk Memory fields on incidents and field observations.",
      confidence: 0.55,
    });
  }

  const grids = ctx.topLocationGrids ?? [];
  if (grids.length >= 2) {
    const labels = grids
      .slice(0, 4)
      .map((g) => g.label)
      .join(", ");
    out.push({
      kind: "location_hotspot",
      title: "Review recurring grid / map locations",
      body: `Multiple facets reference location grids such as: ${labels}. Consider walk-downs or focused briefings where these labels cluster.`,
      confidence: 0.58,
    });
  }

  return out.slice(0, 8);
}
