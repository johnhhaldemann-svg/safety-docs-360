import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import {
  buildMarketplaceNotes,
  getDocumentCreditCost,
  getSubmitterPreviewStatus,
  isMarketplaceEnabled,
} from "@/lib/marketplace";

export const runtime = "nodejs";

type DecisionBody = {
  decision?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request);

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;

  let body: DecisionBody = {};
  try {
    body = (await request.json()) as DecisionBody;
  } catch {
    body = {};
  }

  const raw = body.decision;
  const decision = raw === "approve" || raw === "reject" ? raw : null;
  if (!decision) {
    return NextResponse.json(
      { error: 'Body must include "decision": "approve" or "reject".' },
      { status: 400 }
    );
  }

  const { data: document, error: docError } = await auth.supabase
    .from("documents")
    .select("id, user_id, notes")
    .eq("id", id)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const ownerId = typeof document.user_id === "string" ? document.user_id : null;
  const isOwner = ownerId !== null && ownerId === auth.user.id;
  if (!isOwner && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const pending = getSubmitterPreviewStatus(document.notes);
  if (pending !== "pending") {
    return NextResponse.json(
      { error: "There is no pending marketplace preview to approve or reject." },
      { status: 400 }
    );
  }

  const nextStatus = decision === "approve" ? "approved" : "rejected";

  const notes = buildMarketplaceNotes(document.notes, {
    enabled: isMarketplaceEnabled(document.notes),
    creditCost: getDocumentCreditCost(document.notes),
    submitterPreviewStatus: nextStatus,
  });

  const marketplaceUpdatedAt = new Date().toISOString();

  const { error: updateError } = await auth.supabase
    .from("documents")
    .update({
      notes,
      marketplace_updated_at: marketplaceUpdatedAt,
      marketplace_updated_by: auth.user.id,
      marketplace_updated_by_email: auth.user.email ?? null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    submitterPreviewStatus: nextStatus,
    notes,
    marketplaceUpdatedAt,
  });
}
