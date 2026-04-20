"use client";

import { CompanyAdminDashboard } from "@/components/dashboard/company-admin-dashboard";
import { DefaultDashboard } from "@/components/dashboard/default-dashboard";
import { FieldSupervisorDashboard } from "@/components/dashboard/field-supervisor-dashboard";
import { SafetyManagerDashboard } from "@/components/dashboard/safety-manager-dashboard";
import type { DashboardDataState } from "@/components/dashboard/types";
import { resolveDashboardRole } from "@/lib/dashboardRole";

export function RoleDashboardResolver({ data }: { data: DashboardDataState }) {
  const dashboardRole = resolveDashboardRole(data.userRole);

  if (dashboardRole === "company_admin") {
    return <CompanyAdminDashboard data={data} />;
  }
  if (dashboardRole === "safety_manager") {
    return <SafetyManagerDashboard data={data} />;
  }
  if (dashboardRole === "field_supervisor") {
    return <FieldSupervisorDashboard data={data} />;
  }

  return <DefaultDashboard data={data} />;
}
