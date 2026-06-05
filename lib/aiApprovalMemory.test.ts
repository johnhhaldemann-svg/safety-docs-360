import { describe, expect, it, vi } from "vitest";
import {
  buildAiImprovementApprovalMemory,
  buildApprovalMemoryRow,
  buildDocumentReviewApprovalMemory,
  buildGusLearningApprovalMemory,
  buildKnowledgeCandidateApprovalMemory,
  buildKnowledgeRelationshipApprovalMemory,
  buildOwnerValidationApprovalMemory,
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

  it("captures an AI Improvement decision under the ai_improvement surface", () => {
    const input = buildAiImprovementApprovalMemory(
      { id: "imp-1", title: "Add retry to weather sync", description: "Wrap the call in exponential backoff.", affected_area: "weather", risk_level: "low" },
      { decision: "approved", reason: "Checks failed but override justified.", reviewedBy: "super-1", reviewedAt: "2026-06-05T10:00:00.000Z" }
    );
    expect(input).toMatchObject({
      decision: "approved",
      surface: "ai_improvement",
      sourceTable: "ai_improvement_requests",
      sourceRecordId: "imp-1",
      category: "weather",
      riskLevel: "low",
      companyId: null,
    });
    expect(input.features).toMatchObject({ affectedArea: "weather", riskLevel: "low" });
  });

  it("captures a Gus Learning finding under the gus_learning_finding surface", () => {
    const input = buildGusLearningApprovalMemory(
      { id: "rq-1", company_id: "company-1", topic: "Silica exposure limits", source_title: "OSHA 1926.1153", source_url: "https://osha.gov/x", source_type: "regulation", jurisdiction: "US-Federal", raw_summary: "PEL is 50 ug/m3." },
      { decision: "rejected", reason: "Source is outdated.", reviewedBy: "super-1", reviewedAt: "2026-06-05T10:00:00.000Z" }
    );
    expect(input).toMatchObject({
      decision: "rejected",
      surface: "gus_learning_finding",
      sourceTable: "research_queue",
      sourceRecordId: "rq-1",
      companyId: "company-1",
      title: "OSHA 1926.1153",
    });
    expect(input.features).toMatchObject({ jurisdiction: "US-Federal", sourceUrl: "https://osha.gov/x" });
  });

  it("captures an Owner Validation decision under the owner_validation surface", () => {
    const approved = buildOwnerValidationApprovalMemory(
      { id: "ov-1", module_key: "login_auth", checklist_item: "MFA enforced on admin login", status: "passed", notes: "Verified on staging." },
      { decision: "approved", reason: "Verified on staging.", reviewedBy: "super-1", reviewedAt: "2026-06-05T10:00:00.000Z" }
    );
    expect(approved).toMatchObject({
      decision: "approved",
      surface: "owner_validation",
      sourceTable: "owner_manual_review_items",
      sourceRecordId: "ov-1",
      category: "login_auth",
      title: "MFA enforced on admin login",
    });
    expect(approved.features).toMatchObject({ moduleKey: "login_auth", reviewStatus: "passed" });
  });

  it("captures a Document Review decision under the document_review surface", () => {
    const input = buildDocumentReviewApprovalMemory(
      { id: "doc-1", company_id: "company-1", title: "Hot Work Permit Procedure", document_type: "procedure", category: "permits" },
      { decision: "approved", reason: "Looks complete.", reviewedBy: "super-1", reviewedAt: "2026-06-05T10:00:00.000Z" }
    );
    expect(input).toMatchObject({
      decision: "approved",
      surface: "document_review",
      sourceTable: "documents",
      sourceRecordId: "doc-1",
      companyId: "company-1",
      category: "permits",
    });
    expect(input.features).toMatchObject({ documentType: "procedure" });
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
