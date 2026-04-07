import { afterEach, describe, expect, it, vi } from "vitest";

const authorizeRequest = vi.fn();
const assertStaffCanAccessCompany = vi.fn();
const isInternalBillingStaffRole = vi.fn();
const recordBillingEvent = vi.fn();
const getStripe = vi.fn();
const createAndStoreStripeCheckoutSession = vi.fn();

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/billing/access", () => ({
  assertStaffCanAccessCompany,
  BillingAccessError: class BillingAccessError extends Error {
    status: number;
    constructor(message: string, status = 403) {
      super(message);
      this.status = status;
    }
  },
  isInternalBillingStaffRole,
}));
vi.mock("@/lib/billing/recordEvent", () => ({ recordBillingEvent }));
vi.mock("@/lib/billing/stripeCheckout", () => ({
  getStripe,
  createAndStoreStripeCheckoutSession,
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("billing invoice send route", () => {
  it("rejects invoices with no line items before sending", async () => {
    const invoiceMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv_1",
        company_id: "company_1",
        status: "draft",
        balance_due_cents: 10000,
        payment_link: null,
      },
      error: null,
    });
    const invoiceEq = vi.fn().mockReturnValue({ maybeSingle: invoiceMaybeSingle });
    const invoiceSelect = vi.fn().mockReturnValue({ eq: invoiceEq });

    const lineItemEq = vi.fn().mockResolvedValue({ count: 0, error: null });
    const lineItemSelect = vi.fn().mockReturnValue({ eq: lineItemEq });

    const from = vi.fn((table: string) => {
      if (table === "billing_invoices") {
        return { select: invoiceSelect };
      }
      if (table === "billing_invoice_line_items") {
        return { select: lineItemSelect };
      }
      return { select: vi.fn() };
    });

    authorizeRequest.mockResolvedValue({
      supabase: { from },
      user: { id: "user_1" },
      role: "billing_admin",
    });
    isInternalBillingStaffRole.mockReturnValue(true);
    getStripe.mockReturnValue(null);

    const response = await POST(
      new Request("https://example.com/api/billing/invoices/inv_1/send"),
      { params: Promise.resolve({ id: "inv_1" }) }
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Cannot send an invoice with no line items." });
    expect(recordBillingEvent).not.toHaveBeenCalled();
    expect(createAndStoreStripeCheckoutSession).not.toHaveBeenCalled();
  });
});
