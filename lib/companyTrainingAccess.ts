import {
  hasAnyPermission,
  hasPermission,
  isAdminRole,
  normalizeAppRole,
} from "@/lib/rbac";

const TRAINING_MATRIX_COMPANY_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
]);

export function canViewCompanyTrainingMatrix(role: string | null | undefined) {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  const n = normalizeAppRole(role);
  if (TRAINING_MATRIX_COMPANY_ROLES.has(n)) return true;
  return hasAnyPermission(role, [
    "can_manage_company_users",
    "can_manage_users",
    "can_view_all_company_data",
    "can_view_analytics",
  ]);
}

export function canMutateCompanyTrainingRequirements(role: string | null | undefined) {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  if (hasPermission(role, "can_manage_company_users")) return true;
  if (hasPermission(role, "can_manage_users")) return true;
  const n = normalizeAppRole(role);
  return n === "safety_manager" || n === "manager" || n === "company_admin";
}
