import { NextResponse } from "next/server";
import { getClientIpAddress } from "@/lib/legal";
import { logDocumentDownload } from "@/lib/downloadAudit";
import {
  asciiFallbackFileName,
  contentTypeForPreviewFileName,
  isLikelyPdfBuffer,
  prepareMarketplaceLibraryPreview,
} from "@/lib/libraryMarketplacePreviewServer";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

/**
 * Serves the marketplace preview bytes with Content-Type and Content-Disposition: inline
 * so browsers can render PDFs in a frame. Auth matches the JSON excerpt route.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let prepared: Awaited<ReturnType<typeof prepareMarketplaceLibraryPreview>>;
  try {
    prepared = await prepareMarketplaceLibraryPreview(request, id);
  } catch (e) {
    serverLog("error", "library_preview_file_prepare_failed", {
      documentId: id,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Preview temporarily unavailable. Please try again." },
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  if (!prepared.ok) {
    return prepared.response;
  }

  const { buffer, sourceFileName, document, excerptSource, supabase, user } = prepared;
  /** Inline PDF viewers often require `application/pdf`; keys without `.pdf` used to fall through to octet-stream. */
  const contentType = isLikelyPdfBuffer(buffer, sourceFileName)
    ? "application/pdf"
    : contentTypeForPreviewFileName(sourceFileName);
  const asciiName = asciiFallbackFileName(sourceFileName);
  const utf8Star = encodeURIComponent(sourceFileName);

  try {
    await logDocumentDownload({
      supabase,
      documentId: document.id,
      actorUserId: user.id,
      ownerUserId: document.user_id ?? null,
      fileKind: "preview",
      ipAddress: getClientIpAddress(request),
      metadata: {
        route: "library_preview_file",
        excerpt_source: excerptSource,
        content_type: contentType,
        project_name: document.project_name ?? null,
      },
    });
  } catch (e) {
    serverLog("warn", "library_preview_file_audit_log_failed", {
      documentId: document.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const disposition = `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Star}`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
