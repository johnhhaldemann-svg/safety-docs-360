import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { createAndStoreStripeCheckoutSession, getStripe } from "@/lib/billing/stripeCheckout";
import { computeLineTotalCents } from "@/lib/billing/invoiceTotals";
import { recordBillingEvent } from "@/lib/billing/recordEvent";
import {
  getDocumentCurrency,
  getDocumentPriceCents,
  isMarketplaceEnabled,
} from "@/lib/marketplace";
import { hasMarketplaceDocumentPurchase } from "@/lib/marketplaceDocumentPurchases";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import {
  createSupabaseAdminClient,
  getSupabaseServerEnvStatus,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type CheckoutPayload = {
  documentId?: string;
};

function getDocumentTitle(document: {
  document_title?: string | null;
  project_name?: string | null;
  file_name?: string | null;
}) {
  return (
    document.document_title?.trim() ||
    document.project_name?.trim() ||
    document.file_name?.trim() ||
    "Marketplace document"
  );
}

function addUtcDaysToYmd(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_template_marketplace",
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!isCompanyRole(auth.role)) {
    return NextResponse.json(
      { error: "Document purchases require a company workspace account." },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Document checkout requires the Supabase service role to create invoice-backed purchases.",
        details: getSupabaseServerEnvStatus(),
      },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured (STRIPE_SECRET_KEY missing)." },
      { status: 503 }
    );
  }

  let body: CheckoutPayload;
  try {
    body = (await request.json()) as CheckoutPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const documentId = String(body.documentId ?? "").trim();
  if (!documentId) {
    return NextResponse.json({ error: "documentId is required." }, { status: 400 });
  }

  const companyScope = await getCompanyScope({
    supabase: admin,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "No company workspace linked." },
      { status: 400 }
    );
  }

  const existingPurchase = await hasMarketplaceDocumentPurchase({
    supabase: admin,
    companyId: companyScope.companyId,
    documentId,
  });

  if (existingPurchase.purchased) {
    return NextResponse.json({
      alreadyPurchased: true,
      checkoutUrl: null,
    });
  }

  const { data: document, error: documentError } = await admin
    .from("documents")
    .select(
      "id, company_id, document_title, project_name, document_type, category, notes, file_name, status, final_file_path"
    )
    .eq("id", documentId)
    .maybeSingle();

  if (documentError || !document) {
    return NextResponse.json(
      { error: documentError?.message || "Document not found." },
      { status: 404 }
    );
  }

  if (document.company_id) {
    return NextResponse.json(
      { error: "Only global marketplace documents can be purchased directly." },
      { status: 400 }
    );
  }

  if (
    String(document.status ?? "").trim().toLowerCase() === "archived" ||
    !document.final_file_path ||
    !isMarketplaceEnabled(document.notes)
  ) {
    return NextResponse.json(
      { error: "This document is not available for purchase." },
      { status: 404 }
    );
  }

  const priceCents = getDocumentPriceCents(document.notes);
  const currency = getDocumentCurrency(document.notes);
  if (!priceCents || priceCents <= 0 || currency !== "usd") {
    return NextResponse.json(
      { error: "This document does not have a valid USD price." },
      { status: 400 }
    );
  }

  const { data: company } = await admin
    .from("companies")
    .select("id, name, team_key, primary_contact_name, primary_contact_email")
    .eq("id", companyScope.companyId)
    .maybeSingle();

  const companyName =
    String(company?.name ?? "").trim() ||
    String(company?.team_key ?? "").trim() ||
    companyScope.companyName ||
    "Company Workspace";
  const billingEmail =
    String(company?.primary_contact_email ?? "").trim().toLowerCase() ||
    String(auth.user.email ?? "").trim().toLowerCase();

  if (!billingEmail) {
    return NextResponse.json(
      { error: "A billing email is required before purchasing documents." },
      { status: 400 }
    );
  }

  const existingCustomer = await admin
    .from("billing_customers")
    .select("id")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let customerId = existingCustomer.data?.id as string | undefined;
  if (!customerId) {
    const { data: createdCustomer, error: customerError } = await admin
      .from("billing_customers")
      .insert({
        company_id: companyScope.companyId,
        company_name: companyName,
        billing_contact_name:
          String(company?.primary_contact_name ?? "").trim() || auth.user.email || null,
        billing_email: billingEmail,
      })
      .select("id")
      .single();

    if (customerError || !createdCustomer) {
      return NextResponse.json(
        { error: customerError?.message || "Failed to create billing customer." },
        { status: 500 }
      );
    }
    customerId = createdCustomer.id as string;
  }

  const { data: invoiceNumber, error: invoiceNumberError } = await admin.rpc(
    "billing_generate_invoice_number"
  );

  if (invoiceNumberError || !invoiceNumber || typeof invoiceNumber !== "string") {
    return NextResponse.json(
      { error: invoiceNumberError?.message || "Failed to generate invoice number." },
      { status: 500 }
    );
  }

  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = addUtcDaysToYmd(issueDate, 7);
  const title = getDocumentTitle(document);
  const lineTotal = computeLineTotalCents(1, priceCents);
  const metadata = {
    source: "marketplace_document_purchase",
    marketplace_document_id: document.id,
    document_id: document.id,
    marketplace_document_title: title,
    marketplace_document_price_cents: priceCents,
    marketplace_document_currency: currency,
    purchased_by_user_id: auth.user.id,
  };

  const { data: invoice, error: invoiceError } = await admin
    .from("billing_invoices")
    .insert({
      invoice_number: invoiceNumber,
      customer_id: customerId,
      company_id: companyScope.companyId,
      status: "sent",
      issue_date: issueDate,
      due_date: dueDate,
      subtotal_cents: lineTotal,
      tax_cents: 0,
      discount_cents: 0,
      total_cents: lineTotal,
      amount_paid_cents: 0,
      balance_due_cents: lineTotal,
      currency,
      notes: `Marketplace document purchase: ${title}`,
      terms: "Document unlock is available after payment is confirmed.",
      created_by_user_id: auth.user.id,
      sent_at: new Date().toISOString(),
      billing_source: "marketplace_document_purchase",
      metadata,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json(
      { error: invoiceError?.message || "Failed to create invoice." },
      { status: 500 }
    );
  }

  const invoiceId = invoice.id as string;
  const { error: lineItemError } = await admin
    .from("billing_invoice_line_items")
    .insert({
      invoice_id: invoiceId,
      sort_order: 0,
      item_type: "document_review",
      description: title,
      quantity: 1,
      unit_price_cents: priceCents,
      line_total_cents: lineTotal,
      metadata,
    });

  if (lineItemError) {
    await admin.from("billing_invoices").delete().eq("id", invoiceId);
    return NextResponse.json({ error: lineItemError.message }, { status: 500 });
  }

  await recordBillingEvent(admin, {
    invoice_id: invoiceId,
    event_type: "created",
    created_by_user_id: auth.user.id,
    event_data: {
      invoice_number: invoiceNumber,
      source: "marketplace_document_purchase",
      document_id: document.id,
    },
  });

  const baseUrl = new URL(request.url).origin;
  const sessionResult = await createAndStoreStripeCheckoutSession({
    supabase: admin,
    stripe,
    request,
    invoiceId,
    successUrl: `${baseUrl}/documents?doc=${encodeURIComponent(
      document.id
    )}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/documents?tab=marketplace&doc=${encodeURIComponent(
      document.id
    )}&checkout=cancelled`,
  });

  if ("error" in sessionResult) {
    return NextResponse.json({ error: sessionResult.error }, { status: 400 });
  }

  await recordBillingEvent(admin, {
    invoice_id: invoiceId,
    event_type: "payment_link_created",
    created_by_user_id: auth.user.id,
    event_data: {
      action: "marketplace_document_checkout_created",
      stripe: true,
      document_id: document.id,
    },
  });

  return NextResponse.json({
    checkoutUrl: sessionResult.url,
    invoiceId,
  });
}
