"use client";

import type { TableDensity } from "@/lib/tableDensity";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

type TableDensityToggleProps = {
  value: TableDensity;
  onChange: (value: TableDensity) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Compact vs comfortable table row height — persisted via `useTableDensity` + localStorage.
 */
export function TableDensityToggle({ value, onChange, disabled, className }: TableDensityToggleProps) {
  return (
    <div
      className={cx("inline-flex items-center gap-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-1", className)}
      role="group"
      aria-label="Table density"
    >
      {(["comfortable", "compact"] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cx(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "bg-white text-[var(--app-text-strong)] shadow-sm ring-1 ring-[var(--app-border)]"
                : "text-[var(--app-muted)] hover:text-[var(--app-text)]"
            )}
          >
            {option === "comfortable" ? "Comfortable" : "Compact"}
          </button>
        );
      })}
    </div>
  );
}
