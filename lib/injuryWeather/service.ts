import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { inferCalibrationTrend, computeBacktestCorrelations } from "@/lib/injuryWeather/backtest";
import { computeDataConfidenceFromMetrics } from "@/lib/injuryWeather/dataConfidence";
import {
  effectiveTradeWeatherWeightFromByTrade,
  getLocationWeatherContext,
  mergeLocationWithTradeWeather,
} from "@/lib/injuryWeather/locationWeather";
import {
  INJURY_WEATHER_MODEL,
  behavioralLikelihoodAdjustmentFromMonthLabel,
  buildTradeCategoryForecasts,
  tradeForecastsWhenNoSignals,
  computeBaseRiskScore,
  computeIncidentLikelihoodIndexPct,
  computePredictedRiskProduct,
  computePredictedRiskProductWhenNoObservations,
  effectiveBaseRiskScoreForPredictedRisk,
  forecastConfidenceScoreFromObservationCount,
  forecastModeFromObservationCount,
  normalizeBehaviorSignals,
  normalizeWorkSchedule,
  computeProjectedCaseEstimate,
  computeRepeatIssueRatePct,
  computeStructuralRiskScore,
  computeTradeCategoryConcentrationPct,
  computeTrendPressureAndMomentumFromHistory,
  computeWorkforceSignalDensityPct,
  riskBandFromStressCount,
  riskLevelFromStructuralScore,
} from "@/lib/injuryWeather/riskModel";
import sorSeed from "@/lib/injuryWeather/sor-fixed-seed.json";
import {
  bandLabelToRiskLevel,
  normalizeSeverity,
  scoreRowsForForecast,
} from "@/lib/injuryWeather/riskEngineV2";
import { categoryToId, resolveTradeForRow, tradeFilterStringsToIds } from "@/lib/injuryWeather/tradeNormalization";
import type {
  DashboardAlert,
  BehaviorSignals,
  DashboardSummary,
  InjuryWeatherBlendNormalization,
  InjuryWeatherBacktestResult,
  InjuryWeatherBacktestRow,
  InjuryWeatherBacktestRunSnapshot,
  InjuryWeatherDashboardData,
  InjuryWeatherSignalProvenance,
  NormalizedLiveSignalRow,
  RiskLevel,
  TradeForecast,
  TrendPoint,
  WorkScheduleInputs,
} from "@/lib/injuryWeather/types";

const DEFAULT_TRADE_FORECASTS: TradeForecast[] = [
  {
    trade: "Roofing",
    forecastProvenance: "demo",
    categories: [
      { name: "Fall Protection", predictedCount: 58, riskLevel: "HIGH", note: "Critical Risk" },
      { name: "Ladder Safety", predictedCount: 27, riskLevel: "MODERATE" },
      { name: "PPE Compliance", predictedCount: 12, riskLevel: "LOW" },
    ],
    footerNote: "View Controls",
  },
  {
    trade: "Electrical",
    forecastProvenance: "demo",
    categories: [
      { name: "Lockout/Tagout (LOTO)", predictedCount: 21, riskLevel: "MODERATE" },
      { name: "Temporary Power", predictedCount: 33, riskLevel: "HIGH" },
    ],
    footerNote: "Temporary power inspection watchlist is elevated.",
  },
  {
    trade: "Concrete",
    forecastProvenance: "demo",
    categories: [
      { name: "Struck-By Hazards", predictedCount: 15, riskLevel: "LOW" },
      { name: "Formwork Safety", predictedCount: 9, riskLevel: "LOW" },
    ],
    footerNote: "Current Status: Under Control",
  },
  {
    trade: "Steel Work",
    forecastProvenance: "demo",
    categories: [
      { name: "Rigging Safety", predictedCount: 41, riskLevel: "MODERATE" },
      { name: "Welding Safety", predictedCount: 26, riskLevel: "MODERATE" },
    ],
    footerNote: "Reminder: review lift plans and hot-work permits.",
  },
];

const DEFAULT_ALERTS: DashboardAlert[] = [
  { id: "1", title: "Fall Protection Training Required", severity: "CRITICAL", dueLabel: "Due in 2 days" },
  { id: "2", title: "Temporary Power Inspection Needed", severity: "HIGH", dueLabel: "Due tomorrow" },
  { id: "3", title: "Struck-By Hazard Review", severity: "MODERATE", dueLabel: "Due this week" },
];

const DEFAULT_TREND: TrendPoint[] = [
  { month: "Oct 2025", value: 35 },
  { month: "Nov 2025", value: 41 },
  { month: "Dec 2025", value: 39 },
  { month: "Jan 2026", value: 48, highRisk: true },
  { month: "Feb 2026", value: 54, highRisk: true },
  { month: "Mar 2026", value: 47 },
  { month: "Apr 2026", value: 52, highRisk: true },
];

const DEFAULT_CONTROLS = [
  "Schedule targeted fall-protection refresher for roofing crews.",
  "Increase temporary power and GFCI inspections to daily cadence.",
  "Run pre-task rigging checks with documented supervisor signoff.",
  "Review permit queue for hot-work and energized-work gaps.",
];

const TRAINING_PLAYBOOK: Array<{ match: RegExp; training: string }> = [
  { match: /fall|ladder|harness/i, training: "Fall Protection refresher + ladder inspection competency checks." },
  { match: /loto|lockout|tagout|electrical|arc|power/i, training: "LOTO and temporary power safety recertification for affected crews." },
  { match: /rigging|crane|lift/i, training: "Rigging & lift planning workshop with qualified rigger verification." },
  { match: /weld|hot.?work/i, training: "Hot-work permit and fire watch training with supervisor signoff." },
  { match: /struck|material|formwork|concrete/i, training: "Struck-by prevention and material handling toolbox training." },
  { match: /ppe/i, training: "PPE compliance coaching with field audit walkthroughs." },
];

const DEFAULT_MONTHLY_TRAINING = [
  "Supervisor-led hazard recognition and pre-task planning training for top risk trades.",
  "Permit-to-work quality and closeout discipline training for foremen and leads.",
  "Incident learning review session focused on high-severity trends and near misses.",
];

/** Parse optional schedule inputs from API query strings (Injury Weather dashboard / backtest). */
export function workScheduleFromUrlSearchParams(searchParams: URLSearchParams): Partial<WorkScheduleInputs> | undefined {
  const hRaw = searchParams.get("hoursPerDay");
  const sevenRaw = searchParams.get("workSevenDaysPerWeek");
  const hasHours = hRaw != null && hRaw !== "" && Number.isFinite(Number(hRaw));
  const hasSeven = sevenRaw != null && sevenRaw !== "";
  if (!hasHours && !hasSeven) return undefined;
  return {
    ...(hasSeven
      ? {
          workSevenDaysPerWeek:
            sevenRaw === "1" || String(sevenRaw).toLowerCase() === "true" || String(sevenRaw).toLowerCase() === "yes",
        }
      : {}),
    ...(hasHours ? { hoursPerDay: Number(hRaw) } : {}),
  };
}

function buildMonthlyTrainingRecommendations(tradeForecasts: TradeForecast[]): string[] {
  const picks: string[] = [];
  const seen = new Set<string>();
  for (const tf of tradeForecasts.slice(0, 4)) {
    for (const cat of tf.categories.slice(0, 3)) {
      const label = `${tf.trade} ${cat.name}`;
      const matched = TRAINING_PLAYBOOK.find((p) => p.match.test(label));
      if (!matched) continue;
      if (seen.has(matched.training)) continue;
      seen.add(matched.training);
      picks.push(matched.training);
      if (picks.length >= 4) return picks;
    }
  }
  return picks.length > 0 ? picks : DEFAULT_MONTHLY_TRAINING;
}

