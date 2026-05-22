"use client";

import { Check } from "lucide-react";
import type { GusChecklistItem } from "@/lib/gus/plans/basePlanningTypes";

type GusPlanningChecklistProps = {
  title: string;
  items: GusChecklistItem[];
  selected: string[];
  onToggle: (label: string) => void;
};

export function GusPlanningChecklist({ title, items, selected, onToggle }: GusPlanningChecklistProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const active = selected.includes(item.label);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.label)}
              className={`flex min-h-12 items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                active
                  ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)] text-[var(--app-text-strong)]"
                  : "border-[var(--app-border)] bg-white text-[var(--app-text)] hover:bg-[var(--app-panel-soft)]"
              }`}
              aria-pressed={active}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${
                  active
                    ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary)] text-white"
                    : "border-[var(--app-border)] bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="block font-semibold">{item.label}</span>
                {item.helperText ? (
                  <span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">{item.helperText}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

