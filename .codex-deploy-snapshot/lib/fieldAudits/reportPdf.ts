import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AuditReportEmailObservation } from "@/lib/auditReportEmail";

type FieldAuditReportPdfParams = {
  companyName: string;
  customerName?: string | null;
  jobsiteName: string;
  auditDate: string | null;
  auditors: string | null;
  hoursBilled?: number | null;
  selectedTrade: string | null;
  scoreSummary: Record<string, unknown>;
  aiReviewSummary?: Record<string, unknown> | null;
  observations: AuditReportEmailObservation[];
  reviewerName?: string | null;
  reportStatus?: "preview" | "approved";
};

type PdfWriter = {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function cleanText(value: unknown, fallback = "Not specified") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function formatTrade(value: string | null) {
  return cleanText(value, "Field audit").replaceAll("_", " ");
}

function formatPercent(value: unknown) {
  return typeof value === "number" ? `${value}%` : "--";
}

function getScoreValue(score: Record<string, unknown>, key: string) {
  const value = score[key];
  return typeof value === "number" ? value : 0;
}

function getNestedString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPdfSummary(summary: Record<string, unknown> | null | undefined) {
  const emailSummary =
    summary?.emailSummary && typeof summary.emailSummary === "object"
      ? (summary.emailSummary as Record<string, unknown>)
      : null;
  const highlights = Array.isArray(emailSummary?.findingHighlights)
    ? emailSummary.findingHighlights.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      )
    : [];
  return {
    openingSummary:
      getNestedString(emailSummary, "openingSummary") ||
      getNestedString(summary, "correctedReportSummary") ||
      getNestedString(summary, "executiveSummary"),
    findingHighlights: highlights,
  };
}

function sanitizeFilePart(value: string) {
  const cleaned = value
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "field-audit";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function addPage(writer: PdfWriter) {
  writer.page = writer.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(writer: PdfWriter, height: number) {
  if (writer.y - height < MARGIN) addPage(writer);
}

function drawText(
  writer: PdfWriter,
  text: string,
  options: {
    x?: number;
    size?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    lineGap?: number;
    maxWidth?: number;
  } = {}
) {
  const x = options.x ?? MARGIN;
  const size = options.size ?? 10;
  const font = options.font ?? writer.regular;
  const color = options.color ?? rgb(0.12, 0.16, 0.24);
  const lineGap = options.lineGap ?? 4;
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
  const lines = wrapText(text, font, size, maxWidth);
  ensureSpace(writer, lines.length * (size + lineGap) + 4);
  for (const line of lines) {
    writer.page.drawText(line, { x, y: writer.y, size, font, color });
    writer.y -= size + lineGap;
  }
}

function drawSectionTitle(writer: PdfWriter, title: string) {
  ensureSpace(writer, 36);
  writer.y -= 10;
  writer.page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y: writer.y,
    size: 11,
    font: writer.bold,
    color: rgb(0.08, 0.25, 0.56),
  });
  writer.y -= 18;
}

function drawKeyValue(writer: PdfWriter, label: string, value: string) {
  ensureSpace(writer, 22);
  writer.page.drawText(`${label}:`, {
    x: MARGIN,
    y: writer.y,
    size: 10,
    font: writer.bold,
    color: rgb(0.1, 0.15, 0.24),
  });
  drawText(writer, value, {
    x: MARGIN + 116,
    size: 10,
    maxWidth: CONTENT_WIDTH - 116,
    color: rgb(0.2, 0.27, 0.38),
  });
}

function drawFinding(writer: PdfWriter, title: string, detail: string, notes: string) {
  ensureSpace(writer, 82);
  writer.page.drawRectangle({
    x: MARGIN,
    y: writer.y - 8,
    width: CONTENT_WIDTH,
    height: 1,
    color: rgb(0.82, 0.87, 0.94),
  });
  writer.y -= 24;
  drawText(writer, title, { size: 11, font: writer.bold, color: rgb(0.1, 0.15, 0.24) });
  drawText(writer, detail, { size: 9, color: rgb(0.38, 0.45, 0.56) });
  drawText(writer, notes, { size: 10, color: rgb(0.2, 0.27, 0.38) });
}

