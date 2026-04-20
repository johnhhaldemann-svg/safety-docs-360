"use client";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDefaultDashboardModel } from "@/components/dashboard/dashboard-mappers";
import type { DashboardDataState } from "@/components/dashboard/types";

export function DefaultDashboard({ data }: { data: DashboardDataState }) {
  return <DashboardView model={getDefaultDashboardModel(data)} />;
}
