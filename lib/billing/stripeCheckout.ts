import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { resolveAppBaseUrl } from "@/lib/billing/resolveAppBaseUrl";

let stripeClient: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (stripeClient !== undefined) {
    return stripeClient;
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    stripeClient = null;
    return null;
  }
  stripeClient = new Stripe(key);
  return stripeClient;
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? null;
}

type BillingCustomerRow = {
  id: string;
  company_id: string;
  company_name: string;
  billing_contact_name: string | null;
  billing_email: string;
  stripe_customer_id: string | null;
};

export async function ensureStripeBillingCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  row: BillingCustomerRow
): Promise<string> {
  if (row.stripe_customer_id) {
    return row.stripe_customer_id;
  }
  const customer = await stripe.customers.create({
    email: row.billing_email,
    name: row.billing_contact_name?.trim() || row.company_name,
    metadata: {
      billing_customer_id: row.id,
      company_id: row.company_id,
    },
  });
  const { error } = await supabase
    .from("billing_customers")
    .update({ stripe_customer_id: customer.id })
    .eq("id", row.id);
  if (error) {
    throw new Error(`Could not save Stripe customer id: ${error.message}`);
  }
  return customer.id;
}

type InvoiceRow = {
  id: string;
  invoice_number: string;
  company_id: string;
  customer_id: string;
  balance_due_cents: number;
  currency: string;
  status: string;
  billing_customers?: BillingCustomerRow | BillingCustomerRow[] | null;
};

function normalizeEmbeddedCustomer(inv: InvoiceRow): BillingCustomerRow | null {
  const raw = inv.billing_customers;
  if (!raw) {
    return null;
  }
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

/**
 * Creates a Stripe Checkout Session for the current balance due and stores url + ids on the invoice.
 * Caller must enforce staff access and non-terminal invoice state.
 */
export async function createAndStoreStripeCheckoutSession(params: {
  supabase: SupabaseClient;
  stripe: Stripe;
  request: Request;
  invoiceId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string } | { error: string }> {
  const { supabase, stripe, request, invoiceId } = params;

  const { data: inv, error: invErr } = await supabase
    .from("billing_invoices")
    .select("*, billing_customers(*)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr || !inv) {
    return { error: invErr?.message || "Invoice not found." };
  }

  const invoice = inv as InvoiceRow;
  const balance = Number(invoice.balance_due_cents);
  if (!Number.isFinite(balance) || balance <= 0) {
    return { error: "No balance due; payment link not needed." };
  }

  const st = String(invoice.status).toLowerCase();
  if (st === "void" || st === "cancelled") {
    return { error: "Invoice is void or cancelled." };
  }

  const billingCustomer = normalizeEmbeddedCustomer(invoice);
  if (!billingCustomer) {
    return { error: "Billing customer record missing." };
  }

  const stripeCustomerId = await ensureStripeBillingCustomer(stripe, supabase, billingCustomer);
  const baseUrl = resolveAppBaseUrl(request);
  const successUrl =
    params.successUrl ??
    `${baseUrl}/customer/billing/invoices/${invoice.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    params.cancelUrl ??
    `${baseUrl}/customer/billing/invoices/${invoice.id}?checkout=cancelled`;

  const currency = String(invoice.currency || "usd").toLowerCase();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    client_reference_id: invoice.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: balance,
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            metadata: { invoice_id: invoice.id },
          },
        },
      },
    ],
    metadata: { invoice_id: invoice.id },
    payment_intent_data: {
      metadata: { invoice_id: invoice.id },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    return { error: "Stripe did not return a checkout URL." };
  }

  const { error: upErr } = await supabase
    .from("billing_invoices")
    .update({
      payment_link: session.url,
      stripe_checkout_session_id: session.id,
      stripe_customer_id: stripeCustomerId,
      payment_provider: "stripe",
    })
    .eq("id", invoiceId);

  if (upErr) {
    return { error: upErr.message || "Failed to store payment link." };
  }

  return { url: session.url };
}
