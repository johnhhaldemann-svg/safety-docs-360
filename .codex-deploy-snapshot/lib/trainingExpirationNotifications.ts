import type { SupabaseClient } from "@supabase/supabase-js";
import { createCompanyNotification } from "@/lib/companyNotifications";
import {
  daysUntilExpiryCalendar,
  parseCertificationExpirations,
} from "@/lib/certificationExpirations";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  sendTrainingExpirationEmail,
  type TrainingExpirationEmailItem,
} from "@/lib/trainingExpirationEmail";

export type TrainingExpirationStage = "30d" | "14d" | "7d" | "expired";

export type TrainingExpirationItem = {
  companyId: string;
  companyName: string;
  subjectType: "app_user" | "tracked_employee" | "contractor_employee";
  subjectId: string;
  subjectUserId: string | null;
  workerName: string;
  workerEmail: string | null;
  trainingTitle: string;
  expiresOn: string;
  daysUntilExpiry: number;
  stage: TrainingExpirationStage;
  sourceTable: string;
  sourceId: string;
  jobsiteName: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
};

type MembershipRow = {
  user_id: string;
  company_id?: string | null;
  role?: string | null;
  status?: string | null;
};

type UserProfileRow = {
  user_id: string;
  certifications?: string[] | null;
  certification_expirations?: Record<string, string> | null;
};

type TrackedEmployeeRow = {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  status: string | null;
  certification_expirations?: Record<string, string> | null;
};

type TrackedTrainingRecordRow = {
  id: string;
  company_id: string;
  employee_id: string;
  title: string;
  expires_on: string | null;
};

type ContractorAssignmentRow = {
  id: string;
  company_id: string;
  jobsite_id: string;
  contractor_employee_id: string;
  status: string | null;
};

type ContractorEmployeeRow = {
  id: string;
  full_name: string;
  email: string | null;
};

type ContractorTrainingRecordRow = {
  id: string;
  contractor_employee_id: string;
  title: string;
  expires_on: string | null;
};

type JobsiteRow = {
  id: string;
  name: string;
};

type SafetyManagerRecipient = {
  userId: string;
  email: string;
  name: string;
};

type DeliveryReservation = {
  id: string;
  item: TrainingExpirationItem;
  context: "worker" | "safety_manager";
  recipientUserId: string | null;
};

type RecipientGroup = {
  email: string;
  userId: string | null;
  companyId: string;
  companyName: string;
  workerItems: TrainingExpirationItem[];
  managerItems: Array<{ item: TrainingExpirationItem; managerUserId: string }>;
};

const MAX_DELIVERY_ATTEMPTS = 3;
const DEFAULT_MAX_ITEMS = 500;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  const email = clean(value).toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function userDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "";
  return name || user.email?.trim() || "Workspace user";
}

function isDuplicateError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();
  return error?.code === "23505" || message.includes("duplicate");
}

function isMissingRelationError(error: { message?: string | null } | string | null | undefined) {
  const message = typeof error === "string" ? error : error?.message;
  const lower = (message ?? "").toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find");
}

