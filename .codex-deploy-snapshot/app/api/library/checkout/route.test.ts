import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  isCompanyRole,
  getCompanyScope,
  createSupabaseAdminClient,
  getSupabaseServerEnvStatus,
  getStripe,
  createAndStoreStripeCheckoutSession,
  recordBillingEvent,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isCompanyRole: vi.fn(),
  getCompanyScope: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getSupabaseServerEnvStatus: vi.fn(),
  getStripe: vi.fn(),
  createAndStoreStripeCheckoutSession: vi.fn(),
  recordBillingEvent: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isCompanyRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient,
  getSupabaseServerEnvStatus,
}));
vi.mock("@/lib/billing/stripeCheckout", () => ({
  getStripe,
  createAndStoreStripeCheckoutSession,
}));
vi.mock("@/lib/billing/recordEvent", () => ({ recordBillingEvent }));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

function makeAdminClient() {
  const inserts: Record<string, unknown[]> = {};

  const table = (name: string) => {
    if (name === "marketplace_document_purchases") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (name === "documents") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "doc_1",
            company_id: null,
            document_title: "Fall Protection Plan",
            project_name: "Fall Protection Plan",
            document_type: "Template",
            category: "Fall Protection",
            notes: JSON.stringify({
              marketplace: { enabled: true, priceCents: 4900, currency: "usd" },
            }),
            file_name: "fall.docx",
            status: "approved",
            final_file_path: "marketplace-documents/doc_1/fall.docx",
          },
          error: null,
        }),
      };
    }
    if (name === "companies") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "company_1",
            name: "Acme Safety",
            team_key: "acme",
            primary_contact_name: "Alex",
            primary_contact_email: "billing@example.com",
          },
          error: null,
        }),
      };
    }
    if (name === "billing_customers") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn((row: unknown) => {
          inserts[name] = [...(inserts[name] ?? []), row];
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: "customer_1" }, error: null }),
          };
        }),
      };
    }
    if (name === "billing_invoices") {
      return {
        insert: vi.fn((row: unknown) => {
          inserts[name] = [...(inserts[name] ?? []), row];
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: "invoice_1" }, error: null }),
          };
        }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    }
    if (name === "billing_invoice_line_items") {
      return {
        insert: vi.fn((row: unknown) => {
          inserts[name] = [...(inserts[name] ?? []), row];
          return Promise.resolve({ error: null });
        }),
      };
    }
    throw new Error(`Unexpected table ${name}`);
  };

  return {
    client: {
      from: vi.fn(table),
      rpc: vi.fn().mockResolvedValue({ data: "INV-2026-000001", error: null }),
    },
    inserts,
  };
}

describe("library checkout route", () => {
  it("creates an invoice-backed Stripe checkout for a priced global document", async () => {
    const admin = makeAdminClient();
    authorizeRequest.mockResolvedValue({
      supabase: {},
      user: { id: "user_1", email: "buyer@example.com" },
      role: "company_admin",
      team: "Acme",
    });
    isCompanyRole.mockReturnValue(true);
    getCompanyScope.mockResolvedValue({
      companyId: "company_1",
      companyName: "Acme Safety",
    });
    createSupabaseAdminClient.mockReturnValue(admin.client);
    getStripe.mockReturnValue({} as never);
    createAndStoreStripeCheckoutSession.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });

    const response = await POST(
      new Request("https://app.example.com/api/library/checkout", {
        method: "POST",
        body: JSON.stringify({ documentId: "doc_1" }),
      })
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checkoutUrl: "https://checkout.stripe.test/session",
      invoiceId: "invoice_1",
    });
    expect(admin.inserts.billing_invoices?.[0]).toMatchObject({
      billing_source: "marketplace_document_purchase",
      total_cents: 4900,
      metadata: expect.objectContaining({
        marketplace_document_id: "doc_1",
        purchased_by_user_id: "user_1",
      }),
    });
    expect(createAndStoreStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "invoice_1",
        successUrl: expect.stringContaining("/documents?doc="),
      })
    );
  });
});
