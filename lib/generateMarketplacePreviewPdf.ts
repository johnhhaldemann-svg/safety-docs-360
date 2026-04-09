import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { sniffGcDocumentKind } from "@/lib/gcProgramAiReview";
import {
  buildMarketplacePreviewSections,
  normalizePreviewText,
  splitPreviewLines,
} from "@/lib/marketplacePreviewSections";
import { configurePdfParseWorker } from "@/lib/pdfParseWorker";

const MAX_BODY_CHARS = 60_000;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const MAX_LINE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

async function plainTextFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".doc")) {
    return { ok: false, error: "Legacy .doc is not supported. Save as DOCX." };
  }

  let kind: "pdf" | "docx" | null = null;
  if (lower.endsWith(".pdf")) kind = "pdf";
  else if (lower.endsWith(".docx")) kind = "docx";
  else kind = sniffGcDocumentKind(buffer);

  try {
    if (kind === "pdf") {
      const pdfParseModule = await import("pdf-parse");
      const PdfParseCtor =
        (pdfParseModule as { PDFParse?: new (options: { data: Buffer }) => {
          getText: () => PromiseLike<{ text?: string | null }>;
          destroy?: () => PromiseLike<void> | void;
        } }).PDFParse ??
        (pdfParseModule as { default?: new (options: { data: Buffer }) => {
          getText: () => PromiseLike<{ text?: string | null }>;
          destroy?: () => PromiseLike<void> | void;
        } }).default ??
        null;

      if (!PdfParseCtor) {
        return { ok: false, error: "PDF preview parser is unavailable." };
      }

      configurePdfParseWorker(PdfParseCtor as unknown as { setWorker?: (workerSrc?: string) => string });

      const parser = new PdfParseCtor({ data: buffer });
      try {
        const result = await parser.getText();
        const text = normalizePreviewText(result.text ?? "");
        return { ok: true, text: text.slice(0, MAX_BODY_CHARS) };
      } finally {
        await parser.destroy?.();
      }
    }

    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = normalizePreviewText(result.value ?? "");
      return { ok: true, text: text.slice(0, MAX_BODY_CHARS) };
    }

    return { ok: false, error: "Source must be PDF or DOCX for preview generation." };
  } catch {
    return { ok: false, error: "Could not read the source document for preview." };
  }
}

function wrapLineToWidth(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) > MAX_LINE_WIDTH && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildPreviewIntro(documentTitle: string, sourceFileName: string, fallbackNote?: string) {
  const intro = [
    "BUYER PREVIEW ONLY - not the full document",
    `Document: ${documentTitle}`,
    `Source file: ${sourceFileName}`,
    "This copy is watermarked so buyers can judge quality before unlocking the full file.",
  ];
  if (fallbackNote) {
    intro.push(fallbackNote);
  }
  return intro;
}

