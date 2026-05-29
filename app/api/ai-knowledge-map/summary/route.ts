import { NextResponse } from "next/server";
import { getKnowledgeGraphPayload } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const payload = await getKnowledgeGraphPayload(createSupabaseAdminClient(), {
    companyId: searchParams.get("companyId"),
    query: searchParams.get("q"),
    project: searchParams.get("project"),
    category: searchParams.get("category"),
    riskLevel: searchParams.get("riskLevel") as never,
    trade: searchParams.get("trade"),
    sourceType: searchParams.get("sourceType") as never,
    dateRange: searchParams.get("dateRange"),
  });

  return NextResponse.json({
    summary: payload.summary,
    generatedAt: payload.generatedAt,
    demo: payload.demo,
    fallback: payload.fallback,
    fallbackReason: payload.fallbackReason,
    companySpecificNodeCount: payload.companySpecificNodeCount,
    companySpecificEdgeCount: payload.companySpecificEdgeCount,
    companyDocumentNodeCount: payload.companyDocumentNodeCount,
    sharedLibraryNodeCount: payload.sharedLibraryNodeCount,
    warnings: payload.warnings,
  });
}
