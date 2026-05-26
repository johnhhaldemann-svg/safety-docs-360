import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  retrieveMemoryForQuery: vi.fn(),
  retrieveApprovedKnowledge: vi.fn(),
  buildVerifiedSafetyAnswer: vi.fn(),
  recordGusAnswerAudit: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mocks.authorizeRequest,
  isAdminRole: (role?: string | null) => ["super_admin", "platform_admin", "admin"].includes(role ?? ""),
  normalizeAppRole: (role?: string | null) => role ?? "viewer",
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/companyMemory", () => ({ retrieveMemoryForQuery: mocks.retrieveMemoryForQuery }));
vi.mock("@/lib/gusLearning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gusLearning")>();
  return {
    ...actual,
    retrieveApprovedKnowledge: mocks.retrieveApprovedKnowledge,
    buildVerifiedSafetyAnswer: mocks.buildVerifiedSafetyAnswer,
    recordGusAnswerAudit: mocks.recordGusAnswerAudit,
  };
});

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/gus/verified-answer", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function expectResponse(response: Response | undefined): Response {
  if (!response) throw new Error("Expected route handler to return a response.");
  return response;
}

describe("Gus verified answer route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRequest.mockResolvedValue({ role: "field_user", user: { id: "user-1" }, supabase: {}, team: null });
    mocks.getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn(), rpc: vi.fn() });
    mocks.retrieveApprovedKnowledge.mockResolvedValue({
      ok: true,
      method: "hybrid",
      trace: { semanticCount: 1, keywordCount: 1, returnedCount: 1, candidateCount: 2 },
      items: [{ id: "knowledge-1" }, { id: "rejected-1" }],
    });
    mocks.retrieveMemoryForQuery.mockResolvedValue({ method: "keyword", chunks: [] });
    mocks.buildVerifiedSafetyAnswer.mockReturnValue({
      answerId: "answer-1",
      text: "Answer:\n- company policy: Use the approved control.",
      confidence: "High",
      citations: [{ knowledgeId: "knowledge-1" }],
      citationSnippets: [{ knowledgeId: "knowledge-1", excerpt: "Approved excerpt" }],
      statements: [{ knowledgeId: "knowledge-1", classification: "company_policy", text: "Use the approved control." }],
      qualitySignals: { averageQualityScore: 88, lowestQualityScore: 88, weakCitationCount: 0, expiredCitationCount: 0, selectedKnowledgeCount: 1 },
      unsupported: false,
      needsReview: false,
    });
    mocks.recordGusAnswerAudit.mockResolvedValue({ ok: true, audit: { id: "audit-1", retrieval_trace: { semanticCount: 1 } } });
  });

  it("persists an answer audit with selected and rejected candidates", async () => {
    const response = expectResponse(await POST(request({ question: "What policy applies?" })));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answerAuditId).toBe("audit-1");
    expect(mocks.recordGusAnswerAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        selectedKnowledgeIds: ["knowledge-1"],
        rejectedCandidateIds: ["rejected-1"],
        retrievalMethod: "hybrid",
      }),
    );
  });
});
