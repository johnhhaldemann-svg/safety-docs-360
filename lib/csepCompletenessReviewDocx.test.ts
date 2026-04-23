import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { renderCsepCompletenessReviewNotesDocx } from "@/lib/csepCompletenessReviewDocx";

async function readDocumentXml(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml")!.async("string");
}

async function readNumberingXml(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/numbering.xml")!.async("string");
}

describe("renderCsepCompletenessReviewNotesDocx", () => {
  it("renders a multilevel outline for review notes content", async () => {
    const buffer = await renderCsepCompletenessReviewNotesDocx({
      sourceFileName: "riverfront-csep.docx",
      disclaimer: "Internal review only.",
      extractionSummary: "Completed CSEP extracted via docx.",
      siteReferenceSummary: "Reference file extracted via pdf.",
      reviewerContext: "Focus on missing fall rescue details.",
      review: {
        reviewMode: "csep_completeness",
        executiveSummary: "Needs work before issue.",
        scopeTradeAndHazardCoverage: "Hazards are only partially developed.",
        regulatoryAndProgramStrengths: ["Some trade scope is present.", "PPE is partially listed."],
        gapsRisksOrClarifications: ["Emergency content is weak.", "Permit mapping is incomplete."],
        recommendedEditsBeforeApproval: ["Add a rescue plan.", "Add permit ownership."],
        missingItemsChecklist: [
          "Could not verify rescue equipment staging.",
          "Could not verify a documented rescue equipment inspection cadence.",
        ],
        builderAlignmentNotes: ["Emergency Procedures should include 911 wording and responder access."],
        sectionReviewNotes: [
          {
            sectionLabel: "Emergency Procedures",
            status: "missing",
            problem: "Emergency Procedures is not present in the body of the CSEP.",
            requiredOutput:
              "Insert Emergency Procedures as its own labeled body section that contains 911 wording, site access instructions for responders, assembly area, and the named incident notification chain.",
            acceptanceCheck:
              "Emergency Procedures contains 911 wording, site address/access for responders, alarm/evacuation steps, assembly area, and the named notification chain.",
            doNot:
              "Do not bury emergency procedures inside another section and do not leave 911 / assembly area / notification chain as placeholders.",
            whatWasFound: "No clearly labeled emergency procedures section was confirmed.",
            whatNeedsWork: "Add a standalone emergency section with call chain and responder access.",
            suggestedBuilderTarget:
              "Emergency Procedures: State 911 wording, site access instructions, assembly area expectations, and the immediate incident notification chain.",
          },
        ],
        detailedFindings: [
          {
            sectionLabel: "Emergency Procedures",
            sentiment: "negative",
            problem: "The emergency section does not give field-usable response steps.",
            requiredOutput:
              "Replace the existing emergency paragraph with: 'Call 911, direct responders to Gate 2, notify the superintendent, and move crews to the assembly point.' Include the responder gate, named site contact, and assembly point.",
            acceptanceCheck:
              "Emergency Procedures contains the named gate for responders, the site contact who will be called, and the assembly point.",
            doNot:
              "Do not leave the emergency section as a single 'will be handled by the site team' sentence and do not duplicate it elsewhere.",
            issue: "The emergency section does not give field-usable response steps.",
            documentExample: "Emergency response will be handled by the site team.",
            preferredExample:
              "Call 911, direct responders to Gate 2, notify the superintendent, and move crews to the assembly point.",
            reviewerNote: "Use the builder-style emergency package instead of generic narrative text.",
            referenceSupport:
              "The uploaded GC emergency plan calls for Gate 2 responder access and a named assembly point.",
            whyItMatters:
              "It matters because crews need clear emergency direction they can actually follow in the field.",
          },
        ],
        checklistDelta: ["Training evidence is weak."],
        documentQualityIssues: ["Placeholder wording is still present."],
        noteCoverage: ["Embedded note about permit ownership was addressed."],
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

    const [documentXml, numberingXml] = await Promise.all([
      readDocumentXml(buffer),
      readNumberingXml(buffer),
    ]);

    expect(documentXml).toContain("Completed CSEP Review Notes");
    expect(documentXml).toContain("riverfront-csep.docx");
    expect(documentXml).toContain("The emergency section does not give field-usable response steps.");
    expect(documentXml).toContain("Call 911, direct responders to Gate 2");
    expect(documentXml).toContain("Section");
    expect(documentXml).toContain("Problem");
    expect(documentXml).toContain("Required Output");
    expect(documentXml).toContain("Acceptance Check");
    expect(documentXml).toContain("Do Not");
    expect(documentXml).toContain("Reference");
    expect(documentXml).not.toContain("Current CSEP text");
    expect(documentXml).not.toContain("Target wording");
    expect(documentXml).not.toContain("Referance");
    expect(documentXml).toContain("Section-by-section builder audit");
    expect(documentXml).toContain('<w:numPr><w:ilvl w:val="0"/');
    expect(documentXml).toContain('<w:numPr><w:ilvl w:val="1"/');
    expect(documentXml).toContain('<w:numPr><w:ilvl w:val="2"/');
    expect(documentXml).not.toContain("1. Emergency Procedures (Missing)");
    expect(documentXml).not.toContain("1. Emergency Procedures");
    expect(numberingXml).toContain('w:lvl w:ilvl="0"');
    expect(numberingXml).toContain('w:lvl w:ilvl="1"');
    expect(numberingXml).toContain('w:lvl w:ilvl="2"');
    expect(numberingXml).toContain('w:lvlText w:val="%1."');
    expect(numberingXml).toContain('w:lvlText w:val="%1.%2"');
    expect(numberingXml).toContain('w:lvlText w:val="%1.%2.%3"');
  });
});