type SeedRow = {
  observed_at?: number | string | null;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  severity?: string | null;
  observation_type?: string | null;
  status?: string | null;
};

function mapCorrectiveStatusToOpenClosed(raw: string | null | undefined): "open" | "closed" {
  const s = String(raw ?? "open").toLowerCase();
  if (s === "verified_closed" || s === "closed" || s === "corrected") return "closed";
  return "open";
}

function countSignalSources(rows: NormalizedLiveSignalRow[]): Pick<
  InjuryWeatherSignalProvenance,
  "sorRecords" | "correctiveActions" | "incidents"
> {
  let sorRecords = 0;
  let correctiveActions = 0;
  let incidents = 0;
  for (const r of rows) {
    if (r.source === "sor") sorRecords += 1;
    else if (r.source === "corrective_action") correctiveActions += 1;
    else incidents += 1;
  }
  return { sorRecords, correctiveActions, incidents };
}

function liveProvenance(
  filtered: NormalizedLiveSignalRow[],
  recordWindowLabel: string,
  blendNormalization?: InjuryWeatherBlendNormalization
): InjuryWeatherSignalProvenance {
  return {
    mode: "live",
    ...countSignalSources(filtered),
    recordWindowLabel,
    alertsAreIllustrative: true,
    ...(blendNormalization ? { blendNormalization } : {}),
  };
}

function seedProvenance(partial: {
  seedWorkbookRows: number;
  recordWindowLabel: string;
  blendNormalization?: InjuryWeatherBlendNormalization;
}): InjuryWeatherSignalProvenance {
  return {
    mode: "seed",
    sorRecords: 0,
    correctiveActions: 0,
    incidents: 0,
    seedWorkbookRows: partial.seedWorkbookRows,
    recordWindowLabel: partial.recordWindowLabel,
    alertsAreIllustrative: true,
    ...(partial.blendNormalization ? { blendNormalization: partial.blendNormalization } : {}),
  };
}

const BASE_TRADES = ["General Contractor", ...DEFAULT_TRADE_FORECASTS.map((t) => t.trade)];
const KNOWN_TRADE_LIBRARY = [
  "Carpentry",
  "Masonry",
  "Drywall",
  "Painting",
  "Plumbing",
  "HVAC",
  "Earthworks",
  "Scaffolding",
  "Demolition",
  "Glazing",
  "Roadwork",
  "Landscaping",
];

