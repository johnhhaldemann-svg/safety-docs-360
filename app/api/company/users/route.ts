import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { assertCompanyInviteAllowed } from "@/lib/companySeats";
import { ensureCompanyScope, getCompanyScope } from "@/lib/companyScope";
import { sendCompanyInviteEmail } from "@/lib/inviteEmail";
import {
  createSupabaseAdminClient,
  getSupabaseServerEnvStatus,
} from "@/lib/supabaseAdmin";
import {
  authorizeRequest,
  formatAccountStatus,
  formatAppRole,
  isCompanyAdminRole,
  isCompanyRole,
  normalizeAccountStatus,
  normalizeAppRole,
  type AppRole,
} from "@/lib/rbac";

export const runtime = "nodejs";

type InvitePayload = {
  email?: string;
  role?: string;
  accountStatus?: string;
};

type CompanyInviteRow = {
  id: string;
  email: string;
  role: string;
  team: string;
  company_id: string;
  account_status: string;
  created_at?: string | null;
};

async function saveCompanyInviteViaRpc(params: {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
  };
  email: string;
  role: string;
  team: string;
  companyId: string;
  accountStatus: string;
}) {
  const rpcResult = await params.supabase.rpc("upsert_company_invite", {
    invite_email: params.email,
    invite_role: params.role,
    invite_team: params.team,
    invite_company_id: params.companyId,
    invite_account_status: params.accountStatus,
  });

  const rpcInvite = ((rpcResult.data as CompanyInviteRow[] | null) ?? [])[0] ?? null;

  return {
    data: rpcInvite,
    error: rpcResult.error,
  };
}

