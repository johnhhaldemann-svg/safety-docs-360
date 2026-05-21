import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeRequest } from "@/lib/rbac";
import { getClientIpAddress } from "@/lib/legal";
import { logDocumentDownload } from "@/lib/downloadAudit";
import { serverLog } from "@/lib/serverLog";
import { downloadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import {
  basenameFromStoragePath,
  extractMarketplacePreviewExcerpt,
  pickWorkspacePreviewStoragePath,
} from "@/lib/marketplacePreviewExcerpt";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

async function getPdfPageCount(buffer: Buffer) {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    return pdfDoc.getPageCount();
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;
  const { id } = await context.params;

  const ip = getClientIpAddress(request) ?? "unknown";
  const limit = checkFixedWindowRateLimit(`admin_preview_excerpt:${user.id}:${ip}`, {
    windowMs: 60_000,
    max: 60,
  });
  if (!limit.ok) {
    const res = NextResponse.json(
      { error: "Too many preview requests. Try again shortly." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const docClient = adminClient ?? supabase;

    const { data: document, error: documentError } = await docClient
      .from("documents")
      .select(
        "id, user_id, project_name, document_title, file_name, status, file_path, draft_file_path, final_file_path"
      )
      .eq("id", id)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (document.status?.trim().toLowerCase() === "archived") {
      return NextResponse.json(
        { error: "This document is archived and cannot be previewed." },
        { status: 404 }
      );
    }

    const storagePath = pickWorkspacePreviewStoragePath(document);

    if (!storagePath) {
      return NextResponse.json(
        { error: "No file is attached to this document yet." },
        { status: 404 }
      );
    }

    const downloaded = await downloadDocumentsBucketObject(storagePath);
    if (!downloaded.ok) {
      serverLog("warn", "admin_preview_excerpt_storage_download_failed", {
        documentId: document.id,
        status: downloaded.status,
      });
      return NextResponse.json({ error: downloaded.error }, { status: downloaded.status });
    }

    const buffer = downloaded.buffer;
    const sourceName =
      document.file_name?.trim() ||
      basenameFromStoragePath(storagePath) ||
      "document.bin";
    const pageCount =
      sourceName.toLowerCase().endsWith(".pdf") || storagePath.toLowerCase().endsWith(".pdf")
        ? await getPdfPageCount(buffer)
        : null;

    const extracted = await extractMarketplacePreviewExcerpt(buffer, sourceName);

    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: 422 });
    }

    const empty = extracted.excerpt.length === 0;

    try {
      await logDocumentDownload({
        supabase,
        documentId: document.id,
        actorUserId: user.id,
        ownerUserId: document.user_id ?? null,
        fileKind: "draft",
        ipAddress: getClientIpAddress(request),
        metadata: {
          route: "admin_preview_excerpt",
          truncated: extracted.truncated,
          empty_excerpt: empty,
        },
      });
    } catch (e) {
      serverLog("warn", "admin_preview_excerpt_audit_log_failed", {
        documentId: document.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    const title =
      document.document_title?.trim() ||
      document.project_name?.trim() ||
      sourceName.replace(/\.[^.]+$/, "") ||
      "Document preview";

    const res = NextResponse.json({
      title,
      excerpt: extracted.excerpt,
      truncated: extracted.truncated,
      empty,
      pageCount,
    });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (e) {
    serverLog("error", "admin_preview_excerpt_failed", {
      documentId: id,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Preview temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
