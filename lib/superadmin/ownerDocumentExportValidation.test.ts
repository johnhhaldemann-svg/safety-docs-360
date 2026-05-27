import { describe, expect, it } from "vitest";
import { inspectOwnerDocumentExportText } from "@/lib/superadmin/ownerDocumentExportValidation";

describe("inspectOwnerDocumentExportText", () => {
  it("passes when expected text and required sections are present", () => {
    const result = inspectOwnerDocumentExportText({
      artifactLabel: "PDF export",
      text: [
        "Finished Field Audit Report",
        "Safety360 Test Company",
        "High-risk jobsite",
        "Report details",
        "Findings summary",
        "Approval note",
      ].join("\n"),
      expectedPhrases: ["Safety360 Test Company", "High-risk jobsite"],
      requiredSections: ["Report details", "Findings summary", "Approval note"],
    });

    expect(result.status).toBe("pass");
    expect(result.issues).toEqual([]);
  });

  it("fails when company details or required sections are missing", () => {
    const result = inspectOwnerDocumentExportText({
      artifactLabel: "Word export",
      text: "A generic exported document with no sandbox company.",
      expectedPhrases: ["Safety360 Test Company"],
      requiredSections: ["Training"],
    });

    expect(result.status).toBe("fail");
    expect(result.missingExpected).toEqual(["Safety360 Test Company"]);
    expect(result.missingSections).toEqual(["Training"]);
  });

  it("warns for placeholders and duplicate sections", () => {
    const result = inspectOwnerDocumentExportText({
      artifactLabel: "PDF export",
      text: "Safety360 Test Company\nApproval note\nApproval note\nTODO: replace placeholder",
      expectedPhrases: ["Safety360 Test Company"],
      requiredSections: ["Approval note"],
    });

    expect(result.status).toBe("warning");
    expect(result.placeholders.length).toBeGreaterThan(0);
    expect(result.duplicateSections).toEqual(["Approval note"]);
  });

  it("fails for internal notes even when expected text exists", () => {
    const result = inspectOwnerDocumentExportText({
      artifactLabel: "Word export",
      text: "Safety360 Test Company\nTraining\nINTERNAL NOTE: do not show customer",
      expectedPhrases: ["Safety360 Test Company"],
      requiredSections: ["Training"],
    });

    expect(result.status).toBe("fail");
    expect(result.internalNotes.length).toBeGreaterThan(0);
  });
});
