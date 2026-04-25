"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import { userVisibleInjuryModelMessage } from "@/lib/analytics/injuryModelMessage";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { HeatmapGrid } from "@/components/metrics/HeatmapGrid";
import { Sparkline } from "@/components/metrics/Sparkline";

const supabase = getSupabaseBrowserClient();

type AnalyticsSummary = {
  totals?: {
    correctiveActions?: number;
    incidents?: number;
    permits?: number;
    daps?: number;
    dapActivities?: number;
  };
  closureTimes?: {
    averageHours?: number;
    sampleSize?: number;
  };
  topHazardCategories?: Array<{ category: string; count: number }>;
  observationTrends?: Array<{ date: string; count: number }>;
  sifDashboard?: {
    potentialCount: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  jobsiteRiskScore?: Array<{
    jobsiteId: string;
    score: number;
    incidents: number;
    sif: number;
    stopWork: number;
    overdue: number;
  }>;
  companyDashboard?: {
    totalActiveJobsites?: number;
    totalOpenObservations?: number;
    totalHighRiskObservations?: number;
    sifCount?: number;
    averageClosureTimeHours?: number;
    openIncidents?: number;
    observationPriorityBands?: { high: number; medium: number; low: number };
    dapCompletionToday?: { completed: number; total: number; percent: number };
  };
  safetyLeadership?: {
    trendOfObservationsByWeek: Array<{ week: string; count: number }>;
    positiveNegativeObservationRatio: { positive: number; negative: number; ratio: number };
  };
  recentReports?: Array<{ id: string; title: string; tag: string }>;
  observationBreakdown?: {
    nearMiss: number;
    hazard: number;
    positive: number;
    other: number;
    inspections: number;
    daps: number;
  };
  riskHeatmap?: {
    rowLabels: string[];
    colLabels: string[];
    cells: number[][];
    max: number;
  };
  benchmarking?: {
    industryCode: string | null;
    industryInjuryRate: number | null;
    tradeInjuryRate: number | null;
    /** Denominator for rate; align period with incident counts (e.g. annual hours for TRIR). */
    hoursWorked: number | null;
    /** Injury incidents in the selected window counted for the rate (category incident, not explicitly non-recordable). */
    incidentsForRate: number;
    /** (incidentsForRate × 200,000) / hoursWorked when hours are set. */
    incidentRate: number | null;
    industryBenchmarkRates?: {
      naicsPrefix: string;
      recordableCasesPer200kHours: number | null;
      dartCasesPer200kHours: number | null;
      fatalityPer200kHours: number | null;
      sourceNote: string;
      injuryFactsIndustryProfilesUrl: string;
      injuryFactsIncidentTrendsUrl: string;
      historicalTrendSummary: string;
      referenceDataNote: string;
      unitEquivalenceNote: string;
    };
  };
  injuryAnalytics?: {
    averageSeverityScore: number;
    severitySampleSize: number;
    sorToInjuryRatio: number | null;
    sorCount: number;
    injuryIncidentCount: number;
    /** Percent of (near-miss + hazard observations + injury incidents) that were injuries. */
    observationToInjuryConversionRate: number | null;
    injuryPredictionModelUrl: string;
  };
  riskMemory?: {
    engine: string;
    windowDays: number;
    facetCount: number;
    topScopes: Array<{ code: string | null; count: number }>;
    topHazards: Array<{ code: string | null; count: number }>;
    openCorrectiveFacetHints: { openStyleStatuses: number };
    aggregated: {
      score: number;
      band: string;
      sampleSize: number;
      baselineContribution: number;
    };
    baselineHints: Array<{
      scope_code: string;
      hazard_code: string;
      signals: Record<string, unknown>;
    }>;
    aggregatedWithBaseline: { score: number; band: string };
    topLocationGrids?: Array<{ label: string; count: number }>;
    topLocationAreas?: Array<{ label: string; count: number }>;
    /** Heuristic trust in rollup as a forecast signal (not medical prediction). */
    derivedRollupConfidence?: number;
  } | null;
  riskMemoryRecommendations?: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    confidence: number;
    created_at: string;
  }>;
  /** Daily company-scope rollup score (`public.company_risk_scores`) for the last 30 days. */
  riskMemoryTrend?: {
    points: Array<{ date: string; score: number; band: string; windowDays: number }>;
    latest: { date: string; score: number; band: string } | null;
    earliest: { date: string; score: number; band: string } | null;
    deltaScore: number | null;
    direction: "up" | "down" | "flat" | null;
  };
};

type LikelyInjuryInsightPayload = {
  headline: string;
  secondaryLine: string | null;
  detailNote: string;
  hasData: boolean;
};

type TabId = "overview" | "near_misses" | "hazards" | "inspections";

const FALLBACK_HAZARD_TILES = ["Trips & Falls", "Fire Risks", "PPE Violations", "Electrical"];

function formatCategory(raw: string) {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return { Authorization: `Bearer ${session.access_token}` };
}

type FocusTabId = Exclude<TabId, "overview">;

