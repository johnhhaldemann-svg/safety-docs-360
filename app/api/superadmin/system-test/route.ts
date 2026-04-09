import { NextResponse } from "next/server";
import { getUserAgreementRecord } from "@/lib/legal";
import { getAgreementConfig } from "@/lib/legalSettings";
import { authorizeRequest, getUserRoleContext } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
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

type SelectedUserRecord = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  companyId: string | null;
  companyName: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown> | null;
  app_metadata: Record<string, unknown> | null;
};

type RoleRow = {
  user_id: string;
  role: string | null;
  team: string | null;
  company_id: string | null;
  account_status: string | null;
};

type MembershipRow = {
  user_id: string;
  company_id: string | null;
  role: string | null;
  status: string | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
  status: string | null;
  team_key: string | null;
  primary_contact_email: string | null;
  primary_contact_name: string | null;
  archived_at: string | null;
  restored_at: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  job_title: string | null;
  readiness_status: string | null;
  profile_complete: boolean | null;
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
      listUsers(): Promise<
        QueryResult<{
          users: Array<{
            id: string;
            email?: string | null;
            created_at?: string | null;
            last_sign_in_at?: string | null;
            email_confirmed_at?: string | null;
            user_metadata?: Record<string, unknown> | null;
            app_metadata?: Record<string, unknown> | null;
          }>;
        }>
      >;
    };
  };
};

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return metadataName.trim() || user.email?.split("@")[0] || "Unnamed User";
}

