import { isAdminRole, normalizeAppRole } from "@/lib/rbac";

type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

type JobsiteAccessScope = {
  restricted: boolean;
  jobsiteIds: string[];
};

function hasCompanyWideJobsiteAccess(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager"
  );
}

export async function getJobsiteAccessScope(params: {
  supabase: SupabaseLikeClient;
  userId: string;
  companyId: string;
  role?: string | null;
}) {
  if (hasCompanyWideJobsiteAccess(params.role)) {
    return { restricted: false, jobsiteIds: [] } satisfies JobsiteAccessScope;
  }

  const result = await (
    params.supabase.from("company_jobsite_assignments") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => PromiseLike<{
            data: unknown;
            error: { message?: string | null } | null;
          }>;
        };
      };
    }
  )
    .select("jobsite_id")
    .eq("user_id", params.userId)
    .eq("company_id", params.companyId);

  if (result.error) {
    return { restricted: true, jobsiteIds: [] } satisfies JobsiteAccessScope;
  }

  const jobsiteIds = ((result.data as Array<{ jobsite_id?: string | null }> | null) ?? [])
    .map((row) => row.jobsite_id ?? "")
    .filter(Boolean);

  return {
    restricted: true,
    jobsiteIds,
  } satisfies JobsiteAccessScope;
}

export function isJobsiteAllowed(jobsiteId: string | null, scope: JobsiteAccessScope) {
  if (!scope.restricted) return true;
  if (!jobsiteId) return false;
  return scope.jobsiteIds.includes(jobsiteId);
}
