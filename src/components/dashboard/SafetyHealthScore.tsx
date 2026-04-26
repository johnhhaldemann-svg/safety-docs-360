import type { DashboardSummary } from "@/src/lib/dashboard/types";
import {
  incidentCountBand,
  nearMissCountBand,
  openHighRiskCountBand,
  overdueCorrectiveCountBand,
  readinessPercentBand,
  safetyHealthCompositeBand,
  trafficLightStripeClass,
  trainingReadinessSummaryBand,
} from "@/src/lib/dashboard/dashboardStatusSemantics";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { Activity } from "lucide-react";
import { MetricCard } from "@/src/components/dashboard/MetricCard";

export type SafetyHealthScoreProps = {
  summary: DashboardSummary;
  /** When true, composite health is forced red (e.g. SIF‑potential theme in top risks). */
  sifPotentialTheme?: boolean;
  expiredCredentials?: number;
  /** Section heading override */
  title?: string;
  description?: string;
  className?: string;
};

function compositeLabel(band: ReturnType<typeof safetyHealthCompositeBand>): string {
  if (band === "green") return "On target";
  if (band === "yellow") return "Needs attention";
  return "Critical exposure";
}

/**
 * Current Safety Health composite plus workforce / readiness KPIs from {@link DashboardSummary}.
 */
export function SafetyHealthScore({
  summary,
  sifPotentialTheme = false,
  expiredCredentials = 0,
  title = "Current Safety Health",
  description = "Blended prevention posture from corrective work, observations, incidents, permits, training, and documents in the selected window.",
  className = "",
}: SafetyHealthScoreProps) {
  const score = Math.max(0, Math.min(100, Math.round(Number(summary.safetyHealthScore) || 0)));
  const healthBand = safetyHealthCompositeBand(summary, { sifPotentialTheme });
  const barClass = trafficLightStripeClass(healthBand);
  const noActivity =
    summary.openHighRiskItems === 0 &&
    summary.overdueCorrectiveActions === 0 &&
    summary.incidentCount === 0 &&
    summary.nearMissCount === 0 &&
    summary.permitComplianceRate === 0 &&
    summary.jsaCompletionRate === 0 &&
    summary.trainingReadinessRate === 0 &&
    summary.documentReadinessRate === 0;

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      <div>
        <h3 className="text-lg font-bold text-[var(--app-text-strong)]">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-relaxed text-[var(--app-text)]">{description}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(234,241,255,0.92)_100%)] p-6 shadow-[var(--app-shadow-soft)]">
          <div className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:text-left">
            <div
              className="font-app-display flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-[var(--app-border)] bg-white text-4xl font-bold text-[var(--app-text-strong)] shadow-inner"
              aria-label={`Safety health score ${score} out of 100`}
            >
              {score}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Composite score</p>
              <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{compositeLabel(healthBand)}</p>
              <div className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--app-panel)] mx-auto sm:mx-0">
                <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${score}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Open high-risk items"
            value={summary.openHighRiskItems}
            statusBand={openHighRiskCountBand(summary.openHighRiskItems)}
          />
          <MetricCard
            label="Overdue corrective actions"
            value={summary.overdueCorrectiveActions}
            statusBand={overdueCorrectiveCountBand(summary.overdueCorrectiveActions)}
          />
          <MetricCard
            label="Incidents"
            value={summary.incidentCount}
            statusBand={incidentCountBand(summary.incidentCount)}
          />
          <MetricCard
            label="Near misses"
            value={summary.nearMissCount}
            statusBand={nearMissCountBand(summary.nearMissCount)}
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">Training and workforce readiness</h4>
        <p className="mt-1 text-xs text-[var(--app-muted)]">Coverage signals from your live dashboard service.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Training readiness"
            value={`${Math.round(summary.trainingReadinessRate)}%`}
            hint="vs requirements in scope"
            statusBand={trainingReadinessSummaryBand(summary.trainingReadinessRate, true, expiredCredentials)}
          />
          <MetricCard
            label="Permit compliance"
            value={`${Math.round(summary.permitComplianceRate)}%`}
            hint="observed in window"
            statusBand={readinessPercentBand(summary.permitComplianceRate, true)}
          />
          <MetricCard
            label="JSA / activity completion"
            value={`${Math.round(summary.jsaCompletionRate)}%`}
            hint="plans completed"
            statusBand={readinessPercentBand(summary.jsaCompletionRate, true)}
          />
        </div>
      </div>

      {noActivity ? (
        <EmptyState
          align="left"
          icon={Activity}
          title="No operational signals in this window"
          description="Counts and readiness rates are all zero—either nothing was recorded for this range or upstream tables are not connected yet. Widen the date range or verify integrations."
        />
      ) : null}
    </div>
  );
}
