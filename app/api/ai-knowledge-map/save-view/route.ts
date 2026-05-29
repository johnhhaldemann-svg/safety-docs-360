import { NextResponse } from "next/server";
import { saveKnowledgeMapView } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map saved views." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "AI Knowledge Map View";
  const filters = body?.filters && typeof body.filters === "object" && !Array.isArray(body.filters) ? body.filters as Record<string, unknown> : {};
  const layoutSettings = body?.layoutSettings && typeof body.layoutSettings === "object" && !Array.isArray(body.layoutSettings) ? body.layoutSettings as Record<string, unknown> : {};
  const result = await saveKnowledgeMapView(admin, {
    userId: auth.user.id,
    name,
    filters,
    layoutSettings,
  });
  return NextResponse.json(result, { status: 201 });
}
