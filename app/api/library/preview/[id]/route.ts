import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import {
  getMarketplacePreviewPath,
  isMarketplaceEnabled,
  isValidMarketplacePreviewPath,
} from "@/lib/marketplace";
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

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(previewPath, 120);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Failed to create preview URL." },
      { status: 500 }
    );
  }

  await logDocumentDownload({
    supabase,
    documentId: document.id,
    actorUserId: user.id,
    ownerUserId: document.user_id ?? null,
    fileKind: "preview",
    ipAddress: getClientIpAddress(request),
    metadata: {
      route: "library_preview",
      project_name: document.project_name ?? null,
    },
  });

  return NextResponse.json({
    signedUrl: data.signedUrl,
    fileName: fileNameFromPreviewPath(previewPath, document.project_name ?? null),
  });
}
