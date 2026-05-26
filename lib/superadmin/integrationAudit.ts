import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerEnvStatus } from "@/lib/supabaseAdmin";
import type {
  IntegrationAuditCheck,
  IntegrationAuditEdge,
  IntegrationAuditNode,
  IntegrationAuditNodeId,
  IntegrationAuditResponse,
  IntegrationAuditStatus,
  IntegrationAuditSummary,
} from "@/lib/superadmin/integrationAuditTypes";

type JsonRecord = Record<string, unknown>;

type BuildIntegrationAuditOptions = {
  admin: SupabaseClient | null;
  rootDir?: string;
  now?: Date;
  remoteMigrationVersions?: string[];
  liveVercelAccessError?: string | null;
  knownAdvisorFindings?: {
    securityWarnings?: number;
    performanceWarnings?: number;
    notes?: string[];
  };
};

const STATUS_RANK: Record<IntegrationAuditStatus, number> = {
  critical: 0,
  warning: 1,
  unknown: 2,
  healthy: 3,
};

const NODE_LABELS: Record<IntegrationAuditNodeId, string> = {
  vercel_deployment: "Vercel deployment",
  next_runtime: "Next.js runtime",
  supabase_project: "Supabase project",
  auth_rbac: "Auth and RBAC",
  storage_documents: "Storage and documents",
  core_workflows: "Core workflows",
  scheduled_jobs: "Scheduled jobs",
  safety_ai: "Safety AI engine",
};

const NODE_ORDER: IntegrationAuditNodeId[] = [
  "vercel_deployment",
  "next_runtime",
  "supabase_project",
  "auth_rbac",
  "storage_documents",
  "core_workflows",
  "scheduled_jobs",
  "safety_ai",
];

const CORE_TABLE_GROUPS: Array<{
  checkId: string;
  label: string;
  nodeId: IntegrationAuditNodeId;
  tables: string[];
}> = [
  {
    checkId: "workflow-field-operations",
    label: "Field operations tables",
    nodeId: "core_workflows",
    tables: [
      "companies",
      "company_jobsites",
      "company_sor_records",
      "company_corrective_actions",
      "company_incidents",
      "company_permits",
      "company_jsas",
    ],
  },
  {
    checkId: "workflow-training",
    label: "Training workflow tables",
    nodeId: "core_workflows",
    tables: [
      "company_training_requirements",
      "company_training_records",
      "training_expiration_notification_deliveries",
    ],
  },
  {
    checkId: "workflow-documents",
    label: "Document workflow tables",
    nodeId: "storage_documents",
    tables: ["documents", "document_downloads", "workspace_document_excerpts"],
  },
  {
    checkId: "workflow-safety-intelligence",
    label: "Safety Intelligence and Gus tables",
    nodeId: "safety_ai",
    tables: [
      "company_memory_items",
      "company_bucket_items",
      "company_risk_memory_facets",
      "approved_knowledge",
      "gus_planning_sessions",
      "gus_answer_audit",
    ],
  },
  {
    checkId: "workflow-integrations-billing",
    label: "Billing and Microsoft Project tables",
    nodeId: "core_workflows",
    tables: [
      "company_subscriptions",
      "company_billing_invoices",
      "company_integration_connections",
      "company_integration_project_mappings",
    ],
  },
  {
    checkId: "workflow-cron-telemetry",
    label: "Cron telemetry table",
    nodeId: "scheduled_jobs",
    tables: ["platform_job_runs"],
  },
];

export function worstIntegrationStatus(
  statuses: readonly IntegrationAuditStatus[],
  fallback: IntegrationAuditStatus = "unknown"
): IntegrationAuditStatus {
  if (statuses.length === 0) return fallback;
  return statuses.reduce<IntegrationAuditStatus>((worst, current) =>
    STATUS_RANK[current] < STATUS_RANK[worst] ? current : worst
  , fallback);
}

export function summarizeIntegrationChecks(
  checks: readonly Pick<IntegrationAuditCheck, "status">[]
): IntegrationAuditSummary {
  return {
    totalChecks: checks.length,
    healthy: checks.filter((check) => check.status === "healthy").length,
    warning: checks.filter((check) => check.status === "warning").length,
    critical: checks.filter((check) => check.status === "critical").length,
    unknown: checks.filter((check) => check.status === "unknown").length,
  };
}

