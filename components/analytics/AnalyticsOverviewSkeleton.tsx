"use client";

/** Shown while analytics summary is loading; matches overview KPI grid rhythm. */
export function AnalyticsOverviewSkeleton() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-2"
      aria-hidden="true"
    >
      <div className="analytics-dark-panel p-5">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--app-accent-surface-12)]" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4"
            >
              <div className="h-2.5 w-20 animate-pulse rounded bg-[var(--app-border-subtle)]" />
              <div className="mt-3 h-9 w-16 animate-pulse rounded-lg bg-[var(--app-accent-surface-10)]" />
            </div>
          ))}
        </div>
        <div className="analytics-dark-panel-soft mt-5 h-28 animate-pulse rounded-xl bg-[var(--app-panel)]" />
      </div>
      <div className="analytics-dark-panel p-5">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--app-accent-surface-12)]" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
