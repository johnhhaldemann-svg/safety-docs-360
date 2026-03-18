import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  acceptUserAgreement,
  getClientIpAddress,
  getUserAgreementRecord,
} from "@/lib/legal";
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

  return NextResponse.json({
    acceptedTerms: Boolean(
      agreementResult.data?.accepted_terms &&
        agreementResult.data?.terms_version === agreementConfig.version
    ),
    acceptedAt: agreementResult.data?.accepted_at ?? null,
    termsVersion: agreementResult.data?.terms_version ?? agreementConfig.version,
    currentVersion: agreementResult.data?.terms_version === agreementConfig.version,
    requiredTermsVersion: agreementConfig.version,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { allowSuspended: true });

  if ("error" in auth) {
    return auth.error;
  }

  const agreementConfig = await getAgreementConfig(auth.supabase);
  const ipAddress = getClientIpAddress(request);
  const { error } = await acceptUserAgreement({
    supabase: auth.supabase,
    userId: auth.user.id,
    ipAddress,
    termsVersion: agreementConfig.version,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    acceptedTerms: true,
    termsVersion: agreementConfig.version,
  });
}
