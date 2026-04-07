import { describe, expect, it } from "vitest";
import {
  addUtcDaysToYmd,
  buildCompanyBillingLineItems,
  buildCompanyBillingNote,
} from "@/lib/billing/companyInvoiceDraft";

describe("buildCompanyBillingLineItems", () => {
  it("builds subscription and seat lines when pricing is configured", () => {
    const items = buildCompanyBillingLineItems({
      companyName: "Acme Builders",
      planName: "Pro",
      subscriptionPriceCents: 25000,
      seatPriceCents: 5000,
      seatsUsed: 3,
      membershipSeats: 2,
      pendingInviteCount: 1,
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.description).toContain("Pro subscription");
    expect(items[1]?.description).toContain("Licensed user seats (3)");
    expect(items[1]?.quantity).toBe(3);
  });

  it("omits missing pricing components", () => {
    const items = buildCompanyBillingLineItems({
      companyName: "Acme Builders",
      planName: "Pro",
      subscriptionPriceCents: null,
      seatPriceCents: 5000,
      seatsUsed: 0,
      membershipSeats: 0,
      pendingInviteCount: 0,
    });

    expect(items).toHaveLength(0);
  });
});

describe("addUtcDaysToYmd", () => {
  it("adds days in UTC", () => {
    expect(addUtcDaysToYmd("2026-04-07", 30)).toBe("2026-05-07");
  });
});

describe("buildCompanyBillingNote", () => {
  it("describes the generated billing draft", () => {
    expect(
      buildCompanyBillingNote({
        companyName: "Acme Builders",
        planName: "Pro",
        seatsUsed: 4,
      })
    ).toContain("Acme Builders");
  });
});

