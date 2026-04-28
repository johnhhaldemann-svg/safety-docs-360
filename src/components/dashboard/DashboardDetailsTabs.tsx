"use client";

import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export const DASHBOARD_TAB_IDS = ["operations", "trends", "risks", "readiness", "system"] as const;

export type DashboardTabId = (typeof DASHBOARD_TAB_IDS)[number];

export const dashboardTabs: Array<{ value: DashboardTabId; label: string; description: string }> = [
  { value: "operations", label: "Operations", description: "Current safety posture and active work controls." },
  { value: "trends", label: "Trends", description: "Forecasts, observations, and repeated field signals." },
  { value: "risks", label: "Risks", description: "Corrective discipline and partner risk concentration." },
  { value: "readiness", label: "Readiness", description: "Permits, training, credentials, and documents." },
  { value: "system", label: "System Health", description: "AI review, source health, and platform checks." },
];

export function readDashboardTab(value: string | null): DashboardTabId {
  return DASHBOARD_TAB_IDS.includes(value as DashboardTabId) ? (value as DashboardTabId) : "operations";
}

type DashboardDetailsTabsProps = {
  activeTab: DashboardTabId;
  onTabChange: (value: string) => void;
  panels: Record<DashboardTabId, ReactNode>;
};

export function DashboardDetailsTabs({ activeTab, onTabChange, panels }: DashboardDetailsTabsProps) {
  return (
    <Tabs.Root value={activeTab} onValueChange={onTabChange} className="space-y-5">
      <section className="rounded-2xl border border-[var(--app-border)] bg-white/92 px-4 py-3 shadow-[var(--app-shadow-soft)] sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Dashboard sections
            </p>
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[var(--app-text-strong)]">
              Explore the details
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">
              {dashboardTabs.find((tab) => tab.value === activeTab)?.description}
            </p>
          </div>
          <Tabs.List
            aria-label="Dashboard detail sections"
            className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] p-1.5"
          >
          {dashboardTabs.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="min-w-max rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--app-text)] transition hover:bg-white data-[state=active]:bg-[var(--app-accent-primary)] data-[state=active]:text-white data-[state=active]:shadow-[var(--app-shadow-primary-button)]"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        </div>
      </section>

      {dashboardTabs.map((tab) => (
        <Tabs.Content key={tab.value} value={tab.value} className="space-y-6 outline-none">
          {panels[tab.value]}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
