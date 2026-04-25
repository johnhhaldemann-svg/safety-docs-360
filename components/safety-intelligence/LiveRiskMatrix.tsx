"use client";

export function LiveRiskMatrix({
  summary,
}: {
  summary: {
    totals: {
      bucketRuns: number;
      aiReviews: number;
      openConflicts: number;
      generatedDocuments: number;
    };
    topTrades: Array<{ code: string; count: number }>;
    topHazards: Array<{ code: string; count: number }>;
  } | null;
}) {
  const tiles = [
    { label: "Bucket runs", value: summary?.totals.bucketRuns ?? 0 },
    { label: "Intelligence reviews", value: summary?.totals.aiReviews ?? 0 },
    { label: "Open conflicts", value: summary?.totals.openConflicts ?? 0 },
    { label: "Generated docs", value: summary?.totals.generatedDocuments ?? 0 },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-[var(--app-border-strong)] bg-white/80 px-3 py-2.5 shadow-[var(--app-shadow-soft)]"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">{tile.label}</p>
            <p className="mt-1 text-xl font-bold text-[var(--app-text-strong)]">{tile.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--app-border-strong)] bg-white/85 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Top trades</p>
          <ul className="mt-2 space-y-1.5 text-xs text-[var(--app-text-strong)]">
            {(summary?.topTrades ?? []).slice(0, 4).map((row) => (
              <li key={row.code} className="flex items-center justify-between rounded-lg bg-[var(--app-panel)] px-2.5 py-1.5">
                <span>{row.code.replace(/_/g, " ")}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
            {(summary?.topTrades ?? []).length === 0 ? <li className="text-[var(--app-text)]">No trade activity yet.</li> : null}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--app-border-strong)] bg-white/85 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Top hazards</p>
          <ul className="mt-2 space-y-1.5 text-xs text-[var(--app-text-strong)]">
            {(summary?.topHazards ?? []).slice(0, 4).map((row) => (
              <li key={row.code} className="flex items-center justify-between rounded-lg bg-[var(--app-panel)] px-2.5 py-1.5">
                <span>{row.code.replace(/_/g, " ")}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
            {(summary?.topHazards ?? []).length === 0 ? <li className="text-[var(--app-text)]">No hazard activity yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
