import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest, isAdminRole, isCompanyRole } from "@/lib/rbac";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import { normalizePurchasedIds } from "@/lib/marketplace";
import {
  getClientIpAddress,
  getDefaultAgreementConfig,
  getUserAgreementRecord,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import {
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
} from "@/lib/credits";
import { logDocumentDownload } from "@/lib/downloadAudit";

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
  const downloadConfirmed =
    request.headers.get("x-download-confirmed")?.trim().toLowerCase() === "true";

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
        error: "Acceptance of the current agreement is required before downloading documents.",
        termsVersion: agreementConfig.version,
      },
      { status: 403 }
    );
  }

  if (!downloadConfirmed) {
    return NextResponse.json(
      { error: "Download confirmation is required before opening this document." },
      { status: 400 }
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, user_id, company_id, project_name, status, final_file_path")
    .eq("id", id)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (!document.final_file_path) {
    return NextResponse.json(
      { error: "This document does not have a final file yet." },
      { status: 404 }
    );
  }

  if (document.status?.trim().toLowerCase() === "archived") {
    return NextResponse.json(
      { error: "This document is no longer available." },
      { status: 404 }
    );
  }

  const transactionResult = await listCreditTransactions(supabase, user.id);
  const purchasedDocumentIds = !transactionResult.error
    ? purchasedDocumentIdsFromTransactions(transactionResult.data)
    : normalizePurchasedIds(user.user_metadata?.purchased_document_ids);

  const companyScope = await getCompanyScope({
    supabase,
    userId: user.id,
    fallbackTeam: null,
    authUser: user,
  });
  const docCompanyId =
    typeof document.company_id === "string" ? document.company_id : null;
  const approved = isApprovedDocumentStatus(
    document.status,
    Boolean(document.final_file_path)
  );
  const sameCompanyApproved =
    approved &&
    Boolean(companyScope.companyId) &&
    Boolean(docCompanyId) &&
    companyScope.companyId === docCompanyId &&
    isCompanyRole(role);

  const canAccess =
    document.user_id === user.id ||
    purchasedDocumentIds.includes(document.id) ||
    isAdminRole(role) ||
    sameCompanyApproved;

  if (!canAccess) {
    return NextResponse.json(
      { error: "Purchase required before opening this document." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(document.final_file_path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Failed to create access URL." },
      { status: 500 }
    );
  }

  await logDocumentDownload({
    supabase,
    documentId: document.id,
    actorUserId: user.id,
    ownerUserId: document.user_id ?? null,
    fileKind: "final",
    ipAddress: getClientIpAddress(request),
    metadata: {
      route: "library_access",
      project_name: document.project_name ?? null,
    },
  });

  return NextResponse.json({
    signedUrl: data.signedUrl,
    fileName: `${document.project_name || "completed_document"}.docx`,
  });
}
