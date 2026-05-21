import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { SafePredictDemoCompany, SafePredictDemoEmployee } from "@/lib/safePredictMockData";
import type { SafePredictJobsiteRecord } from "@/lib/safePredictData";

export type SafePredictWorkforceReportKind = "command" | "training" | "permit";

export type SafePredictWorkforceReportParams = {
  kind: SafePredictWorkforceReportKind;
  company: SafePredictDemoCompany;
  workforce: {
    workers: number;
    compliant: number;
    expiringSoon: number;
    overdue: number;
    compliantPercent: number;
    expiringSoonPercent: number;
    overduePercent: number;
  };
  permits: {
    active: number;
    expiringSoon: number;
    expired: number;
  };
  employees: SafePredictDemoEmployee[];
  jobsites: SafePredictJobsiteRecord[];
  trades: Array<{
    trade: string;
    workers: number;
    overdueCount: number;
    expiringCount: number;
    compliantCount: number;
    overallStatus?: string;
  }>;
  permitGroups: Array<{
    category: string;
    active: number;
    expiringSoon: number;
    expired: number;
    missingSignatures: number;
  }>;
  workflowItems: Array<{
    kind: string;
    title: string;
    detail: string;
    actionTitle: string;
    linkedRisk: string;
    siteName: string;
    severity: string;
    dueAt: string;
  }>;
};

type PdfWriter = {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
  pageNumber: number;
};

type TableColumn<T> = {
  label: string;
  width: number;
  value: (row: T) => string | number;
  tone?: (row: T) => "red" | "amber" | "green" | "blue" | "slate";
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const NAVY = rgb(0.05, 0.1, 0.19);
const TEXT = rgb(0.13, 0.18, 0.29);
const MUTED = rgb(0.39, 0.46, 0.57);
const LINE = rgb(0.86, 0.89, 0.94);
const BLUE = rgb(0.09, 0.32, 0.78);
const RED = rgb(0.78, 0.11, 0.15);
const AMBER = rgb(0.77, 0.44, 0.04);
const GREEN = rgb(0.03, 0.45, 0.28);
const SOFT_BLUE = rgb(0.93, 0.96, 1);
const SOFT_RED = rgb(1, 0.94, 0.94);
const SOFT_AMBER = rgb(1, 0.97, 0.9);
const SOFT_GREEN = rgb(0.92, 0.98, 0.95);
const SOFT_SLATE = rgb(0.96, 0.98, 1);

const reportTitles: Record<SafePredictWorkforceReportKind, string> = {
  command: "Workforce Command Report",
  training: "Training Exceptions Report",
  permit: "Permit Exposure Report",
};

function cleanText(value: unknown, fallback = "Not specified") {
  const text = String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function fileSafe(value: string) {
  return cleanText(value, "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
}

function formatDate(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toneColors(tone: "red" | "amber" | "green" | "blue" | "slate") {
  if (tone === "red") return { background: SOFT_RED, foreground: RED, border: rgb(0.98, 0.74, 0.74) };
  if (tone === "amber") return { background: SOFT_AMBER, foreground: AMBER, border: rgb(0.96, 0.82, 0.5) };
  if (tone === "green") return { background: SOFT_GREEN, foreground: GREEN, border: rgb(0.67, 0.88, 0.76) };
  if (tone === "blue") return { background: SOFT_BLUE, foreground: BLUE, border: rgb(0.72, 0.82, 0.96) };
  return { background: SOFT_SLATE, foreground: TEXT, border: LINE };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanText(text, "").split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }
      let segment = "";
      for (const char of word) {
        const candidate = `${segment}${char}`;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          segment = candidate;
        } else {
          if (segment) lines.push(segment);
          segment = char;
        }
      }
      current = segment;
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function addPage(writer: PdfWriter) {
  writer.page = writer.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.pageNumber += 1;
  writer.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(writer: PdfWriter, height: number) {
  if (writer.y - height < 72) addPage(writer);
}

function drawText(
  writer: PdfWriter,
  text: string,
  options: {
    x?: number;
    y?: number;
    size?: number;
    font?: PDFFont;
    color?: RGB;
    maxWidth?: number;
    lineGap?: number;
  } = {}
) {
  const size = options.size ?? 10;
  const font = options.font ?? writer.regular;
  const x = options.x ?? MARGIN;
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
  const lineGap = options.lineGap ?? 4;
  const lines = wrapText(text, font, size, maxWidth);
  const required = lines.length * (size + lineGap) + 2;
  if (options.y === undefined) ensureSpace(writer, required);
  let y = options.y ?? writer.y;
  for (const line of lines) {
    writer.page.drawText(line, {
      x,
      y,
      size,
      font,
      color: options.color ?? TEXT,
    });
    y -= size + lineGap;
  }
  if (options.y === undefined) writer.y = y;
}

function drawHeader(writer: PdfWriter, params: SafePredictWorkforceReportParams, generatedAt: Date) {
  writer.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 146, width: PAGE_WIDTH, height: 146, color: NAVY });
  writer.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 149, width: PAGE_WIDTH, height: 3, color: BLUE });
  writer.page.drawText("SafetyDocs360", {
    x: MARGIN,
    y: PAGE_HEIGHT - 46,
    size: 11,
    font: writer.bold,
    color: rgb(0.75, 0.86, 1),
  });
  writer.page.drawText("Safety AI Engine", {
    x: PAGE_WIDTH - MARGIN - writer.bold.widthOfTextAtSize("Safety AI Engine", 10),
    y: PAGE_HEIGHT - 46,
    size: 10,
    font: writer.bold,
    color: rgb(0.75, 0.86, 1),
  });
  writer.page.drawText(reportTitles[params.kind], {
    x: MARGIN,
    y: PAGE_HEIGHT - 86,
    size: 24,
    font: writer.bold,
    color: rgb(1, 1, 1),
  });
  drawText(writer, cleanText(params.company.name, "Company workspace"), {
    x: MARGIN,
    y: PAGE_HEIGHT - 108,
    size: 11,
    color: rgb(0.86, 0.91, 0.98),
    maxWidth: 340,
  });
  writer.page.drawText(`Generated ${formatDate(generatedAt)}`, {
    x: PAGE_WIDTH - MARGIN - writer.regular.widthOfTextAtSize(`Generated ${formatDate(generatedAt)}`, 9),
    y: PAGE_HEIGHT - 108,
    size: 9,
    font: writer.regular,
    color: rgb(0.86, 0.91, 0.98),
  });
  writer.y = PAGE_HEIGHT - 178;
}

