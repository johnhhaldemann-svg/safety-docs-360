import { NextResponse } from "next/server";
import { AI_KNOWLEDGE_LEARNING_CHECK_BATCH_TYPE, runAiKnowledgeLearningCheck } from "@/lib/aiKnowledgeMap/learningCheck";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";
export const maxDuration = 120;

type BatchRow = {
  id?: unknown;
  company_id?: unknown;
  batch_type?: unknown;
  status?: unknown;
  source_counts?: unknown;
  candidate_counts?: unknown;
  warnings?: unknown;
  metadata?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function camelBatch(row: BatchRow) {
  return {
    id: String(row.id ?? ""),
    companyId: text(row.company_id),
    batchType: String(row.batch_type ?? AI_KNOWLEDGE_LEARNING_CHECK_BATCH_TYPE),
    status: String(row.status ?? "pending_review"),
    sourceCounts: row.source_counts && typeof row.source_counts === "object" && !Array.isArray(row.source_counts) ? row.source_counts : {},
    candidateCounts: row.candidate_counts && typeof row.candidate_counts === "object" && !Array.isArray(row.candidate_counts) ? row.candidate_counts : {},
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function GET(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI learning batches." }, { status: 500 });

  const { searchParams } = new URL(request.url);
  let query = admin
    .from("ai_knowledge_ingest_batches")
    .select("*")
    .eq("batch_type", AI_KNOWLEDGE_LEARNING_CHECK_BATCH_TYPE)
    .order("created_at", { ascending: false })
    .limit(positiveInteger(searchParams.get("limit"), 8, 50));
  const companyId = searchParams.get("companyId");
  if (companyId && companyId !== "all") query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: (data ?? []).map((row) => camelBatch(row as BatchRow)) });
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Service role client is required for AI learning checks." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const companyId = text(body?.companyId);
  if (!companyId || companyId === "all") {
    return NextResponse.json({ error: "Select one company before running a manual AI learning check. All-company view is read-only." }, { status: 400 });
  }

  const result = await runAiKnowledgeLearningCheck(admin, {
    trigger: "manual",
    force: true,
    companyId,
    actorUserId: auth.user.id,
    maxDocuments: positiveInteger(body?.maxDocuments, 16, 75),
    maxInternetSources: positiveInteger(body?.maxInternetSources, 6, 25),
  });
  return NextResponse.json(result, { status: 201 });
}
