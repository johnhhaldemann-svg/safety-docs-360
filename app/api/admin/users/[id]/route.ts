import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  authorizeRequest,
  normalizeAccountStatus,
  normalizeAppRole,
} from "@/lib/rbac";

export const runtime = "nodejs";

type UpdatePayload = {
  role?: string;
  team?: string;
  accountStatus?: string;
};

type ActionPayload = {
  action?: string;
};

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    return NextResponse.json(
      { error: "Missing Supabase service role configuration." },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as UpdatePayload;
  const role = normalizeAppRole(body.role);
  const team = body.team?.trim() || "General";
  const accountStatus = normalizeAccountStatus(body.accountStatus);

  const { data: currentUser, error: getError } =
    await adminClient.auth.admin.getUserById(id);

  if (getError || !currentUser.user) {
    return NextResponse.json(
      { error: getError?.message || "User not found." },
      { status: 404 }
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

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    id,
    {
      user_metadata: mergedUserMetadata,
      app_metadata: mergedAppMetadata,
    }
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
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
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    role,
    team,
    accountStatus,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createAdminClient();

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
