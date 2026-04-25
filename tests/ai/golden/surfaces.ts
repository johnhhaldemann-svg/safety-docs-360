/**
 * Adapter map: surface name -> async function that takes a fixture's `input`,
 * invokes the production AI codepath, and returns the model output object that
 * the assertions run against.
 *
 * Adding a new surface: drop a new sibling directory under `tests/ai/golden/`
 * and register a matching adapter here. Each adapter SHOULD invoke the actual
 * production function so a regression in retries / prompt / parsing trips the
 * eval.
 *
 * Adapters MUST NOT need a database connection — fixtures supply pre-built
 * structured inputs so the harness stays hermetic against the OpenAI key only.
 */

import { buildLlmRiskRecommendations } from "@/lib/riskMemory/llmRecommendations";
import { generateGcProgramAiReview } from "@/lib/gcProgramAiReview";
import { runStructuredAiJsonTask } from "@/lib/ai/responses";
import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";

export type AiEvalAdapter = (input: unknown) => Promise<unknown>;

const adapters: Record<string, AiEvalAdapter> = {
  "gc-program.review": async (input) => {
    const params = input as Parameters<typeof generateGcProgramAiReview>[0];
    return generateGcProgramAiReview(params);
  },

  "risk-memory.llm-recommendations": async (input) => {
    return buildLlmRiskRecommendations(input as RiskMemoryStructuredContext | null);
  },

  /**
   * Generic Responses-API JSON adapter. Lets fixtures cover any logical surface
   * (e.g. "safety-intelligence.document.draft", "company-memory.assist") by
   * specifying the same `system` / `user` / `fallback` shape the real call
   * sites use, without needing the upstream Supabase scaffolding. Output is the
   * `parsed` JSON the model returned.
   */
  "responses-api.json": async (input) => {
    const params = input as {
      system: string;
      user: string;
      fallbackModel?: string;
      modelEnv?: string | null;
      fallback?: unknown;
      surface?: string;
    };
    const result = await runStructuredAiJsonTask<unknown>({
      system: params.system,
      user: params.user,
      fallbackModel: params.fallbackModel ?? "gpt-4o-mini",
      modelEnv: params.modelEnv ?? null,
      fallback: params.fallback ?? null,
      surface: params.surface ?? "ai-eval.responses-api.json",
    });
    return { parsed: result.parsed, model: result.meta.model, fallbackUsed: result.meta.fallbackUsed };
  },
};

export function getAiEvalAdapter(surface: string): AiEvalAdapter | null {
  return adapters[surface] ?? null;
}

export function listAiEvalSurfaces(): string[] {
  return Object.keys(adapters);
}
