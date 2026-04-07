import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeRequest } from "@/lib/rbac";
import { getClientIpAddress } from "@/lib/legal";
import { logDocumentDownload } from "@/lib/downloadAudit";
import { downloadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import { basenameFromStoragePath } from "@/lib/marketplacePreviewExcerpt";
import { checkFixedWindowRateLimit, contentTypeFromFilenameHint } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Streams the company upload at `file_path` (admin-only, service-role storage read).
 * Used for GC program review after excerpt preview.
 */
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
  const limit = checkFixedWindowRateLimit(`admin_download_upload:${user.id}:${ip}`, {
    windowMs: 60_000,
    max: 40,
  });
  if (!limit.ok) {
    const res = NextResponse.json(
      { error: "Too many download requests. Try again shortly." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  const adminClient = createSupabaseAdminClient();
  const docClient = adminClient ?? supabase;

  const { data: doc, error: docError } = await docClient
    .from("documents")
    .select("id, project_name, user_id, status, file_path")
    .eq("id", id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document record not found." }, { status: 404 });
  }

  if (!doc.file_path?.trim()) {
    return NextResponse.json(
      { error: "No company upload path for this document." },
      { status: 404 }
    );
  }

  if (doc.status?.trim().toLowerCase() === "archived") {
    return NextResponse.json(
      { error: "This document is archived and cannot be downloaded." },
      { status: 404 }
    );
  }

  const downloaded = await downloadDocumentsBucketObject(doc.file_path);
  if (!downloaded.ok) {
    return NextResponse.json({ error: downloaded.error }, { status: downloaded.status });
  }

  await logDocumentDownload({
    supabase,
    documentId: doc.id,
    actorUserId: user.id,
    ownerUserId: doc.user_id ?? null,
    fileKind: "draft",
    ipAddress: getClientIpAddress(request),
    metadata: {
      route: "admin_download_company_upload",
      project_name: doc.project_name ?? null,
    },
  });

  const base = basenameFromStoragePath(doc.file_path) || "upload";
  const safeName = `${doc.project_name || "upload"}_${base}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  const contentType = contentTypeFromFilenameHint(base);

  return new NextResponse(new Uint8Array(downloaded.buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
    },
  });
}
