import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  buildMarketplaceNotes,
  getDocumentCreditCost,
  isMarketplaceEnabled,
  isValidMarketplacePreviewPath,
} from "@/lib/marketplace";

export const runtime = "nodejs";

type MarketplacePayload = {
  enabled?: boolean;
  creditCost?: number;
  previewFilePath?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_approve_documents",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = (await request.json()) as MarketplacePayload;
  const { data: document, error: getError } = await auth.supabase
    .from("documents")
    .select("id, notes")
    .eq("id", id)
    .single();

  if (getError || !document) {
    return NextResponse.json(
      { error: getError?.message || "Document not found." },
      { status: 404 }
    );
  }

  const enabled =
    typeof body.enabled === "boolean"
      ? body.enabled
      : isMarketplaceEnabled(document.notes);
  const creditCost =
    typeof body.creditCost === "number" && Number.isFinite(body.creditCost)
      ? Math.max(1, Math.round(body.creditCost))
      : getDocumentCreditCost(document.notes);

  let previewFilePath: string | null | undefined = undefined;
  if ("previewFilePath" in body) {
    const v = body.previewFilePath;
    if (v === null) {
      previewFilePath = null;
    } else if (typeof v === "string" && v.trim()) {
      if (!isValidMarketplacePreviewPath(id, v)) {
        return NextResponse.json(
          { error: "Invalid preview file path." },
          { status: 400 }
        );
      }
      previewFilePath = v.trim();
    } else {
      previewFilePath = null;
    }
  }

  const notes = buildMarketplaceNotes(document.notes, {
    enabled,
    creditCost,
    previewFilePath,
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
    notes,
    marketplaceUpdatedAt,
    marketplaceUpdatedByEmail: auth.user.email ?? null,
  });
}
