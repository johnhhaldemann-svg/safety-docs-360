import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { AiImprovementSupabaseClient } from "@/lib/superadmin/aiImprovementRequests";

export const AI_IMPROVEMENT_ROUTE_RUNTIME = "nodejs";

export function requestIpAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export function requestUserAgent(request: Request) {
  return request.headers.get("user-agent");
}

export function getAiImprovementClient(fallback: unknown) {
  return (createSupabaseAdminClient() ?? fallback) as AiImprovementSupabaseClient;
}

export async function requireAiImprovementSuperadmin(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (normalizeAppRole(auth.role) !== "super_admin") {
    return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  }

  return auth;
}

