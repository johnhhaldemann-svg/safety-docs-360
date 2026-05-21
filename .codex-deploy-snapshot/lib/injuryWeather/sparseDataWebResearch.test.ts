import { offlineInjuryWeatherBenchmarkContext } from "@/lib/benchmarking/industryBenchmarkDataset";
import { DEMO_LIKELY_INJURY_INSIGHT } from "@/lib/injuryWeather/likelyInjuryFromSignals";
import {
  injuryWeatherNeedsWebResearchFill,
  isInjuryWeatherSparseWebResearchEnabled,
} from "@/lib/injuryWeather/sparseDataWebResearch";
import type { InjuryWeatherDashboardData } from "@/lib/injuryWeather/types";
import { describe, expect, it, vi } from "vitest";

function dash(overrides: Partial<InjuryWeatherDashboardData> = {}): InjuryWeatherDashboardData {
  const base: InjuryWeatherDashboardData = {
    summary: {
      month: "May 2026",
      riskSignalCount: 40,
      highSeveritySignalCount: 4,
      predictedInjuriesNextMonth: 2,
      increasedIncidentRiskPercent: 15,
      overallRiskLevel: "MODERATE",
      structuralRiskScore: 35,
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
    tradeForecasts: [{ trade: "Roofing", categories: [{ name: "Fall", predictedCount: 1, riskLevel: "HIGH" }] }],
    alerts: [],
    trend: [],
    recommendedControls: [],
    monthlyTrainingRecommendations: [],
    availableMonths: [],
    availableTrades: ["Roofing"],
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
      sorRecords: 30,
      correctiveActions: 5,
      incidents: 5,
      recordWindowLabel: "All dates",
      alertsAreIllustrative: true,
    },
    behaviorSignals: { fatigueIndicators: 0, rushingIndicators: 0, newWorkerRatio: 0, overtimeHours: 0 },
    workSchedule: { workSevenDaysPerWeek: false, hoursPerDay: null },
    industryBenchmarkContext: offlineInjuryWeatherBenchmarkContext(),
    monthlyFocus: [{ rank: 1, title: "T", rationale: "R", sources: ["workspace"] }],
    engineDiagnostics: { seedOnlyMode: false, liveSignalRowCount: 40 },
  };
  return { ...base, ...overrides };
}

describe("sparseDataWebResearch gates", () => {
  it("is enabled unless INJURY_WEATHER_SPARSE_WEB_RESEARCH=0", () => {
    vi.stubEnv("INJURY_WEATHER_SPARSE_WEB_RESEARCH", "");
    expect(isInjuryWeatherSparseWebResearchEnabled()).toBe(true);
    vi.stubEnv("INJURY_WEATHER_SPARSE_WEB_RESEARCH", "0");
    expect(isInjuryWeatherSparseWebResearchEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("needs fill when few signals or LOW confidence or baseline_only or no likely-injury data", () => {
    expect(injuryWeatherNeedsWebResearchFill(dash())).toBe(false);
    expect(injuryWeatherNeedsWebResearchFill(dash({ summary: { ...dash().summary, riskSignalCount: 3 } }))).toBe(true);
    expect(injuryWeatherNeedsWebResearchFill(dash({ summary: { ...dash().summary, dataConfidence: "LOW" } }))).toBe(true);
    expect(
      injuryWeatherNeedsWebResearchFill(dash({ summary: { ...dash().summary, forecastMode: "baseline_only" } }))
    ).toBe(true);
    expect(
      injuryWeatherNeedsWebResearchFill(
        dash({
          summary: {
            ...dash().summary,
            likelyInjuryInsight: {
              headline: "Not enough data",
              secondaryLine: null,
              detailNote: "x",
              hasData: false,
            },
          },
        })
      )
    ).toBe(true);
  });
});
