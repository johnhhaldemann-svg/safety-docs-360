import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import {
  getMarketplacePreviewPath,
  isMarketplaceEnabled,
  isValidMarketplacePreviewPath,
} from "@/lib/marketplace";
import { extractMarketplacePreviewExcerpt } from "@/lib/marketplacePreviewExcerpt";
import {
  getClientIpAddress,
  getDefaultAgreementConfig,
  getUserAgreementRecord,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { logDocumentDownload } from "@/lib/downloadAudit";

export const runtime = "nodejs";

function fileNameFromPreviewPath(previewPath: string, projectName: string | null) {
  const parts = previewPath.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last) {
    return last;
  }
  return `${projectName || "marketplace_preview"}.pdf`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;
  const { id } = await context.params;

  const [agreementResult, agreementConfig] = await Promise.all([
    getUserAgreementRecord(supabase, user.id, user.user_metadata ?? undefined),
    getAgreementConfig(supabase).catch(() => getDefaultAgreementConfig()),
  ]);

  if (
    !agreementResult.data?.accepted_terms ||
    agreementResult.data?.terms_version !== agreementConfig.version
  ) {
    return NextResponse.json(
      {
        error: "Acceptance of the current agreement is required before previewing documents.",
        termsVersion: agreementConfig.version,
      },
      { status: 403 }
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, user_id, project_name, status, notes")
    .eq("id", id)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.status?.trim().toLowerCase() === "archived") {
    return NextResponse.json(
      { error: "This document is no longer available." },
      { status: 404 }
    );
  }

  if (!isApprovedDocumentStatus(document.status, true)) {
    return NextResponse.json(
      { error: "Preview is not available for this document." },
      { status: 403 }
    );
  }

  if (!isMarketplaceEnabled(document.notes)) {
    return NextResponse.json(
      { error: "This document is not listed in the marketplace." },
      { status: 403 }
    );
  }

  const previewPath = getMarketplacePreviewPath(document.notes);
  if (!previewPath || !isValidMarketplacePreviewPath(id, previewPath)) {
    return NextResponse.json(
      { error: "No preview is available for this document." },
      { status: 404 }
    );
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("documents")
    .download(previewPath);

  if (downloadError || !blob) {
    return NextResponse.json(
      { error: downloadError?.message || "Failed to load preview file." },
      { status: 500 }
    );
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sourceName = fileNameFromPreviewPath(
    previewPath,
    document.project_name ?? null
  );

  const extracted = await extractMarketplacePreviewExcerpt(buffer, sourceName);

  if (!extracted.ok) {
    return NextResponse.json(
      { error: extracted.error },
      { status: 422 }
    );
  }

  const empty = extracted.excerpt.length === 0;

  await logDocumentDownload({
    supabase,
    documentId: document.id,
    actorUserId: user.id,
    ownerUserId: document.user_id ?? null,
    fileKind: "preview",
    ipAddress: getClientIpAddress(request),
    metadata: {
      route: "library_preview_excerpt",
      project_name: document.project_name ?? null,
      truncated: extracted.truncated,
      empty_excerpt: empty,
    },
  });

  const title =
    document.project_name?.trim() ||
    sourceName.replace(/\.[^.]+$/, "") ||
    "Marketplace preview";

  const res = NextResponse.json({
    title,
    excerpt: extracted.excerpt,
    truncated: extracted.truncated,
    empty,
  });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
