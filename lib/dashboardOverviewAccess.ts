import type { User } from "@supabase/supabase-js";
import type { DashboardOverviewRiskLevel } from "@/src/lib/dashboard/types";
import type { PermissionMap } from "@/lib/rbac";
import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

export function parseDashboardRiskLevel(raw: string | null | undefined): DashboardOverviewRiskLevel {
  const v = (raw ?? "all").trim().toLowerCase();
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "all";
}

/** UUID-like contractor id from auth metadata (portal / subcontractor accounts). */
export function linkedContractorIdFromUser(user: User): string | null {
  const meta = { ...(user.app_metadata ?? {}), ...(user.user_metadata ?? {}) } as Record<string, unknown>;
  for (const key of ["contractor_id", "company_contractor_id", "linked_contractor_id"]) {
    const v = meta[key];
    if (typeof v === "string") {
      const t = v.trim();
      if (/^[0-9a-f-]{36}$/i.test(t)) return t;
    }
  }
  return null;
}

export function userMaySelectAnyCompanyContractor(params: { role: string; permissionMap: PermissionMap }): boolean {
  if (isAdminRole(params.role)) return true;
  if (params.permissionMap.can_view_all_company_data) return true;
  if (params.permissionMap.can_manage_company_users) return true;
  const r = normalizeAppRole(params.role);
  return r === "company_admin" || r === "manager" || r === "safety_manager" || r === "project_manager";
}
