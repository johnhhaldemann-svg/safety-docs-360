import type { SupabaseClient } from "@supabase/supabase-js";
import { requestAiEmbedding } from "@/lib/ai/embeddings";
import { buildDemoKnowledgeGraph } from "@/lib/aiKnowledgeMap/demo";
import { normalizeSourceRowsToKnowledgeNodes, sourceKey } from "@/lib/aiKnowledgeMap/normalize";
import { generateKnowledgeRelationships } from "@/lib/aiKnowledgeMap/relationships";
import type {
  AiKnowledgeEdge,
  AiKnowledgeGraphPayload,
  AiKnowledgeGraphSummary,
  AiKnowledgeIngestBatch,
  AiKnowledgeIngestCandidate,
  AiKnowledgeCandidateStatus,
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

function camelBatch(row: Record<string, unknown>): AiKnowledgeIngestBatch {
  return {
    id: String(row.id ?? ""),
    companyId: typeof row.company_id === "string" ? row.company_id : null,
    batchType: String(row.batch_type ?? "rebuild_index"),
    status: String(row.status ?? "pending_review"),
    sourceCounts: row.source_counts && typeof row.source_counts === "object" && !Array.isArray(row.source_counts) ? (row.source_counts as Record<string, number>) : {},
    candidateCounts: row.candidate_counts && typeof row.candidate_counts === "object" && !Array.isArray(row.candidate_counts) ? (row.candidate_counts as Record<string, number>) : {},
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function camelCandidate(row: Record<string, unknown>): AiKnowledgeIngestCandidate {
  return {
    id: String(row.id ?? ""),
    batchId: typeof row.batch_id === "string" ? row.batch_id : null,
    companyId: typeof row.company_id === "string" ? row.company_id : null,
    candidateType: String(row.candidate_type ?? "failed_source") as AiKnowledgeIngestCandidate["candidateType"],
    sourceTable: typeof row.source_table === "string" ? row.source_table : null,
    sourceId: typeof row.source_id === "string" ? row.source_id : null,
    sourceRecordId: typeof row.source_record_id === "string" ? row.source_record_id : null,
    sourceNodeKey: typeof row.source_node_key === "string" ? row.source_node_key : null,
    targetNodeKey: typeof row.target_node_key === "string" ? row.target_node_key : null,
    relationshipType: typeof row.relationship_type === "string" ? row.relationship_type as AiKnowledgeIngestCandidate["relationshipType"] : null,
    title: String(row.title ?? "Knowledge candidate"),
    semanticSummary: typeof row.semantic_summary === "string" ? row.semantic_summary : null,
    reason: typeof row.reason === "string" ? row.reason : null,
    sourceEvidence: Array.isArray(row.source_evidence) ? (row.source_evidence as AiKnowledgeIngestCandidate["sourceEvidence"]) : [],
    proposedPayload: row.proposed_payload && typeof row.proposed_payload === "object" && !Array.isArray(row.proposed_payload) ? (row.proposed_payload as Record<string, unknown>) : {},
    confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
    validationStatus: String(row.validation_status ?? "pending_review") as AiKnowledgeCandidateStatus,
    reviewedBy: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    reviewNote: typeof row.review_note === "string" ? row.review_note : null,
    promotedNodeId: typeof row.promoted_node_id === "string" ? row.promoted_node_id : null,
    promotedEdgeId: typeof row.promoted_edge_id === "string" ? row.promoted_edge_id : null,
    promotedAt: typeof row.promoted_at === "string" ? row.promoted_at : null,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {},
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function textMatches(node: AiKnowledgeNode, query: string) {
  if (!query) return true;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [node.title, node.description, node.category, node.nodeType, node.trade, node.project, node.semanticSummary].join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function dateMatches(node: AiKnowledgeNode, dateRange?: string | null) {
  if (!dateRange || dateRange === "all") return true;
  const updatedAt = Date.parse(node.updatedAt ?? node.createdAt ?? "");
  if (!Number.isFinite(updatedAt)) return false;
  const now = Date.now();
  if (dateRange === "last 7 days") return updatedAt >= now - 7 * 24 * 60 * 60 * 1000;
  if (dateRange === "last 30 days") return updatedAt >= now - 30 * 24 * 60 * 60 * 1000;
  if (dateRange === "last 90 days") return updatedAt >= now - 90 * 24 * 60 * 60 * 1000;
  if (dateRange === "this year") return new Date(updatedAt).getFullYear() === new Date(now).getFullYear();
  return true;
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
    if (!dateMatches(node, filters.dateRange)) return false;
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

function countRowsByTable(rowsByTable: Map<string, AiKnowledgeSourceRow[]>) {
  return Object.fromEntries(Array.from(rowsByTable.entries()).map(([table, rows]) => [table, rows.length])) as Record<string, number>;
}

async function createIngestBatch(client: DbClient, input: { companyId: string; actorUserId?: string | null; sourceCounts: Record<string, number>; candidateCounts: Record<string, number>; warnings: string[] }) {
  const { data, error } = (await client.from("ai_knowledge_ingest_batches").insert({
    company_id: input.companyId,
    batch_type: "rebuild_index",
    status: "pending_review",
    source_counts: input.sourceCounts,
    candidate_counts: input.candidateCounts,
    warnings: input.warnings,
    created_by: input.actorUserId ?? null,
    created_by_type: input.actorUserId ? "user" : "system",
  }).select("*").single()) as QueryResult<Record<string, unknown>>;
  if (error) throw new Error(error.message ?? "Failed to create AI knowledge ingest batch.");
  return camelBatch(data ?? {});
}

function nodeCandidateRow(batchId: string, node: AiKnowledgeNode) {
  return {
    batch_id: batchId,
    company_id: node.companyId,
    candidate_type: "node",
    source_table: node.sourceTable,
    source_id: node.sourceId,
    source_record_id: node.sourceRecordId,
    source_node_key: sourceKey(node.sourceTable, node.sourceId),
    title: node.title,
    semantic_summary: node.semanticSummary,
    source_evidence: [],
    proposed_payload: node,
    confidence_score: node.confidenceScore,
    validation_status: "pending_review",
    metadata: { category: node.category, nodeType: node.nodeType, riskLevel: node.riskLevel },
    created_by_type: "system",
  };
}

function edgeCandidateRow(batchId: string, companyId: string, edge: AiKnowledgeEdge) {
  const sourceEvidence = Array.isArray(edge.sourceEvidence) ? edge.sourceEvidence : [];
  return {
    batch_id: batchId,
    company_id: companyId,
    candidate_type: "edge",
    source_node_key: edge.fromNodeKey ?? null,
    target_node_key: edge.toNodeKey ?? null,
    relationship_type: edge.relationshipType,
    title: edge.relationshipType.replace(/_/g, " "),
    semantic_summary: edge.reason,
    reason: edge.reason,
    source_evidence: sourceEvidence,
    proposed_payload: edge,
    confidence_score: edge.confidenceScore,
    validation_status: "pending_review",
    metadata: edge.metadata,
    created_by_type: edge.createdByType,
  };
}

async function insertCandidates(client: DbClient, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return [] as AiKnowledgeIngestCandidate[];
  const { data, error } = (await client.from("ai_knowledge_ingest_candidates").insert(rows).select("*")) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Failed to create AI knowledge review candidates.");
  return (data ?? []).map(camelCandidate);
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
  const relationshipCandidates = generateKnowledgeRelationships(normalizedNodes);
  const candidateCounts = {
    nodes: normalizedNodes.length,
    edges: relationshipCandidates.length,
    failedSources: warnings.length,
  };
  const batch = await createIngestBatch(client, {
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    sourceCounts: countRowsByTable(rowsByTable),
    candidateCounts,
    warnings,
  });
  const candidates = await insertCandidates(client, [
    ...normalizedNodes.map((node) => nodeCandidateRow(batch.id, node)),
    ...relationshipCandidates.map((edge) => edgeCandidateRow(batch.id, params.companyId, edge)),
    ...warnings.map((warning) => ({
      batch_id: batch.id,
      company_id: params.companyId,
      candidate_type: "failed_source",
      title: "Failed source table match",
      reason: warning,
      semantic_summary: warning,
      source_evidence: [],
      proposed_payload: { warning },
      validation_status: "failed",
      metadata: { warning },
      created_by_type: "system",
    })),
  ]);
  await logEngineEvent(client, {
    companyId: params.companyId,
    eventType: "knowledge_candidates_created",
    description: `AI Knowledge Map created ${candidates.length} review candidates. Trusted graph memory was not changed.`,
    metadata: { batchId: batch.id, candidateCounts, generateEmbeddings: Boolean(params.generateEmbeddings) },
    createdBy: params.actorUserId,
  }).catch(() => undefined);
  return {
    ok: true,
    companyId: params.companyId,
    batchId: batch.id,
    insertedOrUpdatedNodes: 0,
    insertedOrUpdatedEdges: 0,
    vectorRows: 0,
    embeddingAttempts: 0,
    candidateNodes: normalizedNodes.length,
    candidateEdges: relationshipCandidates.length,
    failedSourceCandidates: warnings.length,
    reviewRequiredCount: candidates.filter((candidate) => candidate.validationStatus === "pending_review").length,
    warnings,
    generatedAt,
  };
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

export async function listKnowledgeIngestCandidates(client: DbClient, params: { companyId?: string | null; status?: AiKnowledgeCandidateStatus | "all" | null; candidateType?: AiKnowledgeIngestCandidate["candidateType"] | "all" | null; batchId?: string | null; limit?: number }) {
  let query = client.from("ai_knowledge_ingest_candidates").select("*").order("created_at", { ascending: false }).limit(Math.min(Math.max(params.limit ?? 100, 1), 500));
  if (params.companyId && params.companyId !== "all") query = query.eq("company_id", params.companyId);
  if (params.status && params.status !== "all") query = query.eq("validation_status", params.status);
  if (params.candidateType && params.candidateType !== "all") query = query.eq("candidate_type", params.candidateType);
  if (params.batchId) query = query.eq("batch_id", params.batchId);
  const { data, error } = (await query) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Failed to load AI knowledge review candidates.");
  return { ok: true, candidates: (data ?? []).map(camelCandidate) };
}

export async function getKnowledgeIngestCandidate(client: DbClient, candidateId: string) {
  const { data, error } = (await client.from("ai_knowledge_ingest_candidates").select("*").eq("id", candidateId).single()) as QueryResult<Record<string, unknown>>;
  if (error) throw new Error(error.message ?? "Failed to load AI knowledge review candidate.");
  return { ok: true, candidate: camelCandidate(data ?? {}) };
}

async function findPromotedNodeId(client: DbClient, companyId: string | null, key: string | null) {
  if (!key) return null;
  const [sourceTable, sourceId] = key.split(":", 2);
  if (!sourceTable || !sourceId) return null;
  let query = client.from("ai_knowledge_nodes").select("id").eq("source_table", sourceTable).eq("source_id", sourceId).eq("validation_status", "approved").limit(1);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = (await query) as QueryResult<Array<Record<string, unknown>>>;
  if (error) return null;
  return typeof data?.[0]?.id === "string" ? data[0].id : null;
}

function candidateNodePayload(candidate: AiKnowledgeIngestCandidate): AiKnowledgeNode | null {
  const payload = candidate.proposedPayload;
  if (!payload.sourceTable || !payload.sourceId || !payload.title) return null;
  return payload as unknown as AiKnowledgeNode;
}

function candidateEdgePayload(candidate: AiKnowledgeIngestCandidate): AiKnowledgeEdge | null {
  const payload = candidate.proposedPayload;
  if (!payload.relationshipType) return null;
  return payload as unknown as AiKnowledgeEdge;
}

async function promoteNodeCandidate(client: DbClient, candidate: AiKnowledgeIngestCandidate) {
  const node = candidateNodePayload(candidate);
  if (!node) throw new Error("Candidate does not contain a valid node payload.");
  const [promoted] = await upsertNodes(client, [{ ...node, validationStatus: "approved", confidenceScore: node.confidenceScore ?? candidate.confidenceScore ?? 0.72 }]);
  if (!promoted?.id) throw new Error("Node candidate could not be promoted.");
  await upsertVectorMemory(client, { nodes: [promoted], generateEmbeddings: false, maxEmbeddingAttempts: 0 });
  return { nodeId: promoted.id, edgeId: null as string | null };
}

async function promoteEdgeCandidate(client: DbClient, candidate: AiKnowledgeIngestCandidate) {
  const edge = candidateEdgePayload(candidate);
  if (!edge) throw new Error("Candidate does not contain a valid edge payload.");
  const sourceNodeId = await findPromotedNodeId(client, candidate.companyId, candidate.sourceNodeKey ?? edge.fromNodeKey ?? null);
  const targetNodeId = await findPromotedNodeId(client, candidate.companyId, candidate.targetNodeKey ?? edge.toNodeKey ?? null);
  if (!sourceNodeId || !targetNodeId) throw new Error("Approve and promote related node candidates before promoting this relationship.");
  const [promoted] = await upsertEdges(client, [{
    ...edge,
    companyId: candidate.companyId,
    sourceNodeId,
    targetNodeId,
    fromNodeId: sourceNodeId,
    toNodeId: targetNodeId,
    validationStatus: "approved",
    confidenceScore: edge.confidenceScore ?? candidate.confidenceScore ?? 0.65,
  }], []);
  if (!promoted?.id) throw new Error("Relationship candidate could not be promoted.");
  return { nodeId: null as string | null, edgeId: promoted.id };
}

async function promoteCandidate(client: DbClient, candidate: AiKnowledgeIngestCandidate) {
  if (candidate.validationStatus === "promoted") return { nodeId: candidate.promotedNodeId, edgeId: candidate.promotedEdgeId };
  if (candidate.candidateType === "node") return promoteNodeCandidate(client, candidate);
  if (candidate.candidateType === "edge") return promoteEdgeCandidate(client, candidate);
  throw new Error("Failed source candidates cannot be promoted.");
}

export async function reviewKnowledgeIngestCandidates(client: DbClient, params: { candidateIds: string[]; status: Exclude<AiKnowledgeCandidateStatus, "pending_review" | "failed">; reason: string; actorUserId: string; promoteApproved?: boolean }) {
  const reviewedAt = new Date().toISOString();
  const results: AiKnowledgeIngestCandidate[] = [];
  const errors: Array<{ candidateId: string; error: string }> = [];
  for (const candidateId of params.candidateIds) {
    try {
      const loaded = await getKnowledgeIngestCandidate(client, candidateId);
      let candidate = loaded.candidate;
      const { data, error } = (await client.from("ai_knowledge_ingest_candidates").update({
        validation_status: params.status,
        review_note: params.reason,
        reviewed_by: params.actorUserId,
        reviewed_at: reviewedAt,
      }).eq("id", candidateId).select("*").single()) as QueryResult<Record<string, unknown>>;
      if (error) throw new Error(error.message ?? "Failed to update candidate review status.");
      candidate = camelCandidate(data ?? {});
      if (params.status === "approved" && params.promoteApproved !== false) {
        const promoted = await promoteCandidate(client, candidate);
        const promotedAt = new Date().toISOString();
        const update = await client.from("ai_knowledge_ingest_candidates").update({
          validation_status: "promoted",
          promoted_node_id: promoted.nodeId,
          promoted_edge_id: promoted.edgeId,
          promoted_at: promotedAt,
        }).eq("id", candidate.id).select("*").single() as QueryResult<Record<string, unknown>>;
        if (update.error) throw new Error(update.error.message ?? "Failed to mark candidate promoted.");
        candidate = camelCandidate(update.data ?? {});
        await logEngineEvent(client, {
          companyId: candidate.companyId,
          eventType: "knowledge_candidate_promoted",
          description: `AI Knowledge candidate ${candidate.id} was promoted to trusted memory.`,
          metadata: { candidateType: candidate.candidateType, promotedNodeId: promoted.nodeId, promotedEdgeId: promoted.edgeId },
          createdBy: params.actorUserId,
        }).catch(() => undefined);
      } else {
        await logEngineEvent(client, {
          companyId: candidate.companyId,
          eventType: "knowledge_candidate_reviewed",
          description: `AI Knowledge candidate ${candidate.id} was marked ${params.status}.`,
          metadata: { candidateType: candidate.candidateType, reason: params.reason },
          createdBy: params.actorUserId,
        }).catch(() => undefined);
      }
      results.push(candidate);
    } catch (error) {
      errors.push({ candidateId, error: error instanceof Error ? error.message : "Review failed." });
    }
  }
  return { ok: errors.length === 0, reviewed: results, errors };
}

export async function promoteApprovedKnowledgeCandidates(client: DbClient, params: { companyId?: string | null; batchId?: string | null; actorUserId: string; limit?: number }) {
  const listed = await listKnowledgeIngestCandidates(client, { companyId: params.companyId, batchId: params.batchId, status: "approved", limit: params.limit ?? 100 });
  const nodeIds = listed.candidates.filter((candidate) => candidate.candidateType === "node").map((candidate) => candidate.id);
  const edgeIds = listed.candidates.filter((candidate) => candidate.candidateType === "edge").map((candidate) => candidate.id);
  const first = await reviewKnowledgeIngestCandidates(client, { candidateIds: nodeIds, status: "approved", reason: "Promoted approved node candidate to trusted graph memory.", actorUserId: params.actorUserId, promoteApproved: true });
  const second = await reviewKnowledgeIngestCandidates(client, { candidateIds: edgeIds, status: "approved", reason: "Promoted approved relationship candidate to trusted graph memory.", actorUserId: params.actorUserId, promoteApproved: true });
  return { ok: first.ok && second.ok, promoted: [...first.reviewed, ...second.reviewed], errors: [...first.errors, ...second.errors] };
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
