import { METRIC_CHART_LIST_WRAP } from "./metricChartSurfaces";

type Row = { key: string; label: string; count: number };

export function FieldMetricRankedList({ rows, emptyLabel }: { rows: Row[]; emptyLabel: string }) {
  const maxValue = Math.max(1, ...rows.map((row) => row.count));

  if (rows.length < 1) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700/80 px-4 py-6 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3" role="list" aria-label="Ranked list with bars">
      {rows.map((row) => (
        <div
          key={row.key}
          className={`${METRIC_CHART_LIST_WRAP} px-4 py-4`}
          role="listitem"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-100">{row.label}</div>
            <div className="text-sm font-black text-white">{row.count}</div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden>
            <div
              className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
              style={{ width: `${(row.count / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
