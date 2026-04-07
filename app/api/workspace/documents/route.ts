import { NextResponse } from "next/server";
import { getCompanyScope, uuidMatches } from "@/lib/companyScope";
import {
  authorizeRequest,
  isCompanyRole,
  isCompanyWorkspaceOversightRole,
} from "@/lib/rbac";
import {
  isApprovedDocumentStatus,
  isArchivedDocumentStatus,
} from "@/lib/documentStatus";
import {
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
} from "@/lib/credits";
import { isMarketplaceEnabled, normalizePurchasedIds } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawDocuments = (data ?? []) as Array<Record<string, unknown>>;

  let documents = rawDocuments;
  let marketplaceCatalog: Array<Record<string, unknown>> = [];

  if (isCompanyRole(auth.role)) {
    const companyScope = await getCompanyScope({
      supabase: auth.supabase,
      userId: auth.user.id,
      fallbackTeam: auth.team,
      authUser: auth.user,
    });
    const transactionResult = await listCreditTransactions(auth.supabase, auth.user.id);
    const purchasedDocumentIds = !transactionResult.error
      ? purchasedDocumentIdsFromTransactions(transactionResult.data)
      : normalizePurchasedIds(auth.user.user_metadata?.purchased_document_ids);

    const workspaceDocumentIds = new Set<string>();

    documents = rawDocuments.filter((document) => {
      const status = typeof document.status === "string" ? document.status : null;
      const finalFilePath =
        typeof document.final_file_path === "string" ? document.final_file_path : null;
      const userId = typeof document.user_id === "string" ? document.user_id : null;
      const companyId =
        typeof document.company_id === "string" ? document.company_id : null;
      const id = typeof document.id === "string" ? document.id : "";

      if (isArchivedDocumentStatus(status)) {
        return false;
      }

      if (isCompanyWorkspaceOversightRole(auth.role)) {
        const include = companyScope.companyId
          ? uuidMatches(companyId, companyScope.companyId)
          : uuidMatches(userId, auth.user.id);
        if (include && id) workspaceDocumentIds.add(id);
        return include;
      }

      const include =
        isApprovedDocumentStatus(status, Boolean(finalFilePath)) &&
        (
          (companyScope.companyId
            ? uuidMatches(companyId, companyScope.companyId)
            : false) ||
          uuidMatches(userId, auth.user.id) ||
          purchasedDocumentIds.some((pid) => uuidMatches(pid, id))
        );
      if (include && id) workspaceDocumentIds.add(id);
      return include;
    });

    marketplaceCatalog = rawDocuments.filter((document) => {
      const status = typeof document.status === "string" ? document.status : null;
      const finalFilePath =
        typeof document.final_file_path === "string" ? document.final_file_path : null;
      const notes = typeof document.notes === "string" ? document.notes : null;
      const id = typeof document.id === "string" ? document.id : "";

      if (!id || isArchivedDocumentStatus(status)) {
        return false;
      }
      if (!isApprovedDocumentStatus(status, Boolean(finalFilePath)) || !finalFilePath?.trim()) {
        return false;
      }
      if (!isMarketplaceEnabled(notes)) {
        return false;
      }
      return !workspaceDocumentIds.has(id);
    });
  }

  return NextResponse.json({
    documents,
    marketplaceCatalog,
    viewerRole: auth.role,
    viewerTeam: auth.team,
  });
}
