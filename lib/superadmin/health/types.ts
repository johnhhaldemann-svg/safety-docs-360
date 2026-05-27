export const SUPERADMIN_HEALTH_PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export const HEALTH_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type HealthSeverity = (typeof HEALTH_SEVERITIES)[number];

export const HEALTH_EVENT_STATUSES = ["recorded", "pending_review", "resolved", "failed"] as const;
export type HealthEventStatus = (typeof HEALTH_EVENT_STATUSES)[number];

export const OWNER_VALIDATION_STATUSES = [
  "verified",
  "pending_verification",
  "conflicting_owner",
  "unauthorized_owner",
  "expired_authority",
  "requires_second_approval",
] as const;
export type HealthOwnerValidationStatus = (typeof OWNER_VALIDATION_STATUSES)[number];

export const OWNER_AUTHORITY_LEVELS = ["standard", "elevated", "critical", "second_approval"] as const;
export type HealthOwnerAuthorityLevel = (typeof OWNER_AUTHORITY_LEVELS)[number];

export const CHANGE_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type HealthChangeRiskLevel = (typeof CHANGE_RISK_LEVELS)[number];

export type HealthScoreCategoryStatus = "active" | "insufficient_data" | "pending";

export type HealthScoreCategory = {
  score: number | null;
  status: HealthScoreCategoryStatus;
  weight: number;
  explanation: string;
};

export type SuperadminHealthScore = {
  overallScore: number;
  categories: {
    systemHealth: HealthScoreCategory;
    aiEngine: HealthScoreCategory;
    predictionValue: HealthScoreCategory;
    dataQuality: HealthScoreCategory;
    cyberHealth: HealthScoreCategory;
    ownerValidation: HealthScoreCategory;
    helpTickets: HealthScoreCategory;
  };
  criticalAlerts: Array<Record<string, unknown>>;
  whatChanged: Array<Record<string, unknown>>;
  recommendedActions: string[];
};

export type HealthScopeFilters = {
  tenantId: string;
  companyId: string | null;
  jobsiteId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  severity: string | null;
  ownerId: string | null;
  status: string | null;
  limit: number;
};

export type HealthSupabaseResult<T = unknown> = {
  data: T | null;
  error: { message?: string | null } | null;
  count?: number | null;
};

export type HealthQueryBuilder<T = unknown> = PromiseLike<HealthSupabaseResult<T>> & {
  select(columns: string): HealthQueryBuilder<T>;
  eq(column: string, value: string | number | boolean): HealthQueryBuilder<T>;
  gte(column: string, value: string): HealthQueryBuilder<T>;
  lte(column: string, value: string): HealthQueryBuilder<T>;
  in(column: string, values: string[]): HealthQueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): HealthQueryBuilder<T>;
  limit(count: number): HealthQueryBuilder<T>;
  maybeSingle(): PromiseLike<HealthSupabaseResult<T>>;
  single(): PromiseLike<HealthSupabaseResult<T>>;
};

export type HealthTableBuilder<T = unknown> = {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): HealthQueryBuilder<T>;
  insert(row: Record<string, unknown> | Record<string, unknown>[]): HealthQueryBuilder<T>;
  upsert(row: Record<string, unknown>, options?: Record<string, unknown>): HealthQueryBuilder<T>;
  update(row: Record<string, unknown>): HealthQueryBuilder<T>;
};

export type HealthSupabaseClient = {
  from(table: string): HealthTableBuilder;
};
