import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketplaceDocumentPurchase = {
  id: string;
  company_id: string;
  document_id: string;
  invoice_id: string | null;
  purchased_by_user_id: string | null;
  amount_cents: number;
  currency: string;
  paid_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function listMarketplaceDocumentPurchases(
  supabase: SupabaseClient,
  companyId: string
) {
  const { data, error } = await supabase
    .from("marketplace_document_purchases")
    .select(
      "id, company_id, document_id, invoice_id, purchased_by_user_id, amount_cents, currency, paid_at, metadata, created_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return {
    data: (data ?? []) as MarketplaceDocumentPurchase[],
    error,
  };
}

export function purchasedMarketplaceDocumentIds(
  purchases: MarketplaceDocumentPurchase[]
) {
  return Array.from(new Set(purchases.map((purchase) => purchase.document_id)));
}

export async function hasMarketplaceDocumentPurchase(params: {
  supabase: SupabaseClient;
  companyId: string;
  documentId: string;
}) {
  const { data, error } = await params.supabase
    .from("marketplace_document_purchases")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("document_id", params.documentId)
    .maybeSingle();

  return {
    purchased: Boolean(data?.id),
    error,
  };
}

export async function ensureMarketplaceDocumentPurchase(params: {
  supabase: SupabaseClient;
  companyId: string;
  documentId: string;
  invoiceId: string;
  purchasedByUserId?: string | null;
  amountCents: number;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { data: existing, error: existingError } = await params.supabase
    .from("marketplace_document_purchases")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("document_id", params.documentId)
    .maybeSingle();

  if (existingError) {
    return { ok: false as const, error: existingError.message };
  }

  if (existing?.id) {
    return { ok: true as const, alreadyExisted: true };
  }

  const { error } = await params.supabase
    .from("marketplace_document_purchases")
    .insert({
      company_id: params.companyId,
      document_id: params.documentId,
      invoice_id: params.invoiceId,
      purchased_by_user_id: params.purchasedByUserId ?? null,
      amount_cents: Math.max(0, Math.floor(params.amountCents)),
      currency: (params.currency ?? "usd").trim().toLowerCase() || "usd",
      paid_at: new Date().toISOString(),
      metadata: params.metadata ?? {},
    });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, alreadyExisted: false };
}

export function getMarketplaceDocumentInvoiceMetadata(invoice: {
  billing_source?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  if (
    String(invoice.billing_source ?? "").trim().toLowerCase() !==
    "marketplace_document_purchase"
  ) {
    return null;
  }

  const metadata = invoice.metadata ?? {};
  const documentId =
    typeof metadata.marketplace_document_id === "string"
      ? metadata.marketplace_document_id
      : typeof metadata.document_id === "string"
        ? metadata.document_id
        : null;
  const purchasedByUserId =
    typeof metadata.purchased_by_user_id === "string"
      ? metadata.purchased_by_user_id
      : null;
  const amountCents =
    typeof metadata.marketplace_document_price_cents === "number"
      ? metadata.marketplace_document_price_cents
      : null;
  const currency =
    typeof metadata.marketplace_document_currency === "string"
      ? metadata.marketplace_document_currency
      : "usd";

  if (!documentId) {
    return null;
  }

  return {
    documentId,
    purchasedByUserId,
    amountCents,
    currency,
  };
}
