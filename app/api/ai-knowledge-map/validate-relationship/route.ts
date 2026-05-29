import { NextResponse } from "next/server";
import { updateKnowledgeRelationshipValidation } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";
import type { AiKnowledgeValidationStatus } from "@/lib/aiKnowledgeMap/types";

export const runtime = "nodejs";

const REVIEW_STATUSES = new Set<AiKnowledgeValidationStatus>(["approved", "rejected", "incorrect"]);

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map validation." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const edgeId = typeof body?.edgeId === "string" && body.edgeId.trim() ? body.edgeId.trim() : null;
  const status = typeof body?.status === "string" ? (body.status as AiKnowledgeValidationStatus) : null;
  if (!edgeId) return NextResponse.json({ error: "edgeId is required." }, { status: 400 });
  if (!status || !REVIEW_STATUSES.has(status)) {
    return NextResponse.json({ error: "status must be approved, rejected, or incorrect." }, { status: 400 });
  }

  const result = await updateKnowledgeRelationshipValidation(admin, {
    edgeId,
    status: status as Exclude<AiKnowledgeValidationStatus, "pending_review" | "needs_review" | "unreviewed">,
    reason: typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : `Super Admin marked relationship ${status}.`,
    actorUserId: auth.user.id,
  });
  return NextResponse.json(result);
}
