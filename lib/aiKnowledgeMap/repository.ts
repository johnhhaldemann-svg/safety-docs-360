import type { SupabaseClient } from "@supabase/supabase-js";
import { requestAiEmbedding } from "@/lib/ai/embeddings";
import { buildDemoKnowledgeGraph } from "@/lib/aiKnowledgeMap/demo";
import { normalizeSourceRowsToKnowledgeNodes, sourceKey } from "@/lib/aiKnowledgeMap/normalize";
import { generateKnowledgeRelationships } from "@/lib/aiKnowledgeMap/relationships";
import type {
  AiKnowledgeEdge,
  AiKnowledgeGraphPayload,
  AiKnowledgeGraphSummary,
  AiKnowledgeMapFilters,
  AiKnowledgeNode,
  AiKnowledgeRebuildResult,
  AiKnowledgeSourceRow,
  AiKnowledgeValidationStatus,
} from "@/lib/aiKnowledgeMap/types";

type DbClient = Pick<SupabaseClient, "from">;
type DbError = { message?: string | null };
type QueryResult<T> = { data: T | null; error: DbError | null };

const SOURCE_TABLES = [
  "company_permits",
  "company_jsas",
  "company_hazards",
  "company_controls",
  "company_training_requirements",
  "company_incidents",
  "company_sor_records",
  "company_corrective_actions",
  "documents",
  "company_generated_documents",
  "company_risk_ai_recommendations",
] as const;

const ALL_COMPANIES_SCOPE = "all";

function isMissingKnowledgeMapTable(error?: DbError | null) {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("ai_knowledge") || message.includes("ai_vector_memory") || message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find");
}

function snakeNode(node: AiKnowledgeNode) {
  return {
    company_id: node.companyId,
    jobsite_id: node.jobsiteId,
    project_id: node.projectId,
    source_table: node.sourceTable,
    source_id: node.sourceId,
    source_record_id: node.sourceRecordId,
    title: node.title,
    node_type: node.nodeType,
    type: node.type,
    category: node.category,
    description: node.description,
    semantic_summary: node.semanticSummary,
    project: node.project,
    trade: node.trade,
    risk_level: node.riskLevel,
    risk_score: node.riskScore,
    source_url: node.sourceUrl,
    source_document: node.sourceDocument,
    metadata: node.metadata,
    vector_status: node.vectorStatus,
    vector_coordinates: node.vectorCoordinates,
    x: node.vectorCoordinates.x,
    y: node.vectorCoordinates.y,
    z: node.vectorCoordinates.z,
    confidence_score: node.confidenceScore,
    validation_status: node.validationStatus,
    created_by_type: node.createdByType,
  };
}

