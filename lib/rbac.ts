import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "@/lib/supabaseAdmin";

export const APP_ROLES = [
  "platform_admin",
  "internal_reviewer",
  "employee",
  "super_admin",
  "admin",
  "manager",
  "company_admin",
  "safety_manager",
  "project_manager",
  "foreman",
  "field_user",
  "read_only",
  "company_user",
  "editor",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type AccountStatus = "pending" | "active" | "suspended";
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
export type PermissionMap = Record<AppPermission, boolean>;
export type PermissionOverrides = {
  allow: AppPermission[];
  deny: AppPermission[];
};

type AuthLikeUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type RoleRow = {
  user_id: string;
  role: string;
  team: string | null;
  company_id: string | null;
  account_status: string | null;
  permission_overrides: unknown;
};

type MessageError = { message?: string | null };
type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

type AuthorizeOptions = {
  requireAdmin?: boolean;
  allowSuspended?: boolean;
  allowPending?: boolean;
  requirePermission?: AppPermission;
  requireAnyPermission?: AppPermission[];
};

const DEFAULT_BOOTSTRAP_ADMIN_EMAILS = ["john.h.haldemann@gmail.com"];
const ROLE_PERMISSIONS: Record<AppRole, readonly AppPermission[]> = {
  platform_admin: APP_PERMISSIONS,
  internal_reviewer: [
    "can_review_documents",
    "can_approve_documents",
    "can_view_dashboards",
    "can_view_reports",
  ],
  employee: ["can_create_documents", "can_edit_documents", "can_submit_documents"],
  super_admin: APP_PERMISSIONS,
  admin: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
    "can_review_documents",
    "can_approve_documents",
    "can_manage_users",
    "can_assign_roles",
    "can_view_analytics",
    "can_access_internal_admin",
    "can_view_all_company_data",
    "can_manage_global_templates",
  ],
  manager: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
    "can_review_documents",
    "can_approve_documents",
    "can_view_analytics",
    "can_manage_daps",
    "can_manage_observations",
    "can_verify_closures",
    "can_escalate_items",
    "can_view_dashboards",
    "can_view_reports",
  ],
  company_admin: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
    "can_manage_company_users",
    "can_manage_billing",
    "can_view_analytics",
    "can_assign_roles",
    "can_manage_daps",
    "can_manage_observations",
    "can_verify_closures",
    "can_escalate_items",
    "can_view_dashboards",
    "can_view_reports",
  ],
  safety_manager: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
    "can_view_analytics",
    "can_manage_daps",
    "can_manage_observations",
    "can_verify_closures",
    "can_escalate_items",
    "can_view_dashboards",
    "can_view_reports",
  ],
  project_manager: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
    "can_manage_daps",
    "can_manage_observations",
    "can_view_dashboards",
    "can_view_reports",
  ],
  foreman: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
    "can_manage_daps",
    "can_manage_observations",
    "can_view_dashboards",
    "can_view_reports",
  ],
  field_user: [
    "can_submit_documents",
    "can_manage_observations",
    "can_view_dashboards",
    "can_view_reports",
  ],
  read_only: ["can_view_dashboards", "can_view_reports"],
  company_user: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
  ],
  editor: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
  ],
  viewer: [],
};

function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

function isBootstrapAdminUser(user: AuthLikeUser) {
  return getBootstrapAdminEmails().includes(normalizeEmail(user.email));
}

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

