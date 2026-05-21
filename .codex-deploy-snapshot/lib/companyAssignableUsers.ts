import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { formatAppRole } from "@/lib/rbac";

export type CompanyAssignableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type CompanyMembershipRow = {
  user_id: string;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type UserRoleRow = {
  user_id: string;
  role?: string | null;
  account_status?: string | null;
  created_at?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined) {
  return UUID_RE.test((value ?? "").trim());
}

function statusIsActive(status?: string | null) {
  const normalized = (status ?? "active").trim().toLowerCase();
  return !["pending", "suspended", "inactive", "disabled", "removed", "archived"].includes(normalized);
}

function displayName(user?: User | null) {
  const metadata = user?.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : "";
  if (fullName.trim()) return fullName.trim();
  if (user?.email) return user.email.split("@")[0] ?? user.email;
  return "";
}

async function authUsersById(userIds: string[]) {
  const admin = createSupabaseAdminClient();
  if (!admin || userIds.length === 0) return new Map<string, User>();

  const result = await admin.auth.admin.listUsers();
  if (result.error) return new Map<string, User>();

  const wanted = new Set(userIds);
  return new Map(
    (result.data.users ?? [])
      .filter((user) => wanted.has(user.id))
      .map((user) => [user.id, user] as const)
  );
}

export async function listCompanyAssignableUsers(params: {
  supabase: SupabaseClient;
  companyId: string;
}): Promise<CompanyAssignableUser[]> {
  const [membershipResult, roleResult] = await Promise.all([
    params.supabase
      .from("company_memberships")
      .select("user_id, role, status, created_at")
      .eq("company_id", params.companyId),
    params.supabase
      .from("user_roles")
      .select("user_id, role, account_status, created_at")
      .eq("company_id", params.companyId),
  ]);

  const byUserId = new Map<
    string,
    { id: string; role: string; status: string; createdAt: string | null }
  >();

  for (const row of ((membershipResult.data ?? []) as CompanyMembershipRow[])) {
    if (!isUuid(row.user_id) || !statusIsActive(row.status)) continue;
    byUserId.set(row.user_id, {
      id: row.user_id,
      role: row.role ?? "company_user",
      status: row.status ?? "active",
      createdAt: row.created_at ?? null,
    });
  }

  for (const row of ((roleResult.data ?? []) as UserRoleRow[])) {
    if (!isUuid(row.user_id) || !statusIsActive(row.account_status)) continue;
    if (byUserId.has(row.user_id)) continue;
    byUserId.set(row.user_id, {
      id: row.user_id,
      role: row.role ?? "company_user",
      status: row.account_status ?? "active",
      createdAt: row.created_at ?? null,
    });
  }

  const authUsers = await authUsersById([...byUserId.keys()]);
  return [...byUserId.values()]
    .map((row) => {
      const authUser = authUsers.get(row.id);
      return {
        id: row.id,
        name: displayName(authUser) || `User ${row.id.slice(0, 8)}`,
        email: authUser?.email ?? "",
        role: formatAppRole(row.role),
        status: row.status || "active",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function validateCompanyAssignableUserId(params: {
  supabase: SupabaseClient;
  companyId: string;
  assignedUserId?: string | null;
}): Promise<{ assignedUserId: string | null; error?: string }> {
  const assignedUserId = params.assignedUserId?.trim() ?? "";
  if (!assignedUserId) return { assignedUserId: null };

  if (!isUuid(assignedUserId)) {
    return {
      assignedUserId: null,
      error: "Assignee must be an active company user, not a tracked employee, invite, or free-text assignee.",
    };
  }

  const assignableUsers = await listCompanyAssignableUsers({
    supabase: params.supabase,
    companyId: params.companyId,
  });
  if (!assignableUsers.some((user) => user.id === assignedUserId)) {
    return {
      assignedUserId: null,
      error: "Assignee must be an active user in this company workspace.",
    };
  }

  return { assignedUserId };
}
