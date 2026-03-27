"use client";

import dynamic from "next/dynamic";
import type { SafetyObservationRow } from "@/lib/safety-observations/types";

const ObservationChartsInner = dynamic(() => import("./ObservationChartsInner"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center text-sm text-slate-500">
      Loading charts…
    </div>
  ),
});

export function ObservationAnalytics({ rows }: { rows: SafetyObservationRow[] }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500">Summaries from the observations currently loaded below the filters.</p>
      </div>
      <ObservationChartsInner rows={rows} />
    </section>
  );
}
