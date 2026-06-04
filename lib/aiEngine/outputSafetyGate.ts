import type { AiEngineBrainResult } from "@/lib/aiEngine/brain";
import type { AiKnowledgeRiskLevel, TrustedKnowledgeGraphMemoryItem } from "@/lib/aiKnowledgeMap/types";

export type AiEngineOutputSafetyGateAction =
  | "allow"
  | "force_human_review"
  | "block_normal_recommendation";

export type AiEngineOutputSafetyGateResult = {
  okForNormalRecommendation: boolean;
  action: AiEngineOutputSafetyGateAction;
  requiredLanguage: string[];
  warnings: string[];
  currentCompanyGraphMemoryCount: number;
  staleCompanyGraphMemoryCount: number;
  fallbackMemoryCount: number;
};

export function evaluateAiEngineOutputSafetyGate(params: {
  riskLevel: AiKnowledgeRiskLevel | string | null | undefined;
  brain: Pick<AiEngineBrainResult, "items" | "fallbackMemoryCount" | "warnings">;
}): AiEngineOutputSafetyGateResult {
  const highOrCritical = params.riskLevel === "high" || params.riskLevel === "critical";
  const currentCompanyGraphMemory = params.brain.items.filter(isCurrentCompanyGraphMemory);
  const staleCompanyGraphMemory = params.brain.items.filter((item) => Boolean(item.companyId) && item.isStale);
  const fallbackMemory = params.brain.items.filter(isFallbackGraphMemory);
  const warnings = [...params.brain.warnings];

  if (!highOrCritical) {
    return {
      okForNormalRecommendation: true,
      action: "allow",
      requiredLanguage: [],
      warnings,
      currentCompanyGraphMemoryCount: currentCompanyGraphMemory.length,
      staleCompanyGraphMemoryCount: staleCompanyGraphMemory.length,
      fallbackMemoryCount: fallbackMemory.length,
    };
  }

  if (currentCompanyGraphMemory.length > 0) {
    return {
      okForNormalRecommendation: true,
      action: "allow",
      requiredLanguage: staleCompanyGraphMemory.length > 0
        ? ["Some approved graph memory is stale; cite only current company-specific memory for the high/critical recommendation."]
        : [],
      warnings,
      currentCompanyGraphMemoryCount: currentCompanyGraphMemory.length,
      staleCompanyGraphMemoryCount: staleCompanyGraphMemory.length,
      fallbackMemoryCount: fallbackMemory.length,
    };
  }

  if (fallbackMemory.length > 0) {
    warnings.push("High/critical output matched only fallback graph memory; normal recommendations must be replaced with human review language.");
  }
  if (staleCompanyGraphMemory.length > 0) {
    warnings.push("High/critical output matched stale company graph memory but no current company-specific graph memory.");
  }

  return {
    okForNormalRecommendation: false,
    action: fallbackMemory.length > 0 || staleCompanyGraphMemory.length > 0 ? "force_human_review" : "block_normal_recommendation",
    requiredLanguage: [
      "Require immediate human review by a qualified safety professional.",
      "For high or critical risk, evaluate whether work should pause for possible stop-work review.",
      "Do not present fallback-only or stale-only memory as company-specific approved evidence.",
    ],
    warnings,
    currentCompanyGraphMemoryCount: 0,
    staleCompanyGraphMemoryCount: staleCompanyGraphMemory.length,
    fallbackMemoryCount: fallbackMemory.length,
  };
}

export function appendSafetyGateLanguage(text: string, gate: AiEngineOutputSafetyGateResult) {
  if (gate.okForNormalRecommendation || gate.requiredLanguage.length === 0) return text;
  return [text.trim(), "", "Human review required:", ...gate.requiredLanguage.map((line) => `- ${line}`)].join("\n");
}

function isFallbackGraphMemory(item: TrustedKnowledgeGraphMemoryItem) {
  return item.id.startsWith("fallback:") || !item.companyId;
}

function isCurrentCompanyGraphMemory(item: TrustedKnowledgeGraphMemoryItem) {
  return Boolean(item.companyId) && !item.isStale && item.confidenceScore >= 0.55;
}
