import { offlineInjuryWeatherBenchmarkContext } from "@/lib/benchmarking/industryBenchmarkDataset";
import { DEMO_LIKELY_INJURY_INSIGHT } from "@/lib/injuryWeather/likelyInjuryFromSignals";
import { buildMonthlyFocusItems } from "@/lib/injuryWeather/monthlyFocus";
import { describe, expect, it } from "vitest";
import type { InjuryWeatherDashboardData } from "@/lib/injuryWeather/types";

function baseDashboard(): InjuryWeatherDashboardData {
  return {
    summary: {
      month: "April 2026",
      riskSignalCount: 10,
      highSeveritySignalCount: 2,
      predictedInjuriesNextMonth: 2,
      increasedIncidentRiskPercent: 20,
      overallRiskLevel: "MODERATE",
      structuralRiskScore: 40,
      riskModelVersion: "3.0.0",
      predictedRisk: 1.2,
      predictedRiskFactors: {
        historicalBaseline: 1,
        seasonalFactor: 1,
        realTimeBehaviorFactor: 1,
        scheduleExposureFactor: 1,
        siteConditionFactor: 1,
        weatherFactor: 1,
      },
      lastUpdatedAt: new Date().toISOString(),
      dataConfidence: "MEDIUM",
      forecastMode: "live_adjusted",
      forecastConfidenceScore: 0.7,
      likelyInjuryInsight: DEMO_LIKELY_INJURY_INSIGHT,
    },
    tradeForecasts: [
      {
        trade: "Electrical",
        forecastProvenance: "live",
        categories: [
          { name: "Arc flash exposure", predictedCount: 3, riskLevel: "HIGH", sourceObservationCount: 2 },
        ],
      },
    ],
    alerts: [],
    trend: [],
    recommendedControls: [],
    monthlyTrainingRecommendations: [],
    availableMonths: [],
    availableTrades: ["Electrical"],
    location: {
      stateCode: null,
      displayName: "National",
      weatherRiskMultiplier: 1,
      tradeWeatherWeight: 1,
      combinedWeatherFactor: 1,
      impactNote: "",
    },
    signalProvenance: {
      mode: "live",
      sorRecords: 5,
      correctiveActions: 3,
      incidents: 2,
      recordWindowLabel: "Test",
      alertsAreIllustrative: true,
    },
    behaviorSignals: { fatigueIndicators: 0, rushingIndicators: 0, newWorkerRatio: 0, overtimeHours: 0 },
    workSchedule: { workSevenDaysPerWeek: false, hoursPerDay: null },
    industryBenchmarkContext: offlineInjuryWeatherBenchmarkContext(),
    monthlyFocus: [],
    engineDiagnostics: { seedOnlyMode: false, liveSignalRowCount: 10 },
  };
}

describe("buildMonthlyFocusItems", () => {
  it("includes workspace-tagged trade/category and sector_reference for matched trade", () => {
    const items = buildMonthlyFocusItems(baseDashboard());
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.sources.includes("workspace"))).toBe(true);
    expect(items.some((i) => i.title.includes("Electrical"))).toBe(true);
  });

  it("still returns at least one focus row when trade forecasts are empty", () => {
    const d = baseDashboard();
    d.tradeForecasts = [];
    d.summary.likelyInjuryInsight = {
      headline: "Not enough data",
      secondaryLine: null,
      detailNote: "Log data",
      hasData: false,
    };
    const items = buildMonthlyFocusItems(d);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some((i) => i.sources.includes("workspace"))).toBe(true);
  });
});