function uniq(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function itemIdentity(item: Pick<TrainingExpirationItem, "companyId" | "subjectType" | "subjectId" | "trainingTitle" | "expiresOn">) {
  return [
    item.companyId,
    item.subjectType,
    item.subjectId,
    item.trainingTitle.trim().toLowerCase(),
    item.expiresOn,
  ].join(":");
}

export function classifyTrainingExpirationStage(
  expiresOn: string | null | undefined,
  asOf = new Date()
): { stage: TrainingExpirationStage; daysUntilExpiry: number } | null {
  const days = daysUntilExpiryCalendar(expiresOn, asOf);
  if (days === null) return null;
  if (days < 0) return { stage: "expired", daysUntilExpiry: days };
  if (days <= 7) return { stage: "7d", daysUntilExpiry: days };
  if (days <= 14) return { stage: "14d", daysUntilExpiry: days };
  if (days <= 30) return { stage: "30d", daysUntilExpiry: days };
  return null;
}

export function createTrainingExpirationDedupeKey(params: {
  companyId: string;
  recipientContext: "worker" | "safety_manager";
  recipientKey: string;
  subjectType: string;
  subjectId: string;
  sourceTable: string;
  sourceId: string;
  stage: TrainingExpirationStage;
  expiresOn: string;
  trainingTitle: string;
}) {
  return [
    params.companyId,
    params.recipientContext,
    params.recipientKey,
    params.subjectType,
    params.subjectId,
    params.sourceTable,
    params.sourceId,
    params.stage,
    params.expiresOn,
    params.trainingTitle.trim().toLowerCase().replace(/\s+/g, "-"),
  ].join(":");
}

function makeItem(params: Omit<TrainingExpirationItem, "daysUntilExpiry" | "stage"> & { asOf: Date }) {
  const classified = classifyTrainingExpirationStage(params.expiresOn, params.asOf);
  if (!classified) return null;
  const title = params.trainingTitle.trim();
  if (!title) return null;
  return {
    companyId: params.companyId,
    companyName: params.companyName,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    subjectUserId: params.subjectUserId,
    workerName: params.workerName.trim() || "Worker",
    workerEmail: normalizeEmail(params.workerEmail),
    trainingTitle: title,
    expiresOn: params.expiresOn,
    daysUntilExpiry: classified.daysUntilExpiry,
    stage: classified.stage,
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
    jobsiteName: params.jobsiteName,
  } satisfies TrainingExpirationItem;
}

async function getAuthUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ email: string | null; name: string }> {
  const result = await supabase.auth.admin.getUserById(userId);
  if (result.error) return { email: null, name: "Workspace user" };
  const user = result.data.user;
  return {
    email: normalizeEmail(user?.email),
    name: userDisplayName({
      email: user?.email,
      user_metadata: user?.user_metadata as Record<string, unknown> | null,
    }),
  };
}

async function loadAppUserItems(params: {
  supabase: SupabaseClient;
  company: CompanyRow;
  memberships: MembershipRow[];
  asOf: Date;
}) {
  const userIds = uniq(params.memberships.map((row) => row.user_id));
  if (userIds.length === 0) return { items: [] as TrainingExpirationItem[], warnings: [] as string[] };

  const profileResult = await params.supabase
    .from("user_profiles")
    .select("user_id, certifications, certification_expirations")
    .in("user_id", userIds);

  if (profileResult.error) {
    return { items: [] as TrainingExpirationItem[], warnings: [profileResult.error.message] };
  }

  const authByUser = new Map<string, { email: string | null; name: string }>();
  await Promise.all(
    userIds.map(async (userId) => {
      authByUser.set(userId, await getAuthUser(params.supabase, userId));
    })
  );

  const items: TrainingExpirationItem[] = [];
  for (const profile of (profileResult.data ?? []) as UserProfileRow[]) {
    const auth = authByUser.get(profile.user_id) ?? { email: null, name: "Workspace user" };
    const expirations = parseCertificationExpirations(profile.certification_expirations ?? {});
    for (const [title, expiresOn] of Object.entries(expirations)) {
      const item = makeItem({
        companyId: params.company.id,
        companyName: params.company.name,
        subjectType: "app_user",
        subjectId: profile.user_id,
        subjectUserId: profile.user_id,
        workerName: auth.name,
        workerEmail: auth.email,
        trainingTitle: title,
        expiresOn,
        sourceTable: "user_profiles",
        sourceId: profile.user_id,
        jobsiteName: null,
        asOf: params.asOf,
      });
      if (item) items.push(item);
    }
  }

  return { items, warnings: [] as string[] };
}

