"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

function TrendSparkline({ points }: { points: Array<{ date: string; count: number }> }) {
  const w = 320;
  const h = 88;
  const data = points.length > 0 ? points : [
    { date: "a", count: 0 },
    { date: "b", count: 0 },
  ];
  const maxY = Math.max(1, ...data.map((d) => d.count));
  const step = w / Math.max(1, data.length - 1);
  const dPath = data
    .map((row, i) => {
      const x = i * step;
      const y = h - (row.count / maxY) * (h - 12) - 6;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full text-cyan-400" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${dPath} L ${w} ${h} L 0 ${h} Z`}
        fill="url(#trendFill)"
        className="text-cyan-500/20"
      />
      <path d={dPath} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function heatColor(t: number) {
  if (t >= 0.75) return "bg-rose-600/90";
  if (t >= 0.5) return "bg-orange-500/85";
  if (t >= 0.25) return "bg-amber-400/70";
  if (t > 0) return "bg-emerald-950/30";
  return "bg-slate-800/60";
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

  const loadSummary = useCallback(async (windowDays: number) => {
    setLoading(true);
    setMessage("");
    setMessageTone("error");
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
      let parsedInjury: LikelyInjuryInsightPayload | null = null;
      if (injRes.ok) {
        const inj = (await injRes.json().catch(() => null)) as { likelyInjuryInsight?: LikelyInjuryInsightPayload } | null;
        parsedInjury = inj?.likelyInjuryInsight ?? null;
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
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSummary(days);
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
      return `Permits + DAP activities in window: ${breakdown?.inspections ?? 0} · DAPs: ${breakdown?.daps ?? 0}`;
    return "Workspace-wide safety observation metrics";
  }, [tab, breakdown]);

  const tagChip = (tag: string) => {
    const t = tag.toUpperCase();
    if (t === "HAZARD") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
    if (t === "NEAR MISS") return "border-amber-400/40 bg-amber-400/15 text-amber-100";
    if (t === "POSITIVE") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
    return "border-sky-500/35 bg-sky-500/10 text-sky-100";
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] rounded-[1.5rem] border border-cyan-500/10 bg-[#070b12] text-slate-100 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]">
      <div className="border-b border-white/6 bg-[#0a1018]/95 px-5 py-6 sm:px-8">
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
          <div className="flex flex-wrap items-center gap-2">
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
              className="rounded-full bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:bg-cyan-300 disabled:opacity-50"
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

        {!loading && injuryLikelihood ? (
          <div className="rounded-xl border border-teal-500/40 bg-gradient-to-br from-teal-950/55 via-[#0a1218] to-slate-950/90 px-5 py-4 text-teal-50 shadow-[0_0_40px_rgba(20,184,166,0.12)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300/95">
              Predicted likely injury
            </p>
            <p className="mt-1 text-[11px] leading-snug text-teal-200/80">
              Blended model using incidents, SOR observations, and corrective actions in your selected window (
              {days} days). Same logic as Injury Weather; not a calibrated medical probability.
            </p>
            <p
              className={`mt-4 font-black tracking-tight text-white ${injuryLikelihood.hasData ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
            >
              {injuryLikelihood.headline}
            </p>
            {injuryLikelihood.secondaryLine ? (
              <p className="mt-2 text-sm font-medium text-teal-100/90">{injuryLikelihood.secondaryLine}</p>
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

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5 shadow-inner">
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
            <div className="mt-5 rounded-xl border border-white/6 bg-[#080d18] px-3 py-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Trend
              </p>
              <TrendSparkline points={trends} />
              <div className="flex justify-between px-1 pb-1 text-[10px] text-slate-400">
                <span>Earlier</span>
                <span>Recent</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
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

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
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

          <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recent reports
            </p>
            <ul className="mt-4 space-y-3">
              {(loading ? [] : filteredRecent.length > 0 ? filteredRecent : recent).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-[#080d18] px-4 py-3"
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
            <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Trending hazards
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {hazardTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-xl border border-white/6 bg-[#080d18] p-4 text-center"
                  >
                    <p className="text-[11px] font-semibold text-slate-300">{tile.label}</p>
                    <p className="mt-2 text-2xl font-black text-cyan-300">{loading ? "—" : tile.count}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-white/8 bg-[#0d1424] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Risk heatmap
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Severity × priority (corrective actions in window)
              </p>
              <div className="mt-3 overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(4,1fr)` }}>
                    <div />
                    {(heatmap?.colLabels ?? ["H", "M", "L", "—"]).map((c) => (
                      <div
                        key={c}
                        className="text-center text-[9px] font-bold uppercase tracking-wider text-slate-500"
                      >
                        {c}
                      </div>
                    ))}
                    {(heatmap?.rowLabels ?? ["C", "H", "M", "L"]).map((rowLabel, ri) => (
                      <div key={rowLabel} className="contents">
                        <div className="flex items-center text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          {rowLabel}
                        </div>
                        {(heatmap?.cells[ri] ?? [0, 0, 0, 0]).map((cell, ci) => {
                          const t = (heatmap?.max ? cell / heatmap.max : 0) || 0;
                          return (
                            <div
                              key={`${ri}-${ci}`}
                              className={[
                                "flex h-11 items-center justify-center rounded-lg text-xs font-bold text-white/90",
                                heatColor(t),
                              ].join(" ")}
                            >
                              {cell > 0 ? cell : ""}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:col-span-4">
            <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
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
                  <span>DAP completion today</span>
                  <span className="font-bold text-white">
                    {loading
                      ? "—"
                      : `${dash?.dapCompletionToday?.percent ?? 0}% (${dash?.dapCompletionToday?.completed ?? 0}/${dash?.dapCompletionToday?.total ?? 0})`}
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
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

        <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-[#0a0f18] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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
              className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-200 transition hover:bg-white/5"
            >
              Open dashboard
            </Link>
            <Link
              href="/reports"
              className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-[0_0_20px_rgba(34,211,238,0.2)] transition hover:bg-cyan-300"
            >
              Open reports
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-b-[1.5rem] border-t border-[#0d1830] bg-[#0a1628] px-5 py-4 text-center text-sm font-semibold text-slate-300">
        Systems live. Secure. Document. Stay Safe.
      </div>
    </div>
  );
}
