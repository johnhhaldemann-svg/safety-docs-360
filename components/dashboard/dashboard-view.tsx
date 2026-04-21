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
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-4"
          >
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
              className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-4 transition hover:border-[rgba(79,125,243,0.22)] hover:shadow-sm"
            >
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.title}</p>
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
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{item.note}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-2xl font-bold tracking-tight text-[var(--app-text-strong)]">
                      {item.value}
                    </span>
                    <StatusBadge label={item.value} tone={item.tone ?? "info"} />
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

      <SectionCard
        eyebrow="Dashboard layout"
        title="Customize your 10 dashboard blocks"
        description="Choose which full widgets appear in each slot. Your layout is saved to your account and follows your role defaults when access changes."
        aside={
          <div className="flex flex-wrap gap-3">
            {layout.editing ? (
              <>
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
              </>
            ) : (
              <button
                type="button"
                className={appButtonQuietClassName}
                disabled={layout.loading}
                onClick={layout.startEditing}
              >
                Customize dashboard
              </button>
            )}
          </div>
        }
        tone="attention"
      >
        {layout.editing ? (
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
        ) : (
          <div className="flex flex-wrap gap-3 text-sm text-[var(--app-text)]">
            <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2">
              10 fixed slots
            </span>
            <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2">
              Per-user saved layout
            </span>
            <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2">
              {layout.savedLayout ? "Custom layout saved" : "Using role default layout"}
            </span>
            <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2">
              Role default size: {layout.defaultLayout.length} blocks
            </span>
          </div>
        )}
      </SectionCard>

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
                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-6">
                    <p className="text-4xl font-bold tracking-tight text-[var(--app-text-strong)]">
                      {block.value}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">{block.detail}</p>
                  </div>
                </SectionCard>
              ) : block.kind === "feed" ? (
                renderFeedBlock(block)
              ) : block.kind === "action" ? (
                renderActionBlock(block)
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
