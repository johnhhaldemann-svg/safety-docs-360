import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  getDocumentBuilderTextConfig,
  parseCompletedCsepCompletenessReviewPostBody,
  runAdHocCompletedCsepRebuild,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getDocumentBuilderTextConfig: vi.fn(),
  parseCompletedCsepCompletenessReviewPostBody: vi.fn(),
  runAdHocCompletedCsepRebuild: vi.fn(),
}));

vi.mock("@/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac")>();
  return {
    ...actual,
    authorizeRequest,
  };
});
vi.mock("@/lib/documentBuilderTextSettings", () => ({
  getDocumentBuilderTextConfig,
}));
vi.mock("@/lib/parseGcProgramAiReviewPostBody", () => ({
  parseCompletedCsepCompletenessReviewPostBody,
}));
vi.mock("@/lib/csepCompletenessReviewBuilder", () => ({
  buildCsepBuilderExpectationSummary: vi.fn(() => [
    "Scope of Work: Describe the exact self-performed work.",
    "Emergency Procedures: State 911 wording and responder access.",
  ]),
}));
vi.mock("@/lib/runAdHocCompletedCsepRebuild", () => ({
  runAdHocCompletedCsepRebuild,
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/superadmin/csep-completeness-review/rebuild", () => {
  it("returns the rebuilt DOCX for an allowed reviewer", async () => {
    authorizeRequest.mockResolvedValue({
      role: "super_admin",
      supabase: {},
    });
    getDocumentBuilderTextConfig.mockResolvedValue({
      builders: { csep: { sections: [] }, site_builder: { sections: [] } },
    });
    parseCompletedCsepCompletenessReviewPostBody.mockResolvedValue({
      ok: true,
      data: {
        additionalReviewerContext: "Rebuild it into our format.",
        document: {
          buffer: Buffer.from("doc"),
          fileName: "outside-csep.docx",
        },
        siteDocuments: [],
      },
    });
    runAdHocCompletedCsepRebuild.mockResolvedValue({
      ok: true,
      filename: "outside-csep_rebuilt.docx",
      body: new Uint8Array([1, 2, 3]),
    });

    const response = (await POST(
      new Request("https://example.com/api/superadmin/csep-completeness-review/rebuild", {
        method: "POST",
      })
    ))!;

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers.get("Content-Disposition")).toContain("outside-csep_rebuilt.docx");
    expect(runAdHocCompletedCsepRebuild).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalReviewerContext: "Rebuild it into our format.",
        builderExpectationSummary: expect.arrayContaining([
          expect.stringContaining("Scope of Work"),
        ]),
      })
    );
  });

  it("rejects non-reviewer roles", async () => {
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
    });

    const response = (await POST(
      new Request("https://example.com/api/superadmin/csep-completeness-review/rebuild", {
        method: "POST",
      })
    ))!;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("super admins or internal reviewers");
    expect(parseCompletedCsepCompletenessReviewPostBody).not.toHaveBeenCalled();
  });
});
