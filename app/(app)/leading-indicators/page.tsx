"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Eye, ShieldCheck, Clock, ChevronDown, RefreshCw,
} from "lucide-react";

type Metrics = {
  windowDays: number;
  siteId: string | null;
  nearMissReported: number;
  positiveObservations: number;
  negativeObservations: number;
  obsPositiveRate: number | null;
  openCorrectiveActions: number;
  overdueCorrectiveActions: number;
  closedCorrectiveActions: number;
  totalCorrectiveActionsCreated: number;
  caClosureRate: number | null;
  sifPotentialItems: number;
  scores: {
    caClosureRate: number | null;
    onTimeCompletion: number;
    observationActivity: number;
    nearMissReporting: number;
  };
  trend: Array<{ week: string; nearMiss: number; incident: number; firstAid: number }>;
};

function ScoreRing({ score, label, color }: { score: number | null; label: string; color: string }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-slate-200 text-slate-400 text-xs">N/A</div>
        <p className="text-xs text-slate-500 text-center">{label}</p>
      </div>
    );
  }
  const good = score >= 70;
  const ok = score >= 40;
  const ringColor = good ? "border-emerald-400" : ok ? "border-amber-400" : "border-red-400";
  const textColor = good ? "text-emerald-700" : ok ? "text-amber-700" : "text-red-700";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full border-4 ${ringColor} font-bold text-sm ${textColor}`}>
        {score}
      </div>
      <p className="text-xs text-slate-500 text-center max-w-[80px]">{label}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor,
  good,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  iconColor: string;
  good?: boolean | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        {good !== undefined && good !== null && (
          good ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )
        )}
        {good === null && <Minus className="h-4 w-4 text-slate-300" />}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
      {subtext && <p className="mt-0.5 text-xs text-slate-400">{subtext}</p>}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex h-8 flex-col justify-end">
      <div
        className={`rounded-sm ${color}`}
        style={{ height: `${Math.max(4, pct)}%`, minHeight: value > 0 ? 4 : 0 }}
      />
    </div>
  );
}

const WINDOW_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "6 months", value: 180 },
];

export default function LeadingIndicatorsPage() {
  const [days, setDays] = useState(30);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { forceRefresh?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/leading-indicators?days=${days}`, {
        // When the user explicitly hits Refresh, bypass the Cache-Control header
        // so they always get live data. Normal auto-loads respect the 60 s cache.
        cache: opts?.forceRefresh ? "no-cache" : "default",
      });
      const data = await res.json() as Metrics & { error?: string };
      if (data.error) { setError(data.error); return; }
      setMetrics(data);
    } catch {
      setError("Failed to load metrics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const trendMax = metrics
    ? Math.max(1, ...metrics.trend.map((t) => t.nearMiss + t.incident + t.firstAid))
    : 1;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leading Indicator Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Proactive safety metrics — track early warning signals before incidents occur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => void load({ forceRefresh: true })}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !metrics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {metrics && (
        <>
          {/* Score rings */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-700">Safety Scores (0–100)</p>
                <p className="text-xs text-slate-400 mt-0.5">Higher is better</p>
              </div>
              <div className="flex flex-wrap gap-6">
                <ScoreRing score={metrics.scores.caClosureRate} label="CA Closure Rate" color="emerald" />
                <ScoreRing score={metrics.scores.onTimeCompletion} label="On-Time Completion" color="blue" />
                <ScoreRing score={metrics.scores.observationActivity} label="Observation Activity" color="violet" />
                <ScoreRing score={metrics.scores.nearMissReporting} label="Near-Miss Reporting" color="amber" />
              </div>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Near-Misses Reported"
              value={metrics.nearMissReported}
              subtext={`Last ${days} days`}
              icon={Eye}
              iconColor="bg-amber-500"
              good={metrics.nearMissReported > 0}
            />
            <MetricCard
              label="Positive Observations"
              value={metrics.positiveObservations}
              subtext={
                metrics.obsPositiveRate !== null
                  ? `${metrics.obsPositiveRate}% of all observations`
                  : undefined
              }
              icon={CheckCircle2}
              iconColor="bg-emerald-500"
              good={metrics.obsPositiveRate !== null ? metrics.obsPositiveRate >= 40 : null}
            />
            <MetricCard
              label="Open Corrective Actions"
              value={metrics.openCorrectiveActions}
              subtext={
                metrics.overdueCorrectiveActions > 0
                  ? `${metrics.overdueCorrectiveActions} overdue`
                  : "None overdue"
              }
              icon={AlertTriangle}
              iconColor={metrics.overdueCorrectiveActions > 0 ? "bg-red-500" : "bg-slate-400"}
              good={metrics.overdueCorrectiveActions === 0}
            />
            <MetricCard
              label="CA Closure Rate"
              value={metrics.caClosureRate !== null ? `${metrics.caClosureRate}%` : "N/A"}
              subtext={`${metrics.closedCorrectiveActions} closed of ${metrics.totalCorrectiveActionsCreated} created`}
              icon={ShieldCheck}
              iconColor="bg-blue-500"
              good={metrics.caClosureRate !== null ? metrics.caClosureRate >= 60 : null}
            />
            <MetricCard
              label="Overdue CAs"
              value={metrics.overdueCorrectiveActions}
              subtext="Past due date"
              icon={Clock}
              iconColor={metrics.overdueCorrectiveActions > 0 ? "bg-red-500" : "bg-emerald-500"}
              good={metrics.overdueCorrectiveActions === 0}
            />
            <MetricCard
              label="Negative Observations"
              value={metrics.negativeObservations}
              subtext="Hazards identified"
              icon={AlertTriangle}
              iconColor="bg-orange-500"
              good={null}
            />
            <MetricCard
              label="SIF Potential Items"
              value={metrics.sifPotentialItems}
              subtext="Seriously injured/fatal potential"
              icon={AlertTriangle}
              iconColor={metrics.sifPotentialItems > 0 ? "bg-red-600" : "bg-emerald-500"}
              good={metrics.sifPotentialItems === 0}
            />
            <MetricCard
              label="CAs Closed (Period)"
              value={metrics.closedCorrectiveActions}
              subtext={`Last ${days} days`}
              icon={CheckCircle2}
              iconColor="bg-emerald-500"
              good={metrics.closedCorrectiveActions > 0}
            />
          </div>

          {/* Trend chart */}
          {metrics.trend.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-700">Weekly Incident Trend</h2>
              <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: 100 }}>
                {metrics.trend.map((t) => (
                  <div key={t.week} className="flex min-w-[40px] flex-1 flex-col items-center gap-0.5">
                    <div className="flex w-full flex-col justify-end gap-px" style={{ height: 72 }}>
                      <MiniBar value={t.incident} max={trendMax} color="bg-red-400" />
                      <MiniBar value={t.nearMiss} max={trendMax} color="bg-amber-400" />
                      <MiniBar value={t.firstAid} max={trendMax} color="bg-blue-300" />
                    </div>
                    <p className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(t.week).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />Incidents</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />Near-misses</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-300" />First aid</span>
              </div>
            </div>
          )}

          {/* Interpretation guide */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-600 mb-2">How to read leading indicators</p>
            <ul className="space-y-1 text-xs text-slate-500">
              <li>↑ <strong>Near-miss reporting</strong> is positive — it means workers feel safe speaking up.</li>
              <li>↑ <strong>Positive observation rate</strong> above 40% suggests a healthy safety culture.</li>
              <li>↓ <strong>Overdue corrective actions</strong> near zero means problems get fixed promptly.</li>
              <li>↑ <strong>CA closure rate</strong> above 60% shows the team is completing its commitments.</li>
              <li>↓ <strong>SIF potential items</strong> at zero is the goal — each one needs immediate attention.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
