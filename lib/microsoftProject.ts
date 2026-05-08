import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const MICROSOFT_PROJECT_PROVIDER = "microsoft_project";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Tasks.Read", "Group.Read.All"];
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

type SupabaseLike = {
  from: (table: string) => unknown;
  auth?: {
    admin?: {
      listUsers?: (params?: { page?: number; perPage?: number }) => Promise<{
        data?: { users?: Array<{ id: string; email?: string | null }> };
        error?: { message?: string | null } | null;
      }>;
    };
  };
};

type SupabaseResult = {
  data?: unknown;
  error?: { message?: string | null } | null;
  count?: number | null;
};

type SupabaseQuery = PromiseLike<SupabaseResult> & {
  select: (...args: unknown[]) => SupabaseQuery;
  eq: (...args: unknown[]) => SupabaseQuery;
  order: (...args: unknown[]) => SupabaseQuery;
  limit: (...args: unknown[]) => SupabaseQuery;
  maybeSingle: () => Promise<SupabaseResult>;
  single: () => Promise<SupabaseResult>;
  insert: (...args: unknown[]) => SupabaseQuery;
  update: (...args: unknown[]) => SupabaseQuery;
  upsert: (...args: unknown[]) => SupabaseQuery;
};

function table(supabase: SupabaseLike, name: string) {
  return supabase.from(name) as SupabaseQuery;
}

export type MicrosoftProjectConnection = {
  id: string;
  company_id: string;
  provider: string;
  status: "pending" | "connected" | "needs_reauth" | "disabled" | "error";
  display_name?: string | null;
  account_email?: string | null;
  tenant_id?: string | null;
  scopes?: string[] | null;
  dataverse_environment_url?: string | null;
  encrypted_access_token?: string | null;
  encrypted_refresh_token?: string | null;
  access_token_expires_at?: string | null;
  metadata?: Record<string, unknown> | null;
  last_sync_at?: string | null;
};

export type ImportedMicrosoftProject = {
  sourceSystem: "dataverse_project" | "planner";
  sourceProjectId: string;
  sourceProjectUrl?: string | null;
  sourcePlanId?: string | null;
  name: string;
  projectNumber?: string | null;
  status: "planned" | "active" | "completed" | "archived";
  startDate?: string | null;
  endDate?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  rawPayload: Record<string, unknown>;
};

export type ImportedMicrosoftTask = {
  sourceSystem: "dataverse_project" | "planner";
  sourceProjectId?: string | null;
  sourceTaskId: string;
  parentSourceTaskId?: string | null;
  title: string;
  notes?: string | null;
  status: "not_started" | "in_progress" | "completed" | "blocked" | "archived";
  percentComplete?: number | null;
  priority?: string | null;
  bucketName?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  rawPayload: Record<string, unknown>;
};

