import { INJURY_FACTS_REFERENCE } from "@/lib/benchmarking/industryBenchmarkDataset";
import {
  computeDataConfidenceFromMetrics,
  forecastModeDisplayLabel,
  riskBandMeaningForDataConfidence,
} from "@/lib/injuryWeather/dataConfidence";
import type {
  AiPriorityTheme,
  InjuryWeatherAiInsights,
  InjuryWeatherDashboardData,
  RiskLevel,
} from "@/lib/injuryWeather/types";
import { buildOshaCrossReference } from "@/lib/injuryWeather/oshaHistory";

const RISK_LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

function isRiskLevel(s: unknown): s is RiskLevel {
  return typeof s === "string" && RISK_LEVELS.includes(s as RiskLevel);
}

function validPriorityTheme(t: unknown): t is AiPriorityTheme {
  if (!t || typeof t !== "object") return false;
  const o = t as AiPriorityTheme;
  return (
    typeof o.title === "string" &&
    o.title.trim().length > 0 &&
    typeof o.dueLabel === "string" &&
    o.dueLabel.trim().length > 0 &&
    isRiskLevel(o.severity)
  );
}

function severityRank(level: RiskLevel): number {
  if (level === "CRITICAL") return 4;
  if (level === "HIGH") return 3;
  if (level === "MODERATE") return 2;
  return 1;
}

function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return severityRank(a) >= severityRank(b) ? a : b;
}

/** Rotate focus lines so priority themes are not copy-paste of the same action. */
const PRIORITY_FOCUS_VARIATIONS: readonly { focus: string; dueLabel: string }[] = [
  {
    focus: "Field-verify critical controls and documented pre-task plans",
    dueLabel: "Emphasize over the next 7–14 days",
  },
  {
    focus: "Short management walkdown on repeat findings in this category",
    dueLabel: "Schedule within this forecast month",
  },
  {
    focus: "Confirm corrective actions close with effectiveness checks before re-start",
    dueLabel: "Prioritize while this trade is active",
  },
  {
    focus: "Toolbox + competent-person review of controls before shift peaks",
    dueLabel: "Next 2–3 work weeks",
  },
  {
    focus: "Spot-check permit quality and stop-work escalation readiness",
    dueLabel: "Align with this month’s risk band",
  },
];

const PRIORITY_PAD_THEMES: readonly AiPriorityTheme[] = [
  {
    title: "Program level: balance SOR volume with timely corrective closure and incident learning",
    dueLabel: "Review in leadership safety meeting this month",
    severity: "MODERATE",
  },
  {
    title: "Cross-trade check on high-severity-weighted signals in the safety system",
    dueLabel: "Assign ownership for verification cadence",
    severity: "MODERATE",
  },
  {
    title: "Document management field presence when structural or likelihood index trends up",
    dueLabel: "Plan walkthroughs against top hazard families",
    severity: "MODERATE",
  },
];

type CategoryRow = InjuryWeatherDashboardData["tradeForecasts"][number]["categories"][number];

function pickDiverseTradeCategoryThemes(
  forecasts: InjuryWeatherDashboardData["tradeForecasts"],
  limit: number
): { trade: string; category: CategoryRow }[] {
  const flat: { trade: string; category: CategoryRow }[] = [];
  for (const tf of forecasts) {
    for (const c of tf.categories) {
      flat.push({ trade: tf.trade, category: c });
    }
  }
  if (flat.length === 0) return [];

  flat.sort((a, b) => {
    const sr = severityRank(b.category.riskLevel) - severityRank(a.category.riskLevel);
    if (sr !== 0) return sr;
    return (b.category.predictedCount ?? 0) - (a.category.predictedCount ?? 0);
  });

  const out: { trade: string; category: CategoryRow }[] = [];
  const tradesUsed = new Set<string>();
  for (const row of flat) {
    if (out.length >= limit) break;
    if (!tradesUsed.has(row.trade)) {
      out.push(row);
      tradesUsed.add(row.trade);
    }
  }
  for (const row of flat) {
    if (out.length >= limit) break;
    const key = `${row.trade}\0${row.category.name}`;
    if (!out.some((o) => `${o.trade}\0${o.category.name}` === key)) {
      out.push(row);
    }
  }
  return out.slice(0, limit);
}

