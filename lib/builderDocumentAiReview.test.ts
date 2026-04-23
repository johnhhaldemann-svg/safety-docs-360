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
    expect(review.complianceSummary.totalSections).toBe(review.sectionReviewNotes.length);
    expect(review.complianceSummary.compliancePercent).toBeGreaterThanOrEqual(0);
    expect(review.complianceSummary.compliancePercent).toBeLessThanOrEqual(100);
    expect(review.detailedFindings.length).toBeGreaterThanOrEqual(5);
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

  it("downgrades compliance and surfaces findings when a reference is added that the CSEP does not cover", async () => {
    const builderExpectationSummary = [
      "Scope of Work: Describe the exact self-performed work and excluded interface trades.",
      "Emergency Procedures: State 911 wording, responder access, and notification chain.",
      "Fall Rescue: Describe rescue plan, trigger events, and equipment.",
      "Permit Requirements: List permit-triggering work and the approval chain.",
      "Training Requirements: List OSHA 10/30 and competent-person training.",
    ];

    const csepText = [
      "This contractor plan covers scope of work for steel erection.",
      "Crews will install structural steel and decking across the project.",
      "Training is provided for all workers before they begin scope-of-work tasks.",
    ].join("\n");

    const withoutReference = await generateBuilderProgramAiReview({
      documentText: csepText,
      programLabel: "CSEP",
      projectName: "Riverfront Tower",
      reviewMode: "csep_completeness",
      builderExpectationSummary,
    });

    const withReference = await generateBuilderProgramAiReview({
      documentText: csepText,
      programLabel: "CSEP",
      projectName: "Riverfront Tower",
      reviewMode: "csep_completeness",
      builderExpectationSummary,
      siteReferenceFileName: "gc-logistics.pdf",
      siteReferenceText: [
        "Emergency Procedures: responders enter through Gate 2 and crews report to the south assembly area.",
        "Fall Rescue: designated rescue team must respond within 6 minutes to any suspended worker.",
        "Permit Requirements: hot work, confined space, and excavation permits must be approved by the GC before work begins.",
      ].join("\n"),
    });

    // Adding a reference that the CSEP does not cover MUST change the review.
    // Either the compliance score drops or the findings/checklist expand to
    // reflect the reference-only gaps.
    const noRefScore = withoutReference.review.complianceSummary.compliancePercent;
    const withRefScore = withReference.review.complianceSummary.compliancePercent;
    const noRefMissing = withoutReference.review.sectionReviewNotes.filter(
      (note) => note.status !== "present"
    ).length;
    const withRefMissing = withReference.review.sectionReviewNotes.filter(
      (note) => note.status !== "present"
    ).length;

    expect(
      withRefScore < noRefScore ||
        withRefMissing > noRefMissing ||
        withReference.review.missingItemsChecklist.length >
          withoutReference.review.missingItemsChecklist.length
    ).toBe(true);

    // The reference-derived gaps must be surfaced in the review output.
    expect(
      withReference.review.sectionReviewNotes.some(
        (note) => note.referenceSupport && note.referenceSupport.length > 0
      )
    ).toBe(true);
    expect(
      withReference.review.missingItemsChecklist.some((item) =>
        item.toLowerCase().includes("reference document")
      )
    ).toBe(true);

    // Score must not be a flat 100 when the reference clearly has topics the
    // CSEP does not cover (emergency procedures, fall rescue, permits).
    expect(withRefScore).toBeLessThan(100);
  });

  it("does not mark a section present on a single passing keyword mention", async () => {
    const { review } = await generateBuilderProgramAiReview({
      documentText:
        "Crews receive training before work begins. Emergency information is shared.",
      programLabel: "CSEP",
      projectName: "Riverfront Tower",
      reviewMode: "csep_completeness",
      builderExpectationSummary: [
        "Training Requirements: List OSHA 10/30 and competent-person training and record-keeping.",
        "Emergency Procedures: State 911 wording, responder access, and notification chain.",
      ],
    });

    // "training" and "emergency" appear only once each without the full
    // labeled subsection. The old logic marked these "present" (score 100).
    // The new logic must mark them partial or missing so score < 100.
    expect(review.complianceSummary.compliancePercent).toBeLessThan(100);
  });

  it("treats thin extracted text as insufficient context in completeness mode", async () => {
    const { review } = await generateBuilderProgramAiReview({
      documentText: "Cover page only",
      programLabel: "CSEP",
      projectName: "Riverfront Tower",
      reviewMode: "csep_completeness",
    });

    expect(review.overallAssessment).toBe("insufficient_context");
    expect(review.complianceSummary.totalSections).toBe(review.sectionReviewNotes.length);
    expect(review.detailedFindings.length).toBeGreaterThanOrEqual(3);
    expect(review.missingItemsChecklist.some((item) => item.includes("Could not verify"))).toBe(
      true
    );
  });
});
