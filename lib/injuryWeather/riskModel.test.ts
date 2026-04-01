import { describe, expect, it } from "vitest";
import {
  behavioralLikelihoodAdjustmentFromMonthLabel,
  computePredictedRiskProduct,
  normalizeWorkSchedule,
  scheduleExposureLikelihoodMultiplier,
} from "./riskModel";

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

describe("computePredictedRiskProduct", () => {
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
    expect(base.predictedRisk).toBeCloseTo(Math.round(manual * 1000) / 1000, 5);
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
