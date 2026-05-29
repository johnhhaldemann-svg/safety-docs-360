import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiKnowledgeEvidence, AiKnowledgeNodeType, AiKnowledgeRiskLevel, TrustedKnowledgeGraphMemoryItem } from "@/lib/aiKnowledgeMap/types";

type DbClient = Pick<SupabaseClient, "from">;
type QueryResult<T> = { data: T | null; error: { message?: string | null } | null };

function clean(value: unknown, max = 700) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function tokens(query: string) {
  return (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length >= 3).slice(0, 10);
}

function matches(row: Record<string, unknown>, queryTokens: string[]) {
  if (queryTokens.length === 0) return true;
  const haystack = [
    row.title,
    row.description,
    row.semantic_summary,
    row.category,
    row.node_type,
    row.trade,
    row.project,
  ].join(" ").toLowerCase();
  return queryTokens.some((token) => haystack.includes(token));
}

function excerpt(row: Record<string, unknown>, reasons: string[]) {
  const base = clean(row.semantic_summary, 520) || clean(row.description, 520) || clean(row.title, 220);
  if (reasons.length === 0) return base;
  return clean(`${base} Related approved graph reasons: ${reasons.slice(0, 3).join(" ")}`, 900);
}

export async function retrieveTrustedKnowledgeGraphMemory(
  client: DbClient | null,
  params: { companyId: string; query: string; projectId?: string | null; jobsiteId?: string | null; topK?: number }
): Promise<{ items: TrustedKnowledgeGraphMemoryItem[]; method: "approved_graph_keyword" | "none"; warnings: string[] }> {
  if (!client || !params.companyId || !params.query.trim()) return { items: [], method: "none", warnings: [] };
  const limit = Math.min(Math.max(params.topK ?? 6, 1), 12);
  const qTokens = tokens(params.query);

  let nodeQuery = client
    .from("ai_knowledge_nodes")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("validation_status", "approved")
    .limit(160);
  if (params.projectId) nodeQuery = nodeQuery.eq("project_id", params.projectId);
  if (params.jobsiteId) nodeQuery = nodeQuery.eq("jobsite_id", params.jobsiteId);

  const { data: nodeRows, error: nodeError } = (await nodeQuery) as QueryResult<Array<Record<string, unknown>>>;
  if (nodeError) return { items: [], method: "none", warnings: [nodeError.message ?? "Approved graph nodes unavailable."] };

  const selectedNodes = (nodeRows ?? []).filter((row) => matches(row, qTokens)).slice(0, limit);
  if (selectedNodes.length === 0) return { items: [], method: "none", warnings: [] };

  const nodeIds = selectedNodes.map((row) => String(row.id ?? "")).filter(Boolean);
  const { data: edgeRows } = (await client
    .from("ai_knowledge_edges")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("validation_status", "approved")
    .in("source_node_id", nodeIds)
    .limit(80)) as QueryResult<Array<Record<string, unknown>>>;

  const edgesBySource = new Map<string, Array<Record<string, unknown>>>();
  for (const edge of edgeRows ?? []) {
    const id = String(edge.source_node_id ?? "");
    if (!id) continue;
    edgesBySource.set(id, [...(edgesBySource.get(id) ?? []), edge]);
  }

  const { data: memoryRows } = (await client
    .from("ai_vector_memory")
    .select("node_id,status")
    .eq("company_id", params.companyId)
    .in("node_id", nodeIds)
    .in("status", ["indexed", "fallback"])
    .limit(nodeIds.length)) as QueryResult<Array<Record<string, unknown>>>;
  const trustedMemoryNodeIds = new Set((memoryRows ?? []).map((row) => String(row.node_id ?? "")).filter(Boolean));

  const items = selectedNodes
    .filter((row) => trustedMemoryNodeIds.has(String(row.id ?? "")))
    .map((row): TrustedKnowledgeGraphMemoryItem => {
      const nodeId = String(row.id ?? "");
      const edges = edgesBySource.get(nodeId) ?? [];
      const relationshipReasons = edges.map((edge) => clean(edge.reason, 220)).filter(Boolean);
      return {
        id: `graph:${nodeId}`,
        nodeId,
        companyId: typeof row.company_id === "string" ? row.company_id : null,
        title: clean(row.title, 180) || "Approved graph memory",
        excerpt: excerpt(row, relationshipReasons),
        sourceTable: String(row.source_table ?? ""),
        sourceId: String(row.source_id ?? ""),
        category: String(row.category ?? "Knowledge Graph"),
        nodeType: String(row.node_type ?? row.type ?? "document") as AiKnowledgeNodeType,
        riskLevel: String(row.risk_level ?? "unknown") as AiKnowledgeRiskLevel,
        confidenceScore: Number(row.confidence_score ?? 0.72),
        relationshipReasons,
        evidence: edges.flatMap((edge) => Array.isArray(edge.source_evidence) ? edge.source_evidence as AiKnowledgeEvidence[] : []).slice(0, 6),
      };
    });

  return { items, method: items.length > 0 ? "approved_graph_keyword" : "none", warnings: [] };
}

export function trustedGraphMemoryAsPredictiveItems(items: TrustedKnowledgeGraphMemoryItem[]) {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.excerpt,
    body: item.excerpt,
    content: item.excerpt,
    source: "approved_knowledge_graph",
    source_type: item.category,
    created_at: null,
  }));
}