function uniqueSortedTrades(rows: NormalizedLiveSignalRow[]): string[] {
  return [...new Set(rows.map((r) => r.tradeLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatMonthKey(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function parseMonthLabel(monthLabel: string): Date | null {
  const parsed = new Date(monthLabel);
  if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const parts = monthLabel.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const fallback = new Date(`${parts[0]} 1, ${parts[1]}`);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
}

function monthSortValue(monthLabel: string): number {
  const parsed = parseMonthLabel(monthLabel);
  return parsed ? parsed.getTime() : 0;
}

function build90DayOutlookMonths(months: string[]): string[] {
  const clean = [...new Set(months)].sort((a, b) => monthSortValue(a) - monthSortValue(b));
  const latestDate = parseMonthLabel(clean[clean.length - 1] ?? "") ?? new Date();
  const withOutlook = [...clean];
  for (let i = 1; i <= 3; i += 1) {
    const next = new Date(latestDate.getFullYear(), latestDate.getMonth() + i, 1);
    withOutlook.push(formatMonthKey(next));
  }
  return [...new Set(withOutlook)].sort((a, b) => monthSortValue(a) - monthSortValue(b));
}

function buildFutureTrendFromMonthly(monthly: Map<string, number>, horizonMonths = 6): TrendPoint[] {
  const sortedHistory = [...monthly.entries()].sort((a, b) => monthSortValue(a[0]) - monthSortValue(b[0]));
  const historyValues = sortedHistory.map(([, value]) => value);
  const lastDate = parseMonthLabel(sortedHistory[sortedHistory.length - 1]?.[0] ?? "") ?? new Date();
  const last3 = historyValues.slice(-3);
  const prev3 = historyValues.slice(-6, -3);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0);
  const recentAvg = avg(last3) || avg(historyValues) || 12;
  const prevAvg = avg(prev3) || recentAvg;
  const momentum = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0;
  const boundedMomentum = Math.max(-0.12, Math.min(0.18, momentum));

  const trend: TrendPoint[] = [];
  let base = Math.max(1, recentAvg);
  for (let i = 1; i <= horizonMonths; i += 1) {
    const monthDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
    // Add mild seasonality so the line is not flat in low-volume datasets.
    const seasonal = 1 + 0.04 * Math.sin(i * 0.9);
    base = Math.max(1, base * (1 + boundedMomentum * 0.55) * seasonal);
    const value = Math.max(1, Math.round(base));
    trend.push({
      month: formatMonthKey(monthDate),
      value,
      highRisk: value >= 40,
    });
  }
  return trend;
}

function buildTradeUniverse(liveTrades: string[], seedData: SeedRow[]): string[] {
  const fromSeed = seedData.map((r) => inferTradeFromSeedRow(r));
  return [...new Set([...BASE_TRADES, ...KNOWN_TRADE_LIBRARY, ...fromSeed, ...liveTrades].filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function parseMonthFilter(month?: string): { start: Date; end: Date } | null {
  if (!month) return null;
  const parsed = new Date(month);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const end = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 1);
  return { start, end };
}

function filterLiveRowsByMonth(rows: NormalizedLiveSignalRow[], monthLabel: string): NormalizedLiveSignalRow[] {
  const w = parseMonthFilter(monthLabel);
  if (!w) return rows;
  const a = w.start.getTime();
  const b = w.end.getTime();
  return rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return !Number.isNaN(t) && t >= a && t < b;
  });
}

/** Same calendar month, shifted by years (e.g. April 2026 → April 2025). Uses `parseMonthLabel` for robust parsing. */
export function shiftMonthLabelByYears(monthLabel: string, deltaYears: number): string | null {
  const base = parseMonthLabel(monthLabel);
  if (!base) return null;
  const d = new Date(base.getFullYear() + deltaYears, base.getMonth(), 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/**
 * When the selected month has no signal rows, prefer the same month last year, then all dates.
 * Display month in the dashboard stays the user’s selection; `recordWindowLabel` explains the fallback.
 */
export function resolveMonthScopedRowsWithFallback(
  allRows: NormalizedLiveSignalRow[],
  selectedMonth: string
): { rows: NormalizedLiveSignalRow[]; recordWindowLabel: string } {
  const primary = filterLiveRowsByMonth(allRows, selectedMonth);
  if (primary.length > 0) {
    return {
      rows: primary,
      recordWindowLabel: `Month-scoped signals: ${selectedMonth}`,
    };
  }
  const priorYearLabel = shiftMonthLabelByYears(selectedMonth, -1);
  if (priorYearLabel) {
    const priorYearRows = filterLiveRowsByMonth(allRows, priorYearLabel);
    if (priorYearRows.length > 0) {
      return {
        rows: priorYearRows,
        recordWindowLabel: `Month-scoped signals: ${priorYearLabel} (prior-year fallback — no rows in ${selectedMonth})`,
      };
    }
  }
  return {
    rows: allRows,
    recordWindowLabel: `All dates (historical pool — no rows in ${selectedMonth}${priorYearLabel ? ` or ${priorYearLabel}` : ""}; used to estimate risk for that period)`,
  };
}

function isFutureMonth(month?: string): boolean {
  const parsed = parseMonthFilter(month);
  if (!parsed) return false;
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return parsed.start.getTime() > currentMonthStart.getTime();
}

/** Prefer workforce or hours as denominator so raw counts are comparable across sites. */
function resolveExposureDenominator(
  workforce: number,
  hours: number
): { kind: "workforce" | "hours"; value: number } | null {
  if (hours > 0) return { kind: "hours", value: hours };
  if (workforce > 0) return { kind: "workforce", value: workforce };
  return null;
}

function blendNormalizationFromExposure(exposure: ReturnType<typeof resolveExposureDenominator>): InjuryWeatherBlendNormalization {
  if (!exposure) return { kind: "row_counts" };
  return { kind: exposure.kind, denominator: exposure.value };
}

function excelSerialToDate(serial: number): Date {
  // Excel epoch starts at 1899-12-30 for serial conversion.
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms);
}

function inferTradeFromSeedRow(row: SeedRow): string {
  const haystack = `${row.category ?? ""} ${row.subcategory ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (haystack.includes("carpent") || haystack.includes("framing") || haystack.includes("millwork")) return "Carpentry";
  if (haystack.includes("roof") || haystack.includes("ladder") || haystack.includes("harness")) return "Roofing";
  if (haystack.includes("electrical") || haystack.includes("loto") || haystack.includes("power") || haystack.includes("wiring")) return "Electrical";
  if (haystack.includes("concrete") || haystack.includes("formwork") || haystack.includes("rebar")) return "Concrete";
  if (haystack.includes("rigging") || haystack.includes("steel") || haystack.includes("welding")) return "Steel Work";
  return "General Contractor";
}

function seedRows(): SeedRow[] {
  const sheets = (sorSeed as { sheets?: Record<string, SeedRow[]> }).sheets ?? {};
  const firstSheet = Object.keys(sheets)[0];
  return firstSheet ? sheets[firstSheet] ?? [] : [];
}

export async function getInjuryWeatherDashboardData(filters?: {
  month?: string;
  trade?: string;
  trades?: string[];
  workforceTotal?: number;
  /** Hours worked in scope (e.g. month); takes precedence over workforce for blend normalization */
  hoursWorked?: number;
  stateCode?: string;
  /** Optional behavioral leading indicators (fatigue, rush, new workers, OT) — likelihood only. */
  behaviorSignals?: Partial<BehaviorSignals>;
  /** 7-day ops and/or hours/day vs a 40h reference week — likelihood / structural calendar path only. */
  workSchedule?: Partial<WorkScheduleInputs>;
}): Promise<InjuryWeatherDashboardData> {
  /**
   * Forecast principle: the selected month is the **target** for likelihood and seasonal factors.
   * **Signal rows** come from history when the target month has no data: same month prior year, then
   * full historical pool. **Future months** have no observations yet, so we always use the full
   * historical signal set to project present/future risk (see `recordWindowLabel` on provenance).
   */
  const admin = createSupabaseAdminClient();
  const monthLabel = filters?.month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const workbookRows = seedRows();
  const trendFromSeed = computeTrendFromSeed(workbookRows, filters);

  if (!admin) {
    const fallback = computeFromSeed(workbookRows, filters);
    const availableMonths = build90DayOutlookMonths(trendFromSeed.availableMonths);
    return {
      summary: {
        ...fallback.summary,
        month: monthLabel,
        dataConfidence: computeDataConfidenceFromMetrics(
          fallback.summary.riskSignalCount,
          trendFromSeed.trend.length,
          availableMonths.length
        ),
        forecastMode: forecastModeFromObservationCount(fallback.summary.riskSignalCount),
        forecastConfidenceScore: forecastConfidenceScoreFromObservationCount(fallback.summary.riskSignalCount),
      },
      tradeForecasts: fallback.tradeForecasts,
      alerts: fallback.alerts,
      trend: trendFromSeed.trend,
      recommendedControls: fallback.recommendedControls,
      monthlyTrainingRecommendations: fallback.monthlyTrainingRecommendations,
      availableMonths,
      availableTrades: buildTradeUniverse(fallback.availableTrades, workbookRows),
      location: fallback.location,
      signalProvenance: fallback.signalProvenance,
      behaviorSignals: fallback.behaviorSignals,
      workSchedule: fallback.workSchedule,
    };
  }

  const shouldFilterSignalsByMonth = filters?.month ? !isFutureMonth(filters.month) : false;
  /** One fetch of all signals (3 queries) — filter by month in memory when needed. Avoids duplicate full-table reads. */
  const allRows = await fetchLiveSignals(admin, {});
  const selectedMonth = filters?.month;
  const targetIsFutureMonth = selectedMonth ? isFutureMonth(selectedMonth) : false;
  const { rows: liveSourceRows, recordWindowLabel } =
    shouldFilterSignalsByMonth && selectedMonth
      ? resolveMonthScopedRowsWithFallback(allRows, selectedMonth)
      : {
          rows: allRows,
          recordWindowLabel:
            targetIsFutureMonth && selectedMonth
              ? `Forecast: historical safety signals (all dates) — ${selectedMonth} is not observed yet; present/future scores use past patterns.`
              : "All dates (no month filter on SOR / corrective actions / incidents)",
        };
  const historyTrend = buildDashboardFromLiveSignals(allRows, {
    month: monthLabel,
    recordWindowLabel: "All dates (history for month picker)",
    workSchedule: filters?.workSchedule,
    trendFallback: trendFromSeed,
  });
  const live = buildDashboardFromLiveSignals(liveSourceRows, {
    month: monthLabel,
    trade: filters?.trade,
    trades: filters?.trades,
    workforceTotal: filters?.workforceTotal,
    hoursWorked: filters?.hoursWorked,
    stateCode: filters?.stateCode,
    behaviorSignals: filters?.behaviorSignals,
    workSchedule: filters?.workSchedule,
    recordWindowLabel,
    trendFallback: trendFromSeed,
  });
  live.availableMonths = build90DayOutlookMonths(historyTrend.availableMonths);
  live.availableTrades = buildTradeUniverse(historyTrend.availableTrades, workbookRows);
  live.summary = {
    ...live.summary,
    dataConfidence: computeDataConfidenceFromMetrics(
      live.summary.riskSignalCount,
      live.trend.length,
      live.availableMonths.length
    ),
    forecastMode: forecastModeFromObservationCount(live.summary.riskSignalCount),
    forecastConfidenceScore: forecastConfidenceScoreFromObservationCount(live.summary.riskSignalCount),
  };
  return live;
}

export async function refreshInjuryWeatherDailySnapshot() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Missing Supabase admin client." };
  }
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const trendFromSeed = computeTrendFromSeed(seedRows(), {});
  const liveRows = await fetchLiveSignals(admin, {});
  const payload = buildDashboardFromLiveSignals(liveRows, {
    month,
    recordWindowLabel: "All dates (daily snapshot)",
    trendFallback: trendFromSeed,
  });
  payload.availableMonths = build90DayOutlookMonths(payload.availableMonths);
  payload.availableTrades = buildTradeUniverse(payload.availableTrades, seedRows());
  payload.summary = {
    ...payload.summary,
    dataConfidence: computeDataConfidenceFromMetrics(
      payload.summary.riskSignalCount,
      payload.trend.length,
      payload.availableMonths.length
    ),
    forecastMode: forecastModeFromObservationCount(payload.summary.riskSignalCount),
    forecastConfidenceScore: forecastConfidenceScoreFromObservationCount(payload.summary.riskSignalCount),
  };
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const upsert = await admin.from("injury_weather_daily_snapshots").upsert(
    {
      snapshot_date: snapshotDate,
      generated_at: new Date().toISOString(),
      payload,
      source_counts: {
        liveSignalRows: liveRows.length,
        availableMonths: payload.availableMonths.length,
      },
      created_by: null,
    },
    { onConflict: "snapshot_date" }
  );
  if (upsert.error) {
    return { ok: false, error: upsert.error.message || "Failed to upsert injury weather snapshot." };
  }
  return { ok: true, snapshotDate };
}

async function fetchLiveSignals(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  filters?: { month?: string; dateRange?: { start: Date; end: Date } }
): Promise<NormalizedLiveSignalRow[]> {
  const range =
    filters?.dateRange ??
    (filters?.month ? parseMonthFilter(filters.month) : null);
  let sorQuery = admin
    .from("company_sor_records")
    .select("trade, category, severity, created_at, status")
    .eq("is_deleted", false);
  let actionQuery = admin
    .from("company_corrective_actions")
    .select("category, severity, created_at, status");
  let incidentQuery = admin.from("company_incidents").select("category, severity, created_at");
  if (range) {
    const start = range.start.toISOString();
    const end = range.end.toISOString();
    sorQuery = sorQuery.gte("created_at", start).lt("created_at", end);
    actionQuery = actionQuery.gte("created_at", start).lt("created_at", end);
    incidentQuery = incidentQuery.gte("created_at", start).lt("created_at", end);
  }
  const [sorResult, actionResult, incidentResult] = await Promise.all([sorQuery, actionQuery, incidentQuery]);
  const sorRows = (sorResult.error ? [] : sorResult.data ?? []).map((r) => {
    const categoryLabel = String(r.category ?? "General Observation");
    const resolved = resolveTradeForRow({
      source: "sor",
      sorTradeRaw: r.trade,
      categoryLabel,
    });
    return {
      tradeId: resolved.tradeId,
      tradeLabel: resolved.tradeLabel,
      categoryId: categoryToId(categoryLabel),
      categoryLabel,
      severity: normalizeSeverity(String(r.severity ?? "medium")),
      created_at: String(r.created_at ?? ""),
      source: "sor" as const,
      usedCategoryInference: resolved.usedCategoryInference,
    } satisfies NormalizedLiveSignalRow;
  });
  const actionRows = (actionResult.error ? [] : actionResult.data ?? []).map((r) => {
    const categoryLabel = String(r.category ?? "Corrective Action");
    const resolved = resolveTradeForRow({ source: "corrective_action", categoryLabel });
    return {
      tradeId: resolved.tradeId,
      tradeLabel: resolved.tradeLabel,
      categoryId: categoryToId(categoryLabel),
      categoryLabel,
      severity: normalizeSeverity(String(r.severity ?? "medium")),
      created_at: String(r.created_at ?? ""),
      source: "corrective_action" as const,
      status: mapCorrectiveStatusToOpenClosed((r as { status?: string }).status),
      usedCategoryInference: resolved.usedCategoryInference,
    } satisfies NormalizedLiveSignalRow;
  });
  const incidentRows = (incidentResult.error ? [] : incidentResult.data ?? []).map((r) => {
    const categoryLabel = String(r.category ?? "Incident");
    const resolved = resolveTradeForRow({ source: "incident", categoryLabel });
    return {
      tradeId: resolved.tradeId,
      tradeLabel: resolved.tradeLabel,
      categoryId: categoryToId(categoryLabel),
      categoryLabel,
      severity: normalizeSeverity(String(r.severity ?? "high")),
      created_at: String(r.created_at ?? ""),
      source: "incident" as const,
      usedCategoryInference: resolved.usedCategoryInference,
    } satisfies NormalizedLiveSignalRow;
  });
  return [...sorRows, ...actionRows, ...incidentRows];
}

function buildDashboardFromLiveSignals(
  rows: NormalizedLiveSignalRow[],
  params: {
    month: string;
    recordWindowLabel: string;
    trade?: string;
    trades?: string[];
    workforceTotal?: number;
    hoursWorked?: number;
    stateCode?: string;
    behaviorSignals?: Partial<BehaviorSignals>;
    workSchedule?: Partial<WorkScheduleInputs>;
    trendFallback: { availableMonths: string[]; trend: TrendPoint[] };
  }
): InjuryWeatherDashboardData {
  const forecastMonthStart = parseMonthLabel(params.month.trim()) ?? new Date();
  const asOf = new Date();

  const tradeFilterSet = tradeFilterStringsToIds([...(params.trades ?? []), ...(params.trade ? [params.trade] : [])]);
  const hasTradeFilter = tradeFilterSet.size > 0;
  const includedRows = hasTradeFilter ? rows.filter((r) => tradeFilterSet.has(r.tradeId)) : [...rows];
  const excludedRowCount = hasTradeFilter ? rows.length - includedRows.length : 0;

  const { scored, explainability } = scoreRowsForForecast(includedRows, forecastMonthStart, asOf, {
    excludedRowCount,
  });

  const v2Structural = explainability.finalRiskScore;
  const overallRiskLevel = bandLabelToRiskLevel(explainability.bandLabel);
  const highSeveritySignalCount = explainability.severityMix.high + explainability.severityMix.critical;

  const byTrade = new Map<string, Map<string, number>>();
  const monthlyWeighted = new Map<string, number>();
  const monthlyCountsFallback = new Map<string, number>();
  for (const row of includedRows) {
    const catMap = byTrade.get(row.tradeLabel) ?? new Map<string, number>();
    catMap.set(row.categoryLabel, (catMap.get(row.categoryLabel) ?? 0) + 1);
    byTrade.set(row.tradeLabel, catMap);
    const d0 = new Date(row.created_at);
    if (!Number.isNaN(d0.getTime())) {
      const key0 = formatMonthKey(d0);
      monthlyCountsFallback.set(key0, (monthlyCountsFallback.get(key0) ?? 0) + 1);
    }
  }
  for (const r of scored) {
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = formatMonthKey(d);
    monthlyWeighted.set(key, (monthlyWeighted.get(key) ?? 0) + r.rowRiskScore);
  }

  const maxMonthlyW = monthlyWeighted.size > 0 ? Math.max(...monthlyWeighted.values()) : 0;
  const monthlyDisplay = new Map<string, number>();
  if (maxMonthlyW > 0) {
    for (const [k, w] of monthlyWeighted) {
      monthlyDisplay.set(k, Math.round(Math.min(100, (w / maxMonthlyW) * 100)));
    }
  }
  const historyMonthly = monthlyDisplay.size > 0 ? monthlyDisplay : monthlyCountsFallback;

  const tradeForecasts = [...byTrade.entries()]
    .sort((a, b) => [...b[1].values()].reduce((n, v) => n + v, 0) - [...a[1].values()].reduce((n, v) => n + v, 0))
    .slice(0, 4);
  const tradeWeatherBlend = effectiveTradeWeatherWeightFromByTrade(byTrade);
  const location = mergeLocationWithTradeWeather(getLocationWeatherContext(params.stateCode), tradeWeatherBlend);
  const trend = [...historyMonthly.entries()]
    .sort((a, b) => monthSortValue(a[0]) - monthSortValue(b[0]))
    .slice(-7)
    .map(([month, value]) => ({ month, value, highRisk: value >= 40 }));
  const forecastTrend = buildFutureTrendFromMonthly(historyMonthly, 6);
  const selectedMonthLabel = params.month.trim();
  const selectedTrendPoint =
    forecastTrend.find((p) => p.month.toLowerCase() === selectedMonthLabel.toLowerCase()) ?? forecastTrend[0];
  const projectedBase = trend.slice(-3).reduce((sum, p) => sum + p.value, 0) / Math.max(1, Math.min(3, trend.length));
  const workforceForExposure = params.workforceTotal ? Math.max(1, Number(params.workforceTotal)) : 0;
  const hoursForExposure = params.hoursWorked ? Math.max(1, Number(params.hoursWorked)) : 0;
  const exposure = resolveExposureDenominator(workforceForExposure, hoursForExposure);
  const exposureDenom = exposure?.value ?? null;
  const rawSeverityPct = Math.round((highSeveritySignalCount / Math.max(1, includedRows.length)) * 100);
  const severityRatioPct = exposureDenom
    ? Math.min(100, Math.round((highSeveritySignalCount / exposureDenom) * 100))
    : rawSeverityPct;
  const pseudoForRiskModel = includedRows.map((r) => ({ trade: r.tradeLabel, category: r.categoryLabel }));
  const highRiskCategoryConcentration = computeTradeCategoryConcentrationPct(pseudoForRiskModel, exposureDenom);
  const repeatIssueRate = computeRepeatIssueRatePct(pseudoForRiskModel, exposureDenom);
  const workforceSignalDensityPct = computeWorkforceSignalDensityPct(includedRows.length, workforceForExposure);
  const baseRiskScore = computeBaseRiskScore({
    severityRatioPct,
    highRiskCategoryConcentration,
    repeatIssueRate,
    workforceSignalDensityPct,
    monthLabel: params.month,
    tradeWeatherWeight: location.tradeWeatherWeight ?? 1,
    signalRowCount: includedRows.length,
  });
  const resolvedWorkSchedule = normalizeWorkSchedule(params.workSchedule);
  const noObservations = includedRows.length === 0;
  const baseRiskForPredictedProduct = noObservations
    ? effectiveBaseRiskScoreForPredictedRisk(baseRiskScore, 0)
    : effectiveBaseRiskScoreForPredictedRisk(v2Structural, includedRows.length);
  const { predictedRisk, factors: predictedRiskFactors } = noObservations
    ? computePredictedRiskProductWhenNoObservations({
        baseRiskScore: baseRiskForPredictedProduct,
        monthLabel: params.month,
        tradeWeatherWeight: location.tradeWeatherWeight ?? 1,
      })
    : computePredictedRiskProduct({
        baseRiskScore: baseRiskForPredictedProduct,
        monthLabel: params.month,
        behaviorSignals: params.behaviorSignals,
        workSchedule: resolvedWorkSchedule,
        tradeWeatherWeight: location.tradeWeatherWeight ?? 1,
        weatherRiskMultiplier: location.weatherRiskMultiplier,
      });
  const resolvedBehavior = normalizeBehaviorSignals(params.behaviorSignals);
  const weatherFactor = location.combinedWeatherFactor ?? location.weatherRiskMultiplier;
  const incidentLikelihoodIndexPct = computeIncidentLikelihoodIndexPct(v2Structural, weatherFactor, 1);
  const rawMonthFactor = selectedTrendPoint ? selectedTrendPoint.value / Math.max(1, projectedBase) : 1;
  const monthProjectionFactor = Math.min(INJURY_WEATHER_MODEL.MONTH_PROJECTION_CAP, rawMonthFactor);
  const projectedCaseEstimate = computeProjectedCaseEstimate({
    incidentLikelihoodIndexPct,
    workforceCount: workforceForExposure,
    trendVolumeBase: projectedBase,
    monthProjectionFactor,
  });
  const roundedStructural = Math.round(v2Structural * 10) / 10;
  const requestedTrades = params.trades ?? [];
  const normalizedTradeForecasts =
    tradeForecasts.length === 0 && requestedTrades.length > 0
      ? tradeForecastsWhenNoSignals(requestedTrades)
      : buildTradeCategoryForecasts({
          tradeForecastsRaw: tradeForecasts,
          projectedCaseEstimate,
          incidentLikelihoodIndexPct,
          defaultForecasts: DEFAULT_TRADE_FORECASTS,
        });

  const trendForConf = forecastTrend.length > 0 ? forecastTrend : params.trendFallback.trend;
  const availMonthsForConf =
    historyMonthly.size > 0
      ? [...historyMonthly.keys()].sort((a, b) => monthSortValue(a) - monthSortValue(b))
      : params.trendFallback.availableMonths;

  return {
    summary: {
      month: params.month,
      riskSignalCount: includedRows.length,
      highSeveritySignalCount,
      finalRiskScore: roundedStructural,
      riskBandLabelV2: explainability.bandLabel,
      predictedInjuriesNextMonth: projectedCaseEstimate,
      increasedIncidentRiskPercent: incidentLikelihoodIndexPct,
      overallRiskLevel,
      structuralRiskScore: roundedStructural,
      riskModelVersion: INJURY_WEATHER_MODEL.VERSION,
      overallRiskScore: roundedStructural,
      predictedRisk,
      predictedRiskFactors,
      dataConfidence: computeDataConfidenceFromMetrics(
        includedRows.length,
        trendForConf.length,
        availMonthsForConf.length
      ),
      forecastMode: forecastModeFromObservationCount(includedRows.length),
      forecastConfidenceScore: forecastConfidenceScoreFromObservationCount(includedRows.length),
      lastUpdatedAt: new Date().toISOString(),
    },
    tradeForecasts: normalizedTradeForecasts.length > 0 ? normalizedTradeForecasts : DEFAULT_TRADE_FORECASTS,
    alerts: DEFAULT_ALERTS,
    trend: forecastTrend.length > 0 ? forecastTrend : params.trendFallback.trend,
    recommendedControls: DEFAULT_CONTROLS,
    monthlyTrainingRecommendations: buildMonthlyTrainingRecommendations(
      normalizedTradeForecasts.length > 0 ? normalizedTradeForecasts : DEFAULT_TRADE_FORECASTS
    ),
    availableMonths:
      historyMonthly.size > 0
        ? [...historyMonthly.keys()].sort((a, b) => monthSortValue(a) - monthSortValue(b))
        : params.trendFallback.availableMonths,
    availableTrades: uniqueSortedTrades(includedRows.length > 0 ? includedRows : rows),
    location,
    signalProvenance: liveProvenance(
      includedRows,
      params.recordWindowLabel,
      blendNormalizationFromExposure(exposure)
    ),
    riskEngineV2Explainability: explainability,
    behaviorSignals: resolvedBehavior,
    workSchedule: resolvedWorkSchedule,
  };
}

function computeFromSeed(
  rows: SeedRow[],
  filters?: {
    month?: string;
    trade?: string;
    trades?: string[];
    stateCode?: string;
    workforceTotal?: number;
    hoursWorked?: number;
    behaviorSignals?: Partial<BehaviorSignals>;
    workSchedule?: Partial<WorkScheduleInputs>;
  }
): Omit<InjuryWeatherDashboardData, "summary"> & { summary: DashboardSummary } {
  const locEmpty = mergeLocationWithTradeWeather(getLocationWeatherContext(filters?.stateCode), 1);
  if (rows.length === 0) {
    const weatherDemo = locEmpty.combinedWeatherFactor ?? locEmpty.weatherRiskMultiplier;
    const demoMonthLabel =
      filters?.month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const demoWorkSchedule = normalizeWorkSchedule(filters?.workSchedule);
    const demoBehavioralAdjustment = behavioralLikelihoodAdjustmentFromMonthLabel(
      demoMonthLabel,
      filters?.behaviorSignals,
      demoWorkSchedule
    );
    const demoStructural = Math.min(100, Math.round(58 * demoBehavioralAdjustment * 10) / 10);
    const demoLikelihood = computeIncidentLikelihoodIndexPct(demoStructural, weatherDemo, 1);
    const { predictedRisk: demoPredictedRisk, factors: demoPredictedRiskFactors } = computePredictedRiskProduct({
      baseRiskScore: 58,
      monthLabel: demoMonthLabel,
      behaviorSignals: filters?.behaviorSignals,
      workSchedule: demoWorkSchedule,
      tradeWeatherWeight: 1,
      weatherRiskMultiplier: locEmpty.weatherRiskMultiplier,
    });
    const demoCases = computeProjectedCaseEstimate({
      incidentLikelihoodIndexPct: demoLikelihood,
      workforceCount: 0,
      trendVolumeBase: 48,
      monthProjectionFactor: 1,
    });
    return {
      summary: {
        month: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
        riskSignalCount: 270,
        highSeveritySignalCount: 86,
        predictedInjuriesNextMonth: demoCases,
        increasedIncidentRiskPercent: demoLikelihood,
        overallRiskLevel: riskLevelFromStructuralScore(demoStructural),
        structuralRiskScore: demoStructural,
        riskModelVersion: INJURY_WEATHER_MODEL.VERSION,
        overallRiskScore: demoStructural,
        predictedRisk: demoPredictedRisk,
        predictedRiskFactors: demoPredictedRiskFactors,
        dataConfidence: computeDataConfidenceFromMetrics(
          270,
          DEFAULT_TREND.length,
          DEFAULT_TREND.map((t) => t.month).length
        ),
        forecastMode: "live_adjusted",
        forecastConfidenceScore: forecastConfidenceScoreFromObservationCount(270),
        lastUpdatedAt: new Date().toISOString(),
      },
      tradeForecasts: DEFAULT_TRADE_FORECASTS,
      alerts: DEFAULT_ALERTS,
      trend: DEFAULT_TREND,
      recommendedControls: DEFAULT_CONTROLS,
      monthlyTrainingRecommendations: DEFAULT_MONTHLY_TRAINING,
      availableMonths: DEFAULT_TREND.map((t) => t.month),
      availableTrades: DEFAULT_TRADE_FORECASTS.map((t) => t.trade),
      location: locEmpty,
      signalProvenance: seedProvenance({
        seedWorkbookRows: 0,
        recordWindowLabel: "Demo defaults (no workbook seed rows; admin DB unavailable)",
        blendNormalization: { kind: "row_counts" },
      }),
      behaviorSignals: normalizeBehaviorSignals(filters?.behaviorSignals),
      workSchedule: demoWorkSchedule,
    };
  }

  const monthWindow = filters?.month && !isFutureMonth(filters.month) ? parseMonthFilter(filters.month) : null;
  const filtered = rows.filter((r) => {
    if (monthWindow) {
      const obsDate = typeof r.observed_at === "number" ? excelSerialToDate(r.observed_at) : new Date(String(r.observed_at ?? ""));
      if (
        Number.isNaN(obsDate.getTime()) ||
        obsDate.getTime() < monthWindow.start.getTime() ||
        obsDate.getTime() >= monthWindow.end.getTime()
      ) {
        return false;
      }
    }
    const tradeList = (filters?.trades ?? []).map((t) => t.toLowerCase());
    if (tradeList.length > 0) {
      const tr = inferTradeFromSeedRow(r).toLowerCase();
      return tradeList.some((t) => tr.includes(t));
    }
    if (filters?.trade) return inferTradeFromSeedRow(r).toLowerCase().includes(filters.trade.toLowerCase());
    return true;
  });

  const byTrade = new Map<string, Map<string, number>>();
  const monthly = new Map<string, number>();
  let highSev = 0;
  for (const r of filtered) {
    const trade = inferTradeFromSeedRow(r);
    const category = String(r.subcategory ?? r.category ?? "General").trim() || "General";
    const sev = String(r.severity ?? "").toLowerCase();
    if (sev === "high" || sev === "critical") highSev += 1;
    const catMap = byTrade.get(trade) ?? new Map<string, number>();
    catMap.set(category, (catMap.get(category) ?? 0) + 1);
    byTrade.set(trade, catMap);

    const obs = typeof r.observed_at === "number" ? excelSerialToDate(r.observed_at) : new Date(String(r.observed_at ?? ""));
    if (!Number.isNaN(obs.getTime())) {
      const label = formatMonthKey(obs);
      monthly.set(label, (monthly.get(label) ?? 0) + 1);
    }
  }

  const tradeForecastsRaw = [...byTrade.entries()]
    .sort((a, b) => {
      const sa = [...a[1].values()].reduce((n, v) => n + v, 0);
      const sb = [...b[1].values()].reduce((n, v) => n + v, 0);
      return sb - sa;
    })
    .slice(0, 4);

  const allMonths = [...monthly.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([month]) => month);
  const trend = [...monthly.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-7)
    .map(([month, value]) => ({ month, value, highRisk: value >= 40 }));

  const projectedBase = trend.slice(-3).reduce((sum, p) => sum + p.value, 0) / Math.max(1, Math.min(3, trend.length));
  const locSeed = mergeLocationWithTradeWeather(
    getLocationWeatherContext(filters?.stateCode),
    effectiveTradeWeatherWeightFromByTrade(byTrade)
  );
  const seedWeatherFactor = locSeed.combinedWeatherFactor ?? locSeed.weatherRiskMultiplier;
  const wfSeed = filters?.workforceTotal ? Math.max(1, Number(filters.workforceTotal)) : 0;
  const hrsSeed = filters?.hoursWorked ? Math.max(1, Number(filters.hoursWorked)) : 0;
  const exposureSeed = resolveExposureDenominator(wfSeed, hrsSeed);
  const exposureDenomSeed = exposureSeed?.value ?? null;
  const severityRatioPctSeed = exposureDenomSeed
    ? Math.min(100, Math.round((highSev / exposureDenomSeed) * 100))
    : Math.round((highSev / Math.max(1, filtered.length)) * 100);
  const { trendPressurePct: tpSeed, momentumBoostPct: mbSeed } = computeTrendPressureAndMomentumFromHistory(
    trend.length > 0 ? trend : DEFAULT_TREND,
    monthly
  );
  const pseudoRows = filtered.map((r) => ({
    trade: inferTradeFromSeedRow(r),
    category: String(r.subcategory ?? r.category ?? "General").trim() || "General",
  }));
  const workforceDensitySeed = computeWorkforceSignalDensityPct(filtered.length, wfSeed);
  const seedMonthLabel =
    filters?.month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const seedWorkSchedule = normalizeWorkSchedule(filters?.workSchedule);
  const seedBehavioralAdjustment = behavioralLikelihoodAdjustmentFromMonthLabel(
    seedMonthLabel,
    filters?.behaviorSignals,
    seedWorkSchedule
  );
  const seedConc = computeTradeCategoryConcentrationPct(pseudoRows, exposureDenomSeed);
  const seedRepeat = computeRepeatIssueRatePct(pseudoRows, exposureDenomSeed);
  const seedBaseRisk = computeBaseRiskScore({
    severityRatioPct: severityRatioPctSeed,
    highRiskCategoryConcentration: seedConc,
    repeatIssueRate: seedRepeat,
    workforceSignalDensityPct: workforceDensitySeed,
    monthLabel: seedMonthLabel,
    tradeWeatherWeight: locSeed.tradeWeatherWeight ?? 1,
    signalRowCount: filtered.length,
  });
  const seedBaseForPredictedProduct = effectiveBaseRiskScoreForPredictedRisk(seedBaseRisk, filtered.length);
  const seedNoObservations = filtered.length === 0;
  const { predictedRisk: seedPredictedRisk, factors: seedPredictedRiskFactors } = seedNoObservations
    ? computePredictedRiskProductWhenNoObservations({
        baseRiskScore: seedBaseForPredictedProduct,
        monthLabel: seedMonthLabel,
        tradeWeatherWeight: locSeed.tradeWeatherWeight ?? 1,
      })
    : computePredictedRiskProduct({
        baseRiskScore: seedBaseForPredictedProduct,
        monthLabel: seedMonthLabel,
        behaviorSignals: filters?.behaviorSignals,
        workSchedule: seedWorkSchedule,
        tradeWeatherWeight: locSeed.tradeWeatherWeight ?? 1,
        weatherRiskMultiplier: locSeed.weatherRiskMultiplier,
      });
  const seedStructural = computeStructuralRiskScore({
    severityRatioPct: severityRatioPctSeed,
    trendPressurePct: tpSeed,
    momentumBoostPct: mbSeed,
    highRiskCategoryConcentration: seedConc,
    repeatIssueRate: seedRepeat,
    workforceSignalDensityPct: workforceDensitySeed,
    behavioralAdjustment: seedBehavioralAdjustment,
    monthLabel: seedMonthLabel,
    tradeWeatherWeight: locSeed.tradeWeatherWeight ?? 1,
    signalRowCount: filtered.length,
  });
  const seedLikelihood = computeIncidentLikelihoodIndexPct(seedStructural, seedWeatherFactor, 1);
  const seedCases = computeProjectedCaseEstimate({
    incidentLikelihoodIndexPct: seedLikelihood,
    workforceCount: wfSeed,
    trendVolumeBase: projectedBase,
    monthProjectionFactor: 1,
  });
  const roundedSeedStructural = Math.round(seedStructural * 10) / 10;
  const requestedTradesSeed = filters?.trades ?? [];
  const tradeForecasts =
    tradeForecastsRaw.length === 0 && requestedTradesSeed.length > 0
      ? tradeForecastsWhenNoSignals(requestedTradesSeed)
      : buildTradeCategoryForecasts({
          tradeForecastsRaw,
          projectedCaseEstimate: seedCases,
          incidentLikelihoodIndexPct: seedLikelihood,
          defaultForecasts: DEFAULT_TRADE_FORECASTS,
        });

  const trendForSeedConf = trend.length > 0 ? trend : DEFAULT_TREND;
  const availMonthsForSeedConf = allMonths.length > 0 ? allMonths : DEFAULT_TREND.map((t) => t.month);
  const summary: DashboardSummary = {
    month: filters?.month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
    riskSignalCount: filtered.length,
    highSeveritySignalCount: highSev,
    predictedInjuriesNextMonth: seedCases,
    increasedIncidentRiskPercent: seedLikelihood,
    overallRiskLevel: riskLevelFromStructuralScore(seedStructural),
    structuralRiskScore: roundedSeedStructural,
    riskModelVersion: INJURY_WEATHER_MODEL.VERSION,
    overallRiskScore: roundedSeedStructural,
    predictedRisk: seedPredictedRisk,
    predictedRiskFactors: seedPredictedRiskFactors,
    dataConfidence: computeDataConfidenceFromMetrics(
      filtered.length,
      trendForSeedConf.length,
      availMonthsForSeedConf.length
    ),
    forecastMode: forecastModeFromObservationCount(filtered.length),
    forecastConfidenceScore: forecastConfidenceScoreFromObservationCount(filtered.length),
    lastUpdatedAt: new Date().toISOString(),
  };

  const alerts = DEFAULT_ALERTS;
  const recommendedControls = DEFAULT_CONTROLS;
  return {
    summary,
    tradeForecasts: tradeForecasts.length > 0 ? tradeForecasts : DEFAULT_TRADE_FORECASTS,
    alerts,
    trend: trend.length > 0 ? trend : DEFAULT_TREND,
    recommendedControls,
    monthlyTrainingRecommendations: buildMonthlyTrainingRecommendations(
      tradeForecasts.length > 0 ? tradeForecasts : DEFAULT_TRADE_FORECASTS
    ),
    availableMonths: allMonths.length > 0 ? allMonths : DEFAULT_TREND.map((t) => t.month),
    availableTrades: [...new Set(rows.map((r) => inferTradeFromSeedRow(r)))].sort((a, b) => a.localeCompare(b)),
    location: locSeed,
    signalProvenance: seedProvenance({
      seedWorkbookRows: filtered.length,
      recordWindowLabel:
        filters?.month && !isFutureMonth(filters.month)
          ? `Seed workbook · ${filters.month}`
          : "Seed workbook (all dates in file)",
      blendNormalization: blendNormalizationFromExposure(exposureSeed),
    }),
    behaviorSignals: normalizeBehaviorSignals(filters?.behaviorSignals),
    workSchedule: seedWorkSchedule,
  };
}

function computeTrendFromSeed(rows: SeedRow[], filters?: { month?: string; trade?: string }) {
  const monthly = new Map<string, number>();
  for (const r of rows) {
    if (filters?.trade && !inferTradeFromSeedRow(r).toLowerCase().includes(filters.trade.toLowerCase())) continue;
    const obs = typeof r.observed_at === "number" ? excelSerialToDate(r.observed_at) : new Date(String(r.observed_at ?? ""));
    if (!Number.isNaN(obs.getTime())) {
      const label = formatMonthKey(obs);
      monthly.set(label, (monthly.get(label) ?? 0) + 1);
    }
  }
  const availableMonths = [...monthly.keys()].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const forecastTrend = buildFutureTrendFromMonthly(monthly, 6);
  return { availableMonths, trend: forecastTrend.length > 0 ? forecastTrend : DEFAULT_TREND };
}

const BACKTEST_METHODOLOGY =
  "For each calendar month M, the model is run on safety signals (SOR, corrective actions, incidents) with created_at in M only. Outcome is the count of company_incidents rows with created_at in month M+1 (platform-wide). Correlations use Pearson and Spearman; interpret cautiously with small N and confounders.";

function enumerateScoreOutcomePairs(lookbackMonths: number): Array<{
  scoreLabel: string;
  outcomeMonthLabel: string;
  outcomeStart: Date;
  outcomeEnd: Date;
}> {
  const capped = Math.min(24, Math.max(3, lookbackMonths));
  const now = new Date();
  const lastCompleteOutcomeMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pairs: Array<{
    scoreLabel: string;
    outcomeMonthLabel: string;
    outcomeStart: Date;
    outcomeEnd: Date;
  }> = [];
  for (let i = 0; i < capped; i += 1) {
    const outcomeMonthStart = new Date(
      lastCompleteOutcomeMonthStart.getFullYear(),
      lastCompleteOutcomeMonthStart.getMonth() - i,
      1
    );
    const scoreMonthStart = new Date(outcomeMonthStart.getFullYear(), outcomeMonthStart.getMonth() - 1, 1);
    const scoreLabel = formatMonthKey(scoreMonthStart);
    const outcomeMonthLabel = formatMonthKey(outcomeMonthStart);
    const outcomeEnd = new Date(outcomeMonthStart.getFullYear(), outcomeMonthStart.getMonth() + 1, 1);
    pairs.push({
      scoreLabel,
      outcomeMonthLabel,
      outcomeStart: outcomeMonthStart,
      outcomeEnd,
    });
  }
  return pairs.reverse();
}

const INCIDENT_CREATED_AT_PAGE = 1000;

/** One or more paginated reads — replaces N per-month count queries for backtests. */
async function fetchIncidentCreatedAtInRange(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  start: Date,
  end: Date
): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("company_incidents")
      .select("created_at")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true })
      .range(offset, offset + INCIDENT_CREATED_AT_PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []).map((r) => String((r as { created_at?: string }).created_at ?? ""));
    out.push(...batch);
    if (batch.length < INCIDENT_CREATED_AT_PAGE) break;
    offset += INCIDENT_CREATED_AT_PAGE;
  }
  return out;
}

function countIncidentsPerOutcomeWindow(
  createdAtIsoStrings: string[],
  pairs: Array<{ outcomeMonthLabel: string; outcomeStart: Date; outcomeEnd: Date }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of pairs) counts.set(p.outcomeMonthLabel, 0);
  for (const iso of createdAtIsoStrings) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) continue;
    for (const p of pairs) {
      if (t >= p.outcomeStart.getTime() && t < p.outcomeEnd.getTime()) {
        counts.set(p.outcomeMonthLabel, (counts.get(p.outcomeMonthLabel) ?? 0) + 1);
        break;
      }
    }
  }
  return counts;
}

/**
 * Compare month-scoped model scores to incident counts in the following month (last 3–24 months).
 * Requires service-role DB access to read all signal sources and incidents.
 */
export async function runInjuryWeatherBacktest(options?: {
  lookbackMonths?: number;
  stateCode?: string;
  workforceTotal?: number;
  hoursWorked?: number;
  workSchedule?: Partial<WorkScheduleInputs>;
}): Promise<InjuryWeatherBacktestResult | { error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { error: "Missing Supabase admin client." };
  }
  const lookbackMonths = Math.min(24, Math.max(3, options?.lookbackMonths ?? 12));
  const trendFromSeed = computeTrendFromSeed(seedRows(), {});
  const pairs = enumerateScoreOutcomePairs(lookbackMonths);
  const rows: InjuryWeatherBacktestRow[] = [];

  const firstScore = parseMonthFilter(pairs[0]?.scoreLabel);
  const lastScore = parseMonthFilter(pairs[pairs.length - 1]?.scoreLabel);
  if (!firstScore || !lastScore) {
    return { error: "Could not parse score months for back-test." };
  }

  const [allSignals, incidentTimestamps] = await Promise.all([
    fetchLiveSignals(admin, { dateRange: { start: firstScore.start, end: lastScore.end } }),
    fetchIncidentCreatedAtInRange(admin, pairs[0]!.outcomeStart, pairs[pairs.length - 1]!.outcomeEnd),
  ]);
  const incidentsByOutcomeMonth = countIncidentsPerOutcomeWindow(incidentTimestamps, pairs);

  for (const p of pairs) {
    const liveRows = filterLiveRowsByMonth(allSignals, p.scoreLabel);
    const dash = buildDashboardFromLiveSignals(liveRows, {
      month: p.scoreLabel,
      recordWindowLabel: `Back-test score month (${p.scoreLabel})`,
      trendFallback: trendFromSeed,
      workforceTotal: options?.workforceTotal,
      hoursWorked: options?.hoursWorked,
      stateCode: options?.stateCode,
      workSchedule: options?.workSchedule,
    });
    const incidentsNextMonth = incidentsByOutcomeMonth.get(p.outcomeMonthLabel) ?? 0;
    rows.push({
      scoreMonth: p.scoreLabel,
      outcomeMonth: p.outcomeMonthLabel,
      injuryChancePct: dash.summary.increasedIncidentRiskPercent,
      structuralRiskScore: dash.summary.structuralRiskScore ?? null,
      projectedCaseEstimate: dash.summary.predictedInjuriesNextMonth,
      overallRiskLevel: dash.summary.overallRiskLevel,
      signalRows: dash.summary.riskSignalCount,
      incidentsNextMonth,
    });
  }

  const correlations = computeBacktestCorrelations(rows);
  const recentRuns = await fetchRecentBacktestRuns(admin, 12);
  const prevPearson = recentRuns[0]?.pearsonStructuralVsIncidents ?? null;
  const calibrationTrend = inferCalibrationTrend(correlations.pearsonStructuralVsIncidents, prevPearson);
  await persistInjuryWeatherBacktestRun(admin, {
    lookbackMonths,
    rowCount: rows.length,
    correlations,
  });

  return {
    generatedAt: new Date().toISOString(),
    lookbackMonths,
    methodology: BACKTEST_METHODOLOGY,
    rows,
    ...correlations,
    recentRuns,
    calibrationTrend,
  };
}

async function fetchRecentBacktestRuns(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  limit: number
): Promise<InjuryWeatherBacktestRunSnapshot[]> {
  const { data, error } = await admin
    .from("injury_weather_backtest_runs")
    .select(
      "id, run_at, lookback_months, pearson_structural_vs_incidents, spearman_structural_vs_incidents, pearson_likelihood_vs_incidents, spearman_likelihood_vs_incidents, pearson_cases_vs_incidents, spearman_cases_vs_incidents"
    )
    .order("run_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[injury-weather] backtest history unavailable:", error.message);
    return [];
  }
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    runAt: String(row.run_at),
    lookbackMonths: Number(row.lookback_months),
    pearsonStructuralVsIncidents: row.pearson_structural_vs_incidents != null ? Number(row.pearson_structural_vs_incidents) : null,
    spearmanStructuralVsIncidents: row.spearman_structural_vs_incidents != null ? Number(row.spearman_structural_vs_incidents) : null,
    pearsonLikelihoodVsIncidents: row.pearson_likelihood_vs_incidents != null ? Number(row.pearson_likelihood_vs_incidents) : null,
    spearmanLikelihoodVsIncidents: row.spearman_likelihood_vs_incidents != null ? Number(row.spearman_likelihood_vs_incidents) : null,
    pearsonCasesVsIncidents: row.pearson_cases_vs_incidents != null ? Number(row.pearson_cases_vs_incidents) : null,
    spearmanCasesVsIncidents: row.spearman_cases_vs_incidents != null ? Number(row.spearman_cases_vs_incidents) : null,
  }));
}

async function persistInjuryWeatherBacktestRun(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  input: {
    lookbackMonths: number;
    rowCount: number;
    correlations: Pick<
      InjuryWeatherBacktestResult,
      | "pearsonStructuralVsIncidents"
      | "spearmanStructuralVsIncidents"
      | "pearsonLikelihoodVsIncidents"
      | "spearmanLikelihoodVsIncidents"
      | "pearsonCasesVsIncidents"
      | "spearmanCasesVsIncidents"
    >;
  }
): Promise<void> {
  const { error } = await admin.from("injury_weather_backtest_runs").insert({
    lookback_months: input.lookbackMonths,
    row_count: input.rowCount,
    pearson_structural_vs_incidents: input.correlations.pearsonStructuralVsIncidents,
    spearman_structural_vs_incidents: input.correlations.spearmanStructuralVsIncidents,
    pearson_likelihood_vs_incidents: input.correlations.pearsonLikelihoodVsIncidents,
    spearman_likelihood_vs_incidents: input.correlations.spearmanLikelihoodVsIncidents,
    pearson_cases_vs_incidents: input.correlations.pearsonCasesVsIncidents,
    spearman_cases_vs_incidents: input.correlations.spearmanCasesVsIncidents,
    payload: { storedAt: new Date().toISOString() },
  });
  if (error) {
    // Table may not exist until migration is applied — do not fail the API response.
    console.warn("[injury-weather] backtest persist skipped:", error.message);
  }
}