export function maskSensitiveValue(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.password) url.password = "***";
      if (url.username) url.username = `${url.username.split(".")[0]}...`;
      return url.toString();
    } catch {
      return "postgresql://***";
    }
  }

  if (trimmed.length <= 10) return "***";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function detectDuplicateCronPaths(
  crons: Array<{ path?: unknown; schedule?: unknown }>
) {
  const byPath = new Map<string, string[]>();
  for (const cron of crons) {
    if (typeof cron.path !== "string" || !cron.path.trim()) continue;
    const schedules = byPath.get(cron.path) ?? [];
    schedules.push(typeof cron.schedule === "string" ? cron.schedule : "(missing schedule)");
    byPath.set(cron.path, schedules);
  }

  return [...byPath.entries()]
    .filter(([, schedules]) => schedules.length > 1)
    .map(([cronPath, schedules]) => ({ path: cronPath, schedules }));
}

function statusLabel(status: IntegrationAuditStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function readJson(filePath: string): JsonRecord | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonRecord;
  } catch {
    return null;
  }
}

function listLocalMigrations(rootDir: string) {
  const migrationsDir = path.join(rootDir, "supabase", "migrations");
  try {
    return fs
      .readdirSync(migrationsDir)
      .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
      .map((name) => {
        const [version] = name.split("_", 1);
        return { version, name };
      })
      .sort((a, b) => a.version.localeCompare(b.version));
  } catch {
    return [];
  }
}

function inferSupabaseRef() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  try {
    const host = new URL(value).hostname;
    const [ref] = host.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function checkFactory(generatedAt: string) {
  return function makeCheck(
    check: Omit<IntegrationAuditCheck, "lastCheckedAt">
  ): IntegrationAuditCheck {
    return { ...check, lastCheckedAt: generatedAt };
  };
}

async function headCount(
  admin: SupabaseClient,
  table: string
): Promise<{ count: number; error: string | null }> {
  try {
    const { count, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true });
    return { count: count ?? 0, error: error?.message ?? null };
  } catch (error) {
    return {
      count: 0,
      error: error instanceof Error ? error.message : "query_failed",
    };
  }
}

async function listBuckets(admin: SupabaseClient) {
  try {
    const { data, error } = await admin.storage.listBuckets();
    return {
      buckets: (data ?? []).map((bucket) => bucket.name),
      error: error?.message ?? null,
    };
  } catch (error) {
    return {
      buckets: [],
      error: error instanceof Error ? error.message : "storage_probe_failed",
    };
  }
}

async function readRemoteMigrationVersions(admin: SupabaseClient | null) {
  if (!admin) return { versions: [] as string[], error: "Supabase admin client unavailable." };

  try {
    const schemaClient = admin.schema("supabase_migrations" as never) as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          order: (
            column: string,
            options?: { ascending?: boolean }
          ) => {
            limit: (count: number) => PromiseLike<{
              data: Array<{ version?: unknown }> | null;
              error: { message?: string | null } | null;
            }>;
          };
        };
      };
    };
    const { data, error } = await schemaClient
      .from("schema_migrations")
      .select("version")
      .order("version", { ascending: false })
      .limit(10);
    if (error) return { versions: [] as string[], error: error.message };
    const versions = ((data ?? []) as Array<{ version?: unknown }>)
      .map((row) => String(row.version ?? ""))
      .filter((version) => /^\d{14}$/.test(version));
    return { versions, error: null };
  } catch (error) {
    return {
      versions: [] as string[],
      error: error instanceof Error ? error.message : "migration_probe_failed",
    };
  }
}

function buildNodes(checks: IntegrationAuditCheck[]): IntegrationAuditNode[] {
  return NODE_ORDER.map((id) => {
    const nodeChecks = checks.filter((check) => check.nodeId === id);
    const status = worstIntegrationStatus(nodeChecks.map((check) => check.status));
    const problemCount = nodeChecks.filter(
      (check) => check.status === "critical" || check.status === "warning"
    ).length;
    return {
      id,
      label: NODE_LABELS[id],
      status,
      message:
        nodeChecks.length === 0
          ? "No checks are mapped to this node yet."
          : problemCount > 0
            ? `${problemCount} issue(s) need attention.`
            : `All ${nodeChecks.length} mapped check(s) are ${statusLabel(status).toLowerCase()}.`,
      checkIds: nodeChecks.map((check) => check.id),
    };
  });
}

function edgeStatus(checks: IntegrationAuditCheck[], ids: string[]) {
  return worstIntegrationStatus(
    ids.map((id) => checks.find((check) => check.id === id)?.status).filter(Boolean) as IntegrationAuditStatus[]
  );
}

