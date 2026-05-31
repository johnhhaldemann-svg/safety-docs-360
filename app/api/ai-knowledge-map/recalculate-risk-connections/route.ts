import { NextResponse } from "next/server";
import { recalculateKnowledgeRelationships } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";
import { aiKnowledgeMapActionError } from "../route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map recalculation." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const companyId = typeof body?.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  if (!companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  if (companyId === "all") return NextResponse.json({ error: "All-company view is read-only. Select one company before recalculating relationships." }, { status: 400 });

  try {
    const result = await recalculateKnowledgeRelationships(admin, {
      companyId,
      actorUserId: auth.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return aiKnowledgeMapActionError(error, "Recalculation failed.");
  }
}
