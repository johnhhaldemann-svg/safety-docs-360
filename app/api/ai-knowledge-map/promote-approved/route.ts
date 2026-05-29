import { NextResponse } from "next/server";
import { promoteApprovedKnowledgeCandidates } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map promotion." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await promoteApprovedKnowledgeCandidates(admin, {
    companyId: typeof body?.companyId === "string" ? body.companyId : null,
    batchId: typeof body?.batchId === "string" ? body.batchId : null,
    limit: typeof body?.limit === "number" ? body.limit : 100,
    actorUserId: auth.user.id,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