function buildEdges(checks: IntegrationAuditCheck[]): IntegrationAuditEdge[] {
  const edges: IntegrationAuditEdge[] = [
    {
      from: "vercel_deployment",
      to: "next_runtime",
      checkIds: ["vercel-linked-project", "vercel-node-runtime", "vercel-cron-config"],
      label: "Deploy config",
      status: "unknown",
    },
    {
      from: "next_runtime",
      to: "supabase_project",
      checkIds: ["env-core-supabase", "supabase-service-role"],
      label: "Server env",
      status: "unknown",
    },
    {
      from: "supabase_project",
      to: "auth_rbac",
      checkIds: ["supabase-auth", "auth-rbac-tables"],
      label: "Identity scope",
      status: "unknown",
    },
    {
      from: "supabase_project",
      to: "storage_documents",
      checkIds: ["supabase-storage", "workflow-documents"],
      label: "Files",
      status: "unknown",
    },
    {
      from: "supabase_project",
      to: "core_workflows",
      checkIds: [
        "workflow-field-operations",
        "workflow-training",
        "workflow-integrations-billing",
      ],
      label: "Product data",
      status: "unknown",
    },
    {
      from: "vercel_deployment",
      to: "scheduled_jobs",
      checkIds: ["vercel-cron-config", "workflow-cron-telemetry"],
      label: "Crons",
      status: "unknown",
    },
    {
      from: "core_workflows",
      to: "safety_ai",
      checkIds: ["workflow-safety-intelligence", "openai-env", "supabase-advisor-known-risk"],
      label: "Intelligence inputs",
      status: "unknown",
    },
  ];

  return edges.map((edge) => ({
    ...edge,
    status: edgeStatus(checks, edge.checkIds),
  }));
}

function sortedIssues(checks: IntegrationAuditCheck[]) {
  return checks
    .filter((check) => check.status === "critical" || check.status === "warning" || check.status === "unknown")
    .sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      return rank === 0 ? a.label.localeCompare(b.label) : rank;
    });
}

