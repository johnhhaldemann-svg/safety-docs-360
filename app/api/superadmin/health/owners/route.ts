import { NextResponse } from "next/server";
import { authorizeSuperadminHealthRequest } from "@/lib/superadmin/health/auth";
import { normalizeHealthScopeFilters } from "@/lib/superadmin/health/filters";
import { listOwnerRegistry, upsertOwnerRegistryRecord } from "@/lib/superadmin/health/ownerRegistry";
import type { HealthSupabaseClient } from "@/lib/superadmin/health/types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const client = (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
    const owners = await listOwnerRegistry(client, normalizeHealthScopeFilters(new URL(request.url).searchParams));
    return NextResponse.json({ owners });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load owner registry." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const ownerUserId = typeof body.ownerUserId === "string" ? body.ownerUserId : "";
    if (!ownerUserId) {
      return NextResponse.json({ error: "ownerUserId is required." }, { status: 400 });
    }

    const client = (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
    const owner = await upsertOwnerRegistryRecord(client, {
      id: typeof body.id === "string" ? body.id : null,
      tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
      ownerType: typeof body.ownerType === "string" ? body.ownerType : "platform_owner",
      ownerUserId,
      companyId: typeof body.companyId === "string" ? body.companyId : null,
      jobsiteId: typeof body.jobsiteId === "string" ? body.jobsiteId : null,
      objectType: typeof body.objectType === "string" ? body.objectType : null,
      objectId: typeof body.objectId === "string" ? body.objectId : null,
      validationStatus:
        body.validationStatus === "verified" ||
        body.validationStatus === "pending_verification" ||
        body.validationStatus === "conflicting_owner" ||
        body.validationStatus === "unauthorized_owner" ||
        body.validationStatus === "expired_authority" ||
        body.validationStatus === "requires_second_approval"
          ? body.validationStatus
          : "pending_verification",
      authorityLevel:
        body.authorityLevel === "standard" ||
        body.authorityLevel === "elevated" ||
        body.authorityLevel === "critical" ||
        body.authorityLevel === "second_approval"
          ? body.authorityLevel
          : "standard",
      startsAt: typeof body.startsAt === "string" ? body.startsAt : null,
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
      actorUserId: auth.user.id,
    });
    return NextResponse.json({ owner }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upsert owner registry record." },
      { status: 500 }
    );
  }
}
