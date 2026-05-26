import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  canApproveGusLearning,
  createApprovedSource,
  defaultTrustLevelForSource,
  isAllowedSourceType,
  isAllowedTrustLevel,
} from "@/lib/gusLearning";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canApproveGusLearning(auth.role)) {
    return NextResponse.json({ error: "Only company admins can add approved sources." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  if (requestedCompanyId && companyScope.companyId && requestedCompanyId !== companyScope.companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }
  const companyId = requestedCompanyId ?? companyScope.companyId;
  if (!companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Only platform admins can create global approved sources." }, { status: 403 });
  }

  const sourceType = body.sourceType ?? body.source_type;
  if (!isAllowedSourceType(sourceType)) {
    return NextResponse.json({ error: "A valid source_type is required." }, { status: 400 });
  }
  const trustLevelRaw = body.trustLevel ?? body.trust_level;
  const trustLevel = isAllowedTrustLevel(trustLevelRaw)
    ? trustLevelRaw
    : defaultTrustLevelForSource(sourceType, typeof body.domain === "string" ? body.domain : "");

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const result = await createApprovedSource(admin, {
    companyId,
    sourceName: String(body.sourceName ?? body.source_name ?? ""),
    sourceUrl: String(body.sourceUrl ?? body.source_url ?? ""),
    domain: typeof body.domain === "string" ? body.domain : null,
    sourceType,
    jurisdiction: String(body.jurisdiction ?? "Federal"),
    trustLevel,
    isActive: body.isActive !== false && body.is_active !== false,
    createdBy: auth.user.id,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ source: result.source }, { status: 201 });
}
