import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getSupabaseServerEnvStatus,
} from "@/lib/supabaseAdmin";
import {
  authorizeRequest,
  formatAccountStatus,
  formatAppRole,
  getUserRoleContext,
  normalizeAccountStatus,
  normalizeAppRole,
} from "@/lib/rbac";

export const runtime = "nodejs";

type InvitePayload = {
  email?: string;
  role?: string;
  team?: string;
  accountStatus?: string;
};

type FallbackUserRoleRow = {
  user_id: string;
  role: string;
  team: string | null;
  account_status: string | null;
  created_at?: string | null;
};

type RpcAdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  team: string | null;
  status: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
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

function getTeam(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataTeam =
    typeof user.app_metadata?.team === "string"
      ? user.app_metadata.team
      : typeof user.user_metadata?.team === "string"
        ? user.user_metadata.team
        : "";

  return metadataTeam.trim() || "General";
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

function formatRoleConstraintError(message?: string | null) {
  if ((message ?? "").includes("user_roles_role_check")) {
    return "The database role constraint has not been updated yet. Run the latest Supabase migration to allow Company Admin and Company User roles.";
  }

  return message || "User invite failed.";
}

function isInternalAppRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return normalized !== "company_admin" && normalized !== "company_user";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_assign_roles",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    const { data: rpcData, error: rpcError } = await (
      auth.supabase as {
        rpc: (
          fn: string
        ) => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
      }
    ).rpc("admin_list_workspace_users");

    if (!rpcError) {
      const users = ((rpcData as RpcAdminUserRow[] | null) ?? [])
        .filter((row) => isInternalAppRole(row.role))
        .map((row) => ({
          id: row.id,
          email: row.email ?? "",
          name: row.name?.trim() || (row.email ? row.email.split("@")[0] : "Unnamed User"),
          role: formatAppRole(row.role),
          team: row.team?.trim() || "General",
          status: row.status?.trim() || "Active",
          created_at: row.created_at,
          last_sign_in_at: row.last_sign_in_at,
          email_confirmed_at: row.email_confirmed_at,
        }));

      return NextResponse.json({
        users,
        capabilities: {
          canPermanentlyDeleteUsers: false,
          canRunAdminAuthActions: false,
        },
        warning:
          "Showing database-backed admin directory fallback because the Supabase service role key is unavailable at runtime.",
      });
    }

    const { data, error } = await auth.supabase
      .from("user_roles")
      .select("user_id, role, team, account_status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Missing Supabase service role configuration." },
        { status: 500 }
      );
    }

    const users = ((data as FallbackUserRoleRow[] | null) ?? [])
      .filter((row) => isInternalAppRole(row.role))
      .map((row) => {
        const isCurrentUser = row.user_id === auth.user.id;
        const email = isCurrentUser ? auth.user.email ?? "" : "";
        const name = isCurrentUser
          ? getDisplayName(auth.user)
          : `User ${row.user_id.slice(0, 8)}`;

        return {
          id: row.user_id,
          email,
          name,
          role: formatAppRole(row.role),
          team: row.team?.trim() || "General",
          status: formatAccountStatus(row.account_status),
          created_at: row.created_at ?? null,
          last_sign_in_at: null,
          email_confirmed_at: null,
        };
      });

    return NextResponse.json({
      users,
      capabilities: {
        canPermanentlyDeleteUsers: false,
        canRunAdminAuthActions: false,
      },
      warning:
        "Showing RBAC directory fallback because the Supabase service role key is unavailable at runtime.",
    });
  }

  const { data, error } = await adminClient.auth.admin.listUsers();

  if (error) {
    return NextResponse.json(
      { error: formatRoleConstraintError(error.message) },
      { status: 500 }
    );
  }

  const users = (
    await Promise.all(
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
        team: roleContext.team || getTeam(user),
        status:
          roleContext.accountStatus === "pending" ||
          roleContext.accountStatus === "suspended"
            ? formatAccountStatus(roleContext.accountStatus)
            : getStatus(user),
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
      };
    })
    )
  ).filter((user) => isInternalAppRole(user.role));

  return NextResponse.json({
    users,
    capabilities: {
      canPermanentlyDeleteUsers: auth.role === "super_admin",
      canRunAdminAuthActions: true,
    },
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_assign_roles",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient();
  const envStatus = getSupabaseServerEnvStatus();

  if (!adminClient) {
    return NextResponse.json(
      {
        error: "Missing Supabase service role configuration.",
        details: envStatus,
      },
      { status: 500 }
    );
  }

  const body = (await request.json()) as InvitePayload;
  const email = body.email?.trim().toLowerCase() ?? "";
  const role = normalizeAppRole(body.role);
  const team = body.team?.trim() || "General";
  const accountStatus = normalizeAccountStatus(body.accountStatus);

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!isInternalAppRole(role)) {
    return NextResponse.json(
      {
        error:
          "Company roles are not invited from Platform User Management. Create the company workspace first, then invite employees from Company Access.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        role,
        team,
        account_status: accountStatus,
      },
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data.user?.id) {
    const { error: roleError } = await adminClient.from("user_roles").upsert(
      {
        user_id: data.user.id,
        role,
        team,
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
  }

  return NextResponse.json({
    success: true,
    user: {
      id: data.user?.id ?? "",
      email,
      role: formatAppRole(role),
      team,
      status: accountStatus === "suspended" ? "Suspended" : "Pending",
    },
  });
}
