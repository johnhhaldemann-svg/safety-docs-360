import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import {
  approveResearchFinding,
  canApproveGusLearning,
  canReviewGusLearning,
  REQUIRED_CONTROL_TYPES,
  updateResearchFindingStatus,
} from "@/lib/gusLearning";
import type { GusRequiredControlType, GusResearchStatus } from "@/lib/gusLearning/types";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : undefined;
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canReviewGusLearning(auth.role)) {
    return NextResponse.json({ error: "You do not have access to review Gus learning findings." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  const requestedCompanyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  const companyId = requestedCompanyId ?? companyScope.companyId;
  if (!companyId) return NextResponse.json({ error: "No company workspace is linked to this request." }, { status: 400 });
  if (requestedCompanyId && companyScope.companyId && requestedCompanyId !== companyScope.companyId && !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Requested company is not available for this account." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const action = typeof body.action === "string" ? body.action : "";
  if (action === "approve") {
    if (!canApproveGusLearning(auth.role)) {
      return NextResponse.json({ error: "Only company admins can approve verified knowledge." }, { status: 403 });
    }
    const requiredControlType = body.requiredControlType ?? body.required_control_type;
    if (typeof requiredControlType !== "string" || !(REQUIRED_CONTROL_TYPES as readonly string[]).includes(requiredControlType)) {
      return NextResponse.json({ error: "A valid required_control_type is required." }, { status: 400 });
    }
    const approvedSummary = typeof body.approvedSummary === "string" ? body.approvedSummary.trim() : typeof body.approved_summary === "string" ? body.approved_summary.trim() : "";
    const reviewDueDate = typeof body.reviewDueDate === "string" ? body.reviewDueDate : typeof body.review_due_date === "string" ? body.review_due_date : "";
    if (!approvedSummary || !reviewDueDate) {
      return NextResponse.json({ error: "approvedSummary and reviewDueDate are required." }, { status: 400 });
    }
    const result = await approveResearchFinding(admin, {
      findingId: id,
      companyId,
      approvedBy: auth.user.id,
      approvedSummary,
      knowledgeTitle: typeof body.knowledgeTitle === "string" ? body.knowledgeTitle : typeof body.knowledge_title === "string" ? body.knowledge_title : null,
      regulationReference: typeof body.regulationReference === "string" ? body.regulationReference : typeof body.regulation_reference === "string" ? body.regulation_reference : null,
      appliesTo: typeof body.appliesTo === "string" ? body.appliesTo : typeof body.applies_to === "string" ? body.applies_to : null,
      affectedModules: stringArray(body.affectedModules ?? body.affected_modules),
      requiredControlType: requiredControlType as GusRequiredControlType,
      jurisdiction: typeof body.jurisdiction === "string" ? body.jurisdiction : null,
      reviewDueDate,
      citationExcerpt: typeof body.citationExcerpt === "string" ? body.citationExcerpt : typeof body.citation_excerpt === "string" ? body.citation_excerpt : null,
      citationLocator: typeof body.citationLocator === "string" ? body.citationLocator : typeof body.citation_locator === "string" ? body.citation_locator : null,
      sourceContentHash:
        typeof body.sourceContentHash === "string" ? body.sourceContentHash : typeof body.source_content_hash === "string" ? body.source_content_hash : null,
      verificationNotes:
        typeof body.verificationNotes === "string" ? body.verificationNotes : typeof body.verification_notes === "string" ? body.verification_notes : null,
      supersedesKnowledgeId:
        typeof body.supersedesKnowledgeId === "string"
          ? body.supersedesKnowledgeId
          : typeof body.supersedes_knowledge_id === "string"
            ? body.supersedes_knowledge_id
            : null,
      reviewerNotes: typeof body.reviewerNotes === "string" ? body.reviewerNotes : typeof body.reviewer_notes === "string" ? body.reviewer_notes : null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ knowledge: result.knowledge });
  }

  const statusByAction: Record<string, Exclude<GusResearchStatus, "approved">> = {
    reject: "rejected",
    request_more_review: "needs_more_review",
    archive: "archived",
  };
  const status = statusByAction[action];
  if (!status) return NextResponse.json({ error: "Unsupported review action." }, { status: 400 });
  const result = await updateResearchFindingStatus(admin, {
    findingId: id,
    companyId,
    status,
    reviewerId: auth.user.id,
    reviewerNotes: typeof body.reviewerNotes === "string" ? body.reviewerNotes : typeof body.reviewer_notes === "string" ? body.reviewer_notes : null,
    affectedModules: stringArray(body.affectedModules ?? body.affected_modules),
    jurisdiction: typeof body.jurisdiction === "string" ? body.jurisdiction : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ finding: result.finding });
}
