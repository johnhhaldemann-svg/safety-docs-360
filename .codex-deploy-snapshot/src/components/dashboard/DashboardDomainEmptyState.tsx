"use client";

import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/WorkspacePrimitives";

export type DashboardDomainEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

/**
 * Bordered empty region for dashboard overview domains (no charts, no placeholder counts).
 */
export function DashboardDomainEmptyState({
  icon,
  title,
  description,
  className = "",
}: DashboardDomainEmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-6 shadow-[0_6px_14px_rgba(76,108,161,0.04)] ${className}`.trim()}
    >
      <EmptyState align="left" icon={icon} title={title} description={description} />
    </div>
  );
}
