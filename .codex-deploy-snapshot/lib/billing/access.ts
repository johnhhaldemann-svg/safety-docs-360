import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCrossWorkspaceAdminRole,
  normalizeAppRole,
  type AppRole,
} from "@/lib/rbac";

export class BillingAccessError extends Error {
  constructor(
    message: string,
    public status = 403
  ) {
    super(message);
    this.name = "BillingAccessError";
  }
}

export function isInternalBillingStaffRole(role: string | null | undefined): boolean {
  const r = normalizeAppRole(role);
  return r === "super_admin" || r === "platform_admin" || r === "admin";
}

/**
 * Super/platform: all companies. Admin: must have row in billing_staff_company_assignments.
 */
export async function assertStaffCanAccessCompany(
  supabase: SupabaseClient,
  params: { staffUserId: string; staffRole: string; companyId: string }
): Promise<void> {
  if (isCrossWorkspaceAdminRole(params.staffRole)) {
    return;
  }

  if (normalizeAppRole(params.staffRole) !== "admin") {
    throw new BillingAccessError("Billing staff access required.", 403);
  }

  const { data, error } = await supabase
    .from("billing_staff_company_assignments")
    .select("id")
    .eq("staff_user_id", params.staffUserId)
    .eq("company_id", params.companyId)
    .maybeSingle();

  if (error) {
    throw new BillingAccessError(error.message || "Assignment lookup failed.", 500);
  }

  if (!data) {
    throw new BillingAccessError(
      "You are not assigned to manage billing for this company.",
      403
    );
  }
}

export function assertInvoiceMutableForEdit(params: {
  status: string;
  role: AppRole;
}): void {
  const s = params.status.toLowerCase();
  if (s === "paid" || s === "void" || s === "cancelled") {
    if (!isCrossWorkspaceAdminRole(params.role)) {
      throw new BillingAccessError("This invoice cannot be edited.", 409);
    }
  }
}
