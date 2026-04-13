import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the contractor id if it exists, belongs to the company, and is active; otherwise null.
 */
export async function resolveContractorIdForCompany(
  supabase: SupabaseClient,
  companyId: string,
  contractorId: string | null | undefined
): Promise<string | null> {
  const id = String(contractorId ?? "").trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("company_contractors")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}
