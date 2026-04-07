import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import {
  getMarketplacePreviewPath,
  isValidMarketplacePreviewPath,
} from "@/lib/marketplace";
import {
  asciiFallbackFileName,
  contentTypeForPreviewFileName,
} from "@/lib/libraryMarketplacePreviewServer";
import { downloadDocumentsBucketObject } from "@/lib/supabaseStorageServer";

export const runtime = "nodejs";

/**
 * Lets the document owner (or platform admin) open the marketplace preview bytes inline
 * while buyer library preview may still be gated on owner approval.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;

  const { data: document, error: docError } = await auth.supabase
    .from("documents")
    .select("id, user_id, notes, project_name")
    .eq("id", id)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const ownerId = typeof document.user_id === "string" ? document.user_id : null;
  const isOwner = ownerId !== null && ownerId === auth.user.id;
  if (!isOwner && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const previewPath = getMarketplacePreviewPath(document.notes)?.trim() ?? "";
  if (!previewPath || !isValidMarketplacePreviewPath(id, previewPath)) {
    return NextResponse.json({ error: "No marketplace preview file is on record." }, { status: 404 });
  }

  const downloaded = await downloadDocumentsBucketObject(previewPath);
  if (!downloaded.ok) {
    return NextResponse.json({ error: downloaded.error }, { status: downloaded.status });
  }

  const sourceFileName = previewPath.split("/").filter(Boolean).pop() || "preview.pdf";
  const contentType = contentTypeForPreviewFileName(sourceFileName);
  const asciiName = asciiFallbackFileName(sourceFileName);
  const utf8Star = encodeURIComponent(sourceFileName);
  const disposition = `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Star}`;

  return new NextResponse(new Uint8Array(downloaded.buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
