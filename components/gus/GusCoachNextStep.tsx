"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import type { GusCoachDirective } from "@/lib/gus/gusTypes";

type GusCoachNextStepProps = {
  directive: GusCoachDirective;
  unresolvedCount: number;
  onFollowUp: (prompt: string) => void;
  onPlan: () => void;
};

function priorityTone(priority: GusCoachDirective["priority"]) {
  if (priority === "critical") return "border-red-200 bg-red-50 text-red-900";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-950";
  if (priority === "medium") return "border-blue-200 bg-blue-50 text-blue-950";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

export function GusCoachNextStep({ directive, unresolvedCount, onFollowUp, onPlan }: GusCoachNextStepProps) {
  const actionButton = directive.recommendedActionHref ? (
    <Link
      href={directive.recommendedActionHref}
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-black text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
    >
      {directive.recommendedActionLabel}
    </Link>
  ) : (
    <button
      type="button"
      onClick={directive.recommendedActionKey === "open_planning_mode" ? onPlan : () => onFollowUp("Help me work through this next review step.")}
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-black text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
    >
      {directive.recommendedActionLabel}
    </button>
  );

  return (
    <section className={`rounded-xl border p-3 ${priorityTone(directive.priority)}`} aria-label="Gus coach next step">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/85 shadow-sm">
          {directive.priority === "critical" || directive.priority === "high" ? (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-current/70">
              Coach next step
            </p>
            {unresolvedCount > 0 ? (
              <span className="rounded-full border border-current/15 bg-white/72 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-current/70">
                {unresolvedCount} active
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-sm font-black leading-5 text-current">{directive.title}</h3>
          <p className="mt-1 text-sm leading-5 text-current">{directive.instruction}</p>
          <p className="mt-2 rounded-lg border border-current/10 bg-white/70 px-3 py-2 text-xs leading-5 text-current/75">
            {directive.whyItMatters}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {actionButton}
        <button
          type="button"
          onClick={onPlan}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent-primary)] px-3 py-1.5 text-xs font-black text-white shadow-[var(--app-shadow-primary-button)] transition hover:bg-[var(--app-accent-primary-hover)]"
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Draft with Gus
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {directive.followUps.map((followUp) => (
          <button
            key={followUp.followUpId}
            type="button"
            onClick={() => onFollowUp(followUp.prompt)}
            className="rounded-full border border-current/15 bg-white/72 px-3 py-1.5 text-[11px] font-black text-current transition hover:bg-white"
          >
            {followUp.actionLabel}
          </button>
        ))}
      </div>
    </section>
  );
}
