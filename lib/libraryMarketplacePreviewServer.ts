import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { authorizeRequest } from "@/lib/rbac";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import {
  getMarketplacePreviewPath,
  getSubmitterPreviewStatus,
  isBuyerMarketplacePreviewBlocked,
  isMarketplaceEnabled,
  isValidMarketplacePreviewPath,
} from "@/lib/marketplace";
import { extractMarketplacePreviewExcerpt } from "@/lib/marketplacePreviewExcerpt";
import {
  getDefaultAgreementConfig,
  getUserAgreementRecord,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { serverLog } from "@/lib/serverLog";
import { normalizeDocumentsBucketObjectPath } from "@/lib/documentsBucketPath";
import { downloadDocumentsBucketObject } from "@/lib/supabaseStorageServer";

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
  let stage = "authorize";
  let auth:
    | Awaited<ReturnType<typeof authorizeRequest>>
    | { error: NextResponse };
  try {
    auth = await authorizeRequest(request);
  } catch (e) {
    serverLog("error", "library_preview_authorize_failed", {
      documentId,
      stage,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Preview temporarily unavailable while loading authorize. Please try again.",
          stage,
        },
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      ),
    };
  }

  if ("error" in auth) {
    return { ok: false, response: auth.error as NextResponse };
  }

  const { supabase, user } = auth;
  const supabaseClient = supabase as SupabaseClient;

  try {
    return await runPrepareMarketplaceLibraryPreview(
      documentId,
      (nextStage: string) => {
        stage = nextStage;
      },
      supabaseClient,
      user
    );
  } catch (e) {
    serverLog("error", "library_preview_prepare_unhandled", {
      documentId,
      stage,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Preview temporarily unavailable while loading ${stage}. Please try again.`,
          stage,
        },
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      ),
    };
  }
}

async function runPrepareMarketplaceLibraryPreview(
  documentId: string,
  setStage: (stage: string) => void,
  supabaseClient: SupabaseClient,
  user: User
): Promise<MarketplaceLibraryPreviewResult> {
  setStage("agreement");
  let agreementResult: Awaited<ReturnType<typeof getUserAgreementRecord>>;
  let agreementConfig: Awaited<ReturnType<typeof getAgreementConfig>>;
  try {
    [agreementResult, agreementConfig] = await Promise.all([
      getUserAgreementRecord(
        supabaseClient,
        user.id,
        user.user_metadata ?? undefined
      ).catch((e) => {
        serverLog("warn", "library_preview_user_agreement_failed", {
          message: e instanceof Error ? e.message : String(e),
        });
        return { data: null, error: null };
      }),
      getAgreementConfig(supabaseClient).catch(() => getDefaultAgreementConfig()),
    ]);
  } catch (e) {
    serverLog("warn", "library_preview_agreement_bundle_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    agreementResult = { data: null, error: null };
    agreementConfig = getDefaultAgreementConfig();
  }

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

  setStage("document");
  /** Prefer service-role read so marketplace rows are visible like the library catalog (avoids RLS edge cases with mixed policies). */
  const docClient = createSupabaseAdminClient() ?? supabaseClient;
  const { data: document, error: documentError } = await docClient
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

  setStage("status");
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

  /** Match library catalog rules: `true` was a bug — it treated every non-archived row as approved. */
  if (!isApprovedDocumentStatus(doc.status, Boolean(doc.final_file_path))) {
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

  if (isBuyerMarketplacePreviewBlocked(doc.notes)) {
    const status = getSubmitterPreviewStatus(doc.notes);
    const error =
      status === "rejected"
        ? "The document owner rejected this marketplace preview. An updated preview must be published before buyers can see it."
        : "This preview is waiting for the document owner to approve it before buyers can see it in the library.";
    return {
      ok: false,
      response: NextResponse.json(
        { error, submitterPreviewStatus: status ?? "pending" },
        { status: 403 }
      ),
    };
  }

  setStage("storage-path");
  const previewPathRaw = getMarketplacePreviewPath(doc.notes)?.trim() ?? "";
  const customPreviewOk =
    previewPathRaw.length > 0 &&
    isValidMarketplacePreviewPath(doc.id, previewPathRaw);
  const normalizedCustomKey = customPreviewOk
    ? normalizeDocumentsBucketObjectPath(previewPathRaw)
    : "";
  const finalPath =
    typeof doc.final_file_path === "string" ? doc.final_file_path.trim() : "";

  let storagePath: string | null =
    customPreviewOk && normalizedCustomKey ? normalizedCustomKey : finalPath || null;

  if (!storagePath) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No preview is available for this document." },
        { status: 404 }
      ),
    };
  }

  setStage("download");
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

  setStage("parse");
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
