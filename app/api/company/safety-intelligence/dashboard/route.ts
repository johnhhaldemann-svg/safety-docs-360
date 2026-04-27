import { NextResponse } from "next/server";
import { buildSafetyIntelligenceSummary } from "@/lib/safety-intelligence/analytics/summary";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { loadMergedTradeLibrary } from "@/lib/safety-intelligence/library";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  const isDemoRequest =
    resolved.role === "sales_demo" ||
    (resolved.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    const url = new URL(request.url);
    const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
    const scopedConflictItems = [
      {
        id: "demo-conflict-1",
        title: "Hot work near temporary fuel storage",
        severity: "high",
        rationale: "Permit sequencing and fire watch controls must be aligned.",
        jobsite_id: "demo-jobsite-1",
      },
      {
        id: "demo-conflict-2",
        title: "Simultaneous crane pick + overhead energization",
        severity: "critical",
        rationale: "Line-of-fire and electrical separation controls are incomplete.",
        jobsite_id: "demo-jobsite-1",
      },
      {
        id: "demo-conflict-3",
        title: "Night shift lift during restricted lighting window",
        severity: "medium",
        rationale: "Visibility controls and spotter handoff incomplete.",
        jobsite_id: "demo-jobsite-2",
      },
      {
        id: "demo-conflict-4",
        title: "MEP overhead routing above active access path",
        severity: "high",
        rationale: "Public egress overlap requires temporary barricade routing.",
        jobsite_id: "demo-jobsite-2",
      },
    ].filter((item) => !jobsiteId || item.jobsite_id === jobsiteId);
    return NextResponse.json({
      summary: {
        totals: {
          bucketRuns: jobsiteId ? 7 : 18,
          aiReviews: jobsiteId ? 5 : 12,
          openConflicts: scopedConflictItems.length,
          generatedDocuments: jobsiteId ? 6 : 14,
        },
        topTrades: [
          { code: "structural_steel", count: jobsiteId === "demo-jobsite-2" ? 2 : 6 },
          { code: "electrical", count: jobsiteId === "demo-jobsite-1" ? 3 : 5 },
          { code: "mechanical", count: 4 },
        ],
        topHazards: [
          { code: "line_of_fire", count: jobsiteId === "demo-jobsite-2" ? 2 : 5 },
          { code: "fall_from_height", count: 4 },
          { code: "electrical_contact", count: 3 },
        ],
        openConflictItems: scopedConflictItems.map(({ jobsite_id: _jobsiteId, ...item }) => item),
      },
      trades: [
        { code: "structural_steel", name: "Structural steel" },
        { code: "electrical", name: "Electrical" },
        { code: "mechanical", name: "Mechanical" },
        { code: "civil", name: "Civil / Earthworks" },
      ],
      liveConflicts: scopedConflictItems.map((item) => ({
        id: item.id,
        conflict_code:
          item.id === "demo-conflict-1"
            ? "HOTWORK_FUEL_PROXIMITY"
            : item.id === "demo-conflict-2"
              ? "CRANE_ELECTRICAL_OVERLAP"
              : item.id === "demo-conflict-3"
                ? "LOW_LIGHT_LIFT_WINDOW"
                : "OVERHEAD_ROUTE_CONFLICT",
        severity: item.severity,
        rationale: item.rationale,
      })),
    });
  }
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
