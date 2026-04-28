"use client";

import type { TrafficLightStatus } from "@/src/lib/dashboard/types";
import { CORRECTIVE_ACTIONS_EMPTY } from "@/src/lib/dashboard/dashboardOverviewEmptyMessages";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { formatTitleCase } from "@/lib/formatTitleCase";
import { LayoutList } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type StatusBarSegment = {
  key: string;
  label: string;
  value: number;
  /** Visual emphasis for safety posture */
  tone?: TrafficLightStatus;
};

export type StatusBarChartProps = {
  segments: StatusBarSegment[];
  title: string;
  description?: string;
  className?: string;
  /** When true, shows the proportional strip under the bar chart (no fake data — same segment values). */
  showCompositionStrip?: boolean;
  /** When all segment values are zero, shown instead of an empty chart. */
  emptyTitle?: string;
  emptyDescription?: string;
};

function barFill(tone: TrafficLightStatus | undefined): string {
  if (tone === "green") return "var(--semantic-success)";
  if (tone === "yellow") return "var(--semantic-warning)";
  if (tone === "red") return "var(--semantic-danger)";
  return "var(--app-accent-primary)";
}

function stripClass(tone: TrafficLightStatus | undefined): string {
  if (tone === "green") return "bg-[var(--semantic-success)]";
  if (tone === "yellow") return "bg-[var(--semantic-warning)]";
  if (tone === "red") return "bg-[var(--semantic-danger)]";
  return "bg-[var(--app-accent-primary)]";
}

const CHART_GRID = "rgba(111, 138, 177, 0.22)";
const CHART_AXIS = "#4f647b";
const CHART_TOOLTIP_BG = "rgba(255, 255, 255, 0.96)";
const CHART_TOOLTIP_BORDER = "rgba(111, 138, 177, 0.35)";

/**
 * Corrective-action and status mix as a responsive Recharts column chart, optional composition strip.
 */
export function StatusBarChart({
  segments,
  title,
  description,
  className = "",
  showCompositionStrip = true,
  emptyTitle = CORRECTIVE_ACTIONS_EMPTY.title,
  emptyDescription = CORRECTIVE_ACTIONS_EMPTY.description,
}: StatusBarChartProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const displayTitle = formatTitleCase(title) || title;

  if (segments.length === 0 || total === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{displayTitle}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState align="left" icon={LayoutList} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const chartRows = segments.map((s) => ({
    key: s.key,
    name: formatTitleCase(s.label) || s.label,
    value: Math.max(0, s.value),
    tone: s.tone,
  }));

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{displayTitle}</h4>
        {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
      </div>

      <div className="h-56 w-full min-h-[200px] min-w-0 max-w-full rounded-2xl border border-[var(--app-border)] bg-white/90 p-2 shadow-[0_8px_18px_rgba(76,108,161,0.05)] sm:h-64 sm:p-3">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 32 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              tickLine={{ stroke: CHART_GRID }}
              axisLine={{ stroke: CHART_GRID }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={56}
            />
            <YAxis
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
              contentStyle={{
                background: CHART_TOOLTIP_BG,
                border: `1px solid ${CHART_TOOLTIP_BORDER}`,
                borderRadius: "12px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value}`, "Count"]}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {chartRows.map((row) => (
                <Cell key={row.key} fill={barFill(row.tone)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showCompositionStrip ? (
        <div className="flex h-3 w-full overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-panel)]">
          {segments.map((s) => {
            const pct = (Math.max(0, s.value) / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={s.key}
                className={`${stripClass(s.tone)} min-w-0 transition-all`}
                style={{ width: `${pct}%` }}
                title={`${s.label}: ${s.value}`}
              />
            );
          })}
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((s) => (
          <li
            key={s.key}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--app-border)] bg-white/85 px-3 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stripClass(s.tone)}`} aria-hidden="true" />
              <span className="truncate font-medium text-[var(--app-text-strong)]">{s.label}</span>
            </span>
            <span className="shrink-0 font-app-display font-bold text-[var(--app-text-strong)]">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
