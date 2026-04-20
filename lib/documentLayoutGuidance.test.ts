import { describe, expect, it } from "vitest";
import {
  getCustomerFacingDocumentLayoutGuidance,
  getReviewLayoutGuidance,
} from "@/lib/documentLayoutGuidance";

describe("documentLayoutGuidance", () => {
  it("defines the intended customer-facing blueprint structure", () => {
    const guidance = getCustomerFacingDocumentLayoutGuidance();

    expect(guidance).toContain("Cover page");
    expect(guidance).toContain("Document Summary, High-Risk Work Snapshot, Revision / Prepared By, optional Trade Package Overview, then Contents");
    expect(guidance).toContain("group hazards, tasks, controls, and PPE by trade / subtrade package");
    expect(guidance).toContain("Purpose & How to Use This Blueprint");
    expect(guidance).toContain("Field Execution Snapshot");
    expect(guidance).toContain("Start each major body section on a clean new page");
    expect(guidance).toContain("leadership review / continuous improvement closeout");
    expect(guidance).toContain("Customer-facing language only");
    expect(guidance).toContain("footer content anchored at the bottom of the page");
    expect(guidance).toContain("1, 1.1, 1.1.1, and 1.1.1.1");
    expect(guidance).toContain("Keep narrative fields concise");
    expect(guidance).toContain("document must be reissued");
    expect(guidance).toContain("Do not repeat the same sentence");
    expect(guidance).toContain("stays near a 30-page customer-facing document");
  });

  it("extends the layout guidance for AI review prompts", () => {
    const guidance = getReviewLayoutGuidance();

    expect(guidance).toContain("When evaluating document quality");
    expect(guidance).toContain("Customer-facing document layout expectations");
    expect(guidance).toContain("missing grouped trade packages");
    expect(guidance).toContain("placeholder copy");
    expect(guidance).toContain("cover / footer presentation problems");
  });
});
