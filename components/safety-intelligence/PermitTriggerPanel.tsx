"use client";

import type { IntakePayload } from "@/components/safety-intelligence/types";

export function PermitTriggerPanel({ intake }: { intake: IntakePayload | null }) {
  const triggers = intake?.rules.permitTriggers ?? [];
  return (
    <div className="rounded-xl border border-[var(--app-border-strong)] bg-white/85 p-3 shadow-[var(--app-shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-text)]">Permit triggers</p>
        <span className="rounded-full bg-[var(--app-panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
          {triggers.length}
        </span>
      </div>
      {triggers.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {triggers.map((trigger) => (
            <li
              key={trigger}
              className="rounded-full bg-[var(--app-accent-surface-12)] px-2 py-1 text-xs font-semibold text-[var(--app-accent-primary)]"
            >
              {trigger.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-[var(--app-text)]">Run a task through the rules engine to see permit triggers.</p>
      )}
    </div>
  );
}
