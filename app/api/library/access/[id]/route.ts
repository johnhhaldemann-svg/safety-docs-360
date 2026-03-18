import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { normalizePurchasedIds } from "@/lib/marketplace";
import {
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
} from "@/lib/credits";

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

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, user_id, project_name, status, final_file_path")
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
  const canAccess =
    document.user_id === user.id ||
    purchasedDocumentIds.includes(document.id) ||
    isAdminRole(role);

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

  return NextResponse.json({
    signedUrl: data.signedUrl,
    fileName: `${document.project_name || "completed_document"}.docx`,
  });
}
