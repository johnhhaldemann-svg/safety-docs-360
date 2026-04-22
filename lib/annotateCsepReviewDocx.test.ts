import { Document, Packer, Paragraph } from "docx";
import { describe, expect, it } from "vitest";
import { annotateCsepReviewDocx } from "@/lib/annotateCsepReviewDocx";
import { extractReviewDocumentText } from "@/lib/documentReviewExtraction";

async function createSimpleDocx() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph("Emergency Procedures"),
          new Paragraph(
            "Emergency response will be handled by the site team and coordinated through the foreman."
          ),
          new Paragraph("Fall protection is addressed generally but rescue details are not shown."),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

async function createLongerDocx() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph("1. Scope of Work"),
          new Paragraph("The contractor will perform structural steel erection and decking."),
          new Paragraph("2. Emergency Procedures"),
          new Paragraph("Emergency response will be handled by the site team and coordinated through the foreman."),
          new Paragraph("3. Fall Rescue"),
          new Paragraph("Fall protection is addressed generally but rescue details are not shown."),
          new Paragraph("4. Training Requirements"),
          new Paragraph("Workers will be trained before work begins."),
          new Paragraph("5. Permit Requirements"),
          new Paragraph("Permits will be handled as needed by the project team."),
          new Paragraph("6. Inspection and Verification"),
          new Paragraph("Equipment will be checked on site."),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

