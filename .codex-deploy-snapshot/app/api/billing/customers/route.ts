import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  assertStaffCanAccessCompany,
  BillingAccessError,
  isInternalBillingStaffRole,
} from "@/lib/billing/access";
import { getBillableCompanyScope } from "@/lib/billing/queryScope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
  });
  if ("error" in auth) {
    return auth.error;
  }

  if (!isInternalBillingStaffRole(auth.role)) {
    return NextResponse.json({ error: "Billing is limited to platform billing staff." }, { status: 403 });
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("company_id")?.trim() ?? "";

  try {
    let query = auth.supabase.from("billing_customers").select("*").order("company_name");

    const scope = await getBillableCompanyScope(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
    });

    if (scope.mode === "list") {
      if (scope.companyIds.length === 0) {
        return NextResponse.json({ customers: [] });
      }
      query = query.in("company_id", scope.companyIds);
    }

    if (companyId) {
      await assertStaffCanAccessCompany(auth.supabase, {
        staffUserId: auth.user.id,
        staffRole: auth.role,
        companyId,
      });
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: data ?? [] });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
  });
  if ("error" in auth) {
    return auth.error;
  }

  if (!isInternalBillingStaffRole(auth.role)) {
    return NextResponse.json({ error: "Billing is limited to platform billing staff." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const company_id = String(body.company_id ?? "").trim();
  const billing_email = String(body.billing_email ?? "").trim().toLowerCase();
  const company_name = String(body.company_name ?? "").trim();

  if (!company_id || !billing_email || !company_name) {
    return NextResponse.json(
      { error: "company_id, company_name, and billing_email are required." },
      { status: 400 }
    );
  }

  try {
    await assertStaffCanAccessCompany(auth.supabase, {
      staffUserId: auth.user.id,
      staffRole: auth.role,
      companyId: company_id,
    });

    const { data, error } = await auth.supabase
      .from("billing_customers")
      .insert({
        company_id,
        company_name,
        billing_email,
        billing_contact_name: body.billing_contact_name == null ? null : String(body.billing_contact_name),
        billing_address_1: body.billing_address_1 == null ? null : String(body.billing_address_1),
        billing_address_2: body.billing_address_2 == null ? null : String(body.billing_address_2),
        city: body.city == null ? null : String(body.city),
        state: body.state == null ? null : String(body.state),
        zip: body.zip == null ? null : String(body.zip),
        country: body.country == null ? "US" : String(body.country),
        phone: body.phone == null ? null : String(body.phone),
        tax_id: body.tax_id == null ? null : String(body.tax_id),
        stripe_customer_id:
          body.stripe_customer_id == null ? null : String(body.stripe_customer_id),
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Insert failed." }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (e) {
    if (e instanceof BillingAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
