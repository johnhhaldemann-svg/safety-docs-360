import type { InjuryWeatherAiInsights, InjuryWeatherDashboardData } from "@/lib/injuryWeather/types";
import { buildOshaCrossReference } from "@/lib/injuryWeather/oshaHistory";

/** Titles from default dashboard cards — if the model echoes these, treat as ungrounded. */
const FORBIDDEN_ILLUSTRATION_PHRASES = [
  "fall protection training required",
  "temporary power inspection needed",
  "struck-by hazard review",
];

export function computeConfidenceRubric(data: InjuryWeatherDashboardData): InjuryWeatherAiInsights["confidence"] {
  const n = data.summary.predictedObservations;
  const trendLen = data.trend?.length ?? 0;
  const months = data.availableMonths?.length ?? 0;
  if (n < 12 || trendLen < 3 || months < 2) return "LOW";
  if (n >= 45 && trendLen >= 5 && months >= 4) return "HIGH";
  return "MEDIUM";
}

function capConfidence(
  model: InjuryWeatherAiInsights["confidence"],
  rubric: InjuryWeatherAiInsights["confidence"]
): InjuryWeatherAiInsights["confidence"] {
  if (rubric === "LOW") return "LOW";
  if (rubric === "MEDIUM" && model === "HIGH") return "MEDIUM";
  return model;
}

export function validateAiInsightsAgainstData(
  insights: InjuryWeatherAiInsights,
  data: InjuryWeatherDashboardData
): boolean {
  const text = [insights.headline, ...insights.likelyInjuryDrivers, ...insights.priorityActions].join(" ").toLowerCase();
  if (FORBIDDEN_ILLUSTRATION_PHRASES.some((p) => text.includes(p))) return false;
  const allowed = new Set(
    data.tradeForecasts.flatMap((t) => [t.trade, ...t.categories.map((c) => c.name)]).map((s) => s.toLowerCase())
  );
  const TRADE_HINTS = [
    "roofing",
    "electrical",
    "concrete",
    "steel work",
    "masonry",
    "plumbing",
    "hvac",
    "carpentry",
    "demolition",
    "landscaping",
    "glazing",
    "roadwork",
    "earthworks",
  ];
  for (const hint of TRADE_HINTS) {
    if (!text.includes(hint)) continue;
    const ok = [...allowed].some((a) => a.includes(hint) || hint.includes(a));
    if (!ok) return false;
  }
  return true;
}

function applyInsightGuards(
  data: InjuryWeatherDashboardData,
  insights: InjuryWeatherAiInsights
): InjuryWeatherAiInsights {
  const rubric = computeConfidenceRubric(data);
  const confidence = capConfidence(insights.confidence, rubric);
  if (!validateAiInsightsAgainstData(insights, data)) {
    const fb = fallbackInsights(data);
    return { ...fb, confidence: capConfidence(fb.confidence, rubric) };
  }
  return { ...insights, confidence };
}