async function saveCompanyInvite(params: {
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            is: (column: string, value: null) => {
              maybeSingle: () => Promise<{ data: unknown; error: { message?: string | null } | null }>;
            };
          };
        };
      };
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: { message?: string | null } | null }>;
      };
      insert: (values: Record<string, unknown>) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown; error: { message?: string | null } | null }>;
        };
      };
    };
  };
  email: string;
  role: string;
  team: string;
  companyId: string;
  accountStatus: string;
  actorUserId: string;
}) {
  const { supabase, email, role, team, companyId, accountStatus, actorUserId } = params;

  const existingInviteResult = await supabase
    .from("company_invites")
    .select("id, email, role, team, company_id, account_status")
    .eq("email", email)
    .eq("company_id", companyId)
    .is("consumed_at", null)
    .maybeSingle();

  if (existingInviteResult.data && typeof existingInviteResult.data === "object") {
    const updateResult = await supabase
      .from("company_invites")
      .update({
        role,
        team,
        account_status: accountStatus,
        updated_by: actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (existingInviteResult.data as { id: string }).id);

    if (updateResult.error) {
      return { data: null, error: updateResult.error };
    }

    return {
      data: {
        ...(existingInviteResult.data as CompanyInviteRow),
        role,
        team,
        company_id: companyId,
        account_status: accountStatus,
      } satisfies CompanyInviteRow,
      error: null,
    };
  }

  const insertResult = await supabase
    .from("company_invites")
    .insert({
      email,
      role,
      team,
      company_id: companyId,
      account_status: accountStatus,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select("id, email, role, team, company_id, account_status")
    .single();

  return {
    data: (insertResult.data as CompanyInviteRow | null) ?? null,
    error: insertResult.error,
  };
}

type CompanyUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
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

const COMPANY_ASSIGNABLE_ROLES: AppRole[] = [
  "company_admin",
  "manager",
  "safety_manager",
  "project_manager",
  "foreman",
  "field_user",
  "read_only",
  "company_user",
];

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

function getActorName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  return getDisplayName(user);
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

function getCompanySafeRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  if (!COMPANY_ASSIGNABLE_ROLES.includes(normalized)) {
    return "company_user";
  }
  return normalized;
}

function formatRoleConstraintError(message?: string | null) {
  if ((message ?? "").includes("company_invites_role_check")) {
    return "The database invite role constraint has not been updated yet. Run the latest Supabase migration to allow Operations Manager in company invites.";
  }

  if ((message ?? "").includes("user_roles_role_check")) {
    return "The database role constraint has not been updated yet. Run the latest Supabase migration to allow the current company-scoped roles.";
  }

  return message || "Company user action failed.";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_manage_users",
      "can_view_analytics",
      "can_manage_daps",
      "can_create_documents",
      "can_view_dashboards",
    ],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient();
  const envStatus = getSupabaseServerEnvStatus();
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const scopeTeam = companyScope.companyName?.trim() || auth.team || "General";

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      {
        error: "This company account is not linked to a company workspace yet.",
      },
      { status: 400 }
    );
  }

  if (!adminClient) {
    const query = auth.supabase
      .from("user_roles")
      .select("user_id, role, team, account_status, created_at")
      .order("created_at", { ascending: false });

    const scopedQuery =
      isCompanyRole(auth.role) && companyScope.companyId
        ? query.eq("company_id", companyScope.companyId)
        : isCompanyRole(auth.role)
          ? query.eq("team", scopeTeam)
          : query;
    const { data, error } = await scopedQuery;

    if (error) {
      return NextResponse.json(
        {
          error: "Missing Supabase service role configuration.",
          details: envStatus,
        },
        { status: 500 }
      );
    }

    const users = ((data as FallbackUserRoleRow[] | null) ?? []).map((row) => {
      const isCurrentUser = row.user_id === auth.user.id;
      return {
        id: row.user_id,
        email: isCurrentUser ? auth.user.email ?? "" : "",
        name: isCurrentUser ? getDisplayName(auth.user) : `User ${row.user_id.slice(0, 8)}`,
        role: formatAppRole(row.role),
        team: row.team?.trim() || "General",
        status: formatAccountStatus(row.account_status),
        created_at: row.created_at ?? null,
        last_sign_in_at: null,
      };
    });

    return NextResponse.json({
      users,
      invites: [],
      scopeTeam,
      scopeCompanyId: companyScope.companyId,
      scopeCompanyName: companyScope.companyName,
      viewerRole: auth.role,
      warning:
        "Showing RBAC directory fallback because the Supabase service role key is unavailable at runtime.",
    });
  }

  const { data, error } = await adminClient.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const membershipMap = new Map<string, CompanyMembershipRow>();
  const roleRowMap = new Map<string, FallbackUserRoleRow>();
  const pendingInvites: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    created_at?: string | null;
  }> = [];

  if (companyScope.companyId) {
    const { data: membershipData } = await adminClient
      .from("company_memberships")
      .select("user_id, role, status")
      .eq("company_id", companyScope.companyId);

    for (const row of (membershipData as CompanyMembershipRow[] | null) ?? []) {
      membershipMap.set(row.user_id, row);
    }

    const { data: inviteData } = await adminClient
      .from("company_invites")
      .select("id, email, role, account_status, created_at")
      .eq("company_id", companyScope.companyId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false });

    for (const row of (inviteData as CompanyInviteRow[] | null) ?? []) {
      pendingInvites.push({
        id: row.id,
        email: row.email,
        role: formatAppRole(row.role),
        status: formatAccountStatus(row.account_status),
        created_at: row.created_at ?? null,
      });
    }
  }

  const scopedRoleQuery = adminClient
    .from("user_roles")
    .select("user_id, role, team, company_id, account_status, created_at");

  const scopedRoleResult = companyScope.companyId
    ? await scopedRoleQuery.eq("company_id", companyScope.companyId)
    : await scopedRoleQuery.eq("team", scopeTeam);

  for (const row of (scopedRoleResult.data as FallbackUserRoleRow[] | null) ?? []) {
    roleRowMap.set(row.user_id, row);
  }

  const authUserMap = new Map(
    (data.users ?? []).map((user) => [user.id, user] as const)
  );

  const scopedUserIds = new Set<string>([
    ...membershipMap.keys(),
    ...roleRowMap.keys(),
  ]);

  if (auth.user.id && (companyScope.companyId ? true : auth.team === scopeTeam)) {
    scopedUserIds.add(auth.user.id);
  }

  const users = Array.from(scopedUserIds)
    .map((userId) => {
      const authUser = authUserMap.get(userId);
      const membership = membershipMap.get(userId);
      const scopedRoleRow = roleRowMap.get(userId);

      const resolvedRole = membership?.role ?? scopedRoleRow?.role ?? "company_user";
      const resolvedStatus =
        membership?.status ?? scopedRoleRow?.account_status ?? "pending";
      const resolvedTeam = scopedRoleRow?.team?.trim() || scopeTeam;

      return {
        id: userId,
        email: authUser?.email ?? (userId === auth.user.id ? auth.user.email ?? "" : ""),
        name: authUser
          ? getDisplayName(authUser)
          : userId === auth.user.id
            ? getDisplayName(auth.user)
            : `User ${userId.slice(0, 8)}`,
        role: formatAppRole(resolvedRole),
        team: resolvedTeam,
        status:
          resolvedStatus === "pending" || resolvedStatus === "suspended"
            ? formatAccountStatus(resolvedStatus)
            : authUser
              ? getStatus(authUser)
              : "Active",
        created_at:
          authUser?.created_at ??
          membership?.created_at ??
          scopedRoleRow?.created_at ??
          null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      } satisfies CompanyUserRow;
    })
    .filter((user) =>
      companyScope.companyId
        ? membershipMap.has(user.id) || roleRowMap.has(user.id)
        : user.team === scopeTeam
    );

  return NextResponse.json({
    users,
    invites: pendingInvites,
    scopeTeam,
    scopeCompanyId: companyScope.companyId,
    scopeCompanyName: companyScope.companyName,
    viewerRole: auth.role,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_manage_users"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient();
  const envStatus = getSupabaseServerEnvStatus();
  const body = (await request.json()) as InvitePayload;
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const role = getCompanySafeRole(body.role);
  const fallbackTeam = auth.team || "General";
  const companyScope = isCompanyAdminRole(auth.role)
    ? await getCompanyScope({
        supabase: auth.supabase,
        userId: auth.user.id,
        fallbackTeam,
        authUser: auth.user,
      })
    : await ensureCompanyScope({
        supabase: adminClient ?? auth.supabase,
        userId: auth.user.id,
        fallbackTeam,
        role: auth.role,
        actorUserId: auth.user.id,
      });
  const team = companyScope.companyName?.trim() || fallbackTeam;
  const accountStatus = isCompanyAdminRole(auth.role)
    ? "pending"
    : normalizeAccountStatus(body.accountStatus);

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a valid company scope yet." },
      { status: 400 }
    );
  }

  const seatClient = (adminClient ?? auth.supabase) as SupabaseClient;
  const inviteAllowed = await assertCompanyInviteAllowed({
    supabase: seatClient,
    companyId: companyScope.companyId,
    inviteEmailLower: email,
  });
  if (!inviteAllowed.ok) {
    return NextResponse.json(
      { error: inviteAllowed.error },
      { status: inviteAllowed.status }
    );
  }

  const rpcInviteResult = await saveCompanyInviteViaRpc({
    supabase: auth.supabase as never,
    email,
    role,
    team,
    companyId: companyScope.companyId,
    accountStatus: accountStatus,
  });

  const inviteResult =
    rpcInviteResult.error && adminClient
      ? await saveCompanyInvite({
          supabase: adminClient as never,
          email,
          role,
          team,
          companyId: companyScope.companyId,
          accountStatus: accountStatus,
          actorUserId: auth.user.id,
        })
      : rpcInviteResult;

  const inviteData = inviteResult.data;
  const inviteError = inviteResult.error;

  if (inviteError) {
    return NextResponse.json(
      {
        error: formatRoleConstraintError(inviteError.message),
        details: !adminClient ? envStatus : undefined,
      },
      { status: 500 }
    );
  }

  const emailResult = await sendCompanyInviteEmail({
    toEmail: email,
    companyName: companyScope.companyName,
    roleLabel: formatAppRole(role),
    invitedByName: getActorName(auth.user),
  });

  return NextResponse.json({
    success: true,
    user: {
      id: (inviteData as CompanyInviteRow | null)?.id ?? "",
      email,
      role: formatAppRole(role),
      team,
      companyId: companyScope.companyId,
      status: formatAccountStatus(accountStatus),
    },
    invite: inviteData,
    message: emailResult.sent
      ? "Company invite saved and email sent. After signup, this user will stay pending until your company approves access."
      : "Company invite saved. This person can create an account with the invited email, will automatically join your company workspace, and will stay pending until you approve access.",
    scopeTeam: team,
    scopeCompanyId: companyScope.companyId,
    warning: emailResult.sent
      ? undefined
      : emailResult.warning ||
        "The company invite was saved, but the email could not be delivered automatically.",
  });
}
