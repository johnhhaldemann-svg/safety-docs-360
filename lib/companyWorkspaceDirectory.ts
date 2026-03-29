import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAccountStatus,
  formatAppRole,
} from "@/lib/rbac";

type AuthLikeUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

type CompanyMembershipRow = {
  user_id: string;
  role: string | null;
  status: string | null;
  created_at?: string | null;
};

type FallbackUserRoleRow = {
  user_id: string;
  role: string;
  team: string | null;
  company_id?: string | null;
  account_status: string | null;
  created_at?: string | null;
};

export type CompanyDirectoryUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Unnamed User";
}

function getStatus(user: {
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}) {
  if (!user.email_confirmed_at) {
    return "Pending";
  }

  if (!user.last_sign_in_at) {
    return "Active";
  }

  const lastSeenMs = new Date(user.last_sign_in_at).getTime();
  const daysSinceSeen = (Date.now() - lastSeenMs) / (1000 * 60 * 60 * 24);

  return daysSinceSeen > 30 ? "Inactive" : "Active";
}

/**
 * Lists workspace users for a company using the service-role client (same sources as /api/company/users).
 */
export async function loadCompanyWorkspaceUsers(params: {
  adminClient: SupabaseClient;
  authUser: AuthLikeUser;
  companyId: string;
  scopeTeam: string;
}): Promise<{ users: CompanyDirectoryUser[]; error?: string }> {
  const { adminClient, authUser, companyId, scopeTeam } = params;

  const { data, error } = await adminClient.auth.admin.listUsers();

  if (error) {
    return { users: [], error: error.message };
  }

  const membershipMap = new Map<string, CompanyMembershipRow>();
  const { data: membershipData } = await adminClient
    .from("company_memberships")
    .select("user_id, role, status")
    .eq("company_id", companyId);

  for (const row of (membershipData ?? []) as CompanyMembershipRow[]) {
    membershipMap.set(row.user_id, row);
  }

  const roleRowMap = new Map<string, FallbackUserRoleRow>();
  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("user_id, role, team, company_id, account_status, created_at")
    .eq("company_id", companyId);

  for (const row of (roleRows ?? []) as FallbackUserRoleRow[]) {
    roleRowMap.set(row.user_id, row);
  }

  const authUserMap = new Map((data.users ?? []).map((user) => [user.id, user] as const));

  const scopedUserIds = new Set<string>([...membershipMap.keys(), ...roleRowMap.keys()]);
  scopedUserIds.add(authUser.id);

  const users = Array.from(scopedUserIds)
    .map((userId) => {
      const user = authUserMap.get(userId);
      const membership = membershipMap.get(userId);
      const scopedRoleRow = roleRowMap.get(userId);

      const resolvedRole = membership?.role ?? scopedRoleRow?.role ?? "company_user";
      const resolvedStatus =
        membership?.status ?? scopedRoleRow?.account_status ?? "pending";
      const resolvedTeam = scopedRoleRow?.team?.trim() || scopeTeam;

      return {
        id: userId,
        email: user?.email ?? (userId === authUser.id ? authUser.email ?? "" : ""),
        name: user
          ? getDisplayName(user)
          : userId === authUser.id
            ? getDisplayName(authUser)
            : `User ${userId.slice(0, 8)}`,
        role: formatAppRole(resolvedRole),
        team: resolvedTeam,
        status:
          resolvedStatus === "pending" || resolvedStatus === "suspended"
            ? formatAccountStatus(resolvedStatus)
            : user
              ? getStatus(user)
              : "Active",
        created_at: user?.created_at ?? membership?.created_at ?? scopedRoleRow?.created_at ?? null,
        last_sign_in_at: user?.last_sign_in_at ?? null,
      } satisfies CompanyDirectoryUser;
    })
    .filter((user) => membershipMap.has(user.id) || roleRowMap.has(user.id));

  return { users };
}
