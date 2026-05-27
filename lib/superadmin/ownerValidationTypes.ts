export const OWNER_VALIDATION_STATUSES = ["green", "yellow", "red", "gray"] as const;
export type OwnerValidationStatus = (typeof OWNER_VALIDATION_STATUSES)[number];

export const OWNER_VISUAL_REVIEW_STATUSES = [
  "not_started",
  "passed",
  "needs_review",
  "failed",
] as const;
export type OwnerVisualReviewStatus = (typeof OWNER_VISUAL_REVIEW_STATUSES)[number];

export const OWNER_MANUAL_REVIEW_STATUSES = [
  "not_started",
  "passed",
  "needs_review",
  "failed",
] as const;
export type OwnerManualReviewStatus = (typeof OWNER_MANUAL_REVIEW_STATUSES)[number];

export const OWNER_CUSTOMER_READY_STATUSES = [
  "Not tested",
  "Blocked",
  "Needs owner review",
  "Approved for demo",
  "Approved for customer use",
] as const;
export type OwnerCustomerReadyStatus = (typeof OWNER_CUSTOMER_READY_STATUSES)[number];

export type OwnerValidationModule = {
  module_key: string;
  display_name: string;
  status: OwnerValidationStatus;
  summary: string;
  last_tested_at: string | null;
  last_tested_by: string | null;
  related_page_url: string | null;
  customer_ready: boolean;
  created_at: string;
  updated_at: string;
};

export type OwnerValidationRun = {
  id: string;
  started_at: string;
  completed_at: string | null;
  started_by: string | null;
  overall_status: OwnerValidationStatus;
  overall_score: number;
  passed_count: number;
  warning_count: number;
  failed_count: number;
  summary: string;
  created_at: string;
};

export type OwnerValidationCheckResult = {
  id: string;
  run_id: string;
  module_key: string;
  check_name: string;
  status: OwnerValidationStatus;
  result: string;
  technical_details: Record<string, unknown> | null;
  recommended_owner_action: string | null;
  created_at: string;
};

export type OwnerManualReviewItem = {
  id: string;
  module_key: string;
  checklist_item: string;
  status: OwnerManualReviewStatus;
  required: boolean;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerCustomerReadyGate = {
  module_key: string;
  automated_validation_status: OwnerValidationStatus;
  owner_visual_review_status: OwnerVisualReviewStatus;
  customer_ready_status: OwnerCustomerReadyStatus;
  customer_ready: boolean;
  blocking_reason: string | null;
  super_admin_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  latest_owner_proof_report_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerValidationOverview = {
  modules: OwnerValidationModule[];
  recentRuns: OwnerValidationRun[];
  manualReviewItems: OwnerManualReviewItem[];
  customerReadyGates: OwnerCustomerReadyGate[];
};

export type OwnerValidationRunInput = {
  completedAt?: string | null;
  overallStatus?: OwnerValidationStatus;
  overallScore?: number;
  summary?: string;
  checks?: Array<{
    moduleKey: string;
    checkName: string;
    status: OwnerValidationStatus;
    result: string;
    technicalDetails?: Record<string, unknown> | null;
    recommendedOwnerAction?: string | null;
  }>;
};
