import { NextResponse } from "next/server";
import { CSEP_PLAN_NAME } from "@/lib/workspaceProduct";

export function csepWorkspaceForbiddenResponse() {
  return NextResponse.json(
    {
      error:
        "This workspace is limited to CSEP. This feature is not available on your current workspace product.",
    },
    { status: 403 }
  );
}

type SubscriptionRow = { plan_name?: string | null };

/** Resolve whether the company's subscription is the CSEP-only tier. */
export async function companyHasCsepPlanName(
  supabase: unknown,
  companyId: string
): Promise<boolean> {
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: SubscriptionRow | null;
            error: { message?: string | null } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await client
    .from("company_subscriptions")
    .select("plan_name")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return ((data as SubscriptionRow).plan_name ?? "").trim() === CSEP_PLAN_NAME;
}

/**
 * Block full-product company module APIs for CSEP-only workspaces (plan_name = CSEP).
 * Do not use on routes that must stay available for CSEP (e.g. gc-program-document).
 */
export async function blockIfCsepOnlyCompany(
  supabase: unknown,
  companyId: string | null | undefined
): Promise<NextResponse | null> {
  if (!companyId) {
    return null;
  }
  if (await companyHasCsepPlanName(supabase, companyId)) {
    return csepWorkspaceForbiddenResponse();
  }
  return null;
}
