import type { RiskIntelligenceRequest, RiskOutputRecord } from "@/types/safety-intelligence";
import { assertAiReviewContextReady } from "@/lib/safety-intelligence/validation/ai";
import { runStructuredAiJson } from "@/lib/safety-intelligence/ai/utils";

function fallbackRiskOutputs(request: RiskIntelligenceRequest): RiskOutputRecord {
  const rules = request.reviewContext.rulesEvaluations;
  const conflicts = request.reviewContext.conflictEvaluations.flatMap((row) => row.conflicts);
  const exposures = [...new Set(rules.flatMap((row) => row.hazardFamilies))];
  const missingControls = [...new Set(rules.flatMap((row) => row.requiredControls))];
  return {
    summary: `Review covers ${request.reviewContext.buckets.length} bucketed work item(s) with ${conflicts.length} simultaneous-operation conflict(s).`,
    exposures,
    missingControls,
    trendPatterns: conflicts.map((conflict) => conflict.code),
    riskScores: rules.map((row) => ({
      scope: row.bucketKey,
      score: row.score,
      band: row.band,
    })),
    forecastConflicts: conflicts.map((conflict) => conflict.rationale),
    correctiveActions: missingControls.map((control) => `Verify ${control.replace(/_/g, " ")} before execution.`),
  };
}

export async function generateRiskIntelligence(request: RiskIntelligenceRequest): Promise<{
  record: RiskOutputRecord;
  model: string | null;
  promptHash: string | null;
}> {
  assertAiReviewContextReady(request.reviewContext);
  const fallback = fallbackRiskOutputs(request);
  const system = [
    "You are a construction risk intelligence assistant.",
    "Use ONLY the provided JSON review context.",
    "Return JSON with keys: summary, exposures, missingControls, trendPatterns, riskScores, forecastConflicts, correctiveActions.",
  ].join(" ");
  const user = JSON.stringify(request);
  const result = await runStructuredAiJson<RiskOutputRecord>({
    modelEnv: process.env.SAFETY_INTELLIGENCE_RISK_MODEL,
    fallbackModel: "gpt-4o-mini",
    system,
    user,
    fallback,
  });

  return {
    record: {
      ...fallback,
      ...result.parsed,
    },
    model: result.model,
    promptHash: result.promptHash,
  };
}
