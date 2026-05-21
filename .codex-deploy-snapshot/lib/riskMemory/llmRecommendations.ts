import { requestAiResponsesText, type AiExecutionMeta } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import type { RiskRecommendationDraft } from "@/lib/riskMemory/recommendations";
import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { serverLog } from "@/lib/serverLog";

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return t;
}

function clampConfidence(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0.55;
  return Math.min(1, Math.max(0.2, x));
}

/**
 * Parse model output into recommendation drafts. Returns empty on failure.
 */
export function parseRecommendationDraftsFromModelText(text: string): RiskRecommendationDraft[] {
  const raw = stripJsonFence(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: RiskRecommendationDraft[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    const body = String(o.body ?? "").trim();
    if (!title || !body) continue;
    const kind = String(o.kind ?? "llm_insight").trim().slice(0, 64) || "llm_insight";
    out.push({
      kind,
      title: title.slice(0, 200),
      body: body.slice(0, 2000),
      confidence: clampConfidence(o.confidence),
    });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * OpenAI Responses API — structured JSON array of recommendations from Risk Memory summary only.
 */
export async function buildLlmRiskRecommendations(
  ctx: RiskMemoryStructuredContext | null
): Promise<{ drafts: RiskRecommendationDraft[]; error?: string; meta?: AiExecutionMeta }> {
  if (!ctx) {
    return { drafts: [], error: "no_context" };
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { drafts: [], error: "no_openai_key" };
  }

  const model =
    process.env.RISK_MEMORY_LLM_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel("gpt-4o-mini");

  const summary = {
    facetCount: ctx.facetCount,
    windowDays: ctx.windowDays,
    band: ctx.aggregatedWithBaseline.band,
    score: ctx.aggregatedWithBaseline.score,
    topScopes: ctx.topScopes,
    topHazards: ctx.topHazards,
    topLocationGrids: ctx.topLocationGrids,
    topLocationAreas: ctx.topLocationAreas,
    openCorrectiveStyleRows: ctx.openCorrectiveFacetHints.openStyleStatuses,
    baselineMatchCount: ctx.baselineHints.length,
    derivedRollupConfidence: ctx.derivedRollupConfidence,
  };

  const system = [
    "You are a construction safety program advisor.",
    "You receive ONLY a JSON summary of a company's Risk Memory facet rollups (no raw incident narratives).",
    "Return ONLY a JSON array (no markdown fences) of 3 to 6 objects.",
    'Each object must have: "kind" (short snake_case string), "title" (max 12 words), "body" (2-4 sentences, practical), "confidence" (number 0.2-0.95).',
    "Do not invent counts beyond the summary. If facetCount is 0, return an empty array [].",
    "Focus on prioritization, field verification, and control themes implied by top hazards and scopes.",
  ].join(" ");

  const user = `Risk Memory summary (JSON):\n${JSON.stringify(summary)}`;

  try {
    const response = await requestAiResponsesText({
      apiKey,
      model,
      input: `${system}\n\n---\n\n${user}`,
      surface: "risk-memory.llm-recommendations",
    });

    if (!response.text) {
      serverLog("warn", "risk_memory_llm_recommendations_http", {
        model: response.meta.model,
      });
      return { drafts: [], error: "openai_http", meta: response.meta };
    }
    const drafts = parseRecommendationDraftsFromModelText(response.text);
    return { drafts, meta: response.meta };
  } catch (e) {
    serverLog("warn", "risk_memory_llm_recommendations_exception", {
      message: e instanceof Error ? e.message.slice(0, 160) : "unknown",
    });
    return { drafts: [], error: "exception" };
  }
}
