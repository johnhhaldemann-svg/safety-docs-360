import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding } from "@/lib/companyMemory/embed";
import type { CompanyMemoryItemRow, CompanyMemorySource } from "@/lib/companyMemory/types";

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
  const pattern = `%${q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

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

  const seen = new Set<string>();
  const out: CompanyMemoryItemRow[] = [];
  for (const row of [...(titleRes.data ?? []), ...(bodyRes.data ?? [])]) {
    const r = row as CompanyMemoryItemRow;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
    if (out.length >= cap) break;
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
        return { id, error: upErr.message };
      }
    } catch (e) {
      return {
        id,
        error: e instanceof Error ? e.message : "Embedding failed.",
      };
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
        await supabase
          .from("company_memory_items")
          .update({ embedding: vectorLiteral })
          .eq("id", params.id)
          .eq("company_id", params.companyId);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Embedding update failed." };
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
