import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  authorizeRequest,
  formatAppRole,
  getPermissionMap,
  getRolePermissions,
  getUserRoleContext,
  isAdminRole,
} from "@/lib/rbac";
import {
  TERMS_VERSION,
  getDefaultAgreementConfig,
  getUserAgreementRecord,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  job_title: string | null;
  trade_specialty: string | null;
  years_experience: number | null;
  phone: string | null;
  city: string | null;
  state_region: string | null;
  readiness_status: string | null;
  certifications: string[] | null;
  specialties: string[] | null;
  equipment: string[] | null;
  bio: string | null;
  photo_url: string | null;
  photo_path: string | null;
  profile_complete: boolean | null;
};

type CompanyInviteLookupRow = {
  id: string;
  role: string;
  team: string;
  company_id: string;
  account_status: string;
};

async function applyPendingCompanyInvite(params: {
  supabase: {
    from: (table: string) => unknown;
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data?: unknown; error: { message?: string | null } | null }>;
  };
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  email: string;
  userMetadata?: Record<string, unknown> | null;
  appMetadata?: Record<string, unknown> | null;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const inviteLookupResult = await params.supabase.rpc("lookup_company_invite", {
    invite_email: normalizedEmail,
  });
  const invite =
    ((inviteLookupResult.data as CompanyInviteLookupRow[] | null) ?? [])[0] ?? null;

  if (!invite) {
    return;
  }

  const consumeInviteResult = await params.supabase.rpc("consume_company_invite", {
    invite_email: normalizedEmail,
    invited_user_id: params.userId,
  });

  if (!consumeInviteResult.error) {
    if (params.adminClient) {
      await params.adminClient.auth.admin.updateUserById(params.userId, {
        user_metadata: {
          ...(params.userMetadata ?? {}),
          role: invite.role,
          team: invite.team,
          company_id: invite.company_id,
          account_status: invite.account_status,
        },
        app_metadata: {
          ...(params.appMetadata ?? {}),
          role: invite.role,
          team: invite.team,
          company_id: invite.company_id,
          account_status: invite.account_status,
        },
      });
    }
    return;
  }

  if (!params.adminClient) {
    return;
  }

  const membershipStatus =
    invite.account_status === "pending" || invite.account_status === "suspended"
      ? invite.account_status
      : "active";
  const nowIso = new Date().toISOString();

  await Promise.all([
    (
      params.adminClient.from("user_roles") as unknown as {
        upsert: (
          values: Record<string, unknown>,
          options?: Record<string, unknown>
        ) => Promise<{ error: { message?: string | null } | null }>;
      }
    ).upsert(
      {
        user_id: params.userId,
        role: invite.role,
        team: invite.team,
        company_id: invite.company_id,
        account_status: invite.account_status,
        created_by: params.userId,
        updated_by: params.userId,
      },
      { onConflict: "user_id" }
    ),
    (
      params.adminClient.from("company_memberships") as unknown as {
        upsert: (
          values: Record<string, unknown>,
          options?: Record<string, unknown>
        ) => Promise<{ error: { message?: string | null } | null }>;
      }
    ).upsert(
      {
        user_id: params.userId,
        company_id: invite.company_id,
        role: invite.role,
        status: membershipStatus,
        created_by: params.userId,
        updated_by: params.userId,
      },
      { onConflict: "user_id,company_id" }
    ),
    (
      params.adminClient.from("company_invites") as unknown as {
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message?: string | null } | null }>;
        };
      }
    )
      .update({
        consumed_at: nowIso,
        consumed_by: params.userId,
        updated_at: nowIso,
        updated_by: params.userId,
      })
      .eq("id", invite.id),
    params.adminClient.auth.admin.updateUserById(params.userId, {
      user_metadata: {
        ...(params.userMetadata ?? {}),
        role: invite.role,
        team: invite.team,
        company_id: invite.company_id,
        account_status: invite.account_status,
      },
      app_metadata: {
        ...(params.appMetadata ?? {}),
        role: invite.role,
        team: invite.team,
        company_id: invite.company_id,
        account_status: invite.account_status,
      },
    }),
  ]);
}

