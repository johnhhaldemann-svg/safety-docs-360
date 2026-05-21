import { describe, expect, it } from "vitest";
import { getCredibilityWeight } from "./baseline";
import { DYNAMIC_INJURY_FORECAST } from "./constants";
import { computeExposureMultiplier } from "./exposure";
import { runDynamicInjuryForecastEngine } from "./engine";
import type { ForecastInput, ForecastRunContext } from "./types";

function baseInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  const base: ForecastInput = {
    baseline: {
      company: { incidentCount: 2, hoursWorked: 8000, headcount: 40 },
      industryBenchmarkRate: 0.02,
      tradeBenchmark: null,
      stateBenchmark: null,
      monthlyBenchmark: null,
    },
    exposure: {
      totalLaborHours: 8000,
      activeHeadcount: 40,
      highRiskTaskCount: 5,
      simultaneousTrades: 3,
      equipmentOperationsCount: 2,
    },
    leadingIndicators: {
      sorCount: 12,
      nearMissCount: 1,
      correctiveOpenCount: 4,
      correctiveOverdueCount: 1,
      failedInspectionCount: 0,
      permitFailureCount: 0,
      jsaQualityScore: 0.8,
      housekeepingDeficiencyRate: 0.1,
      severityCounts: { low: 4, medium: 5, high: 2, critical: 1 },
      totalHoursForNormalization: 8000,
    },
    controls: {
      metrics: [
        { id: "training", label: "Training", value: 0.9 },
        { id: "ppe", label: "PPE", value: 0.85 },
      ],
    },
    trend: { recent30DaySignalRate: 0.5, prior90DaySignalRate: 0.4 },
    fatigue: {
      avgShiftHours: 9,
      avgWeeklyHours: 45,
      consecutiveDaysWorked: 5,
      nightShift: false,
      overtimeHeavy: false,
    },
    weather: {
      rainIndex: 0.2,
      windIndex: 0.15,
      heatStressIndex: 0.1,
      coldStressIndex: 0,
      lowVisibilityIndex: 0,
      slipSurfaceIndex: 0.1,
      seasonFactor: 0.15,
    },
    uncertainty: {
      completeness: 0.75,
      missingTradeMappingRate: 0.08,
      lateEntryRate: 0.05,
      missingSeverityRate: 0.04,
      missingCloseoutRate: 0.12,
      staleDataRate: 0.06,
    },
  };
  return { ...base, ...overrides };
}

describe("getCredibilityWeight", () => {
  it("is low for very small incident history", () => {
    expect(getCredibilityWeight(0)).toBeLessThan(0.35);
    expect(getCredibilityWeight(1)).toBeLessThan(0.4);
  });
  it("increases with more incidents", () => {
    expect(getCredibilityWeight(20)).toBeGreaterThan(getCredibilityWeight(2));
  });
});

describe("DYNAMIC_INJURY_FORECAST constants", () => {
  it("exposes WEATHER coefficients", () => {
    expect(DYNAMIC_INJURY_FORECAST.WEATHER).toBeDefined();
    expect(DYNAMIC_INJURY_FORECAST.WEATHER.RAIN).toBe(0.18);
    expect(DYNAMIC_INJURY_FORECAST.WEATHER.MAX_MULTIPLIER).toBe(2.1);
  });
});

describe("computeExposureMultiplier", () => {
  it("clamps at max", () => {
    const m = computeExposureMultiplier({
      totalLaborHours: 1e7,
      activeHeadcount: 5000,
      highRiskTaskCount: 900,
      simultaneousTrades: 80,
      equipmentOperationsCount: 200,
    });
    expect(m.value).toBeLessThanOrEqual(DYNAMIC_INJURY_FORECAST.EXPOSURE.MAX_MULTIPLIER);
  });
});

