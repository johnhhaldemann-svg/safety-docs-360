import { describe, expect, it } from "vitest";
import { getRecurringBillingPeriod, getUtcYmd } from "./recurringCompanyBilling";

describe("recurringCompanyBilling", () => {
  it("computes the current UTC ymd", () => {
    const date = new Date("2026-04-07T15:30:00Z");
    expect(getUtcYmd(date)).toBe("2026-04-07");
  });

  it("computes a monthly recurring billing period in UTC", () => {
    const date = new Date("2026-04-07T15:30:00Z");
    expect(getRecurringBillingPeriod(date)).toEqual({
      key: "2026-04",
      startYmd: "2026-04-01",
      endYmd: "2026-04-30",
    });
  });
});
