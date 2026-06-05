import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalMemoryDecision, ApprovalMemorySurface } from "@/lib/aiApprovalMemory";

export type BatchRecallItem = {
  id: string;
  sourceType?: string | null;
  category?: string | null;
  content: string;
};

/**
 * AI Approval Recall — the first learning layer over the AI Approval Memory Bank.
 *
 * Given a new item under review, it looks at past human approve/reject decisions and
 * estimates how "approvable" the item is. This v1 is a transparent, dependency-free
 * scorer: token overlap on the content plus category/source matches, weighted by the
 * approval quality rating. It needs no embeddings or schema change; a vector-similarity
 * upgrade can replace `relevanceScore` later without changing the verdict shape.
 */

export type ApprovalHistoryRow = {
  decision: ApprovalMemoryDecision;
  surface?: string | null;
  source_type?: string | null;
  category?: string | null;
  title?: string | null;
  content?: string | null;
  rating?: number | null;
};

export type ApprovabilityQuery = {
  surface?: ApprovalMemorySurface | null;
  sourceType?: string | null;
  category?: string | null;
  content: string;
};

export type ApprovabilityRecommendation =
  | "likely_approvable"
  | "likely_not_approvable"
  | "uncertain"
  | "no_evidence";

export type ApprovabilityVerdict = {
  /** Weighted approval rate in [0,1], or null when there is no relevant history. */
  score: number | null;
  recommendation: ApprovabilityRecommendation;
  confidence: "none" | "low" | "medium" | "high";
  approvedCount: number;
  rejectedCount: number;
  consideredCount: number;
  topMatches: Array<{ decision: ApprovalMemoryDecision; title: string | null; relevance: number; rating: number | null }>;
  rationale: string;
};

const RELEVANCE_THRESHOLD = 0.08;

function tokenize(value: string | null | undefined): Set<string> {
  const tokens = (value ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens.filter((token) => token.length >= 3));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Relevance of one historical decision to the query, in [0,1]. */
export function relevanceScore(query: ApprovabilityQuery, row: ApprovalHistoryRow): number {
  const queryTokens = tokenize(query.content);
  const rowTokens = tokenize([row.title, row.content].filter(Boolean).join(" "));
  let score = 0.6 * jaccard(queryTokens, rowTokens);
  if (query.category && norm(query.category) === norm(row.category)) score += 0.25;
  if (query.sourceType && norm(query.sourceType) === norm(row.source_type)) score += 0.15;
  return Math.min(1, Number(score.toFixed(4)));
}

/** Pure scorer: turns a slice of decision history into an approvability verdict. */
export function scoreApprovability(history: ApprovalHistoryRow[], query: ApprovabilityQuery): ApprovabilityVerdict {
  const scored = history
    .map((row) => ({ row, relevance: relevanceScore(query, row) }))
    .filter((entry) => entry.relevance >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.relevance - a.relevance);

  const approvedCount = scored.filter((e) => e.row.decision === "approved").length;
  const rejectedCount = scored.filter((e) => e.row.decision === "rejected").length;
  const consideredCount = scored.length;

  const topMatches = scored.slice(0, 5).map((e) => ({
    decision: e.row.decision,
    title: e.row.title ?? null,
    relevance: e.relevance,
    rating: e.row.rating ?? null,
  }));

  if (consideredCount === 0) {
    return {
      score: null,
      recommendation: "no_evidence",
      confidence: "none",
      approvedCount: 0,
      rejectedCount: 0,
      consideredCount: 0,
      topMatches: [],
      rationale: "No comparable past decisions found in the approval memory bank.",
    };
  }

  // Weighted approval rate. Approvals are weighted up slightly by their quality rating
  // (a 5-star approval is stronger evidence than a 1-star one); rejections weigh by relevance.
  let approveWeight = 0;
  let totalWeight = 0;
  for (const { row, relevance } of scored) {
    const ratingBoost = row.decision === "approved" && typeof row.rating === "number" ? 0.6 + 0.4 * (row.rating / 5) : 1;
    const weight = relevance * ratingBoost;
    totalWeight += weight;
    if (row.decision === "approved") approveWeight += weight;
  }
  const score = totalWeight === 0 ? null : Number((approveWeight / totalWeight).toFixed(4));

  const confidence: ApprovabilityVerdict["confidence"] =
    consideredCount >= 20 ? "high" : consideredCount >= 6 ? "medium" : "low";

  let recommendation: ApprovabilityRecommendation = "uncertain";
  if (score != null) {
    if (score >= 0.66) recommendation = "likely_approvable";
    else if (score <= 0.34) recommendation = "likely_not_approvable";
  }

  const pct = score == null ? "n/a" : `${Math.round(score * 100)}%`;
  return {
    score,
    recommendation,
    confidence,
    approvedCount,
    rejectedCount,
    consideredCount,
    topMatches,
    rationale: `${consideredCount} comparable decision${consideredCount === 1 ? "" : "s"} (${approvedCount} approved, ${rejectedCount} rejected) → ${pct} weighted approval rate (${confidence} confidence).`,
  };
}

type RecallDbClient = Pick<SupabaseClient, "from">;

/**
 * Fetches relevant history from the bank and scores the query. Best-effort: returns a
 * `no_evidence` verdict on any read error rather than throwing.
 */
export async function recallApprovability(
  admin: RecallDbClient,
  query: ApprovabilityQuery,
  opts?: { limit?: number }
): Promise<ApprovabilityVerdict> {
  const limit = Math.min(Math.max(opts?.limit ?? 300, 1), 1000);
  try {
    let q = admin
      .from("ai_approval_memory")
      .select("decision, surface, source_type, category, title, content, rating")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (query.surface) q = q.eq("surface", query.surface);
    if (query.sourceType) q = q.eq("source_type", query.sourceType);
    const { data, error } = await q;
    if (error || !data) return scoreApprovability([], query);
    return scoreApprovability(data as ApprovalHistoryRow[], query);
  } catch {
    return scoreApprovability([], query);
  }
}

/**
 * Scores many items against one surface's history with a single bank read. Each item is
 * scored against history excluding its own prior decision. Best-effort: returns empty
 * verdicts on read error. Returns a map keyed by item id.
 */
export async function recallApprovabilityBatch(
  admin: RecallDbClient,
  surface: ApprovalMemorySurface,
  items: BatchRecallItem[],
  opts?: { limit?: number }
): Promise<Map<string, ApprovabilityVerdict>> {
  const out = new Map<string, ApprovabilityVerdict>();
  if (items.length === 0) return out;
  const limit = Math.min(Math.max(opts?.limit ?? 400, 1), 1000);
  let history: Array<ApprovalHistoryRow & { source_record_id?: string | null }> = [];
  try {
    const { data, error } = await admin
      .from("ai_approval_memory")
      .select("decision, surface, source_type, category, title, content, rating, source_record_id")
      .eq("surface", surface)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) history = data as Array<ApprovalHistoryRow & { source_record_id?: string | null }>;
  } catch {
    history = [];
  }
  for (const item of items) {
    const comparable = history.filter((entry) => entry.source_record_id !== item.id);
    out.set(
      item.id,
      scoreApprovability(comparable, {
        surface,
        sourceType: item.sourceType ?? null,
        category: item.category ?? null,
        content: item.content,
      })
    );
  }
  return out;
}