async function loadTrackedEmployeeItems(params: {
  supabase: SupabaseClient;
  company: CompanyRow;
  asOf: Date;
}) {
  const employeeResult = await params.supabase
    .from("company_employee_profiles")
    .select("id, company_id, full_name, email, status, certification_expirations")
    .eq("company_id", params.company.id)
    .neq("status", "archived");

  if (employeeResult.error) {
    if (isMissingRelationError(employeeResult.error)) {
      return { items: [] as TrainingExpirationItem[], warnings: [employeeResult.error.message] };
    }
    return { items: [] as TrainingExpirationItem[], warnings: [employeeResult.error.message] };
  }

  const employees = (employeeResult.data ?? []) as TrackedEmployeeRow[];
  const employeeIds = employees.map((row) => row.id);
  const recordsResult = employeeIds.length
    ? await params.supabase
        .from("company_employee_training_records")
        .select("id, company_id, employee_id, title, expires_on")
        .eq("company_id", params.company.id)
        .in("employee_id", employeeIds)
    : { data: [], error: null };

  if (recordsResult.error) {
    return { items: [] as TrainingExpirationItem[], warnings: [recordsResult.error.message] };
  }

  const employeeById = new Map(employees.map((row) => [row.id, row]));
  const emittedProfileKeys = new Set<string>();
  const items: TrainingExpirationItem[] = [];

  for (const record of (recordsResult.data ?? []) as TrackedTrainingRecordRow[]) {
    if (!record.expires_on) continue;
    const employee = employeeById.get(record.employee_id);
    if (!employee) continue;
    const item = makeItem({
      companyId: params.company.id,
      companyName: params.company.name,
      subjectType: "tracked_employee",
      subjectId: employee.id,
      subjectUserId: null,
      workerName: employee.full_name,
      workerEmail: employee.email,
      trainingTitle: record.title,
      expiresOn: record.expires_on,
      sourceTable: "company_employee_training_records",
      sourceId: record.id,
      jobsiteName: null,
      asOf: params.asOf,
    });
    if (item) {
      emittedProfileKeys.add(itemIdentity(item));
      items.push(item);
    }
  }

  for (const employee of employees) {
    const expirations = parseCertificationExpirations(employee.certification_expirations ?? {});
    for (const [title, expiresOn] of Object.entries(expirations)) {
      const item = makeItem({
        companyId: params.company.id,
        companyName: params.company.name,
        subjectType: "tracked_employee",
        subjectId: employee.id,
        subjectUserId: null,
        workerName: employee.full_name,
        workerEmail: employee.email,
        trainingTitle: title,
        expiresOn,
        sourceTable: "company_employee_profiles",
        sourceId: employee.id,
        jobsiteName: null,
        asOf: params.asOf,
      });
      if (item && !emittedProfileKeys.has(itemIdentity(item))) {
        items.push(item);
      }
    }
  }

  return { items, warnings: [] as string[] };
}

