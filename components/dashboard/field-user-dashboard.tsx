"use client";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getFieldUserDashboardModel } from "@/components/dashboard/dashboard-mappers";
import type { DashboardDataState } from "@/components/dashboard/types";

export function FieldUserDashboard({ data }: { data: DashboardDataState }) {
  return <DashboardView model={getFieldUserDashboardModel(data)} />;
}
