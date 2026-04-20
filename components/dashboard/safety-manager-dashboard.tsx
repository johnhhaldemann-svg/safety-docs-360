"use client";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getSafetyManagerDashboardModel } from "@/components/dashboard/dashboard-mappers";
import type { DashboardDataState } from "@/components/dashboard/types";

export function SafetyManagerDashboard({ data }: { data: DashboardDataState }) {
  return <DashboardView model={getSafetyManagerDashboardModel(data)} />;
}
