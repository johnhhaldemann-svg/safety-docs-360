import { describe, expect, it, vi } from "vitest";
import {
  getCompanyPredictabilityMaturity,
  rowsFromPlatformAggregates,
} from "@/lib/predictability/dataProviders";

function makeQuery(result: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    then: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  );
  return builder;
}

describe("predictability data providers", () => {
  it("scopes every company-specific maturity query by company_id", async () => {
    const now = new Date("2026-05-17T12:00:00.000Z");
    const result = {
      data: [
        { created_at: new Date(now.getTime() - 40 * 86400000).toISOString() },
        { created_at: now.toISOString() },
      ],
      count: 2,
      error: null,
    };
    const builders = {
      company_sor_records: makeQuery(result),
      company_corrective_actions: makeQuery(result),
      company_incidents: makeQuery(result),
    };
    const supabase = {
      from: vi.fn((table: string) => builders[table as keyof typeof builders]),
    };

    const maturity = await getCompanyPredictabilityMaturity(supabase as never, "company-a");

    expect(maturity.recordCount).toBe(6);
    for (const builder of Object.values(builders)) {
      expect(builder.eq).toHaveBeenCalledWith("company_id", "company-a");
      expect(builder.neq).toHaveBeenCalledWith("prediction_validation_status", "rejected");
    }
    expect(builders.company_sor_records.eq).toHaveBeenCalledWith("is_deleted", false);
  });

  it("drops platform aggregate buckets below the minimum company-count privacy threshold", () => {
    const rows = rowsFromPlatformAggregates(
      [
        {
          industry: "Construction",
          job_type: "Roofing",
          incident_type: "Falls",
          record_count: 800,
          company_count: 4,
          observation_days: 180,
          risk_score: 90,
          time_period: "2026-05-01",
        },
        {
          industry: "Construction",
          job_type: "Electrical",
          incident_type: "Temporary power",
          record_count: 800,
          company_count: 5,
          observation_days: 180,
          risk_score: 70,
          time_period: "2026-05-01",
        },
      ],
      { minPlatformAggregateCompanies: 5 }
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.tradeLabel !== "Roofing")).toBe(true);
    expect(rows.some((row) => row.tradeLabel === "Electrical")).toBe(true);
  });
});
