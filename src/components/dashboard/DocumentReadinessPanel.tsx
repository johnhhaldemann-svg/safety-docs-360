import type { DocumentReadiness } from "@/src/lib/dashboard/types";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { FileStack } from "lucide-react";

export type DocumentReadinessPanelProps = {
  readiness: DocumentReadiness;
  title?: string;
  description?: string;
  className?: string;
};

type Row = { key: keyof DocumentReadiness; label: string; tone: string };

const ROWS: Row[] = [
  { key: "draft", label: "Draft", tone: "bg-[var(--semantic-neutral)]" },
  { key: "submitted", label: "Submitted", tone: "bg-[var(--app-accent-primary)]" },
  { key: "underReview", label: "Under review", tone: "bg-[var(--semantic-warning)]" },
  { key: "approved", label: "Approved", tone: "bg-[var(--semantic-success)]" },
  { key: "rejected", label: "Rejected", tone: "bg-[var(--semantic-danger)]" },
  { key: "missingRequired", label: "Missing required", tone: "bg-[var(--semantic-danger)]" },
  { key: "expiringSoon", label: "Expiring soon", tone: "bg-[var(--semantic-warning)]" },
];

/**
 * Document lifecycle distribution with a stacked proportion bar.
 */
export function DocumentReadinessPanel({
  readiness,
  title = "Document readiness",
  description = "Draft through approval, plus missing required items and upcoming expirations—evidence you need for audits and pre-job verification.",
  className = "",
}: DocumentReadinessPanelProps) {
  const total = ROWS.reduce((s, r) => s + Math.max(0, readiness[r.key]), 0);

  if (total === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState
          align="left"
          icon={FileStack}
          title="No document lifecycle counts"
          description="When documents move through workflow states, counts appear here. If this stays empty, connect the documents source so prevention reviews are not flying blind."
        />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
        {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-panel)]">
        {ROWS.map((r) => {
          const v = Math.max(0, readiness[r.key]);
          const pct = (v / total) * 100;
          if (pct <= 0) return null;
          return <div key={r.key} className={`${r.tone} min-w-0`} style={{ width: `${pct}%` }} title={`${r.label}: ${v}`} />;
        })}
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ROWS.map((r) => {
          const v = readiness[r.key];
          return (
            <div
              key={r.key}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--app-border)] bg-white/88 px-3 py-2 text-sm"
            >
              <dt className="flex items-center gap-2 font-medium text-[var(--app-text-strong)]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.tone}`} aria-hidden="true" />
                {r.label}
              </dt>
              <dd className="font-app-display font-bold text-[var(--app-text-strong)]">{v}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
