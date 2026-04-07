import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { sniffGcDocumentKind } from "@/lib/gcProgramAiReview";

const MAX_BODY_CHARS = 40_000;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const MAX_LINE_WIDTH = PAGE_WIDTH - MARGIN * 2;

function normalizeWhitespace(raw: string) {
  return raw.replace(/\0/g, "").replace(/\s+/g, " ").trim();
}

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
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        const text = normalizeWhitespace(result.text ?? "");
        return { ok: true, text: text.slice(0, MAX_BODY_CHARS) };
      } finally {
        await parser.destroy();
      }
    }
    if (kind === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      const text = normalizeWhitespace(result.value ?? "");
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
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > MAX_LINE_WIDTH && current) {
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

type DrawChunk = { text: string; size: number; bold: boolean };

/**
 * Builds a multi-page PDF with extracted text + watermark for marketplace buyer preview.
 */
export async function generateMarketplacePreviewPdfFromDocument(params: {
  buffer: Buffer;
  sourceFileName: string;
  documentTitle: string;
}): Promise<{ ok: true; pdfBytes: Uint8Array } | { ok: false; error: string }> {
  const extracted = await plainTextFromBuffer(params.buffer, params.sourceFileName);
  if (!extracted.ok) {
    return extracted;
  }

  if (!extracted.text) {
    return {
      ok: false,
      error:
        "No extractable text was found (for example, a scanned PDF). Upload a text-based PDF or DOCX preview manually instead.",
    };
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const chunks: DrawChunk[] = [
    {
      text: "MARKETPLACE PREVIEW — NOT THE FULL DOCUMENT",
      size: 12,
      bold: true,
    },
    {
      text: `Document: ${params.documentTitle}`.slice(0, 200),
      size: 10,
      bold: true,
    },
    {
      text: "The document owner must approve this preview before buyers can see it in the library.",
      size: 9,
      bold: false,
    },
    { text: "", size: FONT_SIZE, bold: false },
  ];

  for (const paragraph of extracted.text.split(/\n+/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      chunks.push({ text: "", size: FONT_SIZE, bold: false });
      continue;
    }
    for (const line of wrapLineToWidth(trimmed, font, FONT_SIZE)) {
      chunks.push({ text: line, size: FONT_SIZE, bold: false });
    }
  }

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  const linesPerPage = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT);
  let linesOnPage = 0;

  for (const chunk of chunks) {
    if (linesOnPage >= linesPerPage) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      linesOnPage = 0;
    }
    const useFont = chunk.bold ? fontBold : font;
    if (chunk.text) {
      page.drawText(chunk.text.slice(0, 900), {
        x: MARGIN,
        y,
        size: chunk.size,
        font: useFont,
        color: rgb(0.1, 0.1, 0.14),
        maxWidth: MAX_LINE_WIDTH,
      });
    }
    y -= chunk.size >= 12 ? LINE_HEIGHT + 2 : LINE_HEIGHT;
    linesOnPage += 1;
  }

  for (const p of pdfDoc.getPages()) {
    p.drawText("PREVIEW ONLY", {
      x: PAGE_WIDTH / 2 - 130,
      y: PAGE_HEIGHT / 2,
      size: 34,
      font: fontBold,
      color: rgb(0.82, 0.82, 0.86),
      rotate: degrees(32),
      opacity: 0.11,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return { ok: true, pdfBytes };
}
