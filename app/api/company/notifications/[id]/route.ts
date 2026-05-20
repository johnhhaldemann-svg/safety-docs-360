import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { normalizeNotificationRow } from "@/lib/companyNotifications";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_reports", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace." }, { status: 400 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { read?: boolean; archived?: boolean }
    | null;
  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {};

  if (body?.read === true) patch.read_at = now;
  if (body?.read === false) patch.read_at = null;
  if (body?.archived === true) patch.archived_at = now;
  if (body?.archived === false) patch.archived_at = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No notification update requested." }, { status: 400 });
  }

  const result = await auth.supabase
    .from("company_notifications")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .eq("recipient_user_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  return NextResponse.json({
    notification: normalizeNotificationRow(result.data as Record<string, unknown>),
  });
}

