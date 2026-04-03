import { describe, expect, it } from "vitest";
import { getForecastMode, getHybridBlendWeight } from "./forecastMode";
import type { ForecastRunContext } from "./types";

function ctx(p: Partial<ForecastRunContext>): ForecastRunContext {
  const base: ForecastRunContext = {
    signalRowCount: 0,
    incidentCount: 0,
    sorCount: 0,
    correctiveActionCount: 0,
    laborHours: 0,
    distinctMonthsOfHistory: 0,
    inspectionProxyCount: 0,
    completeness01: 0.5,
    dataRecencyScore01: 0.5,
    dominantTradeLabels: [],
    monthIndex0: 0,
    projectPhase: null,
    highRiskTaskTags: [],
    stateRateIndex: null,
  };
  return { ...base, ...p };
}

describe("getForecastMode", () => {
  it("returns BENCHMARK_FALLBACK for empty tenant snapshot", () => {
    expect(getForecastMode(ctx({ signalRowCount: 0, laborHours: 0 }))).toBe("BENCHMARK_FALLBACK");
  });

  it("returns PARTIAL when hours exist but no rows", () => {
    expect(getForecastMode(ctx({ signalRowCount: 0, laborHours: 5000, sorCount: 0, correctiveActionCount: 0 }))).toBe(
      "PARTIAL_DATA"
    );
  });

  it("returns FULL_DATA when volume thresholds met", () => {
    expect(
      getForecastMode(
        ctx({
          signalRowCount: 25,
          laborHours: 4000,
          distinctMonthsOfHistory: 3,
          sorCount: 10,
          correctiveActionCount: 6,
          incidentCount: 2,
          completeness01: 0.75,
        })
      )
    ).toBe("FULL_DATA");
  });
});

describe("getHybridBlendWeight", () => {
  it("is zero for benchmark mode with no rows", () => {
    const c = ctx({ signalRowCount: 0, sorCount: 0, correctiveActionCount: 0 });
    expect(getHybridBlendWeight("BENCHMARK_FALLBACK", 0.3, c)).toBe(0);
  });

  it("is positive for benchmark mode when rows exist", () => {
    const c = ctx({ signalRowCount: 4, sorCount: 4, correctiveActionCount: 0, laborHours: 2200 });
    const w = getHybridBlendWeight("BENCHMARK_FALLBACK", 0.45, c);
    expect(w).toBeGreaterThan(0.15);
    expect(w).toBeLessThanOrEqual(0.68);
  });

  it("is one for full data", () => {
    expect(getHybridBlendWeight("FULL_DATA", 0.2, ctx({}))).toBe(1);
  });
});
