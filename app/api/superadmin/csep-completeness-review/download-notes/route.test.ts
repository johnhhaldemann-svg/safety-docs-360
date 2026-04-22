import { afterEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, renderCsepCompletenessReviewNotesDocx, annotateCsepReviewDocx } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  renderCsepCompletenessReviewNotesDocx: vi.fn(),
  annotateCsepReviewDocx: vi.fn(),
}));

vi.mock("@/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac")>();
  return {
    ...actual,
    authorizeRequest,
  };
});

vi.mock("@/lib/csepCompletenessReviewDocx", () => ({
  renderCsepCompletenessReviewNotesDocx,
}));
vi.mock("@/lib/annotateCsepReviewDocx", () => ({
  annotateCsepReviewDocx,
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/superadmin/csep-completeness-review/download-notes", () => {
  it("returns a DOCX notes file for an authorized review", async () => {
    authorizeRequest.mockResolvedValue({
      role: "super_admin",
    });
    renderCsepCompletenessReviewNotesDocx.mockResolvedValue(Buffer.from("docx-data"));

    const response = (await POST(
      new Request("https://example.com/api/superadmin/csep-completeness-review/download-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "completed-csep.docx",
          disclaimer: "Internal only.",
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
            builderAlignmentNotes: ["Emergency Procedures should include responder access wording."],
            sectionReviewNotes: [
              {
                sectionLabel: "Emergency Procedures",
                status: "missing",
                whatWasFound: "No field-usable emergency section was found.",
                whatNeedsWork: "Add a clear call chain and responder entry instructions.",
                suggestedBuilderTarget:
                  "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
              },
            ],
            detailedFindings: [
              {
                sectionLabel: "Emergency Procedures",
                issue: "Emergency content is too thin.",
                documentExample: "Emergency phone number not shown.",
                preferredExample:
                  "Call 911, notify site supervision, and meet responders at the main gate.",
                reviewerNote: "Add site access wording before approval.",
              },
            ],
            checklistDelta: [],
            documentQualityIssues: [],
            noteCoverage: [],
            overallAssessment: "needs_work",
          },
        }),
      })
    ))!;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers.get("content-disposition")).toContain("completed-csep_review_notes.docx");
  });

  it("returns an annotated DOCX when the original document is uploaded with the review", async () => {
    authorizeRequest.mockResolvedValue({
      role: "super_admin",
    });
    annotateCsepReviewDocx.mockResolvedValue(Buffer.from("annotated-docx"));

    const formData = new FormData();
    formData.append(
      "document",
      new File([Buffer.from("docx")], "completed-csep.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    );
    formData.append("fileName", "completed-csep.docx");
    formData.append(
      "review",
      JSON.stringify({
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
        builderAlignmentNotes: ["Emergency Procedures should include responder access wording."],
        sectionReviewNotes: [],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            issue: "Emergency content is too thin.",
            documentExample: "Emergency phone number not shown.",
            preferredExample:
              "Call 911, notify site supervision, and meet responders at the main gate.",
            reviewerNote: "Add site access wording before approval.",
          },
        ],
        checklistDelta: [],
        documentQualityIssues: [],
        noteCoverage: [],
        overallAssessment: "needs_work",
      })
    );

    const response = (await POST(
      new Request("https://example.com/api/superadmin/csep-completeness-review/download-notes", {
        method: "POST",
        body: formData,
      })
    ))!;

    expect(response.status).toBe(200);
    expect(annotateCsepReviewDocx).toHaveBeenCalled();
    expect(response.headers.get("content-disposition")).toContain("completed-csep_annotated_review.docx");
  });
});
