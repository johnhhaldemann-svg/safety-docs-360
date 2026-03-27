"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

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
    totalActiveJobsites: number;
    totalOpenObservations: number;
    totalHighRiskObservations: number;
    sifCount: number;
    averageClosureTimeHours: number;
    topHazardCategories: Array<{ category: string; count: number }>;
    openIncidents: number;
    dapCompletionToday: { completed: number; total: number; percent: number };
  };
  safetyLeadership?: {
    trendOfObservationsByWeek: Array<{ week: string; count: number }>;
    repeatHazardCategories: Array<{ category: string; count: number }>;
    highRiskLocations: Array<{ jobsiteId: string; count: number }>;
    sifByCategory: Array<{ category: string; count: number }>;
    closurePerformanceByJobsite: Array<{ jobsiteId: string; averageHours: number; sampleSize: number }>;
    positiveNegativeObservationRatio: { positive: number; negative: number; ratio: number };
  };
};

function formatCategory(category: string) {
  return category.replace(/_/g, " ");
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 60000
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState("");

  async function loadSummary(windowDays: number) {
    setLoading(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetchWithTimeout(`/api/company/analytics/summary?days=${windowDays}`, { headers }, 60000);
      const data = (await response.json().catch(() => null)) as {
        summary?: AnalyticsSummary;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load analytics summary.");
      setSummary(data?.summary ?? null);
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Analytics load timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Failed to load analytics summary."
      );
      setSummary(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadSummary(days);
  }, [days]);

  const totals = useMemo(() => summary?.totals ?? {}, [summary]);
  const closure = useMemo(() => summary?.closureTimes ?? {}, [summary]);
  const dash = summary?.companyDashboard;
  const topHazards = summary?.topHazardCategories ?? [];
  const trends = summary?.observationTrends ?? [];
  const riskRows = summary?.jobsiteRiskScore ?? [];
  const sif = summary?.sifDashboard;
  const leadership = summary?.safetyLeadership;

  const totalActions = totals.correctiveActions ?? 0;
  const closedInWindow = closure.sampleSize ?? 0;
  const resolutionPct =
    !loading && totalActions > 0 ? Math.round((closedInWindow / totalActions) * 100) : null;

  const kpiCards = [
    {
      title: "Open observations",
      value: loading ? "—" : String(dash?.totalOpenObservations ?? 0),
      note: "Corrective actions not yet verified closed (current company).",
    },
    {
      title: "High-risk observations",
      value: loading ? "—" : String(dash?.totalHighRiskObservations ?? 0),
      note: "Severity / priority flagged as high in the selected window.",
    },
    {
      title: "SIF potential",
      value: loading ? "—" : String(sif?.potentialCount ?? dash?.sifCount ?? 0),
      note: "Observations marked SIF-potential in the window.",
    },
    {
      title: "Incidents (window)",
      value: loading ? "—" : String(totals.incidents ?? 0),
      note: `Open incidents now: ${loading ? "—" : dash?.openIncidents ?? 0}`,
    },
    {
      title: "Active jobsites",
      value: loading ? "—" : String(dash?.totalActiveJobsites ?? 0),
      note: "Jobsites in an active / planned state.",
    },
    {
      title: "Avg closure time",
      value: loading ? "—" : `${dash?.averageClosureTimeHours ?? closure.averageHours ?? 0} hrs`,
      note: `Based on ${closedInWindow} closed item${closedInWindow === 1 ? "" : "s"} in the window.`,
    },
    {
      title: "DAP activity today",
      value: loading ? "—" : `${dash?.dapCompletionToday?.percent ?? 0}%`,
      note: `${dash?.dapCompletionToday?.completed ?? 0}/${dash?.dapCompletionToday?.total ?? 0} planned activities completed today.`,
    },
    {
      title: "Actions logged (window)",
      value: loading ? "—" : String(totalActions),
      note: "Corrective actions created in the selected period.",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Analytics"
        title="Company safety analytics"
        description="Trends and counts across observations, incidents, permits, and DAPs for your company. Use the time window to match reporting periods."
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Link
              href="/field-id-exchange"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Corrective actions
            </Link>
            <Link
              href="/reports"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reports
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
            >
              Dashboard
            </Link>
          </div>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.title}
            className="flex min-h-[152px] flex-col rounded-[1.35rem] border border-slate-200 bg-white p-5 pb-6 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{card.title}</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{card.value}</div>
            <p className="mt-auto pt-4 text-sm leading-relaxed text-slate-500">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Permits (window)</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : totals.permits ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">DAPs (window)</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : totals.daps ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">DAP activities (window)</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : totals.dapActivities ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Closed in window</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : closedInWindow}</div>
          <div className="mt-1 text-xs text-slate-500">
            {resolutionPct !== null ? `${resolutionPct}% of actions in period` : "—"}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Top hazard categories"
          description="Grouped from corrective actions, incidents, and DAP activities in this window."
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : topHazards.length === 0 ? (
            <EmptyState
              title="No hazard categories yet"
              description="As observations and activities are logged, category counts will appear here."
            />
          ) : (
            <div className="space-y-2">
              {topHazards.slice(0, 8).map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-slate-800">{formatCategory(item.category)}</span>
                  <span className="font-bold text-slate-950">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Jobsite risk scores"
          description="Weighted mix of incidents, SIF signals, stop-work, and overdue actions."
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : riskRows.length === 0 ? (
            <EmptyState
              title="No risk scores yet"
              description="Jobsite risk ranks appear when linked incidents, permits, or observations exist."
            />
          ) : (
            <div className="space-y-2">
              {riskRows.slice(0, 8).map((row) => (
                <div
                  key={row.jobsiteId}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="truncate font-medium text-slate-800">{row.jobsiteId}</span>
                  <span className="font-bold text-amber-700">{row.score}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>

      <SectionCard
        title="Observation activity by day"
        description="Corrective actions created per day in the selected window."
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : trends.length === 0 ? (
          <EmptyState
            title="No daily trend yet"
            description="Log corrective actions to see day-by-day volume for this period."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {trends.slice(-12).map((item) => (
              <div
                key={item.date}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <span className="text-slate-600">{item.date}</span>
                <span className="font-bold text-slate-950">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Safety leadership"
          description="Weekly observation totals and positive vs negative balance."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Positive vs negative: </span>
              {leadership?.positiveNegativeObservationRatio?.positive ?? 0} :{" "}
              {leadership?.positiveNegativeObservationRatio?.negative ?? 0}
              <span className="text-slate-500">
                {" "}
                (ratio {leadership?.positiveNegativeObservationRatio?.ratio ?? 0})
              </span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (leadership?.trendOfObservationsByWeek ?? []).length === 0 ? (
              <EmptyState title="No weekly trend" description="Not enough observations to build week buckets yet." />
            ) : (
              <div className="space-y-2">
                {(leadership?.trendOfObservationsByWeek ?? []).slice(-8).map((row) => (
                  <div
                    key={row.week}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <span className="text-slate-600">{row.week}</span>
                    <span className="font-semibold text-slate-950">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="SIF categories & closure speed"
          description="Potential SIF distribution and average closure hours by jobsite (where data exists)."
        >
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">SIF by category</div>
              <div className="mt-2 space-y-2">
                {(leadership?.sifByCategory ?? []).length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">No SIF-tagged categories in this window.</p>
                ) : null}
                {(leadership?.sifByCategory ?? []).slice(0, 6).map((row) => (
                  <div
                    key={row.category}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  >
                    <span>{formatCategory(row.category)}</span>
                    <span className="font-semibold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Fastest average closure (jobsite)</div>
              <div className="mt-2 space-y-2">
                {(leadership?.closurePerformanceByJobsite ?? []).slice(0, 6).map((row) => (
                  <div
                    key={row.jobsiteId}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <span className="truncate text-slate-700">{row.jobsiteId}</span>
                    <span className="shrink-0 font-semibold text-slate-900">
                      {row.averageHours} hrs{" "}
                      <span className="text-xs font-normal text-slate-500">(n={row.sampleSize})</span>
                    </span>
                  </div>
                ))}
                {!loading && (leadership?.closurePerformanceByJobsite ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No closed actions with timing in this window.</p>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
