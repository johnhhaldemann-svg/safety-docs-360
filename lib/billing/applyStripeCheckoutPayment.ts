import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { computeBalanceDue } from "@/lib/billing/invoiceTotals";
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
  if (existingPay) {
    return { ok: true };
  }

  const { data: inv, error: loadErr } = await admin
    .from("billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (loadErr || !inv) {
    return { ok: false, reason: "invoice_not_found" };
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
  const nextPaid = prevPaid + amountCents;
  const balance_due_cents = computeBalanceDue(total_cents, nextPaid);
  const nextStatus =
    balance_due_cents <= 0 ? "paid" : nextPaid > 0 ? "partial" : status;

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
