import { HEATMAP_LEGEND_STEPS, heatmapCellClassName } from "@/lib/metrics/heatmapDensity";

type HeatmapGridProps = {
  rowLabels: string[];
  colLabels: string[];
  cells: number[][];
  max: number;
  title: string;
  description?: string;
  loading?: boolean;
};

export function HeatmapGrid({
  rowLabels,
  colLabels,
  cells,
  max: rawMax,
  title,
  description,
  loading = false,
}: HeatmapGridProps) {
  const max = rawMax > 0 ? rawMax : 0;
  const rLabels = rowLabels.length ? rowLabels : ["C", "H", "M", "L"];
  const cLabels = colLabels.length ? colLabels : ["H", "M", "L", "—"];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      {description ? <p className="mt-1 text-[10px] text-slate-400">{description}</p> : null}
      <div
        className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4"
        role="grid"
        aria-label={title}
      >
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="inline-block min-w-full sm:min-w-0">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `minmax(2.5rem, 5rem) repeat(${cLabels.length}, minmax(2.5rem, 1fr))` }}
            >
              <div className="min-w-0" aria-hidden />
              {cLabels.map((c) => (
                <div
                  key={c}
                  className="min-w-0 text-center text-[9px] font-bold uppercase leading-tight tracking-wider text-slate-500 sm:text-[10px]"
                >
                  {c}
                </div>
              ))}
              {rLabels.map((rowLabel, ri) => (
                <div key={rowLabel} className="contents">
                  <div className="flex min-w-0 max-w-[5rem] items-center text-[9px] font-bold uppercase leading-tight tracking-wider text-slate-500 sm:max-w-[5.5rem] sm:text-[10px]">
                    {rowLabel}
                  </div>
                  {(cells[ri] ?? Array(cLabels.length).fill(0)).map((cell, ci) => {
                    const t = max > 0 ? cell / max || 0 : 0;
                    return (
                      <div
                        key={`${ri}-${ci}`}
                        role="gridcell"
                        className={[
                          "flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg text-xs font-bold",
                          t > 0 && !loading ? "text-slate-800" : "text-slate-500",
                          heatmapCellClassName(t),
                        ].join(" ")}
                        title={
                          !loading
                            ? `${rowLabel} × ${cLabels[ci] ?? "—"}: ${cell} (vs max ${max || "—"} in view)`
                            : "Loading"
                        }
                      >
                        {loading ? "" : cell > 0 ? cell : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full shrink-0 rounded-lg border border-white/5 bg-white/[0.02] p-3 sm:max-w-[12rem] lg:border lg:border-white/5 lg:bg-transparent lg:p-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Relative density</p>
          <p className="mt-0.5 text-[9px] leading-snug text-slate-500">Warmer = higher share of the maximum count in this window</p>
          <ul className="mt-2 space-y-1.5" aria-label="Heatmap color legend">
            {HEATMAP_LEGEND_STEPS.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-[9px] text-slate-500">
                <span className={["h-3 w-5 shrink-0 rounded-sm", s.sampleClass].join(" ")} aria-hidden />
                <span className="min-w-0 leading-tight">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
