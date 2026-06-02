import { AI_ENGINE_SURFACES } from "@/lib/superadmin/aiEngineOperations";
import type { AiEngineBrainSurface } from "@/lib/aiEngine/brain";

export type AiEngineHighRiskFallbackBehavior =
  | "requires_company_graph_or_human_review"
  | "not_recommendation_surface"
  | "telemetry_only";

export type AiEngineSurfaceContextPolicy = {
  surface: (typeof AI_ENGINE_SURFACES)[number];
  usesApprovedGraphContext: boolean;
  brainSurface: AiEngineBrainSurface | null;
  exceptionReason: string | null;
  highRiskFallbackBehavior: AiEngineHighRiskFallbackBehavior;
};

export const AI_ENGINE_SURFACE_CONTEXT_POLICIES: AiEngineSurfaceContextPolicy[] = [
  {
    surface: "safety-intelligence",
    usesApprovedGraphContext: true,
    brainSurface: "smart_safety.review",
    exceptionReason: null,
    highRiskFallbackBehavior: "requires_company_graph_or_human_review",
  },
  {
    surface: "ai-engine",
    usesApprovedGraphContext: false,
    brainSurface: null,
    exceptionReason: "Super Admin diagnostics and telemetry surface; it does not generate customer-facing safety recommendations.",
    highRiskFallbackBehavior: "telemetry_only",
  },
  {
    surface: "company-memory",
    usesApprovedGraphContext: true,
    brainSurface: "gus.verified_answer",
    exceptionReason: null,
    highRiskFallbackBehavior: "requires_company_graph_or_human_review",
  },
  {
    surface: "permit-copilot",
    usesApprovedGraphContext: true,
    brainSurface: "permit.copilot",
    exceptionReason: null,
    highRiskFallbackBehavior: "requires_company_graph_or_human_review",
  },
  {
    surface: "csep-review",
    usesApprovedGraphContext: true,
    brainSurface: "document_ai.builder_review",
    exceptionReason: null,
    highRiskFallbackBehavior: "requires_company_graph_or_human_review",
  },
  {
    surface: "gc-review",
    usesApprovedGraphContext: true,
    brainSurface: "document_ai.gc_review",
    exceptionReason: null,
    highRiskFallbackBehavior: "requires_company_graph_or_human_review",
  },
  {
    surface: "injury-weather",
    usesApprovedGraphContext: false,
    brainSurface: null,
    exceptionReason: "Injury Weather uses deterministic weather/exposure evidence packs today; graph retrieval must be added before it emits graph-backed company recommendations.",
    highRiskFallbackBehavior: "requires_company_graph_or_human_review",
  },
  {
    surface: "training-records.photo-extract",
    usesApprovedGraphContext: false,
    brainSurface: null,
    exceptionReason: "Photo extraction reads a submitted training record and is not a safety recommendation surface.",
    highRiskFallbackBehavior: "not_recommendation_surface",
  },
  {
    surface: "field-audits.ai-review",
    usesApprovedGraphContext: true,
    brainSurface: "smart_safety.review",
    exceptionReason: null,
    highRiskFallbackBehavior: "requires_company_graph_or_human_review",
  },
  {
    surface: "embeddings",
    usesApprovedGraphContext: false,
    brainSurface: null,
    exceptionReason: "Embedding generation is indexing infrastructure and does not produce user-facing safety recommendations.",
    highRiskFallbackBehavior: "not_recommendation_surface",
  },
];

export function getAiEngineSurfaceContextPolicy(surface: string) {
  return AI_ENGINE_SURFACE_CONTEXT_POLICIES.find((policy) => policy.surface === surface) ?? null;
}
