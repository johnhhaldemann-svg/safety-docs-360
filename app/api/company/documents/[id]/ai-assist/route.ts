import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { parseBuilderProgramAiReviewPostBody } from "@/lib/parseGcProgramAiReviewPostBody";
import { retrieveMemoryForQuery } from "@/lib/companyMemory/repository";
import { runBuilderProgramDocumentAiReview } from "@/lib/runBuilderProgramAiReview";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Company-scoped draft check for builder programs (CSEP / PSHSEP / PESHEP).
 * Same model output as internal review, but only for documents in the caller's company.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_submit_documents",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const rl = checkFixedWindowRateLimit(`company-doc-ai-assist:${auth.user.id}`, {
    windowMs: 60_000,
    max: 5,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many draft checks. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company context for draft check." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 500 });
  }

  const { id } = await context.params;
  const documentId = id.trim();
  if (!documentId) {
    return NextResponse.json({ error: "Document id is required." }, { status: 400 });
  }

  const parsedBody = await parseBuilderProgramAiReviewPostBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { additionalReviewerContext, siteDocument } = parsedBody.data;

  let companyMemoryExcerpts: string | null = null;
  if (companyScope.companyId) {
    const memoryQuery = [
      additionalReviewerContext,
      "construction safety site program PPE hazards controls requirements",
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 2000);
    const { chunks } = await retrieveMemoryForQuery(auth.supabase, companyScope.companyId, memoryQuery, {
      topK: 8,
    });
    if (chunks.length > 0) {
      companyMemoryExcerpts = chunks
        .map(
          (c, i) =>
            `[${i + 1}] (${c.source}) ${c.title}\n${c.body.slice(0, 4000)}${c.body.length > 4000 ? "\n…" : ""}`
        )
        .join("\n\n");
    }
  }

  const result = await runBuilderProgramDocumentAiReview(
    admin,
    documentId,
    additionalReviewerContext,
    siteDocument,
    { allowedCompanyId: companyScope.companyId, companyMemoryExcerpts }
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  serverLog("info", "company_builder_document_ai_assist", {
    companyId: companyScope.companyId,
    userId: auth.user.id,
    documentId: result.documentId,
    programLabel: result.programLabel,
  });

  return NextResponse.json({
    review: result.review,
    disclaimer: result.disclaimer,
    extraction: result.extraction,
    siteReferenceExtraction: result.siteReferenceExtraction,
    documentId: result.documentId,
    programLabel: result.programLabel,
  });
}