function applyPermissionOverridesToSet(
  permissionSet: Set<AppPermission>,
  overrides?: PermissionOverrides | null
) {
  const normalized = normalizePermissionOverrides(overrides);

  for (const permission of normalized.deny) {
    permissionSet.delete(permission);
  }

  for (const permission of normalized.allow) {
    permissionSet.add(permission);
  }
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

export function getBootstrapAdminEmails() {
  const configured = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_BOOTSTRAP_ADMIN_EMAILS;
}

export function normalizeAppRole(role?: string | null): AppRole {
  const normalized = (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (normalized === "superadmin") return "super_admin";
  if (normalized === "platformadmin") return "platform_admin";
  if (normalized === "internal_reviewer_employee") return "internal_reviewer";
  if (normalized === "operations_manager") return "manager";
  if (normalized === "safety_director") return "safety_manager";
  if (normalized === "safety_manager") return "safety_manager";
  if (normalized === "safety_director_safety_manager") return "safety_manager";
  if (normalized === "superintendent") return "project_manager";
  if (normalized === "project_manager") return "project_manager";
  if (normalized === "superintendent_project_manager") return "project_manager";
  if (normalized === "field_user_observer") return "field_user";
  if (normalized === "observer") return "field_user";
  if (normalized === "read_only_client") return "read_only";
  if ((APP_ROLES as readonly string[]).includes(normalized)) {
    return normalized as AppRole;
  }

  return "viewer";
}

export function formatAppRole(role?: string | null) {
  const normalized = normalizeAppRole(role);

  if (normalized === "platform_admin") return "Platform Admin";
  if (normalized === "internal_reviewer") return "Internal Reviewer";
  if (normalized === "employee") return "Employee";
  if (normalized === "super_admin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  if (normalized === "manager") return "Operations Manager";
  if (normalized === "company_admin") return "Company Admin";
  if (normalized === "safety_manager") return "Safety Manager";
  if (normalized === "project_manager") return "Project Manager";
  if (normalized === "foreman") return "Foreman";
  if (normalized === "field_user") return "Field User";
  if (normalized === "read_only") return "Read Only";
  if (normalized === "company_user") return "Company User";
  if (normalized === "editor") return "Editor";
  return "Viewer";
}

export function isAdminRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    normalized === "platform_admin" ||
    normalized === "super_admin" ||
    normalized === "admin"
  );
}

/** Full user directory across workspaces + assign users to a specific company (super / platform admin). */
export function isCrossWorkspaceAdminRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return normalized === "super_admin" || normalized === "platform_admin";
}

export function isManagerRole(role?: string | null) {
  return normalizeAppRole(role) === "manager";
}

export function isCompanyRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    normalized === "company_admin" ||
    normalized === "safety_manager" ||
    normalized === "project_manager" ||
    normalized === "foreman" ||
    normalized === "field_user" ||
    normalized === "read_only" ||
    normalized === "manager" ||
    normalized === "company_user"
  );
}

export function isCompanyAdminRole(role?: string | null) {
  return normalizeAppRole(role) === "company_admin";
}

/**
 * Roles that can see every non-archived document for their company (drafts, in review,
 * submitted). Keeps the library list and `/api/library/workspace-excerpt` in sync.
 * (E.g. Superintendent → project_manager must match company_admin, not only “approved”.)
 */
export function isCompanyWorkspaceOversightRole(role?: string | null) {
  const r = normalizeAppRole(role);
  return (
    r === "company_admin" ||
    r === "manager" ||
    r === "project_manager" ||
    r === "safety_manager" ||
    r === "foreman"
  );
}

export function canManageCompanyUsers(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return normalized === "company_admin" || isAdminRole(normalized);
}

export function getRolePermissions(role?: string | null): AppPermission[] {
  return [...ROLE_PERMISSIONS[normalizeAppRole(role)]];
}

export function hasPermission(
  role: string | null | undefined,
  permission: AppPermission,
  companyOverrides?: PermissionOverrides | null,
  userOverrides?: PermissionOverrides | null
) {
  return getPermissionMap(role, companyOverrides, userOverrides)[permission];
}

export function hasAnyPermission(
  role: string | null | undefined,
  permissions: readonly AppPermission[],
  companyOverrides?: PermissionOverrides | null,
  userOverrides?: PermissionOverrides | null
) {
  const permissionMap = getPermissionMap(role, companyOverrides, userOverrides);
  return permissions.some((permission) => permissionMap[permission]);
}

