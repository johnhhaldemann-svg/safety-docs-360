import type { TrafficLightStatus, TrendDirection } from "@/src/lib/dashboard/types";
import { trafficLightStripeClass } from "@/src/lib/dashboard/dashboardStatusSemantics";
import { formatTitleCase } from "@/lib/formatTitleCase";

export type MetricCardProps = {
  label: string;
  value: string | number;
  /** When true, value renders as subdued (e.g. em dash when no measured data). */
  valueMuted?: boolean;
  /** Optional traffic band colors the left status stripe (see dashboardStatusSemantics). */
  statusBand?: TrafficLightStatus;
  hint?: string;
  /** Optional trend arrow label (e.g. vs prior window). */
  trend?: TrendDirection;
  trendLabel?: string;
  className?: string;
};

function trendSymbol(dir: TrendDirection): string {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  return "→";
}

function trendClass(dir: TrendDirection): string {
  if (dir === "up") return "text-[var(--semantic-danger)]";
  if (dir === "down") return "text-[var(--semantic-success)]";
  return "text-[var(--app-muted)]";
}

/**
 * Compact KPI tile for dashboard grids (mobile-first).
 */
export function MetricCard({
  label,
  value,
  valueMuted,
  statusBand,
  hint,
  trend,
  trendLabel,
  className = "",
}: MetricCardProps) {
  const stripeClass = statusBand ? trafficLightStripeClass(statusBand) : "bg-[var(--app-accent-primary)] opacity-45";
  const displayLabel = formatTitleCase(label) || label;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.92)_0%,_var(--app-panel-soft)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(76,108,161,0.05)] ${className}`.trim()}
    >
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${stripeClass}`} aria-hidden="true" />
      <div className="pl-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">{displayLabel}</p>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <p
            className={`font-app-display text-2xl font-bold tracking-tight sm:text-3xl ${
              valueMuted ? "text-[var(--app-muted)]" : "text-[var(--app-text-strong)]"
            }`}
          >
            {value}
          </p>
          {trend ? (
            <span className={`text-xs font-semibold ${trendClass(trend)}`}>
              <span aria-hidden="true">{trendSymbol(trend)}</span>
              {trendLabel ? <span className="ml-1">{trendLabel}</span> : null}
            </span>
          ) : null}
        </div>
        {hint ? <p className="mt-2 text-xs leading-relaxed text-[var(--app-text)]">{hint}</p> : null}
      </div>
    </div>
  );
}
