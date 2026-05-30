import { describe, expect, it } from "vitest";
import { isLearningCandidateReviewGated, isLearningNodeVisibleOnMap, learningCandidateReviewMetadata } from "@/lib/aiKnowledgeMap/reviewGate";
import type { AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";

function node(validationStatus: AiKnowledgeNode["validationStatus"]): AiKnowledgeNode {
  return {
    id: "learned-node",
    companyId: "company-1",
    jobsiteId: null,
    projectId: null,
    sourceTable: "approved_sources",
    sourceId: "source-1",
    sourceRecordId: "source-1",
    title: "Learned internet source",
    nodeType: "document",
    type: "document",
    category: "internet_source",
    description: "Learned text",
    semanticSummary: "Learned summary",
    project: null,
    trade: null,
    riskLevel: "moderate",
    riskScore: 55,
    sourceUrl: "https://example.com/safety",
    sourceDocument: "Example",
    metadata: learningCandidateReviewMetadata({
      sourceKind: "internet_source",
      learnedSummary: "Learned summary",
      confidenceScore: 0.66,
      riskLevel: "moderate",
      sourceUrl: "https://example.com/safety",
    }),
    vectorStatus: "pending",
    vectorCoordinates: { x: 0, y: 0, z: 1, cluster: "document" },
    confidenceScore: 0.66,
    validationStatus,
    createdByType: "system",
  };
}

describe("AI Knowledge learning review gate", () => {
  it("standardizes learning candidate metadata as human-review gated", () => {
    const metadata = learningCandidateReviewMetadata({
      sourceKind: "document",
      learnedSummary: "Hot work document summary",
      confidenceScore: 0.74,
      riskLevel: "high",
      sourceDocument: "hot-work.pdf",
    });

    expect(metadata).toMatchObject({
      sourceKind: "document",
      learnedSummary: "Hot work document summary",
      confidenceScore: 0.74,
      riskLevel: "high",
      sourceDocument: "hot-work.pdf",
      requiresHumanReview: true,
      trustedMemoryWrite: false,
    });
    expect(isLearningCandidateReviewGated(metadata)).toBe(true);
  });

  it("keeps pending learned nodes off the map until approved", () => {
    expect(isLearningNodeVisibleOnMap(node("pending_review"))).toBe(false);
    expect(isLearningNodeVisibleOnMap(node("rejected"))).toBe(false);
    expect(isLearningNodeVisibleOnMap(node("approved"))).toBe(true);
  });
});
