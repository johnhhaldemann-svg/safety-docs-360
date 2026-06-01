import { describe, expect, it } from "vitest";
import { generateAuditFlowReportPdf } from "@/lib/auditflow/reportPdf";

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

const schema = {
  sections: [
    {
      id: "fall",
      title: "Fall Protection",
      items: [
        {
          id: "guardrail",
          label: "Guardrails are installed",
          weight: 1,
          requirePhotoUrl: false,
          requireCommentOnFail: true,
        },
        {
          id: "access",
          label: "Access paths are clear",
          weight: 1,
          requirePhotoUrl: false,
          requireCommentOnFail: true,
        },
      ],
    },
  ],
};

describe("generateAuditFlowReportPdf", () => {
  it("creates an approved AuditFlow PDF with findings, signature, and review notes", async () => {
    const report = await generateAuditFlowReportPdf({
      companyName: "Builder Co",
      templateTitle: "Weekly Safety Audit",
      jobsiteName: "North Tower",
      schema,
      submission: {
        status: "approved",
        submitted_at: "2026-05-01T12:00:00Z",
        reviewed_at: "2026-05-02T12:00:00Z",
        signature_text: "Sam Supervisor",
        notes: "Crew walked the east deck.",
        review_notes: "Approved after guardrail correction.",
        answers: {
          "fall::guardrail": {
            value: "fail",
            comment: "Missing midrail at east edge.",
            photoUrl: "photo-1",
          },
          "fall::access": { value: "pass", comment: "Clear", photoUrl: "" },
        },
        score_summary: { compliancePercent: 50, pass: 1, fail: 1, na: 0, totalItems: 2 },
      },
      reviewerName: "admin@example.com",
      reportStatus: "approved",
    });

    expect(report.filename).toBe("Weekly-Safety-Audit-auditflow-2026-05-01.pdf");
    expect(Buffer.from(report.bytes.slice(0, 4)).toString("utf8")).toBe("%PDF");

    const text = await extractPdfText(report.bytes);
    expect(text).toContain("AuditFlow Report");
    expect(text).toContain("Weekly Safety Audit");
    expect(text).toContain("North Tower");
    expect(text).toContain("Missing midrail at east edge.");
    expect(text).toContain("Sam Supervisor");
    expect(text).toContain("Approved after guardrail correction.");
    expect(text).toContain("Approved customer copy");
  });

  it("handles no findings, missing optional jobsite, and long comments", async () => {
    const longComment = "Access route acceptable. ".repeat(80);
    const report = await generateAuditFlowReportPdf({
      companyName: "Builder Co",
      templateTitle: "Daily Audit",
      jobsiteName: "",
      schema,
      submission: {
        status: "submitted",
        submitted_at: "2026-05-03T12:00:00Z",
        signature_text: "Field User",
        answers: {
          "fall::guardrail": { value: "pass", comment: longComment, photoUrl: "" },
          "fall::access": { value: "pass", comment: longComment, photoUrl: "" },
        },
        score_summary: { compliancePercent: 100, pass: 2, fail: 0, na: 0, totalItems: 2 },
      },
      reportStatus: "preview",
    });

    expect(report.bytes.length).toBeGreaterThan(1000);
    const text = await extractPdfText(report.bytes);
    expect(text).toContain("No failed checklist items recorded");
    expect(text).toContain("No jobsite");
    expect(text).toContain("Reviewer preview");
  });
});
