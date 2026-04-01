import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeConfidenceRubric,
  fallbackDashboardBlocksFromData,
  generateInjuryWeatherAiInsights,
  validateAiInsightsAgainstData,
} from "./ai";
import type { InjuryWeatherAiInsights, InjuryWeatherDashboardData } from "./types";

function blocksFor(d: InjuryWeatherDashboardData): Pick<
  InjuryWeatherAiInsights,
  "priorityThemes" | "monthlyTrainingRecommendations" | "recommendedControls"
> {
  return fallbackDashboardBlocksFromData(d);
}

function minimalDashboard(overrides: Partial<InjuryWeatherDashboardData> = {}): InjuryWeatherDashboardData {
  const base: InjuryWeatherDashboardData = {
    summary: {
      month: "Jan 2026",
      riskSignalCount: 40,
      highSeveritySignalCount: 8,
      predictedInjuriesNextMonth: 12,
      increasedIncidentRiskPercent: 35,
      overallRiskLevel: "HIGH",
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
  it("returns LOW when there are no observations", () => {
    const d = minimalDashboard({
      summary: {
        ...minimalDashboard().summary,
        riskSignalCount: 0,
        forecastMode: "baseline_only",
        forecastConfidenceScore: 0.4,
      },
    });
    expect(computeConfidenceRubric(d)).toBe("LOW");
  });

  it("returns LOW when observation count is sparse", () => {
    const d = minimalDashboard({
      summary: { ...minimalDashboard().summary, riskSignalCount: 5 },
    });
    expect(computeConfidenceRubric(d)).toBe("LOW");
  });

  it("returns HIGH when data is dense enough", () => {
    const d = minimalDashboard({
      summary: { ...minimalDashboard().summary, riskSignalCount: 50 },
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
        ...blocksFor(d),
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
        ...blocksFor(d),
      },
      d
    );
    expect(ok).toBe(true);
  });
});

describe("generateInjuryWeatherAiInsights", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses deterministic fallback when OPENAI_API_KEY is unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const d = minimalDashboard();
    const out = await generateInjuryWeatherAiInsights(d);
    expect(out.likelyInjuryDrivers.length).toBe(3);
    expect(out.priorityActions.length).toBe(3);
    expect(validateAiInsightsAgainstData(out, d)).toBe(true);
  });

  it("parses successful OpenAI Responses output_text JSON and applies guards", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-mock-test");
    const apiPayload = {
      headline: "Jan 2026 signals concentrate on Roofing with Fall Protection as the top hazard category.",
      likelyInjuryDrivers: [
        "High/critical-weight share is 20% across 40 risk signals in totals.",
        "Trend series shows recent momentum in trendSignals for the forecast window.",
        "Roofing appears in tradeSignals.topTrades with Fall Protection as a named category.",
      ],
      priorityActions: [
        "Verify fall protection and anchorage for Roofing crews within 7–30 days using documented walkthroughs.",
        "Tighten pre-task planning for the top Roofing hazard categories shown in tradeSignals.",
        "Executing these controls improves conditions over time; the leading-indicator exposure estimate does not drop instantly.",
      ],
      confidence: "MEDIUM",
      priorityThemes: [
        {
          title: "Roofing: Fall Protection — verify harness and anchor points",
          dueLabel: "Emphasize over the next 7–14 days",
          severity: "HIGH" as const,
        },
        {
          title: "Roofing: Edge protection — strengthen guardrail coverage",
          dueLabel: "Plan emphasis over the next 7–30 days",
          severity: "MODERATE" as const,
        },
        {
          title: "Roofing: Ladder use — inspection cadence",
          dueLabel: "Plan emphasis over the next 7–30 days",
          severity: "MODERATE" as const,
        },
      ],
      monthlyTrainingRecommendations: [
        "Fall protection refresher aligned to Roofing trade signals.",
        "Ladder inspection competency for crews on elevated work.",
        "Pre-task planning workshop for foremen covering top categories.",
      ],
      recommendedControls: [
        "Roofing crews: daily harness and lanyard inspection before elevated work.",
        "Fall protection: document anchorages and competent person signoff.",
        "Roofing: increase ladder inspection frequency on site this month.",
        "Trade-specific toolbox talk on Roofing fall hazards tied to observed categories.",
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: JSON.stringify(apiPayload) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const d = minimalDashboard();
    const out = await generateInjuryWeatherAiInsights(d);
    expect(out.headline).toContain("Roofing");
    expect(out.likelyInjuryDrivers).toHaveLength(3);
    expect(out.priorityThemes).toHaveLength(3);
    expect(out.monthlyTrainingRecommendations).toHaveLength(3);
    expect(out.recommendedControls).toHaveLength(4);
    expect(validateAiInsightsAgainstData(out, d)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back when API returns non-ok", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-mock-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error", { status: 500 }));
    const d = minimalDashboard();
    const out = await generateInjuryWeatherAiInsights(d);
    expect(out.headline).toContain("Jan 2026");
    expect(out.likelyInjuryDrivers.length).toBeGreaterThanOrEqual(3);
  });
});

describe.skipIf(!process.env.OPENAI_API_KEY?.trim())("generateInjuryWeatherAiInsights (live OpenAI)", () => {
  it(
    "returns grounded structured insights from the real API",
    async () => {
      const d = minimalDashboard();
      const out = await generateInjuryWeatherAiInsights(d);
      expect(out.headline?.length ?? 0).toBeGreaterThan(15);
      expect(out.likelyInjuryDrivers).toHaveLength(3);
      expect(out.priorityActions).toHaveLength(3);
      expect(out.priorityThemes).toHaveLength(3);
      expect(out.monthlyTrainingRecommendations).toHaveLength(3);
      expect(out.recommendedControls).toHaveLength(4);
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(out.confidence);
      expect(validateAiInsightsAgainstData(out, d)).toBe(true);
    },
    120_000
  );
});
