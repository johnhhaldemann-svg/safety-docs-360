export const APP_PERMISSIONS = [
  "can_create_documents",
  "can_edit_documents",
  "can_submit_documents",
  "can_review_documents",
  "can_approve_documents",
  "can_manage_users",
  "can_manage_company_users",
  "can_manage_billing",
  "can_view_analytics",
  "can_assign_roles",
  "can_access_internal_admin",
  "can_view_all_company_data",
  "can_manage_global_templates",
  "can_override_system_controls",
  "can_manage_daps",
  "can_manage_observations",
  "can_verify_closures",
  "can_escalate_items",
  "can_view_dashboards",
  "can_view_reports",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];
export type PermissionOverrides = {
  allow: AppPermission[];
  deny: AppPermission[];
};

function isAppPermission(permission: string): permission is AppPermission {
  return (APP_PERMISSIONS as readonly string[]).includes(permission);
}

function toPermissionList(value: unknown): AppPermission[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<AppPermission>();

  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!isAppPermission(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
  }

  return [...seen];
}

export function normalizePermissionOverrides(
  overrides?: unknown | null
): PermissionOverrides {
  if (!overrides || typeof overrides !== "object") {
    return { allow: [], deny: [] };
  }

  const record = overrides as {
    allow?: unknown;
    deny?: unknown;
  };

  const allow = toPermissionList(record.allow);
  const allowSet = new Set(allow);
  const deny = toPermissionList(record.deny).filter((permission) => !allowSet.has(permission));

  return { allow, deny };
}

export function setPermissionOverride(
  overrides: PermissionOverrides,
  permission: AppPermission,
  mode: "inherit" | "allow" | "deny"
) {
  const normalized = normalizePermissionOverrides(overrides);
  const allow = new Set(normalized.allow);
  const deny = new Set(normalized.deny);

  allow.delete(permission);
  deny.delete(permission);

  if (mode === "allow") {
    allow.add(permission);
  } else if (mode === "deny") {
    deny.add(permission);
  }

  return {
    allow: [...allow],
    deny: [...deny],
  } satisfies PermissionOverrides;
}
