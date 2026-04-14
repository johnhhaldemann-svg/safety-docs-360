import { NextResponse } from "next/server";
import { buildSafetyIntelligenceSummary } from "@/lib/safety-intelligence/analytics/summary";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { loadMergedTradeLibrary } from "@/lib/safety-intelligence/library";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ summary: null, trades: [] });
  }

  const url = new URL(request.url);
  const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
  const [summary, trades, liveConflicts] = await Promise.all([
    buildSafetyIntelligenceSummary(resolved.supabase, resolved.companyScope.companyId, jobsiteId),
    loadMergedTradeLibrary(resolved.supabase, resolved.companyScope.companyId),
    resolved.supabase
      .from("company_conflict_pairs")
      .select("id, conflict_code, severity, rationale")
      .eq("company_id", resolved.companyScope.companyId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  return NextResponse.json({
    summary,
    trades,
    liveConflicts: liveConflicts.data ?? [],
  });
}
