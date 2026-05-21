"use client";

import { useState } from "react";
import {
  appButtonPrimaryClassName,
  appNativeSelectClassName,
  workspaceSectionEyebrowClassName,
} from "@/components/WorkspacePrimitives";

export type TradeTaskDraft = {
  tradeCode: string;
  taskTitle: string;
  description: string;
  workAreaLabel: string;
  startsAt: string;
  endsAt: string;
  weatherConditionCode: string;
};

export function TradeTaskIntakeForm({
  trades,
  onSubmit,
  initialJobsiteId,
}: {
  trades: Array<{ code: string; name: string }>;
  onSubmit: (draft: TradeTaskDraft & { jobsiteId?: string | null }) => Promise<void> | void;
  initialJobsiteId?: string | null;
}) {
  const [draft, setDraft] = useState<TradeTaskDraft>({
    tradeCode: trades[0]?.code ?? "",
    taskTitle: "",
    description: "",
    workAreaLabel: "",
    startsAt: "",
    endsAt: "",
    weatherConditionCode: "",
  });
  const [working, setWorking] = useState(false);
  const canSubmit = Boolean(draft.taskTitle.trim()) && !working;
  const inputClassName =
    "h-11 rounded-xl border border-[var(--app-border-strong)] bg-white/95 px-3 text-sm text-[var(--app-text-strong)] shadow-[0_8px_18px_rgba(76,108,161,0.05)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]";
  const textAreaClassName =
    "min-h-28 rounded-xl border border-[var(--app-border-strong)] bg-white/95 px-3 py-2.5 text-sm leading-6 text-[var(--app-text-strong)] shadow-[0_8px_18px_rgba(76,108,161,0.05)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]";
  const labelClassName = "grid gap-1.5 text-xs font-semibold text-[var(--app-text-strong)]";

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setWorking(true);
        try {
          await onSubmit({ ...draft, jobsiteId: initialJobsiteId ?? null });
        } finally {
          setWorking(false);
        }
      }}
    >
      <fieldset className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
        <legend className={workspaceSectionEyebrowClassName}>Work details</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className={labelClassName}>
            Trade
            <select
              value={draft.tradeCode}
              onChange={(event) => setDraft((current) => ({ ...current, tradeCode: event.target.value }))}
              className={appNativeSelectClassName}
            >
              {trades.map((trade) => (
                <option key={trade.code} value={trade.code}>
                  {trade.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Task
            <input
              value={draft.taskTitle}
              onChange={(event) => setDraft((current) => ({ ...current, taskTitle: event.target.value }))}
              className={inputClassName}
              placeholder="Welding and hot work"
            />
          </label>
          <label className={`${labelClassName} md:col-span-2`}>
            Field detail
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              className={textAreaClassName}
              placeholder="Describe work conditions, nearby crews, equipment, and anything unusual."
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-[var(--app-border)] bg-white/80 p-4">
        <legend className={workspaceSectionEyebrowClassName}>Location & schedule</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className={labelClassName}>
            Work area
            <input
              value={draft.workAreaLabel}
              onChange={(event) => setDraft((current) => ({ ...current, workAreaLabel: event.target.value }))}
              className={inputClassName}
              placeholder="Area B"
            />
          </label>
          <label className={labelClassName}>
            Start
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            End
            <input
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))}
              className={inputClassName}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-[var(--app-border)] bg-white/80 p-4">
        <legend className={workspaceSectionEyebrowClassName}>Conditions</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className={labelClassName}>
            Weather
            <input
              value={draft.weatherConditionCode}
              onChange={(event) => setDraft((current) => ({ ...current, weatherConditionCode: event.target.value }))}
              className={inputClassName}
              placeholder="clear, wind, rain, storm"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${appButtonPrimaryClassName} w-full disabled:cursor-not-allowed disabled:opacity-50 md:w-auto`}
            >
              {working ? "Evaluating..." : "Evaluate work package"}
            </button>
          </div>
        </div>
      </fieldset>
      {!draft.taskTitle.trim() ? (
        <p className="text-xs leading-5 text-[var(--app-muted)]">
          Add a task name to evaluate the work package against rules, conflicts, permits, training, and PPE.
        </p>
      ) : null}
    </form>
  );
}
