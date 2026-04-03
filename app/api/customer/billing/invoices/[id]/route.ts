import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
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
    return NextResponse.json({ error: "No company workspace." }, { status: 403 });
  }

  const { id } = await context.params;

  const { data: invoice, error } = await auth.supabase
    .from("billing_invoices")
    .select("*, billing_invoice_line_items(*), billing_customers(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invoice || invoice.company_id !== companyScope.companyId) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const { data: payments } = await auth.supabase
    .from("billing_invoice_payments")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    invoice,
    payments: payments ?? [],
  });
}
