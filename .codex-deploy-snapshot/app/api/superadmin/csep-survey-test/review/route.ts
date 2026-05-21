import { NextResponse } from "next/server";
import { generateBuilderProgramAiReview } from "@/lib/builderDocumentAiReview";
import {
  buildSurveyTestEnrichment,
  buildSurveyTestReviewSeedText,
  type SurveyTestFormData,
} from "@/lib/csepSurveyTest";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

function requireSuperAdmin(role: string) {
  return role.trim().toLowerCase() === "super_admin";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { requireAdmin: true });

  if ("error" in auth) {
    return auth.error;
  }

  if (!requireSuperAdmin(auth.role)) {
    return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as SurveyTestFormData;
    const enrichment = buildSurveyTestEnrichment(body);
    const { review, disclaimer } = await generateBuilderProgramAiReview({
      documentText: buildSurveyTestReviewSeedText(body, enrichment),
      programLabel: "Survey Test CSEP",
      projectName: body.project_name?.trim() || "Survey Test CSEP",
      documentTitle: "Survey / Layout requirements overview",
      companyName: body.contractor_company?.trim() || "SafetyDocs360",
      additionalReviewerContext:
        "This is a superadmin-only survey test builder. Review whether the derived hazards, permits, training, and document package are ready for a trial DOCX export before live rollout.",
    });

    return NextResponse.json({
      review,
      disclaimer,
      enrichment,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Survey Test CSEP AI review.",
      },
      { status: 500 }
    );
  }
}
