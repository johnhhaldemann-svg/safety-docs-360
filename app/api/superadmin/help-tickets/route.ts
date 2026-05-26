import { NextResponse } from "next/server";
import {
  isPlatformHelpTicketPriority,
  isPlatformHelpTicketStatus,
  normalizePlatformHelpTicketRow,
  summarizePlatformHelpTickets,
} from "@/lib/platformHelpTickets";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireSuperadmin(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) return auth;
  if (normalizeAppRole(auth.role) !== "super_admin") {
    return {
      error: NextResponse.json(
        { error: "Super admin access required." },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function GET(request: Request) {
  const auth = await requireSuperadmin(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status");
  const rawPriority = searchParams.get("priority");
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 100) || 100, 200));
  const admin = createSupabaseAdminClient() ?? auth.supabase;

  let query = admin
    .from("platform_help_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rawStatus && rawStatus !== "all") {
    if (!isPlatformHelpTicketStatus(rawStatus)) {
      return NextResponse.json({ error: "Unsupported ticket status." }, { status: 400 });
    }
    query = query.eq("status", rawStatus);
  }

  if (rawPriority && rawPriority !== "all") {
    if (!isPlatformHelpTicketPriority(rawPriority)) {
      return NextResponse.json({ error: "Unsupported ticket priority." }, { status: 400 });
    }
    query = query.eq("priority", rawPriority);
  }

  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const tickets = ((result.data ?? []) as Array<Record<string, unknown>>).map(
    normalizePlatformHelpTicketRow
  );

  return NextResponse.json({
    tickets,
    summary: summarizePlatformHelpTickets(tickets),
  });
}

