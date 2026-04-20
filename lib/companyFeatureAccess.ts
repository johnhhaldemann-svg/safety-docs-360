import type { PermissionMap } from "@/lib/rbac";

type RoleInput = string | null | undefined;

function normalizeRole(role: RoleInput) {
  const normalized = (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (normalized === "superadmin") return "super_admin";
  if (normalized === "platformadmin") return "platform_admin";
  if (normalized === "internal_reviewer_employee") return "internal_reviewer";
  if (normalized === "operations_manager") return "manager";
  if (normalized === "safety_director") return "safety_manager";
  if (normalized === "safety_director_safety_manager") return "safety_manager";
  if (normalized === "superintendent") return "project_manager";
  if (normalized === "superintendent_project_manager") return "project_manager";
  if (normalized === "field_user_observer") return "field_user";
  if (normalized === "observer") return "field_user";
  if (normalized === "read_only_client") return "read_only";
  return normalized;
}

function isAdminLikeRole(role: RoleInput) {
  const normalized = normalizeRole(role);
  return (
    normalized === "platform_admin" ||
    normalized === "super_admin" ||
    normalized === "admin"
  );
}

function hasDocumentWorkspaceCapability(permissionMap?: PermissionMap | null) {
  if (!permissionMap) {
    return true;
  }

  return Boolean(
    permissionMap.can_create_documents ||
      permissionMap.can_edit_documents ||
      permissionMap.can_view_all_company_data
  );
}

export function canSubmitCompanyDocuments(permissionMap?: PermissionMap | null) {
  if (!permissionMap) {
    return true;
  }

  return Boolean(
    permissionMap.can_submit_documents || permissionMap.can_view_all_company_data
  );
}

export function canBuildCompanyDocuments(permissionMap?: PermissionMap | null) {
  if (!permissionMap) {
    return true;
  }

  return Boolean(
    (permissionMap.can_create_documents && permissionMap.can_edit_documents) ||
      permissionMap.can_view_all_company_data
  );
}

const TRAINING_MATRIX_COMPANY_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
]);

const JSA_WORKSPACE_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
  "field_supervisor",
  "foreman",
]);

const PERMIT_WORKSPACE_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
]);

const INCIDENT_WORKSPACE_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
]);

const JOBSITE_WORKSPACE_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
  "field_supervisor",
  "foreman",
  "field_user",
  "read_only",
]);

export function canViewCompanyTrainingMatrix(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (isAdminLikeRole(role)) return true;

  const normalized = normalizeRole(role);
  if (TRAINING_MATRIX_COMPANY_ROLES.has(normalized)) return true;

  return Boolean(
    permissionMap?.can_manage_company_users ||
      permissionMap?.can_manage_users ||
      permissionMap?.can_view_all_company_data ||
      permissionMap?.can_view_analytics
  );
}

export function canMutateCompanyTrainingRequirements(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (isAdminLikeRole(role)) return true;

  const normalized = normalizeRole(role);
  if (
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager"
  ) {
    return true;
  }

  return Boolean(
    permissionMap?.can_manage_company_users || permissionMap?.can_manage_users
  );
}

export function canManageCompanyJsa(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (isAdminLikeRole(role)) return hasDocumentWorkspaceCapability(permissionMap);

  return (
    JSA_WORKSPACE_ROLES.has(normalizeRole(role)) &&
    hasDocumentWorkspaceCapability(permissionMap)
  );
}

export function canManageCompanyPermits(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (isAdminLikeRole(role)) return hasDocumentWorkspaceCapability(permissionMap);

  return (
    PERMIT_WORKSPACE_ROLES.has(normalizeRole(role)) &&
    hasDocumentWorkspaceCapability(permissionMap)
  );
}

export function canManageCompanyIncidents(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (isAdminLikeRole(role)) return hasDocumentWorkspaceCapability(permissionMap);

  return (
    INCIDENT_WORKSPACE_ROLES.has(normalizeRole(role)) &&
    hasDocumentWorkspaceCapability(permissionMap)
  );
}

export function canAccessCompanyJobsites(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (isAdminLikeRole(role)) return true;

  return (
    JOBSITE_WORKSPACE_ROLES.has(normalizeRole(role)) ||
    Boolean(permissionMap?.can_view_dashboards || permissionMap?.can_view_all_company_data)
  );
}

export function canAccessCompanyWorkspaceHref(
  href: string,
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  const normalizedHref = href.split("#")[0] ?? href;

  if (normalizedHref === "/training-matrix") {
    return canViewCompanyTrainingMatrix(role, permissionMap);
  }
  if (normalizedHref === "/jsa") {
    return canManageCompanyJsa(role, permissionMap);
  }
  if (normalizedHref === "/permits") {
    return canManageCompanyPermits(role, permissionMap);
  }
  if (normalizedHref === "/incidents") {
    return canManageCompanyIncidents(role, permissionMap);
  }
  if (normalizedHref === "/jobsites") {
    return canAccessCompanyJobsites(role, permissionMap);
  }
  if (normalizedHref === "/submit") {
    return canSubmitCompanyDocuments(permissionMap);
  }
  if (
    normalizedHref === "/upload" ||
    normalizedHref === "/peshep" ||
    normalizedHref === "/csep"
  ) {
    return canBuildCompanyDocuments(permissionMap);
  }
  if (normalizedHref === "/company-users") {
    return Boolean(permissionMap?.can_manage_company_users || permissionMap?.can_manage_users);
  }

  return true;
}
