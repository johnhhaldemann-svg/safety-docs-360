import { afterEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, getCompanyScope } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));

import { GET } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("customer billing invoice route", () => {
  it("returns invoice payments and billing events for the customer view", async () => {
    const invoiceMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv_1",
        company_id: "company_1",
        invoice_number: "INV-1001",
        status: "paid",
        currency: "usd",
        total_cents: 10000,
        subtotal_cents: 10000,
        tax_cents: 0,
        discount_cents: 0,
        balance_due_cents: 0,
        payment_link: null,
        billing_invoice_line_items: [],
        billing_customers: [],
      },
      error: null,
    });
    const invoiceEq = vi.fn().mockReturnValue({ maybeSingle: invoiceMaybeSingle });
    const invoiceSelect = vi.fn().mockReturnValue({ eq: invoiceEq });

    const paymentsOrder = vi.fn().mockResolvedValue({
      data: [{ created_at: "2026-04-07T10:00:00Z", amount_cents: 10000 }],
    });
    const paymentsEq = vi.fn().mockReturnValue({ order: paymentsOrder });
    const paymentsSelect = vi.fn().mockReturnValue({ eq: paymentsEq });

    const eventsOrder = vi.fn().mockResolvedValue({
      data: [{ created_at: "2026-04-07T09:30:00Z", event_type: "payment_link_created" }],
    });
    const eventsEq = vi.fn().mockReturnValue({ order: eventsOrder });
    const eventsSelect = vi.fn().mockReturnValue({ eq: eventsEq });

    const from = vi.fn((table: string) => {
      if (table === "billing_invoices") {
        return { select: invoiceSelect };
      }
      if (table === "billing_invoice_payments") {
        return { select: paymentsSelect };
      }
      if (table === "billing_events") {
        return { select: eventsSelect };
      }
      return { select: vi.fn() };
    });

    authorizeRequest.mockResolvedValue({
      supabase: { from },
      user: { id: "user_1" },
      team: "team_1",
    });
    getCompanyScope.mockResolvedValue({ companyId: "company_1" });

    const response = await GET(
      new Request("https://example.com/api/customer/billing/invoices/inv_1"),
      { params: Promise.resolve({ id: "inv_1" }) }
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.payments).toEqual([{ created_at: "2026-04-07T10:00:00Z", amount_cents: 10000 }]);
    expect(body.events).toEqual([{ created_at: "2026-04-07T09:30:00Z", event_type: "payment_link_created" }]);
  });
});
