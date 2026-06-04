import { describe, expect, it } from "vitest";
import { appendSafetyGateLanguage, evaluateAiEngineOutputSafetyGate } from "@/lib/aiEngine/outputSafetyGate";
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

const staleMemory: TrustedKnowledgeGraphMemoryItem = {
  ...currentCompanyMemory,
  id: "graph:stale",
  nodeId: "stale",
  isStale: true,
  confidenceScore: 0.49,
};

describe("AI Engine output safety gate", () => {
  it("forces human review for high-risk fallback-only graph context", () => {
    const gate = evaluateAiEngineOutputSafetyGate({
      riskLevel: "high",
      brain: { items: [fallbackMemory], fallbackMemoryCount: 1, warnings: [] },
    });

    expect(gate.okForNormalRecommendation).toBe(false);
    expect(gate.action).toBe("force_human_review");
    expect(gate.requiredLanguage.join(" ")).toContain("possible stop-work review");
    expect(appendSafetyGateLanguage("Install guardrails.", gate)).toContain("Human review required");
  });

  it("forces human review for critical stale-only company graph context", () => {
    const gate = evaluateAiEngineOutputSafetyGate({
      riskLevel: "critical",
      brain: { items: [staleMemory], fallbackMemoryCount: 0, warnings: [] },
    });

    expect(gate.okForNormalRecommendation).toBe(false);
    expect(gate.staleCompanyGraphMemoryCount).toBe(1);
    expect(gate.warnings.join(" ")).toContain("stale company graph memory");
  });

  it("allows high-risk output when current company-specific graph memory exists", () => {
    const gate = evaluateAiEngineOutputSafetyGate({
      riskLevel: "high",
      brain: { items: [currentCompanyMemory, fallbackMemory], fallbackMemoryCount: 1, warnings: [] },
    });

    expect(gate.okForNormalRecommendation).toBe(true);
    expect(gate.action).toBe("allow");
    expect(gate.currentCompanyGraphMemoryCount).toBe(1);
  });

  it("does not block low and moderate risk outputs", () => {
    const gate = evaluateAiEngineOutputSafetyGate({
      riskLevel: "moderate",
      brain: { items: [fallbackMemory], fallbackMemoryCount: 1, warnings: [] },
    });

    expect(gate.okForNormalRecommendation).toBe(true);
    expect(gate.requiredLanguage).toEqual([]);
  });
});
