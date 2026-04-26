import type { EngineHealthItem } from "@/src/lib/dashboard/types";
import { EmptyState } from "@/components/WorkspacePrimitives";
import { Cpu } from "lucide-react";
import { StatusBadge } from "@/src/components/dashboard/StatusBadge";
import Link from "next/link";

export type EngineHealthPanelProps = {
  items: EngineHealthItem[];
  /** Default covers Smart Safety engine; pass a platform title for Superadmin diagnostics. */
  title?: string;
  description?: string;
  className?: string;
};

function formatChecked(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(s: EngineHealthItem["status"]): string {
  if (s === "green") return "Healthy";
  if (s === "yellow") return "Attention";
  return "Critical";
}

/**
 * Traffic-light checklist for integrations (Supabase, storage, domain tables, etc.).
 */
export function EngineHealthPanel({
  items,
  title = "Smart Safety Engine Health",
  description = "Live checks from the overview data service. Yellow means prevention signals may be incomplete; red needs attention before relying on this view for decisions.",
  className = "",
}: EngineHealthPanelProps) {
  if (items.length === 0) {
    return (
      <div className={className}>
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
          {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
        </div>
        <EmptyState
          align="left"
          icon={Cpu}
          title="No engine health rows returned"
          description="The service did not emit health checks—try refreshing after sign-in, or verify the overview API so prevention data paths are trustworthy."
        />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div>
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
        {description ? <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p> : null}
      </div>
      <ul className="grid gap-2 sm:grid-cols-1 lg:grid-cols-2">
        {items.map((item, idx) => (
          <li
            key={`${item.moduleName}-${idx}`}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.95)_0%,_var(--app-panel-soft)_100%)] px-4 py-3 shadow-[0_6px_14px_rgba(76,108,161,0.04)] sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.moduleName}</p>
                <StatusBadge label={statusLabel(item.status)} trafficLight={item.status} />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--app-text)]">{item.message}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                Checked {formatChecked(item.lastChecked)}
              </p>
            </div>
            {item.route ? (
              <Link
                href={item.route}
                className="shrink-0 self-start rounded-lg border border-[var(--app-border-strong)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--app-accent-primary)] transition hover:border-[var(--app-accent-border-28)]"
              >
                Open
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
