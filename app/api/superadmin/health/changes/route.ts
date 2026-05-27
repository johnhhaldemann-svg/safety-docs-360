import { NextResponse } from "next/server";
import { authorizeSuperadminHealthRequest } from "@/lib/superadmin/health/auth";
import { listChangeLog, recordChangeLog } from "@/lib/superadmin/health/changeLog";
import { normalizeHealthScopeFilters } from "@/lib/superadmin/health/filters";
import type { HealthSupabaseClient } from "@/lib/superadmin/health/types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const client = (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
    const changes = await listChangeLog(client, normalizeHealthScopeFilters(new URL(request.url).searchParams));
    return NextResponse.json({ changes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load changes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const client = (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
    const change = await recordChangeLog(client, {
      tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
      companyId: typeof body.companyId === "string" ? body.companyId : null,
      jobsiteId: typeof body.jobsiteId === "string" ? body.jobsiteId : null,
      changedByUserId: auth.user.id,
      ownerId: typeof body.ownerId === "string" ? body.ownerId : null,
      objectType: typeof body.objectType === "string" ? body.objectType : "manual_change",
      objectId: typeof body.objectId === "string" ? body.objectId : "manual",
      changeType: typeof body.changeType === "string" ? body.changeType : "manual_change_recorded",
      beforeValue: body.beforeValue ?? null,
      afterValue: body.afterValue ?? null,
      reason: typeof body.reason === "string" ? body.reason : null,
      riskLevel:
        body.riskLevel === "critical" || body.riskLevel === "high" || body.riskLevel === "medium" || body.riskLevel === "low"
          ? body.riskLevel
          : "medium",
      rollbackAvailable: body.rollbackAvailable === true,
    });
    return NextResponse.json({ change }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record change." },
      { status: 500 }
    );
  }
}
