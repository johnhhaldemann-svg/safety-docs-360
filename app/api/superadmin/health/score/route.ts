import { NextResponse } from "next/server";
import { authorizeSuperadminHealthRequest } from "@/lib/superadmin/health/auth";
import { normalizeHealthScopeFilters } from "@/lib/superadmin/health/filters";
import { calculateSuperadminHealthScore } from "@/lib/superadmin/health/score";
import type { HealthSupabaseClient } from "@/lib/superadmin/health/types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const client = (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
    const score = await calculateSuperadminHealthScore(
      client,
      normalizeHealthScopeFilters(searchParams),
      auth.user.id
    );
    return NextResponse.json(score);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to calculate health score." },
      { status: 500 }
    );
  }
}
