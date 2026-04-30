import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  getAiEngineFeedback,
  recordAiEngineFeedback,
  type AiEngineFeedbackOutcome,
  type AiEngineReadableClient,
} from "@/lib/superadmin/aiEngineOperations";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

const OUTCOMES = new Set<AiEngineFeedbackOutcome>([
  "accepted",
  "edited",
  "rejected",
  "regenerated",
  "field-used",
]);

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  const payload = await getAiEngineFeedback(adminClient, {
    surface: searchParams.get("surface"),
    since: searchParams.get("since"),
    limit: Number(searchParams.get("limit") ?? 100),
  });

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const surface = optionalText(body?.surface);
  const outcome = optionalText(body?.outcome);
  if (!surface) {
    return NextResponse.json({ error: "surface is required." }, { status: 400 });
  }
  if (!outcome || !OUTCOMES.has(outcome as AiEngineFeedbackOutcome)) {
    return NextResponse.json({ error: "A valid outcome is required." }, { status: 400 });
  }

  const rating = typeof body?.rating === "number" ? body.rating : null;
  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  const result = await recordAiEngineFeedback(adminClient, {
    surface,
    outcome: outcome as AiEngineFeedbackOutcome,
    rating,
    sourceId: optionalText(body?.source_id) ?? optionalText(body?.sourceId),
    aiReviewId: optionalText(body?.ai_review_id) ?? optionalText(body?.aiReviewId),
    editedText: optionalText(body?.edited_text) ?? optionalText(body?.editedText),
    reason: optionalText(body?.reason),
    createdBy: auth.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ feedback: result.feedback }, { status: 201 });
}
