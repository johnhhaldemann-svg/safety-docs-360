import { afterEach, describe, expect, it, vi } from "vitest";

const authorizeRequest = vi.fn();
const getCompanyScope = vi.fn();
const recordBillingEvent = vi.fn();
const sendMarketplaceCreditPurchaseReceiptEmail = vi.fn();
const resolveAppBaseUrl = vi.fn();

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/billing/recordEvent", () => ({ recordBillingEvent }));
vi.mock("@/lib/billing/marketplaceCreditReceiptEmail", () => ({
  sendMarketplaceCreditPurchaseReceiptEmail,
}));
vi.mock("@/lib/billing/resolveAppBaseUrl", () => ({ resolveAppBaseUrl }));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("customer receipt resend route", () => {
  it("rejects invoices without a billing email", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv_1",
        company_id: "company_1",
        billing_source: "marketplace_credit_pack",
        status: "paid",
        balance_due_cents: 0,
        total_cents: 5000,
        currency: "usd",
        invoice_number: "INV-1001",
        metadata: {},
        billing_customers: [
          {
            billing_email: "",
            company_name: "Acme Builders",
          },
        ],
        billing_invoice_line_items: [],
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    authorizeRequest.mockResolvedValue({
      supabase: { from },
      user: { id: "user_1" },
      team: "team_1",
    });
    getCompanyScope.mockResolvedValue({ companyId: "company_1" });

    const response = await POST(
      new Request("https://example.com/api/customer/billing/invoices/inv_1/resend-receipt"),
      { params: Promise.resolve({ id: "inv_1" }) }
    );

    if (!response) {
      throw new Error("Expected a response.");
    }
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "Billing email is missing for this customer.",
    });
    expect(sendMarketplaceCreditPurchaseReceiptEmail).not.toHaveBeenCalled();
    expect(recordBillingEvent).not.toHaveBeenCalled();
    expect(resolveAppBaseUrl).not.toHaveBeenCalled();
  });
});
