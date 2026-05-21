"use client";

import {
  humanizeFieldKey,
  orderedRowEntries,
  type AuditExcelRow,
} from "@/lib/jobsiteAudits/auditRows";

type RowStatus = "" | "pass" | "fail" | "na";

const STATUS_OPTIONS: { value: RowStatus; label: string }[] = [
  { value: "", label: "—" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
];

export function AuditExcelRowCard({
  rowKey,
  row,
  status,
  onStatus,
}: {
  rowKey: string;
  row: AuditExcelRow;
  status: RowStatus;
  onStatus: (next: RowStatus) => void;
}) {
  const entries = orderedRowEntries(row);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {entries.map(([k, v]) => (
            <div key={`${rowKey}-${k}`} className="text-sm">
              <span className="font-semibold text-slate-200">{humanizeFieldKey(k)}: </span>
              <span className="text-slate-100">{String(v).trim()}</span>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 lg:flex-col lg:items-stretch">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value || "clear"}
              type="button"
              onClick={() => onStatus(value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                status === value
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-600/80 bg-slate-950/70 text-slate-200 hover:border-slate-500 hover:bg-slate-900/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
