import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding } from "@/lib/companyMemory/embed";
import { KEYWORD_STOPWORDS } from "@/lib/companyMemory/stopwords";
import type {
  CompanyMemoryItemRow,
  CompanyMemorySource,
  SimilarMemoryCandidate,
  SimilarMemoryCandidateReason,
} from "@/lib/companyMemory/types";
import {
  jaccardTokenSets,
  memoryContentTokenSet,
  SIMILAR_MEMORY_JACCARD_MIN,
  SIMILAR_MEMORY_SEMANTIC_MIN,
  SIMILAR_MEMORY_SHOW_THRESHOLD,
  titlesAreMutuallyContained,
} from "@/lib/companyMemory/similarMemoryDraft";
import { serverLog } from "@/lib/serverLog";

const SOURCES = new Set<CompanyMemorySource>([
  "manual",
  "document_excerpt",
  "incident_summary",
  "other",
]);

export function normalizeMemorySource(raw: string | null | undefined): CompanyMemorySource {
  const t = (raw ?? "manual").trim().toLowerCase();
  if (t === "document_excerpt" || t === "incident_summary" || t === "manual" || t === "other") {
    return t;
  }
  return "other";
}

function escapeIlikePattern(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Tokens for keyword search over title/body (natural-language questions).
 * Exported for unit tests.
 */
export function memorySearchTokensFromQuery(query: string): string[] {
  const raw = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const tokens = raw.filter((t) => t.length >= 2 && !KEYWORD_STOPWORDS.has(t));
  return tokens.slice(0, 12);
}

export async function listCompanyMemoryItems(
  supabase: SupabaseClient,
  companyId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ items: CompanyMemoryItemRow[]; error?: string }> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const offset = Math.max(options?.offset ?? 0, 0);

  const { data, error } = await supabase
    .from("company_memory_items")
    .select(
      "id, company_id, source, title, body, metadata, created_by, created_at, updated_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { items: [], error: error.message };
  }

  return { items: (data ?? []) as CompanyMemoryItemRow[] };
}

export async function getCompanyMemoryItem(
  supabase: SupabaseClient,
  companyId: string,
  id: string
): Promise<{ item: CompanyMemoryItemRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("company_memory_items")
    .select(
      "id, company_id, source, title, body, metadata, created_by, created_at, updated_at"
    )
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { item: null, error: error.message };
  }
  return { item: (data as CompanyMemoryItemRow) ?? null };
}

export async function searchCompanyMemoryKeyword(
  supabase: SupabaseClient,
  companyId: string,
  query: string,
  limit: number
): Promise<{ items: CompanyMemoryItemRow[]; error?: string }> {
  const q = query.trim();
  if (q.length < 2) {
    return { items: [] };
  }
  const cap = Math.min(limit, 32);
  const tokens = memorySearchTokensFromQuery(q);
  const searchTerms =
    tokens.length > 0 ? tokens : [q.slice(0, 200).toLowerCase().replace(/\s+/g, " ").trim()];

  const seen = new Set<string>();
  const out: CompanyMemoryItemRow[] = [];

  for (const term of searchTerms) {
    if (term.length < 2) continue;
    const pattern = `%${escapeIlikePattern(term)}%`;

    const [titleRes, bodyRes] = await Promise.all([
      supabase
        .from("company_memory_items")
        .select(
          "id, company_id, source, title, body, metadata, created_by, created_at, updated_at"
        )
        .eq("company_id", companyId)
        .ilike("title", pattern)
        .limit(cap),
      supabase
        .from("company_memory_items")
        .select(
          "id, company_id, source, title, body, metadata, created_by, created_at, updated_at"
        )
        .eq("company_id", companyId)
        .ilike("body", pattern)
        .limit(cap),
    ]);

    if (titleRes.error) {
      return { items: [], error: titleRes.error.message };
    }
    if (bodyRes.error) {
      return { items: [], error: bodyRes.error.message };
    }

    for (const row of [...(titleRes.data ?? []), ...(bodyRes.data ?? [])]) {
      const r = row as CompanyMemoryItemRow;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
      if (out.length >= cap) {
        return { items: out };
      }
    }
  }

  return { items: out };
}

