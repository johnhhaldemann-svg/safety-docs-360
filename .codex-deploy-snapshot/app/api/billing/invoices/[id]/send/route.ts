import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import { createAndStoreStripeCheckoutSession, getStripe } from "@/lib/billing/stripeCheckout";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Marks invoice as sent, records audit event, and (when Stripe is configured) creates a Checkout link for the balance due.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
  });
  if ("error" in auth) {
    return auth.error;
  }

  if (!isInternalBillingStaffRole(auth.role)) {
    return NextResponse.json({ error: "Billing is limited to platform billing staff." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const { data: inv, error: loadErr } = await auth.supabase
      .from("billing_invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadErr || !inv) {
      return NextResponse.json({ error: loadErr?.message || "Not found." }, { status: 404 });
    }

    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId: inv.company_id as string,
    });

    const { count, error: cntErr } = await auth.supabase
      .from("billing_invoice_line_items")
      .select("*", { count: "exact", head: true })
      .eq("invoice_id", id);

    if (cntErr) {
      return NextResponse.json({ error: cntErr.message }, { status: 500 });
    }

    if (!count || count < 1) {
      return NextResponse.json(
        { error: "Cannot send an invoice with no line items." },
        { status: 400 }
      );
    }

    if (inv.status === "void" || inv.status === "cancelled") {
      return NextResponse.json({ error: "Invoice is void or cancelled." }, { status: 409 });
    }

    const sentAt = new Date().toISOString();
    const { data: updated, error: upErr } = await auth.supabase
      .from("billing_invoices")
      .update({
        status: "sent",
        sent_at: sentAt,
      })
      .eq("id", id)
      .select()
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Update failed." }, { status: 500 });
    }

    await recordBillingEvent(auth.supabase, {
      invoice_id: id,
      event_type: "sent",
      created_by_user_id: auth.user.id,
      event_data: { sent_at: sentAt },
    });

    const stripe = getStripe();
    const balanceDue = Number(updated.balance_due_cents);
    let payment_link: string | null = (updated.payment_link as string | null) ?? null;
    let stripe_note: string | null = null;

    if (stripe && Number.isFinite(balanceDue) && balanceDue > 0) {
      const sessionResult = await createAndStoreStripeCheckoutSession({
        supabase: auth.supabase,
        stripe,
        request,
        invoiceId: id,
      });
      if ("url" in sessionResult) {
        payment_link = sessionResult.url;
      } else {
        stripe_note = sessionResult.error;
      }
    } else if (!stripe && Number.isFinite(balanceDue) && balanceDue > 0) {
      stripe_note =
        "Stripe not configured; use POST /api/billing/invoices/[id]/payment-link after setting STRIPE_SECRET_KEY.";
    }

    const { data: latest } = await auth.supabase
      .from("billing_invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({
      invoice: latest ?? updated,
      payment_link,
      stripe_note,
      message:
        stripe_note && !payment_link
          ? "Invoice marked as sent, but Stripe checkout could not be created."
          : "Invoice marked as sent.",
    });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
