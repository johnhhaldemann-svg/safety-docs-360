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
  fullName?: string;
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

async function lookupCompanyInvite(params: {
  publicClient: NonNullable<ReturnType<typeof createPublicClient>>;
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  email: string;
}) {
  const { publicClient, adminClient, email } = params;

  if (adminClient) {
    const { data } = await adminClient
      .from("company_invites")
      .select("id, email, role, team, company_id, account_status")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (data as CompanyInviteLookupRow | null) ?? null;
  }

  const rpcResult = await publicClient.rpc("lookup_company_invite", {
    invite_email: email,
  });

  return ((rpcResult.data as CompanyInviteLookupRow[] | null) ?? [])[0] ?? null;
}

async function ensureCompanyInviteApplied(params: {
  publicClient: NonNullable<ReturnType<typeof createPublicClient>>;
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  email: string;
  invite: CompanyInviteLookupRow | null;
}) {
  const { adminClient, userId, invite } = params;

  if (!invite) {
    return { error: null };
  }

  if (adminClient) {
    const membershipStatus =
      invite.account_status === "pending" || invite.account_status === "suspended"
        ? invite.account_status
        : "active";

    const [roleResult, membershipResult, inviteResult] = await Promise.all([
      adminClient.from("user_roles").upsert(
        {
          user_id: userId,
          role: invite.role,
          team: invite.team,
          company_id: invite.company_id,
          account_status: invite.account_status,
          created_by: userId,
          updated_by: userId,
        },
        {
          onConflict: "user_id",
        }
      ),
      adminClient.from("company_memberships").upsert(
        {
          user_id: userId,
          company_id: invite.company_id,
          role: invite.role,
          status: membershipStatus,
          created_by: userId,
          updated_by: userId,
        },
        {
          onConflict: "user_id,company_id",
        }
      ),
      adminClient
        .from("company_invites")
        .update({
          consumed_at: new Date().toISOString(),
          consumed_by: userId,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("id", invite.id),
    ]);

    if (roleResult.error || membershipResult.error || inviteResult.error) {
      return {
        error: {
          message:
            roleResult.error?.message ||
            membershipResult.error?.message ||
            inviteResult.error?.message ||
            "The company invite could not be applied automatically.",
        },
      };
    }

    return { error: null };
  }

  return {
    error: {
      message:
        "The company invite could not be applied automatically because the server admin client is not configured.",
    },
  };
}

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
  const fullName = body?.fullName?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password?.trim() ?? "";
  const agreed = body?.agreed === true;

  if (!fullName || !email || !password) {
    return NextResponse.json(
      { error: "Full name, email, and password are required." },
      { status: 400 }
    );
  }

  if (!agreed) {
    return NextResponse.json(
      { error: "You must accept the agreement before creating an account." },
      { status: 400 }
    );
  }

  const companyInvite = await lookupCompanyInvite({
    publicClient,
    adminClient,
    email,
  });

  const pendingRole = companyInvite
    ? {
        role: companyInvite.role,
        team: companyInvite.team,
        company_id: companyInvite.company_id,
        account_status: companyInvite.account_status,
      }
    : {
        role: "viewer",
        team: "General",
        company_id: null,
        account_status: "active",
      };

  const { data, error } = await publicClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
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

  const consumeInviteResult = await ensureCompanyInviteApplied({
    publicClient,
    adminClient,
    userId: data.user.id,
    email,
    invite: companyInvite,
  });

  const defaultRolePayload = {
    user_id: data.user.id,
    role: pendingRole.role,
    team: pendingRole.team,
    company_id: pendingRole.company_id,
    account_status: pendingRole.account_status,
    created_by: data.user.id,
    updated_by: data.user.id,
  };

  const membershipPayload = companyInvite
    ? {
        user_id: data.user.id,
        company_id: companyInvite.company_id,
        role: pendingRole.role,
        status:
          pendingRole.account_status === "pending" ||
          pendingRole.account_status === "suspended"
            ? pendingRole.account_status
            : "active",
        created_by: data.user.id,
        updated_by: data.user.id,
      }
    : null;

  const [roleResult, membershipResult] = adminClient
    ? await Promise.all([
        adminClient.from("user_roles").upsert(defaultRolePayload, {
          onConflict: "user_id",
        }),
        membershipPayload
          ? adminClient.from("company_memberships").upsert(membershipPayload, {
              onConflict: "user_id,company_id",
            })
          : Promise.resolve({ error: null }),
      ])
    : [
        { error: null },
        { error: null },
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
    message: companyInvite
      ? pendingRole.account_status === "pending"
        ? "Account created. Your company invite was applied. Your company admin still needs to approve your access before you can enter the workspace."
        : "Account created. Your company invite was applied and your workspace access has been configured."
      : "Account created. Sign in to build your construction profile and continue into company setup or an invited company flow.",
    warning:
      roleResult.error
        ? roleResult.error.message ?? "Your account was created, but your workspace role could not be attached automatically."
        : consumeInviteResult.error
          ? consumeInviteResult.error.message ??
            "Your account was created, but the company invite could not be attached automatically."
        : membershipResult.error
          ? membershipResult.error.message ??
            "Your account was created, but the company membership could not be attached automatically."
        : agreementAcceptResult.error
          ? agreementAcceptResult.error.message ?? "Your agreement acceptance could not be recorded automatically."
        : null,
  });
}
