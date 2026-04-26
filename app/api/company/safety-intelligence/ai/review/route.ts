import { NextResponse } from "next/server";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { generateDocumentDraft } from "@/lib/safety-intelligence/ai/documentGenerationService";
import { generateRiskIntelligence } from "@/lib/safety-intelligence/ai/riskIntelligenceService";
import { buildAiReviewContext } from "@/lib/safety-intelligence/service";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { persistAiReview } from "@/lib/safety-intelligence/repository";
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
    const documentType = String(body.documentType ?? "jsa") as Parameters<typeof generateDocumentDraft>[0]["documentType"];
    const riskMemory = await buildRiskMemoryStructuredContext(resolved.supabase, resolved.companyScope.companyId, {
      jobsiteId: input.jobsiteId ?? null,
      days: 90,
    });
    const setup = buildAiReviewContext({
      input: { ...input, companyId: resolved.companyScope.companyId },
      bucket: buildBucketedWorkItem({ ...input, companyId: resolved.companyScope.companyId }),
      riskMemorySummary: (riskMemory ?? null) as JsonObject | null,
    });
    const reviewContext = {
      ...setup.context,
      documentType,
    };
    const [document, risk] = await Promise.all([
      generateDocumentDraft({ reviewContext, documentType }),
      generateRiskIntelligence({ reviewContext }),
    ]);

    const aiReviewId = await persistAiReview(
      resolved.supabase,
      reviewContext,
      "combined",
      {
        document: document.record,
        risk: risk.record,
      },
      resolved.user.id,
      document.model ?? risk.model,
      document.promptHash ?? risk.promptHash
    );

    return NextResponse.json({
      aiReviewId,
      reviewContext,
      document: document.record,
      risk: risk.record,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to review with AI." },
      { status: 400 }
    );
  }
}
