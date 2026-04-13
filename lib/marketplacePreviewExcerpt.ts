import { sniffGcDocumentKind } from "@/lib/gcProgramAiReview";
import {
  getMarketplacePreviewPath,
  isBuyerMarketplacePreviewBlocked,
  isMarketplaceEnabled,
} from "@/lib/marketplace";
import { ensurePdfParseWorkerHandler } from "@/lib/pdfParseWorker";

/** Short on-screen preview only; full file is never sent to the client. */
export const MARKETPLACE_PREVIEW_MAX_CHARS = 3500;

export function isPreviewableMarketplaceSource(source?: string | null) {
  const lower = source?.trim().toLowerCase();
  if (!lower) return false;
  return lower.endsWith(".pdf") || lower.endsWith(".docx");
}

/**
 * True if any stored path/filename on the row looks like PDF/DOCX. Prefer this over
 * checking a single field: `file_name` is sometimes a human title without an extension
 * while `file_path` / draft / final still ends with .pdf or .docx.
 */
export function isAnyPreviewableDocumentPath(doc: {
  file_name?: string | null;
  file_path?: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
}): boolean {
  return [
    doc.file_name,
    doc.file_path,
    doc.draft_file_path,
    doc.final_file_path,
  ].some((value) => isPreviewableMarketplaceSource(value));
}

/** Last path segment for display / hints (no leading/trailing slashes). */
export function basenameFromStoragePath(path?: string | null) {
  const t = path?.trim();
  if (!t) return "";
  const parts = t.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** True when the library can request an excerpt (custom preview file or approved final PDF/DOCX). */
export function canRequestMarketplaceLibraryPreview(doc: {
  notes?: string | null;
  final_file_path?: string | null;
}) {
  if (!isMarketplaceEnabled(doc.notes)) {
    return false;
  }
  if (isBuyerMarketplacePreviewBlocked(doc.notes)) {
    return false;
  }
  if (isPreviewableMarketplaceSource(getMarketplacePreviewPath(doc.notes))) {
    return true;
  }
  const final = doc.final_file_path?.trim();
  if (!final) {
    return false;
  }
  if (isPreviewableMarketplaceSource(final)) {
    return true;
  }
  const base = basenameFromStoragePath(final);
  return Boolean(base) && !base.includes(".");
}

/**
 * True when the row has a non-empty storage path after trim. Use this to enable
 * workspace excerpt preview: the API downloads the object and detects PDF/DOCX from
 * file bytes when the key has no `.pdf`/`.docx` suffix (common for CSEP / generated keys).
 */
export function hasWorkspaceDocumentStoragePath(doc: {
  file_path?: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
}): boolean {
  return Boolean(
    doc.file_path?.trim() ||
      doc.draft_file_path?.trim() ||
      doc.final_file_path?.trim()
  );
}

/**
 * Chooses which storage key to download for admin/library workspace preview.
 * In-review work usually lives in `draft_file_path`. Do **not** use `isApprovedDocumentStatus(…, hasFinal)` here:
 * that helper treats “has final_file_path” like approved even when status is still `submitted`, which
 * would pick a stale/placeholder final and break excerpt preview. Only **`status === approved`**
 * prefers `final_file_path` first.
 */
export function pickWorkspacePreviewStoragePath(doc: {
  status?: string | null;
  file_path?: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
}): string | null {
  const final = doc.final_file_path?.trim() || "";
  const draft = doc.draft_file_path?.trim() || "";
  const filePath = doc.file_path?.trim() || "";
  const explicitlyApproved = doc.status?.trim().toLowerCase() === "approved";

  if (explicitlyApproved) {
    return final || filePath || draft || null;
  }
  return draft || filePath || final || null;
}

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

type PdfParserInstance = {
  getText: () => PromiseLike<{ text?: string | null }>;
  destroy?: () => PromiseLike<void> | void;
};

async function excerptFromPdf(buffer: Buffer): Promise<{ excerpt: string; truncated: boolean }> {
  let parser: PdfParserInstance | null = null;
  try {
    await ensurePdfParseWorkerHandler();
    const pdfParseModule = await import("pdf-parse");
    const PdfParseCtor =
      (pdfParseModule as { PDFParse?: new (options: { data: Buffer }) => PdfParserInstance }).PDFParse ??
      (pdfParseModule as { default?: new (options: { data: Buffer }) => PdfParserInstance }).default ??
      null;

    if (!PdfParseCtor) {
      throw new Error("PDF preview parser is unavailable.");
    }

    parser = new PdfParseCtor({ data: buffer });
    const result = await parser.getText();
    const raw = result.text?.trim() ?? "";
    return clipExcerpt(raw);
  } finally {
    if (parser) {
      try {
        await parser.destroy?.();
      } catch {
        /* ignore cleanup failures */
      }
    }
  }
}

async function excerptFromDocx(buffer: Buffer): Promise<{ excerpt: string; truncated: boolean }> {
  const mammoth = await import("mammoth");
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

  try {
    let kind: "pdf" | "docx" | null = null;
    if (lower.endsWith(".pdf")) kind = "pdf";
    else if (lower.endsWith(".docx")) kind = "docx";
    else kind = sniffGcDocumentKind(buffer);

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
