import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

export function canManageCompanyAccess(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager"
  );
}

export function canManageDaps(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager" ||
    normalized === "project_manager" ||
    normalized === "field_supervisor" ||
    normalized === "foreman"
  );
}

export function canManageObservations(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    canManageDaps(normalized) ||
    normalized === "field_user" ||
    normalized === "company_user"
  );
}

export function canVerifyObservationClosure(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager"
  );
}

export function canManagePermits(role?: string | null) {
  return canManageDaps(role);
}

export function canManageIncidents(role?: string | null) {
  return canManageDaps(role);
}

export function canGenerateReports(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager" ||
    normalized === "project_manager"
  );
}
