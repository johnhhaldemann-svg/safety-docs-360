import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  authorizeRequest,
  isCompanyAdminRole,
  isCompanyRole,
} from "@/lib/rbac";
import {
  isApprovedDocumentStatus,
  isArchivedDocumentStatus,
} from "@/lib/documentStatus";
import {
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
} from "@/lib/credits";
import { normalizePurchasedIds } from "@/lib/marketplace";

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

  let documents = (data ?? []) as Array<Record<string, unknown>>;

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

    documents = documents.filter((document) => {
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

      if (isCompanyAdminRole(auth.role) || auth.role === "manager") {
        return companyScope.companyId ? companyId === companyScope.companyId : userId === auth.user.id;
      }

      return (
        isApprovedDocumentStatus(status, Boolean(finalFilePath)) &&
        (
          (companyScope.companyId ? companyId === companyScope.companyId : false) ||
          userId === auth.user.id ||
          purchasedDocumentIds.includes(id)
        )
      );
    });
  }

  return NextResponse.json({
    documents,
    viewerRole: auth.role,
    viewerTeam: auth.team,
  });
}