function getFallbackFullName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return metadataFullName.trim() || user.email?.split("@")[0] || "";
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error;
  }

  const initialCompanyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
  const adminClient = createSupabaseAdminClient();

  const shouldAutoApplyCompanyInvite =
    auth.role === "viewer" &&
    !initialCompanyScope.companyId &&
    !isAdminRole(auth.role) &&
    !auth.permissionMap.can_access_internal_admin;

  if (shouldAutoApplyCompanyInvite) {
    await applyPendingCompanyInvite({
      supabase: auth.supabase as never,
      adminClient,
      userId: auth.user.id,
      email: auth.user.email ?? "",
      userMetadata: auth.user.user_metadata ?? undefined,
      appMetadata: auth.user.app_metadata ?? undefined,
    });
  }

  const refreshedRoleContext = shouldAutoApplyCompanyInvite
    ? await getUserRoleContext({
        supabase: auth.supabase,
        user: auth.user,
      })
    : {
        role: auth.role,
        team: auth.team,
        accountStatus: auth.accountStatus,
      };

  const agreementConfigPromise = getAgreementConfig(auth.supabase).catch(() =>
    getDefaultAgreementConfig()
  );
  const [agreementResult, agreementConfig] = await Promise.all([
    getUserAgreementRecord(
      auth.supabase,
      auth.user.id,
      auth.user.user_metadata ?? undefined
    ),
    agreementConfigPromise,
  ]);
  const companyScope = shouldAutoApplyCompanyInvite
    ? await getCompanyScope({
        supabase: auth.supabase,
        userId: auth.user.id,
        fallbackTeam: auth.team,
      })
    : initialCompanyScope;
  const companyProfile =
    companyScope.companyId
      ? await auth.supabase
          .from("companies")
          .select(
            "id, name, team_key, industry, phone, website, address_line_1, city, state_region, postal_code, country, primary_contact_name, primary_contact_email, status"
          )
          .eq("id", companyScope.companyId)
          .maybeSingle()
      : null;
  const userProfileResult = await auth.supabase
    .from("user_profiles")
    .select(
      "user_id, full_name, preferred_name, job_title, trade_specialty, years_experience, phone, city, state_region, readiness_status, certifications, specialties, equipment, bio, photo_url, photo_path, profile_complete"
    )
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const userProfile = !userProfileResult.error
    ? ((userProfileResult.data as UserProfileRow | null) ?? null)
    : null;
  const fallbackFullName = getFallbackFullName(auth.user);
  const acceptedTerms = Boolean(
    agreementResult.data?.accepted_terms &&
      (agreementResult.data?.terms_version ?? "") === agreementConfig.version
  );

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email ?? "",
      role: refreshedRoleContext.role,
      roleLabel: formatAppRole(refreshedRoleContext.role),
      team: refreshedRoleContext.team,
      companyId: companyScope.companyId,
      companyName: companyScope.companyName,
      profile: {
        userId: auth.user.id,
        fullName: userProfile?.full_name?.trim() || fallbackFullName,
        preferredName: userProfile?.preferred_name?.trim() || "",
        jobTitle: userProfile?.job_title?.trim() || "",
        tradeSpecialty: userProfile?.trade_specialty?.trim() || "",
        yearsExperience: userProfile?.years_experience ?? null,
        phone: userProfile?.phone?.trim() || "",
        city: userProfile?.city?.trim() || "",
        stateRegion: userProfile?.state_region?.trim() || "",
        readinessStatus: userProfile?.readiness_status?.trim() || "ready",
        certifications: userProfile?.certifications ?? [],
        specialties: userProfile?.specialties ?? [],
        equipment: userProfile?.equipment ?? [],
        bio: userProfile?.bio?.trim() || "",
        photoUrl: userProfile?.photo_url?.trim() || "",
        photoPath: userProfile?.photo_path?.trim() || "",
      },
      profileComplete: Boolean(userProfile?.profile_complete),
      companyProfile:
        companyProfile && !companyProfile.error ? companyProfile.data ?? null : null,
      isAdmin: isAdminRole(refreshedRoleContext.role),
      permissions: getRolePermissions(refreshedRoleContext.role),
      permissionMap: getPermissionMap(refreshedRoleContext.role),
      accountStatus: refreshedRoleContext.accountStatus,
      acceptedTerms,
      acceptedTermsAt: agreementResult.data?.accepted_at ?? null,
      termsVersion: agreementResult.data?.terms_version ?? TERMS_VERSION,
      agreementCurrent:
        (agreementResult.data?.terms_version ?? "") === agreementConfig.version,
      requiredTermsVersion: agreementConfig.version,
    },
  });
}
