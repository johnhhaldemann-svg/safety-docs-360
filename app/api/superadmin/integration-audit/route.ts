import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildProductionIntegrationAudit } from "@/lib/superadmin/integrationAudit";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handleIntegrationAudit(request: Request) {
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

  const audit = await buildProductionIntegrationAudit({
    admin: createSupabaseAdminClient(),
    liveVercelAccessError: "Vercel connector previously returned 403 Forbidden for this linked project.",
    knownAdvisorFindings: {
      notes: [
        "Supabase security advisor reported SECURITY DEFINER functions executable by anon/authenticated roles.",
        "Supabase security advisor reported extension vector installed in public.",
        "Supabase performance advisor reported missing FK indexes and duplicate permissive policies.",
      ],
    },
  });

  return NextResponse.json(audit);
}

export async function GET(request: Request) {
  return handleIntegrationAudit(request);
}

export async function POST(request: Request) {
  return handleIntegrationAudit(request);
}
