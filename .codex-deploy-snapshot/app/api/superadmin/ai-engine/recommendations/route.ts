import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  getAiEngineRecommendationSnapshot,
  refreshAiEngineRecommendationSnapshot,
  type AiEngineReadableClient,
} from "@/lib/superadmin/aiEngineOperations";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

function toWindowDays(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 7;
}

export async function GET(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  const payload = await getAiEngineRecommendationSnapshot(adminClient, {
    surface: searchParams.get("surface"),
    windowDays: toWindowDays(searchParams.get("windowDays")),
  });

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const surface = typeof body?.surface === "string" && body.surface.trim() ? body.surface.trim() : "all";
  const windowDays = typeof body?.windowDays === "number" ? body.windowDays : 7;
  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  const result = await refreshAiEngineRecommendationSnapshot(adminClient, {
    surface,
    windowDays,
    generatedBy: auth.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 201 });
}
