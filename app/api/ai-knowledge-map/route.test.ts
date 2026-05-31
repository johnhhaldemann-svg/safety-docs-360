import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/superadmin/aiEngineAuth", () => ({
  authorizeSuperadminAiEngineRequest: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/aiKnowledgeMap/repository", () => ({
  getKnowledgeGraphPayload: vi.fn(async () => ({
    companies: [{ id: "company-1", name: "Demo Company" }],
    selectedCompanyId: "company-1",
    nodes: [],
    edges: [],
    validationQueue: [],
    summary: {
      nodeCount: 0,
      edgeCount: 0,
      dataSourceCount: 0,
      highRiskNodeCount: 0,
      lowConfidenceCount: 0,
      unreviewedRelationshipCount: 0,
      pendingReviewCount: 0,
      indexedVectorCount: 0,
      companyCount: 1,
      latestUpdate: null,
    },
    generatedAt: "2026-05-28T00:00:00.000Z",
    warnings: [],
    demo: false,
  })),
  rebuildKnowledgeIndex: vi.fn(async () => ({ ok: true, companyId: "company-1", insertedOrUpdatedNodes: 1, insertedOrUpdatedEdges: 2, vectorRows: 1, embeddingAttempts: 0, warnings: [], generatedAt: "2026-05-28T00:00:00.000Z" })),
  recalculateKnowledgeRelationships: vi.fn(async () => ({ ok: true, companyId: "company-1", insertedOrUpdatedEdges: 0, candidateEdges: 3, reviewRequiredCount: 3, generatedAt: "2026-05-28T00:00:00.000Z" })),
  updateKnowledgeRelationshipValidation: vi.fn(async () => ({ ok: true, edge: { id: "edge-1" }, reviewedAt: "2026-05-28T00:00:00.000Z" })),
  saveKnowledgeMapView: vi.fn(async () => ({ ok: true, view: { id: "view-1" } })),
  listKnowledgeIngestCandidates: vi.fn(async () => ({ candidates: [{ id: "candidate-1", title: "Hot Work Permit" }], count: 1 })),
  getKnowledgeIngestCandidate: vi.fn(async () => ({ candidate: { id: "candidate-1", title: "Hot Work Permit" } })),
  reviewKnowledgeIngestCandidates: vi.fn(async () => ({ ok: true, reviewed: 1, promoted: 1, errors: [] })),
  promoteApprovedKnowledgeCandidates: vi.fn(async () => ({ ok: true, promoted: 1, skipped: 0, errors: [] })),
}));

import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";
import {
  rebuildKnowledgeIndex,
  recalculateKnowledgeRelationships,
  updateKnowledgeRelationshipValidation,
  listKnowledgeIngestCandidates,
  reviewKnowledgeIngestCandidates,
  promoteApprovedKnowledgeCandidates,
} from "@/lib/aiKnowledgeMap/repository";
import * as nodesRoute from "./nodes/route";
import * as rebuildRoute from "./rebuild-index/route";
import * as recalculateRoute from "./recalculate-risk-connections/route";
import * as validateRoute from "./validate-relationship/route";
import * as candidatesRoute from "./candidates/route";
import * as approveCandidateRoute from "./approve-candidate/route";
import * as rejectCandidateRoute from "./reject-candidate/route";
import * as promoteApprovedRoute from "./promote-approved/route";

const mockedAuthorize = vi.mocked(authorizeSuperadminAiEngineRequest);

function allow() {
  mockedAuthorize.mockResolvedValue({ role: "super_admin", user: { id: "super-1" }, supabase: {} } as never);
}

function deny() {
  mockedAuthorize.mockResolvedValue({ error: Response.json({ error: "Super admin access required." }, { status: 403 }) } as never);
}

function expectResponse(response: Response | undefined) {
  if (!response) throw new Error("Expected route handler to return a response");
  return response;
}