export async function matchCompanyMemorySemantic(
  supabase: SupabaseClient,
  companyId: string,
  queryEmbedding: number[],
  matchCount: number
): Promise<{ items: Array<CompanyMemoryItemRow & { similarity: number }>; error?: string }> {
  const { data, error } = await supabase.rpc("match_company_memory_items", {
    p_company_id: companyId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });

  if (error) {
    return { items: [], error: error.message };
  }

  if (!Array.isArray(data)) {
    return { items: [] };
  }

  const items = data.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    company_id: String(row.company_id ?? ""),
    source: normalizeMemorySource(String(row.source ?? "manual")),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    metadata: (typeof row.metadata === "object" && row.metadata !== null
      ? row.metadata
      : {}) as Record<string, unknown>,
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    similarity: typeof row.similarity === "number" ? row.similarity : 0,
  }));

  return { items };
}

/** Combine semantic + keyword fallback when embeddings missing or RPC empty. */
export async function retrieveMemoryForQuery(
  supabase: SupabaseClient,
  companyId: string,
  query: string,
  options?: { topK?: number }
): Promise<{ chunks: CompanyMemoryItemRow[]; method: "semantic" | "keyword" | "none" }> {
  const topK = Math.min(Math.max(options?.topK ?? 8, 1), 16);
  const q = query.trim();

  if (!q) {
    return { chunks: [], method: "none" };
  }

  try {
    const emb = await createEmbedding(q);
    const { items, error } = await matchCompanyMemorySemantic(supabase, companyId, emb, topK);
    if (!error && items.length > 0) {
      return {
        chunks: items.map(({ similarity, ...rest }) => {
          void similarity;
          return rest;
        }),
        method: "semantic",
      };
    }
  } catch {
    // fall through to keyword
  }

  const kw = await searchCompanyMemoryKeyword(supabase, companyId, q, topK);
  if (kw.items.length > 0) {
    return { chunks: kw.items, method: "keyword" };
  }

  return { chunks: [], method: "none" };
}

/**
 * Finds the best existing memory row that looks like the draft (title + body).
 * Used before insert to offer "replace existing" when the user is duplicating or updating a topic.
 */
export async function findSimilarCompanyMemoryDraft(
  supabase: SupabaseClient,
  companyId: string,
  title: string,
  body: string,
  options?: { excludeId?: string }
): Promise<{ candidate: SimilarMemoryCandidate | null; error?: string }> {
  const t = title.trim();
  const b = body.trim();
  if (!t || !b) {
    return { candidate: null };
  }

  const excludeId = options?.excludeId;
  const draftCombined = `${t}\n${b}`;
  const draftTokens = memoryContentTokenSet(draftCombined);

  const candidates = new Map<
    string,
    { row: CompanyMemoryItemRow; score: number; reason: SimilarMemoryCandidateReason }
  >();

  const add = (row: CompanyMemoryItemRow, score: number, reason: SimilarMemoryCandidateReason) => {
    if (excludeId && row.id === excludeId) return;
    const prev = candidates.get(row.id);
    if (!prev || score > prev.score) {
      candidates.set(row.id, { row, score, reason });
    }
  };

  const exactPattern = escapeIlikePattern(t);
  const { data: exactRows, error: exErr } = await supabase
    .from("company_memory_items")
    .select(
      "id, company_id, source, title, body, metadata, created_by, created_at, updated_at"
    )
    .eq("company_id", companyId)
    .ilike("title", exactPattern);

  if (exErr) {
    return { candidate: null, error: exErr.message };
  }
  for (const row of exactRows ?? []) {
    add(row as CompanyMemoryItemRow, 1, "title_exact");
  }

  const { items: recent, error: listErr } = await listCompanyMemoryItems(supabase, companyId, {
    limit: 200,
    offset: 0,
  });
  if (listErr) {
    return { candidate: null, error: listErr };
  }
  for (const row of recent) {
    if (titlesAreMutuallyContained(t, row.title)) {
      add(row, 0.93, "title_contains");
    }
  }

  try {
    const emb = await createEmbedding(`${t}\n\n${b}`);
    const { items: sem, error: semErr } = await matchCompanyMemorySemantic(supabase, companyId, emb, 10);
    if (semErr) {
      serverLog("warn", "company_memory_similar_semantic", { message: semErr.slice(0, 120) });
    } else {
      for (const row of sem) {
        const { similarity, ...rest } = row;
        if (similarity >= SIMILAR_MEMORY_SEMANTIC_MIN) {
          add(rest, similarity, "semantic");
        }
      }
    }
  } catch (e) {
    serverLog("warn", "company_memory_similar_embed_failed", {
      message: e instanceof Error ? e.message.slice(0, 120) : "embed failed",
    });
  }

  const kw = await searchCompanyMemoryKeyword(supabase, companyId, draftCombined, 28);
  if (kw.error) {
    return { candidate: null, error: kw.error };
  }
  for (const row of kw.items) {
    const combined = `${row.title}\n${row.body}`;
    const jac = jaccardTokenSets(draftTokens, memoryContentTokenSet(combined));
    if (jac >= SIMILAR_MEMORY_JACCARD_MIN) {
      const score = 0.68 + jac * 0.28;
      add(row, score, "keyword_overlap");
    }
  }

  let best: { row: CompanyMemoryItemRow; score: number; reason: SimilarMemoryCandidateReason } | null =
    null;
  for (const v of candidates.values()) {
    if (!best || v.score > best.score) best = v;
  }

  if (!best || best.score < SIMILAR_MEMORY_SHOW_THRESHOLD) {
    return { candidate: null };
  }

  return {
    candidate: {
      id: best.row.id,
      title: best.row.title,
      body: best.row.body,
      score: best.score,
      reason: best.reason,
    },
  };
}

