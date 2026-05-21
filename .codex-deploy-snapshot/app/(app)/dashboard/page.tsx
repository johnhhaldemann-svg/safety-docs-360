"use client";

import { Suspense } from "react";
import { DashboardOverviewShell } from "@/components/dashboard/DashboardOverviewShell";
import { RoleDashboardResolver } from "@/components/dashboard/role-dashboard-resolver";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";

export default function DashboardPage() {
  const data = useDashboardData();
  return (
    <div className="space-y-10 pb-10">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-6 text-center text-sm text-[var(--app-muted)]">
            Loading prevention view filters…
          </div>
        }
      >
        <DashboardOverviewShell workspace={data} />
      </Suspense>
      <RoleDashboardResolver data={data} />
    </div>
  );
}
