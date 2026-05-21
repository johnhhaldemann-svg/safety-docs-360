"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarX, Download, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import {
  filterTrainingMatrixActionQueue,
  trainingMatrixActionQueueToCsv,
  type TrainingMatrixActionQueueItem,
  type TrainingMatrixQueueActionType,
  type TrainingMatrixQueueRequirement,
} from "@/lib/trainingMatrixActionQueue";

const ACTION_OPTIONS: Array<{ value: TrainingMatrixQueueActionType | ""; label: string }> = [
  { value: "", label: "All actions" },
  { value: "expired", label: "Expired" },
  { value: "gap", label: "Missing" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "missing_expiry", label: "No date on file" },
];

function actionLabel(type: TrainingMatrixQueueActionType): string {
  switch (type) {
    case "expired":
      return "Expired";
    case "gap":
      return "Missing";
    case "expiring_soon":
      return "Expiring soon";
    case "missing_expiry":
      return "No date on file";
  }
}

function actionTone(type: TrainingMatrixQueueActionType): string {
  switch (type) {
    case "expired":
      return "bg-rose-500/12 text-rose-700 ring-rose-500/25";
    case "gap":
      return "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/25";
    case "expiring_soon":
      return "bg-amber-500/14 text-amber-800 ring-amber-500/30";
    case "missing_expiry":
      return "bg-sky-500/12 text-sky-700 ring-sky-500/25";
  }
}

function actionIcon(type: TrainingMatrixQueueActionType) {
  switch (type) {
    case "expired":
      return CalendarX;
    case "gap":
      return AlertTriangle;
    case "expiring_soon":
      return CalendarClock;
    case "missing_expiry":
      return Search;
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function downloadCsv(queue: TrainingMatrixActionQueueItem[]) {
  if (queue.length === 0) return;
  const csv = trainingMatrixActionQueueToCsv(queue);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `training-matrix-action-queue-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CoordinatorQueue({
  queue,
  requirements,
  loading,
  onRefresh,
}: {
  queue: TrainingMatrixActionQueueItem[];
  requirements: TrainingMatrixQueueRequirement[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [actionType, setActionType] = useState<TrainingMatrixQueueActionType | "">("");
  const [trade, setTrade] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [search, setSearch] = useState("");

  const trades = useMemo(() => uniqueSorted(queue.map((item) => item.trade)), [queue]);
  const requirementIdsInQueue = useMemo(
    () => new Set(queue.map((item) => item.requirementId).filter(Boolean)),
    [queue]
  );
  const visibleRequirements = useMemo(
    () => requirements.filter((requirement) => requirementIdsInQueue.has(requirement.id)),
    [requirementIdsInQueue, requirements]
  );
  const visibleQueue = useMemo(
    () =>
      filterTrainingMatrixActionQueue(queue, {
        actionType,
        trade,
        requirementId,
        search,
      }),
    [actionType, queue, requirementId, search, trade]
  );
  const topQueue = visibleQueue.slice(0, 12);

  return (
    <SectionCard
      eyebrow="Coordinator Queue"
      title="Training Actions"
      description="Prioritized people and credentials that need coordinator attention."
      tone="attention"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`${appButtonSecondaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <RefreshCw aria-hidden className="h-4 w-4" />
            {loading ? "Refreshing" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(visibleQueue)}
            disabled={visibleQueue.length === 0}
            className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Download aria-hidden className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm font-medium text-[var(--app-text-strong)]">
          Type
          <select
            value={actionType}
            onChange={(event) => setActionType(event.target.value as TrainingMatrixQueueActionType | "")}
            className={`mt-1 w-full ${appNativeSelectClassName}`}
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[var(--app-text-strong)]">
          Trade
          <select
            value={trade}
            onChange={(event) => setTrade(event.target.value)}
            className={`mt-1 w-full ${appNativeSelectClassName}`}
          >
            <option value="">All trades</option>
            {trades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[var(--app-text-strong)]">
          Requirement
          <select
            value={requirementId}
            onChange={(event) => setRequirementId(event.target.value)}
            className={`mt-1 w-full ${appNativeSelectClassName}`}
          >
            <option value="">All requirements</option>
            {visibleRequirements.map((requirement) => (
              <option key={requirement.id} value={requirement.id}>
                {requirement.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[var(--app-text-strong)]">
          Person search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2 text-sm text-[var(--app-text-strong)] shadow-[0_4px_10px_rgba(76,108,161,0.035)] outline-none transition focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
            placeholder="Name, email, credential"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs text-[var(--app-muted)]">
        <span>
          <span className="font-semibold text-[var(--app-text-strong)]">{visibleQueue.length}</span> visible of{" "}
          <span className="font-semibold text-[var(--app-text-strong)]">{queue.length}</span> actions
        </span>
        {(actionType || trade || requirementId || search) ? (
          <button
            type="button"
            onClick={() => {
              setActionType("");
              setTrade("");
              setRequirementId("");
              setSearch("");
            }}
            className={appButtonQuietClassName}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {topQueue.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--app-border)] bg-white/80">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--app-border)] bg-[var(--app-panel-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Requirement / credential</th>
                <th className="px-3 py-2">Timing</th>
                <th className="px-3 py-2">Next step</th>
              </tr>
            </thead>
            <tbody>
              {topQueue.map((item) => {
                const Icon = actionIcon(item.actionType);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--app-border)] bg-white/72 align-top hover:bg-[var(--app-accent-surface-06)]"
                  >
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${actionTone(item.actionType)}`}
                      >
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                        {actionLabel(item.actionType)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-[var(--app-text-strong)]">{item.person}</div>
                      <div className="mt-0.5 text-xs text-[var(--app-muted)]">{item.email || "No email"}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">
                        {item.position} / {item.trade}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[280px] font-medium text-[var(--app-text-strong)]">
                        {item.requirementTitle ?? item.certification}
                      </div>
                      {item.requirementTitle ? (
                        <div className="mt-0.5 max-w-[280px] text-xs text-[var(--app-muted)]">
                          {item.certification}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[var(--app-muted)]">
                      <div className="font-semibold text-[var(--app-text-strong)]">{item.status}</div>
                      {item.expiresOn ? (
                        <div className="mt-0.5">
                          {item.expiresOn}
                          {item.daysUntilExpiry != null ? ` / ${item.daysUntilExpiry}d` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[320px] text-xs leading-5 text-[var(--app-text)]">
                        {item.suggestedNextStep}
                      </div>
                      <Link
                        href={`/profile?userId=${encodeURIComponent(item.userId)}&returnTo=${encodeURIComponent("/training-matrix")}`}
                        className="mt-2 inline-flex text-xs font-bold text-[var(--app-accent-primary)] hover:underline"
                      >
                        Update profile & dates
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleQueue.length > topQueue.length ? (
            <div className="border-t border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-xs text-[var(--app-muted)]">
              Showing first {topQueue.length}; export includes all visible actions.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white/78 px-4 py-8 text-center">
          <p className="font-semibold text-[var(--app-text-strong)]">No coordinator actions in this view.</p>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Clear filters or refresh the matrix after profiles are updated.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