function computeAiContext(data: InjuryWeatherDashboardData) {
  const trend = data.trend ?? [];
  const last3 = trend.slice(-3).map((p) => p.value);
  const prev3 = trend.slice(-6, -3).map((p) => p.value);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((n, v) => n + v, 0) / arr.length : 0);
  const recentAvg = avg(last3);
  const previousAvg = avg(prev3);
  const momentumPct = previousAvg > 0 ? Math.round(((recentAvg - previousAvg) / previousAvg) * 100) : 0;
  const spikes = trend.filter((p) => p.highRisk).length;
  const totalSignals = Math.max(1, data.summary.predictedObservations);
  const highSeverityRatioPct = Math.round((data.summary.potentialInjuryEvents / totalSignals) * 100);
  const allowedTradeNames = [...new Set(data.tradeForecasts.map((t) => t.trade))];
  const allowedCategoryNames = [
    ...new Set(data.tradeForecasts.flatMap((t) => t.categories.map((c) => c.name))),
  ];
  const topTrades = data.tradeForecasts
    .map((t) => ({
      trade: t.trade,
      totalPredictedSignals: t.categories.reduce((sum, c) => sum + c.predictedCount, 0),
      highestRiskCategory: t.categories[0]?.name ?? "General",
      highestRiskLevel: t.categories[0]?.riskLevel ?? "LOW",
      categories: t.categories,
    }))
    .sort((a, b) => b.totalPredictedSignals - a.totalPredictedSignals);
  const concentrationPct = topTrades.length
    ? Math.round((topTrades[0].totalPredictedSignals / Math.max(1, topTrades.reduce((s, t) => s + t.totalPredictedSignals, 0))) * 100)
    : 0;

  const oshaHistory = buildOshaCrossReference(topTrades.map((t) => t.trade));

  return {
    monthlyRiskAssessment: {
      forecastMonth: data.summary.month,
      purpose:
        "Assist the safety lead with this month’s risk assessment by interpreting ONLY the structured signals below. The model is a leading-indicator index from safety-system signals—not a validated injury forecast unless totals.modelRole indicates calibration. Do not invent site-specific incidents.",
    },
    grounding: {
      allowedTradeNames,
      allowedCategoryNames,
      rules: [
        "Cite trades and hazard categories only from allowedTradeNames / allowedCategoryNames (or tradeSignals.topTrades[].categories).",
        "Use numeric facts only from totals and trendSignals; do not invent counts, dates, or injury events.",
        "Do not treat UI alert titles or generic control lines as confirmed open items, violations, or real triggers—they are not in this JSON as verified findings.",
        "oshaPriorYearsCrossReference is sector baseline context only, not this employer’s record or an enforcement outcome.",
        "If locationContext.stateCode is null, do not claim a regional weather story beyond general language.",
      ],
    },
    month: data.summary.month,
    locationContext: {
      stateCode: data.location.stateCode,
      displayName: data.location.displayName,
      weatherRiskMultiplier: data.location.weatherRiskMultiplier,
      tradeWeatherWeight: data.location.tradeWeatherWeight,
      combinedWeatherFactor: data.location.combinedWeatherFactor,
      impactNote: data.location.impactNote,
    },
    totals: {
      predictedObservations: data.summary.predictedObservations,
      potentialInjuryEvents: data.summary.potentialInjuryEvents,
      /** Illustrative projected case estimate for prioritization—not equated with structural risk score. */
      projectedCaseEstimateNext30d: data.summary.predictedInjuriesNextMonth,
      predictedInjuriesNextMonth: data.summary.predictedInjuriesNextMonth,
      /** Incident likelihood index (0–100), derived from structural score × weather; not a calibrated probability. */
      incidentLikelihoodIndexPercent: data.summary.increasedIncidentRiskPercent,
      increasedIncidentRiskPercent: data.summary.increasedIncidentRiskPercent,
      structuralRiskScore: data.summary.structuralRiskScore,
      overallRiskLevel: data.summary.overallRiskLevel,
      riskModelVersion: data.summary.riskModelVersion,
      modelRole: "leading_indicator_unvalidated" as const,
      highSeverityRatioPct,
    },
    trendSignals: {
      series: trend,
      recent3MonthAverage: Number(recentAvg.toFixed(2)),
      prior3MonthAverage: Number(previousAvg.toFixed(2)),
      momentumPercent: momentumPct,
      highRiskSpikesInWindow: spikes,
    },
    tradeSignals: {
      topTrades,
      concentrationInTopTradePercent: concentrationPct,
      availableTrades: data.availableTrades,
    },
    genericUiSuggestions: {
      note: "Illustrative dashboard themes only—not verified gaps or logged triggers. Do not quote these as factual problems.",
      controlThemes: data.recommendedControls,
    },
    dataCoverage: {
      availableMonths: data.availableMonths,
      trendWindowMonths: trend.map((t) => t.month),
      generatedAt: data.summary.lastUpdatedAt,
    },
    oshaPriorYearsCrossReference: oshaHistory,
    signalProvenance: data.signalProvenance,
    confidenceRubricHint: computeConfidenceRubric(data),
  };
}

