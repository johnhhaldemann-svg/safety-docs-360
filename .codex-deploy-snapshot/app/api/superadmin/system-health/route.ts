import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { runSystemHealthScan } from "@/lib/superadmin/runSystemHealthScan";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Cross-tenant diagnostics; service role used only server-side. */
export const maxDuration = 60;

async function handleSystemHealth(request: Request) {
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

  const admin = createSupabaseAdminClient();
  const payload = await runSystemHealthScan(admin);

  return NextResponse.json(payload);
}

export async function GET(request: Request) {
  return handleSystemHealth(request);
}

/** Idempotent: same body as GET; use from the UI "Run Health Check" control. */
export async function POST(request: Request) {
  return handleSystemHealth(request);
}
