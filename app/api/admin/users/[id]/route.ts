import { NextResponse } from "next/server";
import {
  authorizeRequest,
  isCompanyRole,
  normalizeAccountStatus,
  normalizeAppRole,
} from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type UpdatePayload = {
  role?: string;
  team?: string;
  accountStatus?: string;
};

type ActionPayload = {
  action?: string;
};

function formatRoleConstraintError(message?: string | null) {
  if ((message ?? "").includes("user_roles_role_check")) {
    return "The database role constraint has not been updated yet. Run the latest Supabase migration to allow Company Admin and Company User roles.";
  }

  return message || "Role update failed.";
}

async function resolveCompanyAssignment(params: {
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  currentUser: {
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
  userId: string;
  team: string;
  role: string;
  actorUserId: string;
}) {
  const { adminClient, currentUser, userId, team, role, actorUserId } = params;

  if (!adminClient) {
    return null;
  }

  const metadataCompanyId =
    typeof currentUser.app_metadata?.company_id === "string"
      ? currentUser.app_metadata.company_id
      : typeof currentUser.user_metadata?.company_id === "string"
        ? currentUser.user_metadata.company_id
        : null;

  if (metadataCompanyId) {
    return metadataCompanyId;
  }

  const { data: existingMembership } = await adminClient
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();

  const existingCompanyId =
    existingMembership &&
    typeof existingMembership === "object" &&
    "company_id" in existingMembership &&
    typeof existingMembership.company_id === "string"
      ? existingMembership.company_id
      : null;

  if (existingCompanyId) {
    return existingCompanyId;
  }

  if (!isCompanyRole(role)) {
    return null;
  }

  const { data: existingCompany } = await adminClient
    .from("companies")
    .select("id")
    .eq("team_key", team)
    .maybeSingle();

  if (
    existingCompany &&
    typeof existingCompany === "object" &&
    "id" in existingCompany &&
    typeof existingCompany.id === "string"
  ) {
    return existingCompany.id;
  }

  const { data: createdCompany } = await adminClient
    .from("companies")
    .upsert(
      {
        name: team,
        team_key: team,
        created_by: actorUserId,
        updated_by: actorUserId,
      },
      {
        onConflict: "team_key",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (
    createdCompany &&
    typeof createdCompany === "object" &&
    "id" in createdCompany &&
    typeof createdCompany.id === "string"
  ) {
    return createdCompany.id;
  }

  return null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_assign_roles",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient();

  const { id } = await context.params;
  const body = (await request.json()) as UpdatePayload;
  const role = normalizeAppRole(body.role);
  const team = body.team?.trim() || "General";
  const accountStatus = normalizeAccountStatus(body.accountStatus);

  if (!adminClient) {
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

  const { data: currentUser, error: getError } =
    await adminClient.auth.admin.getUserById(id);

  if (getError || !currentUser.user) {
    return NextResponse.json(
      { error: getError?.message || "User not found." },
      { status: 404 }
    );
  }

  const companyId = await resolveCompanyAssignment({
    adminClient,
    currentUser: currentUser.user,
    userId: id,
    team,
    role,
    actorUserId: auth.user.id,
  });

  const mergedUserMetadata = {
    ...(currentUser.user.user_metadata ?? {}),
    role,
    team,
    company_id: companyId,
    account_status: accountStatus,
  };

  const mergedAppMetadata = {
    ...(currentUser.user.app_metadata ?? {}),
    role,
    team,
    company_id: companyId,
    account_status: accountStatus,
  };

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    id,
    {
      user_metadata: mergedUserMetadata,
      app_metadata: mergedAppMetadata,
    }
  );

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
      company_id: companyId,
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

  if (companyId) {
    await adminClient.from("company_memberships").upsert(
      {
        user_id: id,
        company_id: companyId,
        role: isCompanyRole(role) ? role : "company_user",
        status: accountStatus,
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
    companyId,
    accountStatus,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_assign_roles",
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
  const body = (await request.json()) as ActionPayload;
  const action = (body.action ?? "").trim().toLowerCase();

  const { data: currentUser, error: getError } =
    await adminClient.auth.admin.getUserById(id);

  if (getError || !currentUser.user) {
    return NextResponse.json(
      { error: getError?.message || "User not found." },
      { status: 404 }
    );
  }

  const email = currentUser.user.email?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json(
      { error: "User does not have a valid email address." },
      { status: 400 }
    );
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL ?? ""}`.trim();
  const normalizedRedirectTo = redirectTo
    ? redirectTo.startsWith("http")
      ? redirectTo
      : `https://${redirectTo}`
    : undefined;

  if (action === "resend_invite") {
    const role =
      typeof currentUser.user.app_metadata?.role === "string"
        ? currentUser.user.app_metadata.role
        : typeof currentUser.user.user_metadata?.role === "string"
          ? currentUser.user.user_metadata.role
          : "viewer";
    const team =
      typeof currentUser.user.app_metadata?.team === "string"
        ? currentUser.user.app_metadata.team
        : typeof currentUser.user.user_metadata?.team === "string"
          ? currentUser.user.user_metadata.team
          : "General";
    const accountStatus =
      typeof currentUser.user.app_metadata?.account_status === "string"
        ? currentUser.user.app_metadata.account_status
        : typeof currentUser.user.user_metadata?.account_status === "string"
          ? currentUser.user.user_metadata.account_status
          : "active";

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role,
        team,
        account_status: accountStatus,
      },
      ...(normalizedRedirectTo ? { redirectTo: normalizedRedirectTo } : {}),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "resend_invite",
    });
  }

  if (action === "password_reset") {
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: normalizedRedirectTo
        ? {
            redirectTo: normalizedRedirectTo,
          }
        : undefined,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "password_reset",
      emailSentTo: email,
      properties: data.properties,
    });
  }

  if (action === "force_sign_out") {
    const { error } = await adminClient.auth.admin.updateUserById(id, {
      ban_duration: "1m",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "force_sign_out",
      note: "Refresh-based sessions were invalidated. Access tokens may remain valid until they expire.",
    });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_assign_roles",
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

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot remove your own account from the workspace." },
      { status: 400 }
    );
  }

  const { data: currentUser, error: getError } =
    await adminClient.auth.admin.getUserById(id);

  if (getError || !currentUser.user) {
    return NextResponse.json(
      { error: getError?.message || "User not found." },
      { status: 404 }
    );
  }

  const fallbackRole = "viewer";
  const fallbackTeam = "General";
  const fallbackStatus = "suspended";

  const mergedUserMetadata = {
    ...(currentUser.user.user_metadata ?? {}),
    role: fallbackRole,
    team: fallbackTeam,
    company_id: null,
    account_status: fallbackStatus,
  };

  const mergedAppMetadata = {
    ...(currentUser.user.app_metadata ?? {}),
    role: fallbackRole,
    team: fallbackTeam,
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
      team: fallbackTeam,
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

  await adminClient.from("company_memberships").delete().eq("user_id", id);

  return NextResponse.json({
    success: true,
    removedUserId: id,
    message: "User removed from the workspace and access has been suspended.",
  });
}
