import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { DOCUMENT_DISCLAIMER_LINES } from "@/lib/legal";

export type AuditReportStatus = "preview" | "approved";

export type AuditPdfMetric = {
  label: string;
  value: string;
};

export type AuditPdfKeyValue = {
  label: string;
  value: string;
};

export type AuditPdfFinding = {
  title: string;
  detail: string;
  notes: string;
  tone?: "neutral" | "warning" | "critical" | "success";
};

export type AuditPdfChecklistRow = {
  section: string;
  item: string;
  status: string;
  comment: string;
  evidence?: string | null;
};

export type AuditPdfWriter = {
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

const COLORS = {
  ink: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.36, 0.42, 0.5),
  navy: rgb(0.09, 0.21, 0.36),
  blue: rgb(0.12, 0.3, 0.52),
  gold: rgb(0.72, 0.47, 0.05),
  green: rgb(0.04, 0.42, 0.25),
  red: rgb(0.74, 0.12, 0.12),
  amber: rgb(0.68, 0.41, 0.03),
  border: rgb(0.76, 0.81, 0.88),
  paleBlue: rgb(0.94, 0.97, 1),
  paleGold: rgb(1, 0.97, 0.88),
  paleRed: rgb(1, 0.91, 0.88),
  white: rgb(1, 1, 1),
};

export function cleanAuditPdfText(value: unknown, fallback = "Not specified") {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

export function sanitizeAuditPdfFilePart(value: string) {
  const cleaned = value
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "audit-report";
}

export async function createAuditPdfWriter() {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  } satisfies AuditPdfWriter;
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
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    let piece = "";
    for (const char of word) {
      const next = `${piece}${char}`;
      if (font.widthOfTextAtSize(next, size) > maxWidth && piece) {
        lines.push(piece);
        piece = char;
      } else {
        piece = next;
      }
    }
    current = piece;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function addAuditPdfPage(writer: AuditPdfWriter) {
  writer.page = writer.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(writer: AuditPdfWriter, height: number) {
  if (writer.y - height < MARGIN) addAuditPdfPage(writer);
}

export function drawAuditPdfText(
  writer: AuditPdfWriter,
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
  const color = options.color ?? COLORS.ink;
  const lineGap = options.lineGap ?? 4;
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
  const lines = wrapText(text, font, size, maxWidth);
  ensureSpace(writer, lines.length * (size + lineGap) + 4);
  for (const line of lines) {
    writer.page.drawText(line, { x, y: writer.y, size, font, color });
    writer.y -= size + lineGap;
  }
}

export function drawAuditPdfSectionTitle(writer: AuditPdfWriter, title: string) {
  ensureSpace(writer, 46);
  writer.y -= 14;
  writer.page.drawRectangle({
    x: MARGIN,
    y: writer.y - 7,
    width: 8,
    height: 18,
    color: COLORS.gold,
  });
  writer.page.drawText(title.toUpperCase(), {
    x: MARGIN + 16,
    y: writer.y,
    size: 12,
    font: writer.bold,
    color: COLORS.navy,
  });
  writer.y -= 20;
}

export function drawAuditPdfKeyValue(writer: AuditPdfWriter, label: string, value: string) {
  ensureSpace(writer, 26);
  writer.page.drawText(`${label}:`, {
    x: MARGIN,
    y: writer.y,
    size: 9,
    font: writer.bold,
    color: COLORS.navy,
  });
  drawAuditPdfText(writer, value, {
    x: MARGIN + 132,
    size: 9,
    maxWidth: CONTENT_WIDTH - 132,
    color: COLORS.ink,
  });
}

export function drawAuditPdfCover(params: {
  writer: AuditPdfWriter;
  title: string;
  subtitle: string;
  companyName: string;
  jobsiteName: string;
  reportStatus: AuditReportStatus;
  metadata: AuditPdfKeyValue[];
}) {
  const { writer } = params;
  const statusLabel = params.reportStatus === "approved" ? "Approved customer copy" : "Reviewer preview";

  writer.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 132,
    width: PAGE_WIDTH,
    height: 132,
    color: COLORS.paleBlue,
  });
  writer.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 136,
    width: PAGE_WIDTH,
    height: 4,
    color: COLORS.gold,
  });

  writer.page.drawText("SAFETY360 AUDIT PACKAGE", {
    x: MARGIN,
    y: PAGE_HEIGHT - 72,
    size: 11,
    font: writer.bold,
    color: COLORS.blue,
  });
  writer.page.drawText(statusLabel, {
    x: PAGE_WIDTH - MARGIN - writer.bold.widthOfTextAtSize(statusLabel, 10),
    y: PAGE_HEIGHT - 72,
    size: 10,
    font: writer.bold,
    color: params.reportStatus === "approved" ? COLORS.green : COLORS.amber,
  });
  writer.page.drawText("PROJECT / SITE SPECIFIC", {
    x: MARGIN,
    y: PAGE_HEIGHT - 94,
    size: 10,
    font: writer.bold,
    color: COLORS.muted,
  });

  writer.y = PAGE_HEIGHT - 184;
  drawAuditPdfText(writer, params.title, { size: 29, font: writer.bold, color: COLORS.ink, lineGap: 7 });
  drawAuditPdfText(writer, params.subtitle, { size: 13, font: writer.bold, color: COLORS.gold });
  drawAuditPdfText(writer, params.jobsiteName, { size: 18, font: writer.bold, color: COLORS.navy });
  drawAuditPdfText(writer, params.companyName, { size: 12, color: COLORS.muted });

  writer.y -= 14;
  writer.page.drawRectangle({
    x: MARGIN,
    y: writer.y - 138,
    width: CONTENT_WIDTH,
    height: 150,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.white,
  });
  writer.y -= 18;
  drawAuditPdfText(writer, "Report Control", { size: 12, font: writer.bold, color: COLORS.navy });
  for (const item of params.metadata) {
    drawAuditPdfKeyValue(writer, item.label, item.value);
  }
  drawAuditPdfKeyValue(writer, "Issue status", statusLabel);

  writer.y = MARGIN + 78;
  drawAuditPdfText(writer, "This audit report is a controlled safety record. It supports review and follow-up by qualified company personnel; it does not guarantee regulatory compliance.", {
    size: 9,
    color: COLORS.muted,
    lineGap: 4,
  });
  addAuditPdfPage(writer);
}

