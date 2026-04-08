import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import {
  computeBalanceDue,
  computeInvoiceTotals,
  computeLineTotalCents,
} from "@/lib/billing/invoiceTotals";
import { getBillableCompanyScope } from "@/lib/billing/queryScope";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import type { InvoiceStatus, LineItemInput } from "@/lib/billing/types";

export const runtime = "nodejs";

const STATUSES: Set<string> = new Set([
  "draft",
  "sent",
  "viewed",
  "partial",
  "paid",
  "overdue",
  "void",
  "cancelled",
]);

function parseYmd(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  return s;
}

function normalizeLineItems(raw: unknown): LineItemInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: LineItemInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, unknown>;
    const description = String(o.description ?? "").trim();
    const quantity = Number(o.quantity ?? 1);
    const unit_price_cents = Math.floor(Number(o.unit_price_cents ?? 0));
    const item_type = String(o.item_type ?? "custom").trim().toLowerCase();
    if (!description) {
      continue;
    }
    out.push({
      description,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit_price_cents: Math.max(0, unit_price_cents),
      item_type: (["subscription", "document_review", "credit_pack", "consulting", "custom"].includes(
        item_type
      )
        ? item_type
        : "custom") as LineItemInput["item_type"],
      sort_order: typeof o.sort_order === "number" ? o.sort_order : out.length,
      metadata:
        o.metadata && typeof o.metadata === "object"
          ? (o.metadata as Record<string, unknown>)
          : undefined,
    });
  }
  return out;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
  });
  if ("error" in auth) {
    return auth.error;
  }

  if (!isInternalBillingStaffRole(auth.role)) {
    return NextResponse.json({ error: "Billing is limited to platform billing staff." }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const companyId = url.searchParams.get("company_id") ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const overdueOnly = url.searchParams.get("overdue") === "1";

  try {
    const scope = await getBillableCompanyScope(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
    });

    if (scope.mode === "list" && scope.companyIds.length === 0) {
      return NextResponse.json({ invoices: [] });
    }

    let query = auth.supabase
      .from("billing_invoices")
      .select(
        "*, billing_customers(company_name, billing_email), companies(name)"
      )
      .order("created_at", { ascending: false });

    if (scope.mode === "list") {
      query = query.in("company_id", scope.companyIds);
    }

    if (status && STATUSES.has(status)) {
      query = query.eq("status", status);
    }

    if (companyId) {
      await assertStaffCanAccessCompany(auth.supabase, {
        staffUserId: auth.user.id,
        staffRole: auth.role,
        companyId,
      });
      query = query.eq("company_id", companyId);
    }

    if (q) {
      const like = `%${q}%`;
      query = query.or(`invoice_number.ilike.${like}`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = data ?? [];
    if (overdueOnly) {
      const today = new Date().toISOString().slice(0, 10);
      rows = rows.filter(
        (inv: { due_date?: string; balance_due_cents?: number; status?: string }) =>
          inv.balance_due_cents != null &&
          inv.balance_due_cents > 0 &&
          inv.due_date != null &&
          inv.due_date < today &&
          inv.status !== "draft" &&
          inv.status !== "void" &&
          inv.status !== "cancelled" &&
          inv.status !== "paid"
      );
    }

    return NextResponse.json({ invoices: rows });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
  });
  if ("error" in auth) {
    return auth.error;
  }

  if (!isInternalBillingStaffRole(auth.role)) {
    return NextResponse.json({ error: "Billing is limited to platform billing staff." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const customer_id = String(body.customer_id ?? "").trim();
  const company_id = String(body.company_id ?? "").trim();
  const issue_date = parseYmd(body.issue_date);
  const due_date = parseYmd(body.due_date);
  const status = String(body.status ?? "draft").trim().toLowerCase() as InvoiceStatus;

  if (!customer_id || !company_id || !issue_date || !due_date) {
    return NextResponse.json(
      { error: "customer_id, company_id, issue_date, and due_date are required." },
      { status: 400 }
    );
  }

  if (due_date < issue_date) {
    return NextResponse.json({ error: "due_date must be on or after issue_date." }, { status: 400 });
  }

  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const line_items = normalizeLineItems(body.line_items);
  if (status !== "draft" && line_items.length === 0) {
    return NextResponse.json(
      { error: "At least one line item is required unless saving as draft." },
      { status: 400 }
    );
  }

  try {
    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId: company_id,
    });

    const { data: customer, error: custErr } = await auth.supabase
      .from("billing_customers")
      .select("id, company_id")
      .eq("id", customer_id)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    if (customer.company_id !== company_id) {
      return NextResponse.json(
        { error: "customer_id does not belong to the given company_id." },
        { status: 400 }
      );
    }

    const discount_cents = Math.max(0, Math.floor(Number(body.discount_cents ?? 0)));
    const tax_rate_bps = Math.max(0, Math.floor(Number(body.tax_rate_bps ?? 0)));

    const totals = computeInvoiceTotals({
      lineItems: line_items,
      discountCents: discount_cents,
      taxRateBps: tax_rate_bps,
    });

    const { data: invoiceNumber, error: numErr } = await auth.supabase.rpc(
      "billing_generate_invoice_number"
    );

    if (numErr || !invoiceNumber || typeof invoiceNumber !== "string") {
      return NextResponse.json(
        { error: numErr?.message || "Failed to generate invoice number." },
        { status: 500 }
      );
    }

    const currency = String(body.currency ?? "usd").trim().toLowerCase() || "usd";
    const amount_paid_cents = 0;
    const balance_due_cents = computeBalanceDue(totals.total_cents, amount_paid_cents);

    const { data: invoice, error: invErr } = await auth.supabase
      .from("billing_invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id,
        company_id,
        status,
        issue_date,
        due_date,
        subtotal_cents: totals.subtotal_cents,
        tax_cents: totals.tax_cents,
        discount_cents: totals.discount_cents,
        total_cents: totals.total_cents,
        amount_paid_cents,
        balance_due_cents,
        currency,
        notes: body.notes == null ? null : String(body.notes),
        terms: body.terms == null ? null : String(body.terms),
        created_by_user_id: auth.user.id,
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : {},
      })
      .select()
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: invErr?.message || "Insert failed." }, { status: 500 });
    }

    const invoiceId = invoice.id as string;

    if (line_items.length > 0) {
      const rows = line_items.map((li, index) => ({
        invoice_id: invoiceId,
        sort_order: li.sort_order ?? index,
        item_type: li.item_type ?? "custom",
        description: li.description,
        quantity: li.quantity,
        unit_price_cents: li.unit_price_cents,
        line_total_cents: computeLineTotalCents(li.quantity, li.unit_price_cents),
        metadata: li.metadata ?? {},
      }));

      const { error: liErr } = await auth.supabase.from("billing_invoice_line_items").insert(rows);
      if (liErr) {
        await auth.supabase.from("billing_invoices").delete().eq("id", invoiceId);
        return NextResponse.json({ error: liErr.message }, { status: 500 });
      }
    }

    await recordBillingEvent(auth.supabase, {
      invoice_id: invoiceId,
      event_type: "created",
      created_by_user_id: auth.user.id,
      event_data: { invoice_number: invoiceNumber, status },
    });

    const { data: full } = await auth.supabase
      .from("billing_invoices")
      .select("*, billing_invoice_line_items(*)")
      .eq("id", invoiceId)
      .single();

    return NextResponse.json({ invoice: full });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
