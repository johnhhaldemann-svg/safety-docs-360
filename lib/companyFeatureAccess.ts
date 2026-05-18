import type { AppPermission, PermissionMap } from "@/lib/rbac";

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

function hasFeatureAccess(
  permissionMap: PermissionMap | null | undefined,
  permission: AppPermission
) {
  if (!permissionMap) {
    return true;
  }

  return Boolean(permissionMap[permission] || permissionMap.can_view_all_company_data);
}

function hasAnyFeatureAccess(
  permissionMap: PermissionMap | null | undefined,
  permissions: readonly AppPermission[]
) {
  if (!permissionMap) {
    return true;
  }

  return Boolean(
    permissionMap.can_view_all_company_data ||
      permissions.some((permission) => permissionMap[permission])
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
  "project_manager",
  "field_supervisor",
  "foreman",
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

const FIELD_AUDIT_WORKSPACE_ROLES = new Set([
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
  "field_supervisor",
  "foreman",
  "field_user",
  "read_only",
  "company_user",
]);

const NON_COMPANY_INTERNAL_ROLES = new Set([
  "internal_reviewer",
  "employee",
  "editor",
  "viewer",
]);

function isSalesDemoRole(role: RoleInput) {
  return normalizeRole(role) === "sales_demo";
}

export function canViewCompanyTrainingMatrix(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (!hasFeatureAccess(permissionMap, "can_access_training")) return false;
  if (isAdminLikeRole(role)) return true;
  if (isSalesDemoRole(role)) return true;

  const normalized = normalizeRole(role);
  if (NON_COMPANY_INTERNAL_ROLES.has(normalized)) return false;
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
  if (!hasFeatureAccess(permissionMap, "can_access_training")) return false;
  if (isAdminLikeRole(role)) return true;
  if (isSalesDemoRole(role)) return true;

  const normalized = normalizeRole(role);
  if (NON_COMPANY_INTERNAL_ROLES.has(normalized)) return false;
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
  if (!hasFeatureAccess(permissionMap, "can_access_field_work")) return false;
  if (isAdminLikeRole(role)) return hasDocumentWorkspaceCapability(permissionMap);
  if (isSalesDemoRole(role)) return hasDocumentWorkspaceCapability(permissionMap);
  const normalized = normalizeRole(role);
  if (NON_COMPANY_INTERNAL_ROLES.has(normalized)) return false;

  return JSA_WORKSPACE_ROLES.has(normalized) && hasDocumentWorkspaceCapability(permissionMap);
}

export function canManageCompanyPermits(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (!hasFeatureAccess(permissionMap, "can_access_field_work")) return false;
  if (isAdminLikeRole(role)) return true;
  if (isSalesDemoRole(role)) return true;
  const normalized = normalizeRole(role);
  if (NON_COMPANY_INTERNAL_ROLES.has(normalized)) return false;

  return PERMIT_WORKSPACE_ROLES.has(normalized);
}

export function canManageCompanyIncidents(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (!hasFeatureAccess(permissionMap, "can_access_field_work")) return false;
  if (isAdminLikeRole(role)) return hasDocumentWorkspaceCapability(permissionMap);
  if (isSalesDemoRole(role)) return hasDocumentWorkspaceCapability(permissionMap);
  const normalized = normalizeRole(role);
  if (NON_COMPANY_INTERNAL_ROLES.has(normalized)) return false;

  return (
    INCIDENT_WORKSPACE_ROLES.has(normalized) &&
    hasDocumentWorkspaceCapability(permissionMap)
  );
}

export function canAccessCompanyJobsites(
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  if (!role) return false;
  if (!hasFeatureAccess(permissionMap, "can_access_jobsites")) return false;
  if (isAdminLikeRole(role)) return true;
  if (isSalesDemoRole(role)) return true;
  const normalized = normalizeRole(role);
  if (NON_COMPANY_INTERNAL_ROLES.has(normalized)) return false;

  return (
    JOBSITE_WORKSPACE_ROLES.has(normalized) ||
    Boolean(permissionMap?.can_view_dashboards || permissionMap?.can_view_all_company_data)
  );
}

export function canAccessCompanyWorkspaceHref(
  href: string,
  role: RoleInput,
  permissionMap?: PermissionMap | null
) {
  const normalizedHref = href.split("#")[0] ?? href;
  const pathOnly = normalizedHref.split("?")[0] ?? normalizedHref;
  const isMarketplaceTab = normalizedHref.includes("tab=marketplace");

  if (pathOnly === "/library") {
    if (isMarketplaceTab) {
      return hasFeatureAccess(permissionMap, "can_access_template_marketplace");
    }
    return hasFeatureAccess(permissionMap, "can_access_document_library");
  }
  if (pathOnly === "/search") {
    return hasFeatureAccess(permissionMap, "can_access_document_library");
  }
  if (pathOnly === "/purchases" || pathOnly === "/customer/billing") {
    return hasFeatureAccess(permissionMap, "can_access_billing");
  }
  if (pathOnly === "/marketplace-preview-approvals") {
    return hasFeatureAccess(permissionMap, "can_access_template_marketplace");
  }
  if (
    pathOnly === "/training-matrix" ||
    pathOnly === "/company-contractors" ||
    pathOnly === "/company-onboarding"
  ) {
    return canViewCompanyTrainingMatrix(role, permissionMap);
  }
  if (pathOnly === "/company-inductions") {
    return canViewCompanyTrainingMatrix(role, permissionMap);
  }
  if (pathOnly === "/company-safety-forms") {
    return hasFeatureAccess(permissionMap, "can_access_field_work");
  }
  if (pathOnly === "/jsa") {
    return canManageCompanyJsa(role, permissionMap);
  }
  if (pathOnly === "/permits") {
    return canManageCompanyPermits(role, permissionMap);
  }
  if (pathOnly === "/incidents") {
    return canManageCompanyIncidents(role, permissionMap);
  }
  if (pathOnly === "/field-id-exchange" || pathOnly === "/safety-submit") {
    return (
      hasFeatureAccess(permissionMap, "can_access_field_work") &&
      hasAnyFeatureAccess(permissionMap, [
        "can_manage_observations",
        "can_submit_documents",
        "can_view_dashboards",
      ])
    );
  }
  if (pathOnly === "/field-audits" || pathOnly === "/audit-customers") {
    const normalized = normalizeRole(role);
    return (
      hasFeatureAccess(permissionMap, "can_access_field_audits") &&
      (isAdminLikeRole(role) ||
        isSalesDemoRole(role) ||
        FIELD_AUDIT_WORKSPACE_ROLES.has(normalized) ||
        Boolean(permissionMap?.can_view_dashboards || permissionMap?.can_view_all_company_data))
    );
  }
  if (pathOnly === "/jobsites" || pathOnly === "/companies") {
    return canAccessCompanyJobsites(role, permissionMap);
  }
  if (
    pathOnly === "/safety-intelligence" ||
    pathOnly === "/analytics/safety-intelligence" ||
    pathOnly === "/safe-predict"
  ) {
    return hasFeatureAccess(permissionMap, "can_access_safety_intelligence");
  }
  if (pathOnly === "/settings/risk-memory") {
    return hasFeatureAccess(permissionMap, "can_access_safety_intelligence");
  }
  if (
    pathOnly === "/analytics" ||
    pathOnly === "/analytics/predictive-model" ||
    pathOnly === "/command-center" ||
    pathOnly === "/dashboard"
  ) {
    return hasAnyFeatureAccess(permissionMap, ["can_view_dashboards", "can_view_analytics"]);
  }
  if (pathOnly === "/reports") {
    return hasFeatureAccess(permissionMap, "can_view_reports");
  }
  if (pathOnly === "/submit") {
    return (
      hasFeatureAccess(permissionMap, "can_access_document_library") &&
      canSubmitCompanyDocuments(permissionMap)
    );
  }
  if (pathOnly === "/upload" || pathOnly === "/peshep" || pathOnly === "/csep") {
    return (
      hasFeatureAccess(permissionMap, "can_access_document_library") &&
      canBuildCompanyDocuments(permissionMap)
    );
  }
  if (pathOnly === "/company-users") {
    return Boolean(permissionMap?.can_manage_company_users || permissionMap?.can_manage_users);
  }
  if (pathOnly === "/company-integrations") {
    return Boolean(permissionMap?.can_manage_company_users || permissionMap?.can_manage_users);
  }

  return true;
}
