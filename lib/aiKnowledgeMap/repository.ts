import type { SupabaseClient } from "@supabase/supabase-js";
import { requestAiEmbedding } from "@/lib/ai/embeddings";
import { buildDemoKnowledgeGraph } from "@/lib/aiKnowledgeMap/demo";
import {
  assertActiveKnowledgeCompany,
  assertAiKnowledgeCooldown,
  assertAiKnowledgeWritesEnabled,
  hasMeaningfulReviewReason,
  isAiKnowledgeEmbeddingDisabled,
  requireConcreteCompanyId,
} from "@/lib/aiKnowledgeMap/guardrails";
import { normalizeRiskLevel, normalizeSourceRowsToKnowledgeNodes, sourceKey, vectorCoordinatesForNode } from "@/lib/aiKnowledgeMap/normalize";
import { generateKnowledgeRelationships } from "@/lib/aiKnowledgeMap/relationships";
import { AI_KNOWLEDGE_LEARNING_CHECK_BATCH_TYPE } from "@/lib/aiKnowledgeMap/learningCheck";
import { isLearningNodeVisibleOnMap, LEARNING_REVIEW_REQUIRED_BANNER } from "@/lib/aiKnowledgeMap/reviewGate";
import type {
  AiKnowledgeEdge,
  AiKnowledgeGraphPayload,
  AiKnowledgeGraphSummary,
  AiKnowledgeIngestBatch,
  AiKnowledgeIngestCandidate,
  AiKnowledgeCandidateStatus,
  AiKnowledgeMapFilters,
  AiKnowledgeNode,
  AiKnowledgeNodeType,
  AiKnowledgeRebuildResult,
  AiKnowledgeRiskLevel,
  AiKnowledgeSourceRow,
  AiKnowledgeValidationStatus,
} from "@/lib/aiKnowledgeMap/types";

type DbClient = Pick<SupabaseClient, "from">;
type DbError = { message?: string | null };
type QueryResult<T> = { data: T | null; error: DbError | null; count?: number | null };

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
const FALLBACK_NODE_THRESHOLD = 8;
const FALLBACK_EDGE_THRESHOLD = 10;
const FALLBACK_REASON = "Showing approved fallback safety intelligence until this company has enough reviewed company-specific data.";
const SHARED_LIBRARY_REASON = "Showing approved shared Knowledge Library guidance alongside company-specific reviewed memory.";

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
    evidence_text: edge.evidenceText ?? edge.metadata.evidenceText ?? null,
    source_evidence: edge.sourceEvidence,
    confidence_score: edge.confidenceScore,
    validation_status: edge.validationStatus,
    status: edge.relationshipStatus ?? edge.metadata.relationshipStatus ?? relationshipReviewStatusFor(edge.validationStatus),
    created_by_type: edge.createdByType,
    created_by: edge.createdBy ?? null,
    reviewed_by: edge.reviewedBy ?? null,
    reviewed_at: edge.reviewedAt ?? null,
    metadata: edge.metadata,
  };
}

