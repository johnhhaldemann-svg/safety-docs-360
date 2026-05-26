import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  updateGusLearningReviewItemStatus: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mocks.authorizeRequest,
  isAdminRole: (role?: string | null) => ["super_admin", "platform_admin", "admin"].includes(role ?? ""),
  normalizeAppRole: (role?: string | null) => role ?? "viewer",
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/gusLearning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gusLearning")>();
  return {
    ...actual,
    updateGusLearningReviewItemStatus: mocks.updateGusLearningReviewItemStatus,
  };
});

import { PATCH } from "./[id]/route";

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/admin/gus-learning/review-items/review-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function auth(role: string) {
  return { role, supabase: {}, team: null, user: { id: "user-1" } } as never;
}

const context = { params: Promise.resolve({ id: "review-1" }) };

function expectResponse(response: Response | undefined): Response {
  if (!response) throw new Error("Expected route handler to return a response.");
  return response;
}

describe("Gus learning review item route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.updateGusLearningReviewItemStatus.mockResolvedValue({ ok: true, reviewItem: { id: "review-1", status: "resolved" } });
  });

  it("allows safety managers to mark review items in review", async () => {
    mocks.authorizeRequest.mockResolvedValue(auth("safety_manager"));
    const response = expectResponse(await PATCH(request({ action: "start_review" }), context));
    expect(response.status).toBe(200);
    expect(mocks.updateGusLearningReviewItemStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reviewItemId: "review-1", companyId: "company-1", status: "in_review" }),
    );
  });

  it("blocks regular users from review item mutations", async () => {
    mocks.authorizeRequest.mockResolvedValue(auth("field_user"));
    const response = expectResponse(await PATCH(request({ action: "resolve" }), context));
    expect(response.status).toBe(403);
    expect(mocks.updateGusLearningReviewItemStatus).not.toHaveBeenCalled();
  });
});
