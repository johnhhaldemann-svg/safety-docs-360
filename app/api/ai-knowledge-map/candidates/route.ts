import { NextResponse } from "next/server";
import { listKnowledgeIngestCandidates } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";
import { recallApprovabilityBatch } from "@/lib/aiApprovalRecall";
import type { AiKnowledgeCandidateStatus, AiKnowledgeCandidateType } from "@/lib/aiKnowledgeMap/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map candidates." }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const result = await listKnowledgeIngestCandidates(admin, {
    companyId: searchParams.get("companyId"),
    status: searchParams.get("status") as AiKnowledgeCandidateStatus | "all" | null,
    candidateType: searchParams.get("candidateType") as AiKnowledgeCandidateType | "all" | null,
    batchId: searchParams.get("batchId"),
    limit: Number(searchParams.get("limit") ?? 100),
  });

  // Attach an approvability recall verdict per candidate (best-effort, one extra query).
  const verdicts = await recallApprovabilityBatch(
    admin,
    "knowledge_map_candidate",
    result.candidates.map((candidate) => ({
      id: candidate.id,
      sourceType: candidate.candidateType,
      category: candidate.relationshipType,
      content: [candidate.title, candidate.semanticSummary].filter(Boolean).join(" — "),
    }))
  );
  const candidates = result.candidates.map((candidate) => ({
    ...candidate,
    recall: verdicts.get(candidate.id) ?? null,
  }));

  return NextResponse.json({ ...result, candidates });
}