export async function buildProductionIntegrationAudit(
  options: BuildIntegrationAuditOptions
): Promise<IntegrationAuditResponse> {
  const rootDir = options.rootDir ?? process.cwd();
  const generatedAt = (options.now ?? new Date()).toISOString();
  const makeCheck = checkFactory(generatedAt);
  const checks: IntegrationAuditCheck[] = [];

  const packageJson = readJson(path.join(rootDir, "package.json"));
  const vercelProject = readJson(path.join(rootDir, ".vercel", "project.json"));
  const vercelJson = readJson(path.join(rootDir, "vercel.json"));
  const migrations = listLocalMigrations(rootDir);
  const latestLocalMigration = migrations.at(-1) ?? null;
  const env = getSupabaseServerEnvStatus();
  const supabaseRef = inferSupabaseRef();
  const remoteMigrationProbe = options.remoteMigrationVersions
    ? { versions: options.remoteMigrationVersions, error: null }
    : await readRemoteMigrationVersions(options.admin);
  const latestRemoteMigration = remoteMigrationProbe.versions.toSorted().at(-1) ?? null;

  const packageNode = getString((packageJson?.engines as JsonRecord | undefined)?.node);
  const vercelNode = getString((vercelProject?.settings as JsonRecord | undefined)?.nodeVersion);
  const vercelProjectId = getString(vercelProject?.projectId);
  const vercelOrgId = getString(vercelProject?.orgId);
  const vercelProjectName = getString(vercelProject?.projectName);
  const cronRows = Array.isArray(vercelJson?.crons)
    ? (vercelJson.crons as Array<{ path?: unknown; schedule?: unknown }>)
    : [];
  const duplicateCronPaths = detectDuplicateCronPaths(cronRows);

  checks.push(
    makeCheck({
      id: "vercel-linked-project",
      nodeId: "vercel_deployment",
      category: "vercel",
      label: "Vercel linked project metadata",
      status: vercelProjectId && vercelOrgId ? "healthy" : "critical",
      message:
        vercelProjectId && vercelOrgId
          ? `Repo is linked to Vercel project ${vercelProjectName ?? vercelProjectId}.`
          : "No local Vercel project metadata was found.",
      evidence: [
        `projectId=${vercelProjectId ?? "missing"}`,
        `orgId=${vercelOrgId ?? "missing"}`,
        `projectName=${vercelProjectName ?? "missing"}`,
      ],
      recommendedAction:
        vercelProjectId && vercelOrgId
          ? null
          : "Run `vercel link` with the production project before deployment evidence capture.",
    }),
    makeCheck({
      id: "vercel-live-access",
      nodeId: "vercel_deployment",
      category: "vercel",
      label: "Vercel live metadata access",
      status: options.liveVercelAccessError ? "warning" : "unknown",
      message: options.liveVercelAccessError
        ? `Live Vercel metadata could not be read: ${options.liveVercelAccessError}.`
        : "Live Vercel metadata is not available from this in-app audit route.",
      evidence: [
        options.liveVercelAccessError ?? "Use the Vercel connector or CLI to confirm latest deployment and env parity.",
      ],
      recommendedAction:
        "Repair Vercel connector/CLI access, then capture latest deployment status, build logs, and environment parity.",
    }),
    makeCheck({
      id: "vercel-node-runtime",
      nodeId: "next_runtime",
      category: "vercel",
      label: "Node runtime parity",
      status: packageNode === "20.x" && (!vercelNode || vercelNode === "20.x") ? "healthy" : "warning",
      message:
        packageNode === "20.x" && (!vercelNode || vercelNode === "20.x")
          ? "Node runtime settings are aligned to Node 20."
          : "Vercel project metadata does not match the package.json Node pin.",
      evidence: [
        `package.json engines.node=${packageNode ?? "missing"}`,
        `.vercel project nodeVersion=${vercelNode ?? "missing"}`,
      ],
      recommendedAction:
        packageNode === "20.x" && (!vercelNode || vercelNode === "20.x")
          ? null
          : "Update Vercel Project Settings > Build and Deployment > Node.js Version to 20.x.",
    }),
    makeCheck({
      id: "vercel-cron-config",
      nodeId: "scheduled_jobs",
      category: "cron",
      label: "Vercel cron configuration",
      status: duplicateCronPaths.length > 0 ? "warning" : cronRows.length > 0 ? "healthy" : "unknown",
      message:
        duplicateCronPaths.length > 0
          ? "At least one cron path is scheduled more than once."
          : cronRows.length > 0
            ? `${cronRows.length} Vercel cron job(s) are declared.`
            : "No Vercel cron jobs were found in vercel.json.",
      evidence:
        duplicateCronPaths.length > 0
          ? duplicateCronPaths.map((item) => `${item.path}: ${item.schedules.join(", ")}`)
          : cronRows.map((cron) => `${String(cron.path)} @ ${String(cron.schedule)}`),
      recommendedAction:
        duplicateCronPaths.length > 0
          ? "Confirm duplicate cron paths are intentional; otherwise consolidate schedules or split route names."
          : null,
    })
  );

  checks.push(
    makeCheck({
      id: "env-core-supabase",
      nodeId: "next_runtime",
      category: "supabase",
      label: "Core Supabase environment",
      status: env.url && env.anonKey ? "healthy" : "critical",
      message:
        env.url && env.anonKey
          ? "Browser/server Supabase URL and anon key are configured."
          : "Supabase URL or anon key is missing.",
      evidence: [
        `url source=${env.sources.url ?? "missing"}`,
        `anon source=${env.sources.anonKey ?? "missing"}`,
        `project ref=${supabaseRef ?? "unknown"}`,
      ],
      recommendedAction:
        env.url && env.anonKey
          ? null
          : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel production.",
    }),
    makeCheck({
      id: "supabase-service-role",
      nodeId: "supabase_project",
      category: "supabase",
      label: "Supabase service role",
      status: options.admin && env.serviceRoleKey ? "healthy" : "critical",
      message:
        options.admin && env.serviceRoleKey
          ? "Service-role client is available server-side."
          : "Service-role client is not configured.",
      evidence: [`service role source=${env.sources.serviceRoleKey ?? "missing"}`],
      recommendedAction:
        options.admin && env.serviceRoleKey
          ? null
          : "Set SUPABASE_SERVICE_ROLE_KEY in Vercel production; never expose it as NEXT_PUBLIC.",
    }),
    makeCheck({
      id: "supabase-migration-sync",
      nodeId: "supabase_project",
      category: "supabase",
      label: "Supabase migration sync",
      status:
        latestLocalMigration && latestRemoteMigration
          ? latestLocalMigration.version === latestRemoteMigration
            ? "healthy"
            : "critical"
          : "unknown",
      message:
        latestLocalMigration && latestRemoteMigration
          ? latestLocalMigration.version === latestRemoteMigration
            ? "Production migration history includes the latest local migration."
            : "Production migration history is behind the repo."
          : "Remote migration history could not be verified from the app runtime.",
      evidence: [
        `latest local=${latestLocalMigration?.version ?? "missing"}`,
        `latest remote=${latestRemoteMigration ?? "unknown"}`,
        remoteMigrationProbe.error ? `probe error=${remoteMigrationProbe.error}` : "remote probe ok",
      ],
      recommendedAction:
        latestLocalMigration && latestRemoteMigration && latestLocalMigration.version === latestRemoteMigration
          ? null
          : "Use Supabase MCP, `supabase migration list`, or `npm run db:check-sync` with a valid DB URL before deploying.",
    }),
    makeCheck({
      id: "openai-env",
      nodeId: "safety_ai",
      category: "ai",
      label: "OpenAI environment",
      status: process.env.OPENAI_API_KEY?.trim() ? "healthy" : "warning",
      message: process.env.OPENAI_API_KEY?.trim()
        ? "OPENAI_API_KEY is configured for server-side AI workflows."
        : "OPENAI_API_KEY is missing; AI workflows may fail or fall back.",
      evidence: [`OPENAI_API_KEY=${process.env.OPENAI_API_KEY?.trim() ? "present" : "missing"}`],
      recommendedAction: process.env.OPENAI_API_KEY?.trim()
        ? null
        : "Set OPENAI_API_KEY in Vercel production for Safety AI and Gus features.",
    })
  );

  if (options.admin) {
    try {
      const { error } = await options.admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      checks.push(
        makeCheck({
          id: "supabase-auth",
          nodeId: "auth_rbac",
          category: "auth",
          label: "Supabase Auth reachability",
          status: error ? "critical" : "healthy",
          message: error ? `Auth Admin API failed: ${error.message}` : "Auth Admin API responded.",
          evidence: [error ? error.message : "listUsers(page 1, perPage 1) ok"],
          recommendedAction: error
            ? "Verify service role key and Supabase Auth settings for the production project."
            : null,
        })
      );
    } catch (error) {
      checks.push(
        makeCheck({
          id: "supabase-auth",
          nodeId: "auth_rbac",
          category: "auth",
          label: "Supabase Auth reachability",
          status: "critical",
          message: `Auth probe threw: ${error instanceof Error ? error.message : String(error)}`,
          evidence: ["Auth Admin API call threw before returning a Supabase response."],
          recommendedAction: "Verify service role key and Supabase Auth settings for the production project.",
        })
      );
    }

    const buckets = await listBuckets(options.admin);
    const documentsBucket = buckets.buckets.includes("documents");
    checks.push(
      makeCheck({
        id: "supabase-storage",
        nodeId: "storage_documents",
        category: "storage",
        label: "Supabase storage buckets",
        status: buckets.error ? "critical" : documentsBucket ? "healthy" : "critical",
        message: buckets.error
          ? `Storage API failed: ${buckets.error}`
          : documentsBucket
            ? 'Storage API responded and bucket "documents" exists.'
            : 'Storage API responded but bucket "documents" is missing.',
        evidence: buckets.error ? [buckets.error] : [`buckets=${buckets.buckets.join(", ") || "none"}`],
        recommendedAction: buckets.error
          ? "Verify Supabase Storage is enabled and service role access works."
          : documentsBucket
            ? null
            : 'Create or restore the "documents" bucket and validate storage policies.',
      })
    );

    const roleTables = await Promise.all(["user_roles", "company_memberships", "user_profiles"].map((table) => headCount(options.admin!, table)));
    const roleErrors = roleTables
      .map((result, index) => ({ result, table: ["user_roles", "company_memberships", "user_profiles"][index] }))
      .filter((item) => item.result.error);
    checks.push(
      makeCheck({
        id: "auth-rbac-tables",
        nodeId: "auth_rbac",
        category: "auth",
        label: "RBAC and company scope tables",
        status: roleErrors.length > 0 ? "critical" : "healthy",
        message:
          roleErrors.length > 0
            ? "One or more auth/company scope tables could not be read."
            : "RBAC and company membership tables are readable.",
        evidence:
          roleErrors.length > 0
            ? roleErrors.map((item) => `${item.table}: ${item.result.error}`)
            : roleTables.map((item, index) => `${["user_roles", "company_memberships", "user_profiles"][index]}=${item.count}`),
        recommendedAction:
          roleErrors.length > 0
            ? "Apply pending RBAC migrations and verify service role grants/RLS for role tables."
            : null,
      })
    );

    for (const group of CORE_TABLE_GROUPS) {
      const results = await Promise.all(group.tables.map((table) => headCount(options.admin!, table)));
      const failures = results
        .map((result, index) => ({ result, table: group.tables[index] }))
        .filter((item) => item.result.error);
      const empty = results
        .map((result, index) => ({ result, table: group.tables[index] }))
        .filter((item) => !item.result.error && item.result.count === 0);
      checks.push(
        makeCheck({
          id: group.checkId,
          nodeId: group.nodeId,
          category: group.nodeId === "scheduled_jobs" ? "cron" : group.nodeId === "safety_ai" ? "ai" : "workflow",
          label: group.label,
          status: failures.length > 0 ? "critical" : empty.length > 0 ? "warning" : "healthy",
          message:
            failures.length > 0
              ? `${failures.length} required table probe(s) failed.`
              : empty.length > 0
                ? "Tables are reachable, but some are empty in production."
                : "All mapped tables are reachable and have rows.",
          evidence:
            failures.length > 0
              ? failures.map((item) => `${item.table}: ${item.result.error}`)
              : results.map((result, index) => `${group.tables[index]}=${result.count}`),
          recommendedAction:
            failures.length > 0
              ? "Apply missing migrations or update the workflow map if a table was intentionally renamed."
              : empty.length > 0
                ? "Confirm whether empty production tables are expected for this tenant/workflow."
                : null,
        })
      );
    }
  } else {
    checks.push(
      makeCheck({
        id: "supabase-auth",
        nodeId: "auth_rbac",
        category: "auth",
        label: "Supabase Auth reachability",
        status: "critical",
        message: "Skipped because the Supabase admin client is unavailable.",
        evidence: ["admin=null"],
        recommendedAction: "Configure SUPABASE_SERVICE_ROLE_KEY and rerun the audit.",
      }),
      makeCheck({
        id: "supabase-storage",
        nodeId: "storage_documents",
        category: "storage",
        label: "Supabase storage buckets",
        status: "critical",
        message: "Skipped because the Supabase admin client is unavailable.",
        evidence: ["admin=null"],
        recommendedAction: "Configure SUPABASE_SERVICE_ROLE_KEY and rerun the audit.",
      }),
      makeCheck({
        id: "auth-rbac-tables",
        nodeId: "auth_rbac",
        category: "auth",
        label: "RBAC and company scope tables",
        status: "critical",
        message: "Skipped because the Supabase admin client is unavailable.",
        evidence: ["admin=null"],
        recommendedAction: "Configure SUPABASE_SERVICE_ROLE_KEY and rerun the audit.",
      })
    );
  }

  const knownNotes = options.knownAdvisorFindings?.notes ?? [];
  checks.push(
    makeCheck({
      id: "supabase-advisor-known-risk",
      nodeId: "supabase_project",
      category: "security",
      label: "Supabase advisor security/performance findings",
      status:
        (options.knownAdvisorFindings?.securityWarnings ?? 0) > 0 ||
        (options.knownAdvisorFindings?.performanceWarnings ?? 0) > 0 ||
        knownNotes.length > 0
          ? "warning"
          : "unknown",
      message:
        knownNotes.length > 0
          ? "Known Supabase advisor findings need triage."
          : "Supabase advisor output is not directly available from the app runtime.",
      evidence:
        knownNotes.length > 0
          ? knownNotes
          : ["Run Supabase security and performance advisors after every schema/RLS change."],
      recommendedAction:
        "Review Supabase advisors, prioritize SECURITY DEFINER exposure/RLS findings, then add follow-up migrations only after approval.",
    })
  );

  const nodes = buildNodes(checks);
  const edges = buildEdges(checks);
  const summary = summarizeIntegrationChecks(checks);

  return {
    generatedAt,
    sourceOfTruth: "production",
    project: {
      supabaseRef,
      vercelProjectId,
      vercelProjectName,
      vercelOrgId,
      latestLocalMigration: latestLocalMigration?.version ?? null,
      latestRemoteMigration,
    },
    summary,
    nodes,
    edges,
    checks,
    topIssues: sortedIssues(checks).slice(0, 12),
  };
}
