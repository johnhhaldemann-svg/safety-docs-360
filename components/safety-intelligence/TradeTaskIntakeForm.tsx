"use client";

import { useState } from "react";
import { appNativeSelectClassName } from "@/components/WorkspacePrimitives";

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

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
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
      <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)]">
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
      <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)]">
        Task
        <input
          value={draft.taskTitle}
          onChange={(event) => setDraft((current) => ({ ...current, taskTitle: event.target.value }))}
          className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2.5 text-sm"
          placeholder="Welding and hot work"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)] md:col-span-2">
        Field detail
        <textarea
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          className="min-h-28 rounded-xl border border-[var(--app-border-strong)] px-4 py-3 text-sm"
          placeholder="Describe work conditions, nearby crews, equipment, and anything unusual."
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)]">
        Work area
        <input
          value={draft.workAreaLabel}
          onChange={(event) => setDraft((current) => ({ ...current, workAreaLabel: event.target.value }))}
          className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2.5 text-sm"
          placeholder="Area B"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)]">
        Weather
        <input
          value={draft.weatherConditionCode}
          onChange={(event) => setDraft((current) => ({ ...current, weatherConditionCode: event.target.value }))}
          className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2.5 text-sm"
          placeholder="clear, wind, rain, storm"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)]">
        Start
        <input
          type="datetime-local"
          value={draft.startsAt}
          onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))}
          className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2.5 text-sm"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-[var(--app-text-strong)]">
        End
        <input
          type="datetime-local"
          value={draft.endsAt}
          onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))}
          className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2.5 text-sm"
        />
      </label>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={working || !draft.taskTitle.trim()}
          className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--app-shadow-primary-button)] disabled:opacity-50"
        >
          {working ? "Processing pipeline..." : "Bucket + evaluate"}
        </button>
      </div>
    </form>
  );
}

