import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import { computeBalanceDue } from "@/lib/billing/invoiceTotals";
import { recordBillingEvent } from "@/lib/billing/recordEvent";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const METHODS = new Set(["stripe", "ach", "check", "cash", "manual", "other"]);

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

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* optional body */
  }

  const payment_method = String(body.payment_method ?? "manual").trim().toLowerCase();
  if (!METHODS.has(payment_method)) {
    return NextResponse.json({ error: "Invalid payment_method." }, { status: 400 });
  }

  const notes = body.notes == null ? null : String(body.notes);
  const external_payment_id =
    body.external_payment_id == null ? null : String(body.external_payment_id);

  try {
    const { data: inv, error: loadErr } = await auth.supabase
      .from("billing_invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadErr || !inv) {
      return NextResponse.json({ error: loadErr?.message || "Not found." }, { status: 404 });
    }

    if (inv.status === "void" || inv.status === "cancelled") {
      return NextResponse.json({ error: "Invoice is void or cancelled." }, { status: 409 });
    }

    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId: inv.company_id as string,
    });

    const total_cents = inv.total_cents as number;
    let amount_cents = Math.floor(Number(body.amount_cents ?? total_cents));
    if (body.mark_full === true || body.amount_cents === undefined) {
      amount_cents = Math.max(0, total_cents - (inv.amount_paid_cents as number));
    }

    if (amount_cents <= 0) {
      return NextResponse.json({ error: "amount_cents must be positive." }, { status: 400 });
    }

    const { error: payErr } = await auth.supabase.from("billing_invoice_payments").insert({
      invoice_id: id,
      amount_cents,
      payment_method,
      notes,
      external_payment_id,
      created_by_user_id: auth.user.id,
    });

    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 500 });
    }

    const nextPaid = (inv.amount_paid_cents as number) + amount_cents;
    const balance_due_cents = computeBalanceDue(total_cents, nextPaid);
    const nextStatus =
      balance_due_cents <= 0 ? "paid" : nextPaid > 0 ? "partial" : (inv.status as string);

    const { data: updated, error: upErr } = await auth.supabase
      .from("billing_invoices")
      .update({
        amount_paid_cents: nextPaid,
        balance_due_cents,
        status: nextStatus,
        paid_at: balance_due_cents <= 0 ? new Date().toISOString() : inv.paid_at,
      })
      .eq("id", id)
      .select()
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Update failed." }, { status: 500 });
    }

    await recordBillingEvent(auth.supabase, {
      invoice_id: id,
      event_type: balance_due_cents <= 0 ? "marked_paid" : "payment_received",
      created_by_user_id: auth.user.id,
      event_data: { amount_cents, payment_method },
    });

    return NextResponse.json({ invoice: updated });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
