import { NextResponse } from "next/server";
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
  getUserRoleContext,
  isCompanyAdminRole,
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
};

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

type FallbackUserRoleRow = {
  user_id: string;
  role: string;
  team: string | null;
  account_status: string | null;
  created_at?: string | null;
};

const COMPANY_ASSIGNABLE_ROLES: AppRole[] = ["company_admin", "company_user"];

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
  if ((message ?? "").includes("user_roles_role_check")) {
    return "The database role constraint has not been updated yet. Run the latest Supabase migration to allow Company Admin and Company User roles.";
  }

  return message || "Company user update failed.";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_manage_users"],
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
  });
  const scopeTeam = auth.team || companyScope.companyName || "General";

  if (!adminClient) {
    const query = auth.supabase
      .from("user_roles")
      .select("user_id, role, team, account_status, created_at")
      .order("created_at", { ascending: false });

    const scopedQuery =
      isCompanyAdminRole(auth.role) && companyScope.companyId
        ? query.eq("company_id", companyScope.companyId)
        : isCompanyAdminRole(auth.role)
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

  const rawUsers = await Promise.all(
    (data.users ?? []).map(async (user) => {
      const roleContext = await getUserRoleContext({
        supabase: adminClient,
        user,
      });

      return {
        id: user.id,
        email: user.email ?? "",
        name: getDisplayName(user),
        role: formatAppRole(roleContext.role),
        team: roleContext.team,
        status:
          roleContext.accountStatus === "pending" ||
          roleContext.accountStatus === "suspended"
            ? formatAccountStatus(roleContext.accountStatus)
            : getStatus(user),
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      } satisfies CompanyUserRow;
    })
  );

  const users = isCompanyAdminRole(auth.role)
    ? rawUsers.filter((user) => user.team === scopeTeam)
    : rawUsers;

  return NextResponse.json({
    users,
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

  const role = isCompanyAdminRole(auth.role)
    ? getCompanySafeRole(body.role)
    : normalizeAppRole(body.role);
  const team = isCompanyAdminRole(auth.role) ? auth.team : auth.team || "General";
  const companyScopeClient = adminClient ?? auth.supabase;
  const companyScope = await ensureCompanyScope({
    supabase: companyScopeClient,
    userId: auth.user.id,
    fallbackTeam: team,
    role: auth.role,
    actorUserId: auth.user.id,
  });
  const accountStatus = isCompanyAdminRole(auth.role)
    ? "active"
    : normalizeAccountStatus(body.accountStatus);

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a valid company scope yet." },
      { status: 400 }
    );
  }

  if (!adminClient) {
    const { data: inviteData, error: inviteError } = await saveCompanyInvite({
      supabase: auth.supabase as never,
      email,
      role,
      team,
      companyId: companyScope.companyId,
      accountStatus: accountStatus,
      actorUserId: auth.user.id,
    });

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message || "Failed to save company invite." },
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
      invite: inviteData as CompanyInviteRow,
      message:
        emailResult.sent
          ? "Company invite saved and email sent."
          : "Company invite saved. This person can create an account with the invited email and will automatically join your company workspace.",
      user: {
        id: (inviteData as CompanyInviteRow).id,
        email,
        role: formatAppRole(role),
        team,
        companyId: companyScope.companyId,
        status: formatAccountStatus(accountStatus),
      },
      scopeTeam: team,
      scopeCompanyId: companyScope.companyId,
      warning: emailResult.sent
        ? "The company invite was sent using the database-backed signup flow."
        : emailResult.warning ||
          "The email invite was stored in the workspace database because the Supabase admin invite API is unavailable at runtime.",
      details: envStatus,
    });
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      role,
      team,
      company_id: companyScope.companyId,
      account_status: accountStatus,
    },
  });

  if (error) {
    const { data: inviteData, error: inviteError } = await saveCompanyInvite({
      supabase: adminClient as never,
      email,
      role,
      team,
      companyId: companyScope.companyId,
      accountStatus: accountStatus,
      actorUserId: auth.user.id,
    });

    if (inviteError) {
      return NextResponse.json(
        { error: formatRoleConstraintError(error.message) },
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
      invite: inviteData,
      message:
        emailResult.sent
          ? "Company invite saved and email sent."
          : "Company invite saved in the workspace database. This person can create an account with the invited email and will automatically join your company workspace.",
      user: {
        id: (inviteData as CompanyInviteRow | null)?.id ?? "",
        email,
        role: formatAppRole(role),
        team,
        companyId: companyScope.companyId,
        status: formatAccountStatus(accountStatus),
      },
      scopeTeam: team,
      scopeCompanyId: companyScope.companyId,
      warning: emailResult.sent
        ? "The Supabase invite path was unavailable, so a database-backed invite email was sent instead."
        : emailResult.warning ||
          "The Supabase email invite could not be sent, so the company invite was saved for self-service signup instead.",
    });
  }

  if (data.user?.id) {
    const { error: roleError } = await adminClient.from("user_roles").upsert(
      {
        user_id: data.user.id,
        role,
        team,
        company_id: companyScope.companyId,
        account_status: accountStatus,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      },
      {
        onConflict: "user_id",
      }
    );

    if (roleError) {
      return NextResponse.json(
        { error: formatRoleConstraintError(roleError.message) },
        { status: 500 }
      );
    }

    if (companyScope.companyId) {
      await adminClient.from("company_memberships").upsert(
        {
          user_id: data.user.id,
          company_id: companyScope.companyId,
          role,
          status: accountStatus === "pending" ? "pending" : "active",
          created_by: auth.user.id,
          updated_by: auth.user.id,
        },
        {
          onConflict: "user_id,company_id",
        }
      );
    }
  }

  return NextResponse.json({
    success: true,
    user: {
      id: data.user?.id ?? "",
      email,
      role: formatAppRole(role),
      team,
      companyId: companyScope.companyId,
      status: formatAccountStatus(accountStatus),
    },
    message: "Company user invited successfully.",
    scopeTeam: team,
    scopeCompanyId: companyScope.companyId,
  });
}
