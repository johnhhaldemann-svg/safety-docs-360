import { hasPermission, isAdminRole, normalizeAppRole } from "@/lib/rbac";

/** Any company workspace member may read memory for RAG / assist. */
export function canAccessCompanyMemoryAssist(role: string | null | undefined) {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  const n = normalizeAppRole(role);
  return (
    n === "sales_demo" ||
    n === "company_admin" ||
    n === "manager" ||
    n === "safety_manager" ||
    n === "project_manager" ||
    n === "field_supervisor" ||
    n === "foreman" ||
    n === "field_user" ||
    n === "read_only" ||
    n === "company_user"
  );
}

/** Curate memory bank (CRUD) — aligned with RLS `security_can_mutate_company_memory`. */
export function canMutateCompanyMemory(role: string | null | undefined) {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  if (hasPermission(role, "can_manage_company_users")) return true;
  const n = normalizeAppRole(role);
  return n === "safety_manager" || n === "manager" || n === "company_admin";
}
