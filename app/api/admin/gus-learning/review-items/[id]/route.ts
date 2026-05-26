import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { canReviewGusLearning, updateGusLearningReviewItemStatus } from "@/lib/gusLearning";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canReviewGusLearning(auth.role)) {
    return NextResponse.json({ error: "You do not have access to Gus learning review items." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  const companyId = requestedCompanyId ?? companyScope.companyId;
  if (!companyId) return NextResponse.json({ error: "No company workspace is linked to this request." }, { status: 400 });
  if (requestedCompanyId && companyScope.companyId && requestedCompanyId !== companyScope.companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const statusByAction = {
    start_review: "in_review",
    resolve: "resolved",
    archive: "archived",
  } as const;
  const status = statusByAction[action as keyof typeof statusByAction];
  if (!status) return NextResponse.json({ error: "Unsupported review item action." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const result = await updateGusLearningReviewItemStatus(admin, {
    reviewItemId: id,
    companyId,
    status,
    reviewerId: auth.user.id,
    reviewNotes: typeof body.reviewNotes === "string" ? body.reviewNotes : typeof body.review_notes === "string" ? body.review_notes : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ reviewItem: result.reviewItem });
}
