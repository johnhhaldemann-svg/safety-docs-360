export const AI_KNOWLEDGE_RELATIONSHIP_TYPES = [
  "permit_requires_control",
  "task_has_hazard",
  "hazard_mitigated_by_control",
  "training_required_for_task",
  "incident_related_to_task",
  "incident_caused_by_hazard",
  "observation_created_corrective_action",
  "risk_increased_by_training_gap",
  "risk_reduced_by_control",
  "document_supports_requirement",
  "similar_record_by_vector_match",
  "historical_pattern_match",
  "predictive_risk_connection",
  "permit_required_for_task",
  "corrective_action_closes_hazard",
  "control_required_by_document",
  "user_training_gap_affects_task",
  "project_contains_risk_cluster",
  "caused_by",
  "related_hazard",
  "required_control",
  "required_training",
  "corrective_action_required",
  "permit_related",
  "jsa_related",
  "repeat_trend",
  "predictive_risk_signal",
  "body_part_related",
  "equipment_related",
  "trade_related",
  "project_related",
  "document_reference",
] as const;

export type AiKnowledgeRelationshipType = (typeof AI_KNOWLEDGE_RELATIONSHIP_TYPES)[number];
export type AiKnowledgeRiskLevel = "unknown" | "low" | "moderate" | "high" | "critical";
export type AiKnowledgeValidationStatus = "unreviewed" | "pending_review" | "approved" | "rejected" | "incorrect" | "needs_review";
export type AiKnowledgeCandidateStatus = "pending_review" | "approved" | "rejected" | "incorrect" | "promoted" | "failed";
export type AiKnowledgeCandidateType = "node" | "edge" | "failed_source";
export type AiKnowledgeCreatorType = "system" | "user" | "ai";
export type AiKnowledgeVectorStatus = "pending" | "indexed" | "failed" | "fallback";
export type AiKnowledgeRelationshipReviewStatus = "draft" | "suggested" | "auto_linked" | "human_approved" | "rejected" | "needs_more_data";

export type AiKnowledgeNodeType =
  | "permit"
  | "task"
  | "hazard"
  | "control"
  | "training"
  | "incident"
  | "observation"
  | "corrective_action"
  | "document"
  | "risk_record"
  | "company"
  | "project"
  | "trade"
  | "user_role";

export type AiKnowledgeEvidence = {
  sourceTable: string;
  sourceRecordId: string;
  label: string;
  detail: string;
};

export type AiKnowledgeNode = {
  id?: string;
  sourceTable: string;
  sourceId: string;
  sourceRecordId: string;
  projectId: string | null;
  companyId: string | null;
  jobsiteId: string | null;
  title: string;
  nodeType: AiKnowledgeNodeType;
  type: AiKnowledgeNodeType;
  category: string;
  description: string;
  semanticSummary: string;
  riskLevel: AiKnowledgeRiskLevel;
  riskScore: number | null;
  trade: string | null;
  project: string | null;
  sourceUrl: string | null;
  sourceDocument: string | null;
  metadata: Record<string, unknown>;
  vectorStatus: AiKnowledgeVectorStatus;
  vectorCoordinates: { x: number; y: number; z: number; cluster: string };
  confidenceScore: number | null;
  validationStatus: AiKnowledgeValidationStatus;
  createdByType: AiKnowledgeCreatorType;
  createdAt?: string;
  updatedAt?: string;
};

