import { NextResponse } from "next/server";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { buildSafetyReviewPayload } from "@/lib/safety-intelligence/review";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request);
  if ("error" in auth) return auth.error;

  const resolved = auth as SafetyIntelligenceAuthorized;
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
