"use client";

import type { RiskCategory, RiskSeverityBand } from "@/src/lib/dashboard/types";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { ShieldAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatusBadge } from "@/src/components/dashboard/StatusBadge";

export type RiskHeatListProps = {
  risks: RiskCategory[];
  title?: string;
  description?: string;
  className?: string;
};

function severityBorder(sev: RiskSeverityBand): string {
  if (sev === "critical" || sev === "high") return "border-[rgba(217,83,79,0.35)]";
  if (sev === "medium") return "border-[rgba(217,164,65,0.4)]";
  return "border-[var(--app-border)]";
}

function severityDot(sev: RiskSeverityBand): string {
  if (sev === "critical" || sev === "high") return "bg-[var(--semantic-danger)]";
  if (sev === "medium") return "bg-[var(--semantic-warning)]";
  return "bg-[var(--semantic-success)]";
}

function trendLabel(t: RiskCategory["trend"]): string {
  if (t === "up") return "Rising";
  if (t === "down") return "Improving";
  return "Flat";
}

function trendTone(t: RiskCategory["trend"]): "error" | "success" | "neutral" {
  if (t === "up") return "error";
  if (t === "down") return "success";
  return "neutral";
}

function severityTraffic(sev: RiskSeverityBand): "green" | "yellow" | "red" {
  if (sev === "critical" || sev === "high") return "red";
  if (sev === "medium") return "yellow";
  return "green";
}

function barFill(sev: RiskSeverityBand): string {
  if (sev === "critical") return "#b91c1c";
  if (sev === "high") return "var(--semantic-danger)";
  if (sev === "medium") return "var(--semantic-warning)";
  return "var(--semantic-success)";
}

function truncateLabel(name: string, max = 36): string {
  const t = name.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const CHART_GRID = "rgba(111, 138, 177, 0.22)";
const CHART_AXIS = "#4f647b";
const CHART_TOOLTIP_BG = "rgba(255, 255, 255, 0.96)";
const CHART_TOOLTIP_BORDER = "rgba(111, 138, 177, 0.35)";

/**
 * Top risks: horizontal Recharts bar ranking by count, plus detail cards from the same payload.
 */
export function RiskHeatList({
  risks,
  title = "Top risks",
  description = "Grouped hazards ranked by exposure and severity in the active window.",
  className = "",
}: RiskHeatListProps) {
  if (risks.length === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState
          align="left"
          icon={ShieldAlert}
          title="No ranked risks yet"
          description="When observations or assessments populate categories, they will surface here with severity and trend."
        />
      </div>
    );
  }

  const chartData = [...risks]
    .sort((a, b) => b.count - a.count)
    .map((r, i) => ({
      id: `${r.name}-${i}-${r.count}`,
      shortLabel: `${i + 1}. ${truncateLabel(r.name)}`,
      fullName: r.name,
      count: r.count,
      severity: r.severity,
    }));

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
        {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
      </div>

      <div
        className="w-full rounded-2xl border border-[var(--app-border)] bg-white/90 p-2 shadow-[0_8px_18px_rgba(76,108,161,0.05)] sm:p-3"
        style={{ height: Math.min(480, Math.max(220, risks.length * 48)) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            barCategoryGap={10}
          >
            <CartesianGrid stroke={CHART_GRID} horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fill: CHART_AXIS, fontSize: 11 }} allowDecimals={false} axisLine={{ stroke: CHART_GRID }} />
            <YAxis
              type="category"
              dataKey="shortLabel"
              width={112}
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
            />
            <Tooltip
              cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
              contentStyle={{
                background: CHART_TOOLTIP_BG,
                border: `1px solid ${CHART_TOOLTIP_BORDER}`,
                borderRadius: "12px",
                fontSize: "12px",
                maxWidth: 320,
              }}
              formatter={(value) => [`${value}`, "Events"]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                return row?.fullName ?? "";
              }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {chartData.map((row) => (
                <Cell key={row.id} fill={barFill(row.severity)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-2">
        {risks.map((r, idx) => (
          <li
            key={`${r.name}-${idx}`}
            className={`relative overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,_rgba(255,255,255,0.95)_0%,_var(--app-panel-soft)_100%)] px-4 py-3 shadow-[0_6px_14px_rgba(76,108,161,0.04)] ${severityBorder(r.severity)}`}
          >
            <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${severityDot(r.severity)}`} aria-hidden="true" />
            <div className="flex flex-col gap-2 pl-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[var(--app-muted)]">#{idx + 1}</span>
                  <p className="text-sm font-semibold text-[var(--app-text-strong)]">{r.name}</p>
                  <StatusBadge label={r.severity} trafficLight={severityTraffic(r.severity)} />
                  <StatusBadge label={trendLabel(r.trend)} tone={trendTone(r.trend)} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--app-text)]">{r.recommendation}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                <span className="font-app-display text-xl font-bold text-[var(--app-text-strong)]">{r.count}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)]">Events</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
