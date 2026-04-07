import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import {
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
} from "@/lib/credits";
import { normalizePurchasedIds } from "@/lib/marketplace";
import {
  basenameFromStoragePath,
  extractMarketplacePreviewExcerpt,
} from "@/lib/marketplacePreviewExcerpt";
import {
  getClientIpAddress,
  getDefaultAgreementConfig,
  getUserAgreementRecord,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { logDocumentDownload } from "@/lib/downloadAudit";
import { downloadDocumentsBucketObject } from "@/lib/supabaseStorageServer";
import { canRequestWorkspaceDocumentExcerpt } from "@/lib/workspaceDocumentAccess";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user, role } = auth;
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
        error:
          "Acceptance of the current agreement is required before previewing documents.",
        termsVersion: agreementConfig.version,
      },
      { status: 403 }
    );
  }

  // Load row with service role when available. RLS on `documents` can hide in-review rows
  // from company peers (e.g. company_id null / policy overlap) even when the library list
  // shows the document; access is still enforced below via canRequestWorkspaceDocumentExcerpt.
  const adminClient = createSupabaseAdminClient();
  const docClient = adminClient ?? supabase;
  const { data: document, error: documentError } = await docClient
    .from("documents")
    .select(
      "id, user_id, company_id, project_name, document_title, file_name, status, file_path, draft_file_path, final_file_path"
    )
    .eq("id", id)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const companyScope = await getCompanyScope({
    supabase,
    userId: user.id,
    fallbackTeam: auth.team,
    authUser: user,
  });

  let purchasedDocumentIds: string[] = [];
  if (isCompanyRole(role)) {
    const transactionResult = await listCreditTransactions(supabase, user.id);
    purchasedDocumentIds = !transactionResult.error
      ? purchasedDocumentIdsFromTransactions(transactionResult.data)
      : normalizePurchasedIds(user.user_metadata?.purchased_document_ids);
  }

  const allowed = canRequestWorkspaceDocumentExcerpt(
    {
      id: document.id,
      status: document.status,
      final_file_path: document.final_file_path,
      user_id: document.user_id,
      company_id: document.company_id,
    },
    {
      role,
      userId: user.id,
      companyScopeCompanyId: companyScope.companyId,
      purchasedDocumentIds,
    }
  );

  if (!allowed) {
    return NextResponse.json({ error: "You do not have access to this document." }, { status: 403 });
  }

  const storagePath =
    document.file_path?.trim() ||
    document.draft_file_path?.trim() ||
    document.final_file_path?.trim() ||
    null;

  if (!storagePath) {
    return NextResponse.json(
      { error: "No file is attached to this document yet." },
      { status: 404 }
    );
  }

  const downloaded = await downloadDocumentsBucketObject(storagePath);
  if (!downloaded.ok) {
    return NextResponse.json(
      { error: downloaded.error },
      { status: downloaded.status }
    );
  }
  const buffer = downloaded.buffer;
  const sourceName =
    document.file_name?.trim() ||
    basenameFromStoragePath(storagePath) ||
    "document.bin";

  const extracted = await extractMarketplacePreviewExcerpt(buffer, sourceName);

  if (!extracted.ok) {
    return NextResponse.json({ error: extracted.error }, { status: 422 });
  }

  const empty = extracted.excerpt.length === 0;

  await logDocumentDownload({
    supabase,
    documentId: document.id,
    actorUserId: user.id,
    ownerUserId: document.user_id ?? null,
    fileKind: "draft",
    ipAddress: getClientIpAddress(request),
    metadata: {
      route: "library_workspace_excerpt",
      truncated: extracted.truncated,
      empty_excerpt: empty,
    },
  });

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
  });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
