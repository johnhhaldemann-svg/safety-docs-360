import { NextResponse } from "next/server";
import {
  normalizePlatformHelpTicketRow,
  validatePlatformHelpTicketUpdate,
} from "@/lib/platformHelpTickets";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSuperadmin(request);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const admin = createSupabaseAdminClient() ?? auth.supabase;
  const result = await admin
    .from("platform_help_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: "Help ticket not found." }, { status: 404 });
  }

  return NextResponse.json({
    ticket: normalizePlatformHelpTicketRow(result.data as Record<string, unknown>),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSuperadmin(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const validation = validatePlatformHelpTicketUpdate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createSupabaseAdminClient() ?? auth.supabase;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (validation.value.status) {
    patch.status = validation.value.status;
    if (validation.value.status === "resolved") {
      patch.resolved_at = now;
      patch.closed_at = null;
    } else if (validation.value.status === "closed") {
      patch.closed_at = now;
      patch.resolved_at = patch.resolved_at ?? now;
    } else {
      patch.resolved_at = null;
      patch.closed_at = null;
    }
  }

  if (validation.value.priority) patch.priority = validation.value.priority;
  if ("adminNotes" in validation.value) patch.admin_notes = validation.value.adminNotes;
  if ("resolutionNote" in validation.value) {
    patch.resolution_note = validation.value.resolutionNote;
  }
  if ("assignedSuperadminUserId" in validation.value) {
    patch.assigned_superadmin_user_id = validation.value.assignedSuperadminUserId;
  }
  if (validation.value.markSeen) {
    patch.superadmin_seen_at = now;
    patch.superadmin_seen_by = auth.user.id;
  }

  const result = await admin
    .from("platform_help_tickets")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: "Help ticket not found." }, { status: 404 });
  }

  return NextResponse.json({
    ticket: normalizePlatformHelpTicketRow(result.data as Record<string, unknown>),
  });
}