function drawSectionTitle(writer: PdfWriter, title: string, subtitle?: string) {
  ensureSpace(writer, subtitle ? 54 : 34);
  writer.page.drawText(title, {
    x: MARGIN,
    y: writer.y,
    size: 14,
    font: writer.bold,
    color: NAVY,
  });
  writer.y -= 16;
  if (subtitle) {
    drawText(writer, subtitle, { size: 9.5, color: MUTED, lineGap: 4 });
    writer.y -= 4;
  } else {
    writer.y -= 10;
  }
}

function drawMetricCard(writer: PdfWriter, x: number, y: number, width: number, label: string, value: string, detail: string, tone: "red" | "amber" | "green" | "blue" | "slate") {
  const colors = toneColors(tone);
  writer.page.drawRectangle({ x, y: y - 76, width, height: 76, color: rgb(1, 1, 1), borderColor: colors.border, borderWidth: 1 });
  writer.page.drawRectangle({ x, y: y - 76, width: 5, height: 76, color: colors.foreground });
  writer.page.drawText(cleanText(label).toUpperCase(), {
    x: x + 14,
    y: y - 20,
    size: 7.5,
    font: writer.bold,
    color: MUTED,
  });
  writer.page.drawText(value, {
    x: x + 14,
    y: y - 44,
    size: 21,
    font: writer.bold,
    color: colors.foreground,
  });
  drawText(writer, detail, {
    x: x + 14,
    y: y - 62,
    size: 8,
    color: MUTED,
    maxWidth: width - 24,
    lineGap: 3,
  });
}

function drawExecutiveMetrics(writer: PdfWriter, params: SafePredictWorkforceReportParams) {
  ensureSpace(writer, 92);
  const gap = 10;
  const width = (CONTENT_WIDTH - gap * 3) / 4;
  const y = writer.y;
  drawMetricCard(writer, MARGIN, y, width, "Workers", String(params.workforce.workers), `${params.workforce.compliantPercent}% currently compliant`, params.workforce.overdue > 0 ? "amber" : "green");
  drawMetricCard(writer, MARGIN + (width + gap), y, width, "Overdue", String(params.workforce.overdue), "Training readiness exceptions", params.workforce.overdue > 0 ? "red" : "green");
  drawMetricCard(writer, MARGIN + (width + gap) * 2, y, width, "Permit Exposure", String(params.permits.expiringSoon + params.permits.expired), `${params.permits.expired} overdue permits`, params.permits.expired > 0 ? "red" : params.permits.expiringSoon > 0 ? "amber" : "green");
  drawMetricCard(writer, MARGIN + (width + gap) * 3, y, width, "AI Actions", String(params.workflowItems.length), "Recommended follow-through", params.workflowItems.some((item) => item.severity === "critical") ? "red" : "blue");
  writer.y -= 102;
}

