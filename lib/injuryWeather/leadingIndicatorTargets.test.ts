import { offlineInjuryWeatherBenchmarkContext } from "@/lib/benchmarking/industryBenchmarkDataset";
import { DEMO_LIKELY_INJURY_INSIGHT } from "@/lib/injuryWeather/likelyInjuryFromSignals";
import { describe, expect, it } from "vitest";
import { buildLeadingIndicatorTargets } from "./leadingIndicatorTargets";
import type { InjuryWeatherDashboardData } from "./types";

function minimalData(overrides: Partial<InjuryWeatherDashboardData> = {}): InjuryWeatherDashboardData {
  const base: InjuryWeatherDashboardData = {
    summary: {
      month: "Apr 2026",
      riskSignalCount: 20,
      highSeveritySignalCount: 6,
      predictedInjuriesNextMonth: 3,
      increasedIncidentRiskPercent: 22,
      overallRiskLevel: "MODERATE",
      structuralRiskScore: 35,
      riskModelVersion: "3.0.0",
      predictedRisk: 1.5,
      predictedRiskFactors: {
        historicalBaseline: 1.1,
        seasonalFactor: 1.05,
        realTimeBehaviorFactor: 1,
        scheduleExposureFactor: 1,
        siteConditionFactor: 1.1,
        weatherFactor: 1,
      },
      lastUpdatedAt: new Date().toISOString(),
      dataConfidence: "LOW",
      forecastMode: "live_adjusted",
      forecastConfidenceScore: 0.8,
      likelyInjuryInsight: DEMO_LIKELY_INJURY_INSIGHT,
    },
    tradeForecasts: [
      {
        trade: "Roofing",
        categories: [
          { name: "Fall Protection", predictedCount: 5, riskLevel: "HIGH", sourceObservationCount: 4 },
        ],
      },
    ],
    alerts: [],
    trend: [],
    recommendedControls: [],
    monthlyTrainingRecommendations: [],
    availableMonths: [],
    availableTrades: ["Roofing"],
    location: {
      stateCode: "WI",
      displayName: "Wisconsin",
      weatherRiskMultiplier: 1,
      tradeWeatherWeight: 1,
      combinedWeatherFactor: 1,
      impactNote: "Test",
    },
    signalProvenance: {
      mode: "live",
      sorRecords: 12,
      correctiveActions: 5,
      incidents: 3,
      recordWindowLabel: "Month-scoped",
      alertsAreIllustrative: true,
    },
    behaviorSignals: {
      fatigueIndicators: 0,
      rushingIndicators: 0,
      newWorkerRatio: 0,
      overtimeHours: 0,
    },
    workSchedule: { workSevenDaysPerWeek: false, hoursPerDay: null },
    industryBenchmarkContext: offlineInjuryWeatherBenchmarkContext(),
  };
  return { ...base, ...overrides };
}

describe("buildLeadingIndicatorTargets", () => {
  it("returns signal mix and trade focus when snapshot has signals", () => {
    const r = buildLeadingIndicatorTargets(minimalData());
    expect(r.items.some((i) => i.label.includes("Signal mix"))).toBe(true);
    expect(r.items.some((i) => i.action.includes("Roofing"))).toBe(true);
  });

  it("flags low observation count", () => {
    const r = buildLeadingIndicatorTargets(
      minimalData({
        summary: {
          ...minimalData().summary,
          riskSignalCount: 1,
          highSeveritySignalCount: 0,
        },
      })
    );
    expect(r.items.some((i) => i.label.includes("Data thickness"))).toBe(true);
  });
});
