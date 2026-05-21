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
            problem: "Emergency Procedures has only a single sentence and does not name 911 wording, responder access, or assembly area.",
            requiredOutput:
              "Insert a labeled Emergency Procedures section that contains: 911 call wording, named site contact, responder access gate, alarm/evacuation steps, and the assembly area.",
            acceptanceCheck:
              "Emergency Procedures contains 911 wording, named contact, responder gate, evacuation steps, and assembly area.",
            doNot:
              "Do not bury Emergency Procedures inside another section and do not leave 911 / assembly area / notification chain as placeholders.",
            whatWasFound: "Some emergency language is present.",
            whatNeedsWork: "Build out the missing 911 call chain and responder access wording.",
            suggestedBuilderTarget:
              "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            sentiment: "negative",
            problem: "The emergency section reads as a single 'site team will handle it' sentence with no named steps.",
            requiredOutput:
              "Replace the existing emergency paragraph with: 'Call 911, direct responders to the main gate, notify the superintendent, and move the crew to the assembly area.' Include the responder gate, named contact, and assembly point.",
            acceptanceCheck:
              "Emergency Procedures lists the 911 step, the named responder entry, the named contact, and the assembly point.",
            doNot:
              "Do not leave the section as a single 'will be handled' sentence and do not duplicate it elsewhere.",
            issue: "The emergency section still reads too generally.",
            documentExample:
              "Emergency response will be handled by the site team and coordinated through the foreman.",
            preferredExample:
              "Call 911, direct responders to the main gate, notify the superintendent, and move the crew to the assembly area.",
            reviewerNote:
              "Replace the placeholder paragraph with the named 911 / gate / contact / assembly steps above.",
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
        complianceSummary: {
          compliancePercent: 50,
          presentCount: 0,
          partialCount: 1,
          missingCount: 1,
          totalSections: 2,
        },
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
      extracted.annotations.some((item) => item.note?.includes("Section:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("Problem:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("Required Output:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("Acceptance Check:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("Do Not:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.note?.includes("The uploaded GC emergency reference calls for a named responder entry point")
      )
    ).toBe(true);
    expect(
      extracted.annotations.every((item) => !item.note?.includes("Current CSEP text:"))
    ).toBe(true);
    expect(
      extracted.annotations.every((item) => !item.note?.includes("Target wording:"))
    ).toBe(true);
    expect(
      extracted.annotations.every((item) => !item.note?.includes("Referance:"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("Document Review:"))
    ).toBe(false);
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
            problem: "Emergency Procedures has only a single sentence that does not name 911, responder access, or assembly area.",
            requiredOutput: "Insert 911 wording, named contact, responder gate, alarm/evacuation steps, and assembly area as a labeled subsection.",
            acceptanceCheck: "Emergency Procedures contains 911 wording, named contact, responder gate, evacuation steps, and assembly area.",
            doNot: "Do not bury Emergency Procedures inside another section and do not leave 911 / assembly area / notification chain as placeholders.",
            whatWasFound: "Emergency response will be handled by the site team and coordinated through the foreman.",
            whatNeedsWork: "Build out the 911 call chain and responder access wording.",
            suggestedBuilderTarget:
              "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
          },
          {
            sectionLabel: "Fall Rescue",
            status: "missing",
            problem: "Fall Rescue is not present in the body of the CSEP.",
            requiredOutput: "Insert a Fall Rescue subsection that names the primary rescue method, backup method, rescue equipment staging, and suspension trauma relief expectation.",
            acceptanceCheck: "Fall Rescue lists primary method, backup method, staging location, and suspension trauma relief.",
            doNot: "Do not blend Fall Rescue into a general fall-protection paragraph.",
            whatWasFound: "Fall protection is addressed generally but rescue details are not shown.",
            whatNeedsWork: "Add Fall Rescue with primary method, backup, staging, and daily review.",
            suggestedBuilderTarget:
              "Fall Rescue: State the primary rescue method, backup method, rescue equipment staging, and suspension trauma relief expectations.",
          },
          {
            sectionLabel: "Training Requirements",
            status: "partial",
            problem: "Training Requirements only says 'workers will be trained' without naming specific training or qualifications.",
            requiredOutput: "List the required training (orientation, OSHA 10/30, competent-person, equipment, task-specific) and where each record is kept.",
            acceptanceCheck: "Training Requirements names each required training and the record location.",
            doNot: "Do not leave training as a single 'workers will be trained' sentence.",
            whatWasFound: "Workers will be trained before work begins.",
            whatNeedsWork: "Spell out the actual training, qualifications, and competent-person coverage.",
            suggestedBuilderTarget:
              "Training Requirements: Identify orientation, OSHA, competent-person, equipment, and task-specific qualifications required before work starts.",
          },
          {
            sectionLabel: "Permit Requirements",
            status: "partial",
            problem: "Permit Requirements does not map permit triggers to the actual work.",
            requiredOutput: "Map each permit-triggering task to the named permit, the responsible role, and where the permit must be posted.",
            acceptanceCheck: "Each permit-triggering task in the document has a named permit and a named owner.",
            doNot: "Do not list permits without naming the triggering task and the responsible role.",
            whatWasFound: "Permits will be handled as needed by the project team.",
            whatNeedsWork: "Call out the actual permit triggers and who owns them.",
            suggestedBuilderTarget:
              "Permit Requirements: Identify each triggered permit or notice, when it applies, and who is responsible for obtaining and closing it.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Fall Rescue",
            sentiment: "negative",
            problem: "There is no Fall Rescue subsection. Fall protection is mentioned only in general terms.",
            requiredOutput: "Insert a Fall Rescue subsection that states the primary rescue method, backup rescue approach, equipment staging location, and the daily rescue review.",
            acceptanceCheck: "Fall Rescue lists primary method, backup method, staging location, and daily review.",
            doNot: "Do not collapse Fall Rescue into the general fall-protection paragraph and do not leave it for an appendix.",
            issue: "The rescue section is still too general.",
            documentExample: "Fall protection is addressed generally but rescue details are not shown.",
            preferredExample:
              "State the rescue method, ladder or equipment staging, backup rescue approach, and daily rescue review expectations.",
            reviewerNote:
              "Insert the named rescue method, staging, backup, and daily review as a Fall Rescue subsection.",
            referenceSupport:
              "The uploaded steel reference plan calls for a primary rescue method, backup rescue method, and staged equipment.",
            whyItMatters:
              "It matters because the crew needs a rescue plan they can actually use if someone is left hanging.",
          },
          {
            sectionLabel: "Permit Requirements",
            sentiment: "negative",
            problem: "Permit Requirements is a placeholder sentence and does not list triggered permits or named owners.",
            requiredOutput: "Replace the placeholder with a permit table that lists each triggered permit, the triggering task, the responsible role, and the posting/closing requirement.",
            acceptanceCheck: "Permit Requirements contains a table or list with permit, task trigger, role, and posting location for each permit.",
            doNot: "Do not leave Permit Requirements as 'permits will be handled as needed.'",
            issue: "The permit section doesn't tie permit triggers back to the actual work.",
            documentExample: "Permits will be handled as needed by the project team.",
            preferredExample:
              "List the triggered permits, when they apply, and who obtains them before the work starts.",
            reviewerNote:
              "Insert the permit table described above and assign each row to a named role.",
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
        complianceSummary: {
          compliancePercent: 40,
          presentCount: 0,
          partialCount: 2,
          missingCount: 3,
          totalSections: 5,
        },
      },
    });

    const extracted = await extractReviewDocumentText(annotated, "annotated-long.docx");
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    expect(extracted.annotations.length).toBeGreaterThanOrEqual(4);
    expect(
      extracted.annotations.some((item) => item.anchorText?.includes("rescue details are not shown"))
    ).toBe(true);
    expect(
      extracted.annotations.some((item) =>
        item.anchorText?.includes("Permits will be handled as needed by the project team")
      )
    ).toBe(true);
    expect(
      extracted.annotations.some((item) => item.note?.includes("Document Review:"))
    ).toBe(false);
  });
});
