import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  buildMarketplaceNotes,
  getDocumentCreditCost,
  isMarketplaceEnabled,
  marketplacePreviewPathPrefix,
} from "@/lib/marketplace";
import {
  basenameFromStoragePath,
  pickWorkspacePreviewStoragePath,
} from "@/lib/marketplacePreviewExcerpt";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import {
  downloadDocumentsBucketObject,
  uploadDocumentsBucketObject,
} from "@/lib/supabaseStorageServer";
import { serverLog } from "@/lib/serverLog";
import { generateMarketplacePreviewPdfFromDocument } from "@/lib/generateMarketplacePreviewPdf";
import { getClientIpAddress } from "@/lib/legal";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
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
  const limit = checkFixedWindowRateLimit(`admin_generate_marketplace_preview:${user.id}:${ip}`, {
    windowMs: 60_000,
    max: 10,
  });
  if (!limit.ok) {
    const res = NextResponse.json(
      { error: "Too many generate requests. Try again shortly." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  const { data: document, error: getError } = await supabase
    .from("documents")
    .select(
      "id, project_name, document_title, file_name, status, notes, file_path, draft_file_path, final_file_path"
    )
    .eq("id", id)
    .single();

  if (getError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.status?.trim().toLowerCase() === "archived") {
    return NextResponse.json({ error: "Document is archived." }, { status: 404 });
  }

  if (!isMarketplaceEnabled(document.notes)) {
    return NextResponse.json(
      { error: "Marketplace listing is disabled for this document." },
      { status: 400 }
    );
  }

  const storagePath = pickWorkspacePreviewStoragePath(document);

  if (!storagePath) {
    return NextResponse.json(
      { error: "No draft or final file is attached to this document yet." },
      { status: 400 }
    );
  }

  const downloaded = await downloadDocumentsBucketObject(storagePath);
  if (!downloaded.ok) {
    serverLog("warn", "generate_marketplace_preview_download_failed", {
      documentId: id,
      status: downloaded.status,
    });
    return NextResponse.json({ error: downloaded.error }, { status: downloaded.status });
  }

  const sourceName =
    document.file_name?.trim() ||
    basenameFromStoragePath(storagePath) ||
    "document.bin";

  const documentTitle =
    document.document_title?.trim() ||
    document.project_name?.trim() ||
    sourceName.replace(/\.[^.]+$/, "") ||
    "Document";

  let generated;
  try {
    generated = await generateMarketplacePreviewPdfFromDocument({
      buffer: downloaded.buffer,
      sourceFileName: sourceName,
      documentTitle,
    });
  } catch (e) {
    serverLog("error", "generate_marketplace_preview_render_failed", {
      documentId: id,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      {
        error:
          "Preview generation failed for this file. Upload a PDF or DOCX preview manually instead.",
      },
      { status: 422 }
    );
  }

  if (!generated.ok) {
    return NextResponse.json({ error: generated.error }, { status: 422 });
  }

  const safeStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storageKey = `${marketplacePreviewPathPrefix(id)}${safeStamp}_preview.pdf`;

  const upload = await uploadDocumentsBucketObject(
    storageKey,
    generated.pdfBytes,
    "application/pdf",
    { upsert: true }
  );
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error }, { status: upload.status });
  }

  const admin = createSupabaseAdminClient() ?? supabase;
  const notes = buildMarketplaceNotes(document.notes, {
    enabled: true,
    creditCost: getDocumentCreditCost(document.notes),
    previewFilePath: storageKey,
    submitterPreviewStatus: "pending",
  });

  const marketplaceUpdatedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from("documents")
    .update({
      notes,
      marketplace_updated_at: marketplaceUpdatedAt,
      marketplace_updated_by: user.id,
      marketplace_updated_by_email: user.email ?? null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    notes,
    previewFilePath: storageKey,
    submitterPreviewStatus: "pending" as const,
    marketplaceUpdatedAt,
    marketplaceUpdatedByEmail: user.email ?? null,
  });
}
