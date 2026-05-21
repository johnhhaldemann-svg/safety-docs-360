import Link from "next/link";
import { Activity, AlertTriangle } from "lucide-react";
import type {
  DashboardImprovementDriver,
  DashboardOverview,
  TrafficLightStatus,
} from "@/src/lib/dashboard/types";
import {
  buildDashboardImprovementDrivers,
  buildDashboardPerformanceScore,
} from "@/src/lib/dashboard/performanceScore";
import { formatTitleCase } from "@/lib/formatTitleCase";
import { SectionCard } from "@/src/components/dashboard/SectionCard";
import { MetricCard } from "@/src/components/dashboard/MetricCard";
import { StatusBadge } from "@/src/components/dashboard/StatusBadge";
import { StatusBarChart } from "@/src/components/dashboard/StatusBarChart";

type PerformanceHubPanelProps = {
  overview: DashboardOverview;
  activeJobsites: number;
};

function scoreBandClassName(band: TrafficLightStatus): string {
  if (band === "green") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800";
  if (band === "yellow") return "border-amber-500/45 bg-amber-500/12 text-amber-900";
  return "border-red-500/45 bg-red-500/10 text-red-900";
}

function severityTone(severity: DashboardImprovementDriver["severity"]): "neutral" | "success" | "warning" | "error" | "info" {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "neutral";
}

function trendLabel(trend: NonNullable<ReturnType<typeof buildDashboardPerformanceScore>["trend"]> | undefined): string {
  if (trend === "up") return "Risk rising";
  if (trend === "down") return "Improving";
  return "Stable";
}

function readinessValue(value: number): string {
  return Number.isFinite(value) && value > 0 ? `${Math.round(value)}%` : "Not enough data yet";
}

export function PerformanceHubPanel({ overview, activeJobsites }: PerformanceHubPanelProps) {
  const performance = overview.performanceScore ?? buildDashboardPerformanceScore(overview);
  const drivers = overview.improvementDrivers ?? buildDashboardImprovementDrivers(overview);
  const currentOps = [
    {
      label: "Active jobsites",
      value: activeJobsites,
      hint: "Jobsites currently active, planned, or action-needed in this workspace.",
      band: activeJobsites > 0 ? ("green" as const) : ("yellow" as const),
    },
    {
      label: "Open high-risk",
      value: overview.summary.openHighRiskItems,
      hint: "High-risk work requiring field verification.",
      band: overview.summary.openHighRiskItems > 0 ? ("red" as const) : ("green" as const),
    },
    {
      label: "Overdue correctives",
      value: overview.summary.overdueCorrectiveActions,
      hint: "Past-due corrective actions still open.",
      band: overview.summary.overdueCorrectiveActions > 0 ? ("red" as const) : ("green" as const),
    },
    {
      label: "Permit readiness",
      value: readinessValue(overview.summary.permitComplianceRate),
      hint: "Closed permit coverage in the selected window.",
      band: overview.summary.permitComplianceRate >= 90 ? ("green" as const) : overview.summary.permitComplianceRate >= 70 ? ("yellow" as const) : ("red" as const),
    },
    {
      label: "Training readiness",
      value: readinessValue(overview.summary.trainingReadinessRate),
      hint: "Coverage signal for training and credentials.",
      band: overview.summary.trainingReadinessRate >= 90 ? ("green" as const) : overview.summary.trainingReadinessRate >= 70 ? ("yellow" as const) : ("red" as const),
    },
    {
      label: "Document readiness",
      value: readinessValue(overview.summary.documentReadinessRate),
      hint: "Approved output compared with document workflow volume.",
      band: overview.summary.documentReadinessRate >= 90 ? ("green" as const) : overview.summary.documentReadinessRate >= 70 ? ("yellow" as const) : ("red" as const),
    },
  ];

  const scoreSegments = performance.contributors.map((item) => ({
    key: item.key,
    label: item.label,
    value: item.score,
    tone: item.band,
  }));

  return (
    <div className="space-y-6" data-dashboard-hub="information">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard
          eyebrow="Information hub"
          title="Safety Performance Score"
          description="A blended 0-100 read on safety performance, operational readiness, and executive health for the selected window."
          tone="elevated"
        >
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <div className={`rounded-2xl border px-5 py-6 text-center shadow-inner ${scoreBandClassName(performance.band)}`}>
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-current/20 bg-white/80 font-app-display text-5xl font-bold tracking-tight text-[var(--app-text-strong)]">
                {performance.value}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <StatusBadge label={performance.label} trafficLight={performance.band} />
                <StatusBadge label={trendLabel(performance.trend)} tone={performance.trend === "down" ? "success" : performance.trend === "up" ? "warning" : "neutral"} />
              </div>
            </div>
            <div className="min-w-0">
              <StatusBarChart
                segments={scoreSegments}
                title="Score contributors"
                description="Each contributor is normalized to 0-100 so the score can evolve without a schema migration."
                showCompositionStrip={false}
                emptyTitle="No score contributors"
                emptyDescription="Contributor scores will appear when the overview service returns dashboard data."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Improve next"
          title="Priority action queue"
          description="The highest-signal gaps the team should investigate or assign first."
          tone="attention"
        >
          <div className="grid gap-3">
            {drivers.map((driver) => {
              const content = (
                <div className="relative overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white/86 px-4 py-3 shadow-[0_8px_18px_rgba(76,108,161,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--app-text-strong)]">
                        {formatTitleCase(driver.title) || driver.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--app-text)]">{driver.detail}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge label={driver.severity} tone={severityTone(driver.severity)} />
                      {driver.metric ? (
                        <span className="font-app-display text-sm font-bold text-[var(--app-text-strong)]">{driver.metric}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );

              if (!driver.href) return <div key={driver.id}>{content}</div>;
              return (
                <Link key={driver.id} href={driver.href} className="block transition hover:-translate-y-0.5">
                  {content}
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="Current operations"
        title="Operational command strip"
        description="The hub indicators most likely to explain where the team is performing well and where attention is needed."
        tone="panel"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {currentOps.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              hint={item.hint}
              statusBand={item.band}
            />
          ))}
        </div>
      </SectionCard>

      {overview.engineHealth.some((item) => item.status !== "green") ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Some data sources are warning or disconnected, so the score should be treated as a working signal until the source is restored.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950">
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Connected dashboard sources are green for this snapshot.</p>
          </div>
        </div>
      )}
    </div>
  );
}
