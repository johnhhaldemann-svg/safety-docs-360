import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  parseBuilderProgramAiReviewPostBody,
  runBuilderProgramDocumentAiReview,
  createSupabaseAdminClient,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  parseBuilderProgramAiReviewPostBody: vi.fn(),
  runBuilderProgramDocumentAiReview: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac")>();
  return {
    ...actual,
    authorizeRequest,
  };
});
vi.mock("@/lib/parseGcProgramAiReviewPostBody", () => ({
  parseBuilderProgramAiReviewPostBody,
}));
vi.mock("@/lib/runBuilderProgramAiReview", () => ({
  runBuilderProgramDocumentAiReview,
}));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin document ai review route", () => {
  it("allows superadmin users with internal admin access to rerun AI review", async () => {
    authorizeRequest.mockResolvedValue({
      role: "super_admin",
    });
    createSupabaseAdminClient.mockReturnValue({ service: "admin" });
    parseBuilderProgramAiReviewPostBody.mockResolvedValue({
      ok: true,
      data: {
        additionalReviewerContext: "Focus on missing controls.",
        siteDocument: null,
      },
    });
    runBuilderProgramDocumentAiReview.mockResolvedValue({
      ok: true,
      review: { summary: "Reviewed" },
      disclaimer: "Draft only.",
      extraction: { ok: true, method: "test", truncated: false, annotations: [] },
      siteReferenceExtraction: null,
      documentId: "doc-1",
      programLabel: "CSEP",
    });

    const response = await POST(
      new Request("https://example.com/api/admin/documents/doc-1/ai-review", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authorizeRequest).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
      })
    );
    expect(runBuilderProgramDocumentAiReview).toHaveBeenCalledWith(
      { service: "admin" },
      "doc-1",
      "Focus on missing controls.",
      null
    );
    expect(body).toMatchObject({
      documentId: "doc-1",
      programLabel: "CSEP",
    });
  });
});
