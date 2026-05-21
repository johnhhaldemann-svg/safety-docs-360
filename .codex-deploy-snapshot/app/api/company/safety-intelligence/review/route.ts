import { NextResponse } from "next/server";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { buildSafetyReviewPayload } from "@/lib/safety-intelligence/review";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;

  const resolved = auth as SafetyIntelligenceAuthorized;
  const userEmail = resolved.user?.email?.trim().toLowerCase() ?? "";
  const isDemoRequest =
    resolved.role === "sales_demo" ||
    userEmail === OFFLINE_DEMO_EMAIL.toLowerCase();
  if (isDemoRequest) {
    const url = new URL(request.url);
    const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
    const rows = [
      {
        id: "demo-review-1",
        sourceType: "jsa_activity",
        title: "Crane-assisted steel placement",
        gapType: "permit",
        detail: "Hot work permit trigger present but permit reference is missing.",
        severity: "high",
        jobsite_id: "demo-jobsite-1",
      },
      {
        id: "demo-review-2",
        sourceType: "training_matrix",
        title: "Rigger recertification overdue (Crew B)",
        gapType: "training",
        detail: "Two riggers have expired lifting/rigging credentials.",
        severity: "medium",
        jobsite_id: "demo-jobsite-1",
      },
      {
        id: "demo-review-3",
        sourceType: "jsa_activity",
        title: "Electrical tie-in panel setup",
        gapType: "ppe",
        detail: "Arc-rated gloves and face shield confirmation not attached.",
        severity: "high",
        jobsite_id: "demo-jobsite-2",
      },
      {
        id: "demo-review-4",
        sourceType: "permit",
        title: "Night lift permit sequencing",
        gapType: "permit",
        detail: "Critical lift authorization is drafted but not countersigned.",
        severity: "medium",
        jobsite_id: "demo-jobsite-2",
      },
    ].filter((row) => !jobsiteId || row.jobsite_id === jobsiteId);
    const permitGaps = rows.filter((row) => row.gapType === "permit").length;
    const trainingGaps = rows.filter((row) => row.gapType === "training").length;
    const ppeGaps = rows.filter((row) => row.gapType === "ppe").length;
    return NextResponse.json({
      scope: "company",
      jobsiteId,
      rowCount: rows.length,
      summary: {
        totalGaps: rows.length,
        permitGaps,
        trainingGaps,
        ppeGaps,
      },
      rows: rows.map(({ jobsite_id: _jobsiteId, ...row }) => row),
      warning: null,
    });
  }
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({
      scope: "company",
      jobsiteId: null,
      rowCount: 0,
      summary: {
        totalGaps: 0,
        permitGaps: 0,
        trainingGaps: 0,
        ppeGaps: 0,
      },
      rows: [],
      warning: null,
    });
  }

  try {
    const url = new URL(request.url);
    const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
    const payload = await buildSafetyReviewPayload({
      supabase: resolved.supabase,
      companyId: resolved.companyScope.companyId,
      jobsiteId,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load safety review." },
      { status: 500 }
    );
  }
}