function drawCallout(writer: PdfWriter, title: string, detail: string, tone: "red" | "amber" | "green" | "blue" | "slate" = "blue") {
  const colors = toneColors(tone);
  const detailLines = wrapText(detail, writer.regular, 9.5, CONTENT_WIDTH - 30);
  const height = 42 + detailLines.length * 13;
  ensureSpace(writer, height + 8);
  writer.page.drawRectangle({
    x: MARGIN,
    y: writer.y - height,
    width: CONTENT_WIDTH,
    height,
    color: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  });
  writer.page.drawText(title, { x: MARGIN + 14, y: writer.y - 21, size: 11, font: writer.bold, color: colors.foreground });
  let y = writer.y - 39;
  for (const line of detailLines) {
    writer.page.drawText(line, { x: MARGIN + 14, y, size: 9.5, font: writer.regular, color: TEXT });
    y -= 13;
  }
  writer.y -= height + 14;
}

function drawTable<T>(writer: PdfWriter, title: string, columns: Array<TableColumn<T>>, rows: T[], emptyText: string, maxRows = 12) {
  drawSectionTitle(writer, title);
  if (rows.length === 0) {
    drawCallout(writer, "No active exceptions", emptyText, "green");
    return;
  }

  const headerHeight = 26;
  const rowPadding = 8;
  const visibleRows = rows.slice(0, maxRows);
  ensureSpace(writer, headerHeight + 44);
  writer.page.drawRectangle({ x: MARGIN, y: writer.y - headerHeight, width: CONTENT_WIDTH, height: headerHeight, color: SOFT_SLATE, borderColor: LINE, borderWidth: 1 });
  let x = MARGIN;
  for (const column of columns) {
    writer.page.drawText(column.label.toUpperCase(), { x: x + 7, y: writer.y - 17, size: 7, font: writer.bold, color: MUTED });
    x += column.width;
  }
  writer.y -= headerHeight;

  for (const row of visibleRows) {
    const cells = columns.map((column) => ({
      column,
      value: cleanText(column.value(row), ""),
    }));
    const lineCounts = cells.map((cell) => wrapText(cell.value, writer.regular, 8.5, cell.column.width - 14).length);
    const rowHeight = Math.max(30, Math.max(...lineCounts) * 11 + rowPadding * 2);
    ensureSpace(writer, rowHeight + 8);
    writer.page.drawRectangle({ x: MARGIN, y: writer.y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 0.7 });
    x = MARGIN;
    for (const cell of cells) {
      const tone = cell.column.tone?.(row);
      const color = tone ? toneColors(tone).foreground : TEXT;
      const font = tone ? writer.bold : writer.regular;
      const lines = wrapText(cell.value, font, 8.5, cell.column.width - 14);
      let lineY = writer.y - rowPadding - 8.5;
      for (const line of lines.slice(0, 4)) {
        writer.page.drawText(line, { x: x + 7, y: lineY, size: 8.5, font, color });
        lineY -= 11;
      }
      x += cell.column.width;
    }
    writer.y -= rowHeight;
  }

  if (rows.length > visibleRows.length) {
    writer.y -= 8;
    drawText(writer, `${rows.length - visibleRows.length} additional row(s) omitted from this summary view. Review the dashboard for the full working list.`, {
      size: 8.5,
      color: MUTED,
    });
  }
  writer.y -= 8;
}

function jobsiteRiskTone(jobsite: SafePredictJobsiteRecord) {
  if (jobsite.riskLevel === "critical" || jobsite.riskLevel === "high") return "red";
  if (jobsite.riskLevel === "medium") return "amber";
  return "green";
}

