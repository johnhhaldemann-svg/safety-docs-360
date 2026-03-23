import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  authorizeRequest,
  formatAppRole,
  isAdminRole,
} from "@/lib/rbac";
import {
  TERMS_VERSION,
  getDefaultAgreementConfig,
  getUserAgreementRecord,
} from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";

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
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
  });
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
      role: auth.role,
      roleLabel: formatAppRole(auth.role),
      team: auth.team,
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
      isAdmin: isAdminRole(auth.role),
      permissions: auth.permissions,
      permissionMap: auth.permissionMap,
      accountStatus: auth.accountStatus,
      acceptedTerms,
      acceptedTermsAt: agreementResult.data?.accepted_at ?? null,
      termsVersion: agreementResult.data?.terms_version ?? TERMS_VERSION,
      agreementCurrent:
        (agreementResult.data?.terms_version ?? "") === agreementConfig.version,
      requiredTermsVersion: agreementConfig.version,
    },
  });
}
