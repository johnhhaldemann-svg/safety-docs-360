import { describe, expect, it, vi } from "vitest";
import {
  buildApprovalMemoryRow,
  buildKnowledgeCandidateApprovalMemory,
  buildKnowledgeRelationshipApprovalMemory,
  buildPredictionApprovalMemory,
  recordApprovalDecisions,
} from "@/lib/aiApprovalMemory";

describe("AI approval memory bank", () => {
  it("captures an approved incident with its rating and learnable content", () => {
    const input = buildPredictionApprovalMemory({
      decision: "approved",
      sourceType: "incident",
      row: {
        id: "incident-1",
        company_id: "company-1",
        title: "Unguarded opening",
        description: "Worker stepped near an unguarded floor opening.",
        category: "near_miss",
        severity: "high",
        project: "Las Vegas Site 4",
      },
      rating: 5,
      notes: "Strong example of a near miss worth modeling.",
      tags: ["near_miss"],
      reviewedBy: "reviewer-1",
      reviewedAt: "2026-06-05T10:00:00.000Z",
    });

    expect(input).toMatchObject({
      decision: "approved",
      surface: "prediction_validation",
      sourceType: "incident",
      sourceTable: "company_incidents",
      sourceRecordId: "incident-1",
      companyId: "company-1",
      title: "Unguarded opening",
      severity: "high",
      rating: 5,
    });
    expect(input.content).toContain("Unguarded opening");
    expect(input.content).toContain("unguarded floor opening");
    expect(input.features).toMatchObject({ project: "Las Vegas Site 4" });
    expect(input.reason).toBe("Strong example of a near miss worth modeling.");
  });

  it("captures rejections (the 'not approvable' label) without requiring a rating", () => {
    const input = buildPredictionApprovalMemory({
      decision: "rejected",
      sourceType: "sor",
      row: { id: "sor-1", company_id: "company-1", description: "Vague observation, no detail." },
      rating: null,
      notes: "Too vague to learn from.",
      tags: [],
      reviewedBy: "reviewer-1",
      reviewedAt: "2026-06-05T10:00:00.000Z",
    });

    expect(input.decision).toBe("rejected");
    expect(input.sourceTable).toBe("company_sor_records");
    expect(input.rating).toBeNull();
    expect(input.title).toBe("Vague observation, no detail.");
  });

  it("serializes to the snake_case row shape with safe defaults", () => {
    const row = buildApprovalMemoryRow({
      decision: "approved",
      surface: "prediction_validation",
      rating: 4,
    });
    expect(row).toMatchObject({
      decision: "approved",
      surface: "prediction_validation",
      rating: 4,
      tags: [],
      features: {},
      source_record_id: null,
    });
  });

  it("captures a Knowledge Map candidate approval with the knowledge_map_candidate surface", () => {
    const input = buildKnowledgeCandidateApprovalMemory(
      {
        id: "cand-1",
        companyId: "company-1",
        candidateType: "edge",
        relationshipType: "mitigates",
        sourceTable: "ai_knowledge_ingest_candidates",
        sourceRecordId: "rec-1",
        title: "Fire watch mitigates hot work",
        semanticSummary: "Assigning a fire watch reduces hot-work ignition risk.",
        confidenceScore: 0.81,
      },
      { status: "approved", reason: "Evidence supports this relationship.", reviewedBy: "super-1", reviewedAt: "2026-06-05T10:00:00.000Z" }
    );
    expect(input).toMatchObject({
      decision: "approved",
      surface: "knowledge_map_candidate",
      sourceType: "edge",
      sourceRecordId: "rec-1",
      companyId: "company-1",
    });
    expect(input.features).toMatchObject({ relationshipType: "mitigates", confidenceScore: 0.81, reviewStatus: "approved" });
  });

  it("maps Knowledge Map 'incorrect' to a rejected label", () => {
    const input = buildKnowledgeRelationshipApprovalMemory(
      { id: "edge-9", companyId: "company-1", relationshipType: "causes", reason: "Weak link", confidenceScore: 0.4 },
      { edgeId: "edge-9", status: "incorrect", reason: "Source does not support this.", reviewedBy: "super-1", reviewedAt: "2026-06-05T10:00:00.000Z" }
    );
    expect(input.decision).toBe("rejected");
    expect(input.surface).toBe("knowledge_map_relationship");
    expect(input.sourceTable).toBe("ai_knowledge_edges");
    expect(input.features).toMatchObject({ reviewStatus: "incorrect" });
  });

  it("records decisions and tolerates insert failures without throwing", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const okClient = { from: vi.fn().mockReturnValue({ insert }) };
    const ok = await recordApprovalDecisions(okClient as never, [
      { decision: "approved", surface: "prediction_validation" },
    ]);
    expect(ok).toEqual({ recorded: 1, error: null });
    expect(okClient.from).toHaveBeenCalledWith("ai_approval_memory");

    const failingClient = {
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: "missing table" } }) }),
    };
    const failed = await recordApprovalDecisions(failingClient as never, [
      { decision: "rejected", surface: "prediction_validation" },
    ]);
    expect(failed).toEqual({ recorded: 0, error: "missing table" });

    // Nothing to record → no client call.
    const idle = await recordApprovalDecisions(okClient as never, []);
    expect(idle).toEqual({ recorded: 0, error: null });
  });
});
