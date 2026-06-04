import {
  appendSafetyGateLanguage,
  evaluateAiEngineOutputSafetyGate,
  type AiEngineOutputSafetyGateResult,
} from "@/lib/aiEngine/outputSafetyGate";
import type { AiEngineBrainResult } from "@/lib/aiEngine/brain";
import type { AiKnowledgeRiskLevel } from "@/lib/aiKnowledgeMap/types";

/**
 * Reusable wrapper around the AI Engine output safety gate.
 *
 * The raw {@link evaluateAiEngineOutputSafetyGate} requires a fully-shaped brain
 * result. In practice most surfaces hold a brain result that may have been reduced
 * by a `.catch` fallback (e.g. retrieval failed), so this helper tolerates a partial
 * brain and fills safe defaults. Surfaces that produce a single user-facing text
 * block get the required human-review language appended; surfaces that store
 * structured rows can read `gate.action` / `gate.okForNormalRecommendation` to
 * decide whether to force verification.
 *
 * Wire this into any surface that `surfaceContextPolicy.ts` marks
 * `requires_company_graph_or_human_review`.
 */
export type SafetyGateBrainLike =
  | Partial<Pick<AiEngineBrainResult, "items" | "fallbackMemoryCount" | "warnings">>
  | null
  | undefined;

export function applyAiEngineOutputSafetyGate(params: {
  riskLevel: AiKnowledgeRiskLevel | string | null | undefined;
  brain: SafetyGateBrainLike;
  /** Optional output text to receive appended human-review language when the gate fires. */
  text?: string;
}): { text: string; gate: AiEngineOutputSafetyGateResult } {
  const brain = {
    items: params.brain?.items ?? [],
    fallbackMemoryCount: params.brain?.fallbackMemoryCount ?? 0,
    warnings: params.brain?.warnings ?? [],
  };

  const gate = evaluateAiEngineOutputSafetyGate({ riskLevel: params.riskLevel, brain });
  const text = typeof params.text === "string" ? appendSafetyGateLanguage(params.text, gate) : "";

  return { text, gate };
}
