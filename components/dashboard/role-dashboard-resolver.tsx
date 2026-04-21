"use client";

import { DashboardExperience } from "@/components/dashboard/dashboard-experience";
import type { DashboardDataState } from "@/components/dashboard/types";

export function RoleDashboardResolver({ data }: { data: DashboardDataState }) {
  return <DashboardExperience data={data} />;
}
