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
