import { NextResponse } from "next/server";
import { rebuildKnowledgeIndex } from "@/lib/aiKnowledgeMap/repository";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";
import { aiKnowledgeMapActionError } from "../route-helpers";

export const runtime = "nodejs";

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI Knowledge Map rebuilds." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const companyId = text(body?.companyId);
  if (!companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  if (companyId === "all") return NextResponse.json({ error: "All-company view is read-only. Select one company before rebuilding the AI Knowledge Map." }, { status: 400 });

  try {
    const result = await rebuildKnowledgeIndex(admin, {
      companyId,
      actorUserId: auth.user.id,
      generateEmbeddings: body?.generateEmbeddings === true,
      limitPerTable: positiveInteger(body?.limitPerTable, 80, 250),
      maxEmbeddingAttempts: positiveInteger(body?.maxEmbeddingAttempts, 24, 80),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return aiKnowledgeMapActionError(error, "Rebuild failed.");
  }
}
