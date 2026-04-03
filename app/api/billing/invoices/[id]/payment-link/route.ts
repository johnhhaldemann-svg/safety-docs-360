import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import { createAndStoreStripeCheckoutSession, getStripe } from "@/lib/billing/stripeCheckout";
import { recordBillingEvent } from "@/lib/billing/recordEvent";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Creates or refreshes a Stripe Checkout URL for the invoice balance and stores it on the invoice.
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

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured (STRIPE_SECRET_KEY missing)." },
      { status: 503 }
    );
  }

  const { id } = await context.params;

  try {
    const { data: inv, error: loadErr } = await auth.supabase
      .from("billing_invoices")
      .select("id, company_id, status")
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

    const st = String(inv.status).toLowerCase();
    if (st === "void" || st === "cancelled") {
      return NextResponse.json({ error: "Invoice is void or cancelled." }, { status: 409 });
    }

    const result = await createAndStoreStripeCheckoutSession({
      supabase: auth.supabase,
      stripe,
      request,
      invoiceId: id,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await recordBillingEvent(auth.supabase, {
      invoice_id: id,
      event_type: "updated",
      created_by_user_id: auth.user.id,
      event_data: { action: "payment_link_created", stripe: true },
    });

    return NextResponse.json({ payment_link: result.url });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
