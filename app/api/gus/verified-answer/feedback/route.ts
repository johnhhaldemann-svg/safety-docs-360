import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { FEEDBACK_TYPES, recordGusAnswerFeedback } from "@/lib/gusLearning";
import type { GusAnswerFeedbackType } from "@/lib/gusLearning/types";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const answerId = typeof body.answerId === "string" ? body.answerId.trim() : typeof body.answer_id === "string" ? body.answer_id.trim() : "";
  const feedbackType = body.feedbackType ?? body.feedback_type;
  if (!answerId || typeof feedbackType !== "string" || !(FEEDBACK_TYPES as readonly string[]).includes(feedbackType)) {
    return NextResponse.json({ error: "answerId and a valid feedbackType are required." }, { status: 400 });
  }
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  }).catch(() => ({ companyId: null }));
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const result = await recordGusAnswerFeedback(admin, {
    answerId,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    projectId: typeof body.projectId === "string" ? body.projectId : typeof body.project_id === "string" ? body.project_id : null,
    feedbackType: feedbackType as GusAnswerFeedbackType,
    comment: typeof body.comment === "string" ? body.comment : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ feedback: result.feedback }, { status: 201 });
}
