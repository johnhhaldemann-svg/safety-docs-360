import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  TERMS_VERSION,
  acceptUserAgreement,
  getClientIpAddress,
  getUserAgreementRecord,
} from "@/lib/legal";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { allowSuspended: true });

  if ("error" in auth) {
    return auth.error;
  }

  const agreementResult = await getUserAgreementRecord(auth.supabase, auth.user.id);

  return NextResponse.json({
    acceptedTerms: Boolean(agreementResult.data?.accepted_terms),
    acceptedAt: agreementResult.data?.accepted_at ?? null,
    termsVersion: agreementResult.data?.terms_version ?? TERMS_VERSION,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { allowSuspended: true });

  if ("error" in auth) {
    return auth.error;
  }

  const ipAddress = getClientIpAddress(request);
  const { error } = await acceptUserAgreement({
    supabase: auth.supabase,
    userId: auth.user.id,
    ipAddress,
    termsVersion: TERMS_VERSION,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    acceptedTerms: true,
    termsVersion: TERMS_VERSION,
  });
}
