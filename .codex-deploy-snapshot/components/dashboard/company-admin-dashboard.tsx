"use client";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getCompanyAdminDashboardModel } from "@/components/dashboard/dashboard-mappers";
import type { DashboardDataState } from "@/components/dashboard/types";

export function CompanyAdminDashboard({ data }: { data: DashboardDataState }) {
  return <DashboardView model={getCompanyAdminDashboardModel(data)} />;
}
