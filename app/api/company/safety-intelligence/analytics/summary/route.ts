import { NextResponse } from "next/server";
import { buildSafetyIntelligenceSummary } from "@/lib/safety-intelligence/analytics/summary";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ summary: null });
  }

  const url = new URL(request.url);
  const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
  const summary = await buildSafetyIntelligenceSummary(resolved.supabase, resolved.companyScope.companyId, jobsiteId);
  return NextResponse.json({ summary });
}