async function loadContractorItems(params: {
  supabase: SupabaseClient;
  company: CompanyRow;
  asOf: Date;
}) {
  const assignmentsResult = await params.supabase
    .from("contractor_employee_jobsite_assignments")
    .select("id, company_id, jobsite_id, contractor_employee_id, status")
    .eq("company_id", params.company.id)
    .eq("status", "active");

  if (assignmentsResult.error) {
    if (isMissingRelationError(assignmentsResult.error)) {
      return { items: [] as TrainingExpirationItem[], warnings: [assignmentsResult.error.message] };
    }
    return { items: [] as TrainingExpirationItem[], warnings: [assignmentsResult.error.message] };
  }

  const assignments = (assignmentsResult.data ?? []) as ContractorAssignmentRow[];
  const employeeIds = uniq(assignments.map((row) => row.contractor_employee_id));
  const jobsiteIds = uniq(assignments.map((row) => row.jobsite_id));
  if (employeeIds.length === 0) return { items: [] as TrainingExpirationItem[], warnings: [] as string[] };

  const [employeesResult, recordsResult, jobsitesResult] = await Promise.all([
    params.supabase
      .from("contractor_employee_profiles")
      .select("id, full_name, email")
      .in("id", employeeIds),
    params.supabase
      .from("contractor_employee_training_records")
      .select("id, contractor_employee_id, title, expires_on")
      .in("contractor_employee_id", employeeIds),
    jobsiteIds.length
      ? params.supabase.from("company_jobsites").select("id, name").eq("company_id", params.company.id).in("id", jobsiteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = employeesResult.error?.message || recordsResult.error?.message || jobsitesResult.error?.message;
  if (firstError) return { items: [] as TrainingExpirationItem[], warnings: [firstError] };

  const employeeById = new Map(((employeesResult.data ?? []) as ContractorEmployeeRow[]).map((row) => [row.id, row]));
  const recordsByEmployee = new Map<string, ContractorTrainingRecordRow[]>();
  for (const record of (recordsResult.data ?? []) as ContractorTrainingRecordRow[]) {
    const list = recordsByEmployee.get(record.contractor_employee_id) ?? [];
    list.push(record);
    recordsByEmployee.set(record.contractor_employee_id, list);
  }
  const jobsiteById = new Map(((jobsitesResult.data ?? []) as JobsiteRow[]).map((row) => [row.id, row]));

  const items: TrainingExpirationItem[] = [];
  const seen = new Set<string>();
  for (const assignment of assignments) {
    const employee = employeeById.get(assignment.contractor_employee_id);
    if (!employee) continue;
    for (const record of recordsByEmployee.get(assignment.contractor_employee_id) ?? []) {
      if (!record.expires_on) continue;
      const item = makeItem({
        companyId: params.company.id,
        companyName: params.company.name,
        subjectType: "contractor_employee",
        subjectId: employee.id,
        subjectUserId: null,
        workerName: employee.full_name,
        workerEmail: employee.email,
        trainingTitle: record.title,
        expiresOn: record.expires_on,
        sourceTable: "contractor_employee_training_records",
        sourceId: record.id,
        jobsiteName: jobsiteById.get(assignment.jobsite_id)?.name ?? null,
        asOf: params.asOf,
      });
      const key = item ? `${itemIdentity(item)}:${assignment.jobsite_id}` : "";
      if (item && !seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
  }

  return { items, warnings: [] as string[] };
}

export async function loadTrainingExpirationItems(params: {
  supabase: SupabaseClient;
  company: CompanyRow;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const membershipsResult = await params.supabase
    .from("company_memberships")
    .select("user_id, company_id, role, status")
    .eq("company_id", params.company.id)
    .eq("status", "active");

  if (membershipsResult.error) {
    return { items: [] as TrainingExpirationItem[], warnings: [membershipsResult.error.message] };
  }

  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const [appUsers, tracked, contractors] = await Promise.all([
    loadAppUserItems({ supabase: params.supabase, company: params.company, memberships, asOf }),
    loadTrackedEmployeeItems({ supabase: params.supabase, company: params.company, asOf }),
    loadContractorItems({ supabase: params.supabase, company: params.company, asOf }),
  ]);

  return {
    items: [...appUsers.items, ...tracked.items, ...contractors.items].sort(
      (left, right) =>
        left.daysUntilExpiry - right.daysUntilExpiry ||
        left.workerName.localeCompare(right.workerName) ||
        left.trainingTitle.localeCompare(right.trainingTitle)
    ),
    warnings: [...appUsers.warnings, ...tracked.warnings, ...contractors.warnings],
  };
}

async function loadSafetyManagers(params: {
  supabase: SupabaseClient;
  companyId: string;
}) {
  const result = await params.supabase
    .from("company_memberships")
    .select("user_id, role, status")
    .eq("company_id", params.companyId)
    .eq("status", "active")
    .eq("role", "safety_manager");

  if (result.error) return { recipients: [] as SafetyManagerRecipient[], error: result.error.message };

  const recipients: SafetyManagerRecipient[] = [];
  for (const row of (result.data ?? []) as MembershipRow[]) {
    const user = await getAuthUser(params.supabase, row.user_id);
    if (!user.email) continue;
    recipients.push({ userId: row.user_id, email: user.email, name: user.name });
  }

  return { recipients, error: null };
}

function asEmailItem(item: TrainingExpirationItem): TrainingExpirationEmailItem {
  return {
    workerName: item.workerName,
    workerEmail: item.workerEmail,
    trainingTitle: item.trainingTitle,
    expiresOn: item.expiresOn,
    daysUntilExpiry: item.daysUntilExpiry,
    stage: item.stage,
    jobsiteName: item.jobsiteName,
    subjectType: item.subjectType,
  };
}

function createGroup(params: {
  groups: Map<string, RecipientGroup>;
  email: string;
  companyId: string;
  companyName: string;
  userId?: string | null;
}) {
  const key = params.email.toLowerCase();
  const existing = params.groups.get(key);
  if (existing) {
    if (!existing.userId && params.userId) existing.userId = params.userId;
    return existing;
  }
  const group: RecipientGroup = {
    email: params.email,
    userId: params.userId ?? null,
    companyId: params.companyId,
    companyName: params.companyName,
    workerItems: [],
    managerItems: [],
  };
  params.groups.set(key, group);
  return group;
}

async function insertSkippedDelivery(params: {
  supabase: SupabaseClient;
  item: TrainingExpirationItem;
  reason: string;
}) {
  const dedupeKey = createTrainingExpirationDedupeKey({
    companyId: params.item.companyId,
    recipientContext: "worker",
    recipientKey: `missing-email:${params.item.subjectType}:${params.item.subjectId}`,
    subjectType: params.item.subjectType,
    subjectId: params.item.subjectId,
    sourceTable: params.item.sourceTable,
    sourceId: params.item.sourceId,
    stage: params.item.stage,
    expiresOn: params.item.expiresOn,
    trainingTitle: params.item.trainingTitle,
  });

  const result = await params.supabase.from("training_expiration_notification_deliveries").insert({
    company_id: params.item.companyId,
    recipient_context: "worker",
    recipient_user_id: null,
    recipient_email: null,
    subject_type: params.item.subjectType,
    subject_id: params.item.subjectId,
    subject_user_id: params.item.subjectUserId,
    training_title: params.item.trainingTitle,
    expires_on: params.item.expiresOn,
    reminder_stage: params.item.stage,
    source_table: params.item.sourceTable,
    source_id: params.item.sourceId,
    channel: "email",
    status: "skipped",
    attempt_count: 1,
    error_message: params.reason,
    dedupe_key: dedupeKey,
  });

  return { inserted: !result.error, duplicate: isDuplicateError(result.error), error: result.error?.message ?? null };
}

async function reserveDelivery(params: {
  supabase: SupabaseClient;
  item: TrainingExpirationItem;
  context: "worker" | "safety_manager";
  recipientEmail: string;
  recipientUserId: string | null;
}) {
  const dedupeKey = createTrainingExpirationDedupeKey({
    companyId: params.item.companyId,
    recipientContext: params.context,
    recipientKey: params.recipientUserId ?? params.recipientEmail.toLowerCase(),
    subjectType: params.item.subjectType,
    subjectId: params.item.subjectId,
    sourceTable: params.item.sourceTable,
    sourceId: params.item.sourceId,
    stage: params.item.stage,
    expiresOn: params.item.expiresOn,
    trainingTitle: params.item.trainingTitle,
  });

  const inserted = await params.supabase
    .from("training_expiration_notification_deliveries")
    .insert({
      company_id: params.item.companyId,
      recipient_context: params.context,
      recipient_user_id: params.recipientUserId,
      recipient_email: params.recipientEmail,
      subject_type: params.item.subjectType,
      subject_id: params.item.subjectId,
      subject_user_id: params.item.subjectUserId,
      training_title: params.item.trainingTitle,
      expires_on: params.item.expiresOn,
      reminder_stage: params.item.stage,
      source_table: params.item.sourceTable,
      source_id: params.item.sourceId,
      channel: "email",
      status: "pending",
      attempt_count: 1,
      dedupe_key: dedupeKey,
    })
    .select("id")
    .single();

  if (!inserted.error) {
    const id = (inserted.data as { id?: string } | null)?.id;
    return id
      ? { reserved: true, duplicate: false, id, error: null }
      : { reserved: false, duplicate: false, id: null, error: "Delivery insert did not return an id." };
  }

  if (!isDuplicateError(inserted.error)) {
    return { reserved: false, duplicate: false, id: null, error: inserted.error.message };
  }

  const existing = await params.supabase
    .from("training_expiration_notification_deliveries")
    .select("id, status, attempt_count")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  const row = existing.data as { id?: string; status?: string; attempt_count?: number } | null;
  if (!row?.id || row.status !== "failed" || (row.attempt_count ?? 0) >= MAX_DELIVERY_ATTEMPTS) {
    return { reserved: false, duplicate: true, id: row?.id ?? null, error: null };
  }

  const retry = await params.supabase
    .from("training_expiration_notification_deliveries")
    .update({
      status: "pending",
      attempt_count: (row.attempt_count ?? 1) + 1,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("id")
    .single();

  if (retry.error) return { reserved: false, duplicate: false, id: null, error: retry.error.message };
  return { reserved: true, duplicate: false, id: row.id, error: null };
}

async function updateDeliveries(params: {
  supabase: SupabaseClient;
  deliveryIds: string[];
  status: "sent" | "failed";
  providerMessageId?: string | null;
  errorMessage?: string | null;
}) {
  if (params.deliveryIds.length === 0) return;
  await params.supabase
    .from("training_expiration_notification_deliveries")
    .update({
      status: params.status,
      sent_at: params.status === "sent" ? new Date().toISOString() : null,
      provider_message_id: params.providerMessageId ?? null,
      error_message: params.errorMessage ?? null,
    })
    .in("id", params.deliveryIds);
}

function readMaxItems(value: string | undefined, fallback = DEFAULT_MAX_ITEMS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 5000);
}

export async function runTrainingExpirationNotificationCron(input?: {
  supabase?: SupabaseClient | null;
  asOf?: Date;
  maxItems?: number;
  fetcher?: typeof fetch;
}) {
  const supabase = input?.supabase ?? createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false as const, error: "Missing Supabase service role key for training expiration notifications." };
  }

  const asOf = input?.asOf ?? new Date();
  const maxItems = input?.maxItems ?? readMaxItems(process.env.TRAINING_EXPIRATION_CRON_MAX_ITEMS);
  const companiesResult = await supabase
    .from("companies")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (companiesResult.error) {
    return { ok: false as const, error: companiesResult.error.message || "Failed to load companies." };
  }

  const summary = {
    companiesSeen: 0,
    itemsSeen: 0,
    workerEmailsSent: 0,
    managerEmailsSent: 0,
    skippedMissingEmail: 0,
    duplicateDeliveries: 0,
    failedEmails: 0,
    deliveryErrors: 0,
    warnings: [] as string[],
  };
  let remaining = maxItems;

  for (const company of (companiesResult.data ?? []) as CompanyRow[]) {
    if (remaining <= 0) break;
    summary.companiesSeen += 1;
    const loaded = await loadTrainingExpirationItems({ supabase, company, asOf });
    summary.warnings.push(...loaded.warnings.map((warning) => `${company.name}: ${warning}`));
    const items = loaded.items.slice(0, remaining);
    remaining -= items.length;
    summary.itemsSeen += items.length;
    if (items.length === 0) continue;

    const managers = await loadSafetyManagers({ supabase, companyId: company.id });
    if (managers.error) summary.warnings.push(`${company.name}: ${managers.error}`);

    const groups = new Map<string, RecipientGroup>();
    for (const item of items) {
      if (item.workerEmail) {
        createGroup({
          groups,
          email: item.workerEmail,
          companyId: company.id,
          companyName: company.name,
          userId: item.subjectUserId,
        }).workerItems.push(item);
      } else {
        summary.skippedMissingEmail += 1;
        const skipped = await insertSkippedDelivery({
          supabase,
          item,
          reason: "No email address is available for this worker.",
        });
        if (skipped.duplicate) summary.duplicateDeliveries += 1;
        if (skipped.error && !skipped.duplicate) {
          summary.deliveryErrors += 1;
          summary.warnings.push(`${item.workerName}: ${skipped.error}`);
        }
      }

      for (const manager of managers.recipients) {
        createGroup({
          groups,
          email: manager.email,
          companyId: company.id,
          companyName: company.name,
          userId: manager.userId,
        }).managerItems.push({ item, managerUserId: manager.userId });
      }
    }

    for (const group of groups.values()) {
      const reservations: DeliveryReservation[] = [];
      const workerItems: TrainingExpirationItem[] = [];
      const managerItems: TrainingExpirationItem[] = [];

      for (const item of group.workerItems) {
        const reserved = await reserveDelivery({
          supabase,
          item,
          context: "worker",
          recipientEmail: group.email,
          recipientUserId: item.subjectUserId,
        });
        if (reserved.reserved && reserved.id) {
          workerItems.push(item);
          reservations.push({ id: reserved.id, item, context: "worker", recipientUserId: item.subjectUserId });
        } else if (reserved.duplicate) {
          summary.duplicateDeliveries += 1;
        } else if (reserved.error) {
          summary.deliveryErrors += 1;
          summary.warnings.push(`${item.workerName}: ${reserved.error}`);
        }
      }

      for (const entry of group.managerItems) {
        const reserved = await reserveDelivery({
          supabase,
          item: entry.item,
          context: "safety_manager",
          recipientEmail: group.email,
          recipientUserId: entry.managerUserId,
        });
        if (reserved.reserved && reserved.id) {
          managerItems.push(entry.item);
          reservations.push({ id: reserved.id, item: entry.item, context: "safety_manager", recipientUserId: entry.managerUserId });
        } else if (reserved.duplicate) {
          summary.duplicateDeliveries += 1;
        } else if (reserved.error) {
          summary.deliveryErrors += 1;
          summary.warnings.push(`${entry.item.workerName}: ${reserved.error}`);
        }
      }

      if (reservations.length === 0) continue;

      const emailResult = await sendTrainingExpirationEmail({
        toEmail: group.email,
        companyName: group.companyName,
        workerItems: workerItems.map(asEmailItem),
        managerItems: managerItems.map(asEmailItem),
        fetcher: input?.fetcher,
      });
      const deliveryIds = reservations.map((reservation) => reservation.id);
      if (emailResult.status === "sent") {
        await updateDeliveries({
          supabase,
          deliveryIds,
          status: "sent",
          providerMessageId: emailResult.providerMessageId ?? null,
        });
        if (workerItems.length > 0) summary.workerEmailsSent += 1;
        if (managerItems.length > 0) summary.managerEmailsSent += 1;
      } else {
        await updateDeliveries({
          supabase,
          deliveryIds,
          status: "failed",
          errorMessage: emailResult.warning ?? "Training expiration email was not sent.",
        });
        summary.failedEmails += 1;
        if (emailResult.warning) summary.warnings.push(`${group.email}: ${emailResult.warning}`);
      }

      const managerUserIds = uniq(
        reservations
          .filter((reservation) => reservation.context === "safety_manager" && reservation.recipientUserId)
          .map((reservation) => reservation.recipientUserId ?? "")
      );
      await Promise.all(
        managerUserIds.map((recipientUserId) =>
          createCompanyNotification({
            supabase,
            companyId: group.companyId,
            recipientUserId,
            eventType: "training_expiring",
            title: "Training renewals need attention",
            body: `${managerItems.length} training expiration item${managerItems.length === 1 ? "" : "s"} need safety manager review.`,
            priority: managerItems.some((item) => item.stage === "expired" || item.stage === "7d") ? "high" : "normal",
            href: "/training-matrix",
            sourceTable: null,
            sourceId: null,
            metadata: {
              itemCount: managerItems.length,
              reminderStages: uniq(managerItems.map((item) => item.stage)),
            },
          })
        )
      );
    }
  }

  return { ok: true as const, ...summary };
}
