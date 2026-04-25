import { METRIC_CHART_INNER, METRIC_CHART_MUTED, METRIC_CHART_PANEL } from "./metricChartSurfaces";

type Row = { key: string; label: string; count: number; barClassName: string };

export function FieldMetricBarChart({
  rows,
  maxValue,
}: {
  rows: Row[];
  maxValue?: number;
}) {
  const resolvedMaxValue = maxValue ?? Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className={METRIC_CHART_PANEL} role="img" aria-label="Vertical bar chart of counts by category">
      <div className="flex items-end gap-3 overflow-x-auto pb-1">
        {rows.map((row) => (
          <div key={row.key} className="flex min-w-[88px] flex-1 flex-col items-center gap-3">
            <div className="text-sm font-black text-white" aria-hidden>
              {row.count}
            </div>
            <div className={`${METRIC_CHART_INNER} w-full`}>
              <div
                className={`w-full rounded-xl transition-[height] duration-300 ${row.barClassName}`}
                style={{
                  height: `${Math.max((row.count / resolvedMaxValue) * 100, row.count > 0 ? 12 : 2)}%`,
                }}
                title={`${row.label}: ${row.count}`}
              />
            </div>
            <div className={METRIC_CHART_MUTED}>{row.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