function drawCommandReport(writer: PdfWriter, params: SafePredictWorkforceReportParams) {
  const elevatedJobsites = params.jobsites
    .filter((jobsite) => jobsite.riskLevel === "critical" || jobsite.riskLevel === "high" || jobsite.openActions > 0)
    .sort((a, b) => b.riskScore - a.riskScore || b.openActions - a.openActions);
  const criticalActions = params.workflowItems.filter((item) => item.severity === "critical");

  drawSectionTitle(writer, "Executive Summary", "A short leadership view of workforce readiness, permit exposure, and recommended prevention follow-through.");
  drawCallout(
    writer,
    criticalActions.length > 0 ? "Immediate review recommended" : "Current command posture",
    criticalActions.length > 0
      ? `${criticalActions.length} critical action(s) are active. Safety leadership should review affected jobsites and consider stop-work evaluation where controls are missing or conditions are changing.`
      : "No critical workforce actions are active in this filtered view. Continue monitoring expiring training, permit renewals, and elevated jobsite signals.",
    criticalActions.length > 0 ? "red" : "green"
  );

  drawTable(
    writer,
    "Top Forecast Actions",
    [
      { label: "Severity", width: 70, value: (row) => row.severity, tone: (row) => (row.severity === "critical" ? "red" : row.severity === "high" ? "amber" : "blue") },
      { label: "Recommended Action", width: 210, value: (row) => row.actionTitle },
      { label: "Jobsite", width: 130, value: (row) => row.siteName },
      { label: "Due", width: 70, value: (row) => formatShortDate(row.dueAt) },
      { label: "Driver", width: CONTENT_WIDTH - 480, value: (row) => row.linkedRisk },
    ],
    params.workflowItems,
    "No forecast actions are currently queued.",
    8
  );

  drawTable(
    writer,
    "Jobsites Needing Attention",
    [
      { label: "Jobsite", width: 190, value: (row) => row.name },
      { label: "Risk", width: 74, value: (row) => row.riskLevel, tone: jobsiteRiskTone },
      { label: "Score", width: 54, value: (row) => row.riskScore },
      { label: "Open Actions", width: 82, value: (row) => row.openActions },
      { label: "Phase", width: CONTENT_WIDTH - 400, value: (row) => row.phase },
    ],
    elevatedJobsites,
    "No elevated jobsite signals are active.",
    8
  );
}

function drawTrainingReport(writer: PdfWriter, params: SafePredictWorkforceReportParams) {
  const exceptionWorkers = params.employees
    .filter((employee) => employee.status !== "compliant")
    .sort((a, b) => (a.status === "overdue" ? 0 : 1) - (b.status === "overdue" ? 0 : 1) || a.readinessScore - b.readinessScore);
  const exceptionTrades = params.trades
    .filter((trade) => trade.overdueCount > 0 || trade.expiringCount > 0)
    .sort((a, b) => b.overdueCount - a.overdueCount || b.expiringCount - a.expiringCount || a.trade.localeCompare(b.trade));

  drawSectionTitle(writer, "Training Readiness Position", "Prioritized worker and trade exceptions for supervisors and training coordinators.");
  drawCallout(
    writer,
    params.workforce.overdue > 0 ? "Overdue training requires action" : "Training posture is stable",
    params.workforce.overdue > 0
      ? `${params.workforce.overdue} worker(s) are overdue. Restrict permit-controlled or high-risk task assignment until required training is current or a competent review approves an interim control.`
      : "No overdue worker training is active in this view. Continue resolving expiring modules before they become work restrictions.",
    params.workforce.overdue > 0 ? "red" : "green"
  );

  drawTable(
    writer,
    "Worker Exceptions",
    [
      { label: "Worker", width: 130, value: (row) => row.name },
      { label: "Trade", width: 105, value: (row) => row.trade },
      { label: "Status", width: 76, value: (row) => row.status, tone: (row) => (row.status === "overdue" ? "red" : "amber") },
      { label: "Score", width: 54, value: (row) => row.readinessScore },
      { label: "Supervisor", width: 110, value: (row) => row.supervisor },
      { label: "Last Activity", width: CONTENT_WIDTH - 475, value: (row) => row.lastActivity },
    ],
    exceptionWorkers,
    "No worker training exceptions are active.",
    12
  );

  drawTable(
    writer,
    "Trade Readiness Rollup",
    [
      { label: "Trade", width: 160, value: (row) => row.trade },
      { label: "Workers", width: 68, value: (row) => row.workers },
      { label: "Overdue", width: 72, value: (row) => row.overdueCount, tone: (row) => (row.overdueCount > 0 ? "red" : "green") },
      { label: "Expiring", width: 72, value: (row) => row.expiringCount, tone: (row) => (row.expiringCount > 0 ? "amber" : "green") },
      { label: "Compliant", width: 78, value: (row) => row.compliantCount, tone: () => "green" },
      { label: "Overall", width: CONTENT_WIDTH - 450, value: (row) => row.overallStatus ?? "Not scored" },
    ],
    exceptionTrades,
    "No trade-level training exceptions are active.",
    12
  );
}

