import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeRequest } from "@/lib/rbac";
import {
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import {
  addUtcDaysToYmd,
  buildCompanyBillingLineItems,
  buildCompanyBillingNote,
} from "@/lib/billing/companyInvoiceDraft";
import {
  computeBalanceDue,
  computeInvoiceTotals,
  computeLineTotalCents,
} from "@/lib/billing/invoiceTotals";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import { getCompanySeatCounts, normalizeCompanySubscriptionStatus } from "@/lib/companySeats";
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
      item_type: ([
        "subscription",
        "document_review",
        "credit_pack",
        "consulting",
        "custom",
      ].includes(item_type)
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

function normalizeStatus(value: unknown): InvoiceStatus {
  const status = String(value ?? "draft").trim().toLowerCase();
  return (STATUSES.has(status) ? status : "draft") as InvoiceStatus;
}

function buildCombinedLineItems(
  companyLineItems: LineItemInput[],
  manualLineItems: LineItemInput[]
): LineItemInput[] {
  return [...companyLineItems, ...manualLineItems].map((item, index) => ({
    ...item,
    sort_order: item.sort_order ?? index,
  }));
}

async function getBillableCustomer(params: {
  supabase: SupabaseClient;
  companyId: string;
  companyName: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  requestedCustomerId?: string | null;
  createIfMissing?: boolean;
}) {
  const { supabase, companyId, companyName, primaryContactEmail, primaryContactName, requestedCustomerId } =
    params;

  if (requestedCustomerId) {
    const { data, error } = await supabase
      .from("billing_customers")
      .select("id, company_id, company_name, billing_email")
      .eq("id", requestedCustomerId)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data || (data as { company_id?: string }).company_id !== companyId) {
      return { data: null, error: "Customer not found for this company." };
    }

    return { data, error: null as string | null };
  }

  const existing = await supabase
    .from("billing_customers")
    .select("id, company_id, company_name, billing_email")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: existing.error.message ?? "Failed to load billing customer." };
  }

  if (existing.data) {
    return { data: existing.data, error: null as string | null };
  }

  if (!params.createIfMissing) {
    return {
      data: null,
      error: "No billing customer exists yet for this company.",
    };
  }

  const billingEmail = String(primaryContactEmail ?? "").trim().toLowerCase();
  if (!billingEmail) {
    return {
      data: null,
      error:
        "No billing customer exists yet. Add a billing contact email on the company or create a billing customer first.",
    };
  }

  const created = await supabase
    .from("billing_customers")
    .insert({
      company_id: companyId,
      company_name: companyName,
      billing_contact_name: primaryContactName || null,
      billing_email: billingEmail,
    })
    .select("id, company_id, company_name, billing_email")
    .single();

  if (created.error || !created.data) {
    return { data: null, error: created.error?.message ?? "Failed to create billing customer." };
  }

  return { data: created.data, error: null as string | null };
}

