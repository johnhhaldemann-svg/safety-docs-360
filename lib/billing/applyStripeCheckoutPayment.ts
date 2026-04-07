import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { computeBalanceDue } from "@/lib/billing/invoiceTotals";
import { listCompanyCreditTransactions } from "@/lib/companyBilling";
import { recordBillingEvent } from "@/lib/billing/recordEvent";

export function stripeCheckoutDedupeKey(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") {
    return pi;
  }
  if (pi && typeof pi === "object" && "id" in pi) {
    return (pi as Stripe.PaymentIntent).id;
  }
  if (session.id?.startsWith("cs_")) {
    return `checkout_session:${session.id}`;
  }
  return session.id ?? null;
}

type InvoiceLineItemRow = {
  item_type?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price_cents?: number | null;
  line_total_cents?: number | null;
  metadata?: Record<string, unknown> | null;
};

type MarketplaceCreditPackInfo = {
  packId: string | null;
  label: string | null;
  credits: number;
  priceCents: number | null;
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function getMarketplaceCreditPackInfo(
  invoice: {
    billing_source?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  lineItems: InvoiceLineItemRow[]
): MarketplaceCreditPackInfo | null {
  if (String(invoice.billing_source ?? "").trim().toLowerCase() !== "marketplace_credit_pack") {
    return null;
  }

  const metadata = invoice.metadata ?? {};
  const metadataPackId = typeof metadata.credit_pack_id === "string" ? metadata.credit_pack_id : null;
  const metadataLabel = typeof metadata.credit_pack_label === "string" ? metadata.credit_pack_label : null;
  const metadataCredits = readNumber(metadata.credit_pack_credits);
  const metadataPrice = readNumber(metadata.credit_pack_price_cents);

  const lineItem = lineItems.find((item) => String(item.item_type ?? "").trim().toLowerCase() === "credit_pack") ?? null;

  return {
    packId: metadataPackId,
    label: metadataLabel ?? lineItem?.description ?? "Marketplace credit pack",
    credits: metadataCredits ?? readNumber(lineItem?.metadata?.credit_pack_credits) ?? 0,
    priceCents:
      metadataPrice ??
      readNumber(lineItem?.unit_price_cents) ??
      readNumber(lineItem?.line_total_cents),
  };
}

async function billingEventExists(
  admin: SupabaseClient,
  invoiceId: string,
  eventTypes: string[]
): Promise<boolean> {
  const { data, error } = await admin
    .from("billing_events")
    .select("id")
    .eq("invoice_id", invoiceId)
    .in("event_type", eventTypes)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("billing event lookup failed", error);
    return false;
  }

  return Boolean(data);
}

async function ensureMarketplaceCreditPackGrant(
  admin: SupabaseClient,
  invoice: {
    id: string;
    invoice_number: string;
    company_id: string;
    amount_paid_cents: number;
    metadata?: Record<string, unknown> | null;
    billing_source?: string | null;
  },
  session: Stripe.Checkout.Session,
  lineItems: InvoiceLineItemRow[]
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const packInfo = getMarketplaceCreditPackInfo(invoice, lineItems);
  if (!packInfo || packInfo.credits <= 0) {
    return { ok: true };
  }

  const { data: transactions, error } = await listCompanyCreditTransactions(
    admin,
    invoice.company_id
  );
  if (error) {
    return { ok: false, reason: error.message || "Failed to load company credit ledger." };
  }

  const alreadyGranted = transactions.some((tx) => {
    if (tx.transaction_type !== "grant") {
      return false;
    }
    const metadata = tx.metadata ?? {};
    return (
      typeof metadata.invoice_id === "string" &&
      metadata.invoice_id === invoice.id &&
      metadata.source === "marketplace_credit_pack"
    );
  });

  if (alreadyGranted) {
    return { ok: true };
  }

  const { error: insertError } = await admin.from("company_credit_transactions").insert({
    company_id: invoice.company_id,
    amount: packInfo.credits,
    transaction_type: "grant",
    description: `${packInfo.label ?? "Marketplace credit pack"} purchased via Stripe Checkout`,
    metadata: {
      source: "marketplace_credit_pack",
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      credit_pack_id: packInfo.packId,
      credit_pack_label: packInfo.label,
      credit_pack_credits: packInfo.credits,
      credit_pack_price_cents: packInfo.priceCents,
      amount_paid_cents: invoice.amount_paid_cents,
    },
  });

  if (insertError) {
    return { ok: false, reason: insertError.message || "Failed to grant marketplace credits." };
  }

  return { ok: true };
}

export async function applyCheckoutSessionCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (session.mode !== "payment") {
    return { ok: false, reason: "not_payment_mode" };
  }
  if (session.payment_status !== "paid") {
    return { ok: false, reason: "not_paid" };
  }

  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) {
    return { ok: false, reason: "no_invoice_metadata" };
  }

  const dedupe = stripeCheckoutDedupeKey(session);
  if (!dedupe) {
    return { ok: false, reason: "no_dedupe_key" };
  }

  const { data: existingPay } = await admin
    .from("billing_invoice_payments")
    .select("id")
    .eq("external_payment_id", dedupe)
    .maybeSingle();

  const { data: inv, error: loadErr } = await admin
    .from("billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (loadErr || !inv) {
    return { ok: false, reason: "invoice_not_found" };
  }

  const { data: lineItems, error: lineItemsErr } = await admin
    .from("billing_invoice_line_items")
    .select("item_type, description, quantity, unit_price_cents, line_total_cents, metadata")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (lineItemsErr) {
    return { ok: false, reason: "invoice_line_items_load_failed" };
  }

  const status = String(inv.status).toLowerCase();
  if (status === "void" || status === "cancelled") {
    return { ok: false, reason: "invoice_terminal" };
  }

  const sessionCurrency = (session.currency ?? "usd").toLowerCase();
  const invCurrency = String(inv.currency ?? "usd").toLowerCase();
  if (sessionCurrency !== invCurrency) {
    return { ok: false, reason: "currency_mismatch" };
  }

  const amountCents = session.amount_total ?? 0;
  if (amountCents <= 0) {
    return { ok: false, reason: "no_amount" };
  }

  const total_cents = Number(inv.total_cents);
  const prevPaid = Number(inv.amount_paid_cents);
  const nextPaid = existingPay ? Math.max(prevPaid, amountCents) : prevPaid + amountCents;
  const balance_due_cents = computeBalanceDue(total_cents, nextPaid);
  const nextStatus =
    balance_due_cents <= 0 ? "paid" : nextPaid > 0 ? "partial" : status;

  if (!existingPay) {
    const { error: payInsErr } = await admin.from("billing_invoice_payments").insert({
      invoice_id: invoiceId,
      amount_cents: amountCents,
      payment_method: "stripe",
      external_payment_id: dedupe,
      notes: `Stripe Checkout ${session.id}`,
      created_by_user_id: null,
    });
    if (payInsErr) {
      console.error("stripe webhook payment insert", payInsErr);
      return { ok: false, reason: "payment_insert_failed" };
    }
  }

  const { error: upErr } = await admin
    .from("billing_invoices")
    .update({
      amount_paid_cents: nextPaid,
      balance_due_cents,
      status: nextStatus,
      paid_at: balance_due_cents <= 0 ? new Date().toISOString() : inv.paid_at,
      payment_provider: "stripe",
    })
    .eq("id", invoiceId);
  if (upErr) {
    return { ok: false, reason: "invoice_update_failed" };
  }

  const hasPaymentEvent = await billingEventExists(admin, invoiceId, [
    "payment_received",
    "marked_paid",
  ]);

  if (!hasPaymentEvent) {
    await recordBillingEvent(admin, {
      invoice_id: invoiceId,
      event_type: balance_due_cents <= 0 ? "marked_paid" : "payment_received",
      created_by_user_id: null,
      event_data: {
        stripe_checkout_session_id: session.id,
        stripe_payment_intent:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        amount_cents: amountCents,
      },
    });
  }

  const grantResult = await ensureMarketplaceCreditPackGrant(admin, inv as {
    id: string;
    invoice_number: string;
    company_id: string;
    amount_paid_cents: number;
    metadata?: Record<string, unknown> | null;
    billing_source?: string | null;
  }, session, lineItems as InvoiceLineItemRow[]);

  if (!grantResult.ok) {
    return grantResult;
  }

  return { ok: true };
}

export async function recordStripePaymentIntentFailed(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent
): Promise<void> {
  const invoiceId = pi.metadata?.invoice_id;
  if (!invoiceId) {
    return;
  }
  const { data: inv } = await admin.from("billing_invoices").select("id").eq("id", invoiceId).maybeSingle();
  if (!inv) {
    return;
  }
  await recordBillingEvent(admin, {
    invoice_id: invoiceId,
    event_type: "payment_failed",
    created_by_user_id: null,
    event_data: {
      stripe_payment_intent_id: pi.id,
      last_payment_error: pi.last_payment_error?.message ?? null,
    },
  });
}
