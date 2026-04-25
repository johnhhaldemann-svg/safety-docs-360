type AppLoadingProps = {
  label?: string;
  className?: string;
};

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/**
 * Branded full-segment loading state; uses app CSS tokens (not slate/teal).
 */
export function AppLoading({ label = "Loading…", className }: AppLoadingProps) {
  return (
    <div
      className={cx(
        "flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-16",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--app-border-strong)] border-t-[var(--app-accent-primary)]"
        aria-hidden
      />
      <p className="text-sm text-[var(--app-muted)]">{label}</p>
    </div>
  );
}

type AppWorkspacePageSkeletonProps = {
  label?: string;
};

/**
 * Hero + panel placeholders for data-heavy library / training views.
 */
export function AppWorkspacePageSkeleton({ label = "Loading workspace…" }: AppWorkspacePageSkeletonProps) {
  return (
    <div
      className="app-shell-light flex min-h-[50vh] flex-col gap-6 px-4 py-8 sm:px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-4 w-40 animate-pulse rounded-full bg-[var(--app-border-subtle)]" />
      <div className="app-radius-card min-h-[7rem] border border-[var(--app-border)] bg-[var(--app-surface-solid)] p-6 shadow-[var(--app-shadow-soft)]">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--app-border-subtle)]" />
        <div className="mt-4 h-8 max-w-md animate-pulse rounded-lg bg-[var(--app-border-subtle)]" />
        <div className="mt-2 h-4 w-full max-w-lg animate-pulse rounded bg-[var(--app-panel)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="app-radius-card h-28 animate-pulse border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 shadow-[var(--app-shadow-soft)]"
          />
        ))}
      </div>
      <p className="text-center text-sm text-[var(--app-muted)]">{label}</p>
    </div>
  );
}
