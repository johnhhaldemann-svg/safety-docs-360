import { NextResponse } from "next/server";
import { authorizeSuperadminHealthRequest } from "@/lib/superadmin/health/auth";
import { normalizeHealthScopeFilters } from "@/lib/superadmin/health/filters";
import { createHealthHelpTicket, listHealthHelpTickets } from "@/lib/superadmin/health/tickets";
import type { HealthSupabaseClient } from "@/lib/superadmin/health/types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const client = (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
    const tickets = await listHealthHelpTickets(client, normalizeHealthScopeFilters(new URL(request.url).searchParams));
    return NextResponse.json({ tickets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load health tickets." },
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
    const ticket = await createHealthHelpTicket(client, {
      tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
      companyId: typeof body.companyId === "string" ? body.companyId : null,
      jobsiteId: typeof body.jobsiteId === "string" ? body.jobsiteId : null,
      submitterUserId: auth.user.id,
      submitterEmail: auth.user.email ?? null,
      submitterName: typeof body.submitterName === "string" ? body.submitterName : null,
      submitterRole: auth.role,
      companyName: typeof body.companyName === "string" ? body.companyName : null,
      sourceType: typeof body.sourceType === "string" ? body.sourceType : "manual",
      sourceId: typeof body.sourceId === "string" ? body.sourceId : null,
      title: typeof body.title === "string" ? body.title : "SuperAdmin Health ticket",
      description: typeof body.description === "string" ? body.description : "A SuperAdmin Health issue needs review.",
      severity:
        body.severity === "critical" || body.severity === "high" || body.severity === "medium" || body.severity === "low"
          ? body.severity
          : "medium",
      ownerId: typeof body.ownerId === "string" ? body.ownerId : null,
      rootCause: typeof body.rootCause === "string" ? body.rootCause : null,
      recommendedFix: typeof body.recommendedFix === "string" ? body.recommendedFix : null,
      dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
      metadata: body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : {},
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create health ticket." },
      { status: 500 }
    );
  }
}
