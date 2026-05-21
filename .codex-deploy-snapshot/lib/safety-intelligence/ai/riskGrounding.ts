import type { JsonObject, PreventionScore, RiskBand, RiskOutputRecord } from "@/types/safety-intelligence";

const RISK_BANDS: RiskBand[] = ["low", "moderate", "high", "critical"];

function isRiskBand(value: unknown): value is RiskBand {
  return typeof value === "string" && (RISK_BANDS as string[]).includes(value);
}

function rollupFromMemory(riskMemorySummary: JsonObject | null | undefined): {
  score: number;
  band: RiskBand;
  confidence?: number;
} | null {
  if (!riskMemorySummary || typeof riskMemorySummary !== "object") return null;
  const withBaseline = riskMemorySummary.aggregatedWithBaseline;
  const base = riskMemorySummary.aggregated;
  const pick = withBaseline && typeof withBaseline === "object" ? withBaseline : base;
  if (!pick || typeof pick !== "object") return null;
  const score = (pick as { score?: unknown }).score;
  const band = (pick as { band?: unknown }).band;
  if (typeof score !== "number" || !isRiskBand(band)) return null;
  const confRaw = riskMemorySummary.derivedRollupConfidence;
  const confidence = typeof confRaw === "number" ? confRaw : undefined;
  return { score, band, confidence };
}

/**
 * Map facet rollup score (0–24 scale in engine) to a 0–100 prevention headline.
 */
export function preventionScoreFromRollup(score: number, band: RiskBand, confidence?: number): PreventionScore {
  const normalized = Math.min(100, Math.max(0, (score / 24) * 100));
  return {
    value: Math.round(normalized * 10) / 10,
    scale: "0-100",
    band,
    confidence,
    source: "risk_memory",
  };
}

/**
 * When Risk Memory facets exist, prepend canonical rollup scores and attach prevention headline.
 */
export function mergeRiskOutputWithRiskMemory(
  record: RiskOutputRecord,
  riskMemorySummary: JsonObject | null | undefined
): RiskOutputRecord {
  const canonical = rollupFromMemory(riskMemorySummary ?? null);
  if (!canonical) {
    return {
      ...record,
      riskScoresNote: record.riskScoresNote ?? null,
    };
  }

  const preventionScore = preventionScoreFromRollup(canonical.score, canonical.band, canonical.confidence);

  const rollupRow = {
    scope: "risk_memory_rollup",
    score: canonical.score,
    band: canonical.band,
  };

  const others = record.riskScores.filter((row) => row.scope !== "risk_memory_rollup");
  const riskScores = [rollupRow, ...others];

  return {
    ...record,
    riskScores,
    preventionScore,
    canonicalRiskFromMemory: {
      score: canonical.score,
      band: canonical.band,
      confidence: canonical.confidence,
    },
    riskScoresNote:
      "First riskScores entry with scope risk_memory_rollup is the deterministic Risk Memory rollup when facet data exists; additional rows may reflect rules buckets or model output.",
  };
}
