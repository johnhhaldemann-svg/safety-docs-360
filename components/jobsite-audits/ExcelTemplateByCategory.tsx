"use client";

import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditExcelRowCard } from "@/components/jobsite-audits/AuditExcelRowCard";
import type { AuditExcelRow } from "@/lib/jobsiteAudits/auditRows";

type RowStatus = "" | "pass" | "fail" | "na";

function rowMatchesQuery(row: AuditExcelRow, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(needle));
}

export function ExcelTemplateByCategory({
  sections,
  sectionTitles,
  tabPrefix,
  query,
  statusMap,
  onRowStatus,
  categoryLabel = "Category",
}: {
  sections: AuditExcelRow[][];
  /** One title per section — from first Excel row text (see deriveExcelSectionLabels). */
  sectionTitles: string[];
  tabPrefix: "env" | "hs";
  query: string;
  statusMap: Record<string, RowStatus>;
  onRowStatus: (key: string, next: RowStatus) => void;
  categoryLabel?: string;
}) {
  const filteredBlocks = useMemo(
    () => sections.map((rows) => rows.filter((row) => rowMatchesQuery(row, query))),
    [sections, query]
  );

  const nonEmptyIndices = useMemo(
    () => filteredBlocks.map((rows, i) => (rows.length > 0 ? i : -1)).filter((i) => i >= 0),
    [filteredBlocks]
  );

  const [blockIdx, setBlockIdx] = useState(0);

  const safeIdx = useMemo(() => {
    if (sections.length === 0) return 0;
    return Math.min(Math.max(0, blockIdx), sections.length - 1);
  }, [blockIdx, sections.length]);

  useEffect(() => {
    if (nonEmptyIndices.length === 0) return;
    if (nonEmptyIndices.includes(safeIdx)) return;
    const target = nonEmptyIndices[0] ?? 0;
    const id = requestAnimationFrame(() => setBlockIdx(target));
    return () => cancelAnimationFrame(id);
  }, [nonEmptyIndices, safeIdx]);

  const currentRows = filteredBlocks[safeIdx] ?? [];
  const sectionRows = sections[safeIdx] ?? [];

  const goPrev = useCallback(() => {
    setBlockIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setBlockIdx((i) => Math.min(sections.length - 1, i + 1));
  }, [sections.length]);

  if (sections.length === 0) {
    return <p className="text-sm text-slate-500">No template sections loaded.</p>;
  }

  const titleAt = (i: number) =>
    sectionTitles[i]?.trim() ||
    (tabPrefix === "hs" ? `Health & safety · Part ${i + 1}` : `Environmental · Part ${i + 1}`);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(200px,260px)_1fr]">
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-3 lg:max-h-[min(70vh,720px)] lg:overflow-y-auto">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          <List className="h-3.5 w-3.5" />
          {categoryLabel}
        </p>
        <div className="space-y-1">
          {sections.map((rows, sIdx) => {
            const filtered = filteredBlocks[sIdx] ?? [];
            const answered = filtered.filter((row) => {
              const oi = rows.indexOf(row);
              const rowKey = `${tabPrefix}-${sIdx}-${oi}`;
              return (statusMap[rowKey] ?? "") !== "";
            }).length;
            const active = sIdx === safeIdx;
            return (
              <button
                key={`cat-${tabPrefix}-${sIdx}`}
                type="button"
                onClick={() => setBlockIdx(sIdx)}
                className={`flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "border-emerald-500 bg-emerald-950/35 font-semibold text-emerald-950"
                    : "border-transparent bg-slate-900/90 text-slate-300 hover:border-slate-700/80 hover:bg-slate-900/90"
                }`}
              >
                <span className="leading-snug">{titleAt(sIdx)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {tabPrefix === "hs" ? "H&S" : "Env."} · Block {sIdx + 1}/{sections.length}
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  {filtered.length} line{filtered.length === 1 ? "" : "s"}
                  {filtered.length > 0 ? ` · ${answered}/${filtered.length} scored` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">{titleAt(safeIdx)}</h3>
            <p className="text-xs font-semibold text-slate-500">
              {tabPrefix === "hs" ? "Health & safety" : "Environmental"} · Category {safeIdx + 1} of{" "}
              {sections.length}
            </p>
            <p className="text-xs text-slate-500">
              {currentRows.length} checklist line{currentRows.length === 1 ? "" : "s"} in this category
              {query.trim() ? " (after filter)" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={safeIdx <= 0}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={safeIdx >= sections.length - 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {currentRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/50 py-10 text-center text-sm text-slate-500">
              No lines in this block match your filter. Clear the filter or choose another category.
            </p>
          ) : (
            currentRows.map((row) => {
              const originalIdx = sectionRows.indexOf(row);
              const rowKey = `${tabPrefix}-${safeIdx}-${originalIdx}`;
              return (
                <AuditExcelRowCard
                  key={rowKey}
                  rowKey={rowKey}
                  row={row}
                  status={statusMap[rowKey] ?? ""}
                  onStatus={(next) => onRowStatus(rowKey, next)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
