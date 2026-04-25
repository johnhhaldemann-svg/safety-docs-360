"use client";

import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { EmptyState, InlineMessage, ProvenanceBadge, StatusBadge } from "@/components/WorkspacePrimitives";
import type { SafetyReviewGap, SafetyReviewPayload, SafetyReviewRow } from "@/types/safety-intelligence";

type ReviewTab = "all" | "permit" | "training" | "ppe";

function humanizeCode(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function summaryCardTone(tab: ReviewTab) {
  if (tab === "permit") return "border-[rgba(217,83,79,0.16)] bg-[rgba(255,242,242,0.92)]";
  if (tab === "training") return "border-[var(--app-accent-surface-18)] bg-[rgba(239,245,255,0.95)]";
  if (tab === "ppe") return "border-[rgba(217,164,65,0.18)] bg-[rgba(255,248,232,0.96)]";
  return "border-[rgba(138,150,168,0.18)] bg-[rgba(248,251,255,0.96)]";
}

function toneForGap(gap: SafetyReviewGap | undefined) {
  if (!gap) return "neutral";
  if (gap.code.endsWith("removed_by_override")) return "warning";
  if (gap.domain === "permit") return "error";
  return "warning";
}

function rowMatchesTab(row: SafetyReviewRow, tab: ReviewTab) {
  if (tab === "all") return row.gaps.length > 0;
  if (tab === "permit") {
    return (
      row.expectedPermitTriggers.length > 0 ||
      row.permitTriggers.length > 0 ||
      row.gaps.some((gap) => gap.domain === "permit")
    );
  }
  if (tab === "training") {
    return (
      row.expectedTrainingRequirements.length > 0 ||
      row.trainingRequirements.length > 0 ||
      row.gaps.some((gap) => gap.domain === "training")
    );
  }
  return (
    row.expectedPpeRequirements.length > 0 ||
    row.ppeRequirements.length > 0 ||
    row.gaps.some((gap) => gap.domain === "ppe")
  );
}

function DomainStatus({
  label,
  currentValues,
  expectedValues,
  gap,
}: {
  label: string;
  currentValues: string[];
  expectedValues: string[];
  gap?: SafetyReviewGap;
}) {
  return (
    <div className="rounded-lg border border-[var(--app-border-strong)] bg-[rgba(255,255,255,0.92)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-text)]">{label}</p>
          {gap ? (
            <p className="mt-1.5 text-xs leading-5 text-[var(--semantic-danger)]">{gap.detail}</p>
          ) : currentValues.length ? (
            <p className="mt-1.5 text-xs leading-5 text-[var(--app-text)]">Coverage is currently mapped for this domain.</p>
          ) : (
            <p className="mt-1.5 text-xs leading-5 text-[var(--app-text)]">No requirement applies for the current scope.</p>
          )}
        </div>
        <StatusBadge
          label={gap ? "Gap" : currentValues.length ? "Mapped" : "Not expected"}
          tone={toneForGap(gap)}
        />
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Current output</p>
          {currentValues.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {currentValues.map((value) => (
                <li
                  key={value}
                  className="rounded-full bg-[var(--app-accent-surface-12)] px-2 py-1 text-[10px] font-semibold text-[var(--app-accent-primary)]"
                >
                  {humanizeCode(value)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-[var(--app-text)]">No mapped output.</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Expected context</p>
          {expectedValues.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {expectedValues.map((value) => (
                <li
                  key={value}
                  className="rounded-full bg-[rgba(217,164,65,0.14)] px-2 py-1 text-[10px] font-semibold text-[var(--semantic-warning)]"
                >
                  {humanizeCode(value)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-[var(--app-text)]">No explicit expectation recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRowCard({ row }: { row: SafetyReviewRow }) {
  const permitGap = row.gaps.find((gap) => gap.domain === "permit");
  const trainingGap = row.gaps.find((gap) => gap.domain === "training");
  const ppeGap = row.gaps.find((gap) => gap.domain === "ppe");

  return (
    <article className="rounded-xl border border-[var(--app-border-strong)] bg-[rgba(255,255,255,0.94)] p-3 shadow-[var(--app-shadow-soft)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={humanizeCode(row.source)} tone={row.source === "live" ? "info" : "neutral"} />
            {row.tradeCode ? <StatusBadge label={humanizeCode(row.tradeCode)} tone="info" /> : null}
            {row.subTradeCode ? <StatusBadge label={humanizeCode(row.subTradeCode)} tone="neutral" /> : null}
          </div>
          <h4 className="mt-2 truncate text-sm font-semibold text-[var(--app-text-strong)]">{row.taskTitle}</h4>
          <p className="mt-0.5 text-xs leading-5 text-[var(--app-text)]">
            {row.sourceLabel}
            {row.taskCode ? ` · ${humanizeCode(row.taskCode)}` : ""}
            {row.workAreaLabel ? ` · ${row.workAreaLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${row.gaps.length} gap${row.gaps.length === 1 ? "" : "s"}`} tone={row.gaps.length ? "warning" : "success"} />
          <StatusBadge label={humanizeCode(row.band)} tone={row.band === "critical" ? "error" : row.band === "high" ? "warning" : "info"} />
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs font-semibold text-[var(--app-text-strong)]">
          Inspect permit, training, and PPE coverage
        </summary>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <DomainStatus
            label="Permit matrix"
            currentValues={row.permitTriggers}
            expectedValues={row.expectedPermitTriggers}
            gap={permitGap}
          />
          <DomainStatus
            label="Training review"
            currentValues={row.trainingRequirements}
            expectedValues={row.expectedTrainingRequirements}
            gap={trainingGap}
          />
          <DomainStatus
            label="PPE review"
            currentValues={row.ppeRequirements}
            expectedValues={row.expectedPpeRequirements}
            gap={ppeGap}
          />
        </div>
      </details>

      {row.actions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.actions.map((action) => (
            <Link
              key={`${row.id}:${action.domain}`}
              href={action.href}
              className="rounded-lg border border-[var(--app-border-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text-strong)] shadow-[0_10px_18px_rgba(76,108,161,0.06)] transition hover:bg-[var(--app-panel)]"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function SafetyReviewPanel({
  review,
  loading,
}: {
  review: SafetyReviewPayload | null;
  loading: boolean;
}) {
  const tabs: Array<{ value: ReviewTab; label: string; count: number }> = [
    { value: "all", label: "All gaps", count: review?.summary.totalGaps ?? 0 },
    { value: "permit", label: "Permit matrix", count: review?.summary.permitGaps ?? 0 },
    { value: "training", label: "Training review", count: review?.summary.trainingGaps ?? 0 },
    { value: "ppe", label: "PPE review", count: review?.summary.ppeGaps ?? 0 },
  ];

  if (loading && !review) {
    return (
      <div id="safety-review">
        <InlineMessage tone="neutral">Loading permit, training, and PPE review coverage…</InlineMessage>
      </div>
    );
  }

  if (!review || review.rows.length === 0) {
    return (
      <div id="safety-review">
        <EmptyState
          title="No review rows yet"
          description="Open company work or run live Safety Intelligence intake so the review surface has scoped tasks to evaluate."
        />
      </div>
    );
  }

  return (
    <div id="safety-review" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-text)]">
          Permit · Training · PPE coverage
        </p>
        <ProvenanceBadge
          kind="rules"
          title="Coverage gaps come from deterministic rules + conflict checks (rules/evaluate, conflicts/scan). No AI involved."
        />
      </div>
      {review.warning ? <InlineMessage tone="warning">{review.warning}</InlineMessage> : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tabs.map((tab) => (
          <div
            key={tab.value}
            className={`rounded-xl border px-3 py-2.5 shadow-[var(--app-shadow-soft)] ${summaryCardTone(tab.value)}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">{tab.label}</p>
            <p className="mt-1 text-xl font-bold text-[var(--app-text-strong)]">{tab.count}</p>
            <p className="mt-0.5 text-[10px] text-[var(--app-text)]">
              {tab.value === "all" ? `${review.rowCount} scoped row${review.rowCount === 1 ? "" : "s"}` : "Coverage gaps in this domain"}
            </p>
          </div>
        ))}
      </div>

      <Tabs.Root defaultValue="all" className="space-y-3">
        <Tabs.List className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--app-border-strong)] bg-[rgba(255,255,255,0.8)] p-1.5">
          {tabs.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] transition data-[state=active]:bg-[var(--app-accent-primary)] data-[state=active]:text-white"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {tabs.map((tab) => {
          const rows = review.rows.filter((row) => rowMatchesTab(row, tab.value));
          const visibleRows = rows.slice(0, 4);
          const hiddenCount = Math.max(0, rows.length - visibleRows.length);
          return (
            <Tabs.Content key={tab.value} value={tab.value} className="outline-none">
              {rows.length ? (
                <div className="space-y-2">
                  {visibleRows.map((row) => (
                    <ReviewRowCard key={row.id} row={row} />
                  ))}
                  {hiddenCount ? (
                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs font-semibold text-[var(--app-text)]">
                      {hiddenCount} more row{hiddenCount === 1 ? "" : "s"} hidden. Use the filters or jobsite scope to narrow the review.
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title={`No ${tab.label.toLowerCase()} rows`}
                  description="This scope does not currently produce any rows for the selected review view."
                />
              )}
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
    </div>
  );
}
