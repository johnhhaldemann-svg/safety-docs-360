export const OWNER_CHANGE_RISK_LEVELS = ["Low", "Medium", "High"] as const;
export type OwnerChangeRiskLevel = (typeof OWNER_CHANGE_RISK_LEVELS)[number];

export const OWNER_CUSTOMER_READY_STATUSES = [
  "Not tested",
  "Blocked",
  "Needs owner review",
  "Approved for demo",
  "Approved for customer use",
] as const;
export type OwnerCustomerReadyStatus = (typeof OWNER_CUSTOMER_READY_STATUSES)[number];

export const OWNER_SAFE_TO_SHOW_STATUSES = ["Yes", "No", "Needs Review"] as const;
export type OwnerSafeToShowStatus = (typeof OWNER_SAFE_TO_SHOW_STATUSES)[number];

export type OwnerChangeLogEntry = {
  id: string;
  change_key: string;
  changed_at: string;
  module_key: string | null;
  module_name: string;
  plain_english_description: string;
  files_changed: string[];
  pages_affected: string[];
  risk_level: OwnerChangeRiskLevel;
  owner_review_required: boolean;
  validation_checklist_url: string | null;
  related_page_url: string | null;
  customer_ready_status: OwnerCustomerReadyStatus;
  why_changed: string;
  what_could_break: string;
  owner_manual_review: string;
  safe_to_show_customer: OwnerSafeToShowStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerChangeLogInput = {
  changeKey?: string;
  changedAt?: string;
  moduleKey?: string | null;
  moduleName?: string;
  plainEnglishDescription?: string;
  filesChanged?: string[];
  pagesAffected?: string[];
  riskLevel?: OwnerChangeRiskLevel;
  ownerReviewRequired?: boolean;
  validationChecklistUrl?: string | null;
  relatedPageUrl?: string | null;
  customerReadyStatus?: OwnerCustomerReadyStatus;
  whyChanged?: string;
  whatCouldBreak?: string;
  ownerManualReview?: string;
  safeToShowCustomer?: OwnerSafeToShowStatus;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message?: string | null } | null;
};

type OwnerChangeLogExecutableQuery<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (columns?: string) => OwnerChangeLogExecutableQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => OwnerChangeLogExecutableQuery<T>;
  limit: (count: number) => OwnerChangeLogExecutableQuery<T>;
  single: () => OwnerChangeLogExecutableQuery<T>;
};

type OwnerChangeLogTableQuery = {
  select: (columns?: string) => OwnerChangeLogExecutableQuery;
  insert: (values: unknown) => OwnerChangeLogExecutableQuery;
  upsert: (values: unknown, options?: unknown) => OwnerChangeLogExecutableQuery;
};

export type OwnerChangeLogSupabaseClient = {
  from: (table: string) => OwnerChangeLogTableQuery;
};

export const DEFAULT_OWNER_CHANGE_LOG_ENTRIES: OwnerChangeLogInput[] = [
  {
    changeKey: "owner-validation-console-foundation",
    moduleKey: "owner_validation",
    moduleName: "Owner Validation Console",
    plainEnglishDescription:
      "Created the first owner-only validation system: database foundation, Safety360 Test Company, dashboard, platform checks, manual checklists, and role preview.",
    filesChanged: [
      "supabase/migrations/20260526230333_owner_validation_console.sql",
      "supabase/migrations/20260526235818_owner_validation_sandbox_records.sql",
      "supabase/migrations/20260527003933_owner_manual_review_statuses.sql",
      "app/(app)/superadmin/owner-validation/page.tsx",
      "app/api/superadmin/owner-validation",
      "lib/superadmin/ownerValidation.ts",
      "lib/superadmin/ownerValidationSandbox.ts",
      "lib/superadmin/ownerValidationPlatformCheck.ts",
      "lib/superadmin/ownerValidationPreview.ts",
    ],
    pagesAffected: ["/superadmin/owner-validation", "/superadmin"],
    riskLevel: "Medium",
    ownerReviewRequired: true,
    validationChecklistUrl: "/superadmin/owner-validation#owner-review",
    relatedPageUrl: "/superadmin/owner-validation",
    customerReadyStatus: "Needs owner review",
    whyChanged:
      "The owner needs a plain-English way to see what works, what is broken, and what needs manual review before customer demos.",
    whatCouldBreak:
      "If database migrations are not applied or Super Admin access is misconfigured, the owner validation pages may not load.",
    ownerManualReview:
      "Open the Owner Validation Console, run the platform check, review role previews, and complete the manual checklist items using sandbox data.",
    safeToShowCustomer: "Needs Review",
  },
];

