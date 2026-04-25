/**
 * Shared padding / text scale for data tables and dense list cards when
 * `useTableDensity().isCompact` is true. Keeps company-users, billing, etc.
 * aligned with the training matrix toggle (same localStorage key).
 */
export function simpleDataTableLayout(isCompact: boolean) {
  return {
    table: isCompact
      ? "min-w-full divide-y divide-slate-200 text-xs"
      : "min-w-full divide-y divide-slate-200 text-sm",
    th: isCompact
      ? "px-2 py-1.5 text-left font-semibold text-slate-300"
      : "px-3 py-2 text-left font-semibold text-slate-300",
    td: isCompact ? "px-2 py-2" : "px-3 py-3",
  };
}

/** Billing / wide invoice tables: slightly more horizontal room when compact. */
export function wideInvoiceTableLayout(isCompact: boolean) {
  return {
    table: isCompact
      ? "w-full min-w-[900px] text-left text-xs"
      : "w-full min-w-[980px] text-left text-sm",
    th: isCompact ? "py-1.5 pr-2" : "py-2 pr-3",
    td: isCompact ? "py-2 pr-2" : "py-3 pr-3",
  };
}

/** Card-style operations lists (permits, incidents) — padding and vertical rhythm. */
export function listSectionDensity(isCompact: boolean) {
  return {
    stackGap: isCompact ? "space-y-2" : "space-y-3",
    card: isCompact
      ? "rounded-2xl border border-slate-700/80 bg-slate-950/50 p-3"
      : "rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4",
    cardTitle: isCompact ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-slate-100",
    cardMeta: isCompact ? "text-[11px] text-slate-500" : "text-xs text-slate-500",
    statGrid: isCompact ? "mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" : "mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
    statCell: isCompact
      ? "rounded-xl border border-slate-700/80 bg-slate-900/70 p-2.5"
      : "rounded-xl border border-slate-700/80 bg-slate-900/70 p-3",
    statLabel: isCompact
      ? "text-[10px] uppercase tracking-[0.2em] text-slate-500"
      : "text-[11px] uppercase tracking-[0.22em] text-slate-500",
    statValue: isCompact ? "mt-0.5 text-sm font-semibold text-slate-100" : "mt-1 text-sm font-semibold text-slate-100",
  };
}
