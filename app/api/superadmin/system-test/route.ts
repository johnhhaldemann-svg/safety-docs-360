import { NextResponse } from "next/server";
import { getAgreementConfig } from "@/lib/legalSettings";
import { authorizeRequest } from "@/lib/rbac";
import {
  createSupabaseAdminClient,
  getSupabaseServerEnvStatus,
} from "@/lib/supabaseAdmin";
import { serverLog } from "@/lib/serverLog";

export const runtime = "nodejs";

type CheckStatus = "green" | "yellow" | "red";

type SystemTestCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  metric?: string;
};

type CompanyProbeRow = {
  id: string;
  name: string | null;
  status: string | null;
  created_at: string | null;
};

type QueryError = {
  message?: string | null;
};

type QueryResult<T = unknown> = {
  data: T;
  error: QueryError | null;
  count?: number | null;
};

type CountQueryBuilder = PromiseLike<QueryResult> & {
  eq(column: string, value: string): CountQueryBuilder;
  not(column: string, operator: string, value: null | string | number | boolean): CountQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): CountQueryBuilder;
  limit(count: number): Promise<QueryResult>;
};

type SelectQueryBuilder = CountQueryBuilder & {
  select(
    columns: string,
    options?: { count?: "exact"; head?: boolean }
  ): CountQueryBuilder;
};

type ReadableSystemTestClient = {
  from(table: string): SelectQueryBuilder;
  rpc(fn: string, args?: Record<string, unknown>): Promise<QueryResult>;
};

type AdminSystemTestClient = ReadableSystemTestClient & {
  auth: {
    admin: {
      listUsers(): Promise<QueryResult<{ users: Array<{ id: string }> }>>;
    };
  };
};

function addCheck(
  checks: SystemTestCheck[],
  check: SystemTestCheck
) {
  checks.push(check);
}

