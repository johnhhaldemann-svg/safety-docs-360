import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAiForecastOverride,
  computeConfidenceRubric,
  extractResponsesApiOutputText,
  fallbackDashboardBlocksFromData,
  generateInjuryWeatherAiInsights,
  validateAiInsightsAgainstData,
  validateForecastOverride,
} from "./ai";
import { offlineInjuryWeatherBenchmarkContext } from "@/lib/benchmarking/industryBenchmarkDataset";
import { DEMO_LIKELY_INJURY_INSIGHT } from "@/lib/injuryWeather/likelyInjuryFromSignals";
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
    industryBenchmarkContext: offlineInjuryWeatherBenchmarkContext(),
    monthlyFocus: [
      { rank: 1, title: "Roofing: Fall Protection", rationale: "HIGH risk in window.", sources: ["workspace"] },
    ],
    engineDiagnostics: { seedOnlyMode: false, liveSignalRowCount: 40 },
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

describe("extractResponsesApiOutputText", () => {
  it("uses top-level output_text when present", () => {
    expect(extractResponsesApiOutputText({ output_text: "  hello  " })).toBe("hello");
  });

  it("aggregates output_text parts from output[].content[]", () => {
    expect(
      extractResponsesApiOutputText({
        output: [
          {
            type: "message",
            role: "assistant",
            content: [
              { type: "output_text", text: '{"headline"' },
              { type: "output_text", text: ':"x"}' },
            ],
          },
        ],
      })
    ).toBe('{"headline":"x"}');
  });

  it("returns null when no extractable text", () => {
    expect(extractResponsesApiOutputText({ output: [] })).toBe(null);
    expect(extractResponsesApiOutputText(null)).toBe(null);
  });
});

describe("validateForecastOverride", () => {
  it("rejects when overall band is more than one step from deterministic", () => {
    const d = minimalDashboard({ summary: { ...minimalDashboard().summary, overallRiskLevel: "HIGH" } });
    const bad = {
      overallRiskLevel: "LOW",
      likelyInjury: { headline: "h", secondaryLine: null, detailNote: "d" },
    };
    expect(validateForecastOverride(d, bad)).toBe(false);
  });

  it("rejects unknown trade in patches", () => {
    const d = minimalDashboard();
    const bad = {
      overallRiskLevel: "HIGH",
      likelyInjury: { headline: "h", secondaryLine: null, detailNote: "d" },
      trades: [{ trade: "Plumbing", categories: [{ name: "Fall Protection", riskLevel: "LOW" as const }] }],
    };
    expect(validateForecastOverride(d, bad)).toBe(false);
  });

  it("accepts ±1 band and valid category patch", () => {
    const d = minimalDashboard();
    const ok = {
      overallRiskLevel: "MODERATE",
      likelyInjury: { headline: "Strains and falls", secondaryLine: null, detailNote: "Grounded note." },
      trades: [{ trade: "Roofing", categories: [{ name: "Fall Protection", riskLevel: "CRITICAL" as const }] }],
    };
    expect(validateForecastOverride(d, ok)).toBe(true);
  });
});

describe("applyAiForecastOverride", () => {
  it("merges overall band, likely injury, and category risk levels", () => {
    const d = minimalDashboard();
    const merged = applyAiForecastOverride(d, {
      overallRiskLevel: "CRITICAL",
      likelyInjury: {
        headline: "AI headline",
        secondaryLine: "AI secondary",
        detailNote: "AI detail",
        hasData: true,
      },
      trades: [{ trade: "Roofing", categories: [{ name: "Fall Protection", riskLevel: "MODERATE" }] }],
    });
    expect(merged.summary.overallRiskLevel).toBe("CRITICAL");
    expect(merged.summary.riskBandLabelV2).toBe("Severe");
    expect(merged.summary.likelyInjuryInsight.headline).toBe("AI headline");
    expect(merged.tradeForecasts[0].categories[0].riskLevel).toBe("MODERATE");
    expect(d.summary.overallRiskLevel).toBe("HIGH");
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
    const { insights: out, forecastOverride } = await generateInjuryWeatherAiInsights(d);
    expect(forecastOverride).toBeNull();
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
    const { insights: out, forecastOverride } = await generateInjuryWeatherAiInsights(d);
    expect(forecastOverride).toBeNull();
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

  it("parses Responses body when only output[].content[] is present (no top-level output_text)", async () => {
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
    const responseBody = {
      id: "resp_mock",
      object: "response",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: JSON.stringify(apiPayload) }],
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const d = minimalDashboard();
    const { insights: out, forecastOverride } = await generateInjuryWeatherAiInsights(d);
    expect(forecastOverride).toBeNull();
    expect(out.headline).toContain("Roofing");
    expect(validateAiInsightsAgainstData(out, d)).toBe(true);
  });

  it("falls back when API returns non-ok", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-mock-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error", { status: 500 }));
    const d = minimalDashboard();
    const { insights: out, forecastOverride } = await generateInjuryWeatherAiInsights(d);
    expect(forecastOverride).toBeNull();
    expect(out.headline).toContain("Jan 2026");
    expect(out.likelyInjuryDrivers.length).toBeGreaterThanOrEqual(3);
  });

  it("returns validated forecastOverride when requestForecastOverride and model supplies valid patch", async () => {
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
      forecastOverride: {
        overallRiskLevel: "MODERATE",
        likelyInjury: {
          headline: "Override headline",
          secondaryLine: null,
          detailNote: "Override detail grounded in signals.",
        },
        trades: [{ trade: "Roofing", categories: [{ name: "Fall Protection", riskLevel: "CRITICAL" as const }] }],
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: JSON.stringify(apiPayload) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const d = minimalDashboard();
    const { insights: out, forecastOverride } = await generateInjuryWeatherAiInsights(d, {
      requestForecastOverride: true,
    });
    expect(validateAiInsightsAgainstData(out, d)).toBe(true);
    expect(forecastOverride).not.toBeNull();
    expect(forecastOverride?.overallRiskLevel).toBe("MODERATE");
    expect(forecastOverride?.trades?.[0].categories[0].riskLevel).toBe("CRITICAL");
  });
});

describe.skipIf(!process.env.OPENAI_API_KEY?.trim())("generateInjuryWeatherAiInsights (live OpenAI)", () => {
  it(
    "returns grounded structured insights from the real API",
    async () => {
      const d = minimalDashboard();
      const { insights: out } = await generateInjuryWeatherAiInsights(d);
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
