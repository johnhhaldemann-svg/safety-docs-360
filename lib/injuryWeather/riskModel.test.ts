import { describe, expect, it } from "vitest";
import {
  behavioralLikelihoodAdjustmentFromMonthLabel,
  computeAvgInjuryRateByMonth,
  computeAvgInjuryRateByTrade,
  computeAvgSeverityWeight,
  computeBaselineRisk,
  computeBaseRiskScore,
  computeTrendSignalValidationMultiplier,
  computeMinimumRiskFloor,
  computePredictedRiskProduct,
  computePredictedRiskProductWhenNoObservations,
  effectiveBaseRiskScoreForPredictedRisk,
  forecastConfidenceScoreFromObservationCount,
  forecastModeFromObservationCount,
  INJURY_WEATHER_MODEL,
  normalizeWorkSchedule,
  scheduleExposureLikelihoodMultiplier,
  seasonalFactorFromMonthLabel,
} from "./riskModel";

describe("forecast mode + confidence (liveSignals.length)", () => {
  it("uses baseline_only and 0.4 when there are no observations", () => {
    expect(forecastModeFromObservationCount(0)).toBe("baseline_only");
    expect(forecastConfidenceScoreFromObservationCount(0)).toBe(INJURY_WEATHER_MODEL.FORECAST_CONFIDENCE_BASELINE_ONLY);
  });

  it("uses live_adjusted and 0.8 when there is at least one row", () => {
    expect(forecastModeFromObservationCount(1)).toBe("live_adjusted");
    expect(forecastConfidenceScoreFromObservationCount(12)).toBe(INJURY_WEATHER_MODEL.FORECAST_CONFIDENCE_LIVE_ADJUSTED);
  });
});

describe("baseline engine", () => {
  it("sums month + trade + severity into baselineRisk", () => {
    const m = computeAvgInjuryRateByMonth("January 2026");
    const t = computeAvgInjuryRateByTrade(1);
    const s = computeAvgSeverityWeight(50, 10);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThanOrEqual(INJURY_WEATHER_MODEL.BASELINE_MONTH_POINTS_MAX);
    expect(t).toBeGreaterThan(0);
    expect(s).toBeCloseTo(17, 5);
    const b = computeBaselineRisk({
      monthLabel: "January 2026",
      tradeWeatherWeight: 1,
      severityRatioPct: 50,
      signalRowCount: 10,
    });
    expect(b.baselineRisk).toBeCloseTo(m + t + s, 5);
  });

  it("uses severity prior when signalRowCount is 0", () => {
    const b = computeBaselineRisk({
      monthLabel: "April 2026",
      tradeWeatherWeight: 1,
      severityRatioPct: 0,
      signalRowCount: 0,
    });
    expect(b.avgSeverityWeight).toBe(INJURY_WEATHER_MODEL.BASELINE_SEVERITY_WEIGHT_WHEN_NO_SIGNALS);
  });

  it("computeBaseRiskScore layers structural overlay on baseline", () => {
    const base = computeBaseRiskScore({
      severityRatioPct: 40,
      highRiskCategoryConcentration: 20,
      repeatIssueRate: 10,
      workforceSignalDensityPct: null,
      monthLabel: "April 2026",
      tradeWeatherWeight: 1,
      signalRowCount: 5,
    });
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThanOrEqual(100);
  });

  it("applies stronger signal blend when more rows reinforce baseline and overlay", () => {
    const common = {
      severityRatioPct: 40,
      highRiskCategoryConcentration: 25,
      repeatIssueRate: 12,
      workforceSignalDensityPct: null as number | null,
      monthLabel: "June 2026",
      tradeWeatherWeight: 1,
    };
    const sparse = computeBaseRiskScore({ ...common, signalRowCount: 2 });
    const dense = computeBaseRiskScore({ ...common, signalRowCount: 45 });
    expect(dense).toBeGreaterThan(sparse);
  });
});

