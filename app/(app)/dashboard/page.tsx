"use client";

import { RoleDashboardResolver } from "@/components/dashboard/role-dashboard-resolver";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";

export default function DashboardPage() {
  const data = useDashboardData();

  return <RoleDashboardResolver data={data} />;
}
