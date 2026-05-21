import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import { sendMarketplaceCreditPurchaseReceiptEmail } from "@/lib/billing/marketplaceCreditReceiptEmail";
import { resolveAppBaseUrl } from "@/lib/billing/resolveAppBaseUrl";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return 0;
}

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
    const { data: invoice, error } = await auth.supabase
      .from("billing_invoices")
      .select("*, billing_customers(*), billing_invoice_line_items(*)")
      .eq("id", id)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ error: error?.message || "Invoice not found." }, { status: 404 });
    }

    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId: invoice.company_id as string,
    });

    const source = String(invoice.billing_source ?? "").trim().toLowerCase();
    if (source !== "marketplace_credit_pack") {
      return NextResponse.json(
        { error: "This invoice is not a marketplace credit purchase." },
        { status: 400 }
      );
    }

    const status = String(invoice.status ?? "").trim().toLowerCase();
    const balanceDue = readNumber(invoice.balance_due_cents);
    if (status !== "paid" && balanceDue > 0) {
      return NextResponse.json(
        { error: "A receipt can only be sent after the invoice has been paid." },
        { status: 409 }
      );
    }

    const customer = Array.isArray(invoice.billing_customers)
      ? invoice.billing_customers[0]
      : invoice.billing_customers;
    if (!customer) {
      return NextResponse.json({ error: "Billing customer not found." }, { status: 400 });
    }
    const billingEmail = String(customer.billing_email ?? "").trim();
    if (!billingEmail) {
      return NextResponse.json({ error: "Billing email is missing for this customer." }, { status: 400 });
    }

    const lineItems = Array.isArray(invoice.billing_invoice_line_items)
      ? invoice.billing_invoice_line_items
      : [];
    const packLine =
      lineItems.find((item: { item_type?: string | null }) => String(item.item_type ?? "").trim().toLowerCase() === "credit_pack") ??
      lineItems[0] ??
      null;

    const metadata = (invoice.metadata ?? {}) as Record<string, unknown>;
    const packLabel =
      (typeof metadata.credit_pack_label === "string" ? metadata.credit_pack_label : null) ??
      (packLine && typeof packLine.description === "string" ? packLine.description : null) ??
      "Marketplace credit pack";
    const credits =
      readNumber(metadata.credit_pack_credits) ||
      readNumber(packLine?.metadata?.credit_pack_credits) ||
      readNumber(packLine?.quantity);
    const amountCents = readNumber(invoice.total_cents) || readNumber(packLine?.line_total_cents);

    const receiptResult = await sendMarketplaceCreditPurchaseReceiptEmail({
      toEmail: billingEmail,
      companyName:
        String(customer.company_name ?? "").trim() ||
        String(invoice.company_id ?? "").trim() ||
        "Company Workspace",
      invoiceNumber: String(invoice.invoice_number ?? "").trim(),
      invoiceId: id,
      baseUrl: resolveAppBaseUrl(request),
      packLabel,
      credits,
      amountCents,
      currency: String(invoice.currency ?? "usd"),
    });

    if (!receiptResult.sent) {
      return NextResponse.json(
        { error: receiptResult.warning || "Receipt could not be sent." },
        { status: 400 }
      );
    }

    await recordBillingEvent(auth.supabase, {
      invoice_id: id,
      event_type: "receipt_sent",
      created_by_user_id: auth.user.id,
      event_data: {
        manual_resend: true,
        invoice_number: String(invoice.invoice_number ?? ""),
        receipt_url: receiptResult.receiptUrl ?? null,
        to_email: billingEmail,
        credit_pack_label: packLabel,
        credit_pack_credits: credits,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Receipt resent successfully.",
    });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
