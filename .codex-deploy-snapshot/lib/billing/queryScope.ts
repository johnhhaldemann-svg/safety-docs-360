import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCrossWorkspaceAdminRole,
  normalizeAppRole,
} from "@/lib/rbac";

export type BillableCompanyScope = { mode: "all" } | { mode: "list"; companyIds: string[] };

export async function getBillableCompanyScope(
  supabase: SupabaseClient,
  params: { staffUserId: string; staffRole: string }
): Promise<BillableCompanyScope> {
  if (isCrossWorkspaceAdminRole(params.staffRole)) {
    return { mode: "all" };
  }

  if (normalizeAppRole(params.staffRole) !== "admin") {
    return { mode: "list", companyIds: [] };
  }

  const { data, error } = await supabase
    .from("billing_staff_company_assignments")
    .select("company_id")
    .eq("staff_user_id", params.staffUserId);

  if (error) {
    throw new Error(error.message);
  }

  const companyIds = (data ?? [])
    .map((row: { company_id?: string }) => row.company_id)
    .filter((id): id is string => Boolean(id));

  return { mode: "list", companyIds };
}