describe("/api/ai-knowledge-map", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-Super Admin reads and rebuilds", async () => {
    deny();
    expect(await nodesRoute.GET(new Request("https://example.com/api/ai-knowledge-map/nodes"))).toMatchObject({ status: 403 });
    expect(await rebuildRoute.POST(new Request("https://example.com/api/ai-knowledge-map/rebuild-index", { method: "POST", body: JSON.stringify({ companyId: "company-1" }) }))).toMatchObject({ status: 403 });
  });

  it("allows Super Admin graph reads and management actions", async () => {
    allow();
    await expect(nodesRoute.GET(new Request("https://example.com/api/ai-knowledge-map/nodes?companyId=company-1&q=hot%20work"))).resolves.toMatchObject({ status: 200 });
    await expect(rebuildRoute.POST(new Request("https://example.com/api/ai-knowledge-map/rebuild-index", { method: "POST", body: JSON.stringify({ companyId: "company-1", generateEmbeddings: true }) }))).resolves.toMatchObject({ status: 201 });
    await expect(recalculateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/recalculate-risk-connections", { method: "POST", body: JSON.stringify({ companyId: "company-1" }) }))).resolves.toMatchObject({ status: 200 });
    await expect(validateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/validate-relationship", { method: "POST", body: JSON.stringify({ edgeId: "edge-1", status: "approved" }) }))).resolves.toMatchObject({ status: 200 });

    expect(rebuildKnowledgeIndex).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ companyId: "company-1", actorUserId: "super-1", generateEmbeddings: true }));
    expect(recalculateKnowledgeRelationships).toHaveBeenCalledWith(expect.anything(), { companyId: "company-1", actorUserId: "super-1" });
    expect(updateKnowledgeRelationshipValidation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ edgeId: "edge-1", status: "approved", actorUserId: "super-1" }));
  });

  it("keeps candidate review APIs Super Admin-only", async () => {
    deny();
    await expect(candidatesRoute.GET(new Request("https://example.com/api/ai-knowledge-map/candidates?companyId=company-1"))).resolves.toMatchObject({ status: 403 });
    await expect(approveCandidateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/approve-candidate", { method: "POST", body: JSON.stringify({ candidateId: "candidate-1" }) }))).resolves.toMatchObject({ status: 403 });
  });

  it("allows Super Admin candidate review and promotion", async () => {
    allow();
    await expect(candidatesRoute.GET(new Request("https://example.com/api/ai-knowledge-map/candidates?companyId=company-1&status=pending_review"))).resolves.toMatchObject({ status: 200 });
    await expect(approveCandidateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/approve-candidate", { method: "POST", body: JSON.stringify({ candidateId: "candidate-1" }) }))).resolves.toMatchObject({ status: 200 });
    await expect(rejectCandidateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/reject-candidate", { method: "POST", body: JSON.stringify({ candidateIds: ["candidate-2"], status: "incorrect", reason: "Source evidence does not support this relationship." }) }))).resolves.toMatchObject({ status: 200 });
    await expect(promoteApprovedRoute.POST(new Request("https://example.com/api/ai-knowledge-map/promote-approved", { method: "POST", body: JSON.stringify({ companyId: "company-1", limit: 25 }) }))).resolves.toMatchObject({ status: 200 });

    expect(listKnowledgeIngestCandidates).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ companyId: "company-1", status: "pending_review" }));
    expect(reviewKnowledgeIngestCandidates).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ candidateIds: ["candidate-1"], status: "approved", actorUserId: "super-1", promoteApproved: true }));
    expect(reviewKnowledgeIngestCandidates).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ candidateIds: ["candidate-2"], status: "incorrect", actorUserId: "super-1", promoteApproved: false, reason: "Source evidence does not support this relationship." }));
    expect(promoteApprovedKnowledgeCandidates).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ companyId: "company-1", limit: 25, actorUserId: "super-1" }));
  });

  it("validates required management request fields", async () => {
    allow();
    const rebuild = expectResponse(await rebuildRoute.POST(new Request("https://example.com/api/ai-knowledge-map/rebuild-index", { method: "POST", body: JSON.stringify({}) })));
    const validate = expectResponse(await validateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/validate-relationship", { method: "POST", body: JSON.stringify({ edgeId: "edge-1", status: "pending_review" }) })));
    expect(rebuild.status).toBe(400);
    expect(validate.status).toBe(400);
  });

  it("rejects all-company write actions server-side", async () => {
    allow();
    await expect(rebuildRoute.POST(new Request("https://example.com/api/ai-knowledge-map/rebuild-index", { method: "POST", body: JSON.stringify({ companyId: "all" }) }))).resolves.toMatchObject({ status: 400 });
    await expect(recalculateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/recalculate-risk-connections", { method: "POST", body: JSON.stringify({ companyId: "all" }) }))).resolves.toMatchObject({ status: 400 });
    await expect(promoteApprovedRoute.POST(new Request("https://example.com/api/ai-knowledge-map/promote-approved", { method: "POST", body: JSON.stringify({ companyId: "all" }) }))).resolves.toMatchObject({ status: 400 });
  });

  it("requires meaningful reasons for negative review actions", async () => {
    allow();
    await expect(validateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/validate-relationship", { method: "POST", body: JSON.stringify({ edgeId: "edge-1", status: "rejected", reason: "bad" }) }))).resolves.toMatchObject({ status: 400 });
    await expect(rejectCandidateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/reject-candidate", { method: "POST", body: JSON.stringify({ candidateId: "candidate-1", status: "incorrect" }) }))).resolves.toMatchObject({ status: 400 });
  });

  it("returns readable validation errors when a relationship cannot be saved", async () => {
    allow();
    vi.mocked(updateKnowledgeRelationshipValidation).mockRejectedValueOnce(new Error("This relationship is display-only or no longer exists in trusted graph memory."));

    const response = expectResponse(await validateRoute.POST(new Request("https://example.com/api/ai-knowledge-map/validate-relationship", {
      method: "POST",
      body: JSON.stringify({ edgeId: "generated-edge-1", status: "approved" }),
    })));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("display-only");
  });
});
