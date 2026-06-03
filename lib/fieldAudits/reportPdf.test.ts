import { describe, expect, it } from "vitest";
import { generateFieldAuditReportPdf } from "@/lib/fieldAudits/reportPdf";

async function extractPdfText(bytes: Uint8Array) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

describe("generateFieldAuditReportPdf", () => {
  it("creates a finished audit PDF with a stable filename", async () => {
    const report = await generateFieldAuditReportPdf({
      companyName: "SafePredict",
      customerName: "ABC Customer",
      jobsiteName: "North Tower",
      auditDate: "2026-04-29",
      auditors: "Jane Reviewer",
      hoursBilled: 2.5,
      selectedTrade: "general_contractor",
      scoreSummary: { total: 3, fail: 1, compliancePercent: 67 },
      aiReviewSummary: {
        executiveSummary: "One failed guardrail item needs correction before closeout.",
      },
      observations: [
        {
          item_label: "Guardrails installed",
          category_label: "Fall protection",
          status: "fail",
          severity: "high",
          notes: "Guardrail missing at west edge.",
        },
      ],
      reviewerName: "admin@example.com",
      reportStatus: "approved",
    });

    expect(report.filename).toBe("North-Tower-field-audit-2026-04-29.pdf");
    expect(report.bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(report.bytes.slice(0, 4)).toString("utf8")).toBe("%PDF");

    const text = await extractPdfText(report.bytes);
    expect(text).toContain("Finished Field Audit Report");
    expect(text).toContain("Approved customer copy");
    expect(text).toContain("REPORT DETAILS");
    expect(text).toContain("APPROVAL RECORD");
  });

  it("labels unapproved field audit PDFs as reviewer previews", async () => {
    const report = await generateFieldAuditReportPdf({
      companyName: "SafePredict",
      customerName: "ABC Customer",
      jobsiteName: "South Tower",
      auditDate: "2026-04-30",
      auditors: "Jane Reviewer",
      selectedTrade: "general_contractor",
      scoreSummary: { total: 1, fail: 0, compliancePercent: 100 },
      observations: [],
      reviewerName: "admin@example.com",
      reportStatus: "preview",
    });

    const text = await extractPdfText(report.bytes);
    expect(text).toContain("Reviewer preview");
    expect(text).toContain("Approve the audit before relying on this as the downloadable final customer copy.");
  });
});