describe("runDynamicInjuryForecastEngine", () => {
  it("returns probability in [0,1] and risk band", () => {
    const out = runDynamicInjuryForecastEngine(baseInput(), {
      injuryTypeContext: { textBlob: "crane rigging wind", heatOutdoorExposure: 0.4 },
    });
    expect(out.probability30d).toBeGreaterThanOrEqual(0);
    expect(out.probability30d).toBeLessThanOrEqual(1);
    expect(out.riskScore0_100).toBeGreaterThanOrEqual(5);
    expect(out.riskScore0_100).toBeLessThanOrEqual(100);
    expect(["Low", "Moderate", "High", "Critical"]).toContain(out.riskBand);
    expect(out.topRiskDrivers.length).toBeLessThanOrEqual(5);
    expect(out.mlCalibrationScore).toBe(out.interpretableProbability);
    expect(out.forecastMode).toBeDefined();
    expect(Array.isArray(out.benchmarkSourcesUsed)).toBe(true);
    expect(out.hybridBlendWeight).toBeGreaterThanOrEqual(0);
    expect(out.hybridBlendWeight).toBeLessThanOrEqual(1);
  });

  it("rises with poor controls and rising trend", () => {
    const calm = runDynamicInjuryForecastEngine(baseInput());
    const stressed = runDynamicInjuryForecastEngine(
      baseInput({
        controls: { metrics: [{ id: "training", label: "Training", value: 0.4 }] },
        trend: { recent30DaySignalRate: 2, prior90DaySignalRate: 0.3 },
      })
    );
    expect(stressed.probability30d).toBeGreaterThan(calm.probability30d);
  });

  it("handles missing-data-heavy input without NaN", () => {
    const sparse = runDynamicInjuryForecastEngine(
      baseInput({
        baseline: { company: { incidentCount: 0 }, industryBenchmarkRate: 0.01 },
        exposure: {
          totalLaborHours: 0,
          activeHeadcount: 0,
          highRiskTaskCount: 0,
          simultaneousTrades: 1,
          equipmentOperationsCount: 0,
          assumed: { totalLaborHours: true, activeHeadcount: true },
        },
        leadingIndicators: {
          sorCount: 0,
          nearMissCount: 0,
          correctiveOpenCount: 0,
          correctiveOverdueCount: 0,
          failedInspectionCount: 0,
          permitFailureCount: 0,
          jsaQualityScore: 0.5,
          housekeepingDeficiencyRate: 0,
          severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
          totalHoursForNormalization: 200,
        },
      })
    );
    expect(Number.isFinite(sparse.probability30d)).toBe(true);
    expect(Number.isFinite(sparse.lambda30)).toBe(true);
    expect(sparse.riskScore0_100).toBeGreaterThanOrEqual(5);
    expect(sparse.fallbackLambda30).toBeGreaterThan(0);
  });

  it("benchmark mode with zero company rows still returns a positive forecast", () => {
    const emptyCtx: ForecastRunContext = {
      signalRowCount: 0,
      incidentCount: 0,
      sorCount: 0,
      correctiveActionCount: 0,
      laborHours: 0,
      distinctMonthsOfHistory: 0,
      inspectionProxyCount: 0,
      completeness01: 0.22,
      dataRecencyScore01: 0,
      dominantTradeLabels: [],
      monthIndex0: 5,
      projectPhase: null,
      highRiskTaskTags: [],
      stateRateIndex: 1.04,
    };
    const out = runDynamicInjuryForecastEngine(
      baseInput({
        leadingIndicators: {
          sorCount: 0,
          nearMissCount: 0,
          correctiveOpenCount: 0,
          correctiveOverdueCount: 0,
          failedInspectionCount: 0,
          permitFailureCount: 0,
          jsaQualityScore: 0.5,
          housekeepingDeficiencyRate: 0,
          severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
          totalHoursForNormalization: 200,
        },
      }),
      { runContext: emptyCtx }
    );
    expect(out.forecastMode).toBe("BENCHMARK_FALLBACK");
    expect(out.usedFallbackDefaults).toBe(true);
    expect(out.probability30d).toBeGreaterThan(0.001);
    expect(out.riskScore0_100).toBeGreaterThanOrEqual(5);
    expect(out.confidenceScore).toBeLessThanOrEqual(50);
    expect(out.confidenceScore).toBeGreaterThanOrEqual(20);
  });

  it("benchmark mode still blends in site λ when safety rows exist (not pure generic benchmark)", () => {
    const thinCtx: ForecastRunContext = {
      signalRowCount: 3,
      incidentCount: 0,
      sorCount: 3,
      correctiveActionCount: 0,
      laborHours: 2000,
      distinctMonthsOfHistory: 1,
      inspectionProxyCount: 0,
      completeness01: 0.42,
      dataRecencyScore01: 0.55,
      dominantTradeLabels: ["Electrical"],
      monthIndex0: 3,
      projectPhase: null,
      highRiskTaskTags: [],
      stateRateIndex: 1,
    };
    const out = runDynamicInjuryForecastEngine(
      baseInput({
        leadingIndicators: {
          sorCount: 3,
          nearMissCount: 0,
          correctiveOpenCount: 0,
          correctiveOverdueCount: 0,
          failedInspectionCount: 0,
          permitFailureCount: 0,
          jsaQualityScore: 0.72,
          housekeepingDeficiencyRate: 0.05,
          severityCounts: { low: 2, medium: 1, high: 0, critical: 0 },
          totalHoursForNormalization: 2000,
        },
      }),
      { runContext: thinCtx, injuryTypeContext: { textBlob: "electrical temp power", heatOutdoorExposure: 0.2 } }
    );
    expect(out.forecastMode).toBe("BENCHMARK_FALLBACK");
    expect(out.hybridBlendWeight).toBeGreaterThan(0.1);
    expect(out.hybridBlendWeight).toBeLessThan(1);
  });
});
