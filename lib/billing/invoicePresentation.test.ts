import { describe, expect, it } from "vitest";
import {
  formatBillingPeriodLabel,
  getBillingSourceLabel,
  getInvoiceSourceSummary,
  summarizeBillingCharges,
} from "./invoicePresentation";

describe("invoicePresentation", () => {
  it("labels recurring and manual invoice sources", () => {
    expect(getBillingSourceLabel("recurring_company_pricing")).toBe("Recurring company billing");
    expect(getBillingSourceLabel("company_pricing")).toBe("Company pricing");
    expect(getBillingSourceLabel(null)).toBe("Manual invoice");
  });

  it("formats recurring periods", () => {
    expect(formatBillingPeriodLabel("2026-04")).toBe("Apr 2026");
  });

  it("summarizes recurring company charges", () => {
    const summary = summarizeBillingCharges([
      {
        description: "Pro subscription",
        quantity: 1,
        unit_price_cents: 12000,
        line_total_cents: 12000,
        metadata: { billing_component: "company_subscription" },
      },
      {
        description: "Licensed user seats",
        quantity: 5,
        unit_price_cents: 2500,
        line_total_cents: 12500,
        metadata: { billing_component: "licensed_seats" },
      },
    ]);

    expect(summary.subscription_cents).toBe(12000);
    expect(summary.licensing_cents).toBe(12500);
    expect(summary.other_cents).toBe(0);
  });

  it("summarizes invoice source details", () => {
    const summary = getInvoiceSourceSummary({
      billing_source: "recurring_company_pricing",
      billing_period_key: "2026-04",
      billing_period_start: "2026-04-01",
      billing_period_end: "2026-04-30",
    });

    expect(summary.source).toBe("Recurring company billing");
    expect(summary.period).toBe("Apr 2026 (2026-04-01 to 2026-04-30)");
    expect(summary.isRecurring).toBe(true);
  });
});
