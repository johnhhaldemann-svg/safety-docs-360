import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

const COMPANY_ASSIGNABLE_ROLES: AppRole[] = ["company_admin", "company_user"];

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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
  const adminClient = createAdminClient();

  const role = isCompanyAdminRole(auth.role)
    ? getCompanySafeRole(body.role)
    : normalizeAppRole(body.role);
  const team = auth.team || "General";
  const accountStatus = normalizeAccountStatus(body.accountStatus);

  if (!adminClient) {
    const { data: existingRow, error: existingError } = await auth.supabase
      .from("user_roles")
      .select("user_id, role, team")
      .eq("user_id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (
      isCompanyAdminRole(auth.role) &&
      existingRow &&
      (existingRow.team?.trim() || "General") !== team
    ) {
      return NextResponse.json(
        { error: "Managers can only update users in their own company." },
        { status: 403 }
      );
    }

    if (
      isCompanyAdminRole(auth.role) &&
      existingRow &&
      isAdminRole(existingRow.role)
    ) {
      return NextResponse.json(
        { error: "Managers cannot update administrator accounts." },
        { status: 403 }
      );
    }

    const { error: roleError } = await auth.supabase.from("user_roles").upsert(
      {
        user_id: id,
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

  if (
    isCompanyAdminRole(auth.role) &&
    currentRoleContext.team !== team
  ) {
    return NextResponse.json(
      { error: "Managers can only update users in their own company." },
      { status: 403 }
    );
  }

  if (isCompanyAdminRole(auth.role) && isAdminRole(currentRoleContext.role)) {
    return NextResponse.json(
      { error: "Managers cannot update administrator accounts." },
      { status: 403 }
    );
  }

  const mergedUserMetadata = {
    ...(currentUser.user.user_metadata ?? {}),
    role,
    team,
    account_status: accountStatus,
  };

  const mergedAppMetadata = {
    ...(currentUser.user.app_metadata ?? {}),
    role,
    team,
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
  });
}
