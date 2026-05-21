import { describe, expect, it } from "vitest";
import { buildPredictiveRiskPayload, buildSalesDemoPredictiveRiskPayload } from "@/lib/predictiveRisk";
import type { InjuryWeatherDashboardData } from "@/lib/injuryWeather/types";

function forecastFixture(partial?: Partial<InjuryWeatherDashboardData>): InjuryWeatherDashboardData {
  return {
    summary: {
      month: "May 2026",
      riskSignalCount: 6,
      highSeveritySignalCount: 2,
      predictedInjuriesNextMonth: 3.4,
      increasedIncidentRiskPercent: 61,
      overallRiskLevel: "HIGH",
      structuralRiskScore: 61,
      riskModelVersion: "test-model",
      predictedRisk: 61,
      predictedRiskFactors: {
        historicalBaseline: 1,
        seasonalFactor: 1,
        realTimeBehaviorFactor: 1,
        scheduleExposureFactor: 1,
        siteConditionFactor: 1,
        weatherFactor: 1,
      },
      dataConfidence: "HIGH",
      forecastMode: "live_adjusted",
      forecastConfidenceScore: 0.82,
      lastUpdatedAt: "2026-05-01T12:00:00.000Z",
      likelyInjuryInsight: {
        headline: "Fall risk elevated",
        secondaryLine: null,
        detailNote: "Fixture",
        hasData: true,
      },
    },
    tradeForecasts: [
      {
        trade: "General Contractor",
        categories: [{ name: "Fall protection", predictedCount: 4, riskLevel: "HIGH" }],
      },
    ],
    alerts: [],
    trend: [
      { month: "Apr 10", value: 20 },
      { month: "Apr 20", value: 42 },
      { month: "May 1", value: 61 },
    ],
    recommendedControls: ["Verify fall protection controls."],
    monthlyTrainingRecommendations: [],
    availableMonths: ["May 2026"],
    availableTrades: ["General Contractor"],
    location: {
      stateCode: "TX",
      displayName: "Texas",
      weatherRiskMultiplier: 1,
      impactNote: "Fixture",
    },
    signalProvenance: {
      mode: "live",
      sorRecords: 1,
      correctiveActions: 2,
      incidents: 1,
      recordWindowLabel: "Fixture window",
      alertsAreIllustrative: true,
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
    industryBenchmarkContext: {
      injuryFactsIndustryProfilesUrl: "",
      injuryFactsIncidentTrendsUrl: "",
      dominantNaicsPrefix: null,
      exampleIndustryCode: null,
      recordableCasesPer200kHours: null,
      benchmarkSummary: "Fixture",
      oshaNationalConstruction: undefined as never,
    },
    monthlyFocus: [],
    engineDiagnostics: {
      seedOnlyMode: false,
      liveSignalRowCount: 4,
    },
    ...partial,
  };
}

describe("buildPredictiveRiskPayload", () => {
  it("ranks locations and summarizes top risk drivers", () => {
    const payload = buildPredictiveRiskPayload({
      days: 30,
      forecast: forecastFixture(),
      jobsites: [
        { id: "j1", name: "North Building", location: "Austin" },
        { id: "j2", name: "South Yard", location: "Austin" },
      ],
      correctiveActions: [
        {
          id: "a1",
          title: "Guardrail gap",
          category: "fall_protection",
          severity: "high",
          status: "open",
          due_at: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date().toISOString(),
          jobsite_id: "j1",
          sif_potential: true,
        },
        {
          id: "a2",
          title: "Clear aisle",
          category: "housekeeping",
          severity: "medium",
          status: "open",
          created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
          jobsite_id: "j2",
        },
      ],
      incidents: [
        {
          id: "i1",
          title: "Recordable",
          category: "machine_guarding",
          severity: "high",
          status: "open",
          created_at: new Date().toISOString(),
          jobsite_id: "j1",
          sif_flag: true,
        },
      ],
      permits: [],
      jsaActivities: [
        {
          id: "j1-activity",
          jobsite_id: "j1",
          work_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          trade: "Electrical",
          activity_name: "LOTO panel verification",
          hazard_category: "electrical",
          mitigation: "Use PPE and be careful.",
          planned_risk_level: "high",
          status: "planned",
        },
      ],
    });

    expect(payload.summary.predictedIncidents).toBe(3);
    expect(payload.summary.confidencePercent).toBe(82);
    expect(payload.locations[0]?.label).toBe("North Building");
    expect(payload.locations[0]?.riskScore).toBeGreaterThan(payload.locations[1]?.riskScore ?? 0);
    expect(payload.drivers.map((driver) => driver.label)).toContain("Fall Protection");
    expect(payload.actions[0]?.target).toBe("North Building");
    expect(payload.behaviorRisk.behaviorRiskScore).toBeGreaterThan(0);
    expect(payload.behaviorRisk.topDrivers.map((driver) => driver.driver)).toContain("weak_jsa_language");
    expect(payload.safetyAiAssessment.score).toBeGreaterThan(0);
    expect(payload.safetyAiAssessment.topDrivers.length).toBeGreaterThan(0);
    expect(payload.safetyAiAssessment.explanation).toContain("Based on available data");
  });

  it("falls back to forecast categories when no jobsite-aware rows exist", () => {
    const payload = buildPredictiveRiskPayload({
      days: 30,
      forecast: forecastFixture(),
      jobsites: [],
      correctiveActions: [],
      incidents: [],
      permits: [],
      jsaActivities: [],
    });

    expect(payload.locations).toEqual([]);
    expect(payload.drivers[0]?.label).toBe("Fall Protection");
    expect(payload.summary.averageRiskScore).toBe(61);
    expect(payload.model.provenanceNote).toContain("No jobsite-aware records");
    expect(payload.behaviorRisk.riskLevel).toBe("Low");
    expect(payload.safetyAiAssessment.confidence).toBe("low");
    expect(payload.safetyAiAssessment.missingData).toContain("recent safety signals");
  });

  it("builds a populated sales demo payload", () => {
    const payload = buildSalesDemoPredictiveRiskPayload(30);
    expect(payload.locations.length).toBeGreaterThan(0);
    expect(payload.summary.confidencePercent).toBe(85);
    expect(payload.actions.length).toBeGreaterThan(0);
    expect(payload.behaviorRisk.behaviorRiskScore).toBeGreaterThan(0);
    expect(payload.safetyAiAssessment.level).toBe("critical");
    expect(payload.safetyAiAssessment.stopWorkReviewRecommended).toBe(true);
  });
});
