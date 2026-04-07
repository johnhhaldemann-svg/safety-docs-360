import type { SupabaseClient } from "@supabase/supabase-js";
import { addUtcDaysToYmd, buildCompanyBillingLineItems, buildCompanyBillingNote } from "@/lib/billing/companyInvoiceDraft";
import { computeBalanceDue, computeInvoiceTotals, computeLineTotalCents } from "@/lib/billing/invoiceTotals";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import { normalizeApprovalPlanName } from "@/lib/workspaceProduct";
import { getCompanySeatCounts, normalizeCompanySubscriptionStatus } from "@/lib/companySeats";
import type { InvoiceStatus, LineItemInput } from "@/lib/billing/types";

export type RecurringBillingPeriod = {
  key: string;
  startYmd: string;
  endYmd: string;
};

export type RecurringCompanyInvoiceResult =
  | {
      status: "created";
      companyId: string;
      invoiceId: string;
      invoiceNumber: string;
      billingPeriodKey: string;
    }
  | {
      status: "skipped";
      companyId: string;
      billingPeriodKey: string;
      reason: string;
      existingInvoiceId?: string;
      existingInvoiceNumber?: string;
    }
  | {
      status: "error";
      companyId?: string;
      billingPeriodKey?: string;
      reason: string;
    };

export function getUtcYmd(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getRecurringBillingPeriod(date = new Date()): RecurringBillingPeriod {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    startYmd: start.toISOString().slice(0, 10),
    endYmd: end.toISOString().slice(0, 10),
  };
}

export async function resolveRecurringBillingActorId(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["super_admin", "platform_admin"])
    .eq("account_status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { userId: null as string | null, error: error.message || "Failed to resolve billing actor." };
  }

  const userId = (data as { user_id?: string } | null)?.user_id?.trim() || null;
  if (!userId) {
    return { userId: null as string | null, error: "No active internal admin user is available to own recurring invoices." };
  }

  return { userId, error: null as string | null };
}

async function getOrCreateBillingCustomer(params: {
  supabase: SupabaseClient;
  companyId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  requestedCustomerId?: string | null;
}) {
  const { supabase, companyId, companyName, contactEmail, contactName, requestedCustomerId } = params;

  if (requestedCustomerId) {
    const { data, error } = await supabase
      .from("billing_customers")
      .select("id, company_id, company_name, billing_email")
      .eq("id", requestedCustomerId)
      .maybeSingle();

    if (error) {
      return { customer: null as { id: string } | null, error: error.message || "Failed to load billing customer." };
    }

    if (!data || (data as { company_id?: string }).company_id !== companyId) {
      return { customer: null as { id: string } | null, error: "Customer not found for this company." };
    }

    return { customer: data as { id: string }, error: null as string | null };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("billing_customers")
    .select("id, company_id, company_name, billing_email")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    return {
      customer: null as { id: string } | null,
      error: existingErr.message || "Failed to load billing customer.",
    };
  }

  if (existing) {
    return { customer: existing as { id: string }, error: null as string | null };
  }

  const billingEmail = String(contactEmail ?? "").trim().toLowerCase();
  if (!billingEmail) {
    return {
      customer: null as { id: string } | null,
      error:
        "No billing customer exists yet. Add a billing contact email on the company or create a billing customer first.",
    };
  }

  const { data: created, error: createErr } = await supabase
    .from("billing_customers")
    .insert({
      company_id: companyId,
      company_name: companyName,
      billing_contact_name: contactName || null,
      billing_email: billingEmail,
    })
    .select("id, company_id, company_name, billing_email")
    .single();

  if (createErr || !created) {
    return {
      customer: null as { id: string } | null,
      error: createErr?.message || "Failed to create billing customer.",
    };
  }

  return { customer: created as { id: string }, error: null as string | null };
}

