import { describe, expect, it } from "vitest";
import { computeConfidenceRubric, validateAiInsightsAgainstData } from "./ai";
import type { InjuryWeatherDashboardData } from "./types";

function minimalDashboard(overrides: Partial<InjuryWeatherDashboardData> = {}): InjuryWeatherDashboardData {
  const base: InjuryWeatherDashboardData = {
    summary: {
      month: "Jan 2026",
      predictedObservations: 40,
      potentialInjuryEvents: 8,
      predictedInjuriesNextMonth: 12,
      increasedIncidentRiskPercent: 35,
      overallRiskLevel: "HIGH",
      structuralRiskScore: 48,
      riskModelVersion: "2.3.0",
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
    },
    tradeForecasts: [
      {
        trade: "Roofing",
        categories: [{ name: "Fall Protection", predictedCount: 10, riskLevel: "HIGH" }],
      },
    ],
    alerts: [],
    trend: [
      { month: "Nov 2025", value: 30 },
      { month: "Dec 2025", value: 32 },
      { month: "Jan 2026", value: 35 },
    ],
    recommendedControls: [],
    monthlyTrainingRecommendations: [],
    availableMonths: ["Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026"],
    availableTrades: ["Roofing"],
    location: {
      stateCode: null,
      displayName: "National",
      weatherRiskMultiplier: 1,
      tradeWeatherWeight: 1,
      combinedWeatherFactor: 1,
      impactNote: "Test",
    },
    signalProvenance: {
      mode: "live",
      sorRecords: 30,
      correctiveActions: 5,
      incidents: 5,
      recordWindowLabel: "Test window",
      alertsAreIllustrative: true,
      blendNormalization: { kind: "row_counts" },
    },
    behaviorSignals: {
      fatigueIndicators: 0,
      rushingIndicators: 0,
      newWorkerRatio: 0,
      overtimeHours: 0,
    },
    workSchedule: {
      workSevenDaysPerWeek: false,
      hoursPerDay: null,
    },
  };
  return { ...base, ...overrides };
}

describe("computeConfidenceRubric", () => {
  it("returns LOW when observation count is sparse", () => {
    const d = minimalDashboard({
      summary: { ...minimalDashboard().summary, predictedObservations: 5 },
    });
    expect(computeConfidenceRubric(d)).toBe("LOW");
  });

  it("returns HIGH when data is dense enough", () => {
    const d = minimalDashboard({
      summary: { ...minimalDashboard().summary, predictedObservations: 50 },
      trend: [
        { month: "m1", value: 1 },
        { month: "m2", value: 2 },
        { month: "m3", value: 3 },
        { month: "m4", value: 4 },
        { month: "m5", value: 5 },
      ],
      availableMonths: ["a", "b", "c", "d"],
    });
    expect(computeConfidenceRubric(d)).toBe("HIGH");
  });
});

describe("validateAiInsightsAgainstData", () => {
  it("rejects echoes of template alert titles", () => {
    const d = minimalDashboard();
    const ok = validateAiInsightsAgainstData(
      {
        headline: "Fall Protection Training Required is a priority",
        likelyInjuryDrivers: ["a", "b", "c"],
        priorityActions: ["x", "y", "z"],
        confidence: "HIGH",
      },
      d
    );
    expect(ok).toBe(false);
  });

  it("accepts grounded roofing copy when Roofing is in trade forecasts", () => {
    const d = minimalDashboard();
    const ok = validateAiInsightsAgainstData(
      {
        headline: "Roofing signals dominate for Jan 2026.",
        likelyInjuryDrivers: ["Driver 1 with numbers", "Driver 2", "Driver 3"],
        priorityActions: ["Action 1", "Action 2", "Action 3"],
        confidence: "MEDIUM",
      },
      d
    );
    expect(ok).toBe(true);
  });
});
