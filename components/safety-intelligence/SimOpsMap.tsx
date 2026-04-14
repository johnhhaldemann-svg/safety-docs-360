"use client";

export function SimOpsMap({
  conflicts,
}: {
  conflicts: Array<{
    id: string;
    conflict_code: string;
    severity: string;
    rationale: string;
  }>;
}) {
  return (
    <div className="grid gap-3">
      {conflicts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-white/75 px-4 py-6 text-sm text-[var(--app-text)]">
          No live simultaneous-operation conflicts are open right now.
        </div>
      ) : null}
      {conflicts.map((conflict) => (
        <div
          key={conflict.id}
          className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 px-4 py-4 shadow-[var(--app-shadow-soft)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">
                {conflict.conflict_code.replace(/_/g, " ")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--app-text)]">{conflict.rationale}</p>
            </div>
            <span className="rounded-full bg-[rgba(217,83,79,0.12)] px-3 py-1 text-xs font-semibold uppercase text-[var(--semantic-danger)]">
              {conflict.severity}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

