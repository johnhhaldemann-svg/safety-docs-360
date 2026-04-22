import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  getDocumentBuilderTextConfig,
  parseCompletedCsepCompletenessReviewPostBody,
  runAdHocCsepCompletenessReview,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getDocumentBuilderTextConfig: vi.fn(),
  parseCompletedCsepCompletenessReviewPostBody: vi.fn(),
  runAdHocCsepCompletenessReview: vi.fn(),
}));

vi.mock("@/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac")>();
  return {
    ...actual,
    authorizeRequest,
  };
});
vi.mock("@/lib/parseGcProgramAiReviewPostBody", () => ({
  parseCompletedCsepCompletenessReviewPostBody,
}));
vi.mock("@/lib/documentBuilderTextSettings", () => ({
  getDocumentBuilderTextConfig,
}));
vi.mock("@/lib/csepCompletenessReviewBuilder", () => ({
  buildCsepBuilderExpectationSummary: vi.fn(() => [
    "Scope of Work: Describe the exact self-performed work.",
    "Emergency Procedures: State 911 wording and responder access.",
  ]),
}));
vi.mock("@/lib/runAdHocCsepCompletenessReview", () => ({
  runAdHocCsepCompletenessReview,
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/superadmin/csep-completeness-review", () => {
  it("allows super admins to run an ad hoc completed-CSEP review", async () => {
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
        additionalReviewerContext: "Check missing rescue planning.",
        document: {
          buffer: Buffer.from("doc"),
          fileName: "completed-csep.pdf",
        },
        siteDocuments: [],
      },
    });
    runAdHocCsepCompletenessReview.mockResolvedValue({
      ok: true,
      review: {
        reviewMode: "csep_completeness",
        executiveSummary: "Needs work.",
        scopeTradeAndHazardCoverage: "Incomplete.",
        regulatoryAndProgramStrengths: ["Structured sections are present.", "Some PPE is listed."],
        gapsRisksOrClarifications: [
          "Emergency rescue details are weak.",
          "Permit mapping is incomplete.",
        ],
        recommendedEditsBeforeApproval: ["Add rescue plan.", "Add permit matrix."],
        missingItemsChecklist: ["Could not verify rescue equipment staging."],
        builderAlignmentNotes: ["Scope of Work should identify the actual self-performed work."],
        sectionReviewNotes: [
          {
            sectionLabel: "Scope of Work",
            status: "missing",
            whatWasFound: "No clear scope section was confirmed.",
            whatNeedsWork: "Add a dedicated scope section with self-performed work only.",
            suggestedBuilderTarget:
              "Scope of Work: Describe the exact self-performed work and excluded interface trades.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            issue: "Emergency content is too thin.",
            documentExample: "No clear 911 wording was found.",
            preferredExample: "Call 911, direct responders to Gate 2, and notify the superintendent.",
            reviewerNote: "Match the builder's emergency package before issue.",
          },
        ],
        checklistDelta: ["Training evidence is weak."],
        overallAssessment: "needs_work",
      },
      disclaimer: "Internal only.",
      extraction: { ok: true, method: "pdf-text", truncated: false, annotations: [] },
      siteReferenceExtraction: [],
      fileName: "completed-csep.pdf",
    });

    const response = (await POST(
      new Request("https://example.com/api/superadmin/csep-completeness-review", {
        method: "POST",
      })
    ))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authorizeRequest).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
      })
    );
    expect(runAdHocCsepCompletenessReview).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalReviewerContext: "Check missing rescue planning.",
        builderExpectationSummary: expect.arrayContaining([
          expect.stringContaining("Scope of Work"),
        ]),
        document: expect.objectContaining({ fileName: "completed-csep.pdf" }),
      })
    );
    expect(body.review.missingItemsChecklist).toEqual([
      "Could not verify rescue equipment staging.",
    ]);
  });

  it("allows internal reviewers through the API route", async () => {
    authorizeRequest.mockResolvedValue({
      role: "internal_reviewer",
      supabase: {},
    });
    getDocumentBuilderTextConfig.mockResolvedValue({
      builders: { csep: { sections: [] }, site_builder: { sections: [] } },
    });
    parseCompletedCsepCompletenessReviewPostBody.mockResolvedValue({
      ok: true,
      data: {
        additionalReviewerContext: "",
        document: {
          buffer: Buffer.from("doc"),
          fileName: "completed-csep.docx",
        },
        siteDocuments: [
          {
            buffer: Buffer.from("ref"),
            fileName: "gc-rules.pdf",
          },
          {
            buffer: Buffer.from("ref2"),
            fileName: "site-access.docx",
          },
        ],
      },
    });
    runAdHocCsepCompletenessReview.mockResolvedValue({
      ok: true,
      review: {
        reviewMode: "csep_completeness",
        executiveSummary: "Needs work.",
        scopeTradeAndHazardCoverage: "Incomplete.",
        regulatoryAndProgramStrengths: ["Structured sections are present.", "Some PPE is listed."],
        gapsRisksOrClarifications: [
          "Emergency rescue details are weak.",
          "Permit mapping is incomplete.",
        ],
        recommendedEditsBeforeApproval: ["Add rescue plan.", "Add permit matrix."],
        missingItemsChecklist: ["Could not verify emergency procedures."],
        builderAlignmentNotes: ["Emergency Procedures should include responder access wording."],
        sectionReviewNotes: [
          {
            sectionLabel: "Emergency Procedures",
            status: "partial",
            whatWasFound: "Some emergency text is present, but it is thin.",
            whatNeedsWork: "Expand responder access and reporting steps.",
            suggestedBuilderTarget:
              "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            issue: "Emergency content is too thin.",
            documentExample: "Emergency phone number not shown.",
            preferredExample: "Call 911, notify site supervision, and meet responders at the main gate.",
            reviewerNote: "Add site access wording before approval.",
          },
        ],
        checklistDelta: [],
        overallAssessment: "needs_work",
      },
      disclaimer: "Internal only.",
      extraction: { ok: true, method: "docx-text", truncated: false, annotations: [] },
      siteReferenceExtraction: [
        {
          fileName: "gc-rules.pdf",
          ok: true,
          method: "pdf-text",
          truncated: false,
          annotations: [],
        },
        {
          fileName: "site-access.docx",
          ok: true,
          method: "docx-text",
          truncated: false,
          annotations: [],
        },
      ],
      fileName: "completed-csep.docx",
    });

    const response = (await POST(
      new Request("https://example.com/api/superadmin/csep-completeness-review", {
        method: "POST",
      })
    ))!;

    expect(response.status).toBe(200);
  });

  it("rejects non-reviewer roles even if they are authenticated", async () => {
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
    });

    const response = (await POST(
      new Request("https://example.com/api/superadmin/csep-completeness-review", {
        method: "POST",
      })
    ))!;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("super admins or internal reviewers");
    expect(parseCompletedCsepCompletenessReviewPostBody).not.toHaveBeenCalled();
  });
});
