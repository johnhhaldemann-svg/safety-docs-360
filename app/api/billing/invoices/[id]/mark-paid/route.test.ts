import { afterEach, describe, expect, it, vi } from "vitest";

const authorizeRequest = vi.fn();
const assertStaffCanAccessCompany = vi.fn();
const isInternalBillingStaffRole = vi.fn();
const recordBillingEvent = vi.fn();

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

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("billing invoice mark-paid route", () => {
  it("rejects payment amounts above the remaining invoice balance", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv_1",
        company_id: "company_1",
        status: "sent",
        total_cents: 10000,
        amount_paid_cents: 2500,
        balance_due_cents: 7500,
        paid_at: null,
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

    const response = await POST(
      new Request("https://example.com/api/billing/invoices/inv_1/mark-paid", {
        method: "POST",
        body: JSON.stringify({ amount_cents: 8000, payment_method: "manual" }),
      }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "amount_cents cannot exceed the remaining invoice balance.",
    });
    expect(recordBillingEvent).not.toHaveBeenCalled();
  });
});