export async function createRecurringCompanyInvoice(params: {
  supabase: SupabaseClient;
  companyId: string;
  createdByUserId: string;
  issueDateYmd?: string;
  dueDateYmd?: string;
  taxRateBps?: number;
  discountCents?: number;
  status?: InvoiceStatus;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  requestedCustomerId?: string | null;
  extraLineItems?: LineItemInput[];
  billingSource?: "recurring_company_pricing" | "company_pricing";
}): Promise<RecurringCompanyInvoiceResult> {
  const {
    supabase,
    companyId,
    createdByUserId,
    requestedCustomerId,
    extraLineItems = [],
  } = params;
  const period = getRecurringBillingPeriod();

  const companyLookup = await supabase
    .from("companies")
    .select("id, name, team_key, primary_contact_name, primary_contact_email, status")
    .eq("id", companyId)
    .maybeSingle();

  if (companyLookup.error) {
    return { status: "error", companyId, reason: companyLookup.error.message || "Failed to load company." };
  }

  const company = companyLookup.data as
    | {
        id: string;
        name: string | null;
        team_key: string | null;
        primary_contact_name: string | null;
        primary_contact_email: string | null;
        status: string | null;
      }
    | null;

  if (!company?.id) {
    return { status: "error", companyId, billingPeriodKey: period.key, reason: "Company workspace not found." };
  }

  const subscriptionResult = await supabase
    .from("company_subscriptions")
    .select(
      "status, plan_name, credit_balance, max_user_seats, subscription_price_cents, seat_price_cents"
    )
    .eq("company_id", companyId)
    .maybeSingle();

  if (subscriptionResult.error) {
    return {
      status: "error",
      companyId,
      reason: subscriptionResult.error.message || "Failed to load company subscription.",
    };
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
    return { status: "skipped", companyId, billingPeriodKey: period.key, reason: "Company subscription is not configured yet." };
  }

  if (normalizeCompanySubscriptionStatus(subscription.status ?? null) !== "active") {
    return {
      status: "skipped",
      companyId,
      billingPeriodKey: period.key,
      reason: "Company subscription is not active.",
    };
  }
  const billingSource = params.billingSource ?? "recurring_company_pricing";

  const existingInvoice = await supabase
    .from("billing_invoices")
    .select("id, invoice_number")
    .eq("company_id", companyId)
    .eq("billing_source", billingSource)
    .eq("billing_period_key", period.key)
    .maybeSingle();

  if (existingInvoice.error) {
    return {
      status: "error",
      companyId,
      billingPeriodKey: period.key,
      reason: existingInvoice.error.message || "Failed to check existing recurring invoice.",
    };
  }

  if (existingInvoice.data) {
    const row = existingInvoice.data as { id?: string; invoice_number?: string };
    return {
      status: "skipped",
      companyId,
      billingPeriodKey: period.key,
      existingInvoiceId: row.id ?? undefined,
      existingInvoiceNumber: row.invoice_number ?? undefined,
      reason: "Recurring invoice already exists for this billing period.",
    };
  }

  const seatCounts = await getCompanySeatCounts(supabase, companyId);
  if (seatCounts.error) {
    return { status: "error", companyId, billingPeriodKey: period.key, reason: seatCounts.error };
  }

  const companyName = company.name?.trim() || company.team_key?.trim() || "Company Workspace";
  const planName = normalizeApprovalPlanName(subscription.plan_name ?? null);
  const billingCustomer = await getOrCreateBillingCustomer({
    supabase,
    companyId,
    companyName,
    contactName: company.primary_contact_name,
    contactEmail: company.primary_contact_email,
    requestedCustomerId,
  });

  if (billingCustomer.error || !billingCustomer.customer) {
    return {
      status: "skipped",
      companyId,
      billingPeriodKey: period.key,
      reason: billingCustomer.error || "No billing customer available.",
    };
  }

  const recurringLineItems = buildCompanyBillingLineItems({
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

  const lineItems = [...recurringLineItems, ...extraLineItems].map((item, index) => ({
    ...item,
    sort_order: item.sort_order ?? index,
  }));

  if (lineItems.length === 0) {
    return {
      status: "skipped",
      companyId,
      billingPeriodKey: period.key,
      reason: "No billable line items were generated.",
    };
  }

  const issueDateYmd = params.issueDateYmd ?? getUtcYmd();
  const dueDateYmd = params.dueDateYmd ?? addUtcDaysToYmd(issueDateYmd, 30);
  const discountCents = Math.max(0, Math.floor(params.discountCents ?? 0));
  const taxRateBps = Math.max(0, Math.floor(params.taxRateBps ?? 0));
  const status = params.status ?? "draft";
  const currency = String(params.currency ?? "usd").trim().toLowerCase() || "usd";

  const totals = computeInvoiceTotals({
    lineItems,
    discountCents,
    taxRateBps,
  });

  const { data: invoiceNumber, error: numErr } = await supabase.rpc("billing_generate_invoice_number");
  if (numErr || !invoiceNumber || typeof invoiceNumber !== "string") {
    return {
      status: "error",
      companyId,
      billingPeriodKey: period.key,
      reason: numErr?.message || "Failed to generate invoice number.",
    };
  }

  const amountPaidCents = 0;
  const balanceDueCents = computeBalanceDue(totals.total_cents, amountPaidCents);
  const notes =
    params.notes == null || String(params.notes).trim() === ""
      ? buildCompanyBillingNote({
          companyName,
          planName,
          seatsUsed: seatCounts.seatsUsed,
        })
      : String(params.notes);

  const insertResult = await supabase
    .from("billing_invoices")
    .insert({
      invoice_number: invoiceNumber,
      customer_id: billingCustomer.customer.id,
      company_id: companyId,
      status,
      issue_date: issueDateYmd,
      due_date: dueDateYmd,
      subtotal_cents: totals.subtotal_cents,
      tax_cents: totals.tax_cents,
      discount_cents: totals.discount_cents,
      total_cents: totals.total_cents,
      amount_paid_cents: amountPaidCents,
      balance_due_cents: balanceDueCents,
      currency,
      notes,
      terms: params.terms == null ? "Net 30" : String(params.terms),
      created_by_user_id: createdByUserId,
      billing_source: billingSource,
      billing_period_key: period.key,
      billing_period_start: period.startYmd,
      billing_period_end: period.endYmd,
      metadata: {
        billing_mode: billingSource,
        company_name: companyName,
        plan_name: planName,
        seats_used: seatCounts.seatsUsed,
        membership_seats: seatCounts.membershipSeats,
        pending_invites: seatCounts.pendingInvites,
        generated_from_company_subscription: true,
      },
    })
    .select()
    .single();

  if (insertResult.error || !insertResult.data) {
    const conflictLike =
      insertResult.error?.code === "23505" ||
      /duplicate key|unique constraint/i.test(insertResult.error?.message ?? "");
    if (conflictLike) {
      const existing = await supabase
        .from("billing_invoices")
        .select("id, invoice_number")
        .eq("company_id", companyId)
        .eq("billing_source", billingSource)
        .eq("billing_period_key", period.key)
        .maybeSingle();

      if (existing.data) {
        const row = existing.data as { id?: string; invoice_number?: string };
        return {
          status: "skipped",
          companyId,
          billingPeriodKey: period.key,
          existingInvoiceId: row.id ?? undefined,
          existingInvoiceNumber: row.invoice_number ?? undefined,
          reason: "Recurring invoice already exists for this billing period.",
        };
      }
    }

    return {
      status: "error",
      companyId,
      billingPeriodKey: period.key,
      reason: insertResult.error?.message || "Insert failed.",
    };
  }

  const invoiceId = (insertResult.data as { id: string }).id;
  const lineRows = lineItems.map((li, index) => ({
    invoice_id: invoiceId,
    sort_order: li.sort_order ?? index,
    item_type: li.item_type ?? "custom",
    description: li.description,
    quantity: li.quantity,
    unit_price_cents: li.unit_price_cents,
    line_total_cents: computeLineTotalCents(li.quantity, li.unit_price_cents),
    metadata: li.metadata ?? {},
  }));

  const { error: liErr } = await supabase.from("billing_invoice_line_items").insert(lineRows);
  if (liErr) {
    await supabase.from("billing_invoices").delete().eq("id", invoiceId);
    return {
      status: "error",
      companyId,
      billingPeriodKey: period.key,
      reason: liErr.message || "Failed to insert invoice line items.",
    };
  }

  await recordBillingEvent(supabase, {
    invoice_id: invoiceId,
    event_type: "created",
    created_by_user_id: createdByUserId,
    event_data: {
      invoice_number: invoiceNumber,
      status,
      billing_mode: billingSource,
      billing_period_key: period.key,
    },
  });

  return {
    status: "created",
    companyId,
    invoiceId,
    invoiceNumber,
    billingPeriodKey: period.key,
  };
}
