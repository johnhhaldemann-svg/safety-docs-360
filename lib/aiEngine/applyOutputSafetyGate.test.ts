import { describe, expect, it } from "vitest";
import { applyAiEngineOutputSafetyGate } from "@/lib/aiEngine/applyOutputSafetyGate";
import type { TrustedKnowledgeGraphMemoryItem } from "@/lib/aiKnowledgeMap/types";

const currentCompanyMemory: TrustedKnowledgeGraphMemoryItem = {
  id: "graph:current",
  nodeId: "current",
  companyId: "company-1",
  title: "Current company fall protection memory",
  excerpt: "Approved company-specific fall protection memory.",
  sourceTable: "company_jsas",
  sourceId: "jsa-1",
  category: "jsa",
  nodeType: "task",
  riskLevel: "high",
  confidenceScore: 0.82,
  relationshipReasons: [],
  evidence: [],
};

const fallbackMemory: TrustedKnowledgeGraphMemoryItem = {
  ...currentCompanyMemory,
  id: "fallback:fall-protection",
  nodeId: "fallback-fall-protection",
  companyId: null,
  title: "General fall protection guidance",
  confidenceScore: 0.54,
};

describe("applyAiEngineOutputSafetyGate", () => {
  it("appends human-review language for high-risk fallback-only context", () => {
    const result = applyAiEngineOutputSafetyGate({
      riskLevel: "high",
      brain: { items: [fallbackMemory] },
      text: "Install guardrails.",
    });

    expect(result.gate.okForNormalRecommendation).toBe(false);
    expect(result.text).toContain("Human review required");
    expect(result.text.startsWith("Install guardrails.")).toBe(true);
  });

  it("leaves text unchanged when current company graph memory backs a high-risk output", () => {
    const result = applyAiEngineOutputSafetyGate({
      riskLevel: "high",
      brain: { items: [currentCompanyMemory, fallbackMemory] },
      text: "Install guardrails.",
    });

    expect(result.gate.okForNormalRecommendation).toBe(true);
    expect(result.text).toBe("Install guardrails.");
  });

  it("leaves low/moderate-risk output unchanged", () => {
    const result = applyAiEngineOutputSafetyGate({
      riskLevel: "moderate",
      brain: { items: [fallbackMemory] },
      text: "Routine reminder.",
    });

    expect(result.text).toBe("Routine reminder.");
  });

  it("tolerates a null or reduced brain result (retrieval failed) without throwing", () => {
    const nullBrain = applyAiEngineOutputSafetyGate({ riskLevel: "critical", brain: null, text: "x" });
    expect(nullBrain.gate.okForNormalRecommendation).toBe(false); // high/critical with zero memory blocks
    expect(nullBrain.gate.fallbackMemoryCount).toBe(0);

    const partialBrain = applyAiEngineOutputSafetyGate({
      riskLevel: "high",
      brain: { warnings: ["AI Engine brain memory unavailable."] },
    });
    expect(partialBrain.gate.warnings).toContain("AI Engine brain memory unavailable.");
    expect(partialBrain.text).toBe("");
  });
});
