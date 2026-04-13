import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns crew id when it belongs to the company, is active, and is compatible with the facet jobsite:
 * jobsite-specific crews must match the facet's jobsite when the facet has one; otherwise allowed.
 */
export async function resolveCrewIdForCompany(
  supabase: SupabaseClient,
  companyId: string,
  facetJobsiteId: string | null | undefined,
  crewId: string | null | undefined
): Promise<string | null> {
  const id = String(crewId ?? "").trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("company_crews")
    .select("id, jobsite_id")
    .eq("company_id", companyId)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error || !data?.id) return null;
  const crewSite = (data as { jobsite_id?: string | null }).jobsite_id ?? null;
  if (crewSite && facetJobsiteId && crewSite !== facetJobsiteId) return null;
  return String(data.id);
}
