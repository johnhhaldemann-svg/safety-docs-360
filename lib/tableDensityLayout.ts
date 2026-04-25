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

/** Jobsite live view: wide observation matrix (many columns). */
export function liveObservationMatrixLayout(isCompact: boolean) {
  return {
    table: isCompact
      ? "min-w-[1280px] text-left text-[10px] leading-snug"
      : "min-w-[1500px] text-left text-xs",
    cell: isCompact ? "px-1.5 py-1 align-top" : "px-2 py-2 align-top",
  };
}

/** Upload center: bordered document rows (md+ table + mobile cards). */
export function uploadCenterTableLayout(isCompact: boolean) {
  const pad = isCompact ? "px-3 py-2.5" : "px-4 py-4";
  const bodyText = isCompact ? "text-xs" : "text-sm";
  return {
    table: isCompact
      ? "min-w-full border-separate border-spacing-y-2"
      : "min-w-full border-separate border-spacing-y-3",
    th: isCompact
      ? "px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"
      : "px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500",
    tdFirst: `rounded-l-2xl border-y border-l border-slate-700/80 bg-slate-950/50 ${pad} font-semibold text-slate-100 ${bodyText}`,
    tdMid: `border-y border-slate-700/80 bg-slate-950/50 ${pad} text-slate-300 ${bodyText}`,
    tdFile: `border-y border-slate-700/80 bg-slate-950/50 ${pad} text-slate-500 ${bodyText}`,
    tdLast: `rounded-r-2xl border-y border-r border-slate-700/80 bg-slate-950/50 ${pad} text-right`,
    mobileCard: isCompact ? "p-3" : "p-4",
    mobileTitle: isCompact ? "text-sm font-semibold text-slate-100" : "text-base font-semibold text-slate-100",
  };
}

/** Field ID exchange: Active Matrix + Analytics Matrix (category × status / counts). */
export function fieldIdMatrixTableLayout(isCompact: boolean) {
  const pad = isCompact ? "px-2 py-1.5" : "px-3 py-2";
  const thPad = isCompact ? "px-2 py-1" : "px-3 py-2";
  const thText = isCompact
    ? "text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"
    : "text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500";
  const body = isCompact ? "text-[11px]" : "text-xs";
  return {
    table: isCompact
      ? "min-w-full border-separate border-spacing-y-1.5"
      : "min-w-full border-separate border-spacing-y-2",
    thFirst: `text-left ${thPad} ${thText}`,
    thNum: `text-right ${thPad} ${thText}`,
    tdCategory: `rounded-l-xl border-y border-l border-slate-700/80 bg-slate-950/50 ${pad} ${body} font-semibold text-slate-100`,
    tdNumber: `border-y border-slate-700/80 bg-slate-950/50 ${pad} text-right ${body} text-slate-300`,
    tdNumberOrange: `border-y border-slate-700/80 bg-slate-950/50 ${pad} text-right ${body} text-orange-200`,
    tdTotal: `rounded-r-xl border-y border-r border-slate-700/80 bg-slate-950/50 ${pad} text-right ${body} font-semibold text-slate-100`,
    tdFooterLabel: `rounded-l-xl border-y border-l border-slate-700/80 bg-slate-900 ${pad} ${body} font-black uppercase tracking-[0.14em] text-white`,
    tdFooter: `border-y border-slate-700/80 bg-slate-900 ${pad} text-right ${body} font-semibold text-white`,
    tdFooterOrange: `border-y border-slate-700/80 bg-slate-900 ${pad} text-right ${body} font-semibold text-orange-200`,
    tdFooterLast: `rounded-r-xl border-y border-r border-slate-700/80 bg-slate-900 ${pad} text-right ${body} font-black text-white`,
  };
}

/** Small admin / history tables (e.g. jobsite audit submissions preview). */
export function submissionHistoryTableLayout(isCompact: boolean) {
  return {
    table: isCompact ? "w-full text-left text-[11px]" : "w-full text-left text-xs",
    th: isCompact ? "px-2 py-1" : "px-3 py-2",
    td: isCompact ? "px-2 py-1" : "px-3 py-2",
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
