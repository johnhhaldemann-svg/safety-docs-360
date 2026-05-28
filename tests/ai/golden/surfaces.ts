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
import { buildVerifiedSafetyAnswer } from "@/lib/gusLearning/answer";
import { buildAiEngineRecommendationCandidates } from "@/lib/superadmin/aiEngineOperations";
import {
  SITE_VISUAL_SCENE_JSON_SCHEMA,
  buildFallbackSiteVisualScene,
  buildSiteVisualAiPrompt,
  validateSiteVisualScene,
  type SiteVisualGenerationInput,
} from "@/lib/jobsiteSiteVisual";
import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import type { ApprovedKnowledgeRow } from "@/lib/gusLearning/types";

export type AiEvalAdapter = (input: unknown) => Promise<unknown>;

function gusKnowledge(overrides: Partial<ApprovedKnowledgeRow> = {}): ApprovedKnowledgeRow {
  return {
    id: "gus-knowledge-1",
    company_id: "company-1",
    project_id: null,
    approved_source_id: "source-1",
    research_queue_id: "research-1",
    topic: "Safety requirement",
    knowledge_title: "Verified safety knowledge",
    approved_summary: "Use the verified safety control described by the approved source.",
    source_url: "https://safety360docs.example/verified-source",
    source_title: "Verified source",
    source_type: "company policy",
    jurisdiction: "Company",
    regulation_reference: null,
    applies_to: "Pilot eval",
    affected_modules: ["gus"],
    required_control_type: "company_policy",
    citation_excerpt: "Approved source excerpt for this safety control.",
    citation_locator: "Section 1",
    source_content_hash: "hash-gus-1",
    verification_notes: "Approved for AI eval fixture coverage.",
    quality_score: 85,
    supersedes_knowledge_id: null,
    superseded_by_knowledge_id: null,
    approved_by: "safety-admin-1",
    approved_at: "2026-01-01T00:00:00Z",
    review_due_date: "2027-01-01",
    review_status: "current",
    version: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function gusVerifiedLearningKnowledge(scenario: string): ApprovedKnowledgeRow[] {
  if (scenario === "unsupported-osha-claim") return [];
  if (scenario === "prompt-injection-blocked") {
    return [
      gusKnowledge({
        id: "gus-injection-safe",
        knowledge_title: "Approved housekeeping control",
        approved_summary: "Keep access paths clear and route blocked walkways to supervisor review before work continues.",
        source_url: "https://safety360docs.example/company/housekeeping",
        required_control_type: "company_policy",
      }),
    ];
  }
  if (scenario === "site-over-company-priority") {
    return [
      gusKnowledge({
        id: "gus-company-fall-protection",
        knowledge_title: "Company fall protection policy",
        approved_summary: "Company policy requires fall protection planning for elevated work.",
        source_url: "https://safety360docs.example/company/fall-protection",
        required_control_type: "company_policy",
      }),
      gusKnowledge({
        id: "gus-site-fall-protection",
        project_id: "jobsite-1",
        source_type: "site safety plan",
        knowledge_title: "Jobsite fall protection plan",
        approved_summary: "The site-specific requirement is to use approved guardrails or personal fall arrest before roof-edge work starts.",
        source_url: "https://safety360docs.example/sites/jobsite-1/fall-protection",
        required_control_type: "site_requirement",
      }),
    ];
  }
  if (scenario === "manufacturer-vs-best-practice") {
    return [
      gusKnowledge({
        id: "gus-lift-anchor-manufacturer",
        source_type: "manufacturer manual",
        knowledge_title: "Lift anchor inspection manual",
        approved_summary: "Inspect the lift anchor according to the manufacturer instruction before use and remove damaged anchors from service.",
        source_url: "https://safety360docs.example/manuals/lift-anchor",
        required_control_type: "manufacturer_instruction",
      }),
      gusKnowledge({
        id: "gus-lift-anchor-best-practice",
        source_type: "insurance carrier guidance",
        knowledge_title: "Lift anchor visual check reminder",
        approved_summary: "A documented pre-use visual check is a best practice for lift anchors.",
        source_url: "https://safety360docs.example/best-practices/lift-anchor",
        required_control_type: "best_practice",
      }),
    ];
  }
  if (scenario === "low-confidence-best-practice") {
    return [
      gusKnowledge({
        id: "gus-best-practice-only",
        source_type: "insurance carrier guidance",
        knowledge_title: "Best practice only guidance",
        approved_summary: "When only best practice knowledge matches, label it as best practice and ask a safety reviewer to confirm before treating it as a requirement.",
        source_url: "https://safety360docs.example/best-practices/general",
        required_control_type: "best_practice",
        regulation_reference: null,
      }),
    ];
  }
  if (scenario === "expired-knowledge-warning") {
    return [
      gusKnowledge({
        id: "gus-expired-confined-space",
        source_type: "company policy",
        knowledge_title: "Confined space entry rule",
        approved_summary: "Follow the approved confined space entry procedure and verify permits, atmosphere testing, attendants, and rescue planning.",
        source_url: "https://safety360docs.example/company/confined-space",
        required_control_type: "company_policy",
        review_due_date: "2025-01-01",
        review_status: "needs_review",
        quality_score: 52,
      }),
    ];
  }
  return [];
}

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

  "gus.verified-learning": async (input) => {
    const params = input as {
      question: string;
      scenario: string;
      companyId?: string | null;
      projectId?: string | null;
      now?: string;
    };
    return buildVerifiedSafetyAnswer({
      question: params.question,
      companyId: params.companyId ?? "company-1",
      projectId: params.projectId ?? null,
      knowledge: gusVerifiedLearningKnowledge(params.scenario),
      now: params.now ? new Date(params.now) : undefined,
    });
  },
};

export function getAiEvalAdapter(surface: string): AiEvalAdapter | null {
  return adapters[surface] ?? null;
}

export function listAiEvalSurfaces(): string[] {
  return Object.keys(adapters);
}

export function aiEvalSurfaceRequiresOpenAi(surface: string): boolean {
  return surface !== "gus.verified-learning";
}
