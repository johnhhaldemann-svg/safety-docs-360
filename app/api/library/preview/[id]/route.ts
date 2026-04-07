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
import {
  downloadDocumentsBucketObject,
  normalizeDocumentsBucketObjectPath,
} from "@/lib/supabaseStorageServer";

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
    .select("id, user_id, project_name, status, notes, final_file_path")
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

  const previewPathRaw = getMarketplacePreviewPath(document.notes)?.trim() ?? "";
  const customPreviewOk =
    previewPathRaw.length > 0 &&
    isValidMarketplacePreviewPath(id, previewPathRaw);
  const finalPath =
    typeof document.final_file_path === "string"
      ? document.final_file_path.trim()
      : "";

  let storagePath: string | null = customPreviewOk
    ? previewPathRaw
    : finalPath || null;

  if (!storagePath) {
    return NextResponse.json(
      { error: "No preview is available for this document." },
      { status: 404 }
    );
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
    return NextResponse.json(
      { error: downloaded.error },
      { status: downloaded.status }
    );
  }

  let buffer = downloaded.buffer;
  let sourceName = fileNameFromPreviewPath(
    storagePath,
    document.project_name ?? null
  );

  let extracted = await extractMarketplacePreviewExcerpt(buffer, sourceName);

  if (!extracted.ok && canFallbackToFinal && excerptSource === "marketplace_preview") {
    const fromFinal = await downloadDocumentsBucketObject(finalPath);
    if (fromFinal.ok) {
      buffer = fromFinal.buffer;
      storagePath = finalPath;
      excerptSource = "final_file";
      sourceName = fileNameFromPreviewPath(
        finalPath,
        document.project_name ?? null
      );
      extracted = await extractMarketplacePreviewExcerpt(buffer, sourceName);
    }
  }

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
      excerpt_source: excerptSource,
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
