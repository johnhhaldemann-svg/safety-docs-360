"use client";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getFieldSupervisorDashboardModel } from "@/components/dashboard/dashboard-mappers";
import type { DashboardDataState } from "@/components/dashboard/types";

export function FieldSupervisorDashboard({ data }: { data: DashboardDataState }) {
  return <DashboardView model={getFieldSupervisorDashboardModel(data)} />;
}