describe("computeTrendSignalValidationMultiplier", () => {
  it("is 1 when there are no signal rows", () => {
    expect(
      computeTrendSignalValidationMultiplier({
        severityRatioPct: 80,
        highRiskCategoryConcentration: 50,
        repeatIssueRate: 40,
        workforceSignalDensityPct: null,
        trendPressurePct: 90,
        momentumBoostPct: 20,
        signalRowCount: 0,
      })
    ).toBe(1);
  });

  it("is >1 when trend and signal stress align with live rows", () => {
    const m = computeTrendSignalValidationMultiplier({
      severityRatioPct: 70,
      highRiskCategoryConcentration: 55,
      repeatIssueRate: 45,
      workforceSignalDensityPct: 20,
      trendPressurePct: 75,
      momentumBoostPct: 18,
      signalRowCount: 10,
    });
    expect(m).toBeGreaterThan(1);
    expect(m).toBeLessThanOrEqual(1 + INJURY_WEATHER_MODEL.TREND_SIGNAL_VALIDATION_CAP + 0.001);
  });
});

describe("normalizeWorkSchedule", () => {
  it("defaults hoursPerDay to null when missing", () => {
    expect(normalizeWorkSchedule({ workSevenDaysPerWeek: false })).toEqual({
      workSevenDaysPerWeek: false,
      hoursPerDay: null,
    });
  });

  it("clamps hours per day to a sensible range", () => {
    expect(normalizeWorkSchedule({ hoursPerDay: 100 }).hoursPerDay).toBe(24);
    expect(normalizeWorkSchedule({ hoursPerDay: 0.1 }).hoursPerDay).toBe(0.25);
  });
});

describe("scheduleExposureLikelihoodMultiplier", () => {
  it("returns 1 when no schedule signal is provided", () => {
    expect(scheduleExposureLikelihoodMultiplier(undefined)).toBe(1);
    expect(scheduleExposureLikelihoodMultiplier(null)).toBe(1);
    expect(scheduleExposureLikelihoodMultiplier({})).toBe(1);
  });

  it("increases multiplier for 7-day week at default 8h vs 40h reference", () => {
    const m = scheduleExposureLikelihoodMultiplier({ workSevenDaysPerWeek: true });
    expect(m).toBeGreaterThan(1);
    expect(m).toBeLessThanOrEqual(1.22);
    // 7×8 = 56h → ratio 1.4 → extra 0.16 → ×1.16
    expect(m).toBeCloseTo(1.16, 5);
  });

  it("increases multiplier for longer days on a 5-day week", () => {
    const m = scheduleExposureLikelihoodMultiplier({ hoursPerDay: 10 });
    // 5×10 = 50h → ratio 1.25 → extra 0.10 → ×1.10
    expect(m).toBeCloseTo(1.1, 5);
  });

  it("caps lift at SCHEDULE_EXPOSURE_MAX_LIFT", () => {
    const m = scheduleExposureLikelihoodMultiplier({ workSevenDaysPerWeek: true, hoursPerDay: 16 });
    expect(m).toBeCloseTo(1.22, 5);
  });
});

describe("effectiveBaseRiskScoreForPredictedRisk", () => {
  it("floors base risk when there are no signal rows", () => {
    expect(effectiveBaseRiskScoreForPredictedRisk(0, 0)).toBe(INJURY_WEATHER_MODEL.BASE_RISK_PRIOR_WHEN_NO_SIGNALS);
    expect(effectiveBaseRiskScoreForPredictedRisk(3, 0)).toBe(INJURY_WEATHER_MODEL.BASE_RISK_PRIOR_WHEN_NO_SIGNALS);
  });

  it("uses structural score when at least one signal row exists", () => {
    expect(effectiveBaseRiskScoreForPredictedRisk(0, 1)).toBe(0);
    expect(effectiveBaseRiskScoreForPredictedRisk(7, 2)).toBe(7);
  });
});