async function loadCompanyBillingPreview(auth: {
  supabase: SupabaseClient;
  role: string;
  user: { id: string };
}, companyId: string) {
  const companyLookup = await auth.supabase
    .from("companies")
    .select("id, name, team_key, primary_contact_name, primary_contact_email")
    .eq("id", companyId)
    .maybeSingle();

  if (companyLookup.error) {
    return { error: companyLookup.error.message || "Failed to load company." };
  }

  const company = companyLookup.data as
    | {
        id: string;
        name: string | null;
        team_key: string | null;
        primary_contact_name: string | null;
        primary_contact_email: string | null;
      }
    | null;

  if (!company?.id) {
    return { error: "Company workspace not found." };
  }

  const subscriptionResult = await auth.supabase
    .from("company_subscriptions")
    .select(
      "status, plan_name, credit_balance, max_user_seats, subscription_price_cents, seat_price_cents"
    )
    .eq("company_id", companyId)
    .maybeSingle();

  if (subscriptionResult.error) {
    return { error: subscriptionResult.error.message || "Failed to load company subscription." };
  }

  const subscription = subscriptionResult.data as
    | {
        status?: string | null;
        plan_name?: string | null;
        credit_balance?: number | null;
        max_user_seats?: number | null;
        subscription_price_cents?: number | null;
        seat_price_cents?: number | null;
      }
    | null;

  if (!subscription) {
    return { error: "Company subscription not configured yet." };
  }

  const seatCounts = await getCompanySeatCounts(auth.supabase, companyId);
  if (seatCounts.error) {
    return { error: seatCounts.error };
  }

  const companyName = company.name?.trim() || company.team_key?.trim() || "Company Workspace";
  const planName = subscription.plan_name?.trim() || "Pro";
  const billingCustomerLookup = await getBillableCustomer({
    supabase: auth.supabase,
    companyId,
    companyName,
    primaryContactName: company.primary_contact_name,
    primaryContactEmail: company.primary_contact_email,
    createIfMissing: false,
  });

  if (
    billingCustomerLookup.error &&
    billingCustomerLookup.error !== "No billing customer exists yet for this company."
  ) {
    return { error: billingCustomerLookup.error };
  }

  const lineItems = buildCompanyBillingLineItems({
    companyName,
    planName,
    subscriptionPriceCents:
      subscription.subscription_price_cents != null
        ? Number(subscription.subscription_price_cents)
        : null,
    seatPriceCents:
      subscription.seat_price_cents != null ? Number(subscription.seat_price_cents) : null,
    seatsUsed: seatCounts.seatsUsed,
    membershipSeats: seatCounts.membershipSeats,
    pendingInviteCount: seatCounts.pendingInvites,
  });

  const totals = computeInvoiceTotals({ lineItems });

  return {
    company,
    companyName,
    subscription: {
      status: normalizeCompanySubscriptionStatus(subscription.status ?? null),
      planName,
      creditBalance:
        subscription.credit_balance != null ? Number(subscription.credit_balance) : null,
      maxUserSeats:
        subscription.max_user_seats != null ? Number(subscription.max_user_seats) : null,
      subscriptionPriceCents:
        subscription.subscription_price_cents != null
          ? Number(subscription.subscription_price_cents)
          : null,
      seatPriceCents:
        subscription.seat_price_cents != null ? Number(subscription.seat_price_cents) : null,
      seatsUsed: seatCounts.seatsUsed,
      membershipSeats: seatCounts.membershipSeats,
      pendingInviteCount: seatCounts.pendingInvites,
    },
    billingCustomer: billingCustomerLookup.data ?? null,
    lineItems,
    totals,
    canGenerate: lineItems.length > 0,
  };
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
  const companyId = url.searchParams.get("company_id")?.trim() ?? "";
  if (!companyId) {
    return NextResponse.json({ error: "company_id is required." }, { status: 400 });
  }

  try {
    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId,
    });

    const preview = await loadCompanyBillingPreview(auth, companyId);
    if ("error" in preview) {
      return NextResponse.json({ error: preview.error }, { status: 400 });
    }

    return NextResponse.json({
      company: {
        id: preview.company.id,
        name: preview.companyName,
      },
      billingCustomer: preview.billingCustomer,
      subscription: preview.subscription,
      lineItems: preview.lineItems,
      totals: preview.totals,
      canGenerate: preview.canGenerate,
    });
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

  const companyId = String(body.company_id ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "company_id is required." }, { status: 400 });
  }

  const requestedCustomerId = String(body.customer_id ?? "").trim();
  const issue_date = parseYmd(body.issue_date) ?? new Date().toISOString().slice(0, 10);
  const due_date = parseYmd(body.due_date) ?? addUtcDaysToYmd(issue_date, 30);
  const status = normalizeStatus(body.status);
  const discount_cents = Math.max(0, Math.floor(Number(body.discount_cents ?? 0)));
  const tax_rate_bps = Math.max(0, Math.floor(Number(body.tax_rate_bps ?? 0)));
  const extraLineItems = normalizeLineItems(body.line_items);

  if (due_date < issue_date) {
    return NextResponse.json({ error: "due_date must be on or after issue_date." }, { status: 400 });
  }

  try {
    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId,
    });

    const preview = await loadCompanyBillingPreview(auth, companyId);
    if ("error" in preview) {
      return NextResponse.json({ error: preview.error }, { status: 400 });
    }

    const customer = await getBillableCustomer({
      supabase: auth.supabase,
      companyId,
      companyName: preview.companyName,
      primaryContactName: preview.company.primary_contact_name,
      primaryContactEmail: preview.company.primary_contact_email,
      requestedCustomerId: requestedCustomerId || undefined,
      createIfMissing: true,
    });

    if (customer.error || !customer.data) {
      return NextResponse.json({ error: customer.error || "Billing customer not available." }, { status: 400 });
    }

    const lineItems = buildCombinedLineItems(preview.lineItems, extraLineItems);
    if (lineItems.length === 0) {
      return NextResponse.json(
        {
          error:
            "No billable line items were generated. Configure company subscription and seat pricing first.",
        },
        { status: 400 }
      );
    }

    const totals = computeInvoiceTotals({
      lineItems,
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

    const amount_paid_cents = 0;
    const balance_due_cents = computeBalanceDue(totals.total_cents, amount_paid_cents);
    const notes =
      body.notes == null || String(body.notes).trim() === ""
        ? buildCompanyBillingNote({
            companyName: preview.companyName,
            planName: preview.subscription.planName,
            seatsUsed: preview.subscription.seatsUsed,
          })
        : String(body.notes);
    const terms = body.terms == null ? "Net 30" : String(body.terms);
    const currency = String(body.currency ?? "usd").trim().toLowerCase() || "usd";

    const { data: invoice, error: invoiceErr } = await auth.supabase
      .from("billing_invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: customer.data.id,
        company_id: companyId,
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
        notes,
        terms,
        created_by_user_id: auth.user.id,
        metadata: {
          ...(body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : {}),
          billing_mode: "company_pricing",
          company_name: preview.companyName,
          plan_name: preview.subscription.planName,
          seats_used: preview.subscription.seatsUsed,
          membership_seats: preview.subscription.membershipSeats,
          pending_invites: preview.subscription.pendingInviteCount,
          generated_from_company_subscription: true,
        },
      })
      .select()
      .single();

    if (invoiceErr || !invoice) {
      return NextResponse.json({ error: invoiceErr?.message || "Insert failed." }, { status: 500 });
    }

    const invoiceId = invoice.id as string;
    const rows = lineItems.map((li, index) => ({
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

    await recordBillingEvent(auth.supabase, {
      invoice_id: invoiceId,
      event_type: "created",
      created_by_user_id: auth.user.id,
      event_data: {
        invoice_number: invoiceNumber,
        status,
        billing_mode: "company_pricing",
      },
    });

    const { data: full } = await auth.supabase
      .from("billing_invoices")
      .select("*, billing_invoice_line_items(*)")
      .eq("id", invoiceId)
      .single();

    return NextResponse.json({
      invoice: full,
      billingCustomer: customer.data,
      preview: {
        lineItems: preview.lineItems,
        totals: preview.totals,
      },
    });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
