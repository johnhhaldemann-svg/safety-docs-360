import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  assertStaffCanAccessCompany,
  isInternalBillingStaffRole,
  recordBillingEvent,
  getStripe,
  createAndStoreStripeCheckoutSession,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  assertStaffCanAccessCompany: vi.fn(),
  isInternalBillingStaffRole: vi.fn(),
  recordBillingEvent: vi.fn(),
  getStripe: vi.fn(),
  createAndStoreStripeCheckoutSession: vi.fn(),
}));

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

describe("billing invoice payment-link route", () => {
  it("records payment-link creation with a specific audit event", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv_1",
        company_id: "company_1",
        status: "sent",
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    authorizeRequest.mockResolvedValue({
      supabase: { from },
      user: { id: "user_1" },
      role: "billing_admin",
    });
    isInternalBillingStaffRole.mockReturnValue(true);
    getStripe.mockReturnValue({} as never);
    createAndStoreStripeCheckoutSession.mockResolvedValue({ url: "https://checkout.example.com" });

    const response = await POST(
      new Request("https://example.com/api/billing/invoices/inv_1/payment-link"),
      { params: Promise.resolve({ id: "inv_1" }) }
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ payment_link: "https://checkout.example.com" });
    expect(recordBillingEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: "payment_link_created",
        event_data: { action: "payment_link_created", stripe: true },
      })
    );
  });
});