export type AiKnowledgeEdge = {
  id?: string;
  companyId: string | null;
  sourceNodeId?: string;
  targetNodeId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  fromNodeKey?: string;
  toNodeKey?: string;
  relationshipType: AiKnowledgeRelationshipType;
  relationshipStrength: number;
  strengthScore: number;
  reason: string;
  evidenceText?: string | null;
  sourceEvidence: AiKnowledgeEvidence[];
  confidenceScore: number;
  validationStatus: AiKnowledgeValidationStatus;
  relationshipStatus?: AiKnowledgeRelationshipReviewStatus;
  createdByType: AiKnowledgeCreatorType;
  createdBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type AiKnowledgeRelationshipSuggestion = {
  relationshipType: AiKnowledgeRelationshipType;
  label: string;
  confidenceScore: number;
  reason: string;
  evidenceText: string;
  status: AiKnowledgeRelationshipReviewStatus;
  createdBy: AiKnowledgeCreatorType;
  targetTitle?: string | null;
};

export type AiKnowledgeGraphSummary = {
  nodeCount: number;
  edgeCount: number;
  dataSourceCount: number;
  highRiskNodeCount: number;
  documentNodeCount?: number;
  sharedLibraryNodeCount?: number;
  lowConfidenceCount: number;
  unreviewedRelationshipCount: number;
  pendingReviewCount: number;
  indexedVectorCount: number;
  companyCount: number;
  suggestedRelationshipCount?: number;
  humanApprovedRelationshipCount?: number;
  rejectedRelationshipCount?: number;
  unlinkedHighRiskNodeCount?: number;
  averageConfidence?: number;
  relationshipApprovalRate?: number;
  falsePositiveRate?: number;
  missedLinkRate?: number;
  latestUpdate: string | null;
};

export type AiKnowledgeGraphPayload = {
  companies: Array<{ id: string; name: string }>;
  selectedCompanyId: string | null;
  nodes: AiKnowledgeNode[];
  edges: AiKnowledgeEdge[];
  validationQueue: AiKnowledgeEdge[];
  summary: AiKnowledgeGraphSummary;
  generatedAt: string;
  warnings: string[];
  demo: boolean;
  fallback?: boolean;
  fallbackReason?: string | null;
  companySpecificNodeCount?: number;
  companySpecificEdgeCount?: number;
  companyDocumentNodeCount?: number;
  sharedLibraryNodeCount?: number;
  pendingLearningCandidateCount?: number;
  pendingLearningBatchCount?: number;
};

export type AiKnowledgeMapFilters = {
  companyId?: string | null;
  project?: string | null;
  category?: string | null;
  riskLevel?: AiKnowledgeRiskLevel | "all" | null;
  dateRange?: string | null;
  trade?: string | null;
  sourceType?: AiKnowledgeNodeType | "all" | null;
  query?: string | null;
};

export type AiKnowledgeSourceRow = Record<string, unknown>;

export type AiKnowledgeRebuildResult = {
  ok: boolean;
  companyId: string | null;
  batchId?: string | null;
  insertedOrUpdatedNodes: number;
  insertedOrUpdatedEdges: number;
  vectorRows: number;
  embeddingAttempts: number;
  candidateNodes?: number;
  candidateEdges?: number;
  failedSourceCandidates?: number;
  reviewRequiredCount?: number;
  warnings: string[];
  generatedAt: string;
};

export type AiKnowledgeIngestBatch = {
  id: string;
  companyId: string | null;
  batchType: string;
  status: string;
  sourceCounts: Record<string, number>;
  candidateCounts: Record<string, number>;
  warnings: string[];
  createdAt: string;
  updatedAt?: string;
};

export type AiKnowledgeIngestCandidate = {
  id: string;
  batchId: string | null;
  companyId: string | null;
  candidateType: AiKnowledgeCandidateType;
  sourceTable: string | null;
  sourceId: string | null;
  sourceRecordId: string | null;
  sourceNodeKey: string | null;
  targetNodeKey: string | null;
  relationshipType: AiKnowledgeRelationshipType | null;
  title: string;
  semanticSummary: string | null;
  reason: string | null;
  sourceEvidence: AiKnowledgeEvidence[];
  proposedPayload: Record<string, unknown>;
  confidenceScore: number | null;
  validationStatus: AiKnowledgeCandidateStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  promotedNodeId: string | null;
  promotedEdgeId: string | null;
  promotedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type TrustedKnowledgeGraphMemoryItem = {
  id: string;
  nodeId: string;
  companyId: string | null;
  title: string;
  excerpt: string;
  sourceTable: string;
  sourceId: string;
  category: string;
  nodeType: AiKnowledgeNodeType;
  riskLevel: AiKnowledgeRiskLevel;
  confidenceScore: number;
  relationshipReasons: string[];
  evidence: AiKnowledgeEvidence[];
  similarity?: number | null;
};

export type TrustedKnowledgeGraphMemoryMethod =
  | "approved_graph_semantic"
  | "approved_graph_keyword"
  | "approved_graph_with_fallback"
  | "none";
