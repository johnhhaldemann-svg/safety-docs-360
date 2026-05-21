import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    return NextResponse.json({ updated: 0 });
  }

  const now = new Date().toISOString();
  const result = await auth.supabase
    .from("company_notifications")
    .update({ read_at: now })
    .eq("company_id", companyScope.companyId)
    .eq("recipient_user_id", auth.user.id)
    .is("read_at", null)
    .is("archived_at", null)
    .select("id");

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: (result.data ?? []).length });
}

