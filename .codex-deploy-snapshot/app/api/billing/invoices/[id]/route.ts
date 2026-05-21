import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import {
  assertInvoiceMutableForEdit,
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import {
  computeBalanceDue,
  computeInvoiceTotals,
  computeLineTotalCents,
} from "@/lib/billing/invoiceTotals";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import type { LineItemInput } from "@/lib/billing/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function parseYmd(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  return s;
}

function normalizeLineItems(raw: unknown): LineItemInput[] | null {
  if (raw === undefined) {
    return null;
  }
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

export async function GET(request: Request, context: RouteContext) {
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
      .select("*, billing_invoice_line_items(*), billing_customers(*), companies(name)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId: invoice.company_id as string,
    });

    const { data: payments } = await auth.supabase
      .from("billing_invoice_payments")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false });

    const { data: events } = await auth.supabase
      .from("billing_events")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      invoice,
      payments: payments ?? [],
      events: events ?? [],
    });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const { data: existing, error: loadErr } = await auth.supabase
      .from("billing_invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadErr || !existing) {
      return NextResponse.json({ error: loadErr?.message || "Not found." }, { status: 404 });
    }

    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId: existing.company_id as string,
    });

    assertInvoiceMutableForEdit({
      status: String(existing.status),
      role: normalizeAppRole(auth.role),
    });

    const nextStatus = body.status != null ? String(body.status).trim().toLowerCase() : null;
    const issue_date =
      body.issue_date !== undefined ? parseYmd(body.issue_date) : (existing.issue_date as string);
    const due_date =
      body.due_date !== undefined ? parseYmd(body.due_date) : (existing.due_date as string);

    if (!issue_date || !due_date) {
      return NextResponse.json({ error: "Invalid dates." }, { status: 400 });
    }
    if (due_date < issue_date) {
      return NextResponse.json({ error: "due_date must be on or after issue_date." }, { status: 400 });
    }

    const lineItemsRaw = normalizeLineItems(body.line_items);
    const line_items =
      body.line_items === undefined ? null : lineItemsRaw;

    if (line_items && line_items.length === 0 && (nextStatus ?? existing.status) !== "draft") {
      return NextResponse.json(
        { error: "At least one line item is required unless status is draft." },
        { status: 400 }
      );
    }

    const discount_cents =
      body.discount_cents !== undefined
        ? Math.max(0, Math.floor(Number(body.discount_cents)))
        : (existing.discount_cents as number);
    const tax_rate_bps =
      body.tax_rate_bps !== undefined
        ? Math.max(0, Math.floor(Number(body.tax_rate_bps)))
        : undefined;

    let subtotal_cents = existing.subtotal_cents as number;
    let tax_cents = existing.tax_cents as number;
    let total_cents = existing.total_cents as number;

    if (line_items !== null) {
      const totals = computeInvoiceTotals({
        lineItems: line_items,
        discountCents: discount_cents,
        taxRateBps: tax_rate_bps ?? 0,
      });
      subtotal_cents = totals.subtotal_cents;
      tax_cents = totals.tax_cents;
      total_cents = totals.total_cents;

      const { error: delErr } = await auth.supabase
        .from("billing_invoice_line_items")
        .delete()
        .eq("invoice_id", id);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      if (line_items.length > 0) {
        const rows = line_items.map((li, index) => ({
          invoice_id: id,
          sort_order: li.sort_order ?? index,
          item_type: li.item_type ?? "custom",
          description: li.description,
          quantity: li.quantity,
          unit_price_cents: li.unit_price_cents,
          line_total_cents: computeLineTotalCents(li.quantity, li.unit_price_cents),
          metadata: li.metadata ?? {},
        }));
        const { error: insErr } = await auth.supabase.from("billing_invoice_line_items").insert(rows);
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
      }
    } else if (tax_rate_bps !== undefined) {
      const { data: currentLines } = await auth.supabase
        .from("billing_invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("sort_order", { ascending: true });

      const mapped: LineItemInput[] = (currentLines ?? []).map(
        (r: {
          description?: string;
          quantity?: number;
          unit_price_cents?: number;
          item_type?: string;
          sort_order?: number;
          metadata?: Record<string, unknown>;
        }) => ({
          description: String(r.description ?? ""),
          quantity: Number(r.quantity ?? 1),
          unit_price_cents: Math.floor(Number(r.unit_price_cents ?? 0)),
          item_type: (String(r.item_type ?? "custom") as LineItemInput["item_type"]) ?? "custom",
          sort_order: r.sort_order,
          metadata: r.metadata,
        })
      );
      const totals = computeInvoiceTotals({
        lineItems: mapped,
        discountCents: discount_cents,
        taxRateBps: tax_rate_bps,
      });
      subtotal_cents = totals.subtotal_cents;
      tax_cents = totals.tax_cents;
      total_cents = totals.total_cents;
    }

    const amount_paid_cents = existing.amount_paid_cents as number;
    const balance_due_cents = computeBalanceDue(total_cents, amount_paid_cents);

    const patch: Record<string, unknown> = {
      issue_date,
      due_date,
      subtotal_cents,
      tax_cents,
      discount_cents,
      total_cents,
      balance_due_cents,
      notes: body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : undefined,
      terms: body.terms !== undefined ? (body.terms == null ? null : String(body.terms)) : undefined,
    };

    if (nextStatus) {
      patch.status = nextStatus;
    }

    if (body.metadata !== undefined && body.metadata !== null && typeof body.metadata === "object") {
      patch.metadata = body.metadata;
    }

    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) {
        delete patch[k];
      }
    });

    const { data: updated, error: upErr } = await auth.supabase
      .from("billing_invoices")
      .update(patch)
      .eq("id", id)
      .select("*, billing_invoice_line_items(*)")
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Update failed." }, { status: 500 });
    }

    await recordBillingEvent(auth.supabase, {
      invoice_id: id,
      event_type: "updated",
      created_by_user_id: auth.user.id,
      event_data: { fields: Object.keys(body) },
    });

    return NextResponse.json({ invoice: updated });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
