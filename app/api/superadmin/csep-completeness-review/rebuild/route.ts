import { NextResponse } from "next/server";
import { buildCsepBuilderExpectationSummary } from "@/lib/csepCompletenessReviewBuilder";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import { parseCompletedCsepCompletenessReviewPostBody } from "@/lib/parseGcProgramAiReviewPostBody";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";
import { runAdHocCompletedCsepRebuild } from "@/lib/runAdHocCompletedCsepRebuild";

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
      { error: "Completed CSEP rebuild can only be run by super admins or internal reviewers." },
      { status: 403 }
    );
  }

  const parsedBody = await parseCompletedCsepCompletenessReviewPostBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const builderConfig = await getDocumentBuilderTextConfig(auth.supabase);
  const builderExpectationSummary = buildCsepBuilderExpectationSummary(builderConfig);
  const result = await runAdHocCompletedCsepRebuild({
    ...parsedBody.data,
    builderExpectationSummary,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(Buffer.from(result.body), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
