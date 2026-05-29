export const SOURCE_TYPES = [
  "OSHA",
  "NIOSH",
  "CDC",
  "NFPA reference",
  "manufacturer manual",
  "company policy",
  "site safety plan",
  "SDS",
  "owner requirement",
  "insurance carrier guidance",
  "blog_article",
  "other",
] as const;

export const TRUST_LEVELS = ["high", "medium", "low", "blocked"] as const;
export const RESEARCH_STATUSES = ["pending_review", "approved", "rejected", "needs_more_review", "archived"] as const;
export const REQUIRED_CONTROL_TYPES = [
  "regulatory_requirement",
  "company_policy",
  "site_requirement",
  "manufacturer_instruction",
  "best_practice",
  "ai_suggestion",
] as const;
export const FEEDBACK_TYPES = ["helpful", "not_helpful", "unsafe", "incorrect", "missing_source"] as const;
export const REVIEW_ITEM_TYPES = [
  "unsafe_answer",
  "incorrect_answer",
  "missing_source",
  "weak_citation",
  "expired_source_used",
  "classification_dispute",
] as const;
export const REVIEW_ITEM_STATUSES = ["pending_review", "in_review", "resolved", "archived"] as const;

export type GusLearningSourceType = (typeof SOURCE_TYPES)[number];
export type GusLearningTrustLevel = (typeof TRUST_LEVELS)[number];
export type GusResearchStatus = (typeof RESEARCH_STATUSES)[number];
export type GusRequiredControlType = (typeof REQUIRED_CONTROL_TYPES)[number];
export type GusAnswerFeedbackType = (typeof FEEDBACK_TYPES)[number];
export type GusLearningReviewItemType = (typeof REVIEW_ITEM_TYPES)[number];
export type GusLearningReviewItemStatus = (typeof REVIEW_ITEM_STATUSES)[number];
export type GusKnowledgeReviewStatus = "current" | "needs_review" | "archived";
export type GusKnowledgeChangeType = "created" | "edited" | "approved" | "rejected" | "archived" | "expired";

export type ApprovedSourceRow = {
  id: string;
  company_id: string | null;
  source_name: string;
  source_url: string;
  domain: string;
  source_type: GusLearningSourceType;
  jurisdiction: string;
  trust_level: GusLearningTrustLevel;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ResearchQueueRow = {
  id: string;
  requested_by: string | null;
  company_id: string;
  project_id: string | null;
  approved_source_id: string | null;
  topic: string;
  question: string;
  source_url: string;
  source_title: string | null;
  source_domain: string;
  source_type: GusLearningSourceType;
  date_accessed: string;
  raw_summary: string;
  ai_confidence: number | null;
  jurisdiction: string;
  affected_modules: string[];
  status: GusResearchStatus;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ApprovedKnowledgeRow = {
  id: string;
  company_id: string | null;
  project_id: string | null;
  approved_source_id: string | null;
  research_queue_id: string | null;
  topic: string;
  knowledge_title: string;
  approved_summary: string;
  source_url: string;
  source_title: string | null;
  source_type: GusLearningSourceType;
  jurisdiction: string;
  regulation_reference: string | null;
  applies_to: string | null;
  affected_modules: string[];
  required_control_type: GusRequiredControlType;
  citation_excerpt: string | null;
  citation_locator: string | null;
  source_content_hash: string | null;
  verification_notes: string | null;
  quality_score: number;
  supersedes_knowledge_id: string | null;
  superseded_by_knowledge_id: string | null;
  approved_by: string | null;
  approved_at: string;
  review_due_date: string;
  review_status: GusKnowledgeReviewStatus;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  similarity?: number;
};

export type KnowledgeChangeLogRow = {
  id: string;
  knowledge_id: string | null;
  company_id: string | null;
  change_type: GusKnowledgeChangeType;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
};

export type GusAnswerFeedbackRow = {
  id: string;
  answer_id: string;
  answer_audit_id: string | null;
  user_id: string | null;
  company_id: string | null;
  project_id: string | null;
  feedback_type: GusAnswerFeedbackType;
  comment: string | null;
  needs_admin_review: boolean;
  review_status: GusResearchStatus;
  created_at: string;
};

export type GusCitationSnippet = {
  knowledgeId: string;
  title: string;
  url: string;
  classification: GusRequiredControlType;
  excerpt: string | null;
  locator: string | null;
  reviewStatus: GusKnowledgeReviewStatus;
  qualityScore: number;
};

export type GusGraphCitationSnippet = {
  graphMemoryId: string;
  nodeId: string;
  title: string;
  excerpt: string;
  sourceTable: string;
  sourceId: string;
  riskLevel: string;
  confidenceScore: number;
};

export type GusAnswerStatement = {
  classification: GusRequiredControlType;
  text: string;
  knowledgeId: string;
};

export type GusQualitySignals = {
  averageQualityScore: number;
  lowestQualityScore: number;
  weakCitationCount: number;
  expiredCitationCount: number;
  selectedKnowledgeCount: number;
};

export type GusLearningAnswer = {
  answerId: string;
  text: string;
  confidence: "High" | "Medium" | "Low";
  citations: Array<{
    knowledgeId: string;
    title: string;
    url: string;
    sourceType: GusLearningSourceType;
      classification: GusRequiredControlType;
      reviewStatus: GusKnowledgeReviewStatus;
      qualityScore: number;
    }>;
  citationSnippets: GusCitationSnippet[];
  graphCitationSnippets?: GusGraphCitationSnippet[];
  statements: GusAnswerStatement[];
  qualitySignals: GusQualitySignals;
  unsupported: boolean;
  needsReview: boolean;
};

export type GusAnswerAuditRow = {
  id: string;
  answer_id: string;
  user_id: string | null;
  company_id: string | null;
  project_id: string | null;
  question: string;
  question_hash: string;
  retrieval_method: string;
  selected_knowledge_ids: string[];
  rejected_candidate_ids: string[];
  confidence: "High" | "Medium" | "Low";
  unsupported: boolean;
  needs_review: boolean;
  answer_text_hash: string;
  retrieval_trace: Record<string, unknown>;
  citation_snippets: GusCitationSnippet[];
  quality_signals: GusQualitySignals;
  created_at: string;
};

export type GusLearningReviewItemRow = {
  id: string;
  company_id: string | null;
  project_id: string | null;
  answer_audit_id: string | null;
  feedback_id: string | null;
  item_type: GusLearningReviewItemType;
  status: GusLearningReviewItemStatus;
  title: string;
  user_comment: string | null;
  recommended_admin_action: string;
  review_notes: string | null;
  created_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};