/** Deterministic blocks shaped like AI output — derived from dashboard data (no static demo card titles). */
export function fallbackDashboardBlocksFromData(data: InjuryWeatherDashboardData): {
  priorityThemes: AiPriorityTheme[];
  monthlyTrainingRecommendations: string[];
  recommendedControls: string[];
} {
  const themes: AiPriorityTheme[] = [];
  const picks = pickDiverseTradeCategoryThemes(data.tradeForecasts, 3);
  const overall = data.summary.overallRiskLevel;
  for (let i = 0; i < picks.length; i += 1) {
    const { trade, category: c } = picks[i];
    const v = PRIORITY_FOCUS_VARIATIONS[i % PRIORITY_FOCUS_VARIATIONS.length];
    themes.push({
      title: `${trade}: ${c.name} — ${v.focus}`,
      dueLabel: v.dueLabel,
      severity: i === 0 ? maxRiskLevel(c.riskLevel, overall) : c.riskLevel,
    });
  }
  let padIdx = 0;
  while (themes.length < 3) {
    themes.push({ ...PRIORITY_PAD_THEMES[padIdx % PRIORITY_PAD_THEMES.length] });
    padIdx += 1;
  }

  const trainingPad = [
    "Supervisor-led hazard recognition and pre-task planning for trades with the highest signal density.",
    "Permit-to-work quality and closeout discipline for foremen and competent persons.",
    "Incident and near-miss learning session tied to categories showing concentration in current data.",
  ];
  const training =
    data.monthlyTrainingRecommendations.length >= 3
      ? data.monthlyTrainingRecommendations.slice(0, 3)
      : [...data.monthlyTrainingRecommendations, ...trainingPad].slice(0, 3);

  const controlsPad = [
    "Tie field inspections to the top hazard categories shown in trade cards above.",
    "Confirm corrective actions close with verified effectiveness for repeat categories.",
    "Brief crews on shift using the highest-risk trade/category mix for this view.",
    "Document management walkthroughs when structural or likelihood index rises week over week.",
  ];
  const controls =
    data.recommendedControls.length >= 4
      ? data.recommendedControls.slice(0, 4)
      : [...data.recommendedControls, ...controlsPad].slice(0, 4);

  return { priorityThemes: themes, monthlyTrainingRecommendations: training, recommendedControls: controls };
}

function ensureAiDashboardBlocks(
  data: InjuryWeatherDashboardData,
  parsed: InjuryWeatherAiInsights
): InjuryWeatherAiInsights {
  const fb = fallbackDashboardBlocksFromData(data);
  const themesOk =
    Array.isArray(parsed.priorityThemes) &&
    parsed.priorityThemes.length === 3 &&
    parsed.priorityThemes.every(validPriorityTheme);
  const trainOk = Array.isArray(parsed.monthlyTrainingRecommendations) && parsed.monthlyTrainingRecommendations.length === 3;
  const ctrlOk = Array.isArray(parsed.recommendedControls) && parsed.recommendedControls.length === 4;
  return {
    ...parsed,
    priorityThemes: themesOk ? parsed.priorityThemes : fb.priorityThemes,
    monthlyTrainingRecommendations: trainOk ? parsed.monthlyTrainingRecommendations : fb.monthlyTrainingRecommendations,
    recommendedControls: ctrlOk ? parsed.recommendedControls : fb.recommendedControls,
  };
}

/** Titles from default dashboard cards — if the model echoes these, treat as ungrounded. */
const FORBIDDEN_ILLUSTRATION_PHRASES = [
  "fall protection training required",
  "temporary power inspection needed",
  "struck-by hazard review",
];

