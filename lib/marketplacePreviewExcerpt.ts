import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { sniffGcDocumentKind } from "@/lib/gcProgramAiReview";

/** Short on-screen preview only; full file is never sent to the client. */
export const MARKETPLACE_PREVIEW_MAX_CHARS = 2000;

function clipExcerpt(raw: string): { excerpt: string; truncated: boolean } {
  const normalized = raw.replace(/\0/g, "").replace(/\s+/g, " ").trim();
  if (normalized.length <= MARKETPLACE_PREVIEW_MAX_CHARS) {
    return { excerpt: normalized, truncated: false };
  }
  return {
    excerpt: `${normalized.slice(0, MARKETPLACE_PREVIEW_MAX_CHARS)}…`,
    truncated: true,
  };
}

async function excerptFromPdf(buffer: Buffer): Promise<{ excerpt: string; truncated: boolean }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const raw = result.text?.trim() ?? "";
    return clipExcerpt(raw);
  } finally {
    await parser.destroy();
  }
}

async function excerptFromDocx(buffer: Buffer): Promise<{ excerpt: string; truncated: boolean }> {
  const result = await mammoth.extractRawText({ buffer });
  const raw = (result.value ?? "").trim();
  return clipExcerpt(raw);
}

/**
 * Extract a short plaintext excerpt from a marketplace preview upload (PDF or DOCX).
 * Scanned PDFs with no text layer return an empty excerpt (caller should show a message).
 */
export async function extractMarketplacePreviewExcerpt(
  buffer: Buffer,
  fileName: string
): Promise<
  | { ok: true; excerpt: string; truncated: boolean }
  | { ok: false; error: string }
> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".doc")) {
    return {
      ok: false,
      error: "Legacy .doc is not supported for preview. Use PDF or DOCX.",
    };
  }

  let kind: "pdf" | "docx" | null = null;
  if (lower.endsWith(".pdf")) kind = "pdf";
  else if (lower.endsWith(".docx")) kind = "docx";
  else kind = sniffGcDocumentKind(buffer);

  try {
    if (kind === "pdf") {
      const { excerpt, truncated } = await excerptFromPdf(buffer);
      return { ok: true, excerpt, truncated };
    }
    if (kind === "docx") {
      const { excerpt, truncated } = await excerptFromDocx(buffer);
      return { ok: true, excerpt, truncated };
    }
    return {
      ok: false,
      error: "Preview file must be PDF or DOCX.",
    };
  } catch {
    return {
      ok: false,
      error: "Could not read this file for preview.",
    };
  }
}