export function drawAuditPdfMetrics(writer: AuditPdfWriter, metrics: AuditPdfMetric[]) {
  const gap = 8;
  const width = (CONTENT_WIDTH - gap * (metrics.length - 1)) / metrics.length;
  ensureSpace(writer, 66);
  metrics.forEach((metric, index) => {
    const x = MARGIN + index * (width + gap);
    writer.page.drawRectangle({
      x,
      y: writer.y - 48,
      width,
      height: 52,
      borderWidth: 1,
      borderColor: COLORS.border,
      color: COLORS.paleBlue,
    });
    writer.page.drawText(metric.label.toUpperCase(), {
      x: x + 10,
      y: writer.y - 15,
      size: 7,
      font: writer.bold,
      color: COLORS.muted,
    });
    writer.page.drawText(metric.value, {
      x: x + 10,
      y: writer.y - 38,
      size: 18,
      font: writer.bold,
      color: COLORS.navy,
    });
  });
  writer.y -= 64;
}

function findingToneColor(tone: AuditPdfFinding["tone"]) {
  if (tone === "critical") return { fill: COLORS.paleRed, text: COLORS.red };
  if (tone === "warning") return { fill: COLORS.paleGold, text: COLORS.amber };
  if (tone === "success") return { fill: rgb(0.92, 0.98, 0.94), text: COLORS.green };
  return { fill: COLORS.white, text: COLORS.navy };
}