function drawPermitReport(writer: PdfWriter, params: SafePredictWorkforceReportParams) {
  const exposedGroups = params.permitGroups
    .filter((group) => group.expired > 0 || group.expiringSoon > 0 || group.missingSignatures > 0)
    .sort((a, b) => b.expired - a.expired || b.expiringSoon - a.expiringSoon || b.missingSignatures - a.missingSignatures);

  drawSectionTitle(writer, "Permit Exposure Position", "High-risk permit categories with renewal, expiry, or signature gaps.");
  drawCallout(
    writer,
    params.permits.expired > 0 ? "Overdue permit exposure" : "Permit renewals are being watched",
    params.permits.expired > 0
      ? `${params.permits.expired} overdue permit(s) are active. Affected work should be reviewed before continuing, especially hot work, energy control, confined space, excavation, lifting, and work at height.`
      : `${params.permits.expiringSoon} permit(s) are expiring soon. Assign owners now so permit-controlled work does not continue past its authorization window.`,
    params.permits.expired > 0 ? "red" : params.permits.expiringSoon > 0 ? "amber" : "green"
  );

  drawTable(
    writer,
    "Permit Categories",
    [
      { label: "Category", width: 180, value: (row) => row.category },
      { label: "Active", width: 60, value: (row) => row.active },
      { label: "Expiring", width: 74, value: (row) => row.expiringSoon, tone: (row) => (row.expiringSoon > 0 ? "amber" : "green") },
      { label: "Overdue", width: 74, value: (row) => row.expired, tone: (row) => (row.expired > 0 ? "red" : "green") },
      { label: "Missing Signatures", width: 102, value: (row) => row.missingSignatures, tone: (row) => (row.missingSignatures > 0 ? "amber" : "green") },
      { label: "Next Action", width: CONTENT_WIDTH - 490, value: (row) => (row.expired > 0 ? "Review before work continues" : row.expiringSoon > 0 ? "Renew before expiry" : row.missingSignatures > 0 ? "Collect acknowledgement" : "Monitor") },
    ],
    exposedGroups,
    "No permit exposure exceptions are active.",
    12
  );

  drawTable(
    writer,
    "Related Forecast Actions",
    [
      { label: "Severity", width: 72, value: (row) => row.severity, tone: (row) => (row.severity === "critical" ? "red" : row.severity === "high" ? "amber" : "blue") },
      { label: "Action", width: 220, value: (row) => row.actionTitle },
      { label: "Jobsite", width: 130, value: (row) => row.siteName },
      { label: "Due", width: 70, value: (row) => formatShortDate(row.dueAt) },
      { label: "Reason", width: CONTENT_WIDTH - 492, value: (row) => row.detail },
    ],
    params.workflowItems.filter((item) => item.kind === "permit"),
    "No permit-specific forecast actions are active.",
    8
  );
}

function drawFooter(writer: PdfWriter, page: PDFPage, pageNumber: number, pageCount: number) {
  page.drawRectangle({ x: MARGIN, y: 48, width: CONTENT_WIDTH, height: 1, color: LINE });
  page.drawText("SafetyDocs360 - Professional safety report export", {
    x: MARGIN,
    y: 29,
    size: 8,
    font: writer.regular,
    color: MUTED,
  });
  page.drawText(`Page ${pageNumber} of ${pageCount}`, {
    x: PAGE_WIDTH - MARGIN - 72,
    y: 29,
    size: 8,
    font: writer.regular,
    color: MUTED,
  });
}

export async function generateSafePredictWorkforceReportPdf(params: SafePredictWorkforceReportParams) {
  const generatedAt = new Date();
  const doc = await PDFDocument.create();
  doc.setTitle(reportTitles[params.kind]);
  doc.setSubject("SafetyDocs360 workforce readiness report");
  doc.setCreator("SafetyDocs360");
  doc.setProducer("SafetyDocs360");
  doc.setCreationDate(generatedAt);
  doc.setModificationDate(generatedAt);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const writer: PdfWriter = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
    pageNumber: 1,
  };

  drawHeader(writer, params, generatedAt);
  drawExecutiveMetrics(writer, params);

  if (params.kind === "training") {
    drawTrainingReport(writer, params);
  } else if (params.kind === "permit") {
    drawPermitReport(writer, params);
  } else {
    drawCommandReport(writer, params);
  }

  drawSectionTitle(writer, "Professional Review Note");
  drawText(
    writer,
    "This report supports safety professional review and field follow-through. It does not guarantee compliance and should be reconciled with jobsite conditions, competent-person determinations, and applicable customer or regulatory requirements.",
    { size: 9.5, color: MUTED, lineGap: 4 }
  );

  const pages = doc.getPages();
  pages.forEach((page, index) => drawFooter(writer, page, index + 1, pages.length));

  const bytes = await doc.save();
  const filename = `${fileSafe(reportTitles[params.kind])}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
  return { bytes, filename };
}
