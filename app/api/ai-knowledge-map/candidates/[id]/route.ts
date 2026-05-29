import { NextResponse } from "next/server";
import { getKnowledgeIngestCandidate } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map candidates." }, { status: 500 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const result = await getKnowledgeIngestCandidate(admin, id);
  return NextResponse.json(result);
}
