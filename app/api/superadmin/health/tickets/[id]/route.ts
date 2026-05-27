import { NextResponse } from "next/server";
import { authorizeSuperadminHealthRequest } from "@/lib/superadmin/health/auth";
import { tenantIdForScope } from "@/lib/superadmin/health/filters";
import { updateHealthHelpTicket } from "@/lib/superadmin/health/tickets";
import type { HealthSupabaseClient } from "@/lib/superadmin/health/types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeSuperadminHealthRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const client = (createSupabaseAdminClient() ?? auth.supabase) as unknown as HealthSupabaseClient;
    const ticket = await updateHealthHelpTicket(client, {
      id,
      tenantId: tenantIdForScope({
        tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
        companyId: typeof body.companyId === "string" ? body.companyId : null,
      }),
      actorUserId: auth.user.id,
      status: typeof body.status === "string" ? body.status : undefined,
      resolutionEvidence: typeof body.resolutionEvidence === "string" ? body.resolutionEvidence : null,
    });
    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update health ticket." },
      { status: 500 }
    );
  }
}
