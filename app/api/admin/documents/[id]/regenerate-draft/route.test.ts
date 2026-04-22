import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  loadGeneratedDocumentDraft,
  renderGeneratedCsepDocx,
  renderSafetyPlanDocx,
  uploadDocumentsBucketObject,
  isCsepExportValidationError,
  getCsepExportValidationDetail,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  loadGeneratedDocumentDraft: vi.fn(),
  renderGeneratedCsepDocx: vi.fn(),
  renderSafetyPlanDocx: vi.fn(),
  uploadDocumentsBucketObject: vi.fn(),
  isCsepExportValidationError: vi.fn(),
  getCsepExportValidationDetail: vi.fn(),
}));

vi.mock("@/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac")>();
  return {
    ...actual,
    authorizeRequest,
  };
});
vi.mock("@/lib/safety-intelligence/repository", () => ({
  loadGeneratedDocumentDraft,
}));
vi.mock("@/lib/csepDocxRenderer", () => ({
  renderGeneratedCsepDocx,
}));
vi.mock("@/lib/safety-intelligence/documents/render", () => ({
  renderSafetyPlanDocx,
}));
vi.mock("@/lib/supabaseStorageServer", () => ({
  uploadDocumentsBucketObject,
}));
vi.mock("@/lib/csepExportValidation", () => ({
  isCsepExportValidationError,
  getCsepExportValidationDetail,
}));
vi.mock("@/lib/serverLog", () => ({
  serverLog: vi.fn(),
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin regenerate draft route", () => {
  it("rebuilds and overwrites a stored CSEP draft", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "doc-1",
        document_type: "CSEP",
        status: "submitted",
        draft_file_path: "drafts/user/doc-1/csep.docx",
        generated_document_id: "generated-1",
      },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    authorizeRequest.mockResolvedValue({
      supabase: { from },
      user: { email: "admin@example.com" },
    });
    loadGeneratedDocumentDraft.mockResolvedValue({ title: "Draft" });
    renderGeneratedCsepDocx.mockResolvedValue({ body: new Uint8Array([1, 2, 3]) });
    uploadDocumentsBucketObject.mockResolvedValue({
      ok: true,
      key: "drafts/user/doc-1/csep.docx",
    });

    const response = await POST(
      new Request("https://example.com/api/admin/documents/doc-1/regenerate-draft", {
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
      expect.objectContaining({ requirePermission: "can_approve_documents" })
    );
    expect(loadGeneratedDocumentDraft).toHaveBeenCalledWith({ from }, "generated-1");
    expect(renderGeneratedCsepDocx).toHaveBeenCalledTimes(1);
    expect(uploadDocumentsBucketObject).toHaveBeenCalledWith(
      "drafts/user/doc-1/csep.docx",
      expect.any(Uint8Array),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      { upsert: true }
    );
    expect(body).toMatchObject({
      success: true,
      documentId: "doc-1",
      draftFilePath: "drafts/user/doc-1/csep.docx",
    });
  });

  it("returns a 409 when CSEP export validation still fails", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "doc-1",
        document_type: "CSEP",
        status: "submitted",
        draft_file_path: "drafts/user/doc-1/csep.docx",
        generated_document_id: "generated-1",
      },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const validationError = new Error("bad export");

    authorizeRequest.mockResolvedValue({
      supabase: { from },
      user: { email: "admin@example.com" },
    });
    loadGeneratedDocumentDraft.mockResolvedValue({ title: "Draft" });
    renderGeneratedCsepDocx.mockRejectedValue(validationError);
    isCsepExportValidationError.mockReturnValue(true);
    getCsepExportValidationDetail.mockReturnValue(
      'Source: Subsection paragraph: Example / 1 = "TBD by contractor before issue."'
    );

    const response = await POST(
      new Request("https://example.com/api/admin/documents/doc-1/regenerate-draft", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    if (!response) {
      throw new Error("Expected a response.");
    }

    const body = await response.json();

    expect(response.status).toBe(409);
    expect(uploadDocumentsBucketObject).not.toHaveBeenCalled();
    expect(body.error).toContain("This CSEP draft is not ready to regenerate");
    expect(body.error).toContain("Source:");
  });
});
