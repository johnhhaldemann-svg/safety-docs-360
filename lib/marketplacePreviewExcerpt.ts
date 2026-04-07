import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import { sniffGcDocumentKind } from "@/lib/gcProgramAiReview";

/** Short on-screen preview only; full file is never sent to the client. */
export const MARKETPLACE_PREVIEW_MAX_CHARS = 2000;

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
 * Chooses which storage key to download for library preview. In-review CSEP drafts live in
 * `draft_file_path`; `file_path` may point at another upload (e.g. GC program) — prefer draft
 * until the document is approved, then prefer `final_file_path`.
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
  const approved = isApprovedDocumentStatus(doc.status, Boolean(final));

  if (approved) {
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
