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
  companyId?: string | null;
};

type CompanyLookupRow = {
  id: string;
  name: string | null;
  status: string | null;
};

type ActionPayload = {
  action?: string;
};

function formatRoleConstraintError(message?: string | null) {
  if ((message ?? "").includes("user_roles_role_check")) {
    return "The database role constraint has not been updated yet. Run the latest Supabase migration to allow the current company-scoped roles.";
  }

  return message || "Role update failed.";
}

function trimText(value?: string | null) {
  return (value ?? "").trim();
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
  requestedCompanyId?: string | null;
  isSuperAdmin: boolean;
}) {
  const {
    adminClient,
    currentUser,
    userId,
    team,
    role,
    actorUserId,
    requestedCompanyId,
    isSuperAdmin,
  } = params;

  if (!adminClient) {
    return { companyId: null, companyName: null, error: null as string | null };
  }

  const normalizedRequestedCompanyId = trimText(requestedCompanyId);

  if (normalizedRequestedCompanyId) {
    if (!isSuperAdmin) {
      return {
        companyId: null,
        companyName: null,
        error: "Only a Super Admin can assign a user to a specific company workspace.",
      };
    }

    if (!isCompanyRole(role)) {
      return {
        companyId: null,
        companyName: null,
        error: "Choose a company-scoped role when assigning a user to a company workspace.",
      };
    }

    const companyLookup = await adminClient
      .from("companies")
      .select("id, name, status")
      .eq("id", normalizedRequestedCompanyId)
      .maybeSingle();

    if (companyLookup.error) {
      return {
        companyId: null,
        companyName: null,
        error: companyLookup.error.message || "Failed to load the selected company.",
      };
    }

    const company = companyLookup.data as CompanyLookupRow | null;

    if (!company?.id) {
      return {
        companyId: null,
        companyName: null,
        error: "The selected company workspace could not be found.",
      };
    }

    if ((company.status ?? "active").trim().toLowerCase() === "archived") {
      return {
        companyId: null,
        companyName: null,
        error: "Restore that company workspace before assigning users to it.",
      };
    }

    return {
      companyId: company.id,
      companyName: company.name?.trim() || team || "Company Workspace",
      error: null as string | null,
    };
  }

  if (!isCompanyRole(role)) {
    return { companyId: null, companyName: null, error: null as string | null };
  }

  const metadataCompanyId =
    typeof currentUser.app_metadata?.company_id === "string"
      ? currentUser.app_metadata.company_id
      : typeof currentUser.user_metadata?.company_id === "string"
        ? currentUser.user_metadata.company_id
        : null;

  if (metadataCompanyId) {
    const companyLookup = await adminClient
      .from("companies")
      .select("id, name")
      .eq("id", metadataCompanyId)
      .maybeSingle();

    const company = companyLookup.data as CompanyLookupRow | null;
    return {
      companyId: metadataCompanyId,
      companyName: company?.name?.trim() || team || "Company Workspace",
      error: null as string | null,
    };
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
    const companyLookup = await adminClient
      .from("companies")
      .select("id, name")
      .eq("id", existingCompanyId)
      .maybeSingle();

    const company = companyLookup.data as CompanyLookupRow | null;
    return {
      companyId: existingCompanyId,
      companyName: company?.name?.trim() || team || "Company Workspace",
      error: null as string | null,
    };
  }

  if (isSuperAdmin) {
    return {
      companyId: null,
      companyName: null,
      error: "Select a company workspace for company-scoped roles.",
    };
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
    return {
      companyId: existingCompany.id,
      companyName: team || "Company Workspace",
      error: null as string | null,
    };
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
    return {
      companyId: createdCompany.id,
      companyName: team || "Company Workspace",
      error: null as string | null,
    };
  }

  return { companyId: null, companyName: null, error: null as string | null };
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
  const requestedCompanyId = trimText(body.companyId);
  const isSuperAdmin = auth.role === "super_admin";

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

  const companyAssignment = await resolveCompanyAssignment({
    adminClient,
    currentUser: currentUser.user,
    userId: id,
    team,
    role,
    actorUserId: auth.user.id,
    requestedCompanyId,
    isSuperAdmin,
  });

  if (companyAssignment.error) {
    return NextResponse.json({ error: companyAssignment.error }, { status: 400 });
  }

  const mergedUserMetadata = {
    ...(currentUser.user.user_metadata ?? {}),
    role,
    team: companyAssignment.companyName || team,
    company_id: companyAssignment.companyId,
    account_status: accountStatus,
  };

  const mergedAppMetadata = {
    ...(currentUser.user.app_metadata ?? {}),
    role,
    team: companyAssignment.companyName || team,
    company_id: companyAssignment.companyId,
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
      team: companyAssignment.companyName || team,
      company_id: companyAssignment.companyId,
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

  const { error: membershipDeleteError } = await adminClient
    .from("company_memberships")
    .delete()
    .eq("user_id", id);

  if (membershipDeleteError) {
    return NextResponse.json(
      {
        error:
          membershipDeleteError.message || "Failed to reset company membership records.",
      },
      { status: 500 }
    );
  }

  if (companyAssignment.companyId) {
    const { error: membershipError } = await adminClient.from("company_memberships").upsert(
      {
        user_id: id,
        company_id: companyAssignment.companyId,
        role: isCompanyRole(role) ? role : "company_user",
        status: accountStatus === "pending" ? "pending" : "active",
        created_by: auth.user.id,
        updated_by: auth.user.id,
      },
      {
        onConflict: "user_id,company_id",
      }
    );

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message || "Failed to sync company membership." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    role,
    team: companyAssignment.companyName || team,
    companyId: companyAssignment.companyId,
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

  const { id } = await context.params;
  const body = (await request.json()) as ActionPayload;
  const action = (body.action ?? "").trim().toLowerCase();

  if (!adminClient) {
    const actionMessage =
      action === "password_reset"
        ? "Password reset emails require the Supabase service role to be available in this deployment."
        : action === "force_sign_out"
          ? "Force sign-out requires the Supabase service role to be available in this deployment."
          : action === "resend_invite"
            ? "Resending invites requires the Supabase service role to be available in this deployment."
            : "This admin action requires the Supabase service role to be available in this deployment.";

    return NextResponse.json({ error: actionMessage }, { status: 500 });
  }

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

  if (auth.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only a Super Admin can permanently delete user accounts." },
      { status: 403 }
    );
  }

  const adminClient = createSupabaseAdminClient();

  const { id } = await context.params;

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot permanently delete your own account." },
      { status: 400 }
    );
  }

  if (!adminClient) {
    return NextResponse.json(
      {
        error:
          "Permanent user deletion requires the Supabase service role to be available in this deployment.",
      },
      { status: 500 }
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

  const { error: membershipsError } = await adminClient
    .from("company_memberships")
    .delete()
    .eq("user_id", id);

  if (membershipsError) {
    return NextResponse.json(
      { error: membershipsError.message || "Failed to delete company memberships." },
      { status: 500 }
    );
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Failed to permanently delete user." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    deletedUserId: id,
    deletedEmail: currentUser.user.email ?? null,
    message: "User account deleted permanently.",
  });
}
