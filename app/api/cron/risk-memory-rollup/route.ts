import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runRiskMemoryCronJob } from "@/lib/riskMemory/cronRollup";

export const runtime = "nodejs";

/** Many companies × context build; raise on Pro if timeouts occur. */
export const maxDuration = 120;

/**
 * Daily rollup: `company_risk_memory_snapshots` per company (service role).
 * Query: `recommendations=1` — also insert rule-based rows (7-day title dedupe).
 * Query: `llm=1` — also call the LLM path for the eligible subset (env-flag/allowlist
 *                  also enables it; capped by RISK_MEMORY_LLM_CRON_MAX_COMPANIES).
 * Query: `days=` — facet window (default 90).
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeRecommendations = url.searchParams.get("recommendations") === "1";
  const includeLlmRecommendations = url.searchParams.get("llm") === "1";
  const daysRaw = Number(url.searchParams.get("days") ?? "90");
  const windowDays = Number.isFinite(daysRaw) ? daysRaw : 90;

  const result = await runRiskMemoryCronJob({
    windowDays,
    includeRecommendations,
    includeLlmRecommendations,
  });

  if (result.error && !result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    snapshotDate: result.snapshotDate,
    snapshotUpserts: result.snapshotUpserts,
    riskScoreUpserts: result.riskScoreUpserts,
    riskScoreFailed: result.riskScoreFailed,
    recommendationsInserted: result.recommendationsInserted,
    llmRecommendationsInserted: result.llmRecommendationsInserted,
    llmCompaniesProcessed: result.llmCompaniesProcessed,
    llmCompaniesFailed: result.llmCompaniesFailed,
    llmEnabled: result.llmEnabled,
    companiesSkipped: result.companiesSkipped,
    companiesFailed: result.companiesFailed,
    companiesSeen: result.companiesSeen,
    includeRecommendations,
    includeLlmRecommendations,
  });
}
