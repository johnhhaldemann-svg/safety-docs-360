import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { buildMarketplaceNotes } from "@/lib/marketplace";

export const runtime = "nodejs";

type MarketplacePayload = {
  enabled?: boolean;
  creditCost?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = (await request.json()) as MarketplacePayload;
  const enabled = Boolean(body.enabled);
  const creditCost =
    typeof body.creditCost === "number" && Number.isFinite(body.creditCost)
      ? Math.max(1, Math.round(body.creditCost))
      : 5;

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

  const notes = buildMarketplaceNotes(document.notes, {
    enabled,
    creditCost,
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
