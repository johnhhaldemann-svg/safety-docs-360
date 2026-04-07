import { NextResponse } from "next/server";
import { getClientIpAddress } from "@/lib/legal";
import { logDocumentDownload } from "@/lib/downloadAudit";
import { prepareMarketplaceLibraryPreview } from "@/lib/libraryMarketplacePreviewServer";

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
  const prepared = await prepareMarketplaceLibraryPreview(request, id);

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
