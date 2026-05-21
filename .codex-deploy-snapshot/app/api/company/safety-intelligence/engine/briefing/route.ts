import { NextResponse } from "next/server";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { buildDailyRiskBriefing } from "@/lib/safety-intelligence/engine/dailyBriefing";
import { buildSmartSafetyAiReviewContext } from "@/lib/safety-intelligence/engine/orchestrator";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { parseRawTaskInput } from "@/lib/safety-intelligence/validation/intake";
import type { JsonObject } from "@/types/safety-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseRawTaskInput(body.input ?? body);
    const scoped = { ...input, companyId: resolved.companyScope.companyId };
    const riskMemory = await buildRiskMemoryStructuredContext(resolved.supabase, resolved.companyScope.companyId, {
      jobsiteId: scoped.jobsiteId ?? null,
      days: 90,
    });
    const { reviewContext } = await buildSmartSafetyAiReviewContext({
      input: scoped,
      bucket: buildBucketedWorkItem(scoped),
      riskMemorySummary: (riskMemory ?? null) as JsonObject | null,
      supabase: resolved.supabase,
    });
    const briefing = buildDailyRiskBriefing(reviewContext);
    return NextResponse.json({
      briefing,
      smartSafetyProvenance: reviewContext.smartSafetyProvenance ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build briefing." },
      { status: 400 }
    );
  }
}