function getTeam(user: {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadataTeam =
    typeof user.app_metadata?.team === "string"
      ? user.app_metadata.team
      : typeof user.user_metadata?.team === "string"
        ? user.user_metadata.team
        : "";

  return metadataTeam.trim() || "General";
}

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

async function resolveSelectedUser(params: {
  adminClient: AdminSystemTestClient | null;
  dbClient: ReadableSystemTestClient;
  currentUserId: string;
  targetUserId: string;
}): Promise<SelectedUserRecord | null> {
  const { adminClient, dbClient, currentUserId, targetUserId } = params;
  const effectiveTargetUserId = targetUserId || currentUserId;

  if (adminClient) {
    const { data, error } = await adminClient.auth.admin.listUsers();

    if (!error) {
      const rawUser = (data.users ?? []).find((user) => user.id === effectiveTargetUserId) ?? null;

      if (rawUser) {
        const roleContext = await getUserRoleContext({
          supabase: adminClient,
          user: {
            ...rawUser,
            app_metadata: rawUser.app_metadata ?? undefined,
            user_metadata: rawUser.user_metadata ?? undefined,
          },
        });
        const companyScope = await getCompanyScope({
          supabase: adminClient,
          userId: rawUser.id,
          fallbackTeam: roleContext.team,
          authUser: {
            app_metadata: rawUser.app_metadata ?? undefined,
            user_metadata: rawUser.user_metadata ?? undefined,
          },
        });

        return {
          id: rawUser.id,
          email: rawUser.email ?? "",
          name: getDisplayName(rawUser),
          role: roleContext.role,
          team: roleContext.team || getTeam(rawUser),
          status: roleContext.accountStatus,
          companyId: companyScope.companyId,
          companyName: companyScope.companyName,
          created_at: rawUser.created_at ?? null,
          last_sign_in_at: rawUser.last_sign_in_at ?? null,
          email_confirmed_at: rawUser.email_confirmed_at ?? null,
          user_metadata: rawUser.user_metadata ?? null,
          app_metadata: rawUser.app_metadata ?? null,
        };
      }
    }
  }

  const { data, error } = await dbClient.rpc("admin_list_workspace_users");

  if (error) {
    return null;
  }

  const row = ((data as Array<{
    id: string;
    email: string | null;
    name: string | null;
    role: string | null;
    team: string | null;
    status: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
  }> | null) ?? []).find((user) => user.id === effectiveTargetUserId) ?? null;

  if (!row) {
    return null;
  }

  const selectedUserCompanyScope = await getCompanyScope({
    supabase: dbClient,
    userId: row.id,
    fallbackTeam: row.team,
  });

  return {
    id: row.id,
    email: row.email ?? "",
    name: row.name?.trim() || (row.email ? row.email.split("@")[0] : "Unnamed User"),
    role: row.role ?? "company_user",
    team: row.team?.trim() || "General",
    status: row.status ?? "Active",
    companyId: selectedUserCompanyScope.companyId,
    companyName: selectedUserCompanyScope.companyName,
    created_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at,
    email_confirmed_at: row.email_confirmed_at,
    user_metadata: null,
    app_metadata: null,
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

  let loadedAgreementVersion = "";
  try {
    const agreementConfig = await getAgreementConfig(dbClient);
    loadedAgreementVersion = agreementConfig.version;
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

  const targetUserId = new URL(request.url).searchParams.get("userId")?.trim() || auth.user.id;
  const selectedUserPromise = resolveSelectedUser({
    adminClient,
    dbClient,
    currentUserId: auth.user.id,
    targetUserId,
  });

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

  const [
    selectedUser,
    companiesProbe,
    pendingRequests,
    memberships,
    roleAssignments,
    submittedDocs,
    approvedDocs,
    archivedDocs,
    archivedCompanies,
    creditLedger,
    usersDirectory,
  ] =
    await Promise.all([
      selectedUserPromise,
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

  if (!selectedUser) {
    return NextResponse.json(
      { error: "Selected user could not be found." },
      { status: 404 }
    );
  }

  addCheck(checks, {
    id: "selected-user",
    label: "Selected user",
    status: "green",
    detail: `Testing ${selectedUser.name} (${selectedUser.email || selectedUser.id}) in ${selectedUser.companyName || "General"} scope.`,
    metric: selectedUser.role,
  });

  const selectedUserAgreement = await getUserAgreementRecord(
    dbClient,
    selectedUser.id,
    selectedUser.user_metadata ?? undefined
  );

  if (selectedUserAgreement.error) {
    addCheck(checks, {
      id: "selected-user-agreement",
      label: "Selected user agreement",
      status: "red",
      detail:
        selectedUserAgreement.error.message ??
        "Failed to read the selected user's agreement state.",
    });
  } else {
    const selectedUserAccepted =
      Boolean(loadedAgreementVersion) &&
      Boolean(selectedUserAgreement.data?.accepted_terms) &&
      (selectedUserAgreement.data?.terms_version ?? "") === loadedAgreementVersion;
    addCheck(checks, {
      id: "selected-user-agreement",
      label: "Selected user agreement",
      status: loadedAgreementVersion ? (selectedUserAccepted ? "green" : "yellow") : "yellow",
      detail: loadedAgreementVersion
        ? selectedUserAccepted
          ? `Accepted terms version ${selectedUserAgreement.data?.terms_version ?? "current"}.`
          : "The selected user still needs to accept the current agreement version."
        : "Agreement settings could not be loaded, so acceptance was checked against the fallback state.",
      metric: selectedUserAgreement.data?.terms_version ?? "missing",
    });
  }

  const [selectedUserRoleRow, selectedUserMembershipRow, selectedUserCompanyRow, selectedUserProfileRow] =
    await Promise.all([
      auth.supabase
        .from("user_roles")
        .select("user_id, role, team, company_id, account_status")
        .eq("user_id", selectedUser.id)
        .maybeSingle(),
      auth.supabase
        .from("company_memberships")
        .select("user_id, company_id, role, status")
        .eq("user_id", selectedUser.id)
        .maybeSingle(),
      selectedUser.companyId
        ? auth.supabase
            .from("companies")
            .select(
              "id, name, status, team_key, primary_contact_email, primary_contact_name, archived_at, restored_at"
            )
            .eq("id", selectedUser.companyId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      auth.supabase
        .from("user_profiles")
        .select("user_id, full_name, preferred_name, job_title, readiness_status, profile_complete")
        .eq("user_id", selectedUser.id)
        .maybeSingle(),
    ]);

  if (selectedUserRoleRow.error || !selectedUserRoleRow.data) {
    addCheck(checks, {
      id: "selected-user-role-row",
      label: "Selected user role row",
      status: "red",
      detail:
        selectedUserRoleRow.error?.message ??
        "The selected user has no role row in user_roles.",
    });
  } else {
    const roleRow = selectedUserRoleRow.data as RoleRow;
    const roleMatches = (roleRow.role ?? "").trim() === selectedUser.role;
    const companyMatches = (roleRow.company_id ?? null) === selectedUser.companyId;

    addCheck(checks, {
      id: "selected-user-role-row",
      label: "Selected user role row",
      status: roleMatches && companyMatches ? "green" : "yellow",
      detail: roleMatches && companyMatches
        ? `Role ${roleRow.role ?? "unknown"} points at the same company scope as the directory record.`
        : "The user role row and the directory record do not fully match yet.",
      metric: `${roleRow.role ?? "unknown"} / ${roleRow.account_status ?? "unknown"}`,
    });
  }

  if (selectedUserMembershipRow.error) {
    addCheck(checks, {
      id: "selected-user-membership-row",
      label: "Selected user membership",
      status: "red",
      detail:
        selectedUserMembershipRow.error.message ??
        "Failed to read the selected user's company membership.",
    });
  } else if (!selectedUserMembershipRow.data) {
    addCheck(checks, {
      id: "selected-user-membership-row",
      label: "Selected user membership",
      status: selectedUser.companyId ? "red" : "yellow",
      detail: selectedUser.companyId
        ? "The user is attached to a company in the directory but no membership row exists."
        : "No company membership row exists, which is expected for internal-only users.",
      metric: "missing",
    });
  } else {
    const membershipRow = selectedUserMembershipRow.data as MembershipRow;
    const membershipMatches =
      (membershipRow.company_id ?? null) === selectedUser.companyId &&
      (membershipRow.role ?? "").trim() === selectedUser.role;

    addCheck(checks, {
      id: "selected-user-membership-row",
      label: "Selected user membership",
      status: membershipMatches ? "green" : "yellow",
      detail: membershipMatches
        ? "Membership matches the selected user's company assignment."
        : "The membership row differs from the selected user's directory state.",
      metric: `${membershipRow.role ?? "unknown"} / ${membershipRow.status ?? "unknown"}`,
    });
  }

  if (selectedUser.companyId) {
    if (selectedUserCompanyRow.error) {
      addCheck(checks, {
        id: "selected-user-company-row",
        label: "Selected user company",
        status: "red",
        detail:
          selectedUserCompanyRow.error.message ??
          "Failed to read the selected user's company record.",
      });
    } else if (!selectedUserCompanyRow.data) {
      addCheck(checks, {
        id: "selected-user-company-row",
        label: "Selected user company",
        status: "red",
        detail: "The selected user's company workspace could not be found.",
        metric: "missing",
      });
    } else {
      const companyRow = selectedUserCompanyRow.data as CompanyRow;
      const companyStatus = (companyRow.status ?? "active").trim().toLowerCase();
      addCheck(checks, {
        id: "selected-user-company-row",
        label: "Selected user company",
        status: companyStatus === "archived" ? "yellow" : "green",
        detail:
          companyStatus === "archived"
            ? "The company exists but is archived."
            : "The selected user's company workspace is active and readable.",
        metric: companyStatus,
      });
    }
  } else {
    addCheck(checks, {
      id: "selected-user-company-row",
      label: "Selected user company",
      status: "yellow",
      detail: "The selected user is not assigned to a company workspace yet.",
      metric: "unassigned",
    });
  }

  if (selectedUserProfileRow.error) {
    addCheck(checks, {
      id: "selected-user-profile-row",
      label: "Selected user profile",
      status: "yellow",
      detail:
        selectedUserProfileRow.error.message ??
        "The selected user's profile row could not be read.",
    });
  } else if (!selectedUserProfileRow.data) {
    addCheck(checks, {
      id: "selected-user-profile-row",
      label: "Selected user profile",
      status: "yellow",
      detail: "No profile row exists yet for the selected user.",
      metric: "missing",
    });
  } else {
    const profileRow = selectedUserProfileRow.data as ProfileRow;
    const profileComplete = Boolean(profileRow.profile_complete);
    const hasCoreProfile = Boolean(profileRow.full_name?.trim() || profileRow.job_title?.trim());

    addCheck(checks, {
      id: "selected-user-profile-row",
      label: "Selected user profile",
      status: profileComplete && hasCoreProfile ? "green" : "yellow",
      detail: profileComplete && hasCoreProfile
        ? "The profile row is complete and ready."
        : "The profile row exists, but it is not yet marked complete.",
      metric: profileComplete ? "complete" : "incomplete",
    });
  }

  const metadataCompanyId =
    typeof selectedUser.app_metadata?.company_id === "string"
      ? selectedUser.app_metadata.company_id.trim()
      : typeof selectedUser.user_metadata?.company_id === "string"
        ? selectedUser.user_metadata.company_id.trim()
        : "";
  const metadataRole =
    typeof selectedUser.app_metadata?.role === "string"
      ? selectedUser.app_metadata.role.trim()
      : typeof selectedUser.user_metadata?.role === "string"
        ? selectedUser.user_metadata.role.trim()
        : "";
  const metadataTeam =
    typeof selectedUser.app_metadata?.team === "string"
      ? selectedUser.app_metadata.team.trim()
      : typeof selectedUser.user_metadata?.team === "string"
        ? selectedUser.user_metadata.team.trim()
        : "";

  const metadataCompanyMatches =
    !selectedUser.companyId || metadataCompanyId === selectedUser.companyId;
  const metadataRoleMatches =
    !metadataRole || metadataRole === selectedUser.role;
  const metadataTeamMatches =
    !metadataTeam || metadataTeam === selectedUser.team;

  addCheck(checks, {
    id: "selected-user-metadata-sync",
    label: "Selected user metadata sync",
    status:
      metadataCompanyMatches && metadataRoleMatches && metadataTeamMatches ? "green" : "yellow",
    detail:
      metadataCompanyMatches && metadataRoleMatches && metadataTeamMatches
        ? "Auth metadata matches the selected user directory state."
        : "The auth metadata and the directory record are not fully aligned yet.",
    metric: selectedUser.companyId ? selectedUser.companyId : "no company metadata",
  });

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

  if (!selectedUser.companyId) {
    addCheck(checks, {
      id: "company-probe",
      label: "Company detail probe",
      status: "yellow",
      detail: "The selected user is not attached to a company workspace yet.",
    });
  } else {
    const [members, invites, docs] = await Promise.all([
      runCountQuery(dbClient, "company_memberships", (query) =>
        query.eq("company_id", selectedUser.companyId as string)
      ),
      runCountQuery(dbClient, "company_invites", (query) =>
        query.eq("company_id", selectedUser.companyId as string)
      ),
      runCountQuery(dbClient, "documents", (query) =>
        query.eq("company_id", selectedUser.companyId as string)
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
        detail: `${selectedUser.companyName ?? "Selected company"}: ${members.count} members, ${invites.count} invites, ${docs.count} documents.`,
        metric: selectedUser.status || "active",
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
    targetUser: {
      id: selectedUser.id,
      email: selectedUser.email,
      name: selectedUser.name,
      role: selectedUser.role,
      team: selectedUser.team,
      status: selectedUser.status,
      companyId: selectedUser.companyId,
      companyName: selectedUser.companyName,
    },
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
