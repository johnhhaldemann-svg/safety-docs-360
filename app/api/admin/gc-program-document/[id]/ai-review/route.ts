import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  DOCUMENT_AI_REVIEW_ROLE_FORBIDDEN_ERROR,
  isDocumentAiReviewerRole,
} from "@/lib/documentAiReviewAuth";
import { runGcProgramDocumentAiReview } from "@/lib/runGcProgramAiReview";
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

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 }
    );
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

  const body = (await request.json().catch(() => null)) as
    | { additionalGcContext?: string | null }
    | null;
  const additionalGcContext = typeof body?.additionalGcContext === "string" ? body.additionalGcContext : "";

  const result = await runGcProgramDocumentAiReview(admin, documentId, additionalGcContext);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    review: result.review,
    disclaimer: result.disclaimer,
    extraction: result.extraction,
    documentId: result.documentId,
  });
}
