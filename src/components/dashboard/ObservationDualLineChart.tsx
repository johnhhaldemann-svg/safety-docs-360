"use client";

import type { TrendPoint } from "@/src/lib/dashboard/types";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ObservationDualLineChartProps = {
  points: TrendPoint[];
  title: string;
  description?: string;
  className?: string;
};

function formatTick(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Row = { date: string; tick: string; positive: number; negative: number };

function mergeObservationSeries(points: TrendPoint[]): Row[] {
  const map = new Map<string, Row>();
  for (const p of points) {
    const date = p.date;
    const row =
      map.get(date) ??
      ({
        date,
        tick: formatTick(date),
        positive: 0,
        negative: 0,
      } as Row);
    const lab = (p.label ?? "").toLowerCase();
    const v = Number.isFinite(p.value) ? p.value : 0;
    if (lab.includes("positive")) row.positive += v;
    else if (lab.includes("negative")) row.negative += v;
    else {
      row.negative += v;
    }
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const POS = "#2e9e5b";
const NEG = "#d9534f";
const CHART_GRID = "rgba(111, 138, 177, 0.22)";
const CHART_AXIS = "#4f647b";
const CHART_TOOLTIP_BG = "rgba(255, 255, 255, 0.96)";
const CHART_TOOLTIP_BORDER = "rgba(111, 138, 177, 0.35)";

/**
 * Positive vs negative observation counts by bucket (from {@link TrendPoint} labels).
 */
export function ObservationDualLineChart({ points, title, description, className = "" }: ObservationDualLineChartProps) {
  const data = mergeObservationSeries(points);
  const hasPositive = data.some((d) => d.positive > 0);
  const hasNegative = data.some((d) => d.negative > 0);

  if (data.length === 0 || (!hasPositive && !hasNegative)) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState
          align="left"
          icon={LineChartIcon}
          title="No observation mix for this range"
          description="Positive and negative observation buckets are empty. Log field observations with clear types, or widen the date range so emerging risk is visible before work continues."
        />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
        {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
      </div>
      <div className="h-56 w-full min-h-[220px] rounded-2xl border border-[var(--app-border)] bg-white/90 p-2 shadow-[0_8px_18px_rgba(76,108,161,0.05)] sm:h-64 sm:p-3">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="tick" tick={{ fill: CHART_AXIS, fontSize: 11 }} tickLine={{ stroke: CHART_GRID }} axisLine={{ stroke: CHART_GRID }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: CHART_GRID }} allowDecimals={false} width={36} />
            <Tooltip
              contentStyle={{
                background: CHART_TOOLTIP_BG,
                border: `1px solid ${CHART_TOOLTIP_BORDER}`,
                borderRadius: "12px",
                fontSize: "12px",
              }}
              formatter={(value, name) => [`${value as number | string}`, name === "positive" ? "Positive" : "Negative / other"]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as Row | undefined;
                return row ? formatTick(row.date) : "";
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {hasPositive ? (
              <Line type="monotone" dataKey="positive" name="Positive" stroke={POS} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 4 }} />
            ) : null}
            {hasNegative ? (
              <Line type="monotone" dataKey="negative" name="Negative / other" stroke={NEG} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 4 }} />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
