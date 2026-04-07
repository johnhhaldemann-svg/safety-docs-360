import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import {
  createRecurringCompanyInvoice,
  resolveRecurringBillingActorId,
} from "@/lib/billing/recurringCompanyBilling";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Missing Supabase service role key for recurring billing." },
      { status: 500 }
    );
  }

  const actor = await resolveRecurringBillingActorId(adminClient);
  if (!actor.userId) {
    return NextResponse.json({ error: actor.error || "No billing actor available." }, { status: 500 });
  }

  const { data: subscriptions, error } = await adminClient
    .from("company_subscriptions")
    .select("company_id")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to list active subscriptions." }, { status: 500 });
  }

  const companyIds = Array.from(
    new Set(
      ((subscriptions ?? []) as Array<{ company_id?: string | null }>).map((row) =>
        String(row.company_id ?? "").trim()
      )
    )
  ).filter(Boolean);

  const summary = {
    created: 0,
    skipped: 0,
    errors: 0,
    details: [] as Array<
      | { companyId: string; status: "created"; invoiceId: string; invoiceNumber: string }
      | { companyId: string; status: "skipped"; reason: string }
      | { companyId: string; status: "error"; reason: string }
    >,
  };

  for (const companyId of companyIds) {
    const result = await createRecurringCompanyInvoice({
      supabase: adminClient,
      companyId,
      createdByUserId: actor.userId,
      billingSource: "recurring_company_pricing",
    });

    if (result.status === "created") {
      summary.created += 1;
      summary.details.push({
        companyId,
        status: "created",
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
      });
      continue;
    }

    if (result.status === "skipped") {
      summary.skipped += 1;
      summary.details.push({
        companyId,
        status: "skipped",
        reason: result.reason,
      });
      continue;
    }

    summary.errors += 1;
    summary.details.push({
      companyId,
      status: "error",
      reason: result.reason,
    });
  }

  return NextResponse.json({
    ok: true,
    summary,
  });
}

