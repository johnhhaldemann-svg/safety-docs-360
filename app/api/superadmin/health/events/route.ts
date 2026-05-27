import { NextResponse } from "next/server";
import { authorizeSuperadminHealthRequest } from "@/lib/superadmin/health/auth";
import { listEventLog, recordEventLog } from "@/lib/superadmin/health/eventLog";
import { normalizeHealthScopeFilters } from "@/lib/superadmin/health/filters";
import type { HealthSupabaseClient } from "@/lib/superadmin/health/types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function getClient(auth: Awaited<ReturnType<typeof authorizeSuperadminHealthRequest>>) {
  if ("error" in auth) throw new Error("Authorization failed.");
  return (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
}

export async function GET(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const events = await listEventLog(getClient(auth), normalizeHealthScopeFilters(new URL(request.url).searchParams));
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load events." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const event = await recordEventLog(getClient(auth), {
      tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
      companyId: typeof body.companyId === "string" ? body.companyId : null,
      jobsiteId: typeof body.jobsiteId === "string" ? body.jobsiteId : null,
      actorUserId: auth.user.id,
      ownerId: typeof body.ownerId === "string" ? body.ownerId : null,
      module: typeof body.module === "string" ? body.module : "superadmin_health",
      objectType: typeof body.objectType === "string" ? body.objectType : "manual_event",
      objectId: typeof body.objectId === "string" ? body.objectId : null,
      action: typeof body.action === "string" ? body.action : "manual_event_recorded",
      severity: body.severity === "critical" || body.severity === "high" || body.severity === "medium" || body.severity === "low" ? body.severity : "medium",
      eventStatus: "recorded",
      metadata: body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : {},
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record event." },
      { status: 500 }
    );
  }
}
