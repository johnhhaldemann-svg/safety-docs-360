import { NextResponse } from "next/server";
import {
  authorizeRequest,
  formatAppRole,
  isAdminRole,
} from "@/lib/rbac";
import { TERMS_VERSION, getUserAgreementRecord } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { allowSuspended: true });

  if ("error" in auth) {
    return auth.error;
  }

  const [agreementResult, agreementConfig] = await Promise.all([
    getUserAgreementRecord(auth.supabase, auth.user.id),
    getAgreementConfig(auth.supabase),
  ]);
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
      isAdmin: isAdminRole(auth.role),
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
