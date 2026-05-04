import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import { TrustSummaryPanel } from "@/components/leadership/TrustSummaryPanel";

const DAY_OPTIONS = [7, 30, 90] as const;

function toneForScore(score: number) {
  if (score >= 75) return "text-red-600";
  if (score >= 55) return "text-orange-600";
  if (score >= 35) return "text-amber-600";
  return "text-emerald-600";
}

function impactClass(impact: string) {
  if (impact === "High impact") return "border-red-200 bg-red-50 text-red-700";
  if (impact === "Medium impact") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function TrendChart({ points }: { points: PredictiveRiskPayload["trend"] }) {
  const safe = points.length > 0 ? points : [{ label: "Now", riskScore: 0 }];
  const width = 520;
  const height = 170;
  const pad = 22;
  const step = safe.length > 1 ? (width - pad * 2) / (safe.length - 1) : 0;
  const coords = safe.map((point, idx) => {
    const x = pad + idx * step;
    const y = height - pad - (Math.max(0, Math.min(100, point.riskScore)) / 100) * (height - pad * 2);
    return { x, y, ...point };
  });
  const path = coords.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${coords.at(-1)?.x ?? pad} ${height - pad} L ${pad} ${height - pad} Z`;

  return (
    <div className="h-full min-h-[220px] rounded-lg border border-[var(--app-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[var(--app-text-strong)]">Risk score over time</h2>
          <p className="mt-1 text-xs text-[var(--app-muted)]">Average predicted risk across visible locations.</p>
        </div>
        <BarChart3 className="h-5 w-5 text-[var(--app-accent-primary)]" aria-hidden />
      </div>
      <svg className="mt-3 h-[170px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Risk trend chart">
        <path d={area} fill="rgba(37,99,235,0.12)" />
        <path d={path} fill="none" stroke="rgb(37,99,235)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((p) => (
          <circle key={`${p.label}-${p.x}`} cx={p.x} cy={p.y} r="4" fill="white" stroke="rgb(37,99,235)" strokeWidth="2" />
        ))}
        {coords.map((p, idx) =>
          idx % Math.max(1, Math.ceil(coords.length / 4)) === 0 || idx === coords.length - 1 ? (
            <text key={`label-${p.label}`} x={p.x} y={height - 4} textAnchor="middle" className="fill-slate-500 text-[10px]">
              {p.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--app-muted)]">{label}</p>
      <p className={`mt-2 font-app-display text-3xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--app-muted)]">{detail}</p>
    </div>
  );
}

