import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import {
  loadOwnerValidationOverview,
  type OwnerValidationSupabaseClient,
} from "@/lib/superadmin/ownerValidation";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function requireOwnerValidationSuperadmin(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (normalizeAppRole(auth.role) !== "super_admin") {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  return auth;
}

export async function GET(request: Request) {
  const auth = await requireOwnerValidationSuperadmin(request);

  if (auth instanceof Response) {
    return auth;
  }

  if (!auth) {
    return NextResponse.json({ error: "Unable to verify Super Admin access." }, { status: 403 });
  }

  const admin = (createSupabaseAdminClient() ?? auth.supabase) as unknown as OwnerValidationSupabaseClient;
  const overview = await loadOwnerValidationOverview(admin);

  return NextResponse.json(overview, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
