import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { canViewCompanyTrainingMatrix } from "@/lib/companyTrainingAccess";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { requestAiResponsesText } from "@/lib/ai/responses";
import {
  type ReadinessAiReview,
  type ReadinessAiRowFinding,
  type ReadinessRow,
  type ReadinessStatus,
  type ReadinessSummary,
} from "@/lib/readinessMatrix";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set<ReadinessStatus>([
  "ready",
  "expiring_soon",
  "gap",
  "blocked",
  "needs_review",
]);

function clampScore(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asString(value: unknown, max = 700) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseAiReview(text: string): ReadinessAiReview | null {
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const rowFindingsRaw = Array.isArray(record.rowFindings) ? record.rowFindings : [];
  const rowFindings: ReadinessAiRowFinding[] = [];
  for (const item of rowFindingsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const status = typeof row.status === "string" && ALLOWED_STATUSES.has(row.status as ReadinessStatus)
      ? (row.status as ReadinessStatus)
      : undefined;
    const rowId = asString(row.rowId, 120);
    if (!rowId) continue;
    rowFindings.push({
      rowId,
      status,
      score: clampScore(row.score),
      explanation: asString(row.explanation, 600) || undefined,
      confidence: typeof row.confidence === "number" && Number.isFinite(row.confidence)
        ? Math.max(0, Math.min(1, row.confidence))
        : undefined,
    });
  }

  return {
    overallScore: clampScore(record.overallScore) ?? null,
    summary: asString(record.summary, 900) || "AI review completed.",
    prioritizedActions: Array.isArray(record.prioritizedActions)
      ? record.prioritizedActions.map((item) => asString(item, 240)).filter(Boolean).slice(0, 8)
      : [],
    rowFindings: rowFindings.slice(0, 40),
  };
}

function fallbackReview(params: {
  rows: ReadinessRow[];
  summary: ReadinessSummary | null;
  reason: string;
}): ReadinessAiReview {
  const actions = [
    params.summary?.blocked ? "Resolve blocked workers before assigning work." : "",
    params.summary?.gap ? "Close training and credential gaps for in-scope requirements." : "",
    params.summary?.expiringSoon ? "Schedule renewals for credentials expiring soon." : "",
    params.summary?.needsReview ? "Review incomplete profiles and ambiguous scope assignments." : "",
  ].filter(Boolean);
  return {
    overallScore: null,
    summary: "AI readiness review is unavailable, so deterministic readiness results remain the source of truth.",
    prioritizedActions: actions.length ? actions : ["Review deterministic readiness statuses."],
    rowFindings: params.rows.slice(0, 20).map((row) => ({
      rowId: row.id,
      status: row.deterministicStatus,
      score: row.readinessScore,
      explanation: row.recommendedNextAction,
      confidence: 1,
    })),
    fallbackUsed: true,
    fallbackReason: params.reason,
  };
}

function compactRow(row: ReadinessRow) {
  return {
    id: row.id,
    type: row.personType,
    name: row.name,
    trade: row.trade,
    position: row.position,
    jobsite: row.jobsiteName,
    deterministicStatus: row.deterministicStatus,
    status: row.status,
    blockers: row.blockers.slice(0, 3).map((item) => item.detail),
    gaps: row.gaps.slice(0, 4).map((item) => item.detail),
    expiring: row.expiring.slice(0, 3).map((item) => item.detail),
    reviewItems: row.reviewItems.slice(0, 3).map((item) => item.detail),
    operationalSignals: (row.operationalSignals ?? []).slice(0, 5).map((item) => ({
      type: item.type,
      severity: item.severity,
      count: item.count,
      detail: item.detail,
    })),
  };
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;
  if (!canViewCompanyTrainingMatrix(auth.role, auth.permissionMap)) {
    return NextResponse.json({ error: "You do not have access to readiness review." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    summary?: ReadinessSummary | null;
    rows?: ReadinessRow[];
  } | null;
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 80) : [];
  const summary = body?.summary ?? null;
  if (rows.length === 0) {
    return NextResponse.json({ error: "rows are required." }, { status: 400 });
  }

  const model =
    process.env.READINESS_MATRIX_AI_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel("gpt-4o-mini");
  const input = [
    "You are scoring workforce safety readiness for a construction safety platform.",
    "Return JSON only with keys: overallScore, summary, prioritizedActions, rowFindings.",
    "Allowed row status values: ready, expiring_soon, gap, blocked, needs_review.",
    "Hard rule: never clear deterministic gap or blocked rows. You may escalate ready or expiring_soon rows to needs_review when context is ambiguous or risk is elevated.",
    "Keep explanations concise and actionable.",
    "",
    JSON.stringify({
      summary,
      rows: rows.map(compactRow),
    }),
  ].join("\n");

  const response = await requestAiResponsesText({
    model,
    input,
    surface: "readiness-matrix.ai-review",
    body: {
      text: { format: { type: "json_object" } },
    },
  });

  if (!response.text) {
    return NextResponse.json({
      review: fallbackReview({
        rows,
        summary,
        reason: response.meta.fallbackReason ?? "empty_output_text",
      }),
      meta: response.meta,
    });
  }

  const parsed = parseAiReview(response.text);
  if (!parsed) {
    return NextResponse.json({
      review: fallbackReview({ rows, summary, reason: "invalid_json" }),
      meta: { ...response.meta, fallbackUsed: true, fallbackReason: "invalid_json" },
    });
  }

  return NextResponse.json({ review: parsed, meta: response.meta });
}
