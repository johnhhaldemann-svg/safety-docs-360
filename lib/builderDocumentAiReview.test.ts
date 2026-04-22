import { describe, expect, it } from "vitest";
import { generateBuilderProgramAiReview } from "@/lib/builderDocumentAiReview";

describe("generateBuilderProgramAiReview", () => {
  it("surfaces document quality issues and note coverage in deterministic mode", async () => {
    const { review } = await generateBuilderProgramAiReview({
      documentText: [
        "TEST CSEP",
        "Prepared by safety_plan_deterministic_assembler",
        "Risk Score 672 (critical)",
        "16.5 Related Task Triggers",
      ].join("\n"),
      programLabel: "CSEP",
      projectName: "TEST",
      annotations: [
        {
          id: "5",
          author: "john haldemann",
          date: "2026-04-16T14:38:00Z",
          anchorText: "16.5 Related Task Triggers",
          note: "For all of these lets find a way to just list the task and not name them triggers",
        },
      ],
    });

    const qualitySummary = review.documentQualityIssues?.join("\n") ?? "";
    const noteSummary = review.noteCoverage?.join("\n") ?? "";

    expect(qualitySummary).toContain("Placeholder values");
    expect(qualitySummary).toContain("Internal generator wording");
    expect(qualitySummary).toContain("raw risk score");
    expect(qualitySummary).toContain("lists the tasks directly");
    expect(noteSummary).toContain("list the task");
  });

  it("returns a first-class missing-items checklist in completeness mode", async () => {
    const { review } = await generateBuilderProgramAiReview({
      documentText: "Steel erection scope. Crews will install structural steel and decking.",
      programLabel: "CSEP",
      projectName: "Riverfront Tower",
      reviewMode: "csep_completeness",
      siteReferenceFileName: "gc-logistics.pdf",
      siteReferenceText:
        "Emergency Procedures\nResponders enter through Gate 2 and crews report to the south assembly area.",
      builderExpectationSummary: [
        "Scope of Work: Describe the exact self-performed work and excluded interface trades.",
        "Emergency Procedures: State 911 wording, responder access, and notification chain.",
      ],
    });

    expect(review.reviewMode).toBe("csep_completeness");
    expect(review.missingItemsChecklist.length).toBeGreaterThan(0);
    expect(review.missingItemsChecklist.join("\n")).toContain("Could not verify");
    expect(review.builderAlignmentNotes[0]).toContain("Scope of Work");
    expect(review.sectionReviewNotes.length).toBeGreaterThan(0);
    expect(review.sectionReviewNotes[0].sectionLabel.length).toBeGreaterThan(0);
    expect(review.detailedFindings.length).toBeGreaterThan(0);
    expect(review.detailedFindings[0].documentExample.length).toBeGreaterThan(0);
    expect(review.detailedFindings[0].preferredExample.length).toBeGreaterThan(0);
    expect(review.detailedFindings[0].referenceSupport?.length).toBeGreaterThan(0);
    expect(review.detailedFindings[0].whyItMatters?.length).toBeGreaterThan(0);
    expect(
      review.missingItemsChecklist.some((item) =>
        item.includes("reference document")
      )
    ).toBe(true);
    expect(
      review.detailedFindings.some((item) =>
        item.referenceSupport?.includes("gc-logistics.pdf")
      )
    ).toBe(true);
  });

  it("treats thin extracted text as insufficient context in completeness mode", async () => {
    const { review } = await generateBuilderProgramAiReview({
      documentText: "Cover page only",
      programLabel: "CSEP",
      projectName: "Riverfront Tower",
      reviewMode: "csep_completeness",
    });

    expect(review.overallAssessment).toBe("insufficient_context");
    expect(review.missingItemsChecklist.some((item) => item.includes("Could not verify"))).toBe(
      true
    );
  });
});
