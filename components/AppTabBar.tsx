"use client";

import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { assertMaxPrimaryTabs } from "@/lib/tabUrlState";

export type AppTabItem = {
  value: string;
  label: string;
  content: ReactNode;
};

const listClassName =
  "flex flex-wrap gap-1.5 rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(241,247,255,0.92)_100%)] p-1.5 shadow-[var(--app-shadow-soft)]";

const triggerClassName =
  "rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--app-text)] transition data-[state=active]:bg-[var(--app-accent-primary)] data-[state=active]:text-white data-[state=active]:shadow-[var(--app-shadow-primary-button)]";

/**
 * Radix tabs with at most five triggers; optional slot rendered below the tab list (e.g. filter chips).
 */
export function AppTabBar({
  items,
  value,
  onValueChange,
  chips,
  className = "",
}: {
  items: readonly AppTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  chips?: ReactNode;
  className?: string;
}) {
  assertMaxPrimaryTabs(items.length, "AppTabBar");

  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className={`space-y-4 ${className}`.trim()}>
      <div className="space-y-3">
        <Tabs.List className={listClassName} aria-label="Section tabs">
          {items.map((item) => (
            <Tabs.Trigger key={item.value} value={item.value} className={triggerClassName}>
              {item.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {chips ? <div className="flex flex-wrap items-center gap-2">{chips}</div> : null}
      </div>
      {items.map((item) => (
        <Tabs.Content key={item.value} value={item.value} className="outline-none">
          {item.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

/** Small link-styled chips for route sub-modes (jobsite workspace, etc.). */
export function SegmentedRouteChips({
  items,
  pathname,
}: {
  items: ReadonlyArray<{ href: string; label: string }>;
  pathname: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="navigation" aria-label="Section shortcuts">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
                : "border-[var(--app-border)] bg-white/80 text-[var(--app-text)] hover:border-[var(--app-accent-border-24)]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
