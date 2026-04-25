"use client";

import type { IntakePayload } from "@/components/safety-intelligence/types";

export function PermitTriggerPanel({ intake }: { intake: IntakePayload | null }) {
  const triggers = intake?.rules.permitTriggers ?? [];
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4 shadow-[var(--app-shadow-soft)]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Permit trigger panel</p>
      {triggers.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {triggers.map((trigger) => (
            <li
              key={trigger}
              className="rounded-full bg-[var(--app-accent-surface-12)] px-3 py-1.5 text-sm font-semibold text-[var(--app-accent-primary)]"
            >
              {trigger.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--app-text)]">Run a task through the rules engine to see permit triggers.</p>
      )}
    </div>
  );
}

