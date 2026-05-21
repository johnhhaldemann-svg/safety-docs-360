import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_billing",
      "can_view_dashboards",
      "can_view_analytics",
      "can_create_documents",
    ],
  });
  if ("error" in auth) {
    return auth.error;
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({ invoices: [] });
  }

  const { data, error } = await auth.supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, balance_due_cents, currency, created_at, billing_customers(company_name, billing_email)"
    )
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data ?? [] });
}
