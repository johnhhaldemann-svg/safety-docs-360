import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";

export const runtime = "nodejs";

function isMissingTable(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return m.includes("company_risk_ai_recommendations");
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_analytics",
      "can_view_all_company_data",
      "can_view_dashboards",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ recommendations: [] });
  }
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "12")));

  const res = await auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, kind, title, body, confidence, created_at, dismissed")
    .eq("company_id", companyScope.companyId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) {
    if (isMissingTable(res.error.message)) {
      return NextResponse.json({ recommendations: [], warning: "Recommendations table not migrated yet." });
    }
    return NextResponse.json({ error: res.error.message || "Failed to load recommendations." }, { status: 500 });
  }

  return NextResponse.json({ recommendations: res.data ?? [] });
}