function AnalyticsFocusedTab({
  tab,
  loading,
  breakdown,
  totals,
  dash,
  trends,
  filteredRecent,
  recent,
  hazardTiles,
  tagChip,
  sif,
  leadership,
  windowDays,
}: {
  tab: FocusTabId;
  loading: boolean;
  breakdown: AnalyticsSummary["observationBreakdown"];
  totals: AnalyticsSummary["totals"];
  dash: AnalyticsSummary["companyDashboard"];
  trends: Array<{ date: string; count: number }>;
  filteredRecent: Array<{ id: string; title: string; tag: string }>;
  recent: Array<{ id: string; title: string; tag: string }>;
  hazardTiles: Array<{ label: string; count: number }>;
  tagChip: (tag: string) => string;
  sif: AnalyticsSummary["sifDashboard"];
  leadership: AnalyticsSummary["safetyLeadership"];
  windowDays: number;
}) {
  const rows = loading ? [] : filteredRecent.length > 0 ? filteredRecent : recent;
  const title =
    tab === "near_misses"
      ? "Near miss lens"
      : tab === "hazards"
        ? "Hazard lens"
        : "Inspections & field activity";
  const subtitle =
    tab === "near_misses"
      ? "Observations tagged as near misses in your selected time range."
      : tab === "hazards"
        ? "Hazard and negative observations — prioritize corrective follow-up."
        : "Permits, JSAs, and recorded activity in the same window as your summary.";

  const heroStat =
    tab === "near_misses"
      ? (breakdown?.nearMiss ?? 0)
      : tab === "hazards"
        ? (breakdown?.hazard ?? 0)
        : (breakdown?.inspections ?? 0);
  const heroLabel =
    tab === "near_misses"
      ? "Near misses in window"
      : tab === "hazards"
        ? "Hazard-tagged observations"
        : "Permit + activity events (approx.)";

  return (
    <div className="space-y-6" id={`analytics-tabpanel-${tab}`} role="tabpanel">
      <div className="rounded-2xl border border-[var(--app-accent-border-24)] bg-gradient-to-br from-[var(--app-accent-surface-12)] to-[rgba(234,241,255,0.92)] p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent-primary)]">{title}</p>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">{loading ? "—" : heroStat}</h2>
        <p className="mt-1 text-sm text-slate-400">{heroLabel}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>
        {tab === "inspections" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-500">Permits (window)</p>
              <p className="mt-1 text-2xl font-black text-cyan-200">{loading ? "—" : totals?.permits ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-500">JSAs / Planned activity</p>
              <p className="mt-1 text-2xl font-black text-cyan-200">{loading ? "—" : totals?.daps ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-500">JSA activities</p>
              <p className="mt-1 text-2xl font-black text-cyan-200">{loading ? "—" : totals?.dapActivities ?? 0}</p>
            </div>
          </div>
        ) : null}
        {tab === "inspections" ? (
          <p className="mt-4 text-xs text-slate-500">
            JSA completion today:{" "}
            <span className="font-semibold text-slate-300">
              {loading
                ? "—"
                : `${dash?.dapCompletionToday?.percent ?? 0}% (${dash?.dapCompletionToday?.completed ?? 0}/${dash?.dapCompletionToday?.total ?? 0})`}
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="analytics-dark-panel p-5 shadow-inner">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Observation trend</p>
          <div className="analytics-dark-panel-soft mt-4 px-3 py-2">
            <Sparkline
              points={trends}
              windowDays={windowDays}
              loading={loading}
              variant="compact"
            />
          </div>
        </div>
        <div className="analytics-dark-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent reports</p>
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="analytics-dark-panel-soft flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-slate-100">{row.title}</span>
                <span
                  className={[
                    "shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                    tagChip(row.tag),
                  ].join(" ")}
                >
                  {row.tag}
                </span>
              </li>
            ))}
            {!loading && filteredRecent.length === 0 && recent.length > 0 ? (
              <li className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                No items for this tab in the selected range.
              </li>
            ) : null}
            {!loading && recent.length === 0 ? (
              <li className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                No observations in this range yet.
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {tab === "hazards" ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="analytics-dark-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trending hazards</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {hazardTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="analytics-dark-panel-soft p-4 text-center"
                  >
                    <p className="text-[11px] font-semibold text-slate-300">{tile.label}</p>
                    <p className="mt-2 text-2xl font-black text-cyan-300">{loading ? "—" : tile.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/80">SIF potential</p>
              <p className="mt-4 text-5xl font-black text-white">{loading ? "—" : sif?.potentialCount ?? 0}</p>
              <p className="mt-2 text-xs text-slate-500">From observations in window</p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "near_misses" && leadership ? (
        <div className="analytics-dark-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Leadership mix</p>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-300">
            <div>
              <span className="text-slate-500">Positive observations</span>
              <span className="ml-2 font-bold text-emerald-300">
                {leadership.positiveNegativeObservationRatio?.positive ?? 0}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Negative / near miss</span>
              <span className="ml-2 font-bold text-amber-200">
                {leadership.positiveNegativeObservationRatio?.negative ?? 0}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href="/reports"
          className="analytics-action-primary px-4 py-2.5 text-xs uppercase tracking-wide transition"
        >
          Open reports
        </Link>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [injuryLikelihood, setInjuryLikelihood] = useState<LikelyInjuryInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "warning">("error");
  const [tab, setTab] = useState<TabId>("overview");
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [injuryModelIssue, setInjuryModelIssue] = useState<{
    message: string;
    tone: "error" | "warning";
  } | null>(null);
  const [riskRecWorking, setRiskRecWorking] = useState(false);
  const [riskSnapWorking, setRiskSnapWorking] = useState(false);
  const [dismissingRecId, setDismissingRecId] = useState<string | null>(null);

  const loadSummary = useCallback(async (windowDays: number) => {
    setLoading(true);
    setMessage("");
    setMessageTone("error");
    setInjuryModelIssue(null);
    try {
      const headers = await getAuthHeaders();
      const [response, injRes] = await Promise.all([
        fetchWithTimeoutSafe(
          `/api/company/analytics/summary?days=${windowDays}`,
          { headers },
          15000,
          "Analytics summary"
        ),
        fetchWithTimeoutSafe(
          `/api/company/injury-analytics/model?days=${windowDays}`,
          { headers },
          15000,
          "Injury model"
        ),
      ]);
      const injJson = (await injRes.json().catch(() => null)) as
        | { likelyInjuryInsight?: LikelyInjuryInsightPayload; error?: string }
        | null;
      let parsedInjury: LikelyInjuryInsightPayload | null = null;
      if (injRes.ok) {
        parsedInjury = injJson?.likelyInjuryInsight ?? null;
        setInjuryModelIssue(null);
      } else {
        const tone = injRes.status === 403 || injRes.status === 503 ? "warning" : "error";
        setInjuryModelIssue({
          message: userVisibleInjuryModelMessage(injRes.status, injJson),
          tone,
        });
      }

      const data = (await response.json().catch(() => null)) as {
        summary?: AnalyticsSummary;
        error?: string;
        /** Present on 500 when snapshot table is missing (see analytics/summary API). */
        warning?: string;
      } | null;
      if (!response.ok) {
        setSummary(null);
        setInjuryLikelihood(parsedInjury);
        const errText = typeof data?.error === "string" ? data.error.trim() : "";
        const warnText = typeof data?.warning === "string" ? data.warning.trim() : "";
        setMessage(errText || warnText || "Failed to load analytics summary.");
        setMessageTone(errText ? "error" : warnText ? "warning" : "error");
      } else {
        const nextSummary = data?.summary ?? null;
        setSummary(nextSummary);
        setInjuryLikelihood(parsedInjury);
        if (!nextSummary) {
          const warnText = typeof data?.warning === "string" ? data.warning.trim() : "";
          setMessage(
            warnText ||
              "No analytics summary is available for this account. Confirm you are linked to a company workspace with analytics access."
          );
          setMessageTone("warning");
        }
      }
      setLastLoadedAt(Date.now());
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Analytics load timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Failed to load analytics summary."
      );
      setSummary(null);
      setInjuryLikelihood(null);
      setInjuryModelIssue(null);
    }
    setLoading(false);
  }, []);

  async function refreshRiskRecommendations(mode: "rules" | "both") {
    setRiskRecWorking(true);
    setMessage("");
    setMessageTone("error");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const timeoutMs = mode === "both" ? 45000 : 20000;
      const res = await fetchWithTimeoutSafe(
        "/api/company/risk-memory/recommendations/generate",
        { method: "POST", headers, body: JSON.stringify({ days, mode }) },
        timeoutMs,
        "Risk recommendations"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not generate recommendations.");
      await loadSummary(days);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation refresh failed.");
      setMessageTone("error");
    }
    setRiskRecWorking(false);
  }

  async function saveRiskMemorySnapshot() {
    setRiskSnapWorking(true);
    setMessage("");
    setMessageTone("error");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetchWithTimeoutSafe(
        "/api/company/risk-memory/snapshot",
        { method: "POST", headers, body: JSON.stringify({ days }) },
        20000,
        "Risk memory snapshot"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not save snapshot.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Snapshot save failed.");
      setMessageTone("error");
    }
    setRiskSnapWorking(false);
  }

  async function dismissRiskRecommendation(id: string) {
    setDismissingRecId(id);
    setMessage("");
    setMessageTone("error");
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetchWithTimeoutSafe(
        `/api/company/risk-memory/recommendations/${encodeURIComponent(id)}`,
        { method: "PATCH", headers, body: JSON.stringify({ dismissed: true }) },
        15000,
        "Dismiss recommendation"
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not dismiss recommendation.");
      await loadSummary(days);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dismiss failed.");
      setMessageTone("error");
    }
    setDismissingRecId(null);
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadSummary(days);
    }, 0);
    return () => window.clearTimeout(t);
  }, [days, loadSummary]);

  const totals = useMemo(() => summary?.totals ?? {}, [summary]);
  const closure = useMemo(() => summary?.closureTimes ?? {}, [summary]);
  const dash = summary?.companyDashboard;
  const topHazards = useMemo(() => summary?.topHazardCategories ?? [], [summary]);
  const trends = summary?.observationTrends ?? [];
  const sif = summary?.sifDashboard;
  const leadership = summary?.safetyLeadership;
  const recent = useMemo(() => summary?.recentReports ?? [], [summary]);
  const breakdown = summary?.observationBreakdown;
  const heatmap = summary?.riskHeatmap;
  const bands = dash?.observationPriorityBands;
  const riskMemory = summary?.riskMemory;
  const riskMemoryRecommendations = summary?.riskMemoryRecommendations ?? [];
  const riskMemoryTrend = summary?.riskMemoryTrend;

  const totalObs = totals.correctiveActions ?? 0;
  const openIssues = dash?.totalOpenObservations ?? 0;
  const closedInWindow = closure.sampleSize ?? 0;
  const resolutionPct =
    totalObs > 0 ? Math.min(100, Math.round((closedInWindow / totalObs) * 100)) : 0;

  const hazardTiles = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const row = topHazards[i];
      out.push({
        label: row ? formatCategory(row.category) : FALLBACK_HAZARD_TILES[i] ?? "Category",
        count: row?.count ?? 0,
      });
    }
    return out;
  }, [topHazards]);

  const filteredRecent = useMemo(() => {
    if (tab === "near_misses") return recent.filter((r) => r.tag === "NEAR MISS");
    if (tab === "hazards") return recent.filter((r) => r.tag === "HAZARD");
    if (tab === "inspections") return recent.slice(0, 3);
    return recent;
  }, [recent, tab]);

  const tabHint = useMemo(() => {
    if (tab === "near_misses") return `Near misses in view: ${breakdown?.nearMiss ?? 0}`;
    if (tab === "hazards") return `Hazard-tagged observations: ${breakdown?.hazard ?? 0}`;
    if (tab === "inspections")
      return `Permits + JSA activities in window: ${breakdown?.inspections ?? 0} · JSAs: ${breakdown?.daps ?? 0}`;
    return "Workspace-wide safety observation metrics";
  }, [tab, breakdown]);

  const tagChip = (tag: string) => {
    const t = tag.toUpperCase();
    if (t === "HAZARD") return "border-[rgba(209,98,98,0.24)] bg-[rgba(255,238,238,0.96)] text-[#b45353]";
    if (t === "NEAR MISS") return "border-[rgba(217,164,65,0.26)] bg-[rgba(255,246,224,0.96)] text-[#9a680a]";
    if (t === "POSITIVE") return "border-[rgba(46,158,91,0.24)] bg-[rgba(232,247,237,0.96)] text-[#207251]";
    return "border-[var(--app-accent-border-22)] bg-[rgba(232,240,255,0.98)] text-[#285ea8]";
  };

  return (
    <div className="analytics-workspace-light min-h-[calc(100vh-4rem)] rounded-[1.5rem] border border-[var(--app-accent-surface-18)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(237,244,255,0.96)_100%)] text-[var(--app-text)] shadow-[var(--app-shadow-primary-float)]">
      <div className="border-b border-[rgba(198,212,236,0.85)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(241,247,255,0.96)_100%)] px-5 py-6 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-400/90">
          Safety observation hub
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Centralized Safety Monitoring
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Enterprise safety management — live counts, trends, and leadership signals for your
              company workspace.
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Safety observation views"
          >
            {(
              [
                ["overview", "Overview"],
                ["near_misses", "Near Misses"],
                ["hazards", "Hazards"],
                ["inspections", "Inspections"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`analytics-tabpanel-${id}`}
                id={`analytics-tab-${id}`}
                onClick={() => setTab(id)}
                className={[
                  "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition",
                  tab === id
                    ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{tabHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  days === d
                    ? "bg-cyan-500 text-white"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700",
                ].join(" ")}
              >
                {d === 7 ? "1 week" : `${d} days`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadSummary(days)}
              disabled={loading}
              className="analytics-action-primary rounded-full px-4 py-2 text-xs uppercase tracking-wide transition disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh view"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        {message ? (
          <InlineMessage tone={messageTone}>{message}</InlineMessage>
        ) : (
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {lastLoadedAt
              ? "Figures reflect your selected range. Use Refresh view to pull the latest data from the workspace."
              : "The page is ready. Choose a time range or click Refresh view to load current figures."}
          </div>
        )}

        {!loading && injuryModelIssue ? (
          <InlineMessage tone={injuryModelIssue.tone}>{injuryModelIssue.message}</InlineMessage>
        ) : null}

        {!loading && injuryLikelihood ? (
          <div className="rounded-xl border border-[var(--app-accent-border-30)] bg-gradient-to-br from-[var(--app-accent-surface-12)] via-white to-[rgba(234,241,255,0.94)] px-5 py-4 text-[var(--app-text-strong)] shadow-[var(--app-shadow-primary-glow)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent-primary)]">
              Predicted likely injury
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--app-text)]">
              Blended model using incidents, SOR observations, and corrective actions in your selected window (
              {days} days). Same logic as Injury Weather; not a calibrated medical probability.
            </p>
            <p
              className={`mt-4 font-black tracking-tight text-white ${injuryLikelihood.hasData ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
            >
              {injuryLikelihood.headline}
            </p>
            {injuryLikelihood.secondaryLine ? (
              <p className="mt-2 text-sm font-medium text-[var(--app-text-strong)]">{injuryLikelihood.secondaryLine}</p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-slate-400">{injuryLikelihood.detailNote}</p>
          </div>
        ) : null}

        {summary?.benchmarking &&
        (summary.benchmarking.industryCode ||
          summary.benchmarking.industryInjuryRate != null ||
          summary.benchmarking.tradeInjuryRate != null ||
          summary.benchmarking.hoursWorked != null) ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/90">
              Industry and trade benchmarks
            </p>
            <p className="mt-1 text-xs text-emerald-100/90">
              NAICS{" "}
              <span className="font-mono font-semibold text-white">
                {summary.benchmarking.industryCode ?? "—"}
              </span>
              {" · "}
              Industry ref. rate:{" "}
              <span className="font-semibold text-white">
                {summary.benchmarking.industryInjuryRate != null
                  ? summary.benchmarking.industryInjuryRate.toString()
                  : "—"}
              </span>
              {" · "}
              Trade ref. rate:{" "}
              <span className="font-semibold text-white">
                {summary.benchmarking.tradeInjuryRate != null
                  ? summary.benchmarking.tradeInjuryRate.toString()
                  : "—"}
              </span>
            </p>
            <p className="mt-2 text-xs text-emerald-100/90">
              <span className="text-emerald-200/90">Exposure hours: </span>
              <span className="font-semibold text-white">
                {summary.benchmarking.hoursWorked != null
                  ? summary.benchmarking.hoursWorked.toLocaleString()
                  : "—"}
              </span>
              {" · "}
              <span className="text-emerald-200/90">Injury incidents (window, for rate): </span>
              <span className="font-semibold text-white">{summary.benchmarking.incidentsForRate ?? 0}</span>
              {" · "}
              <span className="text-emerald-200/90">Incident rate (per 200k hrs): </span>
              <span className="font-semibold text-white">
                {summary.benchmarking.incidentRate != null
                  ? summary.benchmarking.incidentRate.toFixed(2)
                  : "—"}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-emerald-200/70">
              Rate = (injury incidents × 200,000) ÷ hours worked. Use exposure hours for the same period as your
              incident window (or annual hours with a matching annual numerator). Update hours and NAICS via{" "}
              <code className="rounded bg-black/30 px-1 py-0.5 text-[10px]">PATCH /api/company/benchmarking</code>
              .
            </p>
            {summary.benchmarking.incidentRate != null &&
            summary.benchmarking.industryBenchmarkRates?.recordableCasesPer200kHours != null ? (
              <div
                className="mt-3 rounded-lg border border-emerald-800/40 bg-emerald-950/25 px-3 py-2"
                role="group"
                aria-label="Incident rate comparison chart"
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200/90">
                  Rates per 200k hours (illustrative)
                </p>
                <p className="mt-0.5 text-[9px] text-emerald-200/60">
                  {
                    "Compares this workspace's computed rate to the NSC/NAICS recordable reference for the same 200k-hour basis — not a substitute for a formal BLS/recordability review."
                  }
                </p>
                {(() => {
                  const a = summary.benchmarking?.incidentRate;
                  const b = summary.benchmarking?.industryBenchmarkRates?.recordableCasesPer200kHours;
                  if (a == null || b == null) return null;
                  const cap = Math.max(a, b, 0.01) * 1.15;
                  return (
                    <div className="mt-2 space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-100/95">
                          <span className="min-w-0">This workspace</span>
                          <span className="shrink-0 font-mono font-semibold text-white">
                            {a.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-black/30"
                          role="img"
                          aria-label={`This workspace ${a.toFixed(2)} per 200,000 hours`}
                        >
                          <div
                            className="h-full rounded-full bg-cyan-400/90"
                            style={{ width: `${Math.min(100, (a / cap) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-100/95">
                          <span className="min-w-0">NSC/NAICS ref. (recordable)</span>
                          <span className="shrink-0 font-mono font-semibold text-white">
                            {b.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-black/30"
                          role="img"
                          aria-label={`Reference ${b.toFixed(2)} per 200,000 hours`}
                        >
                          <div
                            className="h-full rounded-full bg-emerald-500/80"
                            style={{ width: `${Math.min(100, (b / cap) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}
            {summary.benchmarking.industryBenchmarkRates ? (
              <div className="mt-2 space-y-2 text-[11px] text-emerald-200/80">
                <p>
                  Dataset ref. (NAICS prefix {summary.benchmarking.industryBenchmarkRates.naicsPrefix}): recordable{" "}
                  {summary.benchmarking.industryBenchmarkRates.recordableCasesPer200kHours ?? "—"} / 200k hrs · DART{" "}
                  {summary.benchmarking.industryBenchmarkRates.dartCasesPer200kHours ?? "—"} / 200k.{" "}
                  {summary.benchmarking.industryBenchmarkRates.sourceNote}
                </p>
                <p>
                  <span className="text-emerald-200/90">Historical trends (NAICS): </span>
                  <a
                    href={summary.benchmarking.industryBenchmarkRates.injuryFactsIndustryProfilesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-100 underline decoration-emerald-400/50 underline-offset-2 hover:text-white"
                  >
                    NSC Injury Facts — Industry Profiles
                  </a>
                  {" · "}
                  <a
                    href={summary.benchmarking.industryBenchmarkRates.injuryFactsIncidentTrendsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-100 underline decoration-emerald-400/50 underline-offset-2 hover:text-white"
                  >
                    Incident rate trends
                  </a>
                </p>
                <p className="text-emerald-200/70">{summary.benchmarking.industryBenchmarkRates.referenceDataNote}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {summary?.injuryAnalytics ? (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200/90">
              Injury outcome &amp; prediction inputs
            </p>
            <p className="mt-1 text-xs text-violet-100/90">
              Avg. severity score (DART + lost time):{" "}
              <span className="font-semibold text-white">
                {summary.injuryAnalytics.averageSeverityScore}
              </span>{" "}
              (n={summary.injuryAnalytics.severitySampleSize}) · SOR→injury ratio:{" "}
              <span className="font-semibold text-white">
                {summary.injuryAnalytics.sorToInjuryRatio != null
                  ? summary.injuryAnalytics.sorToInjuryRatio.toString()
                  : "—"}
              </span>{" "}
              ({summary.injuryAnalytics.injuryIncidentCount} injuries / {summary.injuryAnalytics.sorCount} SOR) ·
              Observation→injury %:{" "}
              <span className="font-semibold text-white">
                {summary.injuryAnalytics.observationToInjuryConversionRate != null
                  ? `${summary.injuryAnalytics.observationToInjuryConversionRate}%`
                  : "—"}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-violet-200/70">
              Full SOR↔exposure mapping and event→injury likelihood:{" "}
              <code className="rounded bg-black/30 px-1 py-0.5 text-[10px]">
                GET {summary.injuryAnalytics.injuryPredictionModelUrl}
              </code>
            </p>
          </div>
        ) : null}

        {tab === "overview" ? (
          <div
            className="space-y-6"
            id="analytics-tabpanel-overview"
            role="tabpanel"
            aria-labelledby="analytics-tab-overview"
          >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="analytics-dark-panel p-5 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overview</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/80">
                  Total observations
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {loading ? "—" : totalObs}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
                  Open issues
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {loading ? "—" : openIssues}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/80">
                  Resolution rate
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {loading ? "—" : `${resolutionPct}%`}
                </p>
              </div>
            </div>
            <div className="analytics-dark-panel-soft mt-5 px-3 py-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Trend
              </p>
              <Sparkline
                points={trends}
                windowDays={days}
                loading={loading}
                rangeCaption={`Selected window: last ${days} days of observation activity`}
              />
            </div>
          </div>

          <div className="analytics-dark-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Observation priority
            </p>
            <ul className="mt-4 space-y-4">
              <li className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
                <div>
                  <p className="font-bold text-rose-100">High priority</p>
                  <p className="text-2xl font-black text-white">
                    {loading ? "—" : bands?.high ?? dash?.totalHighRiskObservations ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Elevated risk observations currently active.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                <div>
                  <p className="font-bold text-amber-100">Medium</p>
                  <p className="text-2xl font-black text-white">{loading ? "—" : bands?.medium ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-500">Moderate severity in the selected window.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="font-bold text-emerald-100">Low</p>
                  <p className="text-2xl font-black text-white">{loading ? "—" : bands?.low ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-500">Lower-severity observations recorded.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div
          id="safety-risk-memory"
          className="scroll-mt-8 rounded-2xl border border-violet-500/25 bg-violet-950/20 p-5"
        >
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/90">
              Safety360 Risk Memory Engine
            </p>
            {riskMemory ? (
              <>
                <p className="mt-1 text-[11px] text-slate-500">
                  Structured facets from incidents, observations, and JSAs (last {riskMemory.windowDays} days).
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="analytics-dark-panel-soft p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Facet rows</p>
                    <p className="mt-2 text-2xl font-black text-white">{riskMemory.facetCount}</p>
                  </div>
                  <div className="analytics-dark-panel-soft p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Score (facets only)</p>
                    <p className="mt-2 text-2xl font-black text-white">{riskMemory.aggregated.score}</p>
                  </div>
                  <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-200/90">
                      + baseline adjust
                    </p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {riskMemory.aggregatedWithBaseline?.score ?? riskMemory.aggregated.score}
                    </p>
                  </div>
                  <div className="analytics-dark-panel-soft p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Band</p>
                    <p className="mt-2 text-xl font-black capitalize text-violet-100">
                      {riskMemory.aggregatedWithBaseline?.band ?? riskMemory.aggregated.band}
                    </p>
                  </div>
                  <div className="analytics-dark-panel-soft p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Open CA hints</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {riskMemory.openCorrectiveFacetHints.openStyleStatuses}
                    </p>
                  </div>
                </div>
                {typeof riskMemory.derivedRollupConfidence === "number" ? (
                  <div className="analytics-dark-panel-soft mt-3 px-3 py-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Rollup confidence (heuristic): </span>
                    {(riskMemory.derivedRollupConfidence * 100).toFixed(0)}% — reflects score strength and
                    how many facet rows sit in this window (not a medical forecast).
                  </div>
                ) : null}
                {riskMemoryTrend && riskMemoryTrend.points.length > 0 ? (
                  <div className="analytics-dark-panel-soft mt-4 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200/90">
                          30-day company risk score
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Persisted nightly to <code className="rounded bg-black/30 px-1 py-0.5 text-[9px]">company_risk_scores</code>{" "}
                          by the Risk Memory cron.
                        </p>
                      </div>
                      {riskMemoryTrend.latest ? (
                        <div className="flex items-baseline gap-2 text-right">
                          <span className="text-2xl font-black text-white">
                            {riskMemoryTrend.latest.score.toFixed(1)}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-200/90">
                            {riskMemoryTrend.latest.band}
                          </span>
                          {riskMemoryTrend.deltaScore != null ? (
                            <span
                              className={[
                                "ml-2 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                riskMemoryTrend.direction === "up"
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                                  : riskMemoryTrend.direction === "down"
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                    : "border-slate-500/30 bg-slate-500/10 text-slate-300",
                              ].join(" ")}
                            >
                              {riskMemoryTrend.deltaScore > 0 ? "+" : ""}
                              {riskMemoryTrend.deltaScore.toFixed(1)} pts vs {riskMemoryTrend.points.length}d
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      <Sparkline
                        points={riskMemoryTrend.points.map((p) => ({ date: p.date, count: p.score }))}
                        windowDays={30}
                        loading={false}
                        variant="compact"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="analytics-dark-panel-soft mt-4 px-3 py-2 text-[11px] text-slate-500">
                    30-day risk score trend is not available yet — the daily Risk Memory cron will populate it after
                    the next scheduled run.
                  </div>
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Top scopes</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {riskMemory.topScopes.length === 0 ? (
                        <li className="text-slate-500">No scope tags yet</li>
                      ) : (
                        riskMemory.topScopes.map((row) => (
                          <li key={`${row.code ?? "none"}-${row.count}`}>
                            {row.code ? formatCategory(row.code) : "Unspecified"} · {row.count}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Top hazards (exposure codes)</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {riskMemory.topHazards.length === 0 ? (
                        <li className="text-slate-500">No hazard tags yet</li>
                      ) : (
                        riskMemory.topHazards.map((row) => (
                          <li key={`${row.code ?? "none"}-${row.count}`}>
                            {row.code ? formatCategory(row.code) : "Unspecified"} · {row.count}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
                {(riskMemory.topLocationGrids?.length ?? 0) > 0 || (riskMemory.topLocationAreas?.length ?? 0) > 0 ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500">Location grid / map refs</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">
                        {(riskMemory.topLocationGrids?.length ?? 0) === 0 ? (
                          <li className="text-slate-500">No grid tags yet</li>
                        ) : (
                          riskMemory.topLocationGrids!.map((row) => (
                            <li key={`${row.label}-${row.count}`}>
                              {row.label} · {row.count}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500">Areas / zones</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">
                        {(riskMemory.topLocationAreas?.length ?? 0) === 0 ? (
                          <li className="text-slate-500">No area labels yet</li>
                        ) : (
                          riskMemory.topLocationAreas!.map((row) => (
                            <li key={`${row.label}-${row.count}`}>
                              {row.label} · {row.count}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {riskMemory.baselineHints && riskMemory.baselineHints.length > 0 ? (
                  <div className="analytics-dark-panel-soft mt-4 px-3 py-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Baseline patterns matched: </span>
                    {riskMemory.baselineHints.map((h) => `${h.scope_code}+${h.hazard_code}`).join(" · ")}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                {riskMemoryRecommendations.length > 0
                  ? "Facet rollups are not available yet. Stored recommendations from the workspace still appear below."
                  : "Structured facets from incidents, observations, and JSAs. Complete optional Risk Memory fields on reports to populate scores; managers can refresh rule-based recommendations anytime."}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={riskRecWorking || loading}
                onClick={() => void refreshRiskRecommendations("rules")}
                className="rounded-lg border border-violet-400 bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(109,40,217,0.28)] transition hover:bg-violet-500 disabled:opacity-50"
              >
                {riskRecWorking ? "Generating…" : "Rule-based recommendations"}
              </button>
              <button
                type="button"
                disabled={riskRecWorking || loading}
                onClick={() => void refreshRiskRecommendations("both")}
                title="Uses smart recommendations when configured; merges with rule-based recommendations and dedupes titles."
                className="rounded-lg border border-sky-400 bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(2,132,199,0.28)] transition hover:bg-sky-500 disabled:opacity-50"
              >
                {riskRecWorking ? "Generating…" : "Smart + rules"}
              </button>
              <button
                type="button"
                disabled={riskSnapWorking || loading}
                onClick={() => void saveRiskMemorySnapshot()}
                className="rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.24)] transition hover:bg-slate-800 disabled:opacity-50"
              >
                {riskSnapWorking ? "Saving…" : "Save today’s rollup snapshot"}
              </button>
              <Link
                href="/settings/risk-memory"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_22px_rgba(255,255,255,0.12)] transition hover:bg-slate-100"
              >
                Manage contractors & crews
              </Link>
            </div>
          {riskMemoryRecommendations.length > 0 ? (
            <div className="analytics-dark-panel-soft mt-4 space-y-3 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Stored recommendations
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                {riskMemoryRecommendations.map((rec) => (
                  <li key={rec.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-slate-100">{rec.title}</p>
                      <button
                        type="button"
                        disabled={dismissingRecId === rec.id || riskRecWorking || loading}
                        onClick={() => void dismissRiskRecommendation(rec.id)}
                        className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-rose-300 disabled:opacity-40"
                      >
                        {dismissingRecId === rec.id ? "…" : "Dismiss"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{rec.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
                      {rec.kind.replace(/_/g, " ")} · confidence {(rec.confidence * 100).toFixed(0)}%
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="analytics-dark-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total observations
                </p>
                <p className="mt-2 text-5xl font-black text-white">{loading ? "—" : totalObs}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Open observations</span>
                    <span className="font-semibold text-cyan-200">{loading ? "—" : openIssues}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400/80"
                      style={{
                        width: `${totalObs > 0 ? Math.min(100, (openIssues / totalObs) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>High risk</span>
                    <span className="font-semibold text-amber-200">
                      {loading ? "—" : bands?.high ?? 0}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-amber-400/80"
                      style={{
                        width: `${totalObs > 0 ? Math.min(100, ((bands?.high ?? 0) / totalObs) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>SIF potential</span>
                    <span className="font-semibold text-rose-200">
                      {loading ? "—" : sif?.potentialCount ?? 0}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-rose-500/80"
                      style={{
                        width: `${totalObs > 0 ? Math.min(100, ((sif?.potentialCount ?? 0) / totalObs) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-dark-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recent reports
            </p>
            <ul className="mt-4 space-y-3">
              {(loading ? [] : filteredRecent.length > 0 ? filteredRecent : recent).map((row) => (
                <li
                  key={row.id}
                  className="analytics-dark-panel-soft flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-slate-100">
                    {row.title}
                  </span>
                  <span
                    className={[
                      "shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                      tagChip(row.tag),
                    ].join(" ")}
                  >
                    {row.tag}
                  </span>
                </li>
              ))}
              {!loading && (filteredRecent.length === 0 && recent.length === 0) ? (
                <li className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                  No observations in this range yet.
                </li>
              ) : null}
              {!loading && filteredRecent.length === 0 && recent.length > 0 ? (
                <li className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                  No items for this tab in the selected range.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="analytics-dark-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Trending hazards
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {hazardTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="analytics-dark-panel-soft p-4 text-center"
                  >
                    <p className="text-[11px] font-semibold text-slate-300">{tile.label}</p>
                    <p className="mt-2 text-2xl font-black text-cyan-300">{loading ? "—" : tile.count}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="analytics-dark-panel mt-5 p-5">
              <HeatmapGrid
                title="Risk heatmap"
                description="Severity × priority (corrective actions in window)"
                rowLabels={heatmap?.rowLabels ?? ["C", "H", "M", "L"]}
                colLabels={heatmap?.colLabels ?? ["H", "M", "L", "—"]}
                cells={heatmap?.cells ?? []}
                max={heatmap?.max ?? 0}
                loading={loading}
              />
            </div>
          </div>

          <div className="space-y-5 lg:col-span-4">
            <div className="analytics-dark-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between border-b border-white/5 py-2 text-slate-400">
                  <span>Active jobsites</span>
                  <span className="font-bold text-white">
                    {loading ? "—" : dash?.totalActiveJobsites ?? 0}
                  </span>
                </li>
                <li className="flex justify-between border-b border-white/5 py-2 text-slate-400">
                  <span>Reports in view</span>
                  <span className="font-bold text-white">{loading ? "—" : totalObs}</span>
                </li>
                <li className="flex justify-between border-b border-white/5 py-2 text-slate-400">
                  <span>Average closure time</span>
                  <span className="font-bold text-white">
                    {loading ? "—" : `${closure.averageHours ?? 0} hrs`}
                  </span>
                </li>
                <li className="flex justify-between py-2 text-slate-400">
                  <span>JSA completion today</span>
                  <span className="font-bold text-white">
                    {loading
                      ? "—"
                      : `${dash?.dapCompletionToday?.percent ?? 0}% (${dash?.dapCompletionToday?.completed ?? 0}/${dash?.dapCompletionToday?.total ?? 0})`}
                  </span>
                </li>
              </ul>
            </div>
            <div className="analytics-dark-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Leadership
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Positive observations</span>
                  <span className="font-bold text-emerald-300">
                    {leadership?.positiveNegativeObservationRatio?.positive ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Negative / near miss</span>
                  <span className="font-bold text-amber-200">
                    {leadership?.positiveNegativeObservationRatio?.negative ?? 0}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-3">
                  <span className="text-slate-500">Ratio (pos ÷ neg)</span>
                  <span className="font-black text-cyan-300">
                    {leadership?.positiveNegativeObservationRatio?.ratio ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-transparent p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200/80">
                SIF dashboard
              </p>
              <p className="mt-6 text-6xl font-black text-white">
                {loading ? "—" : sif?.potentialCount ?? 0}
              </p>
              <p className="mt-2 text-xs text-slate-500">Potential SIF count (observations)</p>
            </div>
          </div>
        </div>
          </div>
        ) : (
          <AnalyticsFocusedTab
            tab={tab}
            loading={loading}
            breakdown={breakdown}
            totals={totals}
            dash={dash}
            trends={trends}
            filteredRecent={filteredRecent}
            recent={recent}
            hazardTiles={hazardTiles}
            tagChip={tagChip}
            sif={sif}
            leadership={leadership}
            windowDays={days}
          />
        )}

        <div className="analytics-panel flex flex-col gap-4 px-5 py-4 shadow-[var(--app-shadow-primary-panel)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3 text-slate-500">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-slate-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              Dashboard
            </Link>
            <Link
              href="/search"
              className="text-sm font-semibold text-slate-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              Search
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-[rgba(198,212,236,0.9)] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-surface-08)]"
            >
              Open dashboard
            </Link>
            <Link
              href="/reports"
              className="analytics-action-primary px-4 py-2.5 text-xs uppercase tracking-wide transition"
            >
              Open reports
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-b-[1.5rem] border-t border-[rgba(198,212,236,0.9)] bg-[linear-gradient(180deg,_rgba(233,241,255,0.98)_0%,_rgba(223,235,255,0.96)_100%)] px-5 py-4 text-center text-sm font-semibold text-[var(--app-text-strong)]">
        Systems live. Secure. Document. Stay Safe.
      </div>
    </div>
  );
}
