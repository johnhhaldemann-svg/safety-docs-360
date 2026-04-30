import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  getAiEngineMetrics,
  type AiEngineReadableClient,
} from "@/lib/superadmin/aiEngineOperations";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  const payload = await getAiEngineMetrics(adminClient, {
    surface: searchParams.get("surface"),
    since: searchParams.get("since"),
    limit: Number(searchParams.get("limit") ?? 1000),
  });

  return NextResponse.json(payload);
}
