import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { buildCyberSecuritySnapshot } from "@/lib/superadmin/cyberSecurityMonitor";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 30;

async function handleCyberSecurity(request: Request) {
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

  const payload = await buildCyberSecuritySnapshot({
    admin: createSupabaseAdminClient(),
    requestUrl: request.url,
  });

  return NextResponse.json(payload);
}

export async function GET(request: Request) {
  return handleCyberSecurity(request);
}

export async function POST(request: Request) {
  return handleCyberSecurity(request);
}
