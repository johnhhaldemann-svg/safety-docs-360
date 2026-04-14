import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  DOCUMENT_AI_REVIEW_ROLE_FORBIDDEN_ERROR,
  isDocumentAiReviewerRole,
} from "@/lib/documentAiReviewAuth";
import { parseBuilderProgramAiReviewPostBody } from "@/lib/parseGcProgramAiReviewPostBody";
import { runBuilderProgramDocumentAiReview } from "@/lib/runBuilderProgramAiReview";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_approve_documents",
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!isDocumentAiReviewerRole(auth.role)) {
    return NextResponse.json({ error: DOCUMENT_AI_REVIEW_ROLE_FORBIDDEN_ERROR }, { status: 403 });
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

  const result = await runBuilderProgramDocumentAiReview(
    admin,
    documentId,
    additionalReviewerContext,
    siteDocument
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    review: result.review,
    disclaimer: result.disclaimer,
    extraction: result.extraction,
    siteReferenceExtraction: result.siteReferenceExtraction,
    documentId: result.documentId,
    programLabel: result.programLabel,
  });
}
