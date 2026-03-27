"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { InlineMessage, PageHero, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AnalyticsSummary = {
  totals?: {
    correctiveActions?: number;
    incidents?: number;
    permits?: number;
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
  safetyLeadership?: {
    trendOfObservationsByWeek: Array<{ week: string; count: number }>;
    repeatHazardCategories: Array<{ category: string; count: number }>;
    highRiskLocations: Array<{ jobsiteId: string; count: number }>;
    sifByCategory: Array<{ category: string; count: number }>;
    closurePerformanceByJobsite: Array<{ jobsiteId: string; averageHours: number; sampleSize: number }>;
    positiveNegativeObservationRatio: { positive: number; negative: number; ratio: number };
  };
};

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
  const topHazards = summary?.topHazardCategories ?? [];
  const trends = summary?.observationTrends ?? [];
  const riskRows = summary?.jobsiteRiskScore ?? [];
  const sif = summary?.sifDashboard;
  const leadership = summary?.safetyLeadership;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Safety Modules"
        title="Safety Observation Hub"
        description="Centralized safety monitoring for observations, hazards, closures, and risk."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Link href="/dashboard" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Back to Dashboard
            </Link>
          </div>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <div className="rounded-3xl border border-slate-700 bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0b1220_55%)] p-5 text-slate-100 shadow-2xl">
        <div className="mb-4 flex flex-wrap gap-2">
          {["Overview", "Near Misses", "Hazards", "Inspections"].map((tab, idx) => (
            <span
              key={tab}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                idx === 0 ? "bg-white text-slate-900" : "bg-slate-800 text-slate-200"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_1.2fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Total Observations</div>
              <div className="mt-2 text-4xl font-black">{loading ? "-" : totals.correctiveActions ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Open Issues</div>
              <div className="mt-2 text-3xl font-black">
                {loading ? "-" : (totals.correctiveActions ?? 0) - (closure.sampleSize ?? 0)}
              </div>
              <div className="mt-1 text-xs text-rose-300">Critical indicators are shown in risk panels</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Recent / Trending Hazards</div>
            <div className="mt-3 space-y-2">
              {(loading ? [] : topHazards.slice(0, 6)).map((item) => (
                <div key={item.category} className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2 text-sm">
                  <span>{item.category.replace(/_/g, " ")}</span>
                  <span className="font-bold">{item.count}</span>
                </div>
              ))}
              {!loading && topHazards.length === 0 ? (
                <div className="rounded-xl bg-slate-800/70 px-3 py-2 text-sm text-slate-300">No hazard data yet.</div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Observation Stats</div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>High Priority</span>
                  <span className="font-bold text-amber-300">{loading ? "-" : sif?.potentialCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Medium</span>
                  <span className="font-bold">{loading ? "-" : totals.incidents ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Low</span>
                  <span className="font-bold">{loading ? "-" : totals.permits ?? 0}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Resolution Rate</div>
              <div className="mt-2 text-3xl font-black text-emerald-300">
                {loading || !totals.correctiveActions
                  ? "-"
                  : `${Math.round(((closure.sampleSize ?? 0) / Math.max(1, totals.correctiveActions ?? 1)) * 100)}%`}
              </div>
              <div className="mt-1 text-xs text-slate-300">Avg response {closure.averageHours ?? 0} hrs</div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Risk Heatmap</div>
            <div className="mt-3 space-y-2">
              {(loading ? [] : riskRows.slice(0, 6)).map((row) => (
                <div key={row.jobsiteId} className="grid grid-cols-[1fr_auto] items-center rounded-xl bg-slate-800/70 px-3 py-2 text-sm">
                  <span className="truncate">{row.jobsiteId}</span>
                  <span className="font-bold text-amber-300">{row.score}</span>
                </div>
              ))}
              {!loading && riskRows.length === 0 ? (
                <div className="rounded-xl bg-slate-800/70 px-3 py-2 text-sm text-slate-300">No risk score data yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Activity Trends</div>
            <div className="mt-3 space-y-2">
              {(loading ? [] : trends.slice(-8)).map((item) => (
                <div key={item.date} className="grid grid-cols-[1fr_auto] items-center rounded-xl bg-slate-800/70 px-3 py-2 text-sm">
                  <span>{item.date}</span>
                  <span className="font-bold">{item.count}</span>
                </div>
              ))}
              {!loading && trends.length === 0 ? (
                <div className="rounded-xl bg-slate-800/70 px-3 py-2 text-sm text-slate-300">No trend data yet.</div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Safety Leadership Dashboard" description="Weekly trends and repeat hazards.">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              Positive vs Negative: {leadership?.positiveNegativeObservationRatio?.positive ?? 0} : {leadership?.positiveNegativeObservationRatio?.negative ?? 0}
              {" "} (ratio {leadership?.positiveNegativeObservationRatio?.ratio ?? 0})
            </div>
            {(leadership?.trendOfObservationsByWeek ?? []).slice(-6).map((row) => (
              <div key={row.week} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <span>{row.week}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="SIF Categories" description="Potential SIF distribution and closure performance.">
          <div className="space-y-3">
            {(leadership?.sifByCategory ?? []).slice(0, 6).map((row) => (
              <div key={row.category} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <span>{row.category.replace(/_/g, " ")}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
            ))}
            {(leadership?.closurePerformanceByJobsite ?? []).slice(0, 4).map((row) => (
              <div key={row.jobsiteId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span>{row.jobsiteId}</span>
                <span className="font-semibold">{row.averageHours} hrs</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
