"use client";

import type { TrendPoint } from "@/src/lib/dashboard/types";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendChartProps = {
  points: TrendPoint[];
  /** Chart caption shown above the graphic */
  title: string;
  description?: string;
  /** Short Y-axis unit label (e.g. "Count") */
  valueLabel?: string;
  className?: string;
};

function formatTick(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTooltipLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const CHART_LINE = "#2563eb";
const CHART_GRID = "rgba(111, 138, 177, 0.22)";
const CHART_AXIS = "#4f647b";
const CHART_TOOLTIP_BG = "rgba(255, 255, 255, 0.96)";
const CHART_TOOLTIP_BORDER = "rgba(111, 138, 177, 0.35)";

/**
 * Time-series trend from {@link TrendPoint} rows (Recharts line + responsive container).
 */
export function TrendChart({ points, title, description, valueLabel = "Count", className = "" }: TrendChartProps) {
  if (points.length === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState
          align="left"
          icon={LineChartIcon}
          title="No trend data for this range"
          description="There are no time-bucketed points yet. Adjust filters or record events so the series can populate."
        />
      </div>
    );
  }

  const data = points.map((p) => ({
    date: p.date,
    tick: formatTick(p.date),
    detailLabel: formatTooltipLabel(p.date),
    value: Number.isFinite(p.value) ? p.value : 0,
    seriesLabel: p.label?.trim() || valueLabel,
  }));

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <span className="rounded-full border border-[var(--app-border)] bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
          {valueLabel}
        </span>
      </div>
      <div className="h-56 w-full min-h-[220px] rounded-2xl border border-[var(--app-border)] bg-white/90 p-2 shadow-[0_8px_18px_rgba(76,108,161,0.05)] sm:h-64 sm:p-3">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="tick"
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              tickLine={{ stroke: CHART_GRID }}
              axisLine={{ stroke: CHART_GRID }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: CHART_GRID, strokeWidth: 1 }}
              contentStyle={{
                background: CHART_TOOLTIP_BG,
                border: `1px solid ${CHART_TOOLTIP_BORDER}`,
                borderRadius: "12px",
                fontSize: "12px",
                color: "var(--app-text-strong)",
              }}
              formatter={(value) => [`${value}`, valueLabel]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as { detailLabel?: string } | undefined;
                return row?.detailLabel ?? "";
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke={CHART_LINE}
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#fff", stroke: CHART_LINE, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
