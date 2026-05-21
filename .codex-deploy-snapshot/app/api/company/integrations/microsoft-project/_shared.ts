import { NextResponse } from "next/server";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

type MicrosoftAuthContext = {
  supabase: RouteSupabaseClient;
  user: {
    id: string;
    email?: string | null;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
  role: string;
  team?: string | null;
};

type AuthorizedMicrosoftProjectRequest =
  | {
      auth: MicrosoftAuthContext;
      companyScope: {
        companyId: string;
        companyName?: string | null;
      };
    }
  | { error: NextResponse };

type RouteSupabaseResult = {
  data?: unknown;
  error?: { message?: string | null } | null;
};

type RouteSupabaseQuery = PromiseLike<RouteSupabaseResult> & {
  select: (...args: unknown[]) => RouteSupabaseQuery;
  eq: (...args: unknown[]) => RouteSupabaseQuery;
  order: (...args: unknown[]) => RouteSupabaseQuery;
  limit: (...args: unknown[]) => RouteSupabaseQuery;
  maybeSingle: () => Promise<RouteSupabaseResult>;
  single: () => Promise<RouteSupabaseResult>;
  update: (...args: unknown[]) => RouteSupabaseQuery;
};

type RouteSupabaseClient = {
  from: (table: string) => RouteSupabaseQuery;
};

export function isDemoMicrosoftProjectRequest(auth: {
  role: string;
  user: { email?: string | null };
}) {
  return (
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase()
  );
}

export function canManageMicrosoftProjectIntegration(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager"
  );
}

export async function authorizeMicrosoftProjectRequest(
  request: Request,
  options: { requireManage?: boolean } = {}
): Promise<AuthorizedMicrosoftProjectRequest> {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_manage_company_users", "can_view_all_company_data", "can_view_analytics"],
  });
  if (auth.error) return { error: auth.error };

  if (options.requireManage && !canManageMicrosoftProjectIntegration(auth.role)) {
    return {
      error: NextResponse.json({ error: "Only company admins and managers can manage Microsoft Project sync." }, { status: 403 }),
    };
  }

  const scopedAuth = auth as unknown as MicrosoftAuthContext;

  if (isDemoMicrosoftProjectRequest(scopedAuth)) {
    return { auth: scopedAuth, companyScope: { companyId: "demo-company", companyName: "Demo Company" } };
  }

  const companyScope = await getCompanyScope({
    supabase: scopedAuth.supabase,
    userId: scopedAuth.user.id,
    fallbackTeam: scopedAuth.team,
    authUser: scopedAuth.user,
  });
  if (!companyScope.companyId) {
    return { error: NextResponse.json({ error: "No company workspace." }, { status: 400 }) };
  }

  const block = await blockIfCsepOnlyCompany(scopedAuth.supabase, companyScope.companyId);
  if (block) return { error: block };

  return { auth: scopedAuth, companyScope };
}

export const demoMicrosoftProjectStatus = {
  configured: {
    clientId: true,
    clientSecret: true,
    redirectUri: true,
    tokenEncryptionKey: true,
    configured: true,
  },
  connected: true,
  connection: {
    id: "demo-microsoft-project",
    status: "connected",
    displayName: "Microsoft Project Demo",
    accountEmail: "planner.demo@example.com",
    dataverseEnvironmentUrl: "https://demo.crm.dynamics.com",
    lastSyncAt: new Date().toISOString(),
  },
  latestRun: {
    id: "demo-sync-run",
    status: "succeeded",
    projects_imported: 2,
    tasks_imported: 8,
    assignments_imported: 4,
    finished_at: new Date().toISOString(),
  },
  counts: {
    projects: 2,
    tasks: 8,
  },
};

export const demoMicrosoftProjectRows = {
  projects: [
    {
      id: "demo-source-1",
      name: "Candler Court Structural Steel",
      jobsite_number: "MSP-1001",
      project_number: "MSP-1001",
      status: "active",
      start_date: "2026-05-11",
      end_date: "2026-06-19",
      owner_name: "Jordan Lee",
      owner_email: "jordan@example.com",
      jobsite_id: "demo-jobsite-1",
      last_seen_at: new Date().toISOString(),
    },
    {
      id: "demo-source-2",
      name: "North Dock Fit-Out",
      jobsite_number: "MSP-1002",
      project_number: "MSP-1002",
      status: "planned",
      start_date: "2026-06-01",
      end_date: "2026-07-03",
      owner_name: "Riley Grant",
      owner_email: "riley@example.com",
      jobsite_id: "demo-jobsite-2",
      last_seen_at: new Date().toISOString(),
    },
  ],
  tasks: [
    {
      id: "demo-task-1",
      project_source_id: "demo-source-1",
      title: "Level 8 edge protection setup",
      status: "in_progress",
      percent_complete: 40,
      due_at: "2026-05-14T14:00:00.000Z",
    },
    {
      id: "demo-task-2",
      project_source_id: "demo-source-1",
      title: "Hot work prep and fire watch coverage",
      status: "not_started",
      percent_complete: 0,
      due_at: "2026-05-15T14:00:00.000Z",
    },
  ],
};