function fallbackInsights(data: InjuryWeatherDashboardData): InjuryWeatherAiInsights {
  const topTrade = data.tradeForecasts[0]?.trade ?? "General Contractor";
  const topCategory = data.tradeForecasts[0]?.categories[0]?.name ?? "High-risk tasks";
  const n = Math.max(1, data.summary.predictedObservations);
  const sev = data.summary.potentialInjuryEvents;
  const mixPct = Math.round((sev / n) * 100);
  const loc = data.location.stateCode
    ? `${data.location.displayName} (${data.location.impactNote})`
    : "no state selected for climate modifier";
  const rubric = computeConfidenceRubric(data);
  const conf = capConfidence("MEDIUM", rubric);
  return {
    headline: `For ${data.summary.month}, aggregated signals center on ${topTrade} — ${topCategory} — with ${data.summary.overallRiskLevel} overall model risk.`,
    likelyInjuryDrivers: [
      `Model inputs: ${n} weighted observations; ${sev} high/critical-weight signals (${mixPct}% of total).`,
      `Trade/category emphasis from current data: ${topTrade} / ${topCategory}.`,
      `Location context: ${loc}.`,
    ],
    priorityActions: [
      `Validate this month’s assessment against field reality for ${topTrade} work and ${topCategory} controls.`,
      "Cross-check high-severity-weighted items in your safety system (SOR / actions / incidents) for the selected month.",
      "Adjust pre-task focus and inspection cadence using the dashboard numbers, not generic alert text alone.",
    ],
    confidence: conf,
  };
}

export async function generateInjuryWeatherAiInsights(
  data: InjuryWeatherDashboardData
): Promise<InjuryWeatherAiInsights> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallbackInsights(data);
  const aiContext = computeAiContext(data);

  const prompt = [
    "You are a construction safety analyst helping with a MONTHLY RISK ASSESSMENT for monthlyRiskAssessment.forecastMonth.",
    "The user needs grounded support for that month’s assessment—not invented incidents or fake triggers.",
    "Evidence you may use: totals, trendSignals, tradeSignals (including topTrades with categories), locationContext, dataCoverage, oshaPriorYearsCrossReference (sector baseline only), and genericUiSuggestions (illustrative only—never cite as real findings).",
    "Do NOT: invent injuries, near-misses, equipment failures, OSHA visits, citations, or people; do not quote dashboard alert titles as real open items (alerts are not passed as facts); do not mention trades or hazard categories not in grounding.allowedTradeNames / allowedCategoryNames or tradeSignals.",
    "Output strict JSON with fields:",
    "headline (string, 1 sentence tied to the month and real signals), likelyInjuryDrivers (exactly 3 strings), priorityActions (exactly 3 strings), confidence (LOW|MEDIUM|HIGH).",
    "Rules:",
    "- Each likelyInjuryDriver must tie to at least one of: severity mix (totals), trend momentum (trendSignals), or trade concentration (tradeSignals)—use the actual numbers when you state them.",
    "- Mention specific trade/category drivers only from tradeSignals.topTrades / allowed lists.",
    "- If locationContext.stateCode is set, add one clause consistent with impactNote; if null, do not invent regional weather.",
    "- Include one behavior/process angle (e.g., pre-task planning, permit discipline, verification of high-severity items in the system) without claiming a specific incident.",
    "- In one driver or action, contrast oshaPriorYearsCrossReference (sector baseline) with current tradeSignals—without implying this employer’s OSHA record.",
    "- Priority actions: operational for 7–30 days and verifiable; none may depend on imaginary triggers.",
    "- In one priority action, state clearly that executing controls improves conditions over time and reduces future signal severity/volume—the headline exposure estimate is a leading-indicator model output and does not drop instantly when reading the AI text.",
    "- Set confidence to confidenceRubricHint unless you have a strong reason from sparse data to use LOW.",
    JSON.stringify(aiContext),
  ].join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "injury_weather_ai_insights",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                headline: { type: "string" },
                likelyInjuryDrivers: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 3,
                },
                priorityActions: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 3,
                },
                confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
              },
              required: ["headline", "likelyInjuryDrivers", "priorityActions", "confidence"],
            },
          },
        },
      }),
    });

    if (!res.ok) return fallbackInsights(data);
    const json = (await res.json()) as {
      output_text?: string;
    };
    if (!json.output_text) return fallbackInsights(data);
    const parsed = JSON.parse(json.output_text) as InjuryWeatherAiInsights;
    if (!parsed.headline || !parsed.likelyInjuryDrivers?.length || !parsed.priorityActions?.length) {
      return fallbackInsights(data);
    }
    return applyInsightGuards(data, parsed);
  } catch {
    return fallbackInsights(data);
  }
}
