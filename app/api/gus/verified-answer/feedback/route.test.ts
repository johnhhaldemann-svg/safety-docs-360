import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  recordGusAnswerFeedback: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest: mocks.authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/gusLearning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gusLearning")>();
  return { ...actual, recordGusAnswerFeedback: mocks.recordGusAnswerFeedback };
});

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/gus/verified-answer/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function expectResponse(response: Response | undefined): Response {
  if (!response) throw new Error("Expected route handler to return a response.");
  return response;
}

describe("Gus verified answer feedback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRequest.mockResolvedValue({ role: "field_user", user: { id: "user-1" }, supabase: {}, team: null });
    mocks.getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.recordGusAnswerFeedback.mockResolvedValue({ ok: true, feedback: { id: "feedback-1", needs_admin_review: true } });
  });

  it("records unsafe feedback for admin review", async () => {
    const response = expectResponse(await POST(request({ answerId: "answer-1", feedbackType: "unsafe", comment: "Bad advice" })));
    expect(response.status).toBe(201);
    expect(mocks.recordGusAnswerFeedback).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        answerId: "answer-1",
        userId: "user-1",
        companyId: "company-1",
        feedbackType: "unsafe",
      }),
    );
  });

  it("rejects invalid feedback types", async () => {
    const response = expectResponse(await POST(request({ answerId: "answer-1", feedbackType: "dangerous-ish" })));
    expect(response.status).toBe(400);
    expect(mocks.recordGusAnswerFeedback).not.toHaveBeenCalled();
  });
});
