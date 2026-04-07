"use client";

import Link from "next/link";
import { CLICKWRAP_LABEL } from "@/lib/legal";

export function LegalAcceptanceBlock({
  checked,
  onChange,
  compact = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-slate-700/80 bg-slate-950/50",
        compact ? "p-4" : "p-5",
      ].join(" ")}
    >
      <label className="flex items-start gap-3 text-sm font-medium text-slate-300">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>{CLICKWRAP_LABEL}</span>
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/terms"
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
        >
          View Terms
        </Link>
        <Link
          href="/privacy"
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
        >
          Privacy
        </Link>
        <Link
          href="/liability-waiver"
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
        >
          View Liability Waiver
        </Link>
      </div>
    </div>
  );
}
