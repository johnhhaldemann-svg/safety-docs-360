export type PostLoginPermissionMap = {
  can_access_internal_admin?: boolean | null;
};

export const COMPANY_PLATFORM_ROUTE = "/safe-predict";
export const PLATFORM_ADMIN_ROUTE = "/admin";
export const PLATFORM_SUPERADMIN_ROUTE = "/superadmin";

function normalizePostLoginRole(role?: string | null) {
  const normalized = (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (normalized === "superadmin") return "super_admin";
  if (normalized === "platformadmin") return "platform_admin";

  return normalized;
}

export function resolvePostLoginRoute(
  role?: string | null,
  permissionMap?: PostLoginPermissionMap | null
) {
  const normalizedRole = normalizePostLoginRole(role);

  if (normalizedRole === "super_admin") {
    return PLATFORM_SUPERADMIN_ROUTE;
  }

  if (
    normalizedRole === "platform_admin" ||
    normalizedRole === "admin" ||
    Boolean(permissionMap?.can_access_internal_admin)
  ) {
    return PLATFORM_ADMIN_ROUTE;
  }

  return COMPANY_PLATFORM_ROUTE;
}
