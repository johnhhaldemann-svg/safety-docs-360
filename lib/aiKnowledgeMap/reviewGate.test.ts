import { describe, expect, it } from "vitest";
import {
  buildCandidatePromotionPreview,
  buildKnowledgeProvenanceCertificate,
  candidateRequiresSecondApproval,
  isLearningCandidateReviewGated,
  isLearningNodeVisibleOnMap,
  isTrustedMemoryStale,
  learningCandidateReviewMetadata,
} from "@/lib/aiKnowledgeMap/reviewGate";
import type { AiKnowledgeIngestCandidate, AiKnowledgeNode } from "@/lib/aiKnowledgeMap/types";

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

function candidate(riskLevel: string, validationStatus: AiKnowledgeIngestCandidate["validationStatus"] = "pending_review"): AiKnowledgeIngestCandidate {
  return {
    id: `candidate-${riskLevel}`,
    batchId: "batch-1",
    companyId: "company-1",
    candidateType: "node",
    sourceTable: "documents",
    sourceId: "document-1",
    sourceRecordId: "document-1",
    sourceNodeKey: null,
    targetNodeKey: null,
    relationshipType: null,
    title: "Hot Work Procedure",
    semanticSummary: "Hot work procedure requires fire watch.",
    reason: "Approved source includes high-risk hot work controls.",
    sourceEvidence: [{ sourceTable: "documents", sourceRecordId: "document-1", label: "Source", detail: "Fire watch and extinguisher required." }],
    proposedPayload: {
      sourceTable: "documents",
      sourceId: "document-1",
      title: "Hot Work Procedure",
      riskLevel,
    },
    confidenceScore: 0.82,
    validationStatus,
    reviewedBy: validationStatus === "pending_second_approval" ? "reviewer-1" : null,
    reviewedAt: validationStatus === "pending_second_approval" ? "2026-05-31T10:00:00.000Z" : null,
    reviewNote: validationStatus === "pending_second_approval" ? "First approval." : null,
    promotedNodeId: null,
    promotedEdgeId: null,
    promotedAt: null,
    metadata: learningCandidateReviewMetadata({
      sourceKind: "document",
      learnedSummary: "Hot work procedure requires fire watch.",
      confidenceScore: 0.82,
      riskLevel,
      sourceDocument: "hot-work.pdf",
      extra: validationStatus === "pending_second_approval"
        ? { firstApproval: { reviewedBy: "reviewer-1", reviewedAt: "2026-05-31T10:00:00.000Z", reason: "First approval." } }
        : {},
    }),
    createdAt: "2026-05-31T09:00:00.000Z",
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

  it("requires two-person review for high and critical candidates", () => {
    expect(candidateRequiresSecondApproval(candidate("critical"))).toBe(true);
    expect(candidateRequiresSecondApproval(candidate("high"))).toBe(true);
    expect(candidateRequiresSecondApproval(candidate("moderate"))).toBe(false);
  });

  it("builds promotion previews with review due dates and affected surfaces", () => {
    const preview = buildCandidatePromotionPreview(candidate("high"), { previewedAt: "2026-05-31T12:00:00.000Z" });

    expect(preview.requiresSecondApproval).toBe(true);
    expect(preview.willCreateNode).toBe(true);
    expect(preview.willCreateVectorMemory).toBe(true);
    expect(preview.affectedSurfaces).toContain("Gus verified answers");
    expect(preview.dependencyWarnings.join(" ")).toContain("two different Super Admin approvals");
    expect(preview.reviewDueAt).toBe("2026-07-30T12:00:00.000Z");
  });

  it("creates provenance certificates and detects stale trusted memory", () => {
    const cert = buildKnowledgeProvenanceCertificate(candidate("moderate"), {
      approvedBy: "reviewer-1",
      approvedAt: "2026-05-31T12:00:00.000Z",
    });

    expect(cert.reviewerIds).toEqual(["reviewer-1"]);
    expect(cert.evidenceSummary[0]).toContain("Fire watch");
    expect(cert.complianceProof).toBe(false);
    expect(cert.reviewDueAt).toBe("2026-11-27T12:00:00.000Z");
    expect(isTrustedMemoryStale({ provenanceCertificate: cert }, new Date("2026-11-28T00:00:00.000Z"))).toBe(true);
  });
});