function camelNode(row: Record<string, unknown>): AiKnowledgeNode {
  const nodeType = String(row.node_type ?? row.type ?? "document") as AiKnowledgeNode["nodeType"];
  return {
    id: String(row.id ?? ""),
    companyId: typeof row.company_id === "string" ? row.company_id : null,
    jobsiteId: typeof row.jobsite_id === "string" ? row.jobsite_id : null,
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    sourceTable: String(row.source_table ?? ""),
    sourceId: String(row.source_id ?? row.source_record_id ?? ""),
    sourceRecordId: String(row.source_record_id ?? row.source_id ?? ""),
    title: String(row.title ?? "Untitled node"),
    nodeType,
    type: nodeType,
    category: String(row.category ?? "uncategorized"),
    description: String(row.description ?? ""),
    project: typeof row.project === "string" ? row.project : null,
    trade: typeof row.trade === "string" ? row.trade : null,
    riskLevel: String(row.risk_level ?? "unknown") as AiKnowledgeNode["riskLevel"],
    riskScore: row.risk_score == null ? null : Number(row.risk_score),
    sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
    sourceDocument: typeof row.source_document === "string" ? row.source_document : null,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {},
    semanticSummary: String(row.semantic_summary ?? row.description ?? row.title ?? ""),
    vectorStatus: String(row.vector_status ?? "pending") as AiKnowledgeNode["vectorStatus"],
    vectorCoordinates:
      row.vector_coordinates && typeof row.vector_coordinates === "object" && !Array.isArray(row.vector_coordinates)
        ? (row.vector_coordinates as AiKnowledgeNode["vectorCoordinates"])
        : { x: Number(row.x ?? 0), y: Number(row.y ?? 0), z: Number(row.z ?? 0), cluster: nodeType },
    confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
    validationStatus: String(row.validation_status ?? "unreviewed") as AiKnowledgeValidationStatus,
    createdByType: String(row.created_by_type ?? "system") as AiKnowledgeNode["createdByType"],
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function snakeEdge(edge: AiKnowledgeEdge) {
  return {
    company_id: edge.companyId,
    source_node_id: edge.sourceNodeId ?? edge.fromNodeId,
    target_node_id: edge.targetNodeId ?? edge.toNodeId,
    from_node_id: edge.fromNodeId ?? edge.sourceNodeId,
    to_node_id: edge.toNodeId ?? edge.targetNodeId,
    relationship_type: edge.relationshipType,
    relationship_strength: edge.relationshipStrength,
    strength_score: edge.strengthScore,
    reason: edge.reason,
    source_evidence: edge.sourceEvidence,
    confidence_score: edge.confidenceScore,
    validation_status: edge.validationStatus,
    created_by_type: edge.createdByType,
    metadata: edge.metadata,
  };
}

function camelEdge(row: Record<string, unknown>): AiKnowledgeEdge {
  return {
    id: String(row.id ?? ""),
    companyId: typeof row.company_id === "string" ? row.company_id : null,
    sourceNodeId: String(row.source_node_id ?? row.from_node_id ?? ""),
    targetNodeId: String(row.target_node_id ?? row.to_node_id ?? ""),
    fromNodeId: String(row.from_node_id ?? row.source_node_id ?? ""),
    toNodeId: String(row.to_node_id ?? row.target_node_id ?? ""),
    relationshipType: String(row.relationship_type ?? "similar_record_by_vector_match") as AiKnowledgeEdge["relationshipType"],
    relationshipStrength: Number(row.relationship_strength ?? row.strength_score ?? 0),
    strengthScore: Number(row.strength_score ?? row.relationship_strength ?? 0),
    reason: String(row.reason ?? ""),
    sourceEvidence: Array.isArray(row.source_evidence) ? (row.source_evidence as AiKnowledgeEdge["sourceEvidence"]) : [],
    confidenceScore: Number(row.confidence_score ?? 0.5),
    validationStatus: String(row.validation_status ?? "unreviewed") as AiKnowledgeValidationStatus,
    createdByType: String(row.created_by_type ?? "system") as AiKnowledgeEdge["createdByType"],
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {},
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function textMatches(node: AiKnowledgeNode, query: string) {
  if (!query) return true;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [node.title, node.description, node.category, node.nodeType, node.trade, node.project, node.semanticSummary].join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function filterNodes(nodes: AiKnowledgeNode[], filters: AiKnowledgeMapFilters) {
  const q = (filters.query ?? "").trim();
  return nodes.filter((node) => {
    if (q && !textMatches(node, q)) return false;
    if (filters.sourceType && filters.sourceType !== "all" && node.nodeType !== filters.sourceType) return false;
    if (filters.riskLevel && filters.riskLevel !== "all" && node.riskLevel !== filters.riskLevel) return false;
    if (filters.project && filters.project !== "all" && node.project !== filters.project) return false;
    if (filters.trade && filters.trade !== "all" && node.trade !== filters.trade) return false;
    if (filters.category && filters.category !== "all" && node.category !== filters.category) return false;
    return true;
  });
}

function summarize(nodes: AiKnowledgeNode[], edges: AiKnowledgeEdge[], companies: Array<{ id: string; name: string }>, vectorRows = 0): AiKnowledgeGraphSummary {
  const latestUpdate = [...nodes.map((node) => node.updatedAt), ...edges.map((edge) => edge.updatedAt)].filter(Boolean).sort().at(-1) ?? null;
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    dataSourceCount: new Set(nodes.map((node) => node.sourceTable)).size,
    highRiskNodeCount: nodes.filter((node) => node.riskLevel === "high" || node.riskLevel === "critical").length,
    lowConfidenceCount: edges.filter((edge) => edge.confidenceScore < 0.55).length,
    unreviewedRelationshipCount: edges.filter((edge) => edge.validationStatus === "unreviewed" || edge.validationStatus === "pending_review" || edge.validationStatus === "needs_review").length,
    pendingReviewCount: edges.filter((edge) => edge.validationStatus === "pending_review" || edge.validationStatus === "needs_review" || edge.validationStatus === "unreviewed").length,
    indexedVectorCount: vectorRows,
    companyCount: companies.length,
    latestUpdate,
  };
}

async function listCompanies(client: DbClient) {
  const { data, error } = (await client.from("companies").select("id, name").order("created_at", { ascending: false }).limit(50)) as QueryResult<Array<Record<string, unknown>>>;
  if (error) return { companies: [] as Array<{ id: string; name: string }>, warning: error.message ?? "Could not load companies." };
  return { companies: (data ?? []).map((row) => ({ id: String(row.id ?? ""), name: String(row.name ?? "Unnamed company") })).filter((row) => row.id), warning: null };
}

async function countSourceRowsForCompany(client: DbClient, companyId: string) {
  const counts = await Promise.all(SOURCE_TABLES.map(async (table) => {
    try {
      const { count, error } = (await client.from(table).select("id", { count: "exact", head: true }).eq("company_id", companyId)) as QueryResult<unknown> & { count?: number | null };
      return error ? 0 : count ?? 0;
    } catch {
      return 0;
    }
  }));
  return counts.reduce((total, count) => total + count, 0);
}

async function countSourceRowsForAllCompanies(client: DbClient) {
  const counts = await Promise.all(SOURCE_TABLES.map(async (table) => {
    try {
      const { count, error } = (await client.from(table).select("id", { count: "exact", head: true })) as QueryResult<unknown> & { count?: number | null };
      return error ? 0 : count ?? 0;
    } catch {
      return 0;
    }
  }));
  return counts.reduce((total, count) => total + count, 0);
}

async function pickInitialCompanyId(client: DbClient, companies: Array<{ id: string; name: string }>) {
  for (const company of companies.slice(0, 15)) {
    const sourceCount = await countSourceRowsForCompany(client, company.id);
    if (sourceCount > 0) return company.id;
  }
  return companies[0]?.id ?? null;
}

async function fetchSourceRows(client: DbClient, companyId: string, limitPerTable: number) {
  const warnings: string[] = [];
  const rowsByTable = new Map<string, AiKnowledgeSourceRow[]>();
  await Promise.all(SOURCE_TABLES.map(async (table) => {
    try {
      const { data, error } = (await client.from(table).select("*").eq("company_id", companyId).limit(limitPerTable)) as QueryResult<AiKnowledgeSourceRow[]>;
      if (error) warnings.push(`${table}: ${error.message ?? "query failed"}`);
      rowsByTable.set(table, data ?? []);
    } catch (error) {
      warnings.push(`${table}: ${error instanceof Error ? error.message : "query failed"}`);
      rowsByTable.set(table, []);
    }
  }));
  return { rowsByTable, warnings };
}

async function upsertNodes(client: DbClient, nodes: AiKnowledgeNode[]) {
  if (nodes.length === 0) return [] as AiKnowledgeNode[];
  const { data, error } = (await client.from("ai_knowledge_nodes").upsert(nodes.map(snakeNode), { onConflict: "company_id,source_table,source_id" }).select("*")) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Failed to upsert knowledge nodes.");
  return (data ?? []).map(camelNode);
}

async function upsertVectorMemory(client: DbClient, params: { nodes: AiKnowledgeNode[]; generateEmbeddings: boolean; maxEmbeddingAttempts: number }) {
  let embeddingAttempts = 0;
  const rows: Array<Record<string, unknown>> = [];
  const nodeUpdates: Array<PromiseLike<unknown>> = [];
  for (const node of params.nodes) {
    if (!node.id) continue;
    const retrievalText = [node.title, node.category, node.nodeType, node.description, node.semanticSummary].join("\n").slice(0, 12000);
    const base = {
      node_id: node.id,
      knowledge_node_id: node.id,
      company_id: node.companyId,
      source_table: node.sourceTable,
      source_id: node.sourceId,
      content_text: retrievalText,
      retrieval_text: retrievalText,
      semantic_summary: node.semanticSummary || node.title,
      status: "fallback",
      metadata: { sourceTable: node.sourceTable, sourceId: node.sourceId },
      embedding_model: null as string | null,
      embedding_provider: null as string | null,
      prompt_hash: null as string | null,
      token_count: Math.ceil(retrievalText.length / 4),
      retrieval_tags: [node.nodeType, node.riskLevel, node.category].filter(Boolean),
      error_message: null as string | null,
      indexed_at: new Date().toISOString(),
    };
    if (params.generateEmbeddings && embeddingAttempts < params.maxEmbeddingAttempts) {
      embeddingAttempts += 1;
      try {
        const embedding = await requestAiEmbedding({ input: retrievalText, surface: "superadmin.ai-knowledge-map.embedding" });
        rows.push({ ...base, status: "indexed", embedding: `[${embedding.embedding.join(",")}]`, embedding_model: embedding.model, embedding_provider: embedding.provider, prompt_hash: embedding.promptHash });
        nodeUpdates.push(client.from("ai_knowledge_nodes").update({ vector_status: "indexed", embedding: `[${embedding.embedding.join(",")}]` }).eq("id", node.id));
        continue;
      } catch (error) {
        rows.push({ ...base, status: "failed", error_message: error instanceof Error ? error.message.slice(0, 500) : "Embedding failed." });
        nodeUpdates.push(client.from("ai_knowledge_nodes").update({ vector_status: "failed" }).eq("id", node.id));
        continue;
      }
    }
    rows.push(base);
    nodeUpdates.push(client.from("ai_knowledge_nodes").update({ vector_status: "fallback" }).eq("id", node.id));
  }
  if (rows.length > 0) {
    const { error } = (await client.from("ai_vector_memory").upsert(rows, { onConflict: "node_id" })) as QueryResult<unknown>;
    if (error) throw new Error(error.message ?? "Failed to upsert vector memory.");
  }
  await Promise.allSettled(nodeUpdates);
  return { vectorRows: rows.length, embeddingAttempts };
}

async function upsertEdges(client: DbClient, rawEdges: AiKnowledgeEdge[], nodes: AiKnowledgeNode[]) {
  const idByKey = new Map(nodes.map((node) => [sourceKey(node.sourceTable, node.sourceId), node.id]));
  const edges = rawEdges.map((edge) => ({
    ...edge,
    sourceNodeId: edge.sourceNodeId ?? edge.fromNodeId ?? idByKey.get(edge.fromNodeKey ?? ""),
    targetNodeId: edge.targetNodeId ?? edge.toNodeId ?? idByKey.get(edge.toNodeKey ?? ""),
    fromNodeId: edge.fromNodeId ?? edge.sourceNodeId ?? idByKey.get(edge.fromNodeKey ?? ""),
    toNodeId: edge.toNodeId ?? edge.targetNodeId ?? idByKey.get(edge.toNodeKey ?? ""),
  })).filter((edge): edge is AiKnowledgeEdge & { sourceNodeId: string; targetNodeId: string; fromNodeId: string; toNodeId: string } => Boolean(edge.sourceNodeId && edge.targetNodeId && edge.sourceNodeId !== edge.targetNodeId));
  if (edges.length === 0) return [] as AiKnowledgeEdge[];
  const { data, error } = (await client.from("ai_knowledge_edges").upsert(edges.map(snakeEdge), { onConflict: "company_id,source_node_id,target_node_id,relationship_type" }).select("*")) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Failed to upsert knowledge edges.");
  return (data ?? []).map(camelEdge);
}

async function logEngineEvent(client: DbClient, input: { companyId: string | null; eventType: string; description: string; metadata?: Record<string, unknown>; createdBy?: string | null }) {
  await client.from("ai_engine_events").insert({
    company_id: input.companyId,
    event_type: input.eventType,
    description: input.description,
    message: input.description,
    metadata: input.metadata ?? {},
    created_by: input.createdBy ?? null,
    created_by_type: input.createdBy ? "user" : "system",
  });
}

export async function rebuildKnowledgeIndex(client: DbClient, params: { companyId: string; actorUserId?: string | null; limitPerTable?: number; generateEmbeddings?: boolean; maxEmbeddingAttempts?: number }): Promise<AiKnowledgeRebuildResult> {
  const generatedAt = new Date().toISOString();
  const { rowsByTable, warnings } = await fetchSourceRows(client, params.companyId, params.limitPerTable ?? 80);
  const normalizedNodes = Array.from(rowsByTable.entries()).flatMap(([table, rows]) => normalizeSourceRowsToKnowledgeNodes(table, rows));
  const nodes = await upsertNodes(client, normalizedNodes);
  const vector = await upsertVectorMemory(client, { nodes, generateEmbeddings: Boolean(params.generateEmbeddings), maxEmbeddingAttempts: params.maxEmbeddingAttempts ?? 24 });
  const edges = await upsertEdges(client, generateKnowledgeRelationships(nodes), nodes);
  await logEngineEvent(client, { companyId: params.companyId, eventType: "knowledge_index_rebuilt", description: `AI Knowledge Map rebuilt ${nodes.length} nodes and ${edges.length} relationships.`, metadata: { warnings, generateEmbeddings: Boolean(params.generateEmbeddings) }, createdBy: params.actorUserId }).catch(() => undefined);
  return { ok: true, companyId: params.companyId, insertedOrUpdatedNodes: nodes.length, insertedOrUpdatedEdges: edges.length, vectorRows: vector.vectorRows, embeddingAttempts: vector.embeddingAttempts, warnings, generatedAt };
}

export async function recalculateKnowledgeRelationships(client: DbClient, params: { companyId: string; actorUserId?: string | null }) {
  const { data, error } = (await client.from("ai_knowledge_nodes").select("*").eq("company_id", params.companyId).limit(500)) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Failed to load knowledge nodes.");
  const nodes = (data ?? []).map(camelNode);
  const edges = await upsertEdges(client, generateKnowledgeRelationships(nodes), nodes);
  await logEngineEvent(client, { companyId: params.companyId, eventType: "knowledge_relationships_recalculated", description: `AI Knowledge Map recalculated ${edges.length} relationships.`, metadata: { edgeCount: edges.length }, createdBy: params.actorUserId }).catch(() => undefined);
  return { ok: true, companyId: params.companyId, insertedOrUpdatedEdges: edges.length, generatedAt: new Date().toISOString() };
}

export async function updateKnowledgeRelationshipValidation(client: DbClient, params: { edgeId: string; status: Exclude<AiKnowledgeValidationStatus, "pending_review" | "needs_review" | "unreviewed">; reason: string; actorUserId: string }) {
  const previous = (await client.from("ai_knowledge_edges").select("*").eq("id", params.edgeId).single()) as QueryResult<Record<string, unknown>>;
  const previousStatus = previous.data ? String(previous.data.validation_status ?? "unreviewed") : null;
  const reviewedAt = new Date().toISOString();
  const { data, error } = (await client.from("ai_knowledge_edges").update({ validation_status: params.status, reviewed_by: params.actorUserId, reviewed_at: reviewedAt }).eq("id", params.edgeId).select("*").single()) as QueryResult<Record<string, unknown>>;
  if (error) throw new Error(error.message ?? "Failed to update relationship validation.");
  const edge = camelEdge(data ?? {});
  await client.from("ai_engine_validation_logs").insert({
    target_type: "edge",
    target_id: params.edgeId,
    company_id: edge.companyId,
    edge_id: params.edgeId,
    validation_action: params.status === "approved" ? "approve" : params.status === "incorrect" ? "mark_incorrect" : "reject",
    validation_note: params.reason,
    previous_status: previousStatus,
    new_status: params.status,
    validation_status: params.status,
    reason: params.reason,
    reviewed_by: params.actorUserId,
    created_by: params.actorUserId,
    metadata: { relationshipType: edge.relationshipType },
  });
  return { ok: true, edge, reviewedAt };
}

export async function getKnowledgeGraphPayload(client: DbClient | null, filters: AiKnowledgeMapFilters = {}): Promise<AiKnowledgeGraphPayload> {
  if (!client) return buildDemoKnowledgeGraph();
  const warnings: string[] = [];
  const companiesResult = await listCompanies(client);
  if (companiesResult.warning) warnings.push(companiesResult.warning);
  const requestedCompanyId = filters.companyId?.trim() || null;
  const viewingAllCompanies = requestedCompanyId === ALL_COMPANIES_SCOPE;
  const selectedCompanyId = viewingAllCompanies ? ALL_COMPANIES_SCOPE : requestedCompanyId || await pickInitialCompanyId(client, companiesResult.companies);
  if (!selectedCompanyId) return { ...buildDemoKnowledgeGraph(), companies: [], selectedCompanyId: null, warnings: ["No companies are available for indexing."], demo: true };

  const nodeQuery = client.from("ai_knowledge_nodes").select("*").limit(600);
  const nodeResult = (await (viewingAllCompanies ? nodeQuery : nodeQuery.eq("company_id", selectedCompanyId))) as QueryResult<Array<Record<string, unknown>>>;
  if (nodeResult.error) {
    if (isMissingKnowledgeMapTable(nodeResult.error)) return buildDemoKnowledgeGraph();
    throw new Error(nodeResult.error.message ?? "Failed to load knowledge nodes.");
  }
  let nodes = filterNodes((nodeResult.data ?? []).map(camelNode), filters);
  const visibleNodeIds = new Set(nodes.map((node) => node.id).filter(Boolean));
  const edgeQuery = client.from("ai_knowledge_edges").select("*").limit(900);
  const edgeResult = (await (viewingAllCompanies ? edgeQuery : edgeQuery.eq("company_id", selectedCompanyId))) as QueryResult<Array<Record<string, unknown>>>;
  if (edgeResult.error) throw new Error(edgeResult.error.message ?? "Failed to load knowledge edges.");
  let edges = (edgeResult.data ?? []).map(camelEdge).filter((edge) => visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId));
  if (nodes.length > 500) {
    nodes = nodes.slice(0, 500);
    const sampledIds = new Set(nodes.map((node) => node.id).filter(Boolean));
    edges = edges.filter((edge) => sampledIds.has(edge.sourceNodeId) && sampledIds.has(edge.targetNodeId)).slice(0, 700);
    warnings.push("Performance-safe sampling limited the visible map to 500 nodes.");
  }
  const vectorQuery = client.from("ai_vector_memory").select("id,status").limit(1000);
  const vectorResult = (await (viewingAllCompanies ? vectorQuery : vectorQuery.eq("company_id", selectedCompanyId))) as QueryResult<Array<Record<string, unknown>>>;
  if (vectorResult.error && !isMissingKnowledgeMapTable(vectorResult.error)) warnings.push(vectorResult.error.message ?? "Vector memory unavailable.");
  if (nodes.length === 0) {
    const sourceCount = viewingAllCompanies ? await countSourceRowsForAllCompanies(client) : await countSourceRowsForCompany(client, selectedCompanyId);
    if (sourceCount > 0) {
      warnings.push(`${viewingAllCompanies ? "These companies have" : "This company has"} ${sourceCount} source safety records, but no AI Knowledge Map index yet. Select one company and click Rebuild index to create live nodes and relationships.`);
    }
  }
  const validationQueue = edges.filter((edge) => edge.validationStatus !== "approved" || edge.confidenceScore < 0.55).sort((left, right) => left.confidenceScore - right.confidenceScore).slice(0, 30);
  return {
    companies: companiesResult.companies,
    selectedCompanyId,
    nodes,
    edges,
    validationQueue,
    summary: summarize(nodes, edges, companiesResult.companies, (vectorResult.data ?? []).filter((row) => row.status === "indexed").length),
    generatedAt: new Date().toISOString(),
    warnings,
    demo: false,
  };
}

export async function saveKnowledgeMapView(client: DbClient, params: { userId: string; name: string; filters: Record<string, unknown>; layoutSettings?: Record<string, unknown> }) {
  const { data, error } = (await client.from("ai_knowledge_map_views").insert({
    user_id: params.userId,
    name: params.name,
    filters: params.filters,
    layout_settings: params.layoutSettings ?? {},
  }).select("*").single()) as QueryResult<Record<string, unknown>>;
  if (error) throw new Error(error.message ?? "Failed to save AI Knowledge Map view.");
  return { ok: true, view: data };
}
