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
import { generateFieldAuditAiReview } from "@/lib/fieldAudits/aiReview";
import { injuryWeatherWebResearchSupplement } from "@/lib/injuryWeather/sparseDataWebResearch";
import { buildAiEngineRecommendationCandidates } from "@/lib/superadmin/aiEngineOperations";
import {
  SITE_VISUAL_SCENE_JSON_SCHEMA,
  buildFallbackSiteVisualScene,
  buildSiteVisualAiPrompt,
  validateSiteVisualScene,
  type SiteVisualGenerationInput,
} from "@/lib/jobsiteSiteVisual";
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

  "injury-weather.insights": async (input) => {
    const params = input as {
      system: string;
      user: string;
      fallback?: unknown;
      schema?: Record<string, unknown>;
    };
    const result = await runStructuredAiJsonTask<unknown>({
      system: params.system,
      user: params.user,
      fallbackModel: "gpt-4o-mini",
      fallback: params.fallback ?? null,
      surface: "injury-weather.insights",
      promptVersion: "eval-injury-weather-insights-v1",
      outputSchemaVersion: "eval-injury-weather-insights-v1",
      body: params.schema
        ? {
            text: {
              format: {
                type: "json_schema",
                name: "eval_injury_weather_insights",
                schema: params.schema,
              },
            },
          }
        : undefined,
    });
    return { parsed: result.parsed, model: result.meta.model, fallbackUsed: result.meta.fallbackUsed };
  },

  "injury-weather.sparse-web-research": async (input) => {
    return injuryWeatherWebResearchSupplement(input as Parameters<typeof injuryWeatherWebResearchSupplement>[0]);
  },

  "training-records.photo-extract": async (input) => {
    const params = input as {
      visibleText: string;
      fallback?: unknown;
    };
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        provider: { type: "string" },
        completedOn: { type: "string" },
        expiresOn: { type: "string" },
        notes: { type: "string" },
        confidence: { type: "number" },
        evidence: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
      },
      required: ["title", "provider", "completedOn", "expiresOn", "notes", "confidence", "evidence"],
    } as const;
    const result = await runStructuredAiJsonTask<unknown>({
      system:
        "Extract construction safety training record fields from the provided visible certificate text. Return strict JSON only and do not invent fields.",
      user: params.visibleText,
      fallbackModel: "gpt-4o-mini",
      fallback: params.fallback ?? null,
      surface: "training-records.photo-extract",
      promptVersion: "eval-training-photo-extract-v1",
      outputSchemaVersion: "eval-training-photo-extract-v1",
      body: {
        text: {
          format: {
            type: "json_schema",
            name: "eval_training_record_photo_extract",
            schema,
          },
        },
      },
    });
    return { parsed: result.parsed, model: result.meta.model, fallbackUsed: result.meta.fallbackUsed };
  },

  "field-audits.ai-review": async (input) => {
    const params = input as Parameters<typeof generateFieldAuditAiReview>[0];
    return generateFieldAuditAiReview(params);
  },

  "jobsite.site-visual.generate": async (input) => {
    const params = input as SiteVisualGenerationInput;
    const fallback = buildFallbackSiteVisualScene(params);
    const result = await runStructuredAiJsonTask<Partial<typeof fallback>>({
      system:
        "You create structured schematic 3D site maps for construction safety planning. Return strict JSON only and do not claim engineering or BIM accuracy.",
      user: buildSiteVisualAiPrompt(params),
      fallbackModel: "gpt-4o-mini",
      fallback,
      surface: "jobsite.site-visual.generate",
      promptVersion: "eval-jobsite-site-visual-generate-v1",
      outputSchemaVersion: "jobsite-site-visual-scene-v1",
      maxAttempts: 2,
      body: {
        text: {
          format: {
            type: "json_schema",
            name: "jobsite_site_visual_scene",
            schema: SITE_VISUAL_SCENE_JSON_SCHEMA,
            strict: true,
          },
        },
      },
    });
    return validateSiteVisualScene(result.parsed, params);
  },

  "superadmin.ai-engine.recommendations": async (input) => {
    const params = input as Parameters<typeof buildAiEngineRecommendationCandidates>[0];
    return { recommendations: buildAiEngineRecommendationCandidates(params) };
  },
};

export function getAiEvalAdapter(surface: string): AiEvalAdapter | null {
  return adapters[surface] ?? null;
}

export function listAiEvalSurfaces(): string[] {
  return Object.keys(adapters);
}