export function computeConfidenceRubric(data: InjuryWeatherDashboardData): InjuryWeatherAiInsights["confidence"] {
  return computeDataConfidenceFromMetrics(
    data.summary.riskSignalCount,
    data.trend?.length ?? 0,
    data.availableMonths?.length ?? 0
  );
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
  const text = [
    insights.headline,
    ...insights.likelyInjuryDrivers,
    ...insights.priorityActions,
    ...insights.priorityThemes.map((t) => `${t.title} ${t.dueLabel}`),
    ...insights.monthlyTrainingRecommendations,
    ...insights.recommendedControls,
  ]
    .join(" ")
    .toLowerCase();
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
  const normalized = ensureAiDashboardBlocks(data, insights);
  const rubric = computeConfidenceRubric(data);
  const confidence = capConfidence(normalized.confidence, rubric);
  if (!validateAiInsightsAgainstData(normalized, data)) {
    const fb = fallbackInsights(data);
    return { ...fb, confidence: capConfidence(fb.confidence, rubric) };
  }
  return { ...normalized, confidence };
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
  const totalSignals = Math.max(1, data.summary.riskSignalCount);
  const highSeverityRatioPct = Math.round((data.summary.highSeveritySignalCount / totalSignals) * 100);
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
        "Use numeric facts only from totals, trendSignals, and riskEngineV2Explainability when present; do not invent counts, dates, injury events, or alternative risk scores.",
        "When riskEngineV2Explainability is non-null, totals.finalRiskScoreV2 and riskBandLabelV2 are authoritative for the weighted model—explain and interpret them; do not substitute a different numeric score.",
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
      riskSignalCount: data.summary.riskSignalCount,
      highSeveritySignalCount: data.summary.highSeveritySignalCount,
      /** V2 weighted 0–100 score — model-authored; do not override or invent in prose. */
      finalRiskScoreV2: data.summary.finalRiskScore ?? data.summary.structuralRiskScore ?? null,
      riskBandLabelV2: data.summary.riskBandLabelV2 ?? null,
      /** Illustrative projected case estimate for prioritization—not equated with structural risk score. */
      projectedCaseEstimateNext30d: data.summary.predictedInjuriesNextMonth,
      predictedInjuriesNextMonth: data.summary.predictedInjuriesNextMonth,
      /** Incident likelihood index (0–100), derived from structural score × weather; not a calibrated probability. */
      incidentLikelihoodIndexPercent: data.summary.increasedIncidentRiskPercent,
      increasedIncidentRiskPercent: data.summary.increasedIncidentRiskPercent,
      structuralRiskScore: data.summary.structuralRiskScore,
      predictedRisk: data.summary.predictedRisk,
      predictedRiskFactors: data.summary.predictedRiskFactors,
      overallRiskLevel: data.summary.overallRiskLevel,
      dataConfidence: data.summary.dataConfidence,
      forecastMode: data.summary.forecastMode,
      forecastModeUserLabel: forecastModeDisplayLabel(data.summary.forecastMode),
      dataRefreshNote: "Safety signal inputs use a daily snapshot, not a live or real-time feed.",
      forecastConfidenceScore: data.summary.forecastConfidenceScore,
      riskModelVersion: data.summary.riskModelVersion,
      modelRole: "leading_indicator_unvalidated" as const,
      highSeverityRatioPct,
    },
    riskEngineV2Explainability: data.riskEngineV2Explainability ?? null,
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
      note: "Legacy deterministic control strings for reference only. The model must output its own priorityThemes, monthlyTrainingRecommendations, and recommendedControls from tradeSignals/totals—not copy these verbatim.",
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
  const n = Math.max(1, data.summary.riskSignalCount);
  const sev = data.summary.highSeveritySignalCount;
  const mixPct = Math.round((sev / n) * 100);
  const loc = data.location.stateCode
    ? `${data.location.displayName} (${data.location.impactNote})`
    : "no state selected for climate modifier";
  const rubric = computeConfidenceRubric(data);
  const conf = capConfidence("MEDIUM", rubric);
  const dc = data.summary.dataConfidence ?? "MEDIUM";
  const dcLine = riskBandMeaningForDataConfidence(dc);
  const blocks = fallbackDashboardBlocksFromData(data);
  return {
    headline: `For ${data.summary.month}, aggregated signals center on ${topTrade} — ${topCategory}. Structural risk band: ${data.summary.overallRiskLevel}. Data confidence ${dc} — ${dcLine}.`,
    likelyInjuryDrivers: [
      `Model inputs: ${n} weighted safety signals (SOR, corrective actions, incidents); ${sev} high/critical-weight signals (${mixPct}% of total).`,
      `Trade/category emphasis from current data: ${topTrade} / ${topCategory}.`,
      `Location context: ${loc}.`,
    ],
    priorityActions: [
      `Validate this month’s assessment against field reality for ${topTrade} work and ${topCategory} controls.`,
      "Cross-check high-severity-weighted items in your safety system (SOR / actions / incidents) for the selected month.",
      "Adjust pre-task focus and inspection cadence using the dashboard numbers, not generic alert text alone.",
    ],
    confidence: conf,
    ...blocks,
  };
}

