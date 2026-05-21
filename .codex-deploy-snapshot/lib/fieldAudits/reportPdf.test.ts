import { describe, expect, it } from "vitest";
import { generateFieldAuditReportPdf } from "@/lib/fieldAudits/reportPdf";

describe("generateFieldAuditReportPdf", () => {
  it("creates a finished audit PDF with a stable filename", async () => {
    const report = await generateFieldAuditReportPdf({
      companyName: "Safety360 Docs",
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
  });
});