export async function insertCompanyMemoryItem(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    source: CompanyMemorySource;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    userId: string;
    embed?: boolean;
  }
): Promise<{ id: string | null; error?: string }> {
  const source = SOURCES.has(params.source) ? params.source : "other";

  const { data, error } = await supabase
    .from("company_memory_items")
    .insert({
      company_id: params.companyId,
      source,
      title: params.title.trim().slice(0, 500),
      body: params.body.trim().slice(0, 120_000),
      metadata: params.metadata ?? {},
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { id: null, error: error?.message ?? "Insert failed." };
  }

  const id = String(data.id);

  if (params.embed !== false) {
    try {
      const text = `${params.title}\n\n${params.body}`.trim();
      const embedding = await createEmbedding(text);
      const vectorLiteral = `[${embedding.join(",")}]`;
      const { error: upErr } = await supabase
        .from("company_memory_items")
        .update({ embedding: vectorLiteral })
        .eq("id", id)
        .eq("company_id", params.companyId);
      if (upErr) {
        serverLog("warn", "company_memory_embedding_update_failed", {
          companyId: params.companyId,
          itemId: id,
          operation: "insert",
          message: upErr.message.slice(0, 200),
        });
      }
    } catch (e) {
      serverLog("warn", "company_memory_embedding_failed", {
        companyId: params.companyId,
        itemId: id,
        operation: "insert",
        message: e instanceof Error ? e.message.slice(0, 200) : "Embedding failed.",
      });
    }
  }

  return { id };
}

export async function updateCompanyMemoryItem(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    id: string;
    title?: string;
    body?: string;
    source?: CompanyMemorySource;
    metadata?: Record<string, unknown>;
    embed?: boolean;
  }
): Promise<{ error?: string }> {
  const patch: Record<string, unknown> = {};
  if (params.title !== undefined) patch.title = params.title.trim().slice(0, 500);
  if (params.body !== undefined) patch.body = params.body.trim().slice(0, 120_000);
  if (params.source !== undefined) {
    patch.source = SOURCES.has(params.source) ? params.source : "other";
  }
  if (params.metadata !== undefined) patch.metadata = params.metadata;

  const { error } = await supabase
    .from("company_memory_items")
    .update(patch)
    .eq("id", params.id)
    .eq("company_id", params.companyId);

  if (error) {
    return { error: error.message };
  }

  if (params.embed !== false && (params.title !== undefined || params.body !== undefined)) {
    const { item } = await getCompanyMemoryItem(supabase, params.companyId, params.id);
    if (item) {
      try {
        const text = `${item.title}\n\n${item.body}`.trim();
        const embedding = await createEmbedding(text);
        const vectorLiteral = `[${embedding.join(",")}]`;
        const { error: upErr } = await supabase
          .from("company_memory_items")
          .update({ embedding: vectorLiteral })
          .eq("id", params.id)
          .eq("company_id", params.companyId);
        if (upErr) {
          serverLog("warn", "company_memory_embedding_update_failed", {
            companyId: params.companyId,
            itemId: params.id,
            operation: "update",
            message: upErr.message.slice(0, 200),
          });
        }
      } catch (e) {
        serverLog("warn", "company_memory_embedding_failed", {
          companyId: params.companyId,
          itemId: params.id,
          operation: "update",
          message: e instanceof Error ? e.message.slice(0, 200) : "Embedding failed.",
        });
      }
    }
  }

  return {};
}

export async function deleteCompanyMemoryItem(
  supabase: SupabaseClient,
  companyId: string,
  id: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("company_memory_items")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    return { error: error.message };
  }
  return {};
}
