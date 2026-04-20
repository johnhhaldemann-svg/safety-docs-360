"use client";

import Link from "next/link";
import {
  ActionTile,
  ActivityFeed,
  EmptyState,
  InlineMessage,
  MetricTile,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import type {
  DashboardActionSection,
  DashboardFeedSection,
  DashboardSummarySection,
  DashboardViewModel,
} from "@/components/dashboard/types";

function renderFeedSection(section: DashboardFeedSection) {
  if (section.items.length === 0) {
    return (
      <SectionCard title={section.title} description={section.description}>
        <EmptyState
          title={section.empty.title}
          description={section.empty.description}
          actionHref={section.empty.actionHref}
          actionLabel={section.empty.actionLabel}
        />
      </SectionCard>
    );
  }

  return (
    <ActivityFeed
      title={section.title}
      description={section.description}
      items={section.items}
    />
  );
}

function renderActionSection(section: DashboardActionSection) {
  return (
    <SectionCard
      eyebrow="Next Actions"
      title={section.title}
      description={section.description}
      tone="elevated"
    >
      {section.items.length === 0 ? (
        <EmptyState
          title={section.empty.title}
          description={section.empty.description}
          actionHref={section.empty.actionHref}
          actionLabel={section.empty.actionLabel}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {section.items.map((item, index) => (
            <ActionTile
              key={item.title}
              eyebrow={index === 0 ? "Start here" : "Recommended"}
              title={item.title}
              description={item.description}
              href={item.href}
              actionLabel={item.actionLabel}
              tone={item.tone ?? (index === 0 ? "attention" : "panel")}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function renderSummarySection(
  eyebrow: string,
  section: DashboardSummarySection
) {
  return (
    <SectionCard eyebrow={eyebrow} title={section.title} description={section.description}>
      {section.items.length === 0 ? (
        <EmptyState
          title={section.empty.title}
          description={section.empty.description}
          actionHref={section.empty.actionHref}
          actionLabel={section.empty.actionLabel}
        />
      ) : (
        <div className="grid gap-3">
          {section.items.map((item) => {
            const content = (
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--app-text-strong)]">
                      {item.label}
                    </p>
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

      {model.banner ? (
        <InlineMessage tone={model.banner.tone}>{model.banner.message}</InlineMessage>
      ) : null}

      <SectionCard
        eyebrow="Today / Attention"
        title="What needs attention now"
        description="Start at the top, then move into the actions and follow-ups that matter most for this role."
        tone="attention"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {model.metrics.map((metric, index) => (
            <MetricTile
              key={metric.title}
              eyebrow={index === 0 ? "Primary signal" : "Live metric"}
              title={metric.title}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone ?? (index === 0 ? "attention" : "panel")}
            />
          ))}
        </div>
      </SectionCard>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        {renderFeedSection(model.priority)}
        {renderActionSection(model.nextActions)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        {renderFeedSection(model.activity)}
        {renderSummarySection("Insights", model.insights)}
      </section>

      {renderSummarySection("Coverage", model.support)}
    </div>
  );
}