export function getPermissionMap(
  role?: string | null,
  companyOverrides?: PermissionOverrides | null,
  userOverrides?: PermissionOverrides | null
): PermissionMap {
  const normalizedRole = normalizeAppRole(role);
  const permissions = new Set(getRolePermissions(normalizedRole));

  if (normalizedRole !== "super_admin" && normalizedRole !== "platform_admin") {
    applyPermissionOverridesToSet(permissions, companyOverrides);
    applyPermissionOverridesToSet(permissions, userOverrides);
  }

  return APP_PERMISSIONS.reduce((acc, permission) => {
    acc[permission] = permissions.has(permission);
    return acc;
  }, {} as PermissionMap);
}

export function normalizeAccountStatus(status?: string | null): AccountStatus {
  const normalized = (status ?? "").trim().toLowerCase();

  if (normalized === "suspended") return "suspended";
  if (normalized === "pending") return "pending";
  return "active";
}

export function formatAccountStatus(status?: string | null) {
  const normalized = normalizeAccountStatus(status);

  if (normalized === "pending") return "Pending";
  if (normalized === "suspended") return "Suspended";
  return "Active";
}

function getLegacyAccountStatus(user: AuthLikeUser): AccountStatus {
  const metadataStatus =
    typeof user.app_metadata?.account_status === "string"
      ? user.app_metadata.account_status
      : typeof user.user_metadata?.account_status === "string"
        ? user.user_metadata.account_status
        : "";

  return normalizeAccountStatus(metadataStatus);
}

function getLegacyRole(user: AuthLikeUser): AppRole {
  const metadataRole =
    typeof user.app_metadata?.role === "string"
      ? user.app_metadata.role
      : typeof user.user_metadata?.role === "string"
        ? user.user_metadata.role
        : "";

  const normalizedRole = normalizeAppRole(metadataRole);

  if (metadataRole.trim()) {
    return normalizedRole;
  }

  if (isBootstrapAdminUser(user)) {
    return "super_admin";
  }

  return "viewer";
}

function getLegacyTeam(user: AuthLikeUser) {
  const metadataTeam =
    typeof user.app_metadata?.team === "string"
      ? user.app_metadata.team
      : typeof user.user_metadata?.team === "string"
        ? user.user_metadata.team
        : "";

  return metadataTeam.trim() || "General";
}

function getLegacyCompanyId(user: AuthLikeUser) {
  const metadataCompanyId =
    typeof user.app_metadata?.company_id === "string"
      ? user.app_metadata.company_id
      : typeof user.user_metadata?.company_id === "string"
        ? user.user_metadata.company_id
        : "";

  return metadataCompanyId.trim() || null;
}

async function getRoleRow(
  supabase: SupabaseLikeClient,
  userId: string
) {
  const { data, error } = await (
    supabase.from("user_roles") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: MessageError | null }>;
        };
      };
    }
  )
    .select("user_id, role, team, company_id, account_status, permission_overrides")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error,
    };
  }

  return {
    data: (data as RoleRow | null) ?? null,
    error: null,
  };
}

async function upsertRoleRow(params: {
  supabase: SupabaseLikeClient;
  userId: string;
  role: AppRole;
  team: string;
  accountStatus?: AccountStatus;
  companyId?: string | null;
  permissionOverrides?: PermissionOverrides | null;
  actorUserId?: string | null;
}) {
  const {
    supabase,
    userId,
    role,
    team,
    accountStatus,
    companyId,
    permissionOverrides,
    actorUserId,
  } = params;

  return (supabase.from("user_roles") as unknown as {
    upsert: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => PromiseLike<{ error: MessageError | null }>;
  }).upsert(
    {
      user_id: userId,
      role,
      team,
      company_id: companyId ?? null,
      account_status: accountStatus ?? "active",
      permission_overrides: normalizePermissionOverrides(permissionOverrides),
      created_by: actorUserId ?? null,
      updated_by: actorUserId ?? null,
    },
    {
      onConflict: "user_id",
    }
  );
}

