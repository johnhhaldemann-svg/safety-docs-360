import { NextResponse } from "next/server";
import { getClientIpAddress } from "@/lib/legal";
import { logDocumentDownload } from "@/lib/downloadAudit";
import { prepareMarketplaceLibraryPreview } from "@/lib/libraryMarketplacePreviewServer";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let prepared: Awaited<ReturnType<typeof prepareMarketplaceLibraryPreview>>;
  try {
    prepared = await prepareMarketplaceLibraryPreview(request, id);
  } catch (e) {
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Preview temporarily unavailable. Please try again.";
    serverLog("error", "library_preview_prepare_failed", {
      documentId: id,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: message },
      { status: 500, headers: JSON_HEADERS }
    );
  }

  if (!prepared.ok) {
    return prepared.response;
  }

  const {
    document,
    textPreview,
    isPdfInline,
    excerptSource,
    sourceFileName,
    supabase,
    user,
  } = prepared;

  const title =
    document.project_name?.trim() ||
    sourceFileName.replace(/\.[^.]+$/, "") ||
    "Marketplace preview";

  if (isPdfInline) {
    return NextResponse.json(
      {
        title,
        viewer: "pdf" as const,
        showPdfInline: true,
        excerpt: "",
        empty: false,
        truncated: false,
      },
      { status: 200, headers: JSON_HEADERS }
    );
  }

  const preview = textPreview!;

  try {
    await logDocumentDownload({
      supabase,
      documentId: document.id,
      actorUserId: user.id,
      ownerUserId: document.user_id ?? null,
      fileKind: "preview",
      ipAddress: getClientIpAddress(request),
      metadata: {
        route: "library_preview_excerpt",
        excerpt_source: excerptSource,
        project_name: document.project_name ?? null,
        truncated: preview.truncated,
        empty_excerpt: preview.empty,
      },
    });
  } catch (e) {
    serverLog("warn", "library_preview_audit_log_failed", {
      documentId: document.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return NextResponse.json(
    {
      title,
      viewer: "excerpt" as const,
      showPdfInline: false,
      excerpt: preview.excerpt,
      truncated: preview.truncated,
      empty: preview.empty,
    },
    { status: 200, headers: JSON_HEADERS }
  );
}
