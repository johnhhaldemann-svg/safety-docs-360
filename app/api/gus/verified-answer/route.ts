import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { retrieveTrustedKnowledgeGraphMemory } from "@/lib/aiKnowledgeMap/trustedMemory";
import { retrieveMemoryForQuery } from "@/lib/companyMemory";
import { buildVerifiedSafetyAnswer, canAskGusVerifiedQuestions, recordGusAnswerAudit, retrieveApprovedKnowledge } from "@/lib/gusLearning";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canAskGusVerifiedQuestions(auth.role)) {
    return NextResponse.json({ error: "You do not have access to Gus verified answers." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "question is required." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  }).catch(() => ({ companyId: null }));
  const requestedCompanyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  const companyId = requestedCompanyId ?? companyScope.companyId;
  if (!companyId) return NextResponse.json({ error: "No company workspace is linked to this request." }, { status: 400 });
  if (requestedCompanyId && companyScope.companyId && requestedCompanyId !== companyScope.companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : typeof body.project_id === "string" ? body.project_id : null;

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const knowledge = await retrieveApprovedKnowledge(db, {
    companyId,
    projectId,
    question,
    topK: typeof body.topK === "number" ? body.topK : 8,
  });
  if (!knowledge.ok) return NextResponse.json({ error: knowledge.error }, { status: 500 });

  const memory = await retrieveMemoryForQuery(auth.supabase, companyId, question, { topK: 4 }).catch(() => ({
    chunks: [],
    method: "none" as const,
  }));
  const graphMemory = await retrieveTrustedKnowledgeGraphMemory(db, {
    companyId,
    projectId,
    query: question,
    topK: 4,
  }).catch(() => ({ items: [], method: "none" as const, warnings: ["Approved graph memory unavailable."] }));
  const answer = buildVerifiedSafetyAnswer({
    question,
    companyId,
    projectId,
    knowledge: knowledge.items,
    uploadedDocumentMatches: memory.chunks,
    graphMemoryMatches: graphMemory.items,
  });
  const selectedKnowledgeIds = answer.citations.map((citation) => citation.knowledgeId);
  const selected = new Set(selectedKnowledgeIds);
  const rejectedCandidateIds = knowledge.items.map((item) => item.id).filter((id) => !selected.has(id));
  const audit = await recordGusAnswerAudit(db, {
    userId: auth.user.id,
    companyId,
    projectId,
    question,
    answer,
    retrievalMethod: knowledge.method,
    selectedKnowledgeIds,
    rejectedCandidateIds,
    retrievalTrace: {
      ...(knowledge.trace ?? {}),
      approvedKnowledgeMethod: knowledge.method,
      uploadedDocumentMethod: memory.method,
      uploadedDocumentCount: memory.chunks.length,
      trustedGraphMethod: graphMemory.method,
      trustedGraphCount: graphMemory.items.length,
      trustedGraphWarnings: graphMemory.warnings,
    },
    citationSnippets: answer.citationSnippets,
    qualitySignals: answer.qualitySignals,
  });

  return NextResponse.json({
    ...answer,
    answerAuditId: audit.ok ? audit.audit.id : null,
    retrieval: {
      approvedKnowledge: knowledge.method,
      uploadedDocuments: memory.method,
      trustedGraph: graphMemory.method,
    },
    retrievalTrace: audit.ok ? audit.audit.retrieval_trace : knowledge.trace ?? {},
    qualitySignals: answer.qualitySignals,
  });
}
