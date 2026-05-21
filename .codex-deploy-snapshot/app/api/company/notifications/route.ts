import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { normalizeNotificationRow } from "@/lib/companyNotifications";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "1";
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 20) || 20, 50));

  let query = auth.supabase
    .from("company_notifications")
    .select("*")
    .eq("company_id", companyScope.companyId)
    .eq("recipient_user_id", auth.user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const [items, unread] = await Promise.all([
    query,
    auth.supabase
      .from("company_notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyScope.companyId)
      .eq("recipient_user_id", auth.user.id)
      .is("read_at", null)
      .is("archived_at", null),
  ]);

  if (items.error) {
    return NextResponse.json({ error: items.error.message }, { status: 500 });
  }
  if (unread.error) {
    return NextResponse.json({ error: unread.error.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: ((items.data ?? []) as Array<Record<string, unknown>>).map(normalizeNotificationRow),
    unreadCount: unread.count ?? 0,
  });
}

