import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCompanyActiveJobsiteCount(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ count: number; error: string | null }> {
  const result = await supabase
    .from("company_jobsites")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .neq("status", "archived");

  if (result.error) {
    return {
      count: 0,
      error: result.error.message ?? "Failed to count active jobsites.",
    };
  }

  return { count: result.count ?? 0, error: null };
}

export async function assertCompanyJobsiteAllowed(params: {
  supabase: SupabaseClient;
  companyId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { supabase, companyId } = params;
  const subResult = await supabase
    .from("company_subscriptions")
    .select("included_jobsite_limit")
    .eq("company_id", companyId)
    .maybeSingle();

  if (subResult.error) {
    return {
      ok: false,
      status: 500,
      error: subResult.error.message ?? "Failed to load company subscription.",
    };
  }

  const limit = (subResult.data as { included_jobsite_limit?: number | null } | null)
    ?.included_jobsite_limit;
  if (limit == null || limit < 1) {
    return { ok: true };
  }

  const current = await getCompanyActiveJobsiteCount(supabase, companyId);
  if (current.error) {
    return { ok: false, status: 500, error: current.error };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      status: 403,
      error: `This company has reached its included active jobsite limit (${limit}). Ask a platform administrator to raise the jobsite limit before adding more active jobsites.`,
    };
  }

  return { ok: true };
}