/**
 * `/v1/responses` JSON often omits top-level `output_text` (that field is mainly an SDK helper).
 * Aggregate assistant `output_text` segments from `output[].content[]` for raw `fetch` callers.
 */
export function extractResponsesApiOutputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) return o.output_text.trim();

  const output = o.output;
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const itemObj = item as Record<string, unknown>;
    const content = itemObj.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") chunks.push(p.text);
    }
  }
  const joined = chunks.join("").trim();
  return joined || null;
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
    "Evidence you may use: totals (including finalRiskScoreV2, riskBandLabelV2, riskSignalCount), riskEngineV2Explainability when present (weighted drivers, recurrence, trend slope—do not contradict these numbers), trendSignals, tradeSignals (including topTrades with categories), locationContext, dataCoverage, oshaPriorYearsCrossReference (sector baseline only). genericUiSuggestions.controlThemes are legacy layout hints only—do NOT copy them verbatim; you author fresh priorityThemes, monthlyTrainingRecommendations, and recommendedControls from the structured signals.",
    "Do NOT: invent injuries, near-misses, equipment failures, OSHA visits, citations, or people; do not claim specific due dates or overdue CAPA items; do not mention trades or hazard categories not in grounding.allowedTradeNames / allowedCategoryNames or tradeSignals.",
    "Output strict JSON with fields:",
    "headline (string, 1 sentence tied to the month and real signals), likelyInjuryDrivers (exactly 3 strings), priorityActions (exactly 3 strings), confidence (LOW|MEDIUM|HIGH),",
    "priorityThemes (exactly 3 objects: title, dueLabel, severity where severity is LOW|MODERATE|HIGH|CRITICAL),",
    "monthlyTrainingRecommendations (exactly 3 distinct training initiative strings for forecastMonth),",
    "recommendedControls (exactly 4 playbook-style control/action strings tied to trades/categories above).",
    "Rules:",
    "- Each likelyInjuryDriver must tie to at least one of: severity mix (totals), trend momentum (trendSignals), or trade concentration (tradeSignals)—use the actual numbers when you state them.",
    "- Do not describe riskSignalCount as “observations”; call them weighted safety signals or structured inputs (SOR records, corrective actions, incidents)—not generic field observations.",
    "- When describing data freshness or forecast path, use totals.forecastModeUserLabel and totals.dataRefreshNote. Never claim real-time, streaming, or “live” system data.",
    "- Mention specific trade/category drivers only from tradeSignals.topTrades / allowed lists.",
    "- If locationContext.stateCode is set, add one clause consistent with impactNote; if null, do not invent regional weather.",
    "- Include one behavior/process angle (e.g., pre-task planning, permit discipline, verification of high-severity items in the system) without claiming a specific incident.",
    "- In one driver or action, contrast oshaPriorYearsCrossReference (sector baseline) with current tradeSignals—without implying this employer’s OSHA record.",
    `- For national historical incidence trends by industry (BLS SOII/CFOI context, not this site’s record), you may point readers to NSC Injury Facts Industry Profiles (${INJURY_FACTS_REFERENCE.injuryFactsIndustryProfilesUrl}) and work-related incident rate trends (${INJURY_FACTS_REFERENCE.injuryFactsIncidentTrendsUrl}). Do not invent or quote specific national rates unless they appear explicitly in this JSON (e.g. oshaPriorYearsCrossReference).`,
    "- Priority actions: operational for 7–30 days and verifiable; none may depend on imaginary triggers.",
    "- In one priority action, state clearly that executing controls improves conditions over time and reduces future signal severity/volume—the headline exposure estimate is a leading-indicator model output and does not drop instantly when reading the AI text.",
    "- Set confidence to confidenceRubricHint unless you have a strong reason from sparse data to use LOW.",
    "- Data confidence is about evidence density (baseline vs latest daily snapshot of signals), NOT hazard level: LOW confidence does not mean “low risk”; HIGH means the estimate is supported by enough structured safety signal data (SOR / actions / incidents). Do not imply real-time or streaming data.",
    "- priorityThemes: titles must reference real trade/category patterns from tradeSignals (not generic demo card titles). The 3 titles must NOT reuse the same action phrase or trailing clause (e.g. do not end all three with “strengthen verification and pre-task focus”); vary verification vs walkdown vs corrective closeout vs permit/toolbox focus. Prefer different trades across themes when tradeSignals lists multiple trades. dueLabel must differ across themes where possible. dueLabel must be a planning horizon—never “Due tomorrow” or fake deadlines.",
    "- monthlyTrainingRecommendations: concrete training topics aligned to top hazard categories and severity mix.",
    "- recommendedControls: specific, verifiable field actions; at least two should name a trade or hazard family from allowed lists.",
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
                priorityThemes: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "dueLabel", "severity"],
                    properties: {
                      title: { type: "string" },
                      dueLabel: { type: "string" },
                      severity: { type: "string", enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"] },
                    },
                  },
                },
                monthlyTrainingRecommendations: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 3,
                },
                recommendedControls: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 4,
                  maxItems: 4,
                },
              },
              required: [
                "headline",
                "likelyInjuryDrivers",
                "priorityActions",
                "confidence",
                "priorityThemes",
                "monthlyTrainingRecommendations",
                "recommendedControls",
              ],
            },
          },
        },
      }),
    });

    if (!res.ok) return fallbackInsights(data);
    const json: unknown = await res.json();
    const rawText = extractResponsesApiOutputText(json);
    if (!rawText) return fallbackInsights(data);
    let parsed: Partial<InjuryWeatherAiInsights>;
    try {
      parsed = JSON.parse(rawText) as Partial<InjuryWeatherAiInsights>;
    } catch {
      return fallbackInsights(data);
    }
    if (!parsed.headline || !parsed.likelyInjuryDrivers?.length || !parsed.priorityActions?.length) {
      return fallbackInsights(data);
    }
    const withConfidence: InjuryWeatherAiInsights = {
      headline: parsed.headline,
      likelyInjuryDrivers: parsed.likelyInjuryDrivers as string[],
      priorityActions: parsed.priorityActions as string[],
      confidence: parsed.confidence === "LOW" || parsed.confidence === "MEDIUM" || parsed.confidence === "HIGH" ? parsed.confidence : "MEDIUM",
      priorityThemes: (parsed.priorityThemes ?? []) as AiPriorityTheme[],
      monthlyTrainingRecommendations: (parsed.monthlyTrainingRecommendations ?? []) as string[],
      recommendedControls: (parsed.recommendedControls ?? []) as string[],
    };
    return applyInsightGuards(data, withConfidence);
  } catch {
    return fallbackInsights(data);
  }
}
