import type { TrafficLightStatus, TrendDirection } from "@/src/lib/dashboard/types";
import { trafficLightStripeClass } from "@/src/lib/dashboard/dashboardStatusSemantics";
import { formatTitleCase } from "@/lib/formatTitleCase";
import Link from "next/link";

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
  href?: string;
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
  href,
  className = "",
}: MetricCardProps) {
  const stripeClass = statusBand ? trafficLightStripeClass(statusBand) : "bg-[var(--app-accent-primary)] opacity-45";
  const displayLabel = formatTitleCase(label) || label;
  const content = (
    <>
      <span className={`absolute inset-x-4 top-0 h-0.5 rounded-b-full ${stripeClass}`} aria-hidden="true" />
      <div className="pl-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">{displayLabel}</p>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <p
            className={`font-app-display break-words text-2xl font-bold leading-tight tracking-tight sm:text-[2rem] ${
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
        {hint ? <p className="mt-2 text-xs leading-relaxed text-[var(--app-muted)]">{hint}</p> : null}
      </div>
    </>
  );
  const classes = `relative min-h-[8.75rem] overflow-hidden rounded-xl border border-[var(--app-border)] bg-white px-4 py-4 shadow-[0_6px_16px_rgba(44,58,86,0.045)] ${href ? "block transition hover:-translate-y-0.5 hover:border-[var(--app-accent-border-28)] hover:shadow-[0_12px_24px_rgba(44,58,86,0.09)]" : ""} ${className}`.trim();
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
