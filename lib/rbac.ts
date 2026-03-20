import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const APP_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "company_admin",
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
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];
export type PermissionMap = Record<AppPermission, boolean>;

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
  account_status: string | null;
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
    "can_access_internal_admin",
    "can_view_all_company_data",
  ],
  company_admin: [
    "can_create_documents",
    "can_edit_documents",
    "can_submit_documents",
    "can_manage_company_users",
    "can_manage_billing",
    "can_view_analytics",
    "can_assign_roles",
  ],
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
  if (normalized === "operations_manager") return "manager";
  if ((APP_ROLES as readonly string[]).includes(normalized)) {
    return normalized as AppRole;
  }

  return "viewer";
}

export function formatAppRole(role?: string | null) {
  const normalized = normalizeAppRole(role);

  if (normalized === "super_admin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  if (normalized === "manager") return "Operations Manager";
  if (normalized === "company_admin") return "Company Admin";
  if (normalized === "company_user") return "Company User";
  if (normalized === "editor") return "Editor";
  return "Viewer";
}

export function isAdminRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return normalized === "super_admin" || normalized === "admin";
}

export function isManagerRole(role?: string | null) {
  return normalizeAppRole(role) === "manager";
}

export function isCompanyRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return normalized === "company_admin" || normalized === "company_user";
}

export function isCompanyAdminRole(role?: string | null) {
  return normalizeAppRole(role) === "company_admin";
}

export function canManageCompanyUsers(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return normalized === "company_admin" || isAdminRole(normalized);
}

export function getRolePermissions(role?: string | null): AppPermission[] {
  return [...ROLE_PERMISSIONS[normalizeAppRole(role)]];
}

export function hasPermission(role: string | null | undefined, permission: AppPermission) {
  return ROLE_PERMISSIONS[normalizeAppRole(role)].includes(permission);
}

export function hasAnyPermission(
  role: string | null | undefined,
  permissions: readonly AppPermission[]
) {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function getPermissionMap(role?: string | null): PermissionMap {
  const permissions = new Set(getRolePermissions(role));
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

  if (getBootstrapAdminEmails().includes(normalizeEmail(user.email))) {
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
    .select("user_id, role, team, account_status")
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
  actorUserId?: string | null;
}) {
  const { supabase, userId, role, team, accountStatus, actorUserId } = params;

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
      account_status: accountStatus ?? "active",
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
    return {
      role: normalizeAppRole(roleRowResult.data.role),
      team: roleRowResult.data.team?.trim() || "General",
      accountStatus: normalizeAccountStatus(roleRowResult.data.account_status),
      source: "table" as const,
    };
  }

  const legacyRole = getLegacyRole(user);
  const legacyTeam = getLegacyTeam(user);
  const legacyAccountStatus = getLegacyAccountStatus(user);

  if (
    !roleRowResult.error &&
    (legacyRole !== "viewer" ||
      legacyTeam !== "General" ||
      legacyAccountStatus !== "active")
  ) {
    await upsertRoleRow({
      supabase,
      userId: user.id,
      role: legacyRole,
      team: legacyTeam,
      accountStatus: legacyAccountStatus,
      actorUserId: user.id,
    });
  }

  return {
    role: legacyRole,
    team: legacyTeam,
    accountStatus: legacyAccountStatus,
    source: roleRowResult.error ? ("legacy_missing_table" as const) : ("legacy" as const),
  };
}

export async function authorizeRequest(
  request: Request,
  options: AuthorizeOptions = {}
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
      supabase: authClient,
      user,
      role: roleContext.role,
      team: roleContext.team,
      accountStatus: roleContext.accountStatus,
      permissions: getRolePermissions(roleContext.role),
      permissionMap: getPermissionMap(roleContext.role),
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
    permissions: getRolePermissions(roleContext.role),
    permissionMap: getPermissionMap(roleContext.role),
  };
}
