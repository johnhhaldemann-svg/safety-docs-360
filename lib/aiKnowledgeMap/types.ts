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
] as const;

export type AiKnowledgeRelationshipType = (typeof AI_KNOWLEDGE_RELATIONSHIP_TYPES)[number];
export type AiKnowledgeRiskLevel = "unknown" | "low" | "moderate" | "high" | "critical";
export type AiKnowledgeValidationStatus = "unreviewed" | "pending_review" | "approved" | "rejected" | "incorrect" | "needs_review";
export type AiKnowledgeCreatorType = "system" | "user" | "ai";
export type AiKnowledgeVectorStatus = "pending" | "indexed" | "failed" | "fallback";

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
  sourceEvidence: AiKnowledgeEvidence[];
  confidenceScore: number;
  validationStatus: AiKnowledgeValidationStatus;
  createdByType: AiKnowledgeCreatorType;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type AiKnowledgeGraphSummary = {
  nodeCount: number;
  edgeCount: number;
  dataSourceCount: number;
  highRiskNodeCount: number;
  lowConfidenceCount: number;
  unreviewedRelationshipCount: number;
  pendingReviewCount: number;
  indexedVectorCount: number;
  companyCount: number;
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
  insertedOrUpdatedNodes: number;
  insertedOrUpdatedEdges: number;
  vectorRows: number;
  embeddingAttempts: number;
  warnings: string[];
  generatedAt: string;
};
