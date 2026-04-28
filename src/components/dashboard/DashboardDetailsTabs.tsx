"use client";

import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { SectionCard } from "@/src/components/dashboard/SectionCard";

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
      <SectionCard
        eyebrow="Dashboard sections"
        title="Explore the details"
        description="The score and priority queue stay visible above. Use these tabs for deeper operational review without turning the dashboard into one long report."
        tone="panel"
      >
        <Tabs.List className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--app-border-strong)] bg-white/90 p-1.5 shadow-[var(--app-shadow-soft)]">
          {dashboardTabs.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="min-w-max rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--app-text)] transition hover:bg-[var(--app-panel-soft)] data-[state=active]:bg-[var(--app-accent-primary)] data-[state=active]:text-white data-[state=active]:shadow-[var(--app-shadow-primary-button)]"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <p className="mt-3 text-xs leading-relaxed text-[var(--app-muted)]">
          {dashboardTabs.find((tab) => tab.value === activeTab)?.description}
        </p>
      </SectionCard>

      {dashboardTabs.map((tab) => (
        <Tabs.Content key={tab.value} value={tab.value} className="space-y-6 outline-none">
          {panels[tab.value]}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
