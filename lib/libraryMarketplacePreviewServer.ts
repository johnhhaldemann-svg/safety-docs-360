import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { authorizeRequest } from "@/lib/rbac";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import {
  getMarketplacePreviewPath,
  isMarketplaceEnabled,
  isValidMarketplacePreviewPath,
} from "@/lib/marketplace";
import { extractMarketplacePreviewExcerpt } from "@/lib/marketplacePreviewExcerpt";
import {
  getDefaultAgreementConfig,
  getUserAgreementRecord,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import {
  downloadDocumentsBucketObject,
  normalizeDocumentsBucketObjectPath,
} from "@/lib/supabaseStorageServer";

export type MarketplacePreviewDocument = {
  id: string;
  user_id: string | null;
  project_name: string | null;
  status?: string | null;
  notes: string | null;
  final_file_path?: string | null;
};

function fileNameFromPreviewPath(previewPath: string, projectName: string | null) {
  const parts = previewPath.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last) {
    return last;
  }
  return `${projectName || "marketplace_preview"}.pdf`;
}

export function isLikelyPdfBuffer(buffer: Buffer, fileName: string) {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".pdf")) {
    return true;
  }
  if (buffer.length >= 4) {
    const sig = buffer.subarray(0, 4).toString("latin1");
    if (sig === "%PDF") {
      return true;
    }
  }
  return false;
}

export function contentTypeForPreviewFileName(fileName: string) {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

/** ASCII-only fallback for Content-Disposition filename= */
export function asciiFallbackFileName(fileName: string) {
  const base = fileName.trim() || "document";
  const ascii = base.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  return ascii.slice(0, 120) || "document.bin";
}

/**
 * Auth, agreement, storage download (with final-file fallback), optional text extract for non-PDF.
 */
export type MarketplaceLibraryPreviewOk = {
  ok: true;
  supabase: SupabaseClient;
  user: User;
  document: MarketplacePreviewDocument;
  buffer: Buffer;
  sourceFileName: string;
  excerptSource: "marketplace_preview" | "final_file";
  isPdfInline: boolean;
  textPreview: { excerpt: string; truncated: boolean; empty: boolean } | null;
};

export type MarketplaceLibraryPreviewResult =
  | MarketplaceLibraryPreviewOk
  | { ok: false; response: NextResponse };

export async function prepareMarketplaceLibraryPreview(
  request: Request,
  documentId: string
): Promise<MarketplaceLibraryPreviewResult> {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return { ok: false, response: auth.error as NextResponse };
  }

  const { supabase, user } = auth;
  const supabaseClient = supabase as SupabaseClient;

  const [agreementResult, agreementConfig] = await Promise.all([
    getUserAgreementRecord(supabaseClient, user.id, user.user_metadata ?? undefined),
    getAgreementConfig(supabaseClient).catch(() => getDefaultAgreementConfig()),
  ]);

  if (
    !agreementResult.data?.accepted_terms ||
    agreementResult.data?.terms_version !== agreementConfig.version
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Acceptance of the current agreement is required before previewing documents.",
          termsVersion: agreementConfig.version,
        },
        { status: 403 }
      ),
    };
  }

  const { data: document, error: documentError } = await supabaseClient
    .from("documents")
    .select("id, user_id, project_name, status, notes, final_file_path")
    .eq("id", documentId)
    .single();

  if (documentError || !document) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Document not found." }, { status: 404 }),
    };
  }

  const doc = document as MarketplacePreviewDocument;

  if (doc.status?.trim().toLowerCase() === "archived") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This document is no longer available." },
        { status: 404 }
      ),
    };
  }

  if (!isApprovedDocumentStatus(doc.status, true)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Preview is not available for this document." },
        { status: 403 }
      ),
    };
  }

  if (!isMarketplaceEnabled(doc.notes)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This document is not listed in the marketplace." },
        { status: 403 }
      ),
    };
  }

  const previewPathRaw = getMarketplacePreviewPath(doc.notes)?.trim() ?? "";
  const customPreviewOk =
    previewPathRaw.length > 0 && isValidMarketplacePreviewPath(documentId, previewPathRaw);
  const finalPath =
    typeof doc.final_file_path === "string" ? doc.final_file_path.trim() : "";

  let storagePath: string | null = customPreviewOk ? previewPathRaw : finalPath || null;

  if (!storagePath) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No preview is available for this document." },
        { status: 404 }
      ),
    };
  }

  let excerptSource: "marketplace_preview" | "final_file" = customPreviewOk
    ? "marketplace_preview"
    : "final_file";

  const canFallbackToFinal =
    Boolean(finalPath) &&
    normalizeDocumentsBucketObjectPath(finalPath) !==
      normalizeDocumentsBucketObjectPath(storagePath);

  let downloaded = await downloadDocumentsBucketObject(storagePath);

  if (!downloaded.ok && canFallbackToFinal) {
    const fromFinal = await downloadDocumentsBucketObject(finalPath);
    if (fromFinal.ok) {
      downloaded = fromFinal;
      storagePath = finalPath;
      excerptSource = "final_file";
    }
  }

  if (!downloaded.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: downloaded.error },
        { status: downloaded.status }
      ),
    };
  }

  let buffer = downloaded.buffer;
  let sourceFileName = fileNameFromPreviewPath(storagePath, doc.project_name ?? null);

  if (isLikelyPdfBuffer(buffer, sourceFileName)) {
    return {
      ok: true,
      supabase: supabaseClient,
      user,
      document: doc,
      buffer,
      sourceFileName,
      excerptSource,
      isPdfInline: true,
      textPreview: null,
    };
  }

  let extracted = await extractMarketplacePreviewExcerpt(buffer, sourceFileName);

  if (!extracted.ok && canFallbackToFinal && excerptSource === "marketplace_preview") {
    const fromFinal = await downloadDocumentsBucketObject(finalPath);
    if (fromFinal.ok) {
      buffer = fromFinal.buffer;
      storagePath = finalPath;
      excerptSource = "final_file";
      sourceFileName = fileNameFromPreviewPath(finalPath, doc.project_name ?? null);
      extracted = await extractMarketplacePreviewExcerpt(buffer, sourceFileName);
    }
  }

  if (!extracted.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: extracted.error }, { status: 422 }),
    };
  }

  const empty = extracted.excerpt.length === 0;

  return {
    ok: true,
    supabase: supabaseClient,
    user,
    document: doc,
    buffer,
    sourceFileName,
    excerptSource,
    isPdfInline: false,
    textPreview: {
      excerpt: extracted.excerpt,
      truncated: extracted.truncated,
      empty,
    },
  };
}
