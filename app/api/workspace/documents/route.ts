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

const DOCUMENT_LIST_SELECT = [
  "id",
  "created_at",
  "user_id",
  "company_id",
  "status",
  "project_name",
  "document_title",
  "document_type",
  "category",
  "notes",
  "file_name",
  "file_path",
  "draft_file_path",
  "final_file_path",
  "file_size",
  "uploaded_by",
].join(",");

function parsePagination(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get("pageSize") ?? "25", 10) || 25)
  );
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  return { page, pageSize, start, end };
}

export async function GET(request: Request) {
  const debugStart = Date.now();
  const { page, pageSize, start, end } = parsePagination(request);
  // #region agent log
  fetch("http://127.0.0.1:7613/ingest/cee4d426-76d4-454a-9d6d-950241152e62", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "690b86" },
    body: JSON.stringify({
      sessionId: "690b86",
      runId: "workspace-docs-deep-1",
      hypothesisId: "H16",
      location: "app/api/workspace/documents/route.ts:GET:start",
      message: "workspace documents route entered",
      data: {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    // #region agent log
    fetch("http://127.0.0.1:7613/ingest/cee4d426-76d4-454a-9d6d-950241152e62", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "690b86" },
      body: JSON.stringify({
        sessionId: "690b86",
        runId: "workspace-docs-deep-1",
        hypothesisId: "H16",
        location: "app/api/workspace/documents/route.ts:GET:auth-error",
        message: "authorizeRequest failed",
        data: { elapsedMs: Date.now() - debugStart },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    // #region agent log
    fetch("http://127.0.0.1:7613/ingest/cee4d426-76d4-454a-9d6d-950241152e62", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "690b86" },
      body: JSON.stringify({
        sessionId: "690b86",
        runId: "workspace-docs-deep-1",
        hypothesisId: "H16",
        location: "app/api/workspace/documents/route.ts:GET:query-error",
        message: "documents query failed",
        data: { elapsedMs: Date.now() - debugStart, error: error.message ?? "unknown" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let documents = (data ?? []) as Array<Record<string, unknown>>;

  if (isCompanyRole(auth.role)) {
    const companyScope = await getCompanyScope({
      supabase: auth.supabase,
      userId: auth.user.id,
      fallbackTeam: auth.team,
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
  // #region agent log
  fetch("http://127.0.0.1:7613/ingest/cee4d426-76d4-454a-9d6d-950241152e62", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "690b86" },
    body: JSON.stringify({
      sessionId: "690b86",
      runId: "workspace-docs-deep-1",
      hypothesisId: "H16",
      location: "app/api/workspace/documents/route.ts:GET:success",
      message: "workspace documents returning",
      data: {
        elapsedMs: Date.now() - debugStart,
        role: auth.role,
        count: documents.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({
    documents,
    viewerRole: auth.role,
    viewerTeam: auth.team,
    pagination: {
      page,
      pageSize,
      returned: documents.length,
      hasMore: documents.length === pageSize,
    },
  });
}
