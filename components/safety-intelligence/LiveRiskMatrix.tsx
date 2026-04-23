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
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-[var(--app-border-strong)] bg-white/80 px-4 py-4 shadow-[var(--app-shadow-soft)]"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">{tile.label}</p>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{tile.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top trades</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--app-text-strong)]">
            {(summary?.topTrades ?? []).map((row) => (
              <li key={row.code} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2">
                <span>{row.code.replace(/_/g, " ")}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Top hazards</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--app-text-strong)]">
            {(summary?.topHazards ?? []).map((row) => (
              <li key={row.code} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-3 py-2">
                <span>{row.code.replace(/_/g, " ")}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
