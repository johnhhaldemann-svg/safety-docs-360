import { normalizeAppRole } from "@/lib/rbac";

export type DashboardRole =
  | "company_admin"
  | "safety_manager"
  | "field_supervisor"
  | "field_user"
  | "default";

export function resolveDashboardRole(role?: string | null): DashboardRole {
  const legacyNormalized = (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const normalized = normalizeAppRole(role);

  if (normalized === "field_user") {
    return "field_user";
  }
  if (legacyNormalized === "field_supervisor") {
    return "field_supervisor";
  }
  if (normalized === "company_admin") {
    return "company_admin";
  }
  if (normalized === "sales_demo") {
    return "company_admin";
  }
  if (normalized === "safety_manager") {
    return "safety_manager";
  }
  if (normalized === "foreman") {
    return "field_supervisor";
  }

  return "default";
}
