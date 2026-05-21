"use client";

import Link from "next/link";
import { AddInsightToDashboardButton } from "@/components/analytics/AddInsightToDashboardButton";
import { Sparkline } from "@/components/metrics/Sparkline";
import type { AnalyticsSummary, FocusTabId, HealthIssueFocus } from "@/components/analytics/types";

export function AnalyticsFocusedTab({
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
  healthIssueRollup,
  healthIssueFocus,
  selectedHealthIssue,
  onSelectHealthIssue,
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
  healthIssueRollup?: AnalyticsSummary["healthIssueRollup"];
  healthIssueFocus?: HealthIssueFocus;
  selectedHealthIssue?: string | null;
  onSelectHealthIssue?: (injuryType: string | null) => void;
}) {
  const rows = loading ? [] : filteredRecent.length > 0 ? filteredRecent : recent;
  const title =
    tab === "near_misses"
      ? "Near miss lens"
      : tab === "hazards"
        ? "Hazard lens"
        : tab === "health_issues"
          ? "Health issues"
          : "Inspections & field activity";
  const subtitle =
    tab === "near_misses"
      ? "Observations tagged as near misses in your selected time range."
      : tab === "hazards"
        ? "Hazard and negative observations — prioritize corrective follow-up."
        : tab === "health_issues"
          ? "Typed injury incidents in the selected window — pick a category to drill down."
          : "Permits, JSAs, and recorded activity in the same window as your summary.";
  const healthTotal =
    (healthIssueRollup ?? []).reduce((sum, item) => sum + item.count, 0) || 0;
  const heroStat =
    tab === "near_misses"
      ? (breakdown?.nearMiss ?? 0)
      : tab === "hazards"
        ? (breakdown?.hazard ?? 0)
        : tab === "health_issues"
          ? healthTotal
          : (breakdown?.inspections ?? 0);
  const heroLabel =
    tab === "near_misses"
      ? "Near misses in window"
      : tab === "hazards"
        ? "Hazard-tagged observations"
        : tab === "health_issues"
          ? "Typed injury incidents in window"
          : "Permit + activity events (approx.)";
  const metricTileClassName =
    "rounded-xl border border-[var(--app-border-subtle)] bg-white/90 px-4 py-3 text-center shadow-[0_8px_18px_rgba(76,108,161,0.05)]";

  const heroPinBlock =
    tab === "inspections"
      ? ("permit_followups" as const)
      : tab === "hazards"
        ? ("hazard_trends" as const)
        : tab === "health_issues"
          ? ("graph_observation_mix" as const)
          : ("graph_observation_mix" as const);

  if (tab === "health_issues") {
    return (
      <div className="space-y-6" id="analytics-tabpanel-health_issues" role="tabpanel">
        <div className="rounded-2xl border border-[var(--app-accent-border-24)] bg-gradient-to-br from-[var(--app-accent-surface-12)] to-[rgba(234,241,255,0.92)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent-primary)]">{title}</p>
            <AddInsightToDashboardButton blockId={heroPinBlock} />
          </div>
          <h2 className="font-app-display mt-2 text-3xl font-black text-[var(--app-text-strong)] sm:text-4xl">
            {loading ? "—" : heroStat}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-text)]">{heroLabel}</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--app-muted)]">{subtitle}</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="analytics-dark-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Health issues</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(healthIssueRollup ?? []).map((item) => (
                  <button
                    key={item.injuryType}
                    type="button"
                    onClick={() => onSelectHealthIssue?.(selectedHealthIssue === item.injuryType ? null : item.injuryType)}
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
                {(healthIssueRollup?.length ?? 0) === 0 ? (
                  <p className="text-sm text-slate-500">
                    No typed injury incidents in this window. Add injury type fields in incidents.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="analytics-dark-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected issue detail</p>
              {healthIssueFocus ? (
                <>
                  <h3 className="mt-2 text-2xl font-black font-app-display text-[var(--app-text-strong)]">
                    {healthIssueFocus.label}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">{healthIssueFocus.count} incident(s) in selected window.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-5">
                    {Object.entries(healthIssueFocus.severityBands).map(([band, value]) => (
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
        <div className="flex justify-end">
          <Link href="/reports" className="analytics-action-primary px-4 py-2.5 text-xs uppercase tracking-wide transition">
            Open reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id={`analytics-tabpanel-${tab}`} role="tabpanel">
      <div className="rounded-2xl border border-[var(--app-accent-border-24)] bg-gradient-to-br from-[var(--app-accent-surface-12)] to-[rgba(234,241,255,0.92)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent-primary)]">{title}</p>
          <AddInsightToDashboardButton blockId={heroPinBlock} />
        </div>
        <h2 className="font-app-display mt-2 text-3xl font-black text-[var(--app-text-strong)] sm:text-4xl">{loading ? "—" : heroStat}</h2>
        <p className="mt-1 text-sm text-[var(--app-text)]">{heroLabel}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--app-muted)]">{subtitle}</p>
        {tab === "inspections" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className={metricTileClassName}>
              <p className="text-[10px] font-bold uppercase text-[var(--app-muted)]">Permits (window)</p>
              <p className="font-app-display mt-1 text-2xl font-black text-[var(--app-text-strong)]">
                {loading ? "—" : totals?.permits ?? 0}
              </p>
            </div>
            <div className={metricTileClassName}>
              <p className="text-[10px] font-bold uppercase text-[var(--app-muted)]">JSAs / Planned activity</p>
              <p className="font-app-display mt-1 text-2xl font-black text-[var(--app-text-strong)]">
                {loading ? "—" : totals?.daps ?? 0}
              </p>
            </div>
            <div className={metricTileClassName}>
              <p className="text-[10px] font-bold uppercase text-[var(--app-muted)]">JSA activities</p>
              <p className="font-app-display mt-1 text-2xl font-black text-[var(--app-text-strong)]">
                {loading ? "—" : totals?.dapActivities ?? 0}
              </p>
            </div>
          </div>
        ) : null}
        {tab === "inspections" ? (
          <p className="mt-4 text-xs text-[var(--app-muted)]">
            JSA completion today:{" "}
            <span className="font-semibold text-[var(--app-text-strong)]">
              {loading
                ? "—"
                : `${dash?.dapCompletionToday?.percent ?? 0}% (${dash?.dapCompletionToday?.completed ?? 0}/${dash?.dapCompletionToday?.total ?? 0})`}
            </span>
          </p>
        ) : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="analytics-dark-panel p-5 shadow-inner">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">Observation trend</p>
            <AddInsightToDashboardButton blockId="graph_hazard_trends" />
          </div>
          <div className="analytics-dark-panel-soft mt-4 px-3 py-2">
            <Sparkline points={trends} windowDays={windowDays} loading={loading} variant="compact" />
          </div>
        </div>
        <div className="analytics-dark-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">Recent reports</p>
            <AddInsightToDashboardButton blockId="recent_reports" />
          </div>
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="analytics-dark-panel-soft flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-sm font-semibold text-[var(--app-text-strong)]">{row.title}</span>
                <span className={["shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", tagChip(row.tag)].join(" ")}>{row.tag}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {tab === "hazards" ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="analytics-dark-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">Trending hazards</p>
                <AddInsightToDashboardButton blockId="graph_hazard_trends" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {hazardTiles.map((tile) => (
                  <div key={tile.label} className="analytics-dark-panel-soft p-4 text-center">
                    <p className="text-[11px] font-semibold text-[var(--app-muted)]">{tile.label}</p>
                    <p className="font-app-display mt-2 text-2xl font-black text-[var(--app-text-strong)]">{loading ? "—" : tile.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[rgba(217,83,79,0.26)] bg-[var(--semantic-danger-bg)] p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--semantic-danger)]">SIF potential</p>
              <p className="font-app-display mt-4 text-5xl font-black text-[var(--app-text-strong)]">{loading ? "—" : sif?.potentialCount ?? 0}</p>
              <p className="mt-2 text-xs text-[var(--app-muted)]">From observations in window</p>
            </div>
          </div>
        </div>
      ) : null}
      {tab === "near_misses" && leadership ? (
        <div className="analytics-dark-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">Leadership mix</p>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-[var(--app-text)]">
            <div>
              <span className="text-[var(--app-muted)]">Positive observations</span>
              <span className="ml-2 font-app-display font-bold text-[var(--semantic-success)]">{leadership.positiveNegativeObservationRatio?.positive ?? 0}</span>
            </div>
            <div>
              <span className="text-[var(--app-muted)]">Negative / near miss</span>
              <span className="ml-2 font-app-display font-bold text-[var(--semantic-warning)]">{leadership.positiveNegativeObservationRatio?.negative ?? 0}</span>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Link href="/reports" className="analytics-action-primary px-4 py-2.5 text-xs uppercase tracking-wide transition">
          Open reports
        </Link>
      </div>
    </div>
  );
}