function drawPageHeader(params: {
  page: import("pdf-lib").PDFPage;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  title: string;
  sourceFileName: string;
  pageNumber: number;
  isFirstPage: boolean;
}) {
  const { page, font, fontBold, title, sourceFileName, pageNumber, isFirstPage } = params;
  const accent = rgb(0.18, 0.54, 0.86);
  const muted = rgb(0.35, 0.39, 0.48);

  page.drawText("MARKETPLACE PREVIEW", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 28,
    size: 9,
    font: fontBold,
    color: accent,
  });

  page.drawText(title.slice(0, 90), {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 52,
    size: isFirstPage ? 18 : 14,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.15),
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 78,
  });

  page.drawText(`Source: ${sourceFileName.slice(0, 100)}`, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 70,
    size: 9.5,
    font,
    color: muted,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 78,
  });

  page.drawText(`Page ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN_X - 46,
    y: PAGE_HEIGHT - 36,
    size: 9,
    font,
    color: muted,
  });

  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - 86,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 1,
    color: accent,
    opacity: 0.35,
  });
}

function drawSummaryBox(params: {
  page: import("pdf-lib").PDFPage;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  lines: string[];
}) {
  const { page, font, fontBold, lines } = params;
  const boxTop = PAGE_HEIGHT - 108;
  const boxHeight = 70;
  const boxBottom = boxTop - boxHeight;
  const fill = rgb(0.97, 0.98, 1);
  const border = rgb(0.77, 0.83, 0.92);
  const titleColor = rgb(0.12, 0.2, 0.32);
  const bodyColor = rgb(0.18, 0.24, 0.34);

  page.drawRectangle({
    x: MARGIN_X,
    y: boxBottom,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: boxHeight,
    borderColor: border,
    borderWidth: 1,
    color: fill,
  });

  page.drawText("Preview highlights", {
    x: MARGIN_X + 12,
    y: boxTop - 18,
    size: 9,
    font: fontBold,
    color: titleColor,
  });

  let y = boxTop - 32;
  for (const line of lines.slice(0, 3)) {
    const wrapped = wrapLineToWidth(line, font, 8.7).slice(0, 2);
    for (const wrappedLine of wrapped) {
      page.drawText(`- ${wrappedLine}`, {
        x: MARGIN_X + 12,
        y,
        size: 8.7,
        font,
        color: bodyColor,
        maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 24,
      });
      y -= 11;
    }
    y -= 2;
  }
}

function drawWatermark(page: import("pdf-lib").PDFPage, fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  page.drawText("PREVIEW ONLY", {
    x: PAGE_WIDTH / 2 - 132,
    y: PAGE_HEIGHT / 2,
    size: 34,
    font: fontBold,
    color: rgb(0.58, 0.63, 0.7),
    rotate: degrees(32),
    opacity: 0.11,
  });
}

function drawPreviewSectionCard(params: {
  page: import("pdf-lib").PDFPage;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  sectionNumber: number;
  sectionTitle: string;
  teaserLines: string[];
  blurredLines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const {
    page,
    font,
    fontBold,
    sectionNumber,
    sectionTitle,
    teaserLines,
    blurredLines,
    x,
    y,
    width,
    height,
  } = params;
  const border = rgb(0.77, 0.83, 0.92);
  const fill = rgb(0.98, 0.99, 1);
  const titleColor = rgb(0.08, 0.14, 0.23);
  const bodyColor = rgb(0.14, 0.18, 0.28);
  const muted = rgb(0.42, 0.47, 0.56);
  const blurFill = rgb(0.9, 0.93, 0.97);

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fill,
    borderColor: border,
    borderWidth: 1,
  });

  page.drawText(`SECTION ${String(sectionNumber + 1).padStart(2, "0")}`, {
    x: x + 14,
    y: y + height - 18,
    size: 8.5,
    font: fontBold,
    color: rgb(0.12, 0.44, 0.72),
  });

  page.drawText(sectionTitle.slice(0, 80), {
    x: x + 14,
    y: y + height - 36,
    size: 13.5,
    font: fontBold,
    color: titleColor,
    maxWidth: width - 122,
  });

  page.drawText("Open sample", {
    x: x + width - 84,
    y: y + height - 18,
    size: 8,
    font: fontBold,
    color: rgb(0.17, 0.45, 0.72),
  });

  let teaserY = y + height - 58;
  for (const teaserLine of teaserLines.slice(0, 2)) {
    const wrapped = wrapLineToWidth(teaserLine, font, 9.2).slice(0, 3);
    for (const wrappedLine of wrapped) {
      page.drawText(wrappedLine, {
        x: x + 14,
        y: teaserY,
        size: 9.2,
        font,
        color: bodyColor,
        maxWidth: width - 28,
      });
      teaserY -= 12;
    }
    teaserY -= 2;
  }

  const blurTop = y + 40;
  page.drawRectangle({
    x: x + 12,
    y: blurTop - 2,
    width: width - 24,
    height: Math.max(68, height * 0.34),
    color: blurFill,
    opacity: 0.8,
    borderColor: rgb(0.82, 0.87, 0.94),
    borderWidth: 1,
  });

  page.drawText("Blurred sample", {
    x: x + 24,
    y: blurTop + 42,
    size: 8.2,
    font: fontBold,
    color: muted,
  });

  let blurY = blurTop + 28;
  const hiddenLines = blurredLines.slice(0, 5);
  if (hiddenLines.length === 0) {
    hiddenLines.push("Additional section content is blurred until the document is unlocked.");
  }

  for (const hiddenLine of hiddenLines) {
    const wrapped = wrapLineToWidth(hiddenLine, font, 8.1).slice(0, 2);
    for (const wrappedLine of wrapped) {
      page.drawText(wrappedLine, {
        x: x + 24,
        y: blurY,
        size: 8.1,
        font,
        color: rgb(0.18, 0.22, 0.3),
        opacity: 0.18,
        maxWidth: width - 48,
      });
      blurY -= 9.5;
    }
    blurY -= 3;
  }

  page.drawRectangle({
    x: x + 12,
    y: blurTop - 2,
    width: width - 24,
    height: Math.max(68, height * 0.34),
    color: rgb(1, 1, 1),
    opacity: 0.22,
    borderColor: rgb(0.84, 0.89, 0.95),
    borderWidth: 0,
  });

  page.drawText(`+${Math.max(1, blurredLines.length)} lines blurred`, {
    x: x + width - 170,
    y: blurTop + 8,
    size: 8,
    font: fontBold,
    color: rgb(0.35, 0.41, 0.5),
  });
}

function drawSectionPreviewPage(params: {
  pdfDoc: PDFDocument;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  documentTitle: string;
  sourceFileName: string;
  sections: ReturnType<typeof buildMarketplacePreviewSections>;
}) {
  const { pdfDoc, font, fontBold, documentTitle, sourceFileName, sections } = params;
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = pdfDoc.getPages().length;

  drawPageHeader({
    page,
    font,
    fontBold,
    title: documentTitle,
    sourceFileName,
    pageNumber,
    isFirstPage: false,
  });

  page.drawText("Section-by-section preview", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 106,
    size: 15,
    font: fontBold,
    color: rgb(0.08, 0.14, 0.23),
  });

  page.drawText("Each card opens with a readable piece, then blurs the rest of that section until unlock.", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 124,
    size: 9.5,
    font,
    color: rgb(0.38, 0.42, 0.5),
    maxWidth: PAGE_WIDTH - MARGIN_X * 2,
  });

  const cardWidth = PAGE_WIDTH - MARGIN_X * 2;
  const cardHeight = 240;
  const topCardY = PAGE_HEIGHT - 156 - cardHeight;
  const bottomCardY = topCardY - 18 - cardHeight;

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const slotIndex = index % 2;
    const cardY = slotIndex === 0 ? topCardY : bottomCardY;

    if (slotIndex === 0 && index > 0) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNumber = pdfDoc.getPages().length;
      drawPageHeader({
        page,
        font,
        fontBold,
        title: documentTitle,
        sourceFileName,
        pageNumber,
        isFirstPage: false,
      });
      page.drawText("Section-by-section preview", {
        x: MARGIN_X,
        y: PAGE_HEIGHT - 106,
        size: 15,
        font: fontBold,
        color: rgb(0.08, 0.14, 0.23),
      });
      page.drawText("Each card opens with a readable piece, then blurs the rest of that section until unlock.", {
        x: MARGIN_X,
        y: PAGE_HEIGHT - 124,
        size: 9.5,
        font,
        color: rgb(0.38, 0.42, 0.5),
        maxWidth: PAGE_WIDTH - MARGIN_X * 2,
      });
    }

    drawPreviewSectionCard({
      page,
      font,
      fontBold,
      sectionNumber: index,
      sectionTitle: section.title,
      teaserLines: section.teaserLines,
      blurredLines: section.blurredLines,
      x: MARGIN_X,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
    });
  }
}

async function buildPreviewPdf(params: {
  documentTitle: string;
  sourceFileName: string;
  text: string;
  fallbackNote?: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const normalizedText = normalizePreviewText(params.text);
  const lines = splitPreviewLines(normalizedText);
  const intro = buildPreviewIntro(
    params.documentTitle,
    params.sourceFileName,
    params.fallbackNote
  );

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = 1;
  drawPageHeader({
    page,
    font,
    fontBold,
    title: params.documentTitle,
    sourceFileName: params.sourceFileName,
    pageNumber,
    isFirstPage: true,
  });
  drawSummaryBox({
    page,
    font,
    fontBold,
    lines: intro.concat(lines.slice(0, 3)),
  });

  if (lines.length > 0) {
    const sections = buildMarketplacePreviewSections(lines, {
      teaserLineCount: 2,
      maxSections: 8,
      fallbackGroupSize: 6,
    });

    drawSectionPreviewPage({
      pdfDoc,
      font,
      fontBold,
      documentTitle: params.documentTitle,
      sourceFileName: params.sourceFileName,
      sections,
    });
  } else {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber = pdfDoc.getPages().length;
    drawPageHeader({
      page,
      font,
      fontBold,
      title: params.documentTitle,
      sourceFileName: params.sourceFileName,
      pageNumber,
      isFirstPage: false,
    });

    page.drawRectangle({
      x: MARGIN_X,
      y: PAGE_HEIGHT - 260,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: 140,
      color: rgb(0.97, 0.98, 1),
      borderColor: rgb(0.77, 0.83, 0.92),
      borderWidth: 1,
    });

    page.drawText("No readable preview content could be extracted.", {
      x: MARGIN_X + 16,
      y: PAGE_HEIGHT - 188,
      size: 15,
      font: fontBold,
      color: rgb(0.09, 0.14, 0.22),
    });

    page.drawText(
      params.fallbackNote ??
        "This file may be scanned, image-only, or otherwise difficult to parse. Upload a text-based PDF or DOCX for a richer section preview.",
      {
        x: MARGIN_X + 16,
        y: PAGE_HEIGHT - 208,
        size: 9.5,
        font,
        color: rgb(0.36, 0.41, 0.49),
        maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 32,
      }
    );
  }

  for (const currentPage of pdfDoc.getPages()) {
    drawWatermark(currentPage, fontBold);
  }

  return pdfDoc.save();
}

/**
 * Builds a multi-page buyer preview PDF with a stronger cover and highlighted summary.
 */
export async function generateMarketplacePreviewPdfFromDocument(params: {
  buffer: Buffer;
  sourceFileName: string;
  documentTitle: string;
}): Promise<{ ok: true; pdfBytes: Uint8Array } | { ok: false; error: string }> {
  const extracted = await plainTextFromBuffer(params.buffer, params.sourceFileName);

  if (!extracted.ok) {
    const pdfBytes = await buildPreviewPdf({
      documentTitle: params.documentTitle,
      sourceFileName: params.sourceFileName,
      text: "",
      fallbackNote: extracted.error,
    });
    return { ok: true, pdfBytes };
  }

  if (!extracted.text) {
    const pdfBytes = await buildPreviewPdf({
      documentTitle: params.documentTitle,
      sourceFileName: params.sourceFileName,
      text: "",
      fallbackNote:
        "No extractable text was found in this file. A text-based PDF or DOCX will generate a richer buyer preview.",
    });
    return { ok: true, pdfBytes };
  }

  const pdfBytes = await buildPreviewPdf({
    documentTitle: params.documentTitle,
    sourceFileName: params.sourceFileName,
    text: extracted.text,
  });
  return { ok: true, pdfBytes };
}