export async function getUserRoleContext(params: {
  supabase: SupabaseLikeClient;
  user: AuthLikeUser;
}) {
  const { supabase, user } = params;
  const roleRowResult = await getRoleRow(supabase, user.id);

  if (roleRowResult.data) {
    if (isBootstrapAdminUser(user)) {
      if (
        normalizeAppRole(roleRowResult.data.role) !== "super_admin" ||
        normalizeAccountStatus(roleRowResult.data.account_status) !== "active"
      ) {
        await upsertRoleRow({
          supabase,
          userId: user.id,
          role: "super_admin",
          team: "Internal Admin",
          accountStatus: "active",
          companyId: null,
          actorUserId: user.id,
        });
      }

      const permissions = getPermissionMap("super_admin");
      return {
        role: "super_admin" as const,
        team: "Internal Admin",
        accountStatus: "active" as const,
        companyId: null as string | null,
        companyPermissionOverrides: null as PermissionOverrides | null,
        permissionOverrides: null as PermissionOverrides | null,
        permissions: APP_PERMISSIONS.filter((permission) => permissions[permission]),
        permissionMap: permissions,
        source: "bootstrap_admin_override" as const,
      };
    }

    const companyId = roleRowResult.data.company_id?.trim() || getLegacyCompanyId(user);
    let companyPermissionOverrides: PermissionOverrides | null = null;

    if (companyId) {
      const companyRow = await (
        supabase.from("companies") as {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => PromiseLike<{ data: unknown; error: MessageError | null }>;
            };
          };
        }
      )
        .select("permission_overrides")
        .eq("id", companyId)
        .maybeSingle();

      if (!companyRow.error) {
        const companyRecord = companyRow.data as { permission_overrides?: unknown } | null;
        companyPermissionOverrides = normalizePermissionOverrides(
          companyRecord?.permission_overrides ?? null
        );
      }
    }

    const permissionOverrides = normalizePermissionOverrides(roleRowResult.data.permission_overrides);
    const permissionMap = getPermissionMap(
      normalizeAppRole(roleRowResult.data.role),
      companyPermissionOverrides,
      permissionOverrides
    );

    return {
      role: normalizeAppRole(roleRowResult.data.role),
      team: roleRowResult.data.team?.trim() || "General",
      accountStatus: normalizeAccountStatus(roleRowResult.data.account_status),
      companyId,
      companyPermissionOverrides,
      permissionOverrides,
      permissions: APP_PERMISSIONS.filter((permission) => permissionMap[permission]),
      permissionMap,
      source: "table" as const,
    };
  }

  const legacyRole = getLegacyRole(user);
  const legacyTeam = getLegacyTeam(user);
  const legacyAccountStatus = getLegacyAccountStatus(user);
  const legacyCompanyId = getLegacyCompanyId(user);
  let companyPermissionOverrides: PermissionOverrides | null = null;

  if (legacyCompanyId) {
    const companyRow = await (
      supabase.from("companies") as {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => PromiseLike<{ data: unknown; error: MessageError | null }>;
          };
        };
      }
    )
      .select("permission_overrides")
      .eq("id", legacyCompanyId)
      .maybeSingle();

    if (!companyRow.error) {
      const companyRecord = companyRow.data as { permission_overrides?: unknown } | null;
      companyPermissionOverrides = normalizePermissionOverrides(
        companyRecord?.permission_overrides ?? null
      );
    }
  }

  if (
    !roleRowResult.error &&
    (legacyRole !== "viewer" ||
      legacyTeam !== "General" ||
      legacyAccountStatus !== "active" ||
      Boolean(legacyCompanyId))
  ) {
    await upsertRoleRow({
      supabase,
      userId: user.id,
      role: legacyRole,
      team: legacyTeam,
      accountStatus: legacyAccountStatus,
      companyId: legacyCompanyId,
      actorUserId: user.id,
    });
  }

  const permissionMap = getPermissionMap(legacyRole, companyPermissionOverrides, null);

  return {
    role: legacyRole,
    team: legacyTeam,
    accountStatus: legacyAccountStatus,
    companyId: legacyCompanyId,
    companyPermissionOverrides,
    permissionOverrides: null as PermissionOverrides | null,
    permissions: APP_PERMISSIONS.filter((permission) => permissionMap[permission]),
    permissionMap,
    source: roleRowResult.error ? ("legacy_missing_table" as const) : ("legacy" as const),
  };
}

