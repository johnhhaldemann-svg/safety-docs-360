import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canApproveGusLearning, isAllowedTrustLevel, updateApprovedSource } from "@/lib/gusLearning";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canApproveGusLearning(auth.role)) {
    return NextResponse.json({ error: "Only company admins can change approved source trust levels." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const { id } = await context.params;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  const companyId = requestedCompanyId ?? companyScope.companyId;
  if (requestedCompanyId && companyScope.companyId && requestedCompanyId !== companyScope.companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }
  if (!companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Only platform admins can edit global approved sources." }, { status: 403 });
  }

  const trustLevelRaw = body.trustLevel ?? body.trust_level;
  const trustLevel = isAllowedTrustLevel(trustLevelRaw) ? trustLevelRaw : undefined;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const result = await updateApprovedSource(admin, {
    sourceId: id,
    companyId,
    trustLevel,
    isActive: typeof body.isActive === "boolean" ? body.isActive : typeof body.is_active === "boolean" ? body.is_active : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ source: result.source });
}
