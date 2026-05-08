"use client";

import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { formatTitleCase } from "@/lib/formatTitleCase";

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
    <Tabs.Root value={activeTab} onValueChange={onTabChange} className="space-y-4">
      <section className="rounded-xl border border-[var(--app-border)] bg-white/94 px-3 py-3 shadow-[0_8px_20px_rgba(44,58,86,0.04)] sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Detail Console
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">
              {dashboardTabs.find((tab) => tab.value === activeTab)?.description}
            </p>
          </div>
          <Tabs.List
            aria-label="Dashboard detail sections"
            className="flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-1"
          >
          {dashboardTabs.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="min-w-max rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--app-text)] transition hover:bg-white data-[state=active]:!bg-[var(--app-text-strong)] data-[state=active]:!text-white data-[state=active]:shadow-[0_6px_14px_rgba(22,50,79,0.16)]"
            >
              {formatTitleCase(tab.label) || tab.label}
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
