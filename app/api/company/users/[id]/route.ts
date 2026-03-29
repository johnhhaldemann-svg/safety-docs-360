import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  authorizeRequest,
  getUserRoleContext,
  isAdminRole,
  isCompanyAdminRole,
  normalizeAccountStatus,
  normalizeAppRole,
  type AppRole,
} from "@/lib/rbac";

export const runtime = "nodejs";

type UpdatePayload = {
  role?: string;
  accountStatus?: string;
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

function getCompanySafeRole(role?: string | null) {
  const normalized = normalizeAppRole(role);
  if (!COMPANY_ASSIGNABLE_ROLES.includes(normalized)) {
    return "company_user";
  }
  return normalized;
}

function formatRoleConstraintError(message?: string | null) {
  if ((message ?? "").includes("user_roles_role_check")) {
    return "The database role constraint has not been updated yet. Run the latest Supabase migration to allow the current company-scoped roles.";
  }

  return message || "Company user update failed.";
}

async function getTargetRoleRow(params: {
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string | null } | null }>;
        };
      };
    };
  };
  userId: string;
}) {
  const result = await params.supabase
    .from("user_roles")
    .select("user_id, role, team, company_id, account_status")
    .eq("user_id", params.userId)
    .maybeSingle();

  return {
    data:
      (result.data as {
        user_id: string;
        role: string;
        team: string | null;
        company_id: string | null;
        account_status: string | null;
      } | null) ?? null,
    error: result.error,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_manage_users"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = (await request.json()) as UpdatePayload;
  const adminClient = createSupabaseAdminClient();

  const role = getCompanySafeRole(body.role);
  const fallbackTeam = auth.team || "General";
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam,
    authUser: auth.user,
  });
  const team = companyScope.companyName?.trim() || fallbackTeam;
  const accountStatus = normalizeAccountStatus(body.accountStatus);

  if (isCompanyAdminRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This company admin account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!adminClient) {
    const { data: existingRow, error: existingError } = await getTargetRoleRow({
      supabase: auth.supabase as never,
      userId: id,
    });

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (
      isCompanyAdminRole(auth.role) &&
      existingRow &&
      existingRow.company_id !== companyScope.companyId
    ) {
      return NextResponse.json(
        { error: "Company admins can only update users in their own company." },
        { status: 403 }
      );
    }

    if (
      isCompanyAdminRole(auth.role) &&
      existingRow &&
      isAdminRole(existingRow.role)
    ) {
      return NextResponse.json(
        { error: "Company workspace users cannot update platform administrator accounts." },
        { status: 403 }
      );
    }

    const { error: roleError } = await auth.supabase.from("user_roles").upsert(
      {
        user_id: id,
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

    return NextResponse.json({
      success: true,
      role,
      team,
      accountStatus,
      warning:
        "Role was updated in the workspace RBAC table, but Supabase Auth metadata could not be synced because the service role key is unavailable at runtime.",
    });
  }

  const { data: currentUser, error: getError } = await adminClient.auth.admin.getUserById(id);

  if (getError || !currentUser.user) {
    return NextResponse.json(
      { error: getError?.message || "User not found." },
      { status: 404 }
    );
  }

  const currentRoleContext = await getUserRoleContext({
    supabase: adminClient,
    user: currentUser.user,
  });
  const { data: targetRoleRow, error: targetRoleError } = await getTargetRoleRow({
    supabase: adminClient as never,
    userId: id,
  });

  if (targetRoleError) {
    return NextResponse.json({ error: targetRoleError.message }, { status: 500 });
  }

  if (
    isCompanyAdminRole(auth.role) &&
    targetRoleRow &&
    targetRoleRow.company_id !== companyScope.companyId
  ) {
    return NextResponse.json(
      { error: "Company admins can only update users in their own company." },
      { status: 403 }
    );
  }

  if (isCompanyAdminRole(auth.role) && isAdminRole(currentRoleContext.role)) {
    return NextResponse.json(
      { error: "Company workspace users cannot update platform administrator accounts." },
      { status: 403 }
    );
  }

  const mergedUserMetadata = {
    ...(currentUser.user.user_metadata ?? {}),
    role,
    team,
    company_id: companyScope.companyId,
    account_status: accountStatus,
  };

  const mergedAppMetadata = {
    ...(currentUser.user.app_metadata ?? {}),
    role,
    team,
    company_id: companyScope.companyId,
    account_status: accountStatus,
  };

  const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
    user_metadata: mergedUserMetadata,
    app_metadata: mergedAppMetadata,
  });

  if (updateError) {
    return NextResponse.json(
      { error: formatRoleConstraintError(updateError.message) },
      { status: 500 }
    );
  }

  const { error: roleError } = await adminClient.from("user_roles").upsert(
    {
      user_id: id,
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
        user_id: id,
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

  return NextResponse.json({
    success: true,
    role,
    team,
    companyId: companyScope.companyId,
    accountStatus,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_manage_users"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    return NextResponse.json(
      { error: "Missing Supabase service role configuration." },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  const fallbackTeam = auth.team || "General";
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This company account is not linked to a valid company scope yet." },
      { status: 400 }
    );
  }

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot remove your own company admin access from this page." },
      { status: 400 }
    );
  }

  const { data: currentUser, error: getError } = await adminClient.auth.admin.getUserById(id);

  if (getError || !currentUser.user) {
    return NextResponse.json(
      { error: getError?.message || "User not found." },
      { status: 404 }
    );
  }

  const currentRoleContext = await getUserRoleContext({
    supabase: adminClient,
    user: currentUser.user,
  });
  const { data: targetRoleRow, error: targetRoleError } = await getTargetRoleRow({
    supabase: adminClient as never,
    userId: id,
  });

  if (targetRoleError) {
    return NextResponse.json({ error: targetRoleError.message }, { status: 500 });
  }

  if (
    isCompanyAdminRole(auth.role) &&
    targetRoleRow &&
    targetRoleRow.company_id !== companyScope.companyId
  ) {
    return NextResponse.json(
      { error: "Company admins can only remove users from their own company." },
      { status: 403 }
    );
  }

  if (isCompanyAdminRole(auth.role) && isAdminRole(currentRoleContext.role)) {
    return NextResponse.json(
      { error: "Company workspace users cannot remove platform administrator accounts." },
      { status: 403 }
    );
  }

  await adminClient
    .from("company_memberships")
    .delete()
    .eq("user_id", id)
    .eq("company_id", companyScope.companyId);

  const fallbackRole = "viewer";
  const fallbackWorkspaceTeam = "General";
  const fallbackStatus = "suspended";

  const mergedUserMetadata = {
    ...(currentUser.user.user_metadata ?? {}),
    role: fallbackRole,
    team: fallbackWorkspaceTeam,
    company_id: null,
    account_status: fallbackStatus,
  };

  const mergedAppMetadata = {
    ...(currentUser.user.app_metadata ?? {}),
    role: fallbackRole,
    team: fallbackWorkspaceTeam,
    company_id: null,
    account_status: fallbackStatus,
  };

  const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
    user_metadata: mergedUserMetadata,
    app_metadata: mergedAppMetadata,
  });

  if (updateError) {
    return NextResponse.json(
      { error: formatRoleConstraintError(updateError.message) },
      { status: 500 }
    );
  }

  const { error: roleError } = await adminClient.from("user_roles").upsert(
    {
      user_id: id,
      role: fallbackRole,
      team: fallbackWorkspaceTeam,
      company_id: null,
      account_status: fallbackStatus,
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

  return NextResponse.json({
    success: true,
    removedUserId: id,
    message: "User removed from the company workspace and access has been suspended.",
  });
}
