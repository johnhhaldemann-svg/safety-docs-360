import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { computeBalanceDue, computeLineTotalCents } from "@/lib/billing/invoiceTotals";
import { getMarketplaceCreditPack } from "@/lib/billing/marketplaceCreditPacks";
import { createAndStoreStripeCheckoutSession, getStripe } from "@/lib/billing/stripeCheckout";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  listCreditTransactions,
  purchasedDocumentIdsFromTransactions,
  sumCreditBalance,
} from "@/lib/credits";
import { resolveAppBaseUrl } from "@/lib/billing/resolveAppBaseUrl";

export const runtime = "nodejs";

type BuyCreditsPayload = {
  packId?: string;
};

type CompanyRow = {
  id: string;
  name: string | null;
  team_key: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
};

type BillingCustomerRow = {
  id: string;
  company_id: string;
  company_name: string;
  billing_contact_name: string | null;
  billing_email: string;
  stripe_customer_id: string | null;
};

async function getOrCreateBillingCustomer(params: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  companyId: string;
  companyName: string;
  billingContactName: string | null;
  billingEmail: string;
}) {
  const { admin, companyId, companyName, billingContactName, billingEmail } = params;

  const { data: existing, error: existingErr } = await admin
    .from("billing_customers")
    .select("id, company_id, company_name, billing_contact_name, billing_email, stripe_customer_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    return { customer: null as BillingCustomerRow | null, error: existingErr.message };
  }

  if (existing) {
    return { customer: existing as BillingCustomerRow, error: null as string | null };
  }

  if (!billingEmail) {
    return {
      customer: null as BillingCustomerRow | null,
      error: "No billing email is available for this company.",
    };
  }

  const { data: created, error: createErr } = await admin
    .from("billing_customers")
    .insert({
      company_id: companyId,
      company_name: companyName,
      billing_contact_name: billingContactName,
      billing_email: billingEmail,
    })
    .select("id, company_id, company_name, billing_contact_name, billing_email, stripe_customer_id")
    .single();

  if (createErr || !created) {
    return {
      customer: null as BillingCustomerRow | null,
      error: createErr?.message || "Failed to create billing customer.",
    };
  }

  return { customer: created as BillingCustomerRow, error: null as string | null };
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_manage_billing",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => null)) as BuyCreditsPayload | null;
  const packId = body?.packId?.trim().toLowerCase() ?? "";
  const selectedPack = getMarketplaceCreditPack(packId);

  if (!selectedPack) {
    return NextResponse.json(
      { error: "A valid credit pack is required." },
      { status: 400 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (companyScope.companyId) {
    const admin = createSupabaseAdminClient();
    const stripe = getStripe();

    if (!admin) {
      return NextResponse.json(
        { error: "Billing is not configured for company credit purchases." },
        { status: 503 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured for marketplace credit purchases." },
        { status: 503 }
      );
    }

    const { data: companyRow, error: companyErr } = await admin
      .from("companies")
      .select("id, name, team_key, primary_contact_name, primary_contact_email")
      .eq("id", companyScope.companyId)
      .maybeSingle();

    if (companyErr || !companyRow) {
      return NextResponse.json(
        { error: companyErr?.message || "Company workspace not found." },
        { status: 404 }
      );
    }

    const company = companyRow as CompanyRow;
    const companyName = company.name?.trim() || company.team_key?.trim() || "Company Workspace";
    const contactEmail =
      company.primary_contact_email?.trim().toLowerCase() || auth.user.email?.trim().toLowerCase() || "";
    const contactName = company.primary_contact_name?.trim() || auth.user.email?.trim() || null;

    const billingCustomer = await getOrCreateBillingCustomer({
      admin,
      companyId: companyScope.companyId,
      companyName,
      billingContactName: contactName,
      billingEmail: contactEmail,
    });

    if (billingCustomer.error || !billingCustomer.customer) {
      return NextResponse.json(
        { error: billingCustomer.error || "Failed to load company billing customer." },
        { status: 400 }
      );
    }

    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate = issueDate;
    const total_cents = selectedPack.priceCents;
    const balance_due_cents = computeBalanceDue(total_cents, 0);
    const currency = "usd";
    const { data: invoiceNumber, error: invoiceNumberErr } = await admin.rpc(
      "billing_generate_invoice_number"
    );

    if (invoiceNumberErr || !invoiceNumber || typeof invoiceNumber !== "string") {
      return NextResponse.json(
        { error: invoiceNumberErr?.message || "Failed to generate invoice number." },
        { status: 500 }
      );
    }

    const { data: invoice, error: invoiceErr } = await admin
      .from("billing_invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: billingCustomer.customer.id,
        company_id: companyScope.companyId,
        status: "sent",
        issue_date: issueDate,
        due_date: dueDate,
        subtotal_cents: total_cents,
        tax_cents: 0,
        discount_cents: 0,
        total_cents,
        amount_paid_cents: 0,
        balance_due_cents,
        currency,
        notes: `Marketplace credit pack purchase: ${selectedPack.label}`,
        terms: "Due on receipt",
        created_by_user_id: auth.user.id,
        payment_provider: "stripe",
        billing_source: "marketplace_credit_pack",
        metadata: {
          billing_mode: "marketplace_credit_pack",
          credit_pack_id: selectedPack.id,
          credit_pack_label: selectedPack.label,
          credit_pack_credits: selectedPack.credits,
          credit_pack_price_cents: selectedPack.priceCents,
          company_name: companyName,
        },
      })
      .select()
      .single();

    if (invoiceErr || !invoice) {
      return NextResponse.json(
        { error: invoiceErr?.message || "Failed to create invoice." },
        { status: 500 }
      );
    }

    const invoiceId = invoice.id as string;
    const lineItem = {
      invoice_id: invoiceId,
      sort_order: 0,
      item_type: "credit_pack" as const,
      description: `${selectedPack.label} (${selectedPack.credits} credits)`,
      quantity: 1,
      unit_price_cents: selectedPack.priceCents,
      line_total_cents: computeLineTotalCents(1, selectedPack.priceCents),
      metadata: {
        credit_pack_id: selectedPack.id,
        credit_pack_label: selectedPack.label,
        credit_pack_credits: selectedPack.credits,
        credit_pack_price_cents: selectedPack.priceCents,
        source: "marketplace_credit_pack",
      },
    };

    const { error: lineItemErr } = await admin.from("billing_invoice_line_items").insert(lineItem);
    if (lineItemErr) {
      await admin.from("billing_invoices").delete().eq("id", invoiceId);
      return NextResponse.json({ error: lineItemErr.message }, { status: 500 });
    }

    await recordBillingEvent(admin, {
      invoice_id: invoiceId,
      event_type: "created",
      created_by_user_id: auth.user.id,
      event_data: {
        invoice_number: invoiceNumber,
        billing_mode: "marketplace_credit_pack",
        credit_pack_id: selectedPack.id,
        credit_pack_credits: selectedPack.credits,
        credit_pack_price_cents: selectedPack.priceCents,
      },
    });

    const baseUrl = resolveAppBaseUrl(request);
    const checkoutResult = await createAndStoreStripeCheckoutSession({
      supabase: admin,
      stripe,
      request,
      invoiceId,
      successUrl: `${baseUrl}/purchases?checkout=success&session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoiceId}`,
      cancelUrl: `${baseUrl}/purchases?checkout=cancelled&invoice_id=${invoiceId}`,
    });

    if ("error" in checkoutResult) {
      await admin.from("billing_invoices").delete().eq("id", invoiceId);
      return NextResponse.json({ error: checkoutResult.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutResult.url,
      invoiceId,
      invoiceNumber,
      creditPack: selectedPack,
      billingScope: "company",
      companyId: companyScope.companyId,
      companyName,
    });
  }

  const { error: insertError } = await auth.supabase
    .from("credit_transactions")
    .insert({
      user_id: auth.user.id,
      amount: selectedPack.credits,
      transaction_type: "grant",
      description: `${selectedPack.label} credited from marketplace purchase`,
      metadata: {
        source: "marketplace_purchase",
        pack_id: selectedPack.id,
        credits: selectedPack.credits,
        price_cents: selectedPack.priceCents,
      },
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const ledgerResult = await listCreditTransactions(auth.supabase, auth.user.id);

  if (ledgerResult.error) {
    return NextResponse.json({ error: ledgerResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    grantedCredits: selectedPack.credits,
    creditBalance: sumCreditBalance(ledgerResult.data),
    purchasedDocumentIds: purchasedDocumentIdsFromTransactions(ledgerResult.data),
    transactions: ledgerResult.data.slice(0, 10),
    ledgerEnabled: true,
    billingScope: "user",
  });
}