export function PredictiveModelView({
  data,
  loading,
  error,
  days,
  onDaysChange,
  selectedJobsiteId,
  onJobsiteChange,
  onRefresh,
}: {
  data: PredictiveRiskPayload | null;
  loading: boolean;
  error: string;
  days: number;
  onDaysChange?: (days: number) => void;
  selectedJobsiteId?: string;
  onJobsiteChange?: (jobsiteId: string) => void;
  onRefresh?: () => void;
}) {
  const locations = data?.locations ?? [];
  const drivers = data?.drivers ?? [];
  const actions = data?.actions ?? [];
  const hasSignals = Boolean(data && (locations.some((row) => row.riskScore > 0) || drivers.length > 0));

  return (
    <div className="min-h-[calc(100vh-4rem)] rounded-[1.5rem] border border-[var(--app-accent-surface-18)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.99)_0%,_rgba(239,247,249,0.96)_100%)] text-[var(--app-text)] shadow-[var(--app-shadow-primary-float)]">
      <div className="border-b border-[var(--app-border)] bg-white/90 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-700">Predictive model</p>
            <h1 className="mt-2 font-app-display text-3xl font-black tracking-tight text-[var(--app-text-strong)] sm:text-4xl">
              Predict risk before it happens
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--app-text)]">
              The model combines validated observations, corrective actions, permits, JSAs, and incidents to prioritize where safety leaders should act next.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[var(--app-border)] bg-white p-1" role="group" aria-label="Risk window">
              {DAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onDaysChange?.(option)}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-bold transition",
                    days === option
                      ? "bg-[var(--app-accent-primary)] text-white"
                      : "text-[var(--app-muted)] hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]",
                  ].join(" ")}
                >
                  {option === 7 ? "7 days" : option === 30 ? "30 days" : "90 days"}
                </button>
              ))}
            </div>
            <select
              value={selectedJobsiteId ?? ""}
              onChange={(event) => onJobsiteChange?.(event.target.value)}
              className="h-10 min-w-[180px] rounded-lg border border-[var(--app-border)] bg-white px-3 text-sm font-semibold text-[var(--app-text-strong)]"
              aria-label="Location filter"
            >
              <option value="">All locations</option>
              {locations
                .filter((row) => row.id !== "unassigned")
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 text-sm font-bold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-8">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
        {data?.warning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {data.warning}
          </div>
        ) : null}

        {data?.leadershipTrust ? <TrustSummaryPanel trust={data.leadershipTrust} compact /> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="High risk locations"
            value={loading ? "-" : data?.summary.highRiskLocationCount ?? 0}
            detail={loading ? "Loading" : `${locations.length} locations in view`}
            tone="text-red-600"
          />
          <MetricCard
            label="Predicted incidents"
            value={loading ? "-" : data?.summary.predictedIncidents ?? 0}
            detail="Next model window"
            tone="text-red-600"
          />
          <MetricCard
            label="Average risk score"
            value={loading ? "-" : data?.summary.averageRiskScore ?? 0}
            detail="Out of 100"
            tone="text-orange-600"
          />
          <MetricCard
            label="Confidence level"
            value={loading ? "-" : `${data?.summary.confidencePercent ?? 0}%`}
            detail={data?.model.confidenceLabel ? `${data.model.confidenceLabel} model confidence` : "Model confidence"}
            tone="text-emerald-600"
          />
        </div>

        {!loading && !hasSignals ? (
          <div className="rounded-lg border border-dashed border-[var(--app-border)] bg-white px-5 py-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-teal-700" aria-hidden />
            <h2 className="mt-3 text-lg font-black text-[var(--app-text-strong)]">No predictive risk signals yet</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--app-muted)]">
              Validated observations, corrective actions, incidents, permits, or JSA activity will populate this view as records flow into the company workspace.
            </p>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-12">
          <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 xl:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[var(--app-text-strong)]">Top locations by predicted risk</h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">Jobsite-aware risk records ranked by weighted severity and urgency.</p>
              </div>
              <MapPin className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  <tr className="border-b border-[var(--app-border)]">
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Risk score</th>
                    <th className="py-2 pr-3">Trend</th>
                    <th className="py-2 pr-3">Top driver</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? [] : locations).map((row) => (
                    <tr key={row.id} className="border-b border-[var(--app-border)] last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-bold text-[var(--app-text-strong)]">{row.label}</p>
                        {row.subtitle ? <p className="mt-0.5 text-xs text-[var(--app-muted)]">{row.subtitle}</p> : null}
                      </td>
                      <td className={`py-3 pr-3 font-app-display text-lg font-black ${toneForScore(row.riskScore)}`}>{row.riskScore}</td>
                      <td className="py-3 pr-3">
                        <span className={row.trendDelta > 0 ? "text-red-600" : row.trendDelta < 0 ? "text-emerald-600" : "text-[var(--app-muted)]"}>
                          {row.trendDelta > 0 ? `+${row.trendDelta}` : row.trendDelta}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[var(--app-text)]">{row.topDriver}</td>
                    </tr>
                  ))}
                  {!loading && locations.length === 0 ? (
                    <tr>
                      <td className="py-8 text-center text-sm text-[var(--app-muted)]" colSpan={4}>
                        No locations available in this window.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 xl:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[var(--app-text-strong)]">Top risk drivers</h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">Largest contributors in the selected window.</p>
              </div>
              <Target className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              {(loading ? [] : drivers).map((driver, idx) => (
                <div key={driver.id}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-[var(--app-text-strong)]">{driver.label}</span>
                    <span className="font-black text-[var(--app-text-strong)]">{driver.percent}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className={["h-full rounded-full", idx === 0 ? "bg-red-500" : idx === 1 ? "bg-orange-500" : idx === 2 ? "bg-amber-400" : "bg-emerald-500"].join(" ")}
                      style={{ width: `${Math.max(4, driver.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!loading && drivers.length === 0 ? <p className="py-8 text-center text-sm text-[var(--app-muted)]">No risk drivers yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <TrendChart points={data?.trend ?? []} />
          </div>
          <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 xl:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[var(--app-text-strong)]">Recommended actions</h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">Model-prioritized actions to reduce risk.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              {(loading ? [] : actions).map((action) => (
                <div key={action.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-slate-50/70 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--app-text-strong)]">{action.title}</p>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">{action.target}</p>
                    {action.evidence ? <p className="mt-2 text-xs leading-5 text-[var(--app-text)]">{action.evidence}</p> : null}
                    {typeof action.confidencePercent === "number" ? (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                        {action.sourceModule ?? "predictive risk"} - confidence {action.confidencePercent}%
                      </p>
                    ) : null}
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black ${impactClass(action.impact)}`}>
                    {action.impact}
                  </span>
                </div>
              ))}
              {!loading && actions.length === 0 ? <p className="py-8 text-center text-sm text-[var(--app-muted)]">No recommended actions yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[var(--app-border)] bg-white px-4 py-3 text-xs text-[var(--app-muted)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            <p>{data?.model.provenanceNote ?? "Model provenance will appear after the first load."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {data ? `${data.filters.days} days` : `${days} days`}
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-4 w-4" aria-hidden />
              {data?.model.version ?? "Model pending"}
            </span>
            <Link href="/analytics" className="font-bold text-[var(--app-accent-primary)] underline-offset-4 hover:underline">
              Back to analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
