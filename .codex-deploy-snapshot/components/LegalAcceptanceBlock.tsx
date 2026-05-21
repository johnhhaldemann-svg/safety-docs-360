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
        "rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(241,247,255,0.94)_100%)] shadow-[0_12px_24px_rgba(76,108,161,0.08)]",
        compact ? "p-4" : "p-5",
      ].join(" ")}
    >
      <label className="flex items-start gap-3 text-sm font-medium text-[var(--app-text)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border border-[var(--app-border)] bg-white text-[var(--app-accent-primary)]"
        />
        <span>{CLICKWRAP_LABEL}</span>
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/terms"
          className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]"
        >
          View Terms
        </Link>
        <Link
          href="/privacy"
          className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]"
        >
          Privacy
        </Link>
        <Link
          href="/liability-waiver"
          className="rounded-xl border border-[var(--app-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]"
        >
          View Liability Waiver
        </Link>
      </div>
    </div>
  );
}
