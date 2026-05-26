import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canReviewGusLearning } from "@/lib/gusLearning";
import { listGusLearningOverview, markExpiredKnowledgeForReview } from "@/lib/gusLearning/repository";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canReviewGusLearning(auth.role)) {
    return NextResponse.json({ error: "You do not have access to Gus learning review." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = new URL(request.url).searchParams.get("companyId")?.trim() || null;
  const companyId = requestedCompanyId ?? companyScope.companyId;
  if (!companyId) return NextResponse.json({ error: "No company workspace is linked to this request." }, { status: 400 });
  if (requestedCompanyId && companyScope.companyId && requestedCompanyId !== companyScope.companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  await markExpiredKnowledgeForReview(admin, companyId, auth.user.id);
  const result = await listGusLearningOverview(admin, companyId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.overview);
}
