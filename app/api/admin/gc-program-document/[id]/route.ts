import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  GC_REQUIRED_PROGRAM_DOCUMENT_TYPE,
  canReviewGcProgramDocumentRole,
} from "@/lib/gcRequiredProgram";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Action = "approve" | "reject";

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_review_documents", "can_approve_documents"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canReviewGcProgramDocumentRole(auth.role)) {
    return NextResponse.json(
      { error: "Only internal safety admins can approve GC program documents." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const documentId = id.trim();
  if (!documentId) {
    return NextResponse.json({ error: "Document id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { action?: Action } | null;
  const action = body?.action;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject." }, { status: 400 });
  }

  const { data: row, error: getError } = await auth.supabase
    .from("documents")
    .select("id, document_type, status, file_path, company_id")
    .eq("id", documentId)
    .maybeSingle();

  if (getError) {
    return NextResponse.json({ error: getError.message || "Failed to load document." }, { status: 500 });
  }

  const doc = row as {
    id?: string;
    document_type?: string | null;
    status?: string | null;
    file_path?: string | null;
    company_id?: string | null;
  } | null;

  if (!doc?.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if ((doc.document_type ?? "").trim() !== GC_REQUIRED_PROGRAM_DOCUMENT_TYPE) {
    return NextResponse.json({ error: "Not a GC program document." }, { status: 400 });
  }

  if (action === "reject") {
    if (doc.file_path) {
      await auth.supabase.storage.from("documents").remove([doc.file_path]);
    }
    const { error: delError } = await auth.supabase.from("documents").delete().eq("id", documentId);
    if (delError) {
      return NextResponse.json({ error: delError.message || "Failed to reject document." }, { status: 500 });
    }
    return NextResponse.json({ success: true, mode: "rejected" });
  }

  const normalizedStatus = (doc.status ?? "").trim().toLowerCase();
  if (normalizedStatus === "approved") {
    return NextResponse.json({ success: true, mode: "already_approved" });
  }

  if (!doc.file_path) {
    return NextResponse.json({ error: "Document has no file to approve." }, { status: 400 });
  }

  const approvedAt = new Date().toISOString();

  const { error: updateError } = await auth.supabase
    .from("documents")
    .update({
      status: "approved",
      final_file_path: doc.file_path,
      reviewer_email: auth.user.email ?? null,
      review_notes: "GC-required program file approved for company use.",
      approved_at: approvedAt,
      approved_by: auth.user.id,
      approved_by_email: auth.user.email ?? null,
    })
    .eq("id", documentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Approval failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true, mode: "approved", approvedAt });
}
