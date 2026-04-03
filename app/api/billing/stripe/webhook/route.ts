import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  applyCheckoutSessionCompleted,
  recordStripePaymentIntentFailed,
} from "@/lib/billing/applyStripeCheckoutPayment";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripeCheckout";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Stripe → Supabase billing sync. Configure endpoint in Stripe Dashboard with signing secret STRIPE_WEBHOOK_SECRET.
 * Source of truth for invoice balances remains `billing_invoices`; this applies paid Checkout sessions idempotently.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const whSecret = getStripeWebhookSecret();
  if (!stripe || !whSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("Stripe webhook: SUPABASE_SERVICE_ROLE_KEY missing");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const r = await applyCheckoutSessionCompleted(admin, session);
        if (!r.ok) {
          console.warn("checkout.session.completed skipped:", r.reason, session.id);
        }
        break;
      }
      case "payment_intent.succeeded": {
        /* Avoid double-counting: Checkout is reconciled in checkout.session.completed */
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await recordStripePaymentIntentFailed(admin, pi);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
