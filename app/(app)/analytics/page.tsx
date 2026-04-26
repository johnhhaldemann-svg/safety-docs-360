"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import { userVisibleInjuryModelMessage } from "@/lib/analytics/injuryModelMessage";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { HeatmapGrid } from "@/components/metrics/HeatmapGrid";
import { Sparkline } from "@/components/metrics/Sparkline";
import { AddInsightToDashboardButton } from "@/components/analytics/AddInsightToDashboardButton";
import { AnalyticsFocusedTab } from "@/components/analytics/AnalyticsFocusedTab";
import { AnalyticsOverviewSkeleton } from "@/components/analytics/AnalyticsOverviewSkeleton";
import type {
  AnalyticsSummary,
  LikelyInjuryInsightPayload,
  ObservationModeId,
  TabId,
} from "@/components/analytics/types";
import { mergeSearchParam, readAllowedSearchParam } from "@/lib/tabUrlState";

const supabase = getSupabaseBrowserClient();

const FALLBACK_HAZARD_TILES = ["Trips & Falls", "Fire Risks", "PPE Violations", "Electrical"];

const ANALYTICS_TAB_IDS = ["overview", "observations", "inspections", "risk"] as const;
const OBSERVATION_MODE_IDS = ["near_misses", "hazards", "health_issues"] as const;

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


function AnalyticsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [injuryLikelihood, setInjuryLikelihood] = useState<LikelyInjuryInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "warning">("error");
  const [tab, setTab] = useState<TabId>("overview");
  const [observationMode, setObservationMode] = useState<ObservationModeId>("near_misses");

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const t = readAllowedSearchParam(sp, "tab", ANALYTICS_TAB_IDS, "overview") as TabId;
    const o = readAllowedSearchParam(sp, "obs", OBSERVATION_MODE_IDS, "near_misses") as ObservationModeId;
    setTab(t);
    setObservationMode(o);
  }, []);

  const setTabWithUrl = useCallback(
    (next: TabId) => {
      setTab(next);
      const raw = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
      const q = mergeSearchParam(raw, "tab", next);
      router.replace(`${pathname}${q}`, { scroll: false });
    },
    [router, pathname]
  );

  const setObservationModeWithUrl = useCallback(
    (next: ObservationModeId) => {
      setObservationMode(next);
      setTab("observations");
      const raw = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
      const params = new URLSearchParams(raw);
      params.set("tab", "observations");
      params.set("obs", next);
      const serialized = params.toString();
      router.replace(`${pathname}${serialized ? `?${serialized}` : ""}`, { scroll: false });
    },
    [router, pathname]
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [injuryModelIssue, setInjuryModelIssue] = useState<{
    message: string;
    tone: "error" | "warning";
  } | null>(null);
  const [riskRecWorking, setRiskRecWorking] = useState(false);
  const [riskSnapWorking, setRiskSnapWorking] = useState(false);
  const [dismissingRecId, setDismissingRecId] = useState<string | null>(null);
  const [selectedHealthIssue, setSelectedHealthIssue] = useState<string | null>(null);

  const loadSummary = useCallback(async (windowDays: number, injuryType?: string | null) => {
    setLoading(true);
    setMessage("");
    setMessageTone("error");
    setInjuryModelIssue(null);
    try {
      const headers = await getAuthHeaders();
      const [response, injRes] = await Promise.all([
        fetchWithTimeoutSafe(`/api/company/analytics/summary?days=${windowDays}${injuryType ? `&injuryType=${encodeURIComponent(injuryType)}` : ""}`, { headers }, 15000, "Analytics summary"),
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
      await loadSummary(days, selectedHealthIssue);
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
      await loadSummary(days, selectedHealthIssue);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dismiss failed.");
      setMessageTone("error");
    }
    setDismissingRecId(null);
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadSummary(days, selectedHealthIssue);
    }, 0);
    return () => window.clearTimeout(t);
  }, [days, loadSummary, selectedHealthIssue]);

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
    if (tab === "observations") {
      if (observationMode === "near_misses") return recent.filter((r) => r.tag === "NEAR MISS");
      if (observationMode === "hazards") return recent.filter((r) => r.tag === "HAZARD");
      return recent;
    }
    if (tab === "inspections") return recent.slice(0, 3);
    return recent;
  }, [recent, tab, observationMode]);

  const tabHint = useMemo(() => {
    if (tab === "observations") {
      if (observationMode === "near_misses") return `Near misses in view: ${breakdown?.nearMiss ?? 0}`;
      if (observationMode === "hazards") return `Hazard-tagged observations: ${breakdown?.hazard ?? 0}`;
      if (observationMode === "health_issues")
        return `Typed injury records in range: ${summary?.healthIssueRollup?.reduce((sum, item) => sum + item.count, 0) ?? 0}`;
    }
    if (tab === "inspections")
      return `Permits + JSA activities in window: ${breakdown?.inspections ?? 0} · JSAs: ${breakdown?.daps ?? 0}`;
    if (tab === "risk") return "Risk Memory, benchmarking, and injury analytic inputs for this window.";
    return "Workspace-wide safety observation metrics";
  }, [tab, observationMode, breakdown, summary?.healthIssueRollup]);

  const tagChip = (tag: string) => {
    const t = tag.toUpperCase();
    if (t === "HAZARD") return "border-[rgba(209,98,98,0.24)] bg-[rgba(255,238,238,0.96)] text-[#b45353]";
    if (t === "NEAR MISS") return "border-[rgba(217,164,65,0.26)] bg-[rgba(255,246,224,0.96)] text-[#9a680a]";
    if (t === "POSITIVE") return "border-[rgba(46,158,91,0.24)] bg-[rgba(232,247,237,0.96)] text-[#207251]";
    return "border-[var(--app-accent-border-22)] bg-[rgba(232,240,255,0.98)] text-[#285ea8]";
  };

  return (
    <div className="analytics-workspace-light min-h-[calc(100vh-4rem)] rounded-[1.5rem] border border-[var(--app-accent-surface-18)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(237,244,255,0.96)_100%)] text-[var(--app-text)] shadow-[var(--app-shadow-primary-float)]">
      <div className="relative border-b border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.99)_0%,_rgba(237,244,255,0.97)_100%)] px-5 py-6 sm:px-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,_var(--app-accent-primary)_0%,_#5b92ff_55%,_var(--semantic-success)_100%)]"
          aria-hidden
        />
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--app-accent-primary)]">
          Safety observation hub
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-app-display text-3xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-4xl">
              Centralized Safety Monitoring
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--app-text)]">
              Enterprise safety management — live counts, trends, and leadership signals for your
              company workspace.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div
              className="flex flex-wrap items-center justify-end gap-2"
              role="tablist"
              aria-label="Time window"
            >
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    days === d
                      ? "bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)]"
                      : "border border-[var(--app-border)] bg-white/90 text-[var(--app-text)] hover:border-[var(--app-accent-border-24)] hover:bg-[var(--app-accent-primary-soft)]",
                  ].join(" ")}
                >
                  {d === 7 ? "1 week" : `${d} days`}
                </button>
              ))}
            </div>
            <div
              className="flex flex-wrap items-center justify-end gap-2"
              role="tablist"
              aria-label="Safety observation views"
            >
              {(
                [
                  ["overview", "Overview"],
                  ["observations", "Observations"],
                  ["inspections", "Inspections"],
                  ["risk", "Risk"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`analytics-tabpanel-${id}`}
                  id={`analytics-tab-${id}`}
                  onClick={() => setTabWithUrl(id)}
                  className={[
                    "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition",
                    tab === id
                      ? "bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)] ring-1 ring-[var(--app-accent-border-28)] shadow-sm"
                      : "border border-transparent text-[var(--app-muted)] hover:border-[var(--app-border)] hover:bg-white/90 hover:text-[var(--app-text-strong)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--app-muted)]">{tabHint}</p>
          {tab === "observations" ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Observation lens">
              {(
                [
                  ["near_misses", "Near misses"],
                  ["hazards", "Hazards"],
                  ["health_issues", "Health issues"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setObservationModeWithUrl(id)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    observationMode === id
                      ? "bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)]"
                      : "border border-[var(--app-border)] bg-white/90 text-[var(--app-text)] hover:border-[var(--app-accent-border-24)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-transparent">.</span>
          )}
        </div>
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        <div className="sticky top-4 z-10 rounded-xl border border-[var(--app-accent-border-24)] bg-white/85 px-4 py-2 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{lastLoadedAt ? `Last updated ${new Date(lastLoadedAt).toLocaleString()}` : "Not loaded yet"}</p>
            <button
              type="button"
              onClick={() => void loadSummary(days, selectedHealthIssue)}
              disabled={loading}
              className="analytics-action-primary rounded-full px-4 py-1.5 text-xs uppercase tracking-wide transition disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh view"}
            </button>
          </div>
        </div>
        {message ? (
          <InlineMessage tone={messageTone}>{message}</InlineMessage>
        ) : null}

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
              className={`font-app-display mt-4 font-black tracking-tight text-[var(--app-text-strong)] ${injuryLikelihood.hasData ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
            >
              {injuryLikelihood.headline}
            </p>
            {injuryLikelihood.secondaryLine ? (
              <p className="mt-2 text-sm font-medium text-[var(--app-text-strong)]">{injuryLikelihood.secondaryLine}</p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-[var(--app-muted)]">{injuryLikelihood.detailNote}</p>
          </div>
        ) : null}

        {tab === "risk" &&
        summary?.benchmarking &&
        (summary.benchmarking.industryCode ||
          summary.benchmarking.industryInjuryRate != null ||
          summary.benchmarking.tradeInjuryRate != null ||
          summary.benchmarking.hoursWorked != null) ? (
          <details id="benchmarking-compare" className="rounded-xl border border-[rgba(46,158,91,0.28)] bg-[var(--semantic-success-bg)] px-4 py-3 text-sm text-[var(--app-text)]">
            <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-wider text-[var(--semantic-success)]">
              Industry and trade benchmarks
            </summary>
            <p className="mt-1 text-xs text-[var(--app-text)]">
              NAICS{" "}
              <span className="font-mono font-semibold text-[var(--app-text-strong)]">
                {summary.benchmarking.industryCode ?? "—"}
              </span>
              {" · "}
              Industry ref. rate:{" "}
              <span className="font-semibold text-[var(--app-text-strong)]">
                {summary.benchmarking.industryInjuryRate != null
                  ? summary.benchmarking.industryInjuryRate.toString()
                  : "—"}
              </span>
              {" · "}
              Trade ref. rate:{" "}
              <span className="font-semibold text-[var(--app-text-strong)]">
                {summary.benchmarking.tradeInjuryRate != null
                  ? summary.benchmarking.tradeInjuryRate.toString()
                  : "—"}
              </span>
            </p>
            <p className="mt-2 text-xs text-[var(--app-text)]">
              <span className="text-[var(--app-muted)]">Exposure hours: </span>
              <span className="font-semibold text-[var(--app-text-strong)]">
                {summary.benchmarking.hoursWorked != null
                  ? summary.benchmarking.hoursWorked.toLocaleString()
                  : "—"}
              </span>
              {" · "}
              <span className="text-[var(--app-muted)]">Injury incidents (window, for rate): </span>
              <span className="font-semibold text-[var(--app-text-strong)]">{summary.benchmarking.incidentsForRate ?? 0}</span>
              {" · "}
              <span className="text-[var(--app-muted)]">Incident rate (per 200k hrs): </span>
              <span className="font-semibold text-[var(--app-text-strong)]">
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
                          <span className="shrink-0 font-mono font-semibold text-emerald-50">
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
                          <span className="shrink-0 font-mono font-semibold text-emerald-50">
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
                    className="font-semibold text-[var(--semantic-success)] underline decoration-[rgba(46,158,91,0.45)] underline-offset-2 hover:text-[var(--app-text-strong)]"
                  >
                    NSC Injury Facts — Industry Profiles
                  </a>
                  {" · "}
                  <a
                    href={summary.benchmarking.industryBenchmarkRates.injuryFactsIncidentTrendsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--semantic-success)] underline decoration-[rgba(46,158,91,0.45)] underline-offset-2 hover:text-[var(--app-text-strong)]"
                  >
                    Incident rate trends
                  </a>
                </p>
                <p className="text-emerald-200/70">{summary.benchmarking.industryBenchmarkRates.referenceDataNote}</p>
              </div>
            ) : null}
          </details>
        ) : null}

        {tab === "risk" && summary?.injuryAnalytics ? (
          <div className="rounded-xl border border-[rgba(109,40,217,0.22)] bg-[rgba(245,240,255,0.96)] px-4 py-3 text-sm text-[var(--app-text)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
              Injury outcome &amp; prediction inputs
            </p>
            <p className="mt-1 text-xs text-[var(--app-text)]">
              Avg. severity score (DART + lost time):{" "}
              <span className="font-semibold text-[var(--app-text-strong)]">
                {summary.injuryAnalytics.averageSeverityScore}
              </span>{" "}
              (n={summary.injuryAnalytics.severitySampleSize}) · SOR→injury ratio:{" "}
              <span className="font-semibold text-[var(--app-text-strong)]">
                {summary.injuryAnalytics.sorToInjuryRatio != null
                  ? summary.injuryAnalytics.sorToInjuryRatio.toString()
                  : "—"}
              </span>{" "}
              ({summary.injuryAnalytics.injuryIncidentCount} injuries / {summary.injuryAnalytics.sorCount} SOR) ·
              Observation→injury %:{" "}
              <span className="font-semibold text-[var(--app-text-strong)]">
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
        {loading ? (
          <AnalyticsOverviewSkeleton />
        ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="analytics-dark-panel p-5 shadow-inner">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">Overview</p>
              <AddInsightToDashboardButton blockId="graph_observation_mix" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--app-accent-border-22)] bg-[var(--app-accent-primary-soft)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-accent-primary)]">
                  Total observations
                </p>
                <p className="font-app-display mt-2 text-3xl font-black text-[var(--app-text-strong)]">
                  {totalObs}
                </p>
              </div>
              <div className="rounded-xl border border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--semantic-warning)]">
                  Open issues
                </p>
                <p className="font-app-display mt-2 text-3xl font-black text-[var(--app-text-strong)]">
                  {openIssues}
                </p>
              </div>
              <div className="rounded-xl border border-[rgba(46,158,91,0.28)] bg-[var(--semantic-success-bg)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--semantic-success)]">
                  Resolution rate
                </p>
                <p className="font-app-display mt-2 text-3xl font-black text-[var(--app-text-strong)]">
                  {`${resolutionPct}%`}
                </p>
              </div>
            </div>
            <div className="analytics-dark-panel-soft mt-5 px-3 py-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
                Trend
              </p>
              <Sparkline
                points={trends}
                windowDays={days}
                loading={false}
                rangeCaption={`Selected window: last ${days} days of observation activity`}
              />
            </div>
          </div>

          <div className="analytics-dark-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                Observation priority
              </p>
              <AddInsightToDashboardButton blockId="graph_risk_distribution" />
            </div>
            <ul className="mt-4 space-y-4">
              <li className="flex items-start gap-3 rounded-xl border border-[rgba(217,83,79,0.22)] bg-[var(--semantic-danger-bg)] p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--semantic-danger)]" />
                <div>
                  <p className="font-bold text-[var(--semantic-danger)]">High priority</p>
                  <p className="font-app-display text-2xl font-black text-[var(--app-text-strong)]">
                    {bands?.high ?? dash?.totalHighRiskObservations ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">
                    Elevated risk observations currently active.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--semantic-warning)]" />
                <div>
                  <p className="font-bold text-[#9a680a]">Medium</p>
                  <p className="font-app-display text-2xl font-black text-[var(--app-text-strong)]">{bands?.medium ?? 0}</p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">Moderate severity in the selected window.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-[rgba(46,158,91,0.28)] bg-[var(--semantic-success-bg)] p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--semantic-success)]" />
                <div>
                  <p className="font-bold text-[var(--semantic-success)]">Low</p>
                  <p className="font-app-display text-2xl font-black text-[var(--app-text-strong)]">{bands?.low ?? 0}</p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">Lower-severity observations recorded.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
        )}

        {tab === "risk" ? (
        <details
          id="safety-risk-memory"
          className="scroll-mt-8 rounded-2xl border border-violet-500/25 bg-violet-950/20 p-5"
          open
        >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-violet-200/90">
              <span>Safety360 Risk Memory Engine</span>
              <AddInsightToDashboardButton blockId="risk_ranking" />
            </summary>
            {riskMemory ? (
              <>
                <p className="mt-1 text-[11px] text-slate-500">
                  Structured facets from incidents, observations, and JSAs (last {riskMemory.windowDays} days).
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="analytics-dark-panel-soft p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Facet rows</p>
                    <p className="mt-2 text-2xl font-black font-app-display text-[var(--app-text-strong)]">{riskMemory.facetCount}</p>
                  </div>
                  <div className="analytics-dark-panel-soft p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Score (facets only)</p>
                    <p className="mt-2 text-2xl font-black font-app-display text-[var(--app-text-strong)]">{riskMemory.aggregated.score}</p>
                  </div>
                  <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-200/90">
                      + baseline adjust
                    </p>
                    <p className="mt-2 text-2xl font-black font-app-display text-[var(--app-text-strong)]">
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
                    <p className="mt-2 text-2xl font-black font-app-display text-[var(--app-text-strong)]">
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
                          <span className="text-2xl font-black font-app-display text-[var(--app-text-strong)]">
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
        </details>
        ) : null}

        {tab === "overview" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="analytics-dark-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total observations</p>
              <AddInsightToDashboardButton blockId="recent_activity" />
            </div>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-5xl font-black font-app-display text-[var(--app-text-strong)]">{loading ? "—" : totalObs}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-[var(--app-muted)]">
                    <span>Open observations</span>
                    <span className="font-semibold text-[var(--app-accent-primary)]">{loading ? "—" : openIssues}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--app-border-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--app-accent-primary)]/85"
                      style={{
                        width: `${totalObs > 0 ? Math.min(100, (openIssues / totalObs) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-[var(--app-muted)]">
                    <span>High risk</span>
                    <span className="font-semibold text-[var(--semantic-warning)]">
                      {loading ? "—" : bands?.high ?? 0}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--app-border-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--semantic-warning)]/85"
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent reports</p>
              <AddInsightToDashboardButton blockId="recent_reports" />
            </div>
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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trending hazards</p>
                <AddInsightToDashboardButton blockId="hazard_trends" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {hazardTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="analytics-dark-panel-soft p-4 text-center"
                  >
                    <p className="text-[11px] font-semibold text-[var(--app-muted)]">{tile.label}</p>
                    <p className="font-app-display mt-2 text-2xl font-black text-[var(--app-text-strong)]">
                      {loading ? "—" : tile.count}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="analytics-dark-panel relative mt-5 p-5">
              <div className="absolute right-4 top-4 z-10">
                <AddInsightToDashboardButton blockId="graph_jobsite_risk" />
              </div>
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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</p>
                <AddInsightToDashboardButton blockId="support_signals" />
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between border-b border-[var(--app-border-subtle)] py-2 text-[var(--app-muted)]">
                  <span>Active jobsites</span>
                  <span className="font-app-display font-bold text-[var(--app-text-strong)]">
                    {loading ? "—" : dash?.totalActiveJobsites ?? 0}
                  </span>
                </li>
                <li className="flex justify-between border-b border-[var(--app-border-subtle)] py-2 text-[var(--app-muted)]">
                  <span>Reports in view</span>
                  <span className="font-app-display font-bold text-[var(--app-text-strong)]">{loading ? "—" : totalObs}</span>
                </li>
                <li className="flex justify-between border-b border-[var(--app-border-subtle)] py-2 text-[var(--app-muted)]">
                  <span>Average closure time</span>
                  <span className="font-app-display font-bold text-[var(--app-text-strong)]">
                    {loading ? "—" : `${closure.averageHours ?? 0} hrs`}
                  </span>
                </li>
                <li className="flex justify-between py-2 text-[var(--app-muted)]">
                  <span>JSA completion today</span>
                  <span className="font-app-display font-bold text-[var(--app-text-strong)]">
                    {loading
                      ? "—"
                      : `${dash?.dapCompletionToday?.percent ?? 0}% (${dash?.dapCompletionToday?.completed ?? 0}/${dash?.dapCompletionToday?.total ?? 0})`}
                  </span>
                </li>
              </ul>
            </div>
            <div className="analytics-dark-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Leadership</p>
                <AddInsightToDashboardButton blockId="training_signal" />
              </div>
              <div className="mt-4 space-y-2 text-sm text-[var(--app-text)]">
                <div className="flex justify-between">
                  <span className="text-[var(--app-muted)]">Positive observations</span>
                  <span className="font-bold text-[var(--semantic-success)]">
                    {leadership?.positiveNegativeObservationRatio?.positive ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--app-muted)]">Negative / near miss</span>
                  <span className="font-bold text-[var(--semantic-warning)]">
                    {leadership?.positiveNegativeObservationRatio?.negative ?? 0}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--app-border-subtle)] pt-3">
                  <span className="text-[var(--app-muted)]">Ratio (pos ÷ neg)</span>
                  <span className="font-app-display font-black text-[var(--app-accent-primary)]">
                    {leadership?.positiveNegativeObservationRatio?.ratio ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="relative rounded-2xl border border-[var(--app-accent-border-24)] bg-[linear-gradient(180deg,_var(--app-accent-primary-soft)_0%,_transparent_100%)] p-6 text-center">
              <div className="absolute right-4 top-4 z-10">
                <AddInsightToDashboardButton blockId="graph_risk_reduction" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-accent-primary)]">
                SIF dashboard
              </p>
              <p className="mt-6 text-6xl font-black font-app-display text-[var(--app-text-strong)]">
                {loading ? "—" : sif?.potentialCount ?? 0}
              </p>
              <p className="mt-2 text-xs text-slate-500">Potential SIF count (observations)</p>
            </div>
          </div>
        </div>
          </div>
        ) : tab === "health_issues" ? (
          <div className="space-y-5" id="analytics-tabpanel-health_issues" role="tabpanel" aria-labelledby="analytics-tab-health_issues">
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="analytics-dark-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Health issues</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(summary?.healthIssueRollup ?? []).map((item) => (
                      <button
                        key={item.injuryType}
                        type="button"
                        onClick={() => setSelectedHealthIssue((current) => (current === item.injuryType ? null : item.injuryType))}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          selectedHealthIssue === item.injuryType
                            ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
                            : "border-[var(--app-accent-border-24)] bg-white/70 text-slate-700 hover:bg-white",
                        ].join(" ")}
                      >
                        {item.label} · {item.count}
                      </button>
                    ))}
                    {(summary?.healthIssueRollup?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-500">No typed injury incidents in this window. Add injury type fields in incidents.</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="analytics-dark-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected issue detail</p>
                  {summary?.healthIssueFocus ? (
                    <>
                      <h3 className="mt-2 text-2xl font-black font-app-display text-[var(--app-text-strong)]">{summary.healthIssueFocus.label}</h3>
                      <p className="mt-1 text-sm text-slate-400">{summary.healthIssueFocus.count} incident(s) in selected window.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-5">
                        {Object.entries(summary.healthIssueFocus.severityBands).map(([band, value]) => (
                          <div key={band} className="analytics-dark-panel-soft p-3 text-center">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">{band}</p>
                            <p className="mt-1 text-xl font-black font-app-display text-[var(--app-text-strong)]">{value}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Choose a health issue chip to load its drill-down summary.</p>
                  )}
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

        <div className="rounded-2xl border border-[var(--app-accent-border-24)] bg-gradient-to-r from-[var(--app-accent-surface-12)] to-white px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent-primary)]">Actions</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/analytics/safety-intelligence" className="analytics-action-primary px-4 py-2 text-xs uppercase tracking-wide">
              Deep dive
            </Link>
            <Link href="/reports" className="rounded-xl border border-[var(--app-accent-border-24)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--app-text-strong)]">
              Reports
            </Link>
            <a href="#benchmarking-compare" className="rounded-xl border border-[var(--app-accent-border-24)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--app-text-strong)]">
              Compare
            </a>
          </div>
        </div>

        <div className="analytics-panel flex flex-col gap-4 px-5 py-4 shadow-[var(--app-shadow-primary-panel)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3 text-slate-500">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-[var(--app-muted)] underline-offset-4 hover:text-[var(--app-accent-primary)] hover:underline"
            >
              Dashboard
            </Link>
            <Link
              href="/search"
              className="text-sm font-semibold text-[var(--app-muted)] underline-offset-4 hover:text-[var(--app-accent-primary)] hover:underline"
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
