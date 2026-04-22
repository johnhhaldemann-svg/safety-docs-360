import { describe, expect, it } from "vitest";
import { formatCsepFindingNote, formatCsepSectionNote } from "@/lib/csepReviewNoteFormat";

describe("csepReviewNoteFormat", () => {
  it("formats finding notes in the requested review layout", () => {
    const formatted = formatCsepFindingNote({
      sectionLabel: "Job Safety Analysis",
      issue:
        "Job Safety Analysis: Lacks clarity on how job safety analysis should be executed by site supervisors.",
      documentExample:
        "A brief mention of JSA without specific guidelines or required documentation.",
      preferredExample:
        "Include a requirement for documented JSAs detailing the needs and checks before job execution.",
      reviewerNote:
        "A strong emphasis on JSAs can greatly reduce workplace accidents.",
      referenceSupport: "",
      whyItMatters: "Thoroughly executed JSAs strengthen the safety program.",
    });

    expect(formatted).toBe(
      [
        "What: Job Safety Analysis: Lacks clarity on how job safety analysis should be executed by site supervisors.",
        "",
        "Current CSEP text: A brief mention of JSA without specific guidelines or required documentation.",
        "",
        "Why: Thoroughly executed JSAs strengthen the safety program.",
        "",
        "How: A strong emphasis on JSAs can greatly reduce workplace accidents.",
        "",
        "Target wording: Include a requirement for documented JSAs detailing the needs and checks before job execution.  Referance: N/A",
      ].join("\n")
    );
  });

  it("formats section notes to match the review comment structure", () => {
    const formatted = formatCsepSectionNote({
      sectionLabel: "Table of Contents",
      status: "missing",
      whatWasFound:
        "Table of contents is not provided, making navigation of the document difficult.",
      whatNeedsWork:
        "Add a comprehensive table of contents that outlines the structure of the document and page numbers.",
      suggestedBuilderTarget: "Table of Contents: Include a detailed table of contents.",
      referenceSupport: "",
      whyItMatters:
        "This section still needs to be tightened before the CSEP is issued.",
    });

    expect(formatted).toBe(
      [
        "What: Table of Contents: Table of Contents is missing or not clearly developed in the document.",
        "",
        "Current CSEP text: Table of contents is not provided, making navigation of the document difficult.",
        "",
        "Why: This section still needs to be tightened before the CSEP is issued.",
        "",
        "How: Add a comprehensive table of contents that outlines the structure of the document and page numbers.",
        "",
        "Target wording: Include a detailed table of contents.  Referance: N/A",
      ].join("\n")
    );
  });
});
