import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PREDICTABILITY_THRESHOLDS,
  resolvePredictabilityDataSource,
  type PlatformAggregateMaturity,
  type PredictabilityMaturity,
} from "@/lib/predictability/dataSourceResolver";
import type { PredictabilitySettings } from "@/lib/predictability/settings";

const enoughCompany: PredictabilityMaturity = { recordCount: 30, observationDays: 30 };
const thinCompany: PredictabilityMaturity = { recordCount: 8, observationDays: 12 };
const maturePlatform: PlatformAggregateMaturity = { recordCount: 500, companyCount: 5, observationDays: 90 };
const immaturePlatform: PlatformAggregateMaturity = { recordCount: 900, companyCount: 4, observationDays: 120 };

function providers(company: PredictabilityMaturity, platform: PlatformAggregateMaturity) {
  return {
    getCompanyMaturity: vi.fn(async () => company),
    getPlatformAggregateMaturity: vi.fn(async () => platform),
  };
}

function settings(overrides: Partial<PredictabilitySettings> = {}): PredictabilitySettings {
  return {
    predictabilityDataMode: "company_then_platform_then_osha",
    allowCompanyData: true,
    allowPlatformAggregateFallback: true,
    allowOshaFallback: true,
    visibleBenchmarkSources: ["company", "platform_aggregate", "osha"],
    ...overrides,
  };
}

describe("resolvePredictabilityDataSource", () => {
  it("uses company data when the company has enough records and observation days", async () => {
    const p = providers(enoughCompany, maturePlatform);
    const result = await resolvePredictabilityDataSource("co1", settings(), p);

    expect(result.source).toBe("company");
    expect(result.fallbackUsed).toBe(false);
    expect(result.metadata).toMatchObject({ source: "company", confidenceLevel: "high" });
    expect(p.getPlatformAggregateMaturity).not.toHaveBeenCalled();
  });

  it("falls back to platform aggregate when company data is thin and aggregate is mature", async () => {
    const result = await resolvePredictabilityDataSource("co1", settings(), providers(thinCompany, maturePlatform));

    expect(result.source).toBe("platform_aggregate");
    expect(result.fallbackUsed).toBe(true);
    expect(result.reason).toBe("Company does not have enough data yet");
    expect(result.metadata).toMatchObject({
      source: "platform_aggregate",
      dataScope: "anonymized_platform_aggregate",
      confidenceLevel: "medium",
    });
  });

  it("falls back to OSHA when company and platform aggregate data are not sufficient", async () => {
    const result = await resolvePredictabilityDataSource("co1", settings(), providers(thinCompany, immaturePlatform));

    expect(result.source).toBe("osha");
    expect(result.fallbackUsed).toBe(true);
    expect(result.reason).toBe("Company and platform aggregate data are not sufficient yet");
  });

  it("uses OSHA when platform aggregate fallback is disabled but OSHA is enabled", async () => {
    const result = await resolvePredictabilityDataSource(
      "co1",
      settings({
        predictabilityDataMode: "company_then_osha",
        allowPlatformAggregateFallback: false,
      }),
      providers(thinCompany, maturePlatform)
    );

    expect(result.source).toBe("osha");
    expect(result.fallbackUsed).toBe(true);
  });

  it("returns insufficient_data when company is thin and all fallbacks are disabled", async () => {
    const result = await resolvePredictabilityDataSource(
      "co1",
      settings({
        predictabilityDataMode: "company_only",
        allowPlatformAggregateFallback: false,
        allowOshaFallback: false,
      }),
      providers(thinCompany, maturePlatform)
    );

    expect(result.source).toBe("insufficient_data");
    expect(result.fallbackUsed).toBe(false);
  });

  it("honors company_only by never querying platform aggregate or OSHA", async () => {
    const p = providers(thinCompany, maturePlatform);
    const result = await resolvePredictabilityDataSource("co1", settings({ predictabilityDataMode: "company_only" }), p);

    expect(result.source).toBe("insufficient_data");
    expect(p.getCompanyMaturity).toHaveBeenCalledWith("co1");
    expect(p.getPlatformAggregateMaturity).not.toHaveBeenCalled();
  });

  it("does not use platform aggregate when the privacy company-count threshold is not met", async () => {
    const result = await resolvePredictabilityDataSource(
      "co1",
      settings({ predictabilityDataMode: "company_then_platform", allowOshaFallback: false }),
      providers(thinCompany, {
        ...maturePlatform,
        companyCount: DEFAULT_PREDICTABILITY_THRESHOLDS.minPlatformAggregateCompanies - 1,
      })
    );

    expect(result.source).toBe("insufficient_data");
    expect(result.reason).toContain("platform aggregate data");
  });
});