export type ImportedMicrosoftAssignment = {
  sourceAssignmentId: string;
  sourceTaskId?: string | null;
  sourceProjectId?: string | null;
  sourceUserId?: string | null;
  displayName?: string | null;
  email?: string | null;
  rawPayload: Record<string, unknown>;
};

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type SyncImportResult = {
  projectsSeen: number;
  projectsImported: number;
  tasksSeen: number;
  tasksImported: number;
  assignmentsSeen: number;
  assignmentsImported: number;
  warnings: string[];
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getMicrosoftProjectEnvStatus() {
  return {
    clientId: Boolean(readEnv("MICROSOFT_CLIENT_ID")),
    clientSecret: Boolean(readEnv("MICROSOFT_CLIENT_SECRET")),
    redirectUri: Boolean(readEnv("MICROSOFT_REDIRECT_URI")),
    tokenEncryptionKey: Boolean(readEnv("MICROSOFT_TOKEN_ENCRYPTION_KEY")),
    configured:
      Boolean(readEnv("MICROSOFT_CLIENT_ID")) &&
      Boolean(readEnv("MICROSOFT_CLIENT_SECRET")) &&
      Boolean(readEnv("MICROSOFT_REDIRECT_URI")) &&
      Boolean(readEnv("MICROSOFT_TOKEN_ENCRYPTION_KEY")),
  };
}

function getRequiredMicrosoftEnv() {
  const clientId = readEnv("MICROSOFT_CLIENT_ID");
  const clientSecret = readEnv("MICROSOFT_CLIENT_SECRET");
  const redirectUri = readEnv("MICROSOFT_REDIRECT_URI");
  const tokenEncryptionKey = readEnv("MICROSOFT_TOKEN_ENCRYPTION_KEY");
  const tenantMode = readEnv("MICROSOFT_TENANT_MODE") ?? "organizations";

  if (!clientId || !clientSecret || !redirectUri || !tokenEncryptionKey) {
    throw new Error("Microsoft Project connector is not configured.");
  }

  return { clientId, clientSecret, redirectUri, tokenEncryptionKey, tenantMode };
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function parseBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function tokenKey() {
  return createHash("sha256").update(getRequiredMicrosoftEnv().tokenEncryptionKey).digest();
}

export function encryptMicrosoftToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${base64Url(iv)}:${base64Url(tag)}:${base64Url(encrypted)}`;
}

export function decryptMicrosoftToken(value?: string | null) {
  if (!value) return null;
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Unsupported Microsoft token format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), parseBase64Url(iv));
  decipher.setAuthTag(parseBase64Url(tag));
  return Buffer.concat([decipher.update(parseBase64Url(encrypted)), decipher.final()]).toString("utf8");
}

export function normalizeDataverseEnvironmentUrl(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function normalizeMicrosoftSourceId(sourceSystem: string, rawId: unknown) {
  const id = String(rawId ?? "").trim();
  if (!id) return "";
  return `${sourceSystem}:${id.toLowerCase()}`;
}

function stateSecret() {
  const { clientSecret, tokenEncryptionKey } = getRequiredMicrosoftEnv();
  return `${clientSecret}:${tokenEncryptionKey}`;
}

export function createMicrosoftOAuthState(input: {
  companyId: string;
  userId: string;
  dataverseEnvironmentUrl?: string | null;
  returnTo?: string | null;
}) {
  const payload = {
    companyId: input.companyId,
    userId: input.userId,
    dataverseEnvironmentUrl: normalizeDataverseEnvironmentUrl(input.dataverseEnvironmentUrl),
    returnTo: input.returnTo || "/company-integrations",
    nonce: base64Url(randomBytes(16)),
    iat: Date.now(),
  };
  const encoded = base64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = base64Url(createHmac("sha256", stateSecret()).update(encoded).digest());
  return `${encoded}.${signature}`;
}

export function verifyMicrosoftOAuthState(state: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new Error("Invalid OAuth state.");
  const expected = base64Url(createHmac("sha256", stateSecret()).update(encoded).digest());
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("Invalid OAuth state signature.");
  }
  const payload = JSON.parse(parseBase64Url(encoded).toString("utf8")) as {
    companyId?: string;
    userId?: string;
    dataverseEnvironmentUrl?: string | null;
    returnTo?: string | null;
    iat?: number;
  };
  if (!payload.companyId || !payload.userId || !payload.iat || Date.now() - payload.iat > STATE_MAX_AGE_MS) {
    throw new Error("Expired OAuth state.");
  }
  return {
    companyId: payload.companyId,
    userId: payload.userId,
    dataverseEnvironmentUrl: normalizeDataverseEnvironmentUrl(payload.dataverseEnvironmentUrl),
    returnTo: payload.returnTo || "/company-integrations",
  };
}

export function buildMicrosoftAuthorizeUrl(input: {
  companyId: string;
  userId: string;
  dataverseEnvironmentUrl?: string | null;
  returnTo?: string | null;
}) {
  const { clientId, redirectUri, tenantMode } = getRequiredMicrosoftEnv();
  const dataverseEnvironmentUrl = normalizeDataverseEnvironmentUrl(input.dataverseEnvironmentUrl);
  const scopes = [...GRAPH_SCOPES];
  if (dataverseEnvironmentUrl) scopes.push(`${dataverseEnvironmentUrl}/user_impersonation`);

  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenantMode)}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", createMicrosoftOAuthState({ ...input, dataverseEnvironmentUrl }));
  return { authorizationUrl: url.toString(), scopes, dataverseEnvironmentUrl };
}

async function postMicrosoftToken(params: URLSearchParams, tenant = getRequiredMicrosoftEnv().tenantMode) {
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = (await response.json().catch(() => null)) as MicrosoftTokenResponse | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Microsoft token request failed.");
  }
  return data;
}

export async function exchangeMicrosoftCodeForToken(code: string) {
  const { clientId, clientSecret, redirectUri, tenantMode } = getRequiredMicrosoftEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: GRAPH_SCOPES.join(" "),
  });
  return postMicrosoftToken(params, tenantMode);
}

async function refreshMicrosoftAccessToken(refreshToken: string, scope: string) {
  const { clientId, clientSecret, tenantMode } = getRequiredMicrosoftEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope,
  });
  return postMicrosoftToken(params, tenantMode);
}

async function fetchMicrosoftJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "OData-Version": "4.0",
      "OData-MaxVersion": "4.0",
    },
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = data?.error && typeof data.error === "object" ? (data.error as { message?: string }) : null;
    throw new Error(error?.message || `Microsoft request failed (${response.status}).`);
  }
  return data ?? {};
}

export async function fetchMicrosoftGraphMe(accessToken: string) {
  const data = await fetchMicrosoftJson(`${GRAPH_BASE_URL}/me?$select=id,displayName,mail,userPrincipalName`, accessToken);
  return {
    id: asText(data.id),
    displayName: asText(data.displayName),
    email: asText(data.mail) || asText(data.userPrincipalName),
    raw: data,
  };
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((row) => Object.keys(row).length > 0) : [];
}

function normalizeDateOnly(value: unknown) {
  const text = asText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeDateTime(value: unknown) {
  const text = asText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeProjectStatus(row: Record<string, unknown>): ImportedMicrosoftProject["status"] {
  const status = `${asText(row.statecode) || asText(row.msdyn_status) || asText(row.status)}`.toLowerCase();
  if (status.includes("complete") || status === "1") return "completed";
  if (status.includes("archive") || status.includes("inactive")) return "archived";
  if (status.includes("plan")) return "planned";
  return "active";
}

function normalizeTaskStatus(row: Record<string, unknown>): ImportedMicrosoftTask["status"] {
  const percent = asNumber(row.percentComplete ?? row.percent_complete ?? row.msdyn_percentcomplete);
  const status = `${asText(row.status) || asText(row.msdyn_status) || asText(row.statecode)}`.toLowerCase();
  if (percent != null && percent >= 100) return "completed";
  if (status.includes("complete") || status === "1") return "completed";
  if (status.includes("block")) return "blocked";
  if (status.includes("progress") || (percent != null && percent > 0)) return "in_progress";
  if (status.includes("archive")) return "archived";
  return "not_started";
}

export function normalizeDataverseProjects(rows: Record<string, unknown>[]): ImportedMicrosoftProject[] {
  return rows
    .map((row): ImportedMicrosoftProject | null => {
      const id = asText(row.msdyn_projectid ?? row.projectid ?? row.id);
      const name = asText(row.msdyn_subject ?? row.msdyn_name ?? row.name ?? row.subject);
      if (!id || !name) return null;
      return {
        sourceSystem: "dataverse_project" as const,
        sourceProjectId: normalizeMicrosoftSourceId("dataverse_project", id),
        name,
        projectNumber: asText(row.msdyn_projectnumber ?? row.projectnumber) || null,
        status: normalizeProjectStatus(row),
        startDate: normalizeDateOnly(row.msdyn_scheduledstart ?? row.msdyn_start ?? row.start_date),
        endDate: normalizeDateOnly(row.msdyn_finish ?? row.msdyn_end ?? row.end_date),
        ownerName: asText(row.ownerid?.toString?.()) || null,
        ownerEmail: null,
        rawPayload: row,
      };
    })
    .filter((row): row is ImportedMicrosoftProject => Boolean(row));
}

export function normalizeDataverseTasks(rows: Record<string, unknown>[]): ImportedMicrosoftTask[] {
  return rows
    .map((row): ImportedMicrosoftTask | null => {
      const id = asText(row.msdyn_projecttaskid ?? row.projecttaskid ?? row.id);
      const title = asText(row.msdyn_subject ?? row.msdyn_name ?? row.subject ?? row.name);
      if (!id || !title) return null;
      const projectId = asText(row._msdyn_project_value ?? row.msdyn_projectid ?? row.projectid);
      return {
        sourceSystem: "dataverse_project" as const,
        sourceProjectId: projectId ? normalizeMicrosoftSourceId("dataverse_project", projectId) : null,
        sourceTaskId: normalizeMicrosoftSourceId("dataverse_task", id),
        parentSourceTaskId: asText(row._msdyn_parenttask_value) || null,
        title,
        notes: asText(row.msdyn_description ?? row.description) || null,
        status: normalizeTaskStatus(row),
        percentComplete: asNumber(row.msdyn_percentcomplete ?? row.percentComplete),
        priority: asText(row.msdyn_priority ?? row.priority) || null,
        bucketName: asText(row.msdyn_bucket ?? row.bucket) || null,
        startAt: normalizeDateTime(row.msdyn_start ?? row.startDateTime ?? row.start_at),
        dueAt: normalizeDateTime(row.msdyn_finish ?? row.dueDateTime ?? row.due_at),
        completedAt: normalizeDateTime(row.completedDateTime ?? row.completed_at),
        rawPayload: row,
      };
    })
    .filter((row): row is ImportedMicrosoftTask => Boolean(row));
}

export function normalizeDataverseAssignments(rows: Record<string, unknown>[]): ImportedMicrosoftAssignment[] {
  return rows
    .map((row): ImportedMicrosoftAssignment | null => {
      const id = asText(row.msdyn_resourceassignmentid ?? row.resourceassignmentid ?? row.id);
      if (!id) return null;
      const taskId = asText(row._msdyn_taskid_value ?? row._msdyn_projecttask_value ?? row.taskId);
      const projectId = asText(row._msdyn_projectid_value ?? row._msdyn_project_value ?? row.projectId);
      const userId = asText(row._msdyn_bookableresourceid_value ?? row.resourceId ?? row.userId);
      return {
        sourceAssignmentId: normalizeMicrosoftSourceId("dataverse_assignment", id),
        sourceTaskId: taskId ? normalizeMicrosoftSourceId("dataverse_task", taskId) : null,
        sourceProjectId: projectId ? normalizeMicrosoftSourceId("dataverse_project", projectId) : null,
        sourceUserId: userId || null,
        displayName: asText(row.msdyn_name ?? row.resourceName ?? row.displayName) || null,
        email: asText(row.email ?? row.mail ?? row.userPrincipalName).toLowerCase() || null,
        rawPayload: row,
      };
    })
    .filter((row): row is ImportedMicrosoftAssignment => Boolean(row));
}

export function normalizePlannerTasks(rows: Record<string, unknown>[]): {
  projects: ImportedMicrosoftProject[];
  tasks: ImportedMicrosoftTask[];
  assignments: ImportedMicrosoftAssignment[];
} {
  const projectsByPlan = new Map<string, ImportedMicrosoftProject>();
  const tasks: ImportedMicrosoftTask[] = [];
  const assignments: ImportedMicrosoftAssignment[] = [];

  for (const row of rows) {
    const id = asText(row.id);
    const title = asText(row.title);
    if (!id || !title) continue;
    const planId = asText(row.planId) || "assigned-tasks";
    const projectId = normalizeMicrosoftSourceId("planner_plan", planId);
    if (!projectsByPlan.has(projectId)) {
      projectsByPlan.set(projectId, {
        sourceSystem: "planner",
        sourceProjectId: projectId,
        sourcePlanId: planId,
        name: planId === "assigned-tasks" ? "Planner assigned tasks" : `Planner plan ${planId}`,
        status: "active",
        rawPayload: { planId },
      });
    }
    const percent = asNumber(row.percentComplete);
    tasks.push({
      sourceSystem: "planner",
      sourceProjectId: projectId,
      sourceTaskId: normalizeMicrosoftSourceId("planner_task", id),
      title,
      notes: null,
      status: normalizeTaskStatus({ percentComplete: percent }),
      percentComplete: percent,
      priority: asText(row.priority) || null,
      bucketName: asText(row.bucketId) || null,
      startAt: normalizeDateTime(row.startDateTime),
      dueAt: normalizeDateTime(row.dueDateTime),
      completedAt: normalizeDateTime(row.completedDateTime),
      rawPayload: row,
    });

    const assignmentsObject = asRecord(row.assignments);
    for (const userId of Object.keys(assignmentsObject)) {
      assignments.push({
        sourceAssignmentId: normalizeMicrosoftSourceId("planner_assignment", `${id}:${userId}`),
        sourceTaskId: normalizeMicrosoftSourceId("planner_task", id),
        sourceProjectId: projectId,
        sourceUserId: userId,
        displayName: null,
        email: null,
        rawPayload: asRecord(assignmentsObject[userId]),
      });
    }
  }

  return { projects: [...projectsByPlan.values()], tasks, assignments };
}

async function fetchDataversePayload(dataverseEnvironmentUrl: string, accessToken: string) {
  const projectSelect = [
    "msdyn_projectid",
    "msdyn_subject",
    "msdyn_name",
    "msdyn_projectnumber",
    "msdyn_scheduledstart",
    "msdyn_start",
    "msdyn_finish",
    "msdyn_end",
    "statecode",
  ].join(",");
  const taskSelect = [
    "msdyn_projecttaskid",
    "msdyn_subject",
    "msdyn_name",
    "msdyn_description",
    "msdyn_start",
    "msdyn_finish",
    "msdyn_percentcomplete",
    "_msdyn_project_value",
    "_msdyn_parenttask_value",
    "statecode",
  ].join(",");

  const [projects, tasks, assignments] = await Promise.all([
    fetchMicrosoftJson(`${dataverseEnvironmentUrl}/api/data/v9.2/msdyn_projects?$select=${projectSelect}&$top=200`, accessToken),
    fetchMicrosoftJson(`${dataverseEnvironmentUrl}/api/data/v9.2/msdyn_projecttasks?$select=${taskSelect}&$top=1000`, accessToken),
    fetchMicrosoftJson(`${dataverseEnvironmentUrl}/api/data/v9.2/msdyn_resourceassignments?$top=1000`, accessToken),
  ]);

  return {
    projects: normalizeDataverseProjects(asArray(projects.value)),
    tasks: normalizeDataverseTasks(asArray(tasks.value)),
    assignments: normalizeDataverseAssignments(asArray(assignments.value)),
  };
}

async function fetchPlannerPayload(accessToken: string) {
  const data = await fetchMicrosoftJson(`${GRAPH_BASE_URL}/me/planner/tasks?$top=200`, accessToken);
  return normalizePlannerTasks(asArray(data.value));
}

async function findCompanyUserByEmail(supabase: SupabaseLike, email?: string | null) {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized || !supabase.auth?.admin?.listUsers) return null;
  const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => null);
  const match = users?.data?.users?.find((user) => (user.email ?? "").trim().toLowerCase() === normalized);
  return match?.id ?? null;
}

async function resolveOrCreateJobsite(params: {
  supabase: SupabaseLike;
  companyId: string;
  actorUserId?: string | null;
  project: ImportedMicrosoftProject;
}) {
  const { supabase, companyId, actorUserId, project } = params;
  let existing: { id?: string } | null = null;

  if (project.projectNumber) {
    const byProjectNumber = await table(supabase, "company_jobsites")
      .select("id")
      .eq("company_id", companyId)
      .eq("project_number", project.projectNumber)
      .maybeSingle();
    existing = byProjectNumber.data ?? null;
  }

  if (!existing?.id) {
    const byName = await table(supabase, "company_jobsites")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", project.name)
      .maybeSingle();
    existing = byName.data ?? null;
  }

  if (existing?.id) return existing.id;

  const created = await table(supabase, "company_jobsites")
    .insert({
      company_id: companyId,
      name: project.name,
      project_number: project.projectNumber || null,
      status: project.status === "archived" ? "archived" : project.status,
      project_manager: project.ownerName || null,
      start_date: project.startDate || null,
      end_date: project.endDate || null,
      notes: "Created from Microsoft Project connector.",
      created_by: actorUserId,
      updated_by: actorUserId,
      archived_at: project.status === "archived" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  const createdRow = (created.data ?? null) as { id?: string } | null;
  if (created.error || !createdRow?.id) {
    throw new Error(created.error?.message || "Failed to create jobsite from Microsoft Project.");
  }

  return createdRow.id;
}

async function importMicrosoftPayload(params: {
  supabase: SupabaseLike;
  companyId: string;
  connectionId: string;
  actorUserId?: string | null;
  projects: ImportedMicrosoftProject[];
  tasks: ImportedMicrosoftTask[];
  assignments: ImportedMicrosoftAssignment[];
}): Promise<SyncImportResult> {
  const { supabase, companyId, connectionId, actorUserId, projects, tasks, assignments } = params;
  const projectMap = new Map<string, { sourceId: string; jobsiteId: string | null }>();
  const taskMap = new Map<string, string>();
  let projectsImported = 0;
  let tasksImported = 0;
  let assignmentsImported = 0;
  const warnings: string[] = [];

  for (const project of projects) {
    try {
      const jobsiteId = await resolveOrCreateJobsite({ supabase, companyId, actorUserId, project });
      const upsert = await table(supabase, "company_microsoft_project_sources")
        .upsert(
          {
            company_id: companyId,
            connection_id: connectionId,
            source_system: project.sourceSystem,
            source_project_id: project.sourceProjectId,
            source_project_url: project.sourceProjectUrl || null,
            source_plan_id: project.sourcePlanId || null,
            name: project.name,
            project_number: project.projectNumber || null,
            status: project.status,
            start_date: project.startDate || null,
            end_date: project.endDate || null,
            owner_name: project.ownerName || null,
            owner_email: project.ownerEmail || null,
            raw_payload: project.rawPayload,
            jobsite_id: jobsiteId,
            last_seen_at: new Date().toISOString(),
            archived_at: project.status === "archived" ? new Date().toISOString() : null,
            created_by: actorUserId,
            updated_by: actorUserId,
          },
          { onConflict: "company_id,connection_id,source_system,source_project_id" }
        )
        .select("id, jobsite_id")
        .single();
      const sourceRow = (upsert.data ?? null) as { id?: string; jobsite_id?: string | null } | null;
      if (upsert.error || !sourceRow?.id) throw new Error(upsert.error?.message || "Project upsert failed.");
      projectMap.set(project.sourceProjectId, {
        sourceId: sourceRow.id,
        jobsiteId: sourceRow.jobsite_id ?? jobsiteId,
      });
      projectsImported += 1;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `Project import failed for ${project.name}.`);
    }
  }

  for (const task of tasks) {
    try {
      const projectRef = task.sourceProjectId ? projectMap.get(task.sourceProjectId) : null;
      const upsert = await table(supabase, "company_microsoft_project_tasks")
        .upsert(
          {
            company_id: companyId,
            connection_id: connectionId,
            project_source_id: projectRef?.sourceId ?? null,
            jobsite_id: projectRef?.jobsiteId ?? null,
            source_system: task.sourceSystem,
            source_project_id: task.sourceProjectId || null,
            source_task_id: task.sourceTaskId,
            parent_source_task_id: task.parentSourceTaskId || null,
            title: task.title,
            notes: task.notes || null,
            status: task.status,
            percent_complete: task.percentComplete ?? null,
            priority: task.priority || null,
            bucket_name: task.bucketName || null,
            start_at: task.startAt || null,
            due_at: task.dueAt || null,
            completed_at: task.completedAt || null,
            raw_payload: task.rawPayload,
            last_seen_at: new Date().toISOString(),
            archived_at: task.status === "archived" ? new Date().toISOString() : null,
            created_by: actorUserId,
            updated_by: actorUserId,
          },
          { onConflict: "company_id,connection_id,source_system,source_task_id" }
        )
        .select("id")
        .single();
      const taskRow = (upsert.data ?? null) as { id?: string } | null;
      if (upsert.error || !taskRow?.id) throw new Error(upsert.error?.message || "Task upsert failed.");
      taskMap.set(task.sourceTaskId, taskRow.id);
      tasksImported += 1;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `Task import failed for ${task.title}.`);
    }
  }

  for (const assignment of assignments) {
    try {
      const projectRef = assignment.sourceProjectId ? projectMap.get(assignment.sourceProjectId) : null;
      const taskId = assignment.sourceTaskId ? taskMap.get(assignment.sourceTaskId) : null;
      const userId = await findCompanyUserByEmail(supabase, assignment.email);
      const upsert = await table(supabase, "company_microsoft_project_assignments")
        .upsert(
          {
            company_id: companyId,
            connection_id: connectionId,
            project_source_id: projectRef?.sourceId ?? null,
            task_id: taskId ?? null,
            source_assignment_id: assignment.sourceAssignmentId,
            source_user_id: assignment.sourceUserId || null,
            display_name: assignment.displayName || null,
            email: assignment.email || null,
            user_id: userId,
            raw_payload: assignment.rawPayload,
            last_seen_at: new Date().toISOString(),
            created_by: actorUserId,
            updated_by: actorUserId,
          },
          { onConflict: "company_id,connection_id,source_assignment_id" }
        )
        .select("id")
        .single();
      const assignmentRow = (upsert.data ?? null) as { id?: string } | null;
      if (upsert.error || !assignmentRow?.id) throw new Error(upsert.error?.message || "Assignment upsert failed.");
      assignmentsImported += 1;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Assignment import failed.");
    }
  }

  return {
    projectsSeen: projects.length,
    projectsImported,
    tasksSeen: tasks.length,
    tasksImported,
    assignmentsSeen: assignments.length,
    assignmentsImported,
    warnings,
  };
}

export async function upsertMicrosoftProjectConnection(params: {
  supabase: SupabaseLike;
  companyId: string;
  actorUserId?: string | null;
  token: MicrosoftTokenResponse;
  graphMe: { id: string; displayName: string; email: string; raw: Record<string, unknown> };
  dataverseEnvironmentUrl?: string | null;
}) {
  const expiresAt = new Date(Date.now() + Math.max(0, params.token.expires_in ?? 3600) * 1000).toISOString();
  const upsert = await table(params.supabase, "company_integration_connections")
    .upsert(
      {
        company_id: params.companyId,
        provider: MICROSOFT_PROJECT_PROVIDER,
        status: "connected",
        display_name: params.graphMe.displayName || "Microsoft Project",
        account_email: params.graphMe.email || null,
        tenant_id: asText((params.graphMe.raw as { tenantId?: unknown }).tenantId) || null,
        scopes: (params.token.scope ?? GRAPH_SCOPES.join(" ")).split(/\s+/).filter(Boolean),
        dataverse_environment_url: normalizeDataverseEnvironmentUrl(params.dataverseEnvironmentUrl),
        encrypted_access_token: params.token.access_token ? encryptMicrosoftToken(params.token.access_token) : null,
        encrypted_refresh_token: params.token.refresh_token ? encryptMicrosoftToken(params.token.refresh_token) : null,
        access_token_expires_at: expiresAt,
        metadata: { graphUserId: params.graphMe.id },
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
      },
      { onConflict: "company_id,provider" }
    )
    .select("id")
    .single();
  const connectionRow = (upsert.data ?? null) as { id?: string } | null;
  if (upsert.error || !connectionRow?.id) {
    throw new Error(upsert.error?.message || "Failed to save Microsoft Project connection.");
  }
  return connectionRow.id;
}

async function loadConnection(supabase: SupabaseLike, companyId: string) {
  const res = await table(supabase, "company_integration_connections")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", MICROSOFT_PROJECT_PROVIDER)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message || "Failed to load Microsoft Project connection.");
  return (res.data ?? null) as MicrosoftProjectConnection | null;
}

export async function runMicrosoftProjectSync(params: {
  supabase: SupabaseLike;
  companyId: string;
  actorUserId?: string | null;
}) {
  const connection = await loadConnection(params.supabase, params.companyId);
  if (!connection) throw new Error("Microsoft Project is not connected.");
  if (connection.status !== "connected") throw new Error("Microsoft Project connection needs attention.");
  const refreshToken = decryptMicrosoftToken(connection.encrypted_refresh_token);
  if (!refreshToken) throw new Error("Microsoft Project refresh token is missing.");

  const run = await table(params.supabase, "company_integration_sync_runs")
    .insert({
      company_id: params.companyId,
      connection_id: connection.id,
      provider: MICROSOFT_PROJECT_PROVIDER,
      status: "running",
      created_by: params.actorUserId,
    })
    .select("id")
    .single();
  const runRow = (run.data ?? null) as { id?: string } | null;
  if (run.error || !runRow?.id) throw new Error(run.error?.message || "Failed to record sync run.");
  const runId = runRow.id;

  const warnings: string[] = [];
  try {
    const graphToken = await refreshMicrosoftAccessToken(refreshToken, GRAPH_SCOPES.join(" "));
    const nextRefreshToken = graphToken.refresh_token ?? refreshToken;
    let projects: ImportedMicrosoftProject[] = [];
    let tasks: ImportedMicrosoftTask[] = [];
    let assignments: ImportedMicrosoftAssignment[] = [];

    if (connection.dataverse_environment_url) {
      try {
        const dataverseToken = await refreshMicrosoftAccessToken(
          nextRefreshToken,
          `${connection.dataverse_environment_url}/user_impersonation`
        );
        const dataverse = await fetchDataversePayload(connection.dataverse_environment_url, dataverseToken.access_token!);
        projects = projects.concat(dataverse.projects);
        tasks = tasks.concat(dataverse.tasks);
        assignments = assignments.concat(dataverse.assignments);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Dataverse Project sync failed.");
      }
    }

    try {
      const planner = await fetchPlannerPayload(graphToken.access_token!);
      projects = projects.concat(planner.projects);
      tasks = tasks.concat(planner.tasks);
      assignments = assignments.concat(planner.assignments);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Planner task sync failed.");
    }

    const imported = await importMicrosoftPayload({
      supabase: params.supabase,
      companyId: params.companyId,
      connectionId: connection.id,
      actorUserId: params.actorUserId,
      projects,
      tasks,
      assignments,
    });
    warnings.push(...imported.warnings);

    const finalStatus = warnings.length ? "partial" : "succeeded";
    await table(params.supabase, "company_integration_sync_runs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        projects_seen: imported.projectsSeen,
        projects_imported: imported.projectsImported,
        tasks_seen: imported.tasksSeen,
        tasks_imported: imported.tasksImported,
        assignments_seen: imported.assignmentsSeen,
        assignments_imported: imported.assignmentsImported,
        metadata: { warnings },
      })
      .eq("id", runId);

    await table(params.supabase, "company_integration_connections")
      .update({
        encrypted_access_token: graphToken.access_token ? encryptMicrosoftToken(graphToken.access_token) : connection.encrypted_access_token,
        encrypted_refresh_token: graphToken.refresh_token ? encryptMicrosoftToken(graphToken.refresh_token) : connection.encrypted_refresh_token,
        access_token_expires_at: new Date(Date.now() + Math.max(0, graphToken.expires_in ?? 3600) * 1000).toISOString(),
        last_sync_at: new Date().toISOString(),
        status: "connected",
        updated_by: params.actorUserId,
      })
      .eq("id", connection.id);

    return { status: finalStatus, ...imported, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microsoft Project sync failed.";
    await table(params.supabase, "company_integration_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", runId);
    await table(params.supabase, "company_integration_connections")
      .update({ status: message.toLowerCase().includes("token") ? "needs_reauth" : "error", updated_by: params.actorUserId })
      .eq("id", connection.id);
    throw error;
  }
}

function readMicrosoftProjectCronMaxCompanies() {
  const raw = Number(process.env.MICROSOFT_PROJECT_CRON_MAX_COMPANIES ?? "50");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 50;
}

export async function runMicrosoftProjectDailySync(params: {
  maxCompanies?: number;
} = {}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase service role is required for Microsoft Project cron sync.",
      companiesSeen: 0,
      companiesSynced: 0,
      companiesFailed: 0,
      results: [],
    };
  }

  const maxCompanies = params.maxCompanies ?? readMicrosoftProjectCronMaxCompanies();
  const connections = await table(supabase, "company_integration_connections")
    .select("id, company_id, status, provider, last_sync_at")
    .eq("provider", MICROSOFT_PROJECT_PROVIDER)
    .eq("status", "connected")
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(maxCompanies);

  if (connections.error) {
    return {
      ok: false,
      error: connections.error.message || "Failed to load Microsoft Project connections.",
      companiesSeen: 0,
      companiesSynced: 0,
      companiesFailed: 0,
      results: [],
    };
  }

  const rows = ((connections.data ?? []) as Array<{ id: string; company_id: string }>)
    .filter((row) => row.company_id);
  const results: Array<{
    companyId: string;
    ok: boolean;
    status?: string;
    projectsImported?: number;
    tasksImported?: number;
    assignmentsImported?: number;
    error?: string;
  }> = [];

  for (const row of rows) {
    try {
      const result = await runMicrosoftProjectSync({
        supabase,
        companyId: row.company_id,
        actorUserId: null,
      });
      results.push({
        companyId: row.company_id,
        ok: true,
        status: result.status,
        projectsImported: result.projectsImported,
        tasksImported: result.tasksImported,
        assignmentsImported: result.assignmentsImported,
      });
    } catch (error) {
      results.push({
        companyId: row.company_id,
        ok: false,
        error: error instanceof Error ? error.message : "Microsoft Project sync failed.",
      });
    }
  }

  const companiesFailed = results.filter((result) => !result.ok).length;
  return {
    ok: companiesFailed < rows.length || rows.length === 0,
    companiesSeen: rows.length,
    companiesSynced: results.filter((result) => result.ok).length,
    companiesFailed,
    results,
    cappedAt: maxCompanies,
  };
}

export async function getMicrosoftProjectStatus(params: { supabase: SupabaseLike; companyId: string }) {
  const connection = await loadConnection(params.supabase, params.companyId);
  const latestRun = await table(params.supabase, "company_integration_sync_runs")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("provider", MICROSOFT_PROJECT_PROVIDER)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sources = await table(params.supabase, "company_microsoft_project_sources")
    .select("id", { count: "exact", head: true })
    .eq("company_id", params.companyId);
  const tasks = await table(params.supabase, "company_microsoft_project_tasks")
    .select("id", { count: "exact", head: true })
    .eq("company_id", params.companyId);

  return {
    configured: getMicrosoftProjectEnvStatus(),
    connected: connection?.status === "connected",
    connection: connection
      ? {
          id: connection.id,
          status: connection.status,
          displayName: connection.display_name,
          accountEmail: connection.account_email,
          dataverseEnvironmentUrl: connection.dataverse_environment_url,
          lastSyncAt: connection.last_sync_at,
        }
      : null,
    latestRun: latestRun.data ?? null,
    counts: {
      projects: sources.count ?? 0,
      tasks: tasks.count ?? 0,
    },
  };
}