describe("computePredictedRiskProduct", () => {
  it("no-observations path uses baseline × seasonal × site only (behavior/schedule/weather = 1)", () => {
    const base = effectiveBaseRiskScoreForPredictedRisk(0, 0);
    const noObs = computePredictedRiskProductWhenNoObservations({
      baseRiskScore: base,
      monthLabel: "April 2026",
      tradeWeatherWeight: 1.1,
    });
    const full = computePredictedRiskProduct({
      baseRiskScore: base,
      monthLabel: "April 2026",
      behaviorSignals: null,
      workSchedule: null,
      tradeWeatherWeight: 1.1,
      weatherRiskMultiplier: 1,
    });
    expect(noObs.predictedRisk).toBeCloseTo(full.predictedRisk, 5);
    expect(noObs.factors.realTimeBehaviorFactor).toBe(1);
    expect(noObs.factors.scheduleExposureFactor).toBe(1);
    expect(noObs.factors.weatherFactor).toBe(1);
    expect(noObs.factors.siteConditionFactor).toBeCloseTo(full.factors.siteConditionFactor, 10);
  });

  it("gives historicalBaseline above 1 when no-signal prior is applied (base 0 → effective prior)", () => {
    const baseForProduct = effectiveBaseRiskScoreForPredictedRisk(0, 0);
    const out = computePredictedRiskProduct({
      baseRiskScore: baseForProduct,
      monthLabel: "April 2026",
      behaviorSignals: null,
      workSchedule: null,
      tradeWeatherWeight: 1,
      weatherRiskMultiplier: 1,
    });
    expect(out.factors.historicalBaseline).toBeGreaterThan(1);
    expect(out.factors.historicalBaseline).toBeCloseTo(1 + (baseForProduct / 100) * INJURY_WEATHER_MODEL.HISTORICAL_BASELINE_CAP, 10);
  });

  it("includes scheduleExposureFactor in the product and factors", () => {
    const base = computePredictedRiskProduct({
      baseRiskScore: 40,
      monthLabel: "April 2026",
      behaviorSignals: null,
      workSchedule: { workSevenDaysPerWeek: true, hoursPerDay: 8 },
      tradeWeatherWeight: 1,
      weatherRiskMultiplier: 1,
    });
    expect(base.factors.scheduleExposureFactor).toBeGreaterThan(1);
    expect(base.predictedRisk).toBeGreaterThan(0);
    const manual =
      base.factors.historicalBaseline *
      base.factors.seasonalFactor *
      base.factors.realTimeBehaviorFactor *
      base.factors.scheduleExposureFactor *
      base.factors.siteConditionFactor *
      base.factors.weatherFactor;
    const floor = computeMinimumRiskFloor(base.factors.historicalBaseline, "April 2026");
    expect(base.predictedRisk).toBeCloseTo(Math.round(Math.max(floor, manual) * 1000) / 1000, 5);
  });

  it("enforces minimumRiskFloor = historicalBaseline × monthlyFactor", () => {
    const out = computePredictedRiskProduct({
      baseRiskScore: 35,
      monthLabel: "April 2026",
      behaviorSignals: null,
      workSchedule: null,
      tradeWeatherWeight: 0.82,
      weatherRiskMultiplier: 0.9,
    });
    const floor = computeMinimumRiskFloor(out.factors.historicalBaseline, "April 2026");
    expect(out.predictedRisk).toBeGreaterThanOrEqual(Math.round(floor * 1000) / 1000);
    expect(floor).toBeCloseTo(out.factors.historicalBaseline * seasonalFactorFromMonthLabel("April 2026"), 10);
  });
});

describe("behavioralLikelihoodAdjustmentFromMonthLabel", () => {
  it("applies schedule multiplier on top of calendar factors", () => {
    const without = behavioralLikelihoodAdjustmentFromMonthLabel("April 2026", null, null);
    const withSeven = behavioralLikelihoodAdjustmentFromMonthLabel("April 2026", null, {
      workSevenDaysPerWeek: true,
    });
    expect(withSeven).toBeGreaterThan(without);
  });
});
