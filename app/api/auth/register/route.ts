import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  acceptUserAgreement,
  getClientIpAddress,
  getDefaultAgreementConfig,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import {
  createSupabaseAdminClient,
  getSupabaseAnonKey,
  getSupabaseServerUrl,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RegisterPayload = {
  email?: string;
  password?: string;
  agreed?: boolean;
};

type CompanyInviteLookupRow = {
  id: string;
  email: string;
  role: string;
  team: string;
  company_id: string;
  account_status: string;
};

function createPublicClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const anonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  const publicClient = createPublicClient();
  const adminClient = createSupabaseAdminClient();

  if (!publicClient) {
    return NextResponse.json(
      { error: "Account registration is not configured correctly." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as RegisterPayload | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password?.trim() ?? "";
  const agreed = body?.agreed === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  if (!agreed) {
    return NextResponse.json(
      { error: "You must accept the agreement before creating an account." },
      { status: 400 }
    );
  }

  const { data: inviteLookupData } = await publicClient.rpc("lookup_company_invite", {
    invite_email: email,
  });
  const companyInvite =
    ((inviteLookupData as CompanyInviteLookupRow[] | null) ?? [])[0] ?? null;

  const pendingMetadata = {
    role: companyInvite?.role ?? "viewer",
    team: companyInvite?.team ?? "General",
    company_id: companyInvite?.company_id ?? null,
    account_status: companyInvite?.account_status ?? "pending",
  };

  const { data, error } = await publicClient.auth.signUp({
    email,
    password,
    options: {
      data: pendingMetadata,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user?.id) {
    return NextResponse.json(
      { error: "Account created, but no user record was returned." },
      { status: 500 }
    );
  }

  const mergedUserMetadata = {
    ...(data.user.user_metadata ?? {}),
    ...pendingMetadata,
  };
  const mergedAppMetadata = {
    ...(data.user.app_metadata ?? {}),
    ...pendingMetadata,
  };

  const consumeInviteResult = companyInvite
    ? await publicClient.rpc("consume_company_invite", {
        invite_email: email,
        invited_user_id: data.user.id,
      })
    : { error: null };

  const defaultRolePayload = {
    user_id: data.user.id,
    role: pendingMetadata.role,
    team: pendingMetadata.team,
    company_id: pendingMetadata.company_id,
    account_status: pendingMetadata.account_status,
    created_by: data.user.id,
    updated_by: data.user.id,
  };

  const [metadataResult, roleResult] = adminClient
    ? await Promise.all([
        adminClient.auth.admin.updateUserById(data.user.id, {
          user_metadata: mergedUserMetadata,
          app_metadata: mergedAppMetadata,
        }),
        adminClient.from("user_roles").upsert(defaultRolePayload, {
          onConflict: "user_id",
        }),
      ])
    : [
        { error: null },
        companyInvite
          ? consumeInviteResult
          : await publicClient.from("user_roles").upsert(defaultRolePayload, {
              onConflict: "user_id",
            }),
      ];

  const agreementConfig = await getAgreementConfig(adminClient ?? undefined).catch(() =>
    getDefaultAgreementConfig()
  );
  const ipAddress = getClientIpAddress(request);
  const agreementAcceptResult = adminClient
    ? await acceptUserAgreement({
        supabase: adminClient,
        userId: data.user.id,
        ipAddress,
        termsVersion: agreementConfig.version,
      })
    : { error: null };

  return NextResponse.json({
    success: true,
    message:
      companyInvite
        ? "Account created. Your company invite was applied and your workspace access has been configured."
        : "Account created. An administrator must approve your access before you can enter the workspace.",
    warning:
      metadataResult.error && roleResult.error
        ? "Your account was created, but some admin-only profile details will finish syncing after approval."
        : consumeInviteResult.error
          ? consumeInviteResult.error.message ??
            "Your account was created, but the company invite could not be attached automatically."
        : agreementAcceptResult.error
          ? agreementAcceptResult.error.message ?? "Your agreement acceptance could not be recorded automatically."
        : null,
  });
}
