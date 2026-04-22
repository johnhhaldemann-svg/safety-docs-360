import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { normalizeAppRole } from "@/lib/rbac";
import { buildCsepBuilderExpectationSummary } from "@/lib/csepCompletenessReviewBuilder";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import { parseCompletedCsepCompletenessReviewPostBody } from "@/lib/parseGcProgramAiReviewPostBody";
import { runAdHocCsepCompletenessReview } from "@/lib/runAdHocCsepCompletenessReview";

export const runtime = "nodejs";
export const maxDuration = 120;

function canRunCompletedCsepReview(role: string) {
  const normalized = normalizeAppRole(role);
  return normalized === "super_admin" || normalized === "internal_reviewer";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_approve_documents"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canRunCompletedCsepReview(auth.role)) {
    return NextResponse.json(
      { error: "Completed CSEP AI review can only be run by super admins or internal reviewers." },
      { status: 403 }
    );
  }

  const parsedBody = await parseCompletedCsepCompletenessReviewPostBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const builderConfig = await getDocumentBuilderTextConfig(auth.supabase);
  const builderExpectationSummary = buildCsepBuilderExpectationSummary(builderConfig);
  const result = await runAdHocCsepCompletenessReview({
    ...parsedBody.data,
    builderExpectationSummary,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    review: result.review,
    disclaimer: result.disclaimer,
    extraction: result.extraction,
    siteReferenceExtractions: result.siteReferenceExtraction,
    fileName: result.fileName,
  });
}