function summarize(checks: SystemTestCheck[]) {
  return checks.reduce(
    (acc, check) => {
      acc.total += 1;
      acc[check.status] += 1;
      return acc;
    },
    { total: 0, green: 0, yellow: 0, red: 0 }
  );
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function runCountQuery(
  client: ReadableSystemTestClient,
  table: string,
  filter?: (query: CountQueryBuilder) => CountQueryBuilder
) {
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (filter) {
    query = filter(query);
  }
  const { count, error } = await query;
  return {
    count: count ?? 0,
    error: error ?? null,
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (auth.role !== "super_admin") {
    return NextResponse.json(
      { error: "Super admin access required." },
      { status: 403 }
    );
  }

  const adminClient = createSupabaseAdminClient() as AdminSystemTestClient | null;
  const dbClient = (adminClient ?? auth.supabase) as unknown as ReadableSystemTestClient;
  const envStatus = getSupabaseServerEnvStatus();
  const checks: SystemTestCheck[] = [];
  const usesServiceRole = Boolean(adminClient);

  addCheck(checks, {
    id: "super-admin-session",
    label: "Super admin session",
    status: "green",
    detail: `Authenticated as ${auth.user.email ?? auth.user.id}.`,
    metric: auth.role,
  });

  const missingEnv: string[] = [];
  if (!envStatus.url) missingEnv.push("Supabase URL");
  if (!envStatus.anonKey) missingEnv.push("Anon key");
  if (!envStatus.serviceRoleKey) missingEnv.push("Service role key");

  addCheck(checks, {
    id: "runtime-env",
    label: "Runtime environment",
    status: missingEnv.length === 0 ? "green" : "red",
    detail:
      missingEnv.length === 0
        ? `All required Supabase env vars are available (${envStatus.sources.url ?? "url"}, ${envStatus.sources.anonKey ?? "anon"}, ${envStatus.sources.serviceRoleKey ?? "service"}).`
        : `Missing: ${missingEnv.join(", ")}.`,
    metric: usesServiceRole ? "service role" : "fallback mode",
  });

  try {
    const agreementConfig = await getAgreementConfig(dbClient);
    addCheck(checks, {
      id: "agreement-config",
      label: "Agreement settings",
      status: "green",
      detail: `Loaded version ${agreementConfig.version} with current legal copy.`,
      metric: agreementConfig.version,
    });
  } catch (error) {
    serverLog("error", "system_test_agreement_config_failed", {
      message: error instanceof Error ? error.message : String(error),
      userId: auth.user.id,
    });
    addCheck(checks, {
      id: "agreement-config",
      label: "Agreement settings",
      status: "yellow",
      detail: "Fell back to default agreement copy because the stored settings could not be loaded.",
      metric: "default",
    });
  }

  const companiesProbePromise = dbClient
    .from("companies")
    .select("id, name, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(1);
  const pendingRequestsPromise = runCountQuery(dbClient, "company_signup_requests", (query) =>
    query.eq("status", "pending")
  );
  const membershipsPromise = runCountQuery(dbClient, "company_memberships");
  const roleAssignmentsPromise = runCountQuery(dbClient, "user_roles", (query) =>
    query.not("company_id", "is", null)
  );
  const submittedDocsPromise = runCountQuery(dbClient, "documents", (query) =>
    query.eq("status", "submitted")
  );
  const approvedDocsPromise = runCountQuery(dbClient, "documents", (query) =>
    query.eq("status", "approved")
  );
  const archivedDocsPromise = runCountQuery(dbClient, "documents", (query) =>
    query.eq("status", "archived")
  );
  const archivedCompaniesPromise = runCountQuery(dbClient, "companies", (query) =>
    query.eq("status", "archived")
  );
  const creditLedgerPromise = runCountQuery(dbClient, "credit_transactions");

  const usersDirectoryPromise = adminClient
    ? adminClient.auth.admin.listUsers()
    : dbClient.rpc("admin_list_workspace_users");

  const [companiesProbe, pendingRequests, memberships, roleAssignments, submittedDocs, approvedDocs, archivedDocs, archivedCompanies, creditLedger, usersDirectory] =
    await Promise.all([
      companiesProbePromise,
      pendingRequestsPromise,
      membershipsPromise,
      roleAssignmentsPromise,
      submittedDocsPromise,
      approvedDocsPromise,
      archivedDocsPromise,
      archivedCompaniesPromise,
      creditLedgerPromise,
      usersDirectoryPromise,
    ]);

  if (companiesProbe.error) {
    addCheck(checks, {
      id: "company-directory",
      label: "Company directory",
      status: "red",
      detail: companiesProbe.error.message ?? "Failed to read company records.",
    });
  } else {
    addCheck(checks, {
      id: "company-directory",
      label: "Company directory",
      status: "green",
      detail: countLabel(companiesProbe.count ?? 0, "company workspace"),
      metric: String(companiesProbe.count ?? 0),
    });
  }

  if ("error" in usersDirectory && usersDirectory.error) {
    addCheck(checks, {
      id: "user-directory",
      label: "User directory",
      status: "red",
      detail: usersDirectory.error.message ?? "Failed to read workspace users.",
    });
  } else {
    const userCount = adminClient
      ? ((usersDirectory.data as { users: Array<{ id: string }> }).users ?? []).length
      : Array.isArray(usersDirectory.data)
        ? usersDirectory.data.length
        : 0;

    addCheck(checks, {
      id: "user-directory",
      label: "User directory",
      status: "green",
      detail: usesServiceRole
        ? countLabel(userCount, "account")
        : `RPC fallback reached with ${userCount} account${userCount === 1 ? "" : "s"}.`,
      metric: String(userCount),
    });
  }

  addCheck(checks, {
    id: "pending-requests",
    label: "Pending company requests",
    status: pendingRequests.error ? "red" : "green",
    detail: pendingRequests.error
      ? pendingRequests.error.message ?? "Failed to read pending company requests."
      : countLabel(pendingRequests.count, "request"),
    metric: pendingRequests.error ? undefined : String(pendingRequests.count),
  });

  addCheck(checks, {
    id: "company-memberships",
    label: "Company memberships",
    status: memberships.error ? "red" : "green",
    detail: memberships.error
      ? memberships.error.message ?? "Failed to read membership records."
      : countLabel(memberships.count, "membership"),
    metric: memberships.error ? undefined : String(memberships.count),
  });

  addCheck(checks, {
    id: "role-assignments",
    label: "Company assignment path",
    status: roleAssignments.error ? "red" : "green",
    detail: roleAssignments.error
      ? roleAssignments.error.message ?? "Failed to read assigned company users."
      : countLabel(roleAssignments.count, "assigned user"),
    metric: roleAssignments.error ? undefined : String(roleAssignments.count),
  });

  addCheck(checks, {
    id: "documents-submitted",
    label: "Documents in review",
    status: submittedDocs.error ? "red" : "green",
    detail: submittedDocs.error
      ? submittedDocs.error.message ?? "Failed to read submitted documents."
      : countLabel(submittedDocs.count, "document"),
    metric: submittedDocs.error ? undefined : String(submittedDocs.count),
  });

  addCheck(checks, {
    id: "documents-approved",
    label: "Approved documents",
    status: approvedDocs.error ? "red" : "green",
    detail: approvedDocs.error
      ? approvedDocs.error.message ?? "Failed to read approved documents."
      : countLabel(approvedDocs.count, "document"),
    metric: approvedDocs.error ? undefined : String(approvedDocs.count),
  });

  addCheck(checks, {
    id: "documents-archived",
    label: "Archived documents",
    status: archivedDocs.error ? "red" : "green",
    detail: archivedDocs.error
      ? archivedDocs.error.message ?? "Failed to read archived documents."
      : countLabel(archivedDocs.count, "archived document"),
    metric: archivedDocs.error ? undefined : String(archivedDocs.count),
  });

  addCheck(checks, {
    id: "archived-companies",
    label: "Archived companies",
    status: archivedCompanies.error ? "red" : "green",
    detail: archivedCompanies.error
      ? archivedCompanies.error.message ?? "Failed to read archived companies."
      : countLabel(archivedCompanies.count, "archived workspace"),
    metric: archivedCompanies.error ? undefined : String(archivedCompanies.count),
  });

  addCheck(checks, {
    id: "credit-ledger",
    label: "Credit ledger",
    status: creditLedger.error ? "red" : "green",
    detail: creditLedger.error
      ? creditLedger.error.message ?? "Failed to read credit transactions."
      : countLabel(creditLedger.count, "ledger entry"),
    metric: creditLedger.error ? undefined : String(creditLedger.count),
  });

  const newestCompany = ((companiesProbe.data as CompanyProbeRow[] | null) ?? [])[0] ?? null;

  if (!newestCompany?.id) {
    addCheck(checks, {
      id: "company-probe",
      label: "Company detail probe",
      status: "yellow",
      detail: "No company workspace exists yet to probe end-to-end.",
    });
  } else {
    const [members, invites, docs] = await Promise.all([
      runCountQuery(dbClient, "company_memberships", (query) =>
        query.eq("company_id", newestCompany.id)
      ),
      runCountQuery(dbClient, "company_invites", (query) =>
        query.eq("company_id", newestCompany.id)
      ),
      runCountQuery(dbClient, "documents", (query) =>
        query.eq("company_id", newestCompany.id)
      ),
    ]);

    const probeErrors = [members.error, invites.error, docs.error].filter(Boolean);

    if (probeErrors.length > 0) {
      addCheck(checks, {
        id: "company-probe",
        label: "Company detail probe",
        status: "red",
        detail:
          probeErrors[0]?.message ??
          "One or more company-detail relationships could not be read.",
      });
    } else {
      addCheck(checks, {
        id: "company-probe",
        label: "Company detail probe",
        status: "green",
        detail: `${newestCompany.name ?? "Latest company"}: ${members.count} members, ${invites.count} invites, ${docs.count} documents.`,
        metric: newestCompany.status ?? "active",
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  const summary = summarize(checks);

  const body = {
    ranAt: new Date(startedAt).toISOString(),
    durationMs,
    mode: usesServiceRole ? ("service_role" as const) : ("fallback" as const),
    environment: envStatus,
    summary,
    checks,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
