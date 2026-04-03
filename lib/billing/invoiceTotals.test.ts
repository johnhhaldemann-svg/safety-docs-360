import { describe, expect, it } from "vitest";
import {
  computeBalanceDue,
  computeInvoiceTotals,
  computeLineTotalCents,
  deriveInvoiceStatus,
} from "@/lib/billing/invoiceTotals";

describe("computeLineTotalCents", () => {
  it("rounds quantity * unit price", () => {
    expect(computeLineTotalCents(3, 100)).toBe(300);
    expect(computeLineTotalCents(1.5, 100)).toBe(150);
  });
});

describe("computeInvoiceTotals", () => {
  it("applies discount before tax", () => {
    const t = computeInvoiceTotals({
      lineItems: [
        { description: "A", quantity: 1, unit_price_cents: 1000 },
        { description: "B", quantity: 2, unit_price_cents: 500 },
      ],
      discountCents: 200,
      taxRateBps: 1000,
    });
    expect(t.subtotal_cents).toBe(2000);
    expect(t.discount_cents).toBe(200);
    expect(t.taxable_cents).toBe(1800);
    expect(t.tax_cents).toBe(180);
    expect(t.total_cents).toBe(1980);
  });
});

describe("computeBalanceDue", () => {
  it("never returns negative", () => {
    expect(computeBalanceDue(1000, 1200)).toBe(0);
    expect(computeBalanceDue(1000, 400)).toBe(600);
  });
});

describe("deriveInvoiceStatus", () => {
  it("marks overdue when past due with balance", () => {
    expect(
      deriveInvoiceStatus({
        storedStatus: "sent",
        dueDateYmd: "2020-01-01",
        balanceDueCents: 100,
        todayUtcYmd: "2026-01-02",
      })
    ).toBe("overdue");
  });

  it("keeps draft", () => {
    expect(
      deriveInvoiceStatus({
        storedStatus: "draft",
        dueDateYmd: "2020-01-01",
        balanceDueCents: 100,
        todayUtcYmd: "2026-01-02",
      })
    ).toBe("draft");
  });
});
