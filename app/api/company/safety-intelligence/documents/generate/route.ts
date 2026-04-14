import { NextResponse } from "next/server";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { runSafetyIntelligenceDocumentPipeline } from "@/lib/safety-intelligence/documents/pipeline";
import { authorizeSafetyIntelligenceRequest, type SafetyIntelligenceAuthorized } from "@/lib/safety-intelligence/http";
import { parseRawTaskInput } from "@/lib/safety-intelligence/validation/intake";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ documents: [] });
  }

  const url = new URL(request.url);
  const jobsiteId = url.searchParams.get("jobsiteId")?.trim() || null;
  let query = resolved.supabase
    .from("company_generated_documents")
    .select("id, document_type, title, status, generated_at, created_at")
    .eq("company_id", resolved.companyScope.companyId)
    .order("generated_at", { ascending: false })
    .limit(20);
  if (jobsiteId) {
    query = query.eq("jobsite_id", jobsiteId);
  }

  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load generated documents." }, { status: 500 });
  }

  return NextResponse.json({ documents: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeSafetyIntelligenceRequest(request, {
    requireAnyPermission: ["can_create_documents", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const resolved = auth as SafetyIntelligenceAuthorized;
  if (!resolved.companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseRawTaskInput(body.input ?? body);
    const documentType = String(body.documentType ?? "jsa") as Parameters<typeof runSafetyIntelligenceDocumentPipeline>[0]["documentType"];
    const riskMemory = await buildRiskMemoryStructuredContext(resolved.supabase, resolved.companyScope.companyId, {
      jobsiteId: input.jobsiteId ?? null,
      days: 90,
    });

    const pipeline = await runSafetyIntelligenceDocumentPipeline({
      supabase: resolved.supabase,
      actorUserId: resolved.user.id,
      input: { ...input, companyId: resolved.companyScope.companyId },
      documentType,
      riskMemorySummary: (riskMemory ?? null) as any,
    });

    return NextResponse.json(pipeline);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate document pipeline." },
      { status: 400 }
    );
  }
}
