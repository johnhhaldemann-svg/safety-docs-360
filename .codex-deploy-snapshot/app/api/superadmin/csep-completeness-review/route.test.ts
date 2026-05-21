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
            problem: "Scope of Work is not present in the body of the CSEP.",
            requiredOutput: "Insert a Scope of Work section that describes the exact self-performed work and excluded interface trades.",
            acceptanceCheck: "Scope of Work lists the active tasks grouped under the correct trade.",
            doNot: "Do not include tasks from other trades.",
            whatWasFound: "No clear scope section was confirmed.",
            whatNeedsWork: "Add a dedicated scope section with self-performed work only.",
            suggestedBuilderTarget:
              "Scope of Work: Describe the exact self-performed work and excluded interface trades.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            sentiment: "negative",
            problem: "Emergency Procedures does not contain 911 wording or responder access.",
            requiredOutput: "Replace the emergency paragraph with: 'Call 911, direct responders to Gate 2, and notify the superintendent.'",
            acceptanceCheck: "Emergency Procedures contains 911 wording, responder gate, and named contact.",
            doNot: "Do not leave emergency content as a generic paragraph.",
            issue: "Emergency content is too thin.",
            documentExample: "No clear 911 wording was found.",
            preferredExample: "Call 911, direct responders to Gate 2, and notify the superintendent.",
            reviewerNote: "Insert the 911 wording and responder gate above.",
          },
        ],
        checklistDelta: ["Training evidence is weak."],
        overallAssessment: "needs_work",
        complianceSummary: {
          compliancePercent: 25,
          presentCount: 0,
          partialCount: 1,
          missingCount: 1,
          totalSections: 2,
        },
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
    expect(body.review.complianceSummary.compliancePercent).toBe(25);
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
            problem: "Emergency Procedures has some text but does not name 911 wording, responder access, or assembly area.",
            requiredOutput: "Insert 911 wording, named site contact, responder gate, and assembly area as a labeled subsection.",
            acceptanceCheck: "Emergency Procedures contains 911 wording, named contact, responder gate, and assembly area.",
            doNot: "Do not leave 911 wording or responder access as placeholders.",
            whatWasFound: "Some emergency text is present, but it is thin.",
            whatNeedsWork: "Expand responder access and reporting steps.",
            suggestedBuilderTarget:
              "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            sentiment: "negative",
            problem: "Emergency Procedures does not show the site phone number or named site supervision contact.",
            requiredOutput: "Replace the emergency paragraph with: 'Call 911, notify site supervision, and meet responders at the main gate.'",
            acceptanceCheck: "Emergency Procedures contains 911, named supervision contact, and the responder gate.",
            doNot: "Do not leave the emergency phone number as a placeholder.",
            issue: "Emergency content is too thin.",
            documentExample: "Emergency phone number not shown.",
            preferredExample: "Call 911, notify site supervision, and meet responders at the main gate.",
            reviewerNote: "Insert the 911 / supervision / gate wording above.",
          },
        ],
        checklistDelta: [],
        overallAssessment: "needs_work",
        complianceSummary: {
          compliancePercent: 50,
          presentCount: 0,
          partialCount: 1,
          missingCount: 0,
          totalSections: 1,
        },
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
