import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_all_company_data", "can_view_reports"],
  });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) return NextResponse.json({ error: "No company scope found." }, { status: 400 });

  const logs = await auth.supabase
    .from("sor_audit_log")
    .select("*")
    .eq("company_id", scope.companyId)
    .eq("sor_id", id)
    .order("timestamp", { ascending: false });
  if (logs.error) return NextResponse.json({ error: logs.error.message || "Failed to load audit history." }, { status: 500 });

  return NextResponse.json({ logs: logs.data ?? [] });
}
