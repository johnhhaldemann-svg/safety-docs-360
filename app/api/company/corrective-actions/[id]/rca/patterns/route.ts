import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { detectRepeatPatterns } from "@/lib/rcaPatterns";

export const runtime = "nodejs";
export const maxDuration = 30;

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/company/corrective-actions/[id]/rca/patterns
// Returns repeat pattern analysis for the given corrective action.
// Called by the RCA panel on load to surface recurring incident warnings.
export async function GET(request: Request, { params }: RouteParams) {
  const { id: actionId } = await params;
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const url = new URL(request.url);
  const generateInsight = url.searchParams.get("insight") !== "false";

  // Load the corrective action to get category, severity, jobsite
  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, title, category, severity, jobsite_id")
    .eq("id", actionId)
    .eq("company_id", companyScope.companyId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (actionResult.error || !actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }

  const action = actionResult.data as {
    id: string;
    title: string;
    category: string;
    severity: string;
    jobsite_id: string | null;
  };

  const result = await detectRepeatPatterns({
    supabase: auth.supabase,
    companyId: companyScope.companyId,
    actionId,
    category: action.category,
    severity: action.severity,
    jobsiteId: action.jobsite_id,
    caTitle: action.title,
    windowDays: 90,
    generateInsight,
  });

  return NextResponse.json(result);
}
