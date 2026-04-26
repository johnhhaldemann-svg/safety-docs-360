"use client";

import Link from "next/link";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import type {
  DashboardActionBlock,
  DashboardFeedBlock,
  DashboardGraphBlock,
  DashboardSummaryBlock,
  DashboardViewModel,
} from "@/components/dashboard/types";
import { useDashboardLayout } from "@/components/dashboard/use-dashboard-layout";
import { getDashboardSlotOptionIds } from "@/lib/dashboardLayout";

function renderFeedBlock(block: DashboardFeedBlock) {
  if (block.section.items.length === 0) {
    return (
      <SectionCard
        eyebrow={block.eyebrow}
        title={block.section.title}
        description={block.section.description}
        tone="elevated"
      >
        <EmptyState
          title={block.section.empty.title}
          description={block.section.empty.description}
          actionHref={block.section.empty.actionHref}
          actionLabel={block.section.empty.actionLabel}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      eyebrow={block.eyebrow}
      title={block.section.title}
      description={block.section.description}
      tone="elevated"
    >
      <div className="grid gap-3">
        {block.section.items.map((item) => (
          <div
            key={item.id}
            className={`relative overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.74)_0%,_var(--app-panel)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(76,108,161,0.05)] ${toneAccentClassName(item.tone)}`}
          >
            <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-current opacity-70" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{item.detail}</p>
              </div>
              <StatusBadge label={item.meta} tone={item.tone ?? "neutral"} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function renderActionBlock(block: DashboardActionBlock) {
  return (
    <SectionCard
      eyebrow="Next actions"
      title={block.section.title}
      description={block.section.description}
      tone="attention"
    >
      {block.section.items.length === 0 ? (
        <EmptyState
          title={block.section.empty.title}
          description={block.section.empty.description}
          actionHref={block.section.empty.actionHref}
          actionLabel={block.section.empty.actionLabel}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {block.section.items.map((item) => (
            <Link
              key={`${item.href}-${item.title}`}
              href={item.href}
              className={`group relative overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.78)_0%,_var(--app-panel)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(76,108,161,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-border-28)] hover:shadow-[0_14px_28px_rgba(76,108,161,0.1)] ${toneAccentClassName(item.tone)}`}
            >
              <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-current opacity-70" />
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.title}</p>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-white/80 text-[var(--app-accent-primary)] transition group-hover:translate-x-0.5">
                  <span aria-hidden="true">-&gt;</span>
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{item.description}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-accent-primary)]">
                {item.actionLabel}
              </p>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function renderSummaryBlock(block: DashboardSummaryBlock) {
  return (
    <SectionCard
      eyebrow={block.eyebrow}
      title={block.section.title}
      description={block.section.description}
      tone="elevated"
    >
      {block.section.items.length === 0 ? (
        <EmptyState
          title={block.section.empty.title}
          description={block.section.empty.description}
          actionHref={block.section.empty.actionHref}
          actionLabel={block.section.empty.actionLabel}
        />
      ) : (
        <div className="grid gap-3">
          {block.section.items.map((item) => {
            const content = (
              <div className={`relative overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.74)_0%,_var(--app-panel)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(76,108,161,0.05)] transition ${item.href ? "hover:-translate-y-0.5 hover:border-[var(--app-accent-border-28)] hover:shadow-[0_14px_28px_rgba(76,108,161,0.1)]" : ""} ${toneAccentClassName(item.tone)}`}>
                <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-current opacity-70" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{item.note}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-app-display rounded-2xl border border-current/15 bg-white/72 px-3 py-1.5 text-xl font-bold tracking-tight text-[var(--app-text-strong)] shadow-sm">
                      {item.value}
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-full ${toneDotClassName(item.tone)}`} aria-hidden="true" />
                  </div>
                </div>
              </div>
            );

            if (!item.href) {
              return <div key={item.id}>{content}</div>;
            }

            return (
              <Link key={item.id} href={item.href} className="block">
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function toneAccentClassName(tone?: "neutral" | "success" | "warning" | "error" | "info" | "panel" | "elevated" | "attention") {
  switch (tone) {
    case "success":
      return "text-[var(--semantic-success)]";
    case "warning":
    case "attention":
      return "text-[var(--semantic-warning)]";
    case "error":
      return "text-[var(--semantic-danger)]";
    case "info":
      return "text-[var(--semantic-info)]";
    default:
      return "text-[var(--semantic-neutral)]";
  }
}

function toneDotClassName(tone?: "neutral" | "success" | "warning" | "error" | "info") {
  switch (tone) {
    case "success":
      return "bg-[var(--semantic-success)]";
    case "warning":
      return "bg-[var(--semantic-warning)]";
    case "error":
      return "bg-[var(--semantic-danger)]";
    case "info":
      return "bg-[var(--semantic-info)]";
    default:
      return "bg-[var(--semantic-neutral)]";
  }
}

function graphToneClassName(tone: DashboardGraphBlock["section"]["items"][number]["tone"]) {
  switch (tone) {
    case "success":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    case "error":
      return "bg-rose-500";
    case "info":
      return "bg-sky-500";
    default:
      return "bg-[var(--app-accent-primary)]";
  }
}

function graphToneColor(tone: DashboardGraphBlock["section"]["items"][number]["tone"]) {
  switch (tone) {
    case "success":
      return "#10b981";
    case "warning":
      return "#f59e0b";
    case "error":
      return "#f43f5e";
    case "info":
      return "#0ea5e9";
    default:
      return "#3b82f6";
  }
}

function renderGraphBlock(block: DashboardGraphBlock) {
  const maxValue = Math.max(...block.section.items.map((item) => item.value), 0);
  const totalValue = block.section.items.reduce((sum, item) => sum + item.value, 0);
  const isPieChart = block.section.chartType === "pie";

  return (
    <SectionCard
      eyebrow={block.eyebrow}
      title={block.section.title}
      description={block.section.description}
      tone="elevated"
    >
      {block.section.items.length === 0 || maxValue <= 0 ? (
        <EmptyState
          title={block.section.empty.title}
          description={block.section.empty.description}
          actionHref={block.section.empty.actionHref}
          actionLabel={block.section.empty.actionLabel}
        />
      ) : isPieChart && totalValue > 0 ? (
        <div className="grid gap-4 rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.7)_0%,_rgba(234,241,255,0.52)_100%)] p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
          <div className="mx-auto h-40 w-40 rounded-full border border-[var(--app-border-subtle)] bg-white/80 shadow-inner">
            <div
              className="h-full w-full rounded-full"
              style={{
                background: `conic-gradient(${(() => {
                  let cursor = 0;
                  return block.section.items
                    .map((item) => {
                      const ratio = item.value / totalValue;
                      const next = cursor + ratio * 100;
                      const color = graphToneColor(item.tone);
                      const segment = `${color} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`;
                      cursor = next;
                      return segment;
                    })
                    .join(", ");
                })()})`,
              }}
            />
          </div>
          <div className="grid gap-3">
            {block.section.items.map((item) => {
              const percent = Math.round((item.value / totalValue) * 100);
              const valueText = `${item.value}${block.section.valueLabel ? ` ${block.section.valueLabel}` : ""}`;
              return (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--app-border-subtle)] bg-white/80 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${graphToneClassName(item.tone)}`} />
                    <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.label}</p>
                  </div>
                  <p className="text-sm font-bold text-[var(--app-text-strong)]">
                    {valueText} ({percent}%)
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.7)_0%,_rgba(234,241,255,0.52)_100%)] p-4">
          {block.section.items.map((item) => {
            const width = Math.max(8, Math.round((item.value / maxValue) * 100));
            const valueText = `${item.value}${block.section.valueLabel ? ` ${block.section.valueLabel}` : ""}`;

            return (
              <div key={item.id} className="grid gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold capitalize text-[var(--app-text-strong)]">
                    {item.label}
                  </p>
                  <p className="shrink-0 text-sm font-bold text-[var(--app-text-strong)]">
                    {valueText}
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-[var(--app-border-subtle)] bg-white/80 shadow-inner">
                  <div
                    className={`h-full rounded-full ${graphToneClassName(item.tone)} shadow-[0_0_0_1px_rgba(255,255,255,0.35)_inset]`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                {item.detail ? (
                  <p className="text-xs leading-5 text-[var(--app-muted)]">{item.detail}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export function DashboardView({ model }: { model: DashboardViewModel }) {
  const layout = useDashboardLayout({ role: model.role });
  const displayedLayout = layout.editing ? layout.draftLayout : layout.effectiveLayout;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={model.hero.eyebrow}
        title={model.hero.title}
        description={model.hero.description}
        actions={
          <>
            {model.hero.actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={
                  action.variant === "primary"
                    ? appButtonPrimaryClassName
                    : appButtonSecondaryClassName
                }
              >
                {action.label}
              </Link>
            ))}
          </>
        }
      />

      {model.banner ? <InlineMessage tone={model.banner.tone}>{model.banner.message}</InlineMessage> : null}

      {layout.message ? <InlineMessage tone={layout.message.tone}>{layout.message.text}</InlineMessage> : null}

      {layout.editing ? (
        <SectionCard
          eyebrow="Workspace layout"
          title="Customize your 10 prevention blocks"
          description="Choose which widgets appear in each slot so supervisors see the right leading indicators first. Your layout is saved to your account and follows role defaults when access changes."
          aside={
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={appButtonPrimaryClassName}
                disabled={!layout.hasUnsavedChanges || layout.saving}
                onClick={() => void layout.save()}
              >
                {layout.saving ? "Saving..." : "Save layout"}
              </button>
              <button
                type="button"
                className={appButtonSecondaryClassName}
                disabled={layout.saving}
                onClick={layout.cancelEditing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={appButtonQuietClassName}
                disabled={layout.saving}
                onClick={() => void layout.reset()}
              >
                Reset to default
              </button>
            </div>
          }
          tone="attention"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {layout.draftLayout.map((selectedId, index) => {
              const optionIds = getDashboardSlotOptionIds({
                layout: layout.draftLayout,
                availableBlockIds: layout.availableBlocks.map((block) => block.id),
                slotIndex: index,
              });

              return (
                <label
                  key={`slot-${index + 1}`}
                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-4"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">
                    Slot {index + 1}
                  </span>
                  <select
                    className={`${appNativeSelectClassName} mt-3 w-full`}
                    value={selectedId}
                    onChange={(event) =>
                      layout.updateSlot(index, event.currentTarget.value as typeof selectedId)
                    }
                  >
                    {optionIds.map((blockId) => {
                      const block = layout.availableBlocks.find((item) => item.id === blockId);
                      return (
                        <option key={blockId} value={blockId}>
                          {block?.title ?? blockId}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
                    {layout.availableBlocks.find((block) => block.id === selectedId)?.description ??
                      "Choose the widget that should appear in this slot."}
                  </p>
                </label>
              );
            })}
          </div>
        </SectionCard>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            className={appButtonQuietClassName}
            disabled={layout.loading}
            onClick={layout.startEditing}
          >
            Customize dashboard
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {displayedLayout.map((blockId, index) => {
          const block = model.blocks[blockId];

          return (
            <div key={`${blockId}-${index}`} data-dashboard-block={blockId}>
              {block.kind === "metric" ? (
                <SectionCard
                  eyebrow={`Dashboard slot ${index + 1}`}
                  title={block.title}
                  description={block.detail}
                  tone={block.tone ?? "elevated"}
                >
                  <div className={`relative overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.88)_0%,_var(--app-panel)_100%)] px-5 py-6 shadow-[0_10px_22px_rgba(76,108,161,0.06)] ${toneAccentClassName(block.tone)}`}>
                    <span className="absolute right-5 top-5 h-12 w-12 rounded-2xl border border-current/15 bg-current/10" aria-hidden="true" />
                    <span className="absolute inset-y-4 left-0 w-1.5 rounded-r-full bg-current opacity-75" aria-hidden="true" />
                    <p className="font-app-display max-w-[78%] text-3xl font-bold tracking-tight text-[var(--app-text-strong)]">
                      {block.value}
                    </p>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--app-text)]">{block.detail}</p>
                  </div>
                </SectionCard>
              ) : block.kind === "feed" ? (
                renderFeedBlock(block)
              ) : block.kind === "action" ? (
                renderActionBlock(block)
              ) : block.kind === "graph" ? (
                renderGraphBlock(block)
              ) : (
                renderSummaryBlock(block)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
