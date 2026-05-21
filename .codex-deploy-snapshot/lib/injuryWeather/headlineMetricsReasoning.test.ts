import { describe, expect, it } from "vitest";
import { buildHeadlineMetricsReasoning } from "./headlineMetricsReasoning";
import { DEMO_LIKELY_INJURY_INSIGHT } from "./likelyInjuryFromSignals";
import { offlineInjuryWeatherBenchmarkContext } from "@/lib/benchmarking/industryBenchmarkDataset";
import type { InjuryWeatherDashboardData } from "./types";

function baseDashboard(): InjuryWeatherDashboardData {
  return {
    summary: {
      month: "Jan 2026",
      riskSignalCount: 40,
      highSeveritySignalCount: 8,
      predictedInjuriesNextMonth: 12,
      increasedIncidentRiskPercent: 35,
      overallRiskLevel: "HIGH",
      riskBandLabelV2: "High",
      finalRiskScore: 48,
      structuralRiskScore: 48,
      riskModelVersion: "3.0.0",
      overallRiskScore: 48,
      predictedRisk: 2.1,
      predictedRiskFactors: {
        historicalBaseline: 1.19,
        seasonalFactor: 1.15,
        realTimeBehaviorFactor: 1,
        scheduleExposureFactor: 1,
        siteConditionFactor: 1.15,
        weatherFactor: 1,
      },
      lastUpdatedAt: new Date().toISOString(),
      dataConfidence: "MEDIUM",
      forecastMode: "live_adjusted",
      forecastConfidenceScore: 0.8,
      likelyInjuryInsight: DEMO_LIKELY_INJURY_INSIGHT,
    },
    tradeForecasts: [],
    alerts: [],
    trend: [],
    recommendedControls: [],
    monthlyTrainingRecommendations: [],
    availableMonths: [],
    availableTrades: [],
    location: {
      stateCode: null,
      displayName: "National",
      weatherRiskMultiplier: 1,
      tradeWeatherWeight: 1,
      combinedWeatherFactor: 1,
      impactNote: "Test note",
    },
    signalProvenance: {
      mode: "live",
      sorRecords: 30,
      correctiveActions: 5,
      incidents: 5,
      recordWindowLabel: "Test window",
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
    monthlyFocus: [],
    engineDiagnostics: { seedOnlyMode: false, liveSignalRowCount: 40 },
  };
}

describe("buildHeadlineMetricsReasoning", () => {
  it("mentions likelihood percent and structural mapping", () => {
    const lines = buildHeadlineMetricsReasoning(baseDashboard(), null);
    expect(lines[0]).toContain("35%");
    expect(lines[0]).toContain("structural");
    expect(lines[1]).toContain("HIGH");
    expect(lines[1]).toContain("V2");
  });

  it("adds AI delta line when forecast applied and model band differs", () => {
    const d = baseDashboard();
    const lines = buildHeadlineMetricsReasoning(d, null, {
      aiForecastApplied: true,
      modelOverallRiskLevel: "LOW",
    });
    expect(lines.some((l) => l.includes("AI-adjusted") && l.includes("deterministic model"))).toBe(true);
  });

  it("mentions web research disclaimer when supplement present", () => {
    const lines = buildHeadlineMetricsReasoning(baseDashboard(), {
      headline: "h",
      likelyInjuryDrivers: [],
      priorityActions: [],
      confidence: "LOW",
      priorityThemes: [],
      monthlyTrainingRecommendations: [],
      recommendedControls: [],
      webResearchSupplement: {
        triggeredBySparseData: true,
        querySummary: "q",
        bullets: [],
        citations: [],
        disclaimer: "d",
      },
    });
    expect(lines.some((l) => l.includes("web research"))).toBe(true);
  });
});
