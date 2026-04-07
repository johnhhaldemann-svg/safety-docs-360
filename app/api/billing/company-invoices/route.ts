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
} from "@/lib/billing/companyInvoiceDraft";
import { createRecurringCompanyInvoice } from "@/lib/billing/recurringCompanyBilling";
import {
  computeInvoiceTotals,
} from "@/lib/billing/invoiceTotals";
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

    const result = await createRecurringCompanyInvoice({
      supabase: auth.supabase,
      companyId,
      createdByUserId: auth.user.id,
      issueDateYmd: issue_date,
      dueDateYmd: due_date,
      taxRateBps: tax_rate_bps,
      discountCents: discount_cents,
      status,
      currency: String(body.currency ?? "usd").trim().toLowerCase() || "usd",
      notes: body.notes == null ? null : String(body.notes),
      terms: body.terms == null ? null : String(body.terms),
      requestedCustomerId: requestedCustomerId || undefined,
      extraLineItems,
      billingSource: "recurring_company_pricing",
    });

    if (result.status === "created") {
      const { data: full } = await auth.supabase
        .from("billing_invoices")
        .select("*, billing_invoice_line_items(*)")
        .eq("id", result.invoiceId)
        .single();

      return NextResponse.json({
        invoice: full,
        message: "Recurring company billing draft created.",
      });
    }

    if (result.status === "skipped" && result.existingInvoiceId) {
      const { data: full } = await auth.supabase
        .from("billing_invoices")
        .select("*, billing_invoice_line_items(*)")
        .eq("id", result.existingInvoiceId)
        .single();

      return NextResponse.json({
        invoice: full,
        message: result.reason,
        skipped: true,
      });
    }

    return NextResponse.json({ error: result.reason }, { status: result.status === "error" ? 500 : 400 });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