describe("annotateCsepReviewDocx", () => {
  it("adds review comments to a DOCX near the matched issue text", async () => {
    const source = await createSimpleDocx();
    const annotated = await annotateCsepReviewDocx({
      buffer: source,
      review: {
        reviewMode: "csep_completeness",
        executiveSummary: "Needs work.",
        scopeTradeAndHazardCoverage: "Incomplete.",
        regulatoryAndProgramStrengths: ["Basic structure is present.", "Some safety language is included."],
        gapsRisksOrClarifications: ["Emergency response is too thin.", "Fall rescue language is missing."],
        recommendedEditsBeforeApproval: ["Add 911 wording.", "Add rescue equipment staging."],
        missingItemsChecklist: ["Could not verify rescue equipment staging."],
        builderAlignmentNotes: ["Emergency Procedures should include site access wording."],
        sectionReviewNotes: [
          {
            sectionLabel: "Emergency Procedures",
            status: "partial",
            whatWasFound: "Some emergency language is present.",
            whatNeedsWork: "The section still needs a clear 911 call chain and responder access wording.",
            suggestedBuilderTarget:
              "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            issue: "The emergency section still reads too generally.",
            documentExample:
              "Emergency response will be handled by the site team and coordinated through the foreman.",
            preferredExample:
              "Call 911, direct responders to the main gate, notify the superintendent, and move the crew to the assembly area.",
            reviewerNote:
              "This needs to tell the crew exactly who calls, where responders enter, and where everyone reports.",
            referenceSupport:
              "The uploaded GC emergency reference calls for a named responder entry point and reporting location.",
            whyItMatters:
              "It matters because the crew needs clear emergency direction they can actually follow in the field.",
          },
        ],
        checklistDelta: [],
        documentQualityIssues: [],
        noteCoverage: [],
        overallAssessment: "needs_work",
      },
    });

    const extracted = await extractReviewDocumentText(annotated, "annotated.docx");
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    expect(extracted.annotations.length).toBeGreaterThan(0);
    expect(
      extracted.annotations.some((item) =>
        item.anchorText?.includes("Emergency response will be handled")
      )
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("How:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("What:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("Why:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.note?.includes("Current CSEP text:")
      )
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.note?.includes("Target wording:")
      )
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.note?.includes("Referance:")
      )
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.note?.includes("The uploaded GC emergency reference calls for a named responder entry point")
      )
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.note?.includes("It matters because the crew needs clear emergency direction")
      )
    ).toBe(true);
  });

  it("adds comments across later sections instead of stopping near the beginning", async () => {
    const source = await createLongerDocx();
    const annotated = await annotateCsepReviewDocx({
      buffer: source,
      review: {
        reviewMode: "csep_completeness",
        executiveSummary: "Needs work.",
        scopeTradeAndHazardCoverage: "Incomplete.",
        regulatoryAndProgramStrengths: ["Basic structure is present.", "Some safety language is included."],
        gapsRisksOrClarifications: ["Rescue details are weak.", "Permit coverage is weak."],
        recommendedEditsBeforeApproval: [
          "Add rescue planning.",
          "Add permit triggers.",
          "Name the competent person.",
          "Expand inspection records.",
          "Clarify PPE by task.",
        ],
        missingItemsChecklist: [
          "Could not verify rescue equipment staging.",
          "Could not verify site-specific 911 wording.",
          "Could not verify a documented inspection checklist.",
          "Could not verify permit ownership by role.",
          "Could not verify training records or attachments.",
        ],
        builderAlignmentNotes: [
          "Training Requirements should name the actual required training.",
          "Permit Requirements should identify real permit triggers.",
          "Emergency Procedures should include responder access wording.",
          "Inspection and Verification should define who completes the checklist.",
          "Scope of Work should stay limited to self-performed tasks.",
        ],
        sectionReviewNotes: [
          {
            sectionLabel: "Emergency Procedures",
            status: "partial",
            whatWasFound: "Emergency response will be handled by the site team and coordinated through the foreman.",
            whatNeedsWork: "This section still needs a clear 911 call chain and responder access wording.",
            suggestedBuilderTarget:
              "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
          },
          {
            sectionLabel: "Fall Rescue",
            status: "missing",
            whatWasFound: "Fall protection is addressed generally but rescue details are not shown.",
            whatNeedsWork: "Add the rescue method, staging, backup plan, and daily review language.",
            suggestedBuilderTarget:
              "Fall Rescue: State the primary rescue method, backup method, rescue equipment staging, and suspension trauma relief expectations.",
          },
          {
            sectionLabel: "Training Requirements",
            status: "partial",
            whatWasFound: "Workers will be trained before work begins.",
            whatNeedsWork: "Spell out the actual training, qualifications, and competent-person coverage.",
            suggestedBuilderTarget:
              "Training Requirements: Identify orientation, OSHA, competent-person, equipment, and task-specific qualifications required before work starts.",
          },
          {
            sectionLabel: "Permit Requirements",
            status: "partial",
            whatWasFound: "Permits will be handled as needed by the project team.",
            whatNeedsWork: "Call out the actual permit triggers and who owns them.",
            suggestedBuilderTarget:
              "Permit Requirements: Identify each triggered permit or notice, when it applies, and who is responsible for obtaining and closing it.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Fall Rescue",
            issue: "The rescue section is still too general.",
            documentExample: "Fall protection is addressed generally but rescue details are not shown.",
            preferredExample:
              "State the rescue method, ladder or equipment staging, backup rescue approach, and daily rescue review expectations.",
            reviewerNote:
              "Crews need a real rescue plan here, not just general fall protection language.",
            referenceSupport:
              "The uploaded steel reference plan calls for a primary rescue method, backup rescue method, and staged equipment.",
            whyItMatters:
              "It matters because the crew needs a rescue plan they can actually use if someone is left hanging.",
          },
          {
            sectionLabel: "Permit Requirements",
            issue: "The permit section doesn't tie permit triggers back to the actual work.",
            documentExample: "Permits will be handled as needed by the project team.",
            preferredExample:
              "List the triggered permits, when they apply, and who obtains them before the work starts.",
            reviewerNote:
              "This should read like a working permit plan, not a placeholder sentence.",
            referenceSupport:
              "The uploaded GC reference package lists specific permit triggers that should be reflected here.",
            whyItMatters:
              "It matters because permit ownership and timing need to be clear before the work starts.",
          },
        ],
        checklistDelta: [
          "Baseline: defined safety responsibilities should be made explicit.",
          "Training: workforce/supervisor training evidence is weak or absent.",
          "Environmental: spill, stormwater, or waste controls may be missing.",
        ],
        documentQualityIssues: [
          "A few sections still read like placeholders instead of final issue text.",
          "Some permit language is still too generic to be field-ready.",
        ],
        noteCoverage: [],
        overallAssessment: "needs_work",
      },
    });

    const extracted = await extractReviewDocumentText(annotated, "annotated-long.docx");
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    expect(extracted.annotations.length).toBeGreaterThanOrEqual(20);
    expect(
      extracted.annotations.some((item) => item.anchorText?.includes("rescue details are not shown"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.anchorText?.includes("Permits will be handled as needed by the project team")
      )
    ).toBe(true);
  });
});
