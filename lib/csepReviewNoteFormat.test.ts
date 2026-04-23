import { describe, expect, it } from "vitest";
import { formatCsepFindingNote, formatCsepSectionNote } from "@/lib/csepReviewNoteFormat";

describe("csepReviewNoteFormat", () => {
  it("formats finding notes as build instructions", () => {
    const formatted = formatCsepFindingNote({
      sectionLabel: "Job Safety Analysis",
      sentiment: "negative",
      problem:
        "JSA is mentioned in one paragraph but no required structure, fields, or pre-task checks are defined.",
      requiredOutput:
        "Add a JSA subsection that lists the required JSA fields (task, hazards, controls, PPE, sign-off), the named role that owns the JSA, and the rule that the JSA must be completed and signed before each task starts.",
      acceptanceCheck:
        "Each active task in the document has a JSA entry with the required fields populated and a named owner.",
      doNot: "Do not leave JSA as a single descriptive sentence and do not duplicate JSA content elsewhere.",
      issue: "JSA execution is not defined.",
      documentExample:
        "A brief mention of JSA without specific guidelines or required documentation.",
      preferredExample: "Include a requirement for documented JSAs detailing the needs and checks before job execution.",
      reviewerNote: "A strong emphasis on JSAs can greatly reduce workplace accidents.",
      referenceSupport: "Reference document excerpt: GC requires daily JSA before crew release.",
      whyItMatters: "Thoroughly executed JSAs strengthen the safety program.",
    });

    expect(formatted).toBe(
      [
        "Section: Job Safety Analysis",
        "Problem: JSA is mentioned in one paragraph but no required structure, fields, or pre-task checks are defined.",
        "Required Output: Add a JSA subsection that lists the required JSA fields (task, hazards, controls, PPE, sign-off), the named role that owns the JSA, and the rule that the JSA must be completed and signed before each task starts.",
        "Acceptance Check: Each active task in the document has a JSA entry with the required fields populated and a named owner.",
        "Do Not: Do not leave JSA as a single descriptive sentence and do not duplicate JSA content elsewhere.",
        "Reference: GC requires daily JSA before crew release.",
      ].join("\n")
    );
  });

  it("formats section notes as build instructions", () => {
    const formatted = formatCsepSectionNote({
      sectionLabel: "Table of Contents",
      status: "missing",
      problem: "The TOC is missing entirely.",
      requiredOutput:
        "Build a hierarchical TOC that includes front matter, numbered body sections, appendices, and right-aligned page references matching the final document pagination.",
      acceptanceCheck:
        "The TOC shows nested section levels and page references for each entry.",
      doNot: "Do not leave the TOC as a plain list and do not create duplicate TOC entries.",
      whatWasFound: "Table of contents is not provided, making navigation of the document difficult.",
      whatNeedsWork: "Add a comprehensive table of contents that outlines the structure of the document and page numbers.",
      suggestedBuilderTarget: "Table of Contents: Include a detailed table of contents.",
      referenceSupport: "",
      whyItMatters: "Without a TOC, the document is hard to navigate.",
    });

    expect(formatted).toBe(
      [
        "Section: Table of Contents",
        "Problem: The TOC is missing entirely.",
        "Required Output: Build a hierarchical TOC that includes front matter, numbered body sections, appendices, and right-aligned page references matching the final document pagination.",
        "Acceptance Check: The TOC shows nested section levels and page references for each entry.",
        "Do Not: Do not leave the TOC as a plain list and do not create duplicate TOC entries.",
      ].join("\n")
    );
  });

  it("derives missing build-instruction fields from legacy fields with concrete language", () => {
    const formatted = formatCsepFindingNote({
      sectionLabel: "Roles and Responsibilities",
      sentiment: "negative",
      // New build-instruction fields intentionally empty so we exercise the fallback path.
      problem: "",
      requiredOutput: "",
      acceptanceCheck: "",
      doNot: "",
      issue: "Roles describe duties but do not assign authority.",
      documentExample: "Lists roles in a paragraph.",
      preferredExample:
        "For each role, include responsibility, authority, and at least one decision example tied to start, stop-work, permit verification, restart approval, or crew release.",
      reviewerNote: "Rebuild as a structured list with authority statements.",
      referenceSupport: "",
      whyItMatters: "Field crews need clear ownership for stop-work and restart.",
    });

    expect(formatted).toBe(
      [
        "Section: Roles and Responsibilities",
        "Problem: Roles describe duties but do not assign authority.",
        "Required Output: For each role, include responsibility, authority, and at least one decision example tied to start, stop-work, permit verification, restart approval, or crew release.",
        "Acceptance Check: Roles and Responsibilities reads as a final, project-specific build instruction with the required structure populated and no vague filler.",
        "Do Not: Do not leave Roles and Responsibilities as a vague editorial note, do not duplicate it in another section, and do not introduce 'tighten' / 'improve' / 'sounds generic' filler wording.",
      ].join("\n")
    );
  });
});