export function drawAuditPdfFinding(writer: AuditPdfWriter, finding: AuditPdfFinding) {
  const tone = findingToneColor(finding.tone);
  ensureSpace(writer, 98);
  const top = writer.y;
  writer.page.drawRectangle({
    x: MARGIN,
    y: top - 74,
    width: CONTENT_WIDTH,
    height: 82,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: tone.fill,
  });
  writer.y -= 14;
  drawAuditPdfText(writer, finding.title, {
    x: MARGIN + 12,
    size: 11,
    font: writer.bold,
    color: tone.text,
    maxWidth: CONTENT_WIDTH - 24,
  });
  drawAuditPdfText(writer, finding.detail, {
    x: MARGIN + 12,
    size: 8,
    font: writer.bold,
    color: COLORS.muted,
    maxWidth: CONTENT_WIDTH - 24,
  });
  drawAuditPdfText(writer, finding.notes, {
    x: MARGIN + 12,
    size: 9,
    color: COLORS.ink,
    maxWidth: CONTENT_WIDTH - 24,
  });
  writer.y = Math.min(writer.y, top - 88);
}

export function drawAuditPdfChecklistRows(writer: AuditPdfWriter, rows: AuditPdfChecklistRow[]) {
  const columns = [92, 188, 56, 134, 46];
  ensureSpace(writer, 40);
  const headers = ["Section", "Item", "Status", "Comment", "Evidence"];
  let x = MARGIN;
  writer.page.drawRectangle({
    x: MARGIN,
    y: writer.y - 18,
    width: CONTENT_WIDTH,
    height: 24,
    color: COLORS.paleBlue,
    borderWidth: 1,
    borderColor: COLORS.border,
  });
  headers.forEach((header, index) => {
    writer.page.drawText(header, {
      x: x + 4,
      y: writer.y - 10,
      size: 7,
      font: writer.bold,
      color: COLORS.navy,
    });
    x += columns[index];
  });
  writer.y -= 26;

  rows.forEach((row) => {
    ensureSpace(writer, 54);
    const cellLines = [
      wrapText(row.section, writer.regular, 7, columns[0] - 8),
      wrapText(row.item, writer.regular, 7, columns[1] - 8),
      wrapText(row.status.toUpperCase(), writer.bold, 7, columns[2] - 8),
      wrapText(row.comment, writer.regular, 7, columns[3] - 8),
      wrapText(row.evidence || "", writer.regular, 7, columns[4] - 8),
    ];
    const rowHeight = Math.max(30, Math.max(...cellLines.map((lines) => lines.length)) * 10 + 10);
    writer.page.drawRectangle({
      x: MARGIN,
      y: writer.y - rowHeight + 8,
      width: CONTENT_WIDTH,
      height: rowHeight,
      borderWidth: 0.5,
      borderColor: COLORS.border,
      color: COLORS.white,
    });
    x = MARGIN;
    cellLines.forEach((lines, index) => {
      lines.slice(0, 5).forEach((line, lineIndex) => {
        writer.page.drawText(line, {
          x: x + 4,
          y: writer.y - 4 - lineIndex * 10,
          size: 7,
          font: index === 2 ? writer.bold : writer.regular,
          color: index === 2 && row.status.toLowerCase() === "fail" ? COLORS.red : COLORS.ink,
        });
      });
      x += columns[index];
    });
    writer.y -= rowHeight;
  });
}

export function drawAuditPdfDisclaimer(writer: AuditPdfWriter) {
  drawAuditPdfSectionTitle(writer, "Safety disclaimer");
  DOCUMENT_DISCLAIMER_LINES.forEach((line) => {
    drawAuditPdfText(writer, line, { size: 8, color: COLORS.muted, lineGap: 3 });
  });
}

export async function finalizeAuditPdf(writer: AuditPdfWriter) {
  const pages = writer.doc.getPages();
  pages.forEach((page, index) => {
    page.drawText("SafePredict", {
      x: MARGIN,
      y: 26,
      size: 8,
      font: writer.bold,
      color: COLORS.muted,
    });
    page.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 72,
      y: 26,
      size: 8,
      font: writer.regular,
      color: COLORS.muted,
    });
  });
  return writer.doc.save();
}