function relationshipReviewStatusFor(status: AiKnowledgeValidationStatus) {
  if (status === "approved") return "human_approved";
  if (status === "rejected" || status === "incorrect") return "rejected";
  if (status === "needs_review") return "needs_more_data";
  if (status === "unreviewed") return "draft";
  return "suggested";
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
    evidenceText: typeof row.evidence_text === "string" ? row.evidence_text : typeof (row.metadata as Record<string, unknown> | undefined)?.evidenceText === "string" ? String((row.metadata as Record<string, unknown>).evidenceText) : null,
    sourceEvidence: Array.isArray(row.source_evidence) ? (row.source_evidence as AiKnowledgeEdge["sourceEvidence"]) : [],
    confidenceScore: Number(row.confidence_score ?? 0.5),
    validationStatus: String(row.validation_status ?? "unreviewed") as AiKnowledgeValidationStatus,
    relationshipStatus: String(row.status ?? (row.metadata as Record<string, unknown> | undefined)?.relationshipStatus ?? relationshipReviewStatusFor(String(row.validation_status ?? "unreviewed") as AiKnowledgeValidationStatus)) as AiKnowledgeEdge["relationshipStatus"],
    createdByType: String(row.created_by_type ?? "system") as AiKnowledgeEdge["createdByType"],
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    reviewedBy: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
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

async function countPendingLearningReview(client: DbClient, selectedCompanyId: string | null) {
  try {
    let batchQuery = client
      .from("ai_knowledge_ingest_batches")
      .select("id")
      .eq("batch_type", AI_KNOWLEDGE_LEARNING_CHECK_BATCH_TYPE)
      .order("created_at", { ascending: false })
      .limit(100);
    if (selectedCompanyId && selectedCompanyId !== ALL_COMPANIES_SCOPE) batchQuery = batchQuery.eq("company_id", selectedCompanyId);
    const batchResult = (await batchQuery) as QueryResult<Array<Record<string, unknown>>>;
    const batchIds = (batchResult.data ?? []).map((row) => String(row.id ?? "")).filter(Boolean);
    if (batchResult.error || batchIds.length === 0) return { pendingLearningCandidateCount: 0, pendingLearningBatchCount: 0 };

    let candidateQuery = client
      .from("ai_knowledge_ingest_candidates")
      .select("id", { count: "exact", head: true })
      .eq("validation_status", "pending_review")
      .in("batch_id", batchIds);
    if (selectedCompanyId && selectedCompanyId !== ALL_COMPANIES_SCOPE) candidateQuery = candidateQuery.eq("company_id", selectedCompanyId);
    const candidateResult = (await candidateQuery) as QueryResult<unknown>;
    return {
      pendingLearningCandidateCount: candidateResult.count ?? 0,
      pendingLearningBatchCount: batchIds.length,
    };
  } catch {
    return { pendingLearningCandidateCount: 0, pendingLearningBatchCount: 0 };
  }
}

const CONTROL_RELATIONSHIPS = new Set(["hazard_mitigated_by_control", "required_control", "risk_reduced_by_control"]);
const ACTION_SOURCE_RELATIONSHIPS = new Set(["observation_created_corrective_action", "corrective_action_required", "corrective_action_closes_hazard"]);
const TRAINING_REASON_RELATIONSHIPS = new Set(["training_required_for_task", "required_training", "user_training_gap_affects_task", "risk_increased_by_training_gap"]);
const PERMIT_TASK_RELATIONSHIPS = new Set(["permit_required_for_task", "permit_related", "jsa_related"]);

function nodeHasAnyEdge(node: AiKnowledgeNode, edges: AiKnowledgeEdge[]) {
  return edges.some((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id || edge.fromNodeId === node.id || edge.toNodeId === node.id);
}

function nodeHasRelationship(node: AiKnowledgeNode, edges: AiKnowledgeEdge[], relationshipTypes: Set<string>) {
  return edges.some((edge) =>
    relationshipTypes.has(edge.relationshipType)
    && (edge.sourceNodeId === node.id || edge.targetNodeId === node.id || edge.fromNodeId === node.id || edge.toNodeId === node.id),
  );
}

function detectKnowledgeGraphHealth(nodes: AiKnowledgeNode[], edges: AiKnowledgeEdge[]) {
  const approvedEdges = edges.filter((edge) => edge.validationStatus === "approved");
  const warnings: string[] = [];
  const unlinkedHighRiskNodes = nodes.filter((node) =>
    (node.riskLevel === "high" || node.riskLevel === "critical" || (node.riskScore ?? 0) >= 65)
    && !nodeHasAnyEdge(node, edges),
  );

  const approvedIncidentGaps = nodes.filter((node) => node.nodeType === "incident" && node.validationStatus === "approved" && !nodeHasAnyEdge(node, approvedEdges));
  const hazardControlGaps = nodes.filter((node) => node.nodeType === "hazard" && !nodeHasRelationship(node, approvedEdges, CONTROL_RELATIONSHIPS));
  const correctiveActionGaps = nodes.filter((node) => node.nodeType === "corrective_action" && !nodeHasRelationship(node, approvedEdges, ACTION_SOURCE_RELATIONSHIPS));
  const trainingReasonGaps = nodes.filter((node) => node.nodeType === "training" && !nodeHasRelationship(node, approvedEdges, TRAINING_REASON_RELATIONSHIPS));
  const permitTaskGaps = nodes.filter((node) => node.nodeType === "permit" && !nodeHasRelationship(node, approvedEdges, PERMIT_TASK_RELATIONSHIPS));

  if (approvedIncidentGaps.length > 0) warnings.push(`${approvedIncidentGaps.length} approved incident node(s) have no approved relationships.`);
  if (hazardControlGaps.length > 0) warnings.push(`${hazardControlGaps.length} hazard node(s) have no approved control relationship.`);
  if (correctiveActionGaps.length > 0) warnings.push(`${correctiveActionGaps.length} corrective action node(s) have no approved source hazard, incident, or observation.`);
  if (trainingReasonGaps.length > 0) warnings.push(`${trainingReasonGaps.length} training node(s) have no approved task, risk, or source reason.`);
  if (permitTaskGaps.length > 0) warnings.push(`${permitTaskGaps.length} permit node(s) have no approved task/JSA relationship.`);
  if (unlinkedHighRiskNodes.length > 0) warnings.push(`${unlinkedHighRiskNodes.length} high-risk node(s) are currently unlinked.`);

  return {
    warnings,
    unlinkedHighRiskNodeCount: unlinkedHighRiskNodes.length,
    missedLinkRate: nodes.length === 0 ? 0 : Number((unlinkedHighRiskNodes.length / nodes.length).toFixed(3)),
  };
}

function summarize(nodes: AiKnowledgeNode[], edges: AiKnowledgeEdge[], companies: Array<{ id: string; name: string }>, vectorRows = 0): AiKnowledgeGraphSummary {
  const latestUpdate = [...nodes.map((node) => node.updatedAt), ...edges.map((edge) => edge.updatedAt)].filter(Boolean).sort().at(-1) ?? null;
  const suggested = edges.filter((edge) => edge.relationshipStatus === "suggested" || edge.validationStatus === "pending_review" || edge.validationStatus === "needs_review");
  const approved = edges.filter((edge) => edge.validationStatus === "approved");
  const rejected = edges.filter((edge) => edge.validationStatus === "rejected" || edge.validationStatus === "incorrect" || edge.relationshipStatus === "rejected");
  const reviewed = approved.length + rejected.length;
  const averageConfidence = edges.length === 0 ? 0 : Number((edges.reduce((total, edge) => total + edge.confidenceScore, 0) / edges.length).toFixed(3));
  const health = detectKnowledgeGraphHealth(nodes, edges);
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    dataSourceCount: new Set(nodes.map((node) => node.sourceTable)).size,
    highRiskNodeCount: nodes.filter((node) => node.riskLevel === "high" || node.riskLevel === "critical").length,
    documentNodeCount: nodes.filter((node) => node.nodeType === "document").length,
    sharedLibraryNodeCount: nodes.filter((node) => node.metadata.sharedLibrary === true).length,
    lowConfidenceCount: edges.filter((edge) => edge.confidenceScore < 0.55).length,
    unreviewedRelationshipCount: edges.filter((edge) => edge.validationStatus === "unreviewed" || edge.validationStatus === "pending_review" || edge.validationStatus === "needs_review").length,
    pendingReviewCount: edges.filter((edge) => edge.validationStatus === "pending_review" || edge.validationStatus === "needs_review" || edge.validationStatus === "unreviewed").length,
    indexedVectorCount: vectorRows,
    companyCount: companies.length,
    suggestedRelationshipCount: suggested.length,
    humanApprovedRelationshipCount: approved.length,
    rejectedRelationshipCount: rejected.length,
    unlinkedHighRiskNodeCount: health.unlinkedHighRiskNodeCount,
    averageConfidence,
    relationshipApprovalRate: reviewed === 0 ? 0 : Number((approved.length / reviewed).toFixed(3)),
    falsePositiveRate: reviewed === 0 ? 0 : Number((rejected.length / reviewed).toFixed(3)),
    missedLinkRate: health.missedLinkRate,
    latestUpdate,
  };
}

function cleanFallbackText(value: unknown, max = 800) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function fallbackRiskScore(level: AiKnowledgeRiskLevel) {
  if (level === "critical") return 92;
  if (level === "high") return 78;
  if (level === "moderate") return 55;
  if (level === "low") return 25;
  return null;
}

function sharedLibraryNode(params: {
  index: number;
  selectedCompanyId: string;
  sourceTable: "approved_knowledge" | "documents";
  sourceId: string;
  title: string;
  category: string;
  description: string;
  sourceUrl: string | null;
  sourceDocument: string | null;
  riskLevel?: AiKnowledgeRiskLevel;
  confidenceScore?: number;
  metadata?: Record<string, unknown>;
}) {
  const riskLevel = params.riskLevel ?? normalizeRiskLevel([params.title, params.category, params.description].join(" "));
  const vectorCoordinates = vectorCoordinatesForNode({
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
    type: "document",
    riskLevel,
  });
  return {
    id: `shared-library-${params.sourceTable}-${params.sourceId}`,
    companyId: null,
    jobsiteId: null,
    projectId: null,
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
    sourceRecordId: params.sourceId,
    title: cleanFallbackText(params.title, 220) || "Approved Knowledge Library guidance",
    nodeType: "document",
    type: "document",
    category: cleanFallbackText(params.category, 120) || "knowledge library",
    description: cleanFallbackText(params.description, 1_400),
    semanticSummary: cleanFallbackText(`${params.title}. ${params.description}`, 1_800),
    project: null,
    trade: null,
    riskLevel,
    riskScore: fallbackRiskScore(riskLevel),
    sourceUrl: params.sourceUrl,
    sourceDocument: params.sourceDocument,
    metadata: {
      ...params.metadata,
      sharedLibrary: true,
      notCompanySpecific: true,
      selectedCompanyId: params.selectedCompanyId,
      safetyUse: "approved shared knowledge library guidance",
    },
    vectorStatus: "indexed",
    vectorCoordinates,
    confidenceScore: params.confidenceScore ?? 0.78,
    validationStatus: "approved",
    createdByType: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies AiKnowledgeNode;
}

function fallbackNode(params: {
  index: number;
  selectedCompanyId: string;
  fallbackSource: "global_document" | "approved_knowledge" | "cross_company_pattern";
  title: string;
  nodeType: AiKnowledgeNodeType;
  category: string;
  description: string;
  riskLevel?: AiKnowledgeRiskLevel;
  confidenceScore?: number;
}) {
  const riskLevel = params.riskLevel ?? normalizeRiskLevel([params.title, params.category, params.description].join(" "));
  const sourceId = `fallback-${params.fallbackSource}-${params.index}`;
  const vectorCoordinates = vectorCoordinatesForNode({
    sourceTable: "ai_fallback_memory",
    sourceId,
    type: params.nodeType,
    riskLevel,
  });
  return {
    id: `fallback-node-${params.fallbackSource}-${params.index}`,
    companyId: null,
    jobsiteId: null,
    projectId: null,
    sourceTable: "ai_fallback_memory",
    sourceId,
    sourceRecordId: sourceId,
    title: cleanFallbackText(params.title, 180) || "Fallback safety intelligence",
    nodeType: params.nodeType,
    type: params.nodeType,
    category: cleanFallbackText(params.category, 120) || "fallback",
    description: cleanFallbackText(params.description, 1_200),
    semanticSummary: cleanFallbackText(`${params.title}. ${params.description}`, 1_600),
    project: null,
    trade: null,
    riskLevel,
    riskScore: fallbackRiskScore(riskLevel),
    sourceUrl: null,
    sourceDocument: null,
    metadata: {
      fallback: true,
      fallbackSource: params.fallbackSource,
      notCompanySpecific: true,
      selectedCompanyId: params.selectedCompanyId,
      safetyUse: "general approved fallback guidance",
    },
    vectorStatus: "fallback",
    vectorCoordinates,
    confidenceScore: params.confidenceScore ?? 0.7,
    validationStatus: "approved",
    createdByType: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies AiKnowledgeNode;
}

function genericPatternTitle(row: Record<string, unknown>, index: number) {
  const type = cleanFallbackText(row.node_type ?? row.type ?? "risk_record", 60).replace(/_/g, " ");
  const category = cleanFallbackText(row.category ?? "safety pattern", 80);
  const risk = cleanFallbackText(row.risk_level ?? "reviewed", 40);
  return `Approved ${risk} ${type} pattern: ${category || `pattern ${index}`}`;
}

function genericPatternDescription(row: Record<string, unknown>) {
  const type = cleanFallbackText(row.node_type ?? row.type ?? "record", 60).replace(/_/g, " ");
  const category = cleanFallbackText(row.category ?? "safety", 80);
  const risk = cleanFallbackText(row.risk_level ?? "unknown", 40);
  return `Anonymized cross-company ${type} pattern for ${category}. This is general fallback guidance based only on approved graph memory and is not evidence from the selected company. Treat it as a prompt for review until company-specific records are approved. Risk level: ${risk}.`;
}

function fallbackEdgeIds(nodes: AiKnowledgeNode[], edges: AiKnowledgeEdge[]) {
  const idByKey = new Map(nodes.map((node) => [sourceKey(node.sourceTable, node.sourceId), node.id]));
  return edges.map((edge, index) => ({
    ...edge,
    id: `fallback-edge-${index + 1}`,
    companyId: null,
    sourceNodeId: idByKey.get(edge.fromNodeKey ?? "") ?? edge.fromNodeId,
    targetNodeId: idByKey.get(edge.toNodeKey ?? "") ?? edge.toNodeId,
    fromNodeId: idByKey.get(edge.fromNodeKey ?? "") ?? edge.fromNodeId,
    toNodeId: idByKey.get(edge.toNodeKey ?? "") ?? edge.toNodeId,
    validationStatus: "approved" as const,
    createdByType: "system" as const,
    metadata: {
      ...edge.metadata,
      fallback: true,
      notCompanySpecific: true,
      fallbackSource: "generated_fallback_relationship",
    },
    sourceEvidence: edge.sourceEvidence.map((item) => ({
      sourceTable: "ai_fallback_memory",
      sourceRecordId: "approved-fallback",
      label: cleanFallbackText(item.label, 180),
      detail: cleanFallbackText(item.detail, 500),
    })),
  }));
}

function generatedVisibleEdgeIds(nodes: AiKnowledgeNode[], edges: AiKnowledgeEdge[], params: { prefix: string; metadata: Record<string, unknown> }) {
  const idByKey = new Map(nodes.map((node) => [sourceKey(node.sourceTable, node.sourceId), node.id]));
  return edges.map((edge, index) => ({
    ...edge,
    id: `${params.prefix}-${index + 1}`,
    companyId: null,
    sourceNodeId: idByKey.get(edge.fromNodeKey ?? "") ?? edge.fromNodeId,
    targetNodeId: idByKey.get(edge.toNodeKey ?? "") ?? edge.toNodeId,
    fromNodeId: idByKey.get(edge.fromNodeKey ?? "") ?? edge.fromNodeId,
    toNodeId: idByKey.get(edge.toNodeKey ?? "") ?? edge.toNodeId,
    validationStatus: "approved" as const,
    createdByType: "system" as const,
    metadata: {
      ...edge.metadata,
      ...params.metadata,
    },
  }));
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

async function createIngestBatch(client: DbClient, input: { companyId: string; actorUserId?: string | null; sourceCounts: Record<string, number>; candidateCounts: Record<string, number>; warnings: string[]; batchType?: string; metadata?: Record<string, unknown> }) {
  const { data, error } = (await client.from("ai_knowledge_ingest_batches").insert({
    company_id: input.companyId,
    batch_type: input.batchType ?? "rebuild_index",
    status: "pending_review",
    source_counts: input.sourceCounts,
    candidate_counts: input.candidateCounts,
    warnings: input.warnings,
    metadata: input.metadata ?? {},
    created_by: input.actorUserId ?? null,
    created_by_type: input.actorUserId ? "user" : "system",
  }).select("*").single()) as QueryResult<Record<string, unknown>>;
  if (error) throw new Error(error.message ?? "Failed to create AI knowledge ingest batch.");
  return camelBatch(data ?? {});
}

function nodeCandidateRow(batchId: string, node: AiKnowledgeNode) {
  const evidence = [{
    sourceTable: node.sourceTable,
    sourceRecordId: node.sourceRecordId || node.sourceId,
    label: node.title,
    detail: node.semanticSummary || node.description || node.title,
  }];
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
    source_evidence: evidence,
    proposed_payload: node,
    confidence_score: node.confidenceScore,
    validation_status: "pending_review",
    metadata: {
      category: node.category,
      nodeType: node.nodeType,
      riskLevel: node.riskLevel,
      evidenceText: node.semanticSummary || node.description || node.title,
      sourceEvidence: evidence,
      requiresHumanReview: true,
      trustedMemoryWrite: false,
      doesNotProveCompliance: true,
    },
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
    metadata: {
      ...edge.metadata,
      evidenceText: edge.evidenceText ?? edge.metadata.evidenceText ?? null,
      sourceEvidence,
      requiresHumanReview: true,
      trustedMemoryWrite: false,
      doesNotProveCompliance: true,
      relationshipStatus: edge.relationshipStatus ?? edge.metadata.relationshipStatus ?? "suggested",
      signalKeys: Array.isArray(edge.metadata.signalKeys) ? edge.metadata.signalKeys : [],
    },
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
    if (params.generateEmbeddings && !isAiKnowledgeEmbeddingDisabled() && embeddingAttempts < params.maxEmbeddingAttempts) {
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

async function loadRelationshipFeedbackProfile(client: DbClient, companyId: string | null) {
  const approved = new Set<string>();
  const rejected = new Set<string>();
  try {
    let query = client
      .from("ai_engine_validation_logs")
      .select("new_status,validation_status,metadata")
      .in("target_type", ["edge", "candidate"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (companyId) query = query.eq("company_id", companyId);
    const { data, error } = (await query) as QueryResult<Array<Record<string, unknown>>>;
    if (error) return { approved, rejected };
    for (const row of data ?? []) {
      const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
      const status = String(row.new_status ?? row.validation_status ?? "");
      const relationshipType = typeof metadata.relationshipType === "string" ? metadata.relationshipType : null;
      const keys = Array.isArray(metadata.signalKeys) ? metadata.signalKeys.map(String) : [];
      const finalKeys = keys.length > 0 ? keys : relationshipType ? [`${relationshipType}:manual_review`] : [];
      for (const key of finalKeys) {
        if (status === "approved" || status === "promoted") approved.add(key);
        if (status === "rejected" || status === "incorrect") rejected.add(key);
      }
    }
  } catch {
    return { approved, rejected };
  }
  return { approved, rejected };
}

export async function rebuildKnowledgeIndex(client: DbClient, params: { companyId: string; actorUserId?: string | null; limitPerTable?: number; generateEmbeddings?: boolean; maxEmbeddingAttempts?: number }): Promise<AiKnowledgeRebuildResult> {
  assertAiKnowledgeWritesEnabled("AI Knowledge Map rebuild");
  const companyId = await assertActiveKnowledgeCompany(client, requireConcreteCompanyId(params.companyId));
  await assertAiKnowledgeCooldown(client, { companyId, eventType: "knowledge_candidates_created", cooldownMinutes: 10, action: "AI Knowledge Map rebuild" });
  const generatedAt = new Date().toISOString();
  const { rowsByTable, warnings } = await fetchSourceRows(client, companyId, params.limitPerTable ?? 80);
  const normalizedNodes = Array.from(rowsByTable.entries()).flatMap(([table, rows]) => normalizeSourceRowsToKnowledgeNodes(table, rows));
  const feedback = await loadRelationshipFeedbackProfile(client, params.companyId);
  const relationshipCandidates = generateKnowledgeRelationships(normalizedNodes, { feedback });
  const candidateCounts = {
    nodes: normalizedNodes.length,
    edges: relationshipCandidates.length,
    failedSources: warnings.length,
  };
  const batch = await createIngestBatch(client, {
    companyId,
    actorUserId: params.actorUserId,
    sourceCounts: countRowsByTable(rowsByTable),
    candidateCounts,
    warnings,
  });
  const candidates = await insertCandidates(client, [
    ...normalizedNodes.map((node) => nodeCandidateRow(batch.id, node)),
    ...relationshipCandidates.map((edge) => edgeCandidateRow(batch.id, companyId, edge)),
    ...warnings.map((warning) => ({
      batch_id: batch.id,
      company_id: companyId,
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
    companyId,
    eventType: "knowledge_candidates_created",
    description: `AI Knowledge Map created ${candidates.length} review candidates. Trusted graph memory was not changed.`,
    metadata: { batchId: batch.id, candidateCounts, generateEmbeddings: Boolean(params.generateEmbeddings) },
    createdBy: params.actorUserId,
  }).catch(() => undefined);
  return {
    ok: true,
    companyId,
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
  assertAiKnowledgeWritesEnabled("AI Knowledge Map relationship recalculation");
  const companyId = await assertActiveKnowledgeCompany(client, requireConcreteCompanyId(params.companyId));
  await assertAiKnowledgeCooldown(client, { companyId, eventType: "knowledge_relationship_candidates_created", cooldownMinutes: 10, action: "AI Knowledge Map relationship recalculation" });
  const { data, error } = (await client.from("ai_knowledge_nodes").select("*").eq("company_id", companyId).limit(500)) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Failed to load knowledge nodes.");
  const nodes = (data ?? []).map(camelNode);
  const feedback = await loadRelationshipFeedbackProfile(client, params.companyId);
  const relationshipCandidates = generateKnowledgeRelationships(nodes, { feedback });
  const batch = await createIngestBatch(client, {
    companyId,
    actorUserId: params.actorUserId,
    sourceCounts: { approvedNodes: nodes.length },
    candidateCounts: { edges: relationshipCandidates.length },
    warnings: [],
    batchType: "relationship_recalculation",
    metadata: { trustedMemoryWrite: false, requiresHumanReview: true },
  });
  const candidates = await insertCandidates(client, relationshipCandidates.map((edge) => edgeCandidateRow(batch.id, companyId, edge)));
  await logEngineEvent(client, {
    companyId,
    eventType: "knowledge_relationship_candidates_created",
    description: `AI Knowledge Map recalculated ${candidates.length} relationship candidates for Human Review. Trusted graph memory was not changed.`,
    metadata: { batchId: batch.id, candidateEdges: candidates.length, trustedMemoryWrite: false, requiresHumanReview: true },
    createdBy: params.actorUserId,
  }).catch(() => undefined);
  return { ok: true, companyId, batchId: batch.id, insertedOrUpdatedEdges: 0, candidateEdges: candidates.length, reviewRequiredCount: candidates.length, generatedAt: new Date().toISOString() };
}

async function recalculateGraphRiskFromRelationships(client: DbClient, companyId: string | null, actorUserId?: string | null) {
  if (!companyId) return;
  const [nodesResult, edgesResult] = await Promise.all([
    client.from("ai_knowledge_nodes").select("*").eq("company_id", companyId).limit(600) as unknown as Promise<QueryResult<Array<Record<string, unknown>>>>,
    client.from("ai_knowledge_edges").select("*").eq("company_id", companyId).eq("validation_status", "approved").limit(900) as unknown as Promise<QueryResult<Array<Record<string, unknown>>>>,
  ]);
  if (nodesResult.error || edgesResult.error) return;
  const nodes = (nodesResult.data ?? []).map(camelNode);
  const edges = (edgesResult.data ?? []).map(camelEdge);
  const approvedByNode = new Map<string, AiKnowledgeEdge[]>();
  for (const edge of edges) {
    for (const id of [edge.sourceNodeId, edge.targetNodeId, edge.fromNodeId, edge.toNodeId].filter(Boolean) as string[]) {
      approvedByNode.set(id, [...(approvedByNode.get(id) ?? []), edge]);
    }
  }

  const updates = nodes.map((node) => {
    if (!node.id) return null;
    const related = approvedByNode.get(node.id) ?? [];
    const maxRelationshipConfidence = related.reduce((max, edge) => Math.max(max, edge.confidenceScore), 0);
    const riskInfluence = Math.min(12, related.length * 2 + (maxRelationshipConfidence >= 0.8 ? 3 : 0));
    const previousRisk = node.metadata.relationshipRisk && typeof node.metadata.relationshipRisk === "object" && !Array.isArray(node.metadata.relationshipRisk) ? node.metadata.relationshipRisk as Record<string, unknown> : {};
    const baselineRiskScore = typeof previousRisk.baselineRiskScore === "number" ? previousRisk.baselineRiskScore : node.riskScore;
    const nextRiskScore = baselineRiskScore == null ? null : Math.min(100, Math.max(baselineRiskScore, baselineRiskScore + riskInfluence));
    const metadata = {
      ...node.metadata,
      relationshipRisk: {
        baselineRiskScore,
        approvedRelationshipCount: related.length,
        riskInfluence,
        maxRelationshipConfidence: Number(maxRelationshipConfidence.toFixed(3)),
        lastRecalculatedAt: new Date().toISOString(),
      },
    };
    return client.from("ai_knowledge_nodes").update({ risk_score: nextRiskScore, metadata }).eq("id", node.id);
  }).filter(Boolean) as Array<PromiseLike<unknown>>;

  await Promise.allSettled(updates);
  const projectRiskScores = summarizeGroupRisk(nodes, "project");
  const tradeRiskScores = summarizeGroupRisk(nodes, "trade");
  const categoryTrends = summarizeGroupRisk(nodes, "category");
  await logEngineEvent(client, {
    companyId,
    eventType: "knowledge_relationship_risk_recalculated",
    description: "AI Knowledge Map recalculated node, project, trade, category, and forecast relationship risk influence.",
    metadata: {
      approvedRelationshipCount: edges.length,
      projectRiskScores,
      tradeRiskScores,
      categoryTrends,
      predictiveForecastImpact: edges.filter((edge) => edge.relationshipType === "predictive_risk_signal" || edge.relationshipType === "repeat_trend").length,
    },
    createdBy: actorUserId,
  }).catch(() => undefined);
}

function summarizeGroupRisk(nodes: AiKnowledgeNode[], field: "project" | "trade" | "category") {
  const groups = new Map<string, number[]>();
  for (const node of nodes) {
    const key = field === "category" ? node.category : node[field] ?? "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(node.riskScore ?? 0);
  }
  return Object.fromEntries(Array.from(groups.entries()).map(([key, scores]) => [key, Math.round(scores.reduce((total, score) => total + score, 0) / Math.max(1, scores.length))]));
}

export async function updateKnowledgeRelationshipValidation(client: DbClient, params: { edgeId: string; status: Exclude<AiKnowledgeValidationStatus, "pending_review" | "needs_review" | "unreviewed">; reason: string; actorUserId: string }) {
  assertAiKnowledgeWritesEnabled("AI Knowledge Map relationship review");
  if ((params.status === "rejected" || params.status === "incorrect") && !hasMeaningfulReviewReason(params.reason)) {
    throw new Error("Rejecting or marking incorrect requires a meaningful review reason.");
  }
  const previous = (await client.from("ai_knowledge_edges").select("*").eq("id", params.edgeId).single()) as QueryResult<Record<string, unknown>>;
  const previousStatus = previous.data ? String(previous.data.validation_status ?? "unreviewed") : null;
  if (previousStatus === "approved" && params.status !== "approved") throw new Error("Approved relationships require an explicit rollback flow before changing trust status.");
  if ((previousStatus === "rejected" || previousStatus === "incorrect") && params.status !== previousStatus) throw new Error("Rejected or incorrect relationships require a deliberate reopen flow before another review.");
  const previousEdge = previous.data ? camelEdge(previous.data) : null;
  const reviewedAt = new Date().toISOString();
  const reviewStatus = params.status === "approved" ? "human_approved" : "rejected";
  const { data, error } = (await client.from("ai_knowledge_edges").update({ validation_status: params.status, status: reviewStatus, reviewed_by: params.actorUserId, reviewed_at: reviewedAt }).eq("id", params.edgeId).select("*").single()) as QueryResult<Record<string, unknown>>;
  if (error) throw new Error(error.message ?? "Failed to update relationship validation.");
  const edge = camelEdge(data ?? {});
  const signalKeys = Array.isArray(previousEdge?.metadata.signalKeys) ? previousEdge.metadata.signalKeys.map(String) : [];
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
    metadata: {
      relationshipType: edge.relationshipType,
      signalKeys,
      learningImpact: params.status === "approved" ? "Future similar relationships receive a small confidence increase." : "Future similar relationships receive a confidence reduction.",
    },
  });
  await recalculateGraphRiskFromRelationships(client, edge.companyId, params.actorUserId).catch(() => undefined);
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

function candidateRiskLevel(candidate: AiKnowledgeIngestCandidate) {
  const payloadRisk = typeof candidate.proposedPayload.riskLevel === "string" ? candidate.proposedPayload.riskLevel : null;
  const metadataRisk = typeof candidate.metadata.riskLevel === "string" ? candidate.metadata.riskLevel : null;
  return String(payloadRisk ?? metadataRisk ?? "unknown").toLowerCase();
}

function candidateRequiresSecondApproval(candidate: AiKnowledgeIngestCandidate) {
  return candidateRiskLevel(candidate) === "critical";
}

function evidenceEntries(candidate: AiKnowledgeIngestCandidate) {
  const metadataEvidence = Array.isArray(candidate.metadata.sourceEvidence) ? candidate.metadata.sourceEvidence as unknown[] : [];
  return candidate.sourceEvidence.length > 0 ? candidate.sourceEvidence : metadataEvidence;
}

function hasTrustedPromotionEvidence(candidate: AiKnowledgeIngestCandidate) {
  const evidence = evidenceEntries(candidate);
  const sourceTable = candidate.sourceTable || (typeof candidate.proposedPayload.sourceTable === "string" ? candidate.proposedPayload.sourceTable : null);
  const sourceId = candidate.sourceId || (typeof candidate.proposedPayload.sourceId === "string" ? candidate.proposedPayload.sourceId : null);
  const evidenceText = typeof candidate.metadata.evidenceText === "string" ? candidate.metadata.evidenceText : candidate.semanticSummary;
  return Boolean(
    sourceTable
    && sourceId
    && candidate.title
    && candidate.reason
    && evidenceText
    && evidence.some((item) => {
      const entry = item as Record<string, unknown>;
      return typeof entry.sourceTable === "string"
        && typeof entry.sourceRecordId === "string"
        && typeof entry.label === "string"
        && typeof entry.detail === "string"
        && entry.detail.trim().length > 0;
    }),
  );
}

function assertCandidateReviewAllowed(candidate: AiKnowledgeIngestCandidate, params: { status: "approved" | "rejected" | "incorrect"; reason: string; actorUserId: string }) {
  if (candidate.validationStatus === "failed" && params.status === "approved") throw new Error("Failed source candidates cannot be approved.");
  if (candidate.validationStatus === "promoted") throw new Error("Promoted candidates cannot be reviewed again.");
  if ((candidate.validationStatus === "rejected" || candidate.validationStatus === "incorrect") && params.status !== candidate.validationStatus) {
    throw new Error("Rejected or incorrect candidates require a deliberate reopen flow before another review.");
  }
  if ((params.status === "rejected" || params.status === "incorrect") && !hasMeaningfulReviewReason(params.reason)) {
    throw new Error("Rejecting or marking incorrect requires a meaningful review reason.");
  }
  if (params.status === "approved" && candidate.validationStatus === "approved" && candidate.reviewedBy === params.actorUserId && candidateRequiresSecondApproval(candidate)) {
    throw new Error("Critical-risk memory requires a second Super Admin approval by a different reviewer.");
  }
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
    relationshipStatus: "human_approved",
    confidenceScore: edge.confidenceScore ?? candidate.confidenceScore ?? 0.65,
  }], []);
  if (!promoted?.id) throw new Error("Relationship candidate could not be promoted.");
  return { nodeId: null as string | null, edgeId: promoted.id };
}

async function promoteCandidate(client: DbClient, candidate: AiKnowledgeIngestCandidate) {
  if (candidate.validationStatus === "promoted") return { nodeId: candidate.promotedNodeId, edgeId: candidate.promotedEdgeId };
  if (!hasTrustedPromotionEvidence(candidate)) throw new Error("Candidate needs evidence text, source table, source ID, source label, and a human-readable reason before promotion.");
  if (candidate.candidateType === "node") return promoteNodeCandidate(client, candidate);
  if (candidate.candidateType === "edge") return promoteEdgeCandidate(client, candidate);
  throw new Error("Failed source candidates cannot be promoted.");
}

export async function reviewKnowledgeIngestCandidates(client: DbClient, params: { candidateIds: string[]; status: "approved" | "rejected" | "incorrect"; reason: string; actorUserId: string; promoteApproved?: boolean }) {
  assertAiKnowledgeWritesEnabled("AI Knowledge Map candidate review");
  const reviewedAt = new Date().toISOString();
  const results: AiKnowledgeIngestCandidate[] = [];
  const errors: Array<{ candidateId: string; error: string }> = [];
  for (const candidateId of params.candidateIds) {
    try {
      const loaded = await getKnowledgeIngestCandidate(client, candidateId);
      const previousStatus = loaded.candidate.validationStatus;
      assertCandidateReviewAllowed(loaded.candidate, params);
      let candidate = loaded.candidate;
      const needsSecondReview = candidateRequiresSecondApproval(candidate);
      const firstCriticalApproval = params.status === "approved" && params.promoteApproved !== false && needsSecondReview && candidate.validationStatus !== "approved";
      if (params.status === "approved" && params.promoteApproved !== false && !firstCriticalApproval) {
        const promoted = await promoteCandidate(client, { ...candidate, validationStatus: "approved", reviewedBy: params.actorUserId, reviewedAt, reviewNote: params.reason });
        const promotedAt = new Date().toISOString();
        const update = await client.from("ai_knowledge_ingest_candidates").update({
          validation_status: "promoted",
          review_note: params.reason,
          reviewed_by: params.actorUserId,
          reviewed_at: reviewedAt,
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
          metadata: {
            candidateType: candidate.candidateType,
            promotedNodeId: promoted.nodeId,
            promotedEdgeId: promoted.edgeId,
            relationshipType: candidate.relationshipType,
            signalKeys: Array.isArray(candidate.metadata.signalKeys) ? candidate.metadata.signalKeys : [],
            learningImpact: candidate.candidateType === "edge" ? "Approved relationship candidates increase future confidence for similar signals." : undefined,
          },
          createdBy: params.actorUserId,
        }).catch(() => undefined);
        if (candidate.candidateType === "edge") await recalculateGraphRiskFromRelationships(client, candidate.companyId, params.actorUserId).catch(() => undefined);
      } else {
        const { data, error } = (await client.from("ai_knowledge_ingest_candidates").update({
          validation_status: params.status,
          review_note: params.reason,
          reviewed_by: params.actorUserId,
          reviewed_at: reviewedAt,
        }).eq("id", candidateId).select("*").single()) as QueryResult<Record<string, unknown>>;
        if (error) throw new Error(error.message ?? "Failed to update candidate review status.");
        candidate = camelCandidate(data ?? {});
        await logEngineEvent(client, {
          companyId: candidate.companyId,
          eventType: "knowledge_candidate_reviewed",
          description: firstCriticalApproval
            ? `AI Knowledge candidate ${candidate.id} received first critical-risk approval and still requires a second Super Admin approval.`
            : `AI Knowledge candidate ${candidate.id} was marked ${params.status}.`,
          metadata: {
            candidateType: candidate.candidateType,
            reason: params.reason,
            relationshipType: candidate.relationshipType,
            signalKeys: Array.isArray(candidate.metadata.signalKeys) ? candidate.metadata.signalKeys : [],
            learningImpact: candidate.candidateType === "edge" && (params.status === "rejected" || params.status === "incorrect")
              ? "Rejected relationship candidates reduce future confidence for similar signals."
              : firstCriticalApproval ? "Critical-risk memory is not trusted until a second Super Admin approval promotes it." : undefined,
          },
          createdBy: params.actorUserId,
        }).catch(() => undefined);
      }
      if (candidate.candidateType === "edge") {
        try {
          await client.from("ai_engine_validation_logs").insert({
            target_type: "candidate",
            target_id: candidate.id,
            company_id: candidate.companyId,
            validation_action: params.status === "approved" ? "approve_candidate" : params.status === "incorrect" ? "mark_candidate_incorrect" : "reject_candidate",
            validation_note: params.reason,
            previous_status: previousStatus,
            new_status: params.status,
            validation_status: params.status,
            reason: params.reason,
            reviewed_by: params.actorUserId,
            created_by: params.actorUserId,
            metadata: {
              relationshipType: candidate.relationshipType,
              signalKeys: Array.isArray(candidate.metadata.signalKeys) ? candidate.metadata.signalKeys : [],
            },
          });
        } catch {
          // Feedback logs should never block the human review action.
        }
      }
      results.push(candidate);
    } catch (error) {
      errors.push({ candidateId, error: error instanceof Error ? error.message : "Review failed." });
    }
  }
  return { ok: errors.length === 0, reviewed: results, errors };
}

export async function promoteApprovedKnowledgeCandidates(client: DbClient, params: { companyId?: string | null; batchId?: string | null; actorUserId: string; limit?: number }) {
  assertAiKnowledgeWritesEnabled("AI Knowledge Map approved candidate promotion");
  const companyId = params.companyId ? await assertActiveKnowledgeCompany(client, requireConcreteCompanyId(params.companyId)) : params.companyId;
  const listed = await listKnowledgeIngestCandidates(client, { companyId, batchId: params.batchId, status: "approved", limit: params.limit ?? 100 });
  const nodeIds = listed.candidates.filter((candidate) => candidate.candidateType === "node").map((candidate) => candidate.id);
  const edgeIds = listed.candidates.filter((candidate) => candidate.candidateType === "edge").map((candidate) => candidate.id);
  const first = await reviewKnowledgeIngestCandidates(client, { candidateIds: nodeIds, status: "approved", reason: "Promoted approved node candidate to trusted graph memory.", actorUserId: params.actorUserId, promoteApproved: true });
  const second = await reviewKnowledgeIngestCandidates(client, { candidateIds: edgeIds, status: "approved", reason: "Promoted approved relationship candidate to trusted graph memory.", actorUserId: params.actorUserId, promoteApproved: true });
  return { ok: first.ok && second.ok, promoted: [...first.reviewed, ...second.reviewed], errors: [...first.errors, ...second.errors] };
}

export async function archiveTrustedKnowledgeMemory(client: DbClient, params: { targetType: "node" | "edge"; targetId: string; reason: string; actorUserId: string }) {
  assertAiKnowledgeWritesEnabled("AI Knowledge Map trusted memory rollback");
  if (!hasMeaningfulReviewReason(params.reason)) throw new Error("Archiving trusted memory requires a meaningful reason.");
  const table = params.targetType === "edge" ? "ai_knowledge_edges" : "ai_knowledge_nodes";
  const previous = (await client.from(table).select("*").eq("id", params.targetId).single()) as QueryResult<Record<string, unknown>>;
  if (previous.error || !previous.data) throw new Error(previous.error?.message ?? "Trusted memory item was not found.");
  const metadata = previous.data.metadata && typeof previous.data.metadata === "object" && !Array.isArray(previous.data.metadata)
    ? previous.data.metadata as Record<string, unknown>
    : {};
  const archivedAt = new Date().toISOString();
  const patch: Record<string, unknown> = {
    validation_status: "rejected",
    metadata: {
      ...metadata,
      archivedFromTrustedMemory: true,
      archivedAt,
      archiveReason: params.reason,
      archivedBy: params.actorUserId,
    },
  };
  if (params.targetType === "edge") patch.status = "rejected";
  const { data, error } = (await client.from(table).update(patch).eq("id", params.targetId).select("*").single()) as QueryResult<Record<string, unknown>>;
  if (error) throw new Error(error.message ?? "Failed to archive trusted AI memory.");
  const companyId = typeof data?.company_id === "string" ? data.company_id : null;
  await logEngineEvent(client, {
    companyId,
    eventType: "trusted_memory_archived",
    description: `Super Admin archived AI Knowledge ${params.targetType} trusted memory.`,
    metadata: { targetType: params.targetType, targetId: params.targetId, reason: params.reason },
    createdBy: params.actorUserId,
  }).catch(() => undefined);
  return { ok: true, targetType: params.targetType, targetId: params.targetId, archivedAt };
}

export async function buildFallbackKnowledgeGraph(client: DbClient, selectedCompanyId: string, filters: AiKnowledgeMapFilters = {}) {
  const warnings: string[] = [];
  const nodes: AiKnowledgeNode[] = [];

  try {
    const { data, error } = (await client
      .from("approved_knowledge")
      .select("*")
      .is("company_id", null)
      .eq("is_active", true)
      .neq("review_status", "archived")
      .order("updated_at", { ascending: false })
      .limit(16)) as QueryResult<Array<Record<string, unknown>>>;
    if (error) warnings.push(error.message ?? "Global approved knowledge fallback unavailable.");
    (data ?? []).forEach((row, index) => {
      const title = cleanFallbackText(row.knowledge_title ?? row.topic ?? "Approved safety guidance", 180);
      const summary = cleanFallbackText(row.approved_summary ?? row.topic ?? "", 1_200);
      nodes.push(fallbackNode({
        index: index + 1,
        selectedCompanyId,
        fallbackSource: "approved_knowledge",
        title,
        nodeType: "document",
        category: cleanFallbackText(row.required_control_type ?? row.source_type ?? "approved knowledge", 120),
        description: `${summary} This is globally approved fallback guidance and is not company-specific evidence.`,
        riskLevel: normalizeRiskLevel([title, summary].join(" ")),
        confidenceScore: Math.max(0.58, Math.min(0.92, Number(row.quality_score ?? 72) / 100)),
      }));
    });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Global approved knowledge fallback unavailable.");
  }

  try {
    const { data, error } = (await client
      .from("documents")
      .select("id, document_title, document_type, category, notes, status, final_file_path, updated_at, company_id")
      .is("company_id", null)
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(10)) as QueryResult<Array<Record<string, unknown>>>;
    if (error) warnings.push(error.message ?? "Global document fallback unavailable.");
    (data ?? []).forEach((row, index) => {
      const title = cleanFallbackText(row.document_title ?? row.document_type ?? "Approved SafetyDocs360 document", 180);
      const notes = cleanFallbackText(row.notes ?? row.category ?? row.document_type ?? "", 1_000);
      nodes.push(fallbackNode({
        index: index + 1,
        selectedCompanyId,
        fallbackSource: "global_document",
        title,
        nodeType: "document",
        category: cleanFallbackText(row.category ?? row.document_type ?? "global document", 120),
        description: `${notes || "Approved/final SafetyDocs360 document available as general fallback safety context."} This fallback does not expose a source file or customer record.`,
        riskLevel: normalizeRiskLevel([title, notes].join(" ")),
        confidenceScore: 0.76,
      }));
    });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Global document fallback unavailable.");
  }

  try {
    const { data, error } = (await client
      .from("ai_knowledge_nodes")
      .select("id, company_id, title, node_type, type, category, description, semantic_summary, risk_level, confidence_score")
      .neq("company_id", selectedCompanyId)
      .eq("validation_status", "approved")
      .order("updated_at", { ascending: false })
      .limit(24)) as QueryResult<Array<Record<string, unknown>>>;
    if (error) warnings.push(error.message ?? "Cross-company fallback patterns unavailable.");
    (data ?? []).forEach((row, index) => {
      const nodeType = String(row.node_type ?? row.type ?? "risk_record") as AiKnowledgeNodeType;
      const safeType = ["permit", "task", "hazard", "control", "training", "incident", "observation", "corrective_action", "document", "risk_record"].includes(nodeType) ? nodeType : "risk_record";
      nodes.push(fallbackNode({
        index: index + 1,
        selectedCompanyId,
        fallbackSource: "cross_company_pattern",
        title: genericPatternTitle(row, index + 1),
        nodeType: safeType,
        category: cleanFallbackText(row.category ?? safeType, 120),
        description: genericPatternDescription(row),
        riskLevel: normalizeRiskLevel(row.risk_level),
        confidenceScore: Math.max(0.55, Math.min(0.86, Number(row.confidence_score ?? 0.68))),
      }));
    });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Cross-company fallback patterns unavailable.");
  }

  const dedupedNodes = Array.from(new Map(nodes.map((node) => [`${node.title}:${node.category}:${node.nodeType}`, node])).values()).slice(0, 36);
  const filteredNodes = filterNodes(dedupedNodes, filters);
  const visibleIds = new Set(filteredNodes.map((node) => node.id).filter(Boolean));
  const edges = fallbackEdgeIds(filteredNodes, generateKnowledgeRelationships(filteredNodes, { maxEdges: 90 }))
    .filter((edge) => visibleIds.has(edge.sourceNodeId) && visibleIds.has(edge.targetNodeId))
    .slice(0, 90);

  return { nodes: filteredNodes, edges, warnings };
}

export async function buildSharedKnowledgeLibraryGraph(client: DbClient, selectedCompanyId: string, filters: AiKnowledgeMapFilters = {}) {
  const warnings: string[] = [];
  const nodes: AiKnowledgeNode[] = [];

  try {
    const { data, error } = (await client
      .from("approved_knowledge")
      .select("id, topic, knowledge_title, approved_summary, source_url, source_title, source_type, required_control_type, regulation_reference, quality_score, review_status, is_active, updated_at")
      .is("company_id", null)
      .eq("is_active", true)
      .neq("review_status", "archived")
      .order("updated_at", { ascending: false })
      .limit(24)) as QueryResult<Array<Record<string, unknown>>>;
    if (error) warnings.push(error.message ?? "Shared approved knowledge library unavailable.");
    (data ?? []).forEach((row, index) => {
      const sourceId = cleanFallbackText(row.id, 120);
      if (!sourceId) return;
      const title = cleanFallbackText(row.knowledge_title ?? row.topic ?? "Approved safety guidance", 220);
      const summary = cleanFallbackText(row.approved_summary ?? row.topic ?? "", 1_400);
      nodes.push(sharedLibraryNode({
        index: index + 1,
        selectedCompanyId,
        sourceTable: "approved_knowledge",
        sourceId,
        title,
        category: cleanFallbackText(row.required_control_type ?? row.source_type ?? "knowledge library", 120),
        description: `${summary} This is approved shared Knowledge Library guidance and is not company-specific evidence.`,
        sourceUrl: cleanFallbackText(row.source_url, 800) || null,
        sourceDocument: cleanFallbackText(row.source_title ?? row.source_url, 800) || null,
        riskLevel: normalizeRiskLevel([title, summary].join(" ")),
        confidenceScore: Math.max(0.58, Math.min(0.94, Number(row.quality_score ?? 78) / 100)),
        metadata: {
          sharedLibrarySource: "approved_knowledge",
          reviewStatus: cleanFallbackText(row.review_status, 60),
          regulationReference: cleanFallbackText(row.regulation_reference, 160) || null,
        },
      }));
    });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Shared approved knowledge library unavailable.");
  }

  try {
    const { data, error } = (await client
      .from("documents")
      .select("id, document_title, document_type, category, notes, status, final_file_path, updated_at, company_id")
      .is("company_id", null)
      .in("status", ["approved", "final", "published", "complete"])
      .order("updated_at", { ascending: false })
      .limit(16)) as QueryResult<Array<Record<string, unknown>>>;
    if (error) warnings.push(error.message ?? "Shared approved document library unavailable.");
    (data ?? []).forEach((row, index) => {
      const sourceId = cleanFallbackText(row.id, 120);
      if (!sourceId) return;
      const title = cleanFallbackText(row.document_title ?? row.document_type ?? "Approved SafetyDocs360 document", 220);
      const notes = cleanFallbackText(row.notes ?? row.category ?? row.document_type ?? "", 1_200);
      nodes.push(sharedLibraryNode({
        index: index + 1,
        selectedCompanyId,
        sourceTable: "documents",
        sourceId,
        title,
        category: cleanFallbackText(row.category ?? row.document_type ?? "knowledge library", 120),
        description: `${notes || "Approved shared SafetyDocs360 document available as Knowledge Library guidance."} This shared item is not company-specific evidence.`,
        sourceUrl: null,
        sourceDocument: cleanFallbackText(row.final_file_path, 800) || null,
        riskLevel: normalizeRiskLevel([title, notes].join(" ")),
        confidenceScore: 0.78,
        metadata: {
          sharedLibrarySource: "global_document",
          originalStatus: cleanFallbackText(row.status, 80),
        },
      }));
    });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Shared approved document library unavailable.");
  }

  const dedupedNodes = Array.from(new Map(nodes.map((node) => [`${node.sourceTable}:${node.sourceId}`, node])).values()).slice(0, 36);
  const filteredNodes = filterNodes(dedupedNodes, filters);
  return { nodes: filteredNodes, warnings };
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
  const rawNodes = (nodeResult.data ?? []).map(camelNode);
  const learningReview = await countPendingLearningReview(client, selectedCompanyId);
  const displayableRawNodes = rawNodes.filter((node) => isLearningNodeVisibleOnMap(node) && (node.nodeType !== "document" || node.validationStatus === "approved"));
  let nodes = filterNodes(displayableRawNodes, filters);
  const visibleNodeIds = new Set(nodes.map((node) => node.id).filter(Boolean));
  const edgeQuery = client.from("ai_knowledge_edges").select("*").limit(900);
  const edgeResult = (await (viewingAllCompanies ? edgeQuery : edgeQuery.eq("company_id", selectedCompanyId))) as QueryResult<Array<Record<string, unknown>>>;
  if (edgeResult.error) throw new Error(edgeResult.error.message ?? "Failed to load knowledge edges.");
  const rawEdges = (edgeResult.data ?? []).map(camelEdge);
  let edges = rawEdges.filter((edge) => visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId));
  const companyDocumentNodeCount = rawNodes.filter((node) => node.validationStatus === "approved" && node.nodeType === "document" && node.metadata.sharedLibrary !== true && node.metadata.fallback !== true).length;
  const sharedLibraryGraph = await buildSharedKnowledgeLibraryGraph(client, selectedCompanyId, filters);
  if (sharedLibraryGraph.nodes.length > 0) {
    const existingIds = new Set(nodes.map((node) => node.id).filter(Boolean));
    const sharedNodes = sharedLibraryGraph.nodes.filter((node) => !existingIds.has(node.id));
    if (sharedNodes.length > 0) {
      nodes = [...nodes, ...sharedNodes];
      const visibleNodes = nodes.filter((node) => node.id);
      const sharedIds = new Set(sharedNodes.map((node) => node.id).filter(Boolean));
      const visibleIds = new Set(visibleNodes.map((node) => node.id).filter(Boolean));
      const sharedEdges = generatedVisibleEdgeIds(
        visibleNodes,
        generateKnowledgeRelationships(visibleNodes, { maxEdges: 140 }),
        {
          prefix: "shared-library-edge",
          metadata: {
            sharedLibrary: true,
            notCompanySpecific: true,
            sourceTable: "approved_knowledge",
            reason: SHARED_LIBRARY_REASON,
          },
        },
      ).filter((edge) =>
        visibleIds.has(edge.sourceNodeId)
        && visibleIds.has(edge.targetNodeId)
        && (sharedIds.has(edge.sourceNodeId) || sharedIds.has(edge.targetNodeId)),
      ).slice(0, 120);
      edges = [...edges, ...sharedEdges];
    }
  }
  warnings.push(...sharedLibraryGraph.warnings.slice(0, 3));
  const approvedCompanyNodeCount = viewingAllCompanies ? rawNodes.filter((node) => node.validationStatus === "approved").length : rawNodes.filter((node) => node.validationStatus === "approved" && node.companyId === selectedCompanyId).length;
  const approvedCompanyEdgeCount = viewingAllCompanies ? rawEdges.filter((edge) => edge.validationStatus === "approved").length : rawEdges.filter((edge) => edge.validationStatus === "approved" && edge.companyId === selectedCompanyId).length;
  let fallback = false;
  let fallbackReason: string | null = null;
  if (!viewingAllCompanies && (approvedCompanyNodeCount < FALLBACK_NODE_THRESHOLD || approvedCompanyEdgeCount < FALLBACK_EDGE_THRESHOLD)) {
    const fallbackGraph = await buildFallbackKnowledgeGraph(client, selectedCompanyId, filters);
    if (fallbackGraph.nodes.length > 0) {
      const existingIds = new Set(nodes.map((node) => node.id).filter(Boolean));
      const fallbackNodes = fallbackGraph.nodes.filter((node) => !existingIds.has(node.id));
      const fallbackNodeIds = new Set(fallbackNodes.map((node) => node.id).filter(Boolean));
      nodes = [...nodes, ...fallbackNodes];
      edges = [...edges, ...fallbackGraph.edges.filter((edge) => fallbackNodeIds.has(edge.sourceNodeId) && fallbackNodeIds.has(edge.targetNodeId))];
      fallback = true;
      fallbackReason = FALLBACK_REASON;
      warnings.push(FALLBACK_REASON);
    }
    warnings.push(...fallbackGraph.warnings.slice(0, 3));
  }
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
  if (learningReview.pendingLearningCandidateCount > 0) {
    warnings.push(`${LEARNING_REVIEW_REQUIRED_BANNER} ${learningReview.pendingLearningCandidateCount} learned item${learningReview.pendingLearningCandidateCount === 1 ? "" : "s"} waiting.`);
  }
  warnings.push(...detectKnowledgeGraphHealth(nodes, edges).warnings);
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
    fallback,
    fallbackReason,
    companySpecificNodeCount: approvedCompanyNodeCount,
    companySpecificEdgeCount: approvedCompanyEdgeCount,
    companyDocumentNodeCount,
    sharedLibraryNodeCount: nodes.filter((node) => node.metadata.sharedLibrary === true).length,
    pendingLearningCandidateCount: learningReview.pendingLearningCandidateCount,
    pendingLearningBatchCount: learningReview.pendingLearningBatchCount,
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
