import { describe, expect, it } from "vitest";
import { reviewKnowledgeIngestCandidates } from "@/lib/aiKnowledgeMap/repository";

function highRiskCandidate(status = "pending_review", reviewedBy: string | null = null) {
  return {
    id: "candidate-high",
    batch_id: "batch-1",
    company_id: "company-1",
    candidate_type: "node",
    source_table: "documents",
    source_id: "document-1",
    source_record_id: "document-1",
    title: "High risk hot work procedure",
    semantic_summary: "Hot work procedure with fire watch controls.",
    reason: "Approved document includes high-risk hot work fire watch controls.",
    source_evidence: [{ sourceTable: "documents", sourceRecordId: "document-1", label: "Source", detail: "Fire watch and extinguisher controls are required." }],
    proposed_payload: {
      sourceTable: "documents",
      sourceId: "document-1",
      sourceRecordId: "document-1",
      title: "High risk hot work procedure",
      nodeType: "document",
      type: "document",
      category: "hot work",
      description: "Hot work procedure with fire watch controls.",
      semanticSummary: "Hot work procedure with fire watch controls.",
      riskLevel: "high",
      riskScore: 78,
      companyId: "company-1",
      projectId: null,
      jobsiteId: null,
      trade: null,
      project: null,
      sourceUrl: null,
      sourceDocument: "hot-work.pdf",
      metadata: { document_hash: "hash-1" },
      vectorStatus: "pending",
      vectorCoordinates: { x: 0, y: 0, z: 1, cluster: "document" },
      confidenceScore: 0.82,
      validationStatus: "pending_review",
      createdByType: "system",
    },
    confidence_score: 0.82,
    validation_status: status,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedBy ? "2026-05-31T10:00:00.000Z" : null,
    review_note: reviewedBy ? "First approval reason." : null,
    promoted_node_id: null,
    promoted_edge_id: null,
    promoted_at: null,
    metadata: reviewedBy
      ? { riskLevel: "high", document_hash: "hash-1", firstApproval: { reviewedBy, reviewedAt: "2026-05-31T10:00:00.000Z", reason: "First approval reason." } }
      : { riskLevel: "high", document_hash: "hash-1" },
    created_by_type: "system",
    created_at: "2026-05-31T09:00:00.000Z",
    updated_at: "2026-05-31T09:00:00.000Z",
  };
}

function fakeReviewClient(initialCandidate: Record<string, unknown>) {
  let candidate = { ...initialCandidate };
  const writes: Array<{ table: string; value: unknown }> = [];

  return {
    writes,
    from(table: string) {
      return {
        select() {
          const chain = {
            eq: () => chain,
            single: async () => ({ data: candidate, error: null }),
          };
          return chain;
        },
        update(value: Record<string, unknown>) {
          writes.push({ table, value });
          return {
            eq: () => ({
              select: () => ({
                single: async () => {
                  candidate = { ...candidate, ...value };
                  return { data: candidate, error: null };
                },
              }),
            }),
          };
        },
        upsert(value: Array<Record<string, unknown>> | Record<string, unknown>) {
          writes.push({ table, value });
          if (table === "ai_knowledge_nodes") {
            const rows = Array.isArray(value) ? value : [value];
            return {
              select: async () => ({ data: rows.map((row, index) => ({ id: `node-${index + 1}`, ...row })), error: null }),
            };
          }
          return Promise.resolve({ data: value, error: null });
        },
        insert(value: unknown) {
          writes.push({ table, value });
          return Promise.resolve({ data: value, error: null });
        },
      };
    },
  };
}

describe("AI Knowledge candidate review promotion", () => {
  it("holds high-risk candidates for a second approval without writing trusted memory", async () => {
    const client = fakeReviewClient(highRiskCandidate());
    const result = await reviewKnowledgeIngestCandidates(client as never, {
      candidateIds: ["candidate-high"],
      status: "approved",
      reason: "First Super Admin approval for high-risk hot work memory.",
      actorUserId: "reviewer-1",
      promoteApproved: true,
    });

    expect(result.ok).toBe(true);
    expect(result.reviewed[0]?.validationStatus).toBe("pending_second_approval");
    expect(client.writes.some((write) => write.table === "ai_knowledge_nodes" || write.table === "ai_vector_memory")).toBe(false);
  });

  it("blocks the same reviewer from second-approving high-risk memory", async () => {
    const client = fakeReviewClient(highRiskCandidate("pending_second_approval", "reviewer-1"));
    const result = await reviewKnowledgeIngestCandidates(client as never, {
      candidateIds: ["candidate-high"],
      status: "approved",
      reason: "Second approval attempt.",
      actorUserId: "reviewer-1",
      promoteApproved: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.error).toContain("different reviewer");
  });

  it("promotes high-risk memory after a different second approval and stores provenance", async () => {
    const client = fakeReviewClient(highRiskCandidate("pending_second_approval", "reviewer-1"));
    const result = await reviewKnowledgeIngestCandidates(client as never, {
      candidateIds: ["candidate-high"],
      status: "approved",
      reason: "Second Super Admin approval confirms evidence and scope.",
      actorUserId: "reviewer-2",
      promoteApproved: true,
    });

    expect(result.ok).toBe(true);
    expect(result.reviewed[0]?.validationStatus).toBe("promoted");
    const nodeWrite = client.writes.find((write) => write.table === "ai_knowledge_nodes");
    expect(JSON.stringify(nodeWrite?.value)).toContain("provenanceCertificate");
    expect(JSON.stringify(nodeWrite?.value)).toContain("reviewer-1");
    expect(JSON.stringify(nodeWrite?.value)).toContain("reviewer-2");
    expect(client.writes.some((write) => write.table === "ai_vector_memory")).toBe(true);
  });
});
