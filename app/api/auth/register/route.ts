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

  if (!publicClient || !adminClient) {
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

  const pendingMetadata = {
    role: "viewer",
    team: "General",
    account_status: "pending",
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

  const [metadataResult, roleResult] = await Promise.all([
    adminClient.auth.admin.updateUserById(data.user.id, {
      user_metadata: mergedUserMetadata,
      app_metadata: mergedAppMetadata,
    }),
    adminClient.from("user_roles").upsert(
      {
        user_id: data.user.id,
        role: "viewer",
        team: "General",
        account_status: "pending",
        created_by: data.user.id,
        updated_by: data.user.id,
      },
      {
        onConflict: "user_id",
      }
    ),
  ]);

  const agreementConfig = await getAgreementConfig(adminClient).catch(() =>
    getDefaultAgreementConfig()
  );
  const ipAddress = getClientIpAddress(request);

  const agreementAcceptResult = await acceptUserAgreement({
    supabase: adminClient,
    userId: data.user.id,
    ipAddress,
    termsVersion: agreementConfig.version,
  });

  return NextResponse.json({
    success: true,
    message:
      "Account created. An administrator must approve your access before you can enter the workspace.",
    warning:
      metadataResult.error && roleResult.error
        ? "Your account was created, but some admin-only profile details will finish syncing after approval."
        : agreementAcceptResult.error
          ? agreementAcceptResult.error.message ?? "Your agreement acceptance could not be recorded automatically."
        : null,
  });
}
