/**
 * Shared helper for injecting company memory excerpts into admin / superadmin
 * AI review paths. Today, the customer-facing `ai-assist` route already calls
 * `retrieveMemoryForQuery` so end users get richer reviews. Admin reviewers
 * received weaker output; this module closes that gap, gated on
 * `COMPANY_AI_MEMORY_FOR_REVIEWS=1` for safe rollout.
 *
 * Falls back automatically when no API key / table / data is available
 * (`retrieveMemoryForQuery` already does this), so behavior is unchanged when
 * the flag is off or memory isn't populated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveMemoryForQuery } from "@/lib/companyMemory/repository";

/** `COMPANY_AI_MEMORY_FOR_REVIEWS=1` enables admin/superadmin memory injection. */
export function isCompanyMemoryForReviewsEnabled(): boolean {
  return process.env.COMPANY_AI_MEMORY_FOR_REVIEWS?.trim() === "1";
}

const REVIEW_MEMORY_CONTEXT_HINT =
  "construction safety site program PPE hazards controls requirements";

export type ReviewMemoryRetrievalResult = {
  excerpts: string | null;
  method: "semantic" | "keyword" | "none" | "skipped";
  chunkCount: number;
};

/**
 * Pulls top-K relevant company memory chunks and formats them in the same
 * `[i] (source) Title\nBody` shape the customer ai-assist route uses, so the
 * downstream prompt builders treat both code paths identically.
 *
 * `supabase` should be a service-role client when called from admin paths so
 * RLS does not gate retrieval against an end user.
 */
export async function gatherCompanyMemoryExcerptsForReview(params: {
  supabase: SupabaseClient;
  companyId: string | null | undefined;
  query: string;
  topK?: number;
  /** Set true to bypass the env flag (test/integration usage). */
  forceEnabled?: boolean;
}): Promise<ReviewMemoryRetrievalResult> {
  if (!params.forceEnabled && !isCompanyMemoryForReviewsEnabled()) {
    return { excerpts: null, method: "skipped", chunkCount: 0 };
  }
  const companyId = params.companyId?.trim();
  if (!companyId) {
    return { excerpts: null, method: "skipped", chunkCount: 0 };
  }
  const query = [params.query?.trim() || "", REVIEW_MEMORY_CONTEXT_HINT]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2000);
  if (!query) {
    return { excerpts: null, method: "none", chunkCount: 0 };
  }

  const { chunks, method } = await retrieveMemoryForQuery(params.supabase, companyId, query, {
    topK: Math.min(Math.max(params.topK ?? 8, 1), 16),
  });
  if (chunks.length === 0) {
    return { excerpts: null, method, chunkCount: 0 };
  }

  const excerpts = chunks
    .map(
      (chunk, i) =>
        `[${i + 1}] (${chunk.source}) ${chunk.title}\n${chunk.body.slice(0, 4000)}${chunk.body.length > 4000 ? "\n…" : ""}`
    )
    .join("\n\n");

  return { excerpts, method, chunkCount: chunks.length };
}