export async function generateFieldAuditReportPdf(params: FieldAuditReportPdfParams) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const writer: PdfWriter = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  };

  const compliance = formatPercent(params.scoreSummary.compliancePercent);
  const findingCount = getScoreValue(params.scoreSummary, "fail");
  const scoredCount = getScoreValue(params.scoreSummary, "total");
  const aiSummary = getPdfSummary(params.aiReviewSummary);
  const failedObservations = params.observations.filter((observation) => observation.status === "fail");
  const reportStatus = params.reportStatus === "approved" ? "Approved customer copy" : "Reviewer preview";

  writer.page.drawText("SAFETY360 FIELD", {
    x: MARGIN,
    y: writer.y,
    size: 11,
    font: bold,
    color: rgb(0.12, 0.28, 0.62),
  });
  writer.page.drawText(reportStatus, {
    x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(reportStatus, 10),
    y: writer.y,
    size: 10,
    font: bold,
    color: params.reportStatus === "approved" ? rgb(0.05, 0.46, 0.28) : rgb(0.55, 0.35, 0.04),
  });
  writer.y -= 32;
  drawText(writer, "Finished Field Audit Report", { size: 26, font: bold, color: rgb(0.06, 0.1, 0.18) });
  drawText(writer, cleanText(params.jobsiteName, "Jobsite"), {
    size: 15,
    font: bold,
    color: rgb(0.18, 0.25, 0.36),
  });
  writer.y -= 8;

  drawSectionTitle(writer, "Report details");
  drawKeyValue(writer, "Company", cleanText(params.companyName, "Safety360 Docs"));
  drawKeyValue(writer, "Customer", cleanText(params.customerName, "Not specified"));
  drawKeyValue(writer, "Audit date", cleanText(params.auditDate));
  drawKeyValue(writer, "Auditor(s)", cleanText(params.auditors));
  drawKeyValue(writer, "Trade/scope", formatTrade(params.selectedTrade));
  drawKeyValue(writer, "Compliance", compliance);
  drawKeyValue(writer, "Findings", `${findingCount} failed items of ${scoredCount} scored items`);
  drawKeyValue(
    writer,
    "Hours billed",
    typeof params.hoursBilled === "number" ? String(params.hoursBilled) : "Not specified"
  );
  drawKeyValue(writer, "Reviewer", cleanText(params.reviewerName, "Company admin"));

  if (aiSummary.openingSummary) {
    drawSectionTitle(writer, "AI reviewed summary");
    drawText(writer, aiSummary.openingSummary, { size: 10.5, color: rgb(0.16, 0.23, 0.34), lineGap: 5 });
  }

  drawSectionTitle(writer, "Findings summary");
  if (aiSummary.findingHighlights.length > 0) {
    aiSummary.findingHighlights.slice(0, 16).forEach((finding, index) => {
      drawFinding(writer, `Finding ${index + 1}`, "AI-reviewed report highlight", finding);
    });
  } else if (failedObservations.length > 0) {
    failedObservations.slice(0, 24).forEach((finding) => {
      drawFinding(
        writer,
        cleanText(finding.item_label, "Finding"),
        `${cleanText(finding.category_label, "Audit item")} | Severity: ${cleanText(finding.severity, "medium")}`,
        cleanText(finding.notes, "Corrective action required. No field notes were provided.")
      );
    });
  } else {
    drawText(writer, "No failed checklist items were recorded.", {
      size: 11,
      color: rgb(0.05, 0.46, 0.28),
    });
  }

  drawSectionTitle(writer, "Approval note");
  drawText(
    writer,
    params.reportStatus === "approved"
      ? "This report was reviewed and approved by the company admin before customer delivery."
      : "This PDF is a reviewer preview. Approve the audit to send the finished PDF to the saved customer email.",
    { size: 10, color: rgb(0.25, 0.32, 0.43) }
  );

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 72,
      y: 26,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.52, 0.62),
    });
  });

  const bytes = await doc.save();
  const datePart = sanitizeFilePart(params.auditDate || new Date().toISOString().slice(0, 10));
  const jobsitePart = sanitizeFilePart(params.jobsiteName || "jobsite");
  return {
    bytes,
    filename: `${jobsitePart}-field-audit-${datePart}.pdf`,
  };
}
