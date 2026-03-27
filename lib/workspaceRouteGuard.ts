import type { PermissionMap } from "@/lib/rbac";

/** Snapshot of user/session fields used for client-side route enforcement (no network). */
export type WorkspaceRouteUserSnapshot = {
  role: string;
  permissionMap: PermissionMap | null;
  profileComplete: boolean;
  acceptedTerms: boolean;
  companyId: string | null;
  accountStatus: string;
};

/**
 * Returns a path to redirect to if the current route is not allowed, otherwise null.
 * Mirrors app/(app)/layout.tsx session sync guards — keep in sync when changing access rules.
 */
export function getWorkspaceRouteRedirect(
  pathname: string,
  isAdminArea: boolean,
  u: WorkspaceRouteUserSnapshot
): string | null {
  if (u.accountStatus === "pending" || u.accountStatus === "suspended") {
    return null;
  }
  if (!u.acceptedTerms) {
    return null;
  }

  const nextRole = u.role;
  const nextCompanyId = u.companyId;
  const nextProfileComplete = u.profileComplete;
  const needsProfile =
    !Boolean(u.permissionMap?.can_access_internal_admin) && !nextProfileComplete;
  const canOpenCompanySetup =
    !needsProfile &&
    !Boolean(u.permissionMap?.can_access_internal_admin) &&
    nextRole !== "company_admin" &&
    nextRole !== "manager" &&
    nextRole !== "safety_manager" &&
    nextRole !== "company_user" &&
    nextRole !== "project_manager" &&
    nextRole !== "foreman" &&
    nextRole !== "field_user" &&
    nextRole !== "read_only" &&
    !nextCompanyId;

  if (needsProfile) {
    return pathname !== "/profile" ? "/profile" : null;
  }

  if (!canOpenCompanySetup && pathname === "/company-setup") {
    return "/dashboard";
  }

  const companyScoped =
    nextRole === "company_admin" ||
    nextRole === "manager" ||
    nextRole === "safety_manager" ||
    nextRole === "company_user" ||
    nextRole === "project_manager" ||
    nextRole === "foreman" ||
    nextRole === "field_user" ||
    nextRole === "read_only";

  if (companyScoped) {
    if (nextRole === "read_only") {
      const readOnlyAllowedRoutes = ["/dashboard", "/reports"];
      const inReadOnlyRoute = readOnlyAllowedRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );
      return inReadOnlyRoute ? null : "/dashboard";
    }

    const companyAllowedRoutes = ["/dashboard", "/library", "/profile"];

    if (
      nextRole === "project_manager" ||
      nextRole === "foreman" ||
      nextRole === "field_user"
    ) {
      companyAllowedRoutes.push("/jobsites");
    }

    if (
      nextRole === "company_admin" ||
      nextRole === "manager" ||
      nextRole === "safety_manager"
    ) {
      companyAllowedRoutes.push(
        "/companies",
        "/jobsites",
        "/field-id-exchange",
        "/safety-observations",
        "/safety-submit",
        "/daps",
        "/permits",
        "/incidents",
        "/analytics",
        "/reports"
      );
    }

    if (
      u.permissionMap?.can_create_documents ||
      u.permissionMap?.can_edit_documents ||
      u.permissionMap?.can_submit_documents
    ) {
      companyAllowedRoutes.push("/submit", "/safety-submit", "/upload", "/peshep", "/csep");
    }

    if (u.permissionMap?.can_manage_company_users) {
      companyAllowedRoutes.push("/company-users");
    }

    const inAllowedRoute = companyAllowedRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    return inAllowedRoute ? null : "/dashboard";
  }

  if (isAdminArea && !Boolean(u.permissionMap?.can_access_internal_admin)) {
    return "/dashboard";
  }

  return null;
}
