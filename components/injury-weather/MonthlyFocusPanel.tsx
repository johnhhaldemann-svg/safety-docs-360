import type {
  InjuryWeatherDashboardData,
  InjuryWeatherMonthlyFocusSource,
} from "@/lib/injuryWeather/types";

function sourceLabel(s: InjuryWeatherMonthlyFocusSource): string {
  if (s === "workspace") return "Workspace";
  if (s === "benchmark") return "Benchmark";
  return "Sector reference";
}

function sourceBadgeClass(s: InjuryWeatherMonthlyFocusSource): string {
  if (s === "workspace") return "border-cyan-500/40 bg-cyan-950/40 text-cyan-200/95";
  if (s === "benchmark") return "border-amber-500/40 bg-amber-950/35 text-amber-100/95";
  return "border-violet-500/40 bg-violet-950/35 text-violet-100/95";
}

export function MonthlyFocusPanel({ data }: { data: InjuryWeatherDashboardData }) {
  const items = data.monthlyFocus ?? [];

  return (
    <section className="rounded-2xl border border-sky-500/35 bg-gradient-to-br from-sky-950/40 via-slate-950/80 to-slate-950 p-5 shadow-[0_0_36px_rgba(14,165,233,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300/90">This month — where to focus</p>
      <h3 className="mt-1 text-lg font-bold text-white">Deterministic priorities</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Ranked from your safety-system signals (SOR, corrective actions, incidents), industry benchmark context, and static sector
        hazard themes. The AI Safety Advisor is prompted to align with these rows—not replace them with invented site facts.
      </p>
      <ol className="mt-4 space-y-3">
        {items.map((row) => (
          <li
            key={`${row.rank}-${row.title}`}
            className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-xs font-black text-sky-200">
                {row.rank}
              </span>
              <p className="min-w-0 flex-1 text-sm font-semibold text-white">{row.title}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{row.rationale}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.sources.map((s) => (
                <span
                  key={s}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sourceBadgeClass(s)}`}
                >
                  {sourceLabel(s)}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InjuryWeatherDiagnosticsPanel({ data }: { data: InjuryWeatherDashboardData }) {
  const d = data.engineDiagnostics;
  const p = data.signalProvenance;
  const total = p.sorRecords + p.correctiveActions + p.incidents;

  return (
    <details className="rounded-xl border border-slate-700/80 bg-slate-950/60 text-sm text-slate-300">
      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        Data path diagnostics
      </summary>
      <div className="space-y-2 border-t border-slate-800 px-4 py-3 text-xs leading-relaxed">
        <p>
          <span className="font-semibold text-slate-200">Live database:</span>{" "}
          {d.seedOnlyMode ? (
            <span className="text-amber-300">Off — seed/offline mode (check Supabase service role env).</span>
          ) : (
            <span className="text-emerald-300">On — service-role client loaded signals.</span>
          )}
        </p>
        {!d.seedOnlyMode ? (
          <p>
            <span className="font-semibold text-slate-200">Live rows fetched (all dates, pre–month card filter):</span>{" "}
            {d.liveSignalRowCount != null ? d.liveSignalRowCount : "—"}
          </p>
        ) : null}
        <p>
          <span className="font-semibold text-slate-200">Rows in current card window:</span> {total} total · {p.sorRecords} SOR ·{" "}
          {p.correctiveActions} corrective actions · {p.incidents} incidents · provenance{" "}
          <span className="font-mono text-slate-400">{p.mode}</span>
        </p>
        <p className="text-slate-400">
          <span className="font-semibold text-slate-300">Record window:</span> {p.recordWindowLabel}
        </p>
        <p className="text-slate-500">
          Sparse signals: the AI Safety Advisor can run a{" "}
          <span className="text-slate-400">web search</span> pass for cited public guidance. Set{" "}
          <code className="rounded bg-slate-800 px-1">INJURY_WEATHER_SPARSE_WEB_RESEARCH=0</code> to disable (saves an extra API
          call).
        </p>
      </div>
    </details>
  );
}
