import { NextResponse } from "next/server";
import { reviewKnowledgeIngestCandidates } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

function candidateIds(body: Record<string, unknown> | null) {
  const ids = Array.isArray(body?.candidateIds) ? body?.candidateIds : [body?.candidateId];
  return ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim());
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map candidate approval." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = candidateIds(body);
  if (ids.length === 0) return NextResponse.json({ error: "candidateId or candidateIds is required." }, { status: 400 });

  const result = await reviewKnowledgeIngestCandidates(admin, {
    candidateIds: ids,
    status: "approved",
    reason: typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "Super Admin approved candidate for trusted graph memory.",
    actorUserId: auth.user.id,
    promoteApproved: body?.promoteApproved !== false,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
