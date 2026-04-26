"use client";

/**
 * Mirrors dashboard PageHero + xl:grid-cols-2 block layout to avoid layout shift when data resolves.
 */
export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[rgba(121,151,196,0.42)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.99)_0%,_rgba(239,246,255,0.98)_58%,_rgba(232,247,239,0.86)_100%)] p-6 shadow-[var(--app-shadow)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,_var(--app-accent-primary)_0%,_var(--semantic-success)_54%,_var(--semantic-warning)_100%)]" />
        <div className="h-3 w-40 animate-pulse rounded-full bg-[var(--app-accent-surface-12)]" />
        <div className="mt-3 h-9 max-w-md animate-pulse rounded-lg bg-[var(--app-border-subtle)] sm:h-10" />
        <div className="mt-3 h-4 max-w-xl animate-pulse rounded bg-[var(--app-border-subtle)]" />
        <div className="mt-3 h-4 max-w-lg animate-pulse rounded bg-[var(--app-border-subtle)]" />
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-[var(--app-accent-surface-10)]" />
          <div className="h-10 w-32 animate-pulse rounded-xl bg-[var(--app-border-subtle)]" />
        </div>
      </section>

      <div className="flex justify-end">
        <div className="h-9 w-44 animate-pulse rounded-xl bg-[var(--app-border-subtle)]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(241,247,255,0.94)_100%)] p-6 shadow-[var(--app-shadow-soft)]"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,_transparent,_var(--app-accent-surface-35),_transparent)]" />
            <div className="h-2.5 w-24 animate-pulse rounded-full bg-[var(--app-accent-surface-10)]" />
            <div className="mt-3 h-6 w-48 animate-pulse rounded bg-[var(--app-border-subtle)]" />
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-[var(--app-panel)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
