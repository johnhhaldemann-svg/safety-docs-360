import { describe, expect, it } from "vitest";
import {
  AI_ENGINE_MAPPING_SYSTEM_NAME,
  AI_KNOWLEDGE_MAP_SPEC_COMPARISON,
  buildClosedLoopSeparationMetadata,
  calculateExplainableRiskScore,
  requireClosedLoopHumanReview,
} from "@/lib/aiKnowledgeMap/closedLoop";

describe("AI Knowledge Map closed-loop memory rules", () => {
  it("documents the current engine comparison without requiring duplicate memory tables", () => {
    expect(AI_KNOWLEDGE_MAP_SPEC_COMPARISON.existingFoundation.join(" ")).toContain("ai_knowledge_nodes");
    expect(AI_KNOWLEDGE_MAP_SPEC_COMPARISON.upgradedByThisModule.join(" ")).toContain("closed-loop memory");
  });

  it("marks learned items as extracted/proposed but not official trusted memory", () => {
    const metadata = buildClosedLoopSeparationMetadata({ sourceKind: "document", riskLevel: "high" });

    expect(metadata.aiEngineSystem).toBe(AI_ENGINE_MAPPING_SYSTEM_NAME);
    expect(metadata.closedLoopMemoryCategory).toBe("learning_source");
    expect(metadata.learningSeparation).toMatchObject({
      extractedByAi: true,
      proposedByAi: true,
      pendingHumanReview: true,
      approvedByHuman: false,
      officialMapMemory: false,
    });
    expect(metadata.officialMapWriteAllowed).toBe(false);
    expect(metadata.recommendationUseAllowed).toBe(false);
    expect(metadata.riskScoringUseAllowed).toBe(false);
  });

  it("requires review for high-impact and personnel-affecting conclusions", () => {
    const review = requireClosedLoopHumanReview({
      itemType: "personnel_pattern",
      riskLevel: "critical",
      confidenceScore: 0.62,
      affectsPersonnel: true,
      affectsWorkerAssignment: true,
    });

    expect(review.required).toBe(true);
    expect(review.reasons.join(" ")).toContain("Personnel-level");
    expect(review.reasons.join(" ")).toContain("High/critical");
  });

  it("calculates explainable conservative risk scores from safety drivers", () => {
    const result = calculateExplainableRiskScore({
      severityScore: 72,
      frequencyScore: 58,
      exposureScore: 70,
      trainingGap: true,
      permitQualityIssue: true,
      repeatObservationCount: 3,
      openCorrectiveActionCount: 2,
      pastOutcomeEffective: false,
      confidenceScore: 0.66,
    });

    expect(result.riskLevel).toBe("critical");
    expect(result.riskScore).toBeGreaterThanOrEqual(80);
    expect(result.explanation).toContain("Training gap");
    expect(result.explanation).toContain("Past control did not reduce risk");
    expect(result.recommendedAction).toContain("Immediate");
  });
});