function assertNoSupabaseError<T>(result: SupabaseResult<T>, action: string): T {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message ?? "Supabase request failed."}`);
  }

  return result.data as T;
}

function isRiskLevel(value: unknown): value is OwnerChangeRiskLevel {
  return typeof value === "string" && OWNER_CHANGE_RISK_LEVELS.includes(value as OwnerChangeRiskLevel);
}

function isCustomerReadyStatus(value: unknown): value is OwnerCustomerReadyStatus {
  return (
    typeof value === "string" &&
    OWNER_CUSTOMER_READY_STATUSES.includes(value as OwnerCustomerReadyStatus)
  );
}

function isSafeToShowStatus(value: unknown): value is OwnerSafeToShowStatus {
  return typeof value === "string" && OWNER_SAFE_TO_SHOW_STATUSES.includes(value as OwnerSafeToShowStatus);
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function requiredText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeChangeLogInput(input: OwnerChangeLogInput, createdBy: string | null) {
  const moduleName = requiredText(input.moduleName, "Platform change");
  const description = requiredText(
    input.plainEnglishDescription,
    "A platform change was recorded and needs owner review."
  );
  const changeKey =
    requiredText(input.changeKey, "")
      || `${moduleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;

  return {
    change_key: changeKey,
    changed_at: input.changedAt ?? new Date().toISOString(),
    module_key: optionalText(input.moduleKey),
    module_name: moduleName,
    plain_english_description: description,
    files_changed: stringList(input.filesChanged),
    pages_affected: stringList(input.pagesAffected),
    risk_level: isRiskLevel(input.riskLevel) ? input.riskLevel : "Medium",
    owner_review_required: input.ownerReviewRequired ?? true,
    validation_checklist_url: optionalText(input.validationChecklistUrl),
    related_page_url: optionalText(input.relatedPageUrl),
    customer_ready_status: isCustomerReadyStatus(input.customerReadyStatus)
      ? input.customerReadyStatus
      : "Needs owner review",
    why_changed: requiredText(input.whyChanged, "This change needs to be visible to the owner."),
    what_could_break: requiredText(input.whatCouldBreak, "No specific breakage risk was recorded."),
    owner_manual_review: requiredText(
      input.ownerManualReview,
      "Open the related page and confirm the change works with sandbox data."
    ),
    safe_to_show_customer: isSafeToShowStatus(input.safeToShowCustomer)
      ? input.safeToShowCustomer
      : "Needs Review",
    created_by: createdBy,
  };
}

export async function ensureDefaultOwnerChangeLogEntries(
  client: OwnerChangeLogSupabaseClient,
  createdBy: string | null = null
) {
  const result = await client.from("owner_change_log_entries").upsert(
    DEFAULT_OWNER_CHANGE_LOG_ENTRIES.map((entry) => normalizeChangeLogInput(entry, createdBy)),
    { onConflict: "change_key", ignoreDuplicates: true }
  );

  assertNoSupabaseError(result, "Unable to seed owner change log entries");
}

export async function loadOwnerChangeLogEntries(client: OwnerChangeLogSupabaseClient) {
  await ensureDefaultOwnerChangeLogEntries(client);

  const result = await client
    .from("owner_change_log_entries")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(50);

  return assertNoSupabaseError(
    result,
    "Unable to load owner change log entries"
  ) as OwnerChangeLogEntry[];
}

export function validateOwnerChangeLogInput(value: unknown): OwnerChangeLogInput {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    changeKey: optionalText(body.changeKey) ?? undefined,
    changedAt: optionalText(body.changedAt) ?? undefined,
    moduleKey: optionalText(body.moduleKey),
    moduleName: optionalText(body.moduleName) ?? undefined,
    plainEnglishDescription: optionalText(body.plainEnglishDescription) ?? undefined,
    filesChanged: stringList(body.filesChanged),
    pagesAffected: stringList(body.pagesAffected),
    riskLevel: isRiskLevel(body.riskLevel) ? body.riskLevel : undefined,
    ownerReviewRequired:
      typeof body.ownerReviewRequired === "boolean" ? body.ownerReviewRequired : undefined,
    validationChecklistUrl: optionalText(body.validationChecklistUrl),
    relatedPageUrl: optionalText(body.relatedPageUrl),
    customerReadyStatus: isCustomerReadyStatus(body.customerReadyStatus)
      ? body.customerReadyStatus
      : undefined,
    whyChanged: optionalText(body.whyChanged) ?? undefined,
    whatCouldBreak: optionalText(body.whatCouldBreak) ?? undefined,
    ownerManualReview: optionalText(body.ownerManualReview) ?? undefined,
    safeToShowCustomer: isSafeToShowStatus(body.safeToShowCustomer)
      ? body.safeToShowCustomer
      : undefined,
  };
}

export async function recordOwnerChangeLogEntry(params: {
  client: OwnerChangeLogSupabaseClient;
  createdBy: string | null;
  input: OwnerChangeLogInput;
}) {
  const result = await params.client
    .from("owner_change_log_entries")
    .insert(normalizeChangeLogInput(params.input, params.createdBy))
    .select("*")
    .single();

  return assertNoSupabaseError(
    result,
    "Unable to record owner change log entry"
  ) as OwnerChangeLogEntry;
}
