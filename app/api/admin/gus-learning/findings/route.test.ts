import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  approveResearchFinding: vi.fn(),
  updateResearchFindingStatus: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mocks.authorizeRequest,
  isAdminRole: (role?: string | null) => ["super_admin", "platform_admin", "admin"].includes(role ?? ""),
  normalizeAppRole: (role?: string | null) => role ?? "viewer",
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: mocks.getCompanyScope,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/gusLearning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gusLearning")>();
  return {
    ...actual,
    approveResearchFinding: mocks.approveResearchFinding,
    updateResearchFindingStatus: mocks.updateResearchFindingStatus,
  };
});

import { PATCH } from "./[id]/route";

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/admin/gus-learning/findings/finding-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function auth(role: string) {
  return { role, supabase: {}, team: null, user: { id: "user-1" } } as never;
}

const context = { params: Promise.resolve({ id: "finding-1" }) };

function expectResponse(response: Response | undefined): Response {
  if (!response) throw new Error("Expected route handler to return a response.");
  return response;
}

describe("Gus learning finding review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.approveResearchFinding.mockResolvedValue({ ok: true, knowledge: { id: "knowledge-1" } });
    mocks.updateResearchFindingStatus.mockResolvedValue({ ok: true, finding: { id: "finding-1" } });
  });

  it("blocks safety managers from approving official knowledge", async () => {
    mocks.authorizeRequest.mockResolvedValue(auth("safety_manager"));
    const response = expectResponse(await PATCH(
      request({
        action: "approve",
        approvedSummary: "summary",
        requiredControlType: "best_practice",
        reviewDueDate: "2027-01-01",
      }),
      context,
    ));
    expect(response.status).toBe(403);
    expect(mocks.approveResearchFinding).not.toHaveBeenCalled();
  });

  it("allows company admins to approve findings", async () => {
    mocks.authorizeRequest.mockResolvedValue(auth("company_admin"));
    const response = expectResponse(await PATCH(
      request({
        action: "approve",
        approvedSummary: "summary",
        requiredControlType: "best_practice",
        reviewDueDate: "2027-01-01",
      }),
      context,
    ));
    expect(response.status).toBe(200);
    expect(mocks.approveResearchFinding).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ findingId: "finding-1", companyId: "company-1", approvedBy: "user-1" }),
    );
  });

  it("allows safety managers to request more review without approving", async () => {
    mocks.authorizeRequest.mockResolvedValue(auth("safety_manager"));
    const response = expectResponse(await PATCH(request({ action: "request_more_review", reviewerNotes: "Need Wisconsin check." }), context));
    expect(response.status).toBe(200);
    expect(mocks.updateResearchFindingStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "needs_more_review", reviewerNotes: "Need Wisconsin check." }),
    );
  });
});
