import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

const { extractBuilderReviewDocumentText, generateBuilderProgramAiReview, renderGeneratedCsepDocx } =
  vi.hoisted(() => ({
    extractBuilderReviewDocumentText: vi.fn(),
    generateBuilderProgramAiReview: vi.fn(),
    renderGeneratedCsepDocx: vi.fn(),
  }));

vi.mock("@/lib/builderDocumentAiReview", () => ({
  extractBuilderReviewDocumentText,
  generateBuilderProgramAiReview,
}));

vi.mock("@/lib/csepDocxRenderer", () => ({
  renderGeneratedCsepDocx,
}));

import { runAdHocCompletedCsepRebuild } from "./runAdHocCompletedCsepRebuild";

describe("runAdHocCompletedCsepRebuild", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("builds and renders a Safety360 draft even when it falls back without OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;

    extractBuilderReviewDocumentText.mockResolvedValue({
      ok: true,
      text: [
        "1.0 Project Scope",
        "Set structural steel, install decking, and stage deliveries at the south laydown area.",
        "6.0 Emergency Procedures",
        "Call 911 and direct responders to Gate 3 on River Road.",
        "- Notify the superintendent, project safety manager, and GC immediately.",
        "- Move crews to the primary assembly point at the east parking lot.",
        "15.0 Permits",
        "- Hot work permit required for welding and torch cutting.",
        "- Lift plan required before critical picks.",
      ].join("\n"),
      method: "docx-text",
      truncated: false,
      annotations: [],
    });
    generateBuilderProgramAiReview.mockResolvedValue({
      review: {
        reviewMode: "csep_completeness",
        executiveSummary: "Needs work.",
        scopeTradeAndHazardCoverage: "Scope and emergency content need to be tightened up.",
        regulatoryAndProgramStrengths: ["Some project facts are present.", "Basic structure exists."],
        gapsRisksOrClarifications: ["Emergency section is weak.", "Permit logic is not clear."],
        recommendedEditsBeforeApproval: ["Add clearer emergency language.", "Clarify permits."],
        missingItemsChecklist: ["Could not verify a full emergency response package."],
        builderAlignmentNotes: ["Scope of Work: Describe the exact self-performed work."],
        sectionReviewNotes: [],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            issue: "The emergency section still feels too thin.",
            documentExample: "Emergency procedures are limited.",
            preferredExample:
              "Emergency Procedures: State 911 wording, responder access, assembly point, and notification chain.",
            reviewerNote: "Build this out into a complete site-specific emergency section.",
            referenceSupport:
              "This should line up with any uploaded site emergency routing or responder access requirements.",
            whyItMatters:
              "It matters because the crew needs clear emergency direction they can actually follow in the field.",
          },
        ],
        checklistDelta: [],
        documentQualityIssues: [],
        noteCoverage: [],
        overallAssessment: "needs_work",
      },
      disclaimer: "Internal only.",
    });

    let capturedDraft: GeneratedSafetyPlanDraft | null = null;
    renderGeneratedCsepDocx.mockImplementation(async (draft: GeneratedSafetyPlanDraft) => {
      capturedDraft = draft;
      return {
        filename: "rebuilt.docx",
        body: new Uint8Array([1, 2, 3]),
      };
    });

    const result = await runAdHocCompletedCsepRebuild({
      document: {
        buffer: Buffer.from("doc"),
        fileName: "outside-csep.docx",
      },
      additionalReviewerContext: "Fix it into our format.",
      builderExpectationSummary: [
        "Scope of Work: Describe the exact self-performed work.",
        "Emergency Procedures: State 911 wording and responder access.",
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected rebuild to succeed.");
    }
    expect(result.filename).toBe("rebuilt_rebuilt.docx");
    expect(renderGeneratedCsepDocx).toHaveBeenCalledTimes(1);
    if (!capturedDraft) {
      throw new Error("Expected renderGeneratedCsepDocx to receive a draft.");
    }
    const draft: GeneratedSafetyPlanDraft = capturedDraft;
    expect(draft.documentType).toBe("csep");
    expect(draft.builderSnapshot).toEqual(
      expect.objectContaining({
        selected_format_sections: expect.arrayContaining([
          "company_overview_and_safety_philosophy",
          "emergency_preparedness_and_response",
        ]),
      })
    );
    expect(
      draft.sectionMap.find((section) => section.key === "emergency_preparedness_and_response")?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining("Emergency Procedures"),
          bullets: expect.arrayContaining([
            expect.stringContaining("Notify the superintendent"),
            expect.stringContaining("Move crews to the primary assembly point"),
          ]),
        }),
      ])
    );
    expect(
      draft.sectionMap.find((section) => section.key === "permits_and_forms")?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining("Permits"),
        }),
      ])
    );
  });

  it("falls back to local draft when OpenAI rebuild request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn(async () => new Response("upstream failure", { status: 502 })) as typeof fetch;

    extractBuilderReviewDocumentText.mockResolvedValue({
      ok: true,
      text: [
        "1.0 Project Scope",
        "Set structural steel, install decking, stage deliveries, and coordinate crane picks in the south laydown area.",
        "6.0 Emergency Procedures",
        "Call 911 and direct responders to Gate 3 on River Road. Notify the superintendent and project safety manager immediately.",
        "15.0 Permits",
        "Hot work permit required for welding and torch cutting. Lift plan required before critical picks.",
      ].join("\n"),
      method: "docx-text",
      truncated: false,
      annotations: [],
    });
    generateBuilderProgramAiReview.mockResolvedValue({
      review: {
        reviewMode: "csep_completeness",
        executiveSummary: "Needs work.",
        scopeTradeAndHazardCoverage: "Scope and emergency content need to be tightened up.",
        regulatoryAndProgramStrengths: ["Some project facts are present.", "Basic structure exists."],
        gapsRisksOrClarifications: ["Emergency section is weak.", "Permit logic is not clear."],
        recommendedEditsBeforeApproval: ["Add clearer emergency language.", "Clarify permits."],
        missingItemsChecklist: ["Could not verify a full emergency response package."],
        builderAlignmentNotes: ["Scope of Work: Describe the exact self-performed work."],
        sectionReviewNotes: [],
        detailedFindings: [],
        checklistDelta: [],
        documentQualityIssues: [],
        noteCoverage: [],
        overallAssessment: "needs_work",
      },
      disclaimer: "Internal only.",
    });
    renderGeneratedCsepDocx.mockResolvedValue({
      filename: "rebuilt.docx",
      body: new Uint8Array([1, 2, 3]),
    });

    const result = await runAdHocCompletedCsepRebuild({
      document: {
        buffer: Buffer.from("doc"),
        fileName: "outside-csep.docx",
      },
      additionalReviewerContext: "Fix it into our format.",
      builderExpectationSummary: [
        "Scope of Work: Describe the exact self-performed work.",
        "Emergency Procedures: State 911 wording and responder access.",
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected rebuild to succeed.");
    }
    expect(global.fetch).toHaveBeenCalled();
    expect(renderGeneratedCsepDocx).toHaveBeenCalledTimes(1);
    expect(result.filename).toBe("rebuilt_rebuilt.docx");
  });
});
