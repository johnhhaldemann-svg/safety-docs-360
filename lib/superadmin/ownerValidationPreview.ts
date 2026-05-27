import {
  type AppPermission,
  type AppRole,
  formatAppRole,
  getPermissionMap,
} from "@/lib/rbac";
import {
  SAFETY360_TEST_COMPANY_KEY,
  SAFETY360_TEST_COMPANY_NAME,
} from "@/lib/superadmin/ownerValidationSandbox";

export type OwnerValidationPreviewActionKey =
  | "view_dashboard"
  | "create_jsa"
  | "sign_jsa"
  | "create_permit"
  | "approve_permit"
  | "view_training"
  | "edit_training"
  | "create_observation"
  | "create_incident"
  | "view_documents"
  | "export_documents"
  | "manage_users"
  | "access_billing_settings"
  | "access_owner_validation_console";

export type OwnerValidationPreviewPermission = {
  key: OwnerValidationPreviewActionKey;
  label: string;
  allowed: boolean;
  explanation: string;
};

export type OwnerValidationPreviewRole = {
  id: string;
  label: string;
  appRole: AppRole;
  banner: string;
  sandboxCompanyName: string;
  sandboxKey: string;
  permissions: OwnerValidationPreviewPermission[];
  plainEnglishSummary: string;
};

type PreviewRoleDefinition = {
  id: string;
  label: string;
  appRole: AppRole;
};

const PREVIEW_ROLES: PreviewRoleDefinition[] = [
  { id: "company_admin", label: "Company Admin", appRole: "company_admin" },
  { id: "safety_manager", label: "Safety Manager", appRole: "safety_manager" },
  { id: "foreman", label: "Foreman", appRole: "foreman" },
  { id: "employee", label: "Employee", appRole: "field_user" },
  { id: "client_viewer", label: "Client Viewer", appRole: "read_only" },
  { id: "auditor", label: "Auditor", appRole: "internal_reviewer" },
];

const ACTION_LABELS: Array<{ key: OwnerValidationPreviewActionKey; label: string }> = [
  { key: "view_dashboard", label: "View dashboard" },
  { key: "create_jsa", label: "Create JSA" },
  { key: "sign_jsa", label: "Sign JSA" },
  { key: "create_permit", label: "Create permit" },
  { key: "approve_permit", label: "Approve permit" },
  { key: "view_training", label: "View training" },
  { key: "edit_training", label: "Edit training" },
  { key: "create_observation", label: "Create observation" },
  { key: "create_incident", label: "Create incident" },
  { key: "view_documents", label: "View documents" },
  { key: "export_documents", label: "Export documents" },
  { key: "manage_users", label: "Manage users" },
  { key: "access_billing_settings", label: "Access billing/settings" },
  { key: "access_owner_validation_console", label: "Access Owner Validation Console" },
];

function hasAny(permissionMap: Record<AppPermission, boolean>, permissions: AppPermission[]) {
  return permissions.some((permission) => permissionMap[permission]);
}

function isCompanyOperator(role: AppRole) {
  return role === "company_admin" || role === "safety_manager" || role === "foreman";
}

function isSafetyLeader(role: AppRole) {
  return role === "company_admin" || role === "safety_manager";
}

function actionAllowed(
  action: OwnerValidationPreviewActionKey,
  role: AppRole,
  permissionMap: Record<AppPermission, boolean>
) {
  switch (action) {
    case "view_dashboard":
      return permissionMap.can_view_dashboards;
    case "create_jsa":
      return permissionMap.can_create_documents && isCompanyOperator(role);
    case "sign_jsa":
      return permissionMap.can_submit_documents || role === "field_user";
    case "create_permit":
      return permissionMap.can_create_documents && hasAny(permissionMap, ["can_access_field_work", "can_access_jobsites"]);
    case "approve_permit":
      return permissionMap.can_approve_documents || permissionMap.can_verify_closures;
    case "view_training":
      return permissionMap.can_access_training || isSafetyLeader(role);
    case "edit_training":
      return isSafetyLeader(role);
    case "create_observation":
      return permissionMap.can_manage_observations;
    case "create_incident":
      return hasAny(permissionMap, ["can_manage_daps", "can_escalate_items", "can_manage_observations"]);
    case "view_documents":
      return permissionMap.can_access_document_library;
    case "export_documents":
      return permissionMap.can_access_document_library && hasAny(permissionMap, ["can_view_reports", "can_submit_documents", "can_review_documents"]);
    case "manage_users":
      return permissionMap.can_manage_company_users || permissionMap.can_manage_users;
    case "access_billing_settings":
      return permissionMap.can_access_billing || permissionMap.can_manage_billing;
    case "access_owner_validation_console":
      return false;
  }
}

function explain(action: OwnerValidationPreviewActionKey, allowed: boolean, label: string, roleLabel: string) {
  if (action === "access_owner_validation_console") {
    return "Blocked by design. Only Super Admin can open the Owner Validation Console.";
  }

  if (allowed) {
    return `${label} is allowed for ${roleLabel} in this preview.`;
  }

  return `${label} is not allowed for ${roleLabel} in this preview.`;
}

function buildRoleSummary(role: AppRole, allowedCount: number) {
  if (role === "read_only") {
    return "Client Viewer is limited to read-only review and should not create or approve safety records.";
  }
  if (role === "internal_reviewer") {
    return "Auditor can review documents, but should not manage users or access owner-only validation tools.";
  }
  if (role === "field_user") {
    return "Employee can complete field-facing work, but should not manage users, billing, or owner-only validation tools.";
  }
  return `${formatAppRole(role)} has ${allowedCount} preview permissions enabled for sandbox review.`;
}

export function buildOwnerValidationPreviewRoles(): OwnerValidationPreviewRole[] {
  return PREVIEW_ROLES.map((definition) => {
    const permissionMap = getPermissionMap(definition.appRole);
    const permissions = ACTION_LABELS.map((action) => {
      const allowed = actionAllowed(action.key, definition.appRole, permissionMap);
      return {
        ...action,
        allowed,
        explanation: explain(action.key, allowed, action.label, definition.label),
      };
    });

    const allowedCount = permissions.filter((permission) => permission.allowed).length;

    return {
      id: definition.id,
      label: definition.label,
      appRole: definition.appRole,
      banner: `Preview Mode — You are viewing as ${definition.label}.`,
      sandboxCompanyName: SAFETY360_TEST_COMPANY_NAME,
      sandboxKey: SAFETY360_TEST_COMPANY_KEY,
      permissions,
      plainEnglishSummary: buildRoleSummary(definition.appRole, allowedCount),
    };
  });
}