export async function authorizeRequest(
  request: Request,
  options: AuthorizeOptions = {}
) {
  const supabaseUrl = getSupabaseServerUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  const supabaseServiceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: NextResponse.json(
        {
          error: "Missing Supabase environment variables.",
          missing: {
            NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: !supabaseAnonKey,
            SUPABASE_SERVICE_ROLE_KEY: !supabaseServiceRoleKey,
          },
        },
        { status: 500 }
      ),
    };
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return {
      error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid auth token." }, { status: 401 }),
    };
  }

  if (!supabaseServiceRoleKey) {
    const roleContext = await getUserRoleContext({
      supabase: authClient as unknown as SupabaseLikeClient,
      user,
    });

    if (!options.allowPending && roleContext.accountStatus === "pending") {
      return {
        error: NextResponse.json(
          { error: "Your account is pending administrator approval." },
          { status: 403 }
        ),
      };
    }

    if (!options.allowSuspended && roleContext.accountStatus === "suspended") {
      return {
        error: NextResponse.json(
          { error: "Your account has been suspended." },
          { status: 403 }
        ),
      };
    }

    if (options.requireAdmin && !isAdminRole(roleContext.role)) {
      return {
        error: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
      };
    }

    if (
      options.requirePermission &&
      !hasPermission(
        roleContext.role,
        options.requirePermission,
        roleContext.companyPermissionOverrides,
        roleContext.permissionOverrides
      )
    ) {
      return {
        error: NextResponse.json(
          { error: "You do not have permission for this action." },
          { status: 403 }
        ),
      };
    }

    if (
      options.requireAnyPermission &&
      !hasAnyPermission(
        roleContext.role,
        options.requireAnyPermission,
        roleContext.companyPermissionOverrides,
        roleContext.permissionOverrides
      )
    ) {
      return {
        error: NextResponse.json(
          { error: "You do not have permission for this action." },
          { status: 403 }
        ),
      };
    }

    return {
      supabase: authClient,
      user,
      role: roleContext.role,
      team: roleContext.team,
      accountStatus: roleContext.accountStatus,
      permissions: roleContext.permissions,
      permissionMap: roleContext.permissionMap,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const roleContext = await getUserRoleContext({
    supabase,
    user,
  });

  if (!options.allowPending && roleContext.accountStatus === "pending") {
    return {
      error: NextResponse.json(
        { error: "Your account is pending administrator approval." },
        { status: 403 }
      ),
    };
  }

  if (!options.allowSuspended && roleContext.accountStatus === "suspended") {
    return {
      error: NextResponse.json(
        { error: "Your account has been suspended." },
        { status: 403 }
      ),
    };
  }

  if (options.requireAdmin && !isAdminRole(roleContext.role)) {
    return {
      error: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  if (
    options.requirePermission &&
    !hasPermission(roleContext.role, options.requirePermission)
  ) {
    return {
      error: NextResponse.json(
        { error: "You do not have permission for this action." },
        { status: 403 }
      ),
    };
  }

  if (
    options.requireAnyPermission &&
    !hasAnyPermission(roleContext.role, options.requireAnyPermission)
  ) {
    return {
      error: NextResponse.json(
        { error: "You do not have permission for this action." },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
    user,
    role: roleContext.role,
    team: roleContext.team,
    accountStatus: roleContext.accountStatus,
    permissions: roleContext.permissions,
    permissionMap: roleContext.permissionMap,
  };
}
