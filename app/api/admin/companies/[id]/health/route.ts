import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCompanySeatCounts } from "@/lib/companySeats";
import { authorizeRequest } from "@/lib/rbac";
import { buildRevenueReadinessSummary } from "@/lib/revenueReadiness";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isMissingJsaRelationError(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_daps") || lower.includes("company_jsas") || lower.includes("schema cache");
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_all_company_data",
  });
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const companyId = id.trim();
  if (!companyId) {
    return NextResponse.json({ error: "Company id is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const supabase = (adminClient ?? auth.supabase) as SupabaseClient;

  const [
    companyResult,
    membershipsResult,
    invitesResult,
    documentsResult,
    subscriptionResult,
    jobsitesResult,
    actionsResult,
    incidentsResult,
    permitsResult,
    jsasResult,
    reportsResult,
    recommendationsResult,
    overdueInvoicesResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, industry, phone, address_line_1, city, state_region, country, status, pilot_trial_ends_at, pilot_converted_at"
      )
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("company_memberships")
      .select("user_id, status")
      .eq("company_id", companyId),
    supabase
      .from("company_invites")
      .select("status:account_status")
      .eq("company_id", companyId)
      .is("consumed_at", null),
    supabase
      .from("documents")
      .select("status, final_file_path, draft_file_path")
      .eq("company_id", companyId),
    supabase
      .from("company_subscriptions")
      .select("status, plan_name, max_user_seats, subscription_price_cents, seat_price_cents")
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase.from("company_jobsites").select("status").eq("company_id", companyId),
    supabase
      .from("company_corrective_actions")
      .select("status, due_at, closed_at")
      .eq("company_id", companyId)
      .limit(500),
    supabase.from("company_incidents").select("status").eq("company_id", companyId).limit(500),
    supabase
      .from("company_permits")
      .select("status, stop_work_status")
      .eq("company_id", companyId)
      .limit(500),
    supabase.from("company_jsas").select("status").eq("company_id", companyId).limit(500),
    supabase.from("company_reports").select("status").eq("company_id", companyId).limit(500),
    supabase
      .from("company_risk_ai_recommendations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("dismissed", false),
    supabase
      .from("billing_invoices")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "overdue"),
  ]);

  const hardError =
    companyResult.error ||
    membershipsResult.error ||
    invitesResult.error ||
    documentsResult.error ||
    subscriptionResult.error ||
    jobsitesResult.error ||
    actionsResult.error ||
    incidentsResult.error ||
    permitsResult.error ||
    reportsResult.error;
  const jsasMissing = jsasResult.error && isMissingJsaRelationError(jsasResult.error.message);

  if (hardError || (jsasResult.error && !jsasMissing)) {
    return NextResponse.json(
      {
        error:
          hardError?.message ||
          jsasResult.error?.message ||
          "Failed to load company health.",
      },
      { status: 500 }
    );
  }

  const company = companyResult.data as { id?: string | null; name?: string | null } | null;
  if (!company?.id) {
    return NextResponse.json({ error: "Company workspace not found." }, { status: 404 });
  }

  const memberships =
    (membershipsResult.data as Array<{ user_id: string; status?: string | null }> | null) ?? [];
  const onboardingResult =
    memberships.length > 0
      ? await supabase
          .from("user_onboarding_state")
          .select("user_id, completed_steps, last_seen_command_center_at")
          .in(
            "user_id",
            memberships.map((row) => row.user_id)
          )
      : { data: [], error: null };
  const lastSignInByUser = new Map<string, string | null>();
  if (adminClient) {
    const usersResult = await adminClient.auth.admin.listUsers();
    for (const user of usersResult.data.users ?? []) {
      lastSignInByUser.set(user.id, user.last_sign_in_at ?? null);
    }
  }

  const onboardingRows =
    !onboardingResult.error
      ? ((onboardingResult.data as Array<{
          completed_steps?: string[] | null;
          last_seen_command_center_at?: string | null;
        }> | null) ?? [])
      : [];
  const completedSteps = Array.from(
    new Set(onboardingRows.flatMap((row) => row.completed_steps ?? []))
  );
  const commandCenterViewed = onboardingRows.some((row) =>
    Boolean(row.last_seen_command_center_at)
  );
  const seats = await getCompanySeatCounts(supabase, companyId);
  const subscription = subscriptionResult.data as
    | {
        status?: string | null;
        plan_name?: string | null;
        max_user_seats?: number | null;
        subscription_price_cents?: number | null;
        seat_price_cents?: number | null;
      }
    | null;

  const health = buildRevenueReadinessSummary({
    companyProfile: (companyResult.data as never) ?? null,
    companyUsers: memberships.map((row) => ({
      status: row.status,
      last_sign_in_at: lastSignInByUser.get(row.user_id) ?? null,
    })),
    companyInvites: (invitesResult.data as Array<{ status?: string | null }> | null) ?? [],
    jobsites: (jobsitesResult.data as Array<{ status?: string | null }> | null) ?? [],
    documents:
      (documentsResult.data as Array<{
        status?: string | null;
        final_file_path?: string | null;
        draft_file_path?: string | null;
      }> | null) ?? [],
    onboarding: {
      commandCenterViewed,
      completedSteps,
    },
    subscription: {
      status: subscription?.status ?? null,
      planName: subscription?.plan_name ?? null,
      maxUserSeats: subscription?.max_user_seats ?? null,
      seatsUsed: seats.seatsUsed,
      subscriptionPriceCents: subscription?.subscription_price_cents ?? null,
      seatPriceCents: subscription?.seat_price_cents ?? null,
      failedPaymentCount: overdueInvoicesResult.error ? 0 : overdueInvoicesResult.count ?? 0,
    },
    work: {
      correctiveActions:
        (actionsResult.data as Array<{ status?: string | null; due_at?: string | null; closed_at?: string | null }> | null) ?? [],
      incidents: (incidentsResult.data as Array<{ status?: string | null }> | null) ?? [],
      permits:
        (permitsResult.data as Array<{ status?: string | null; stop_work_status?: string | null }> | null) ?? [],
      jsas: jsasMissing ? [] : ((jsasResult.data as Array<{ status?: string | null }> | null) ?? []),
      reports: (reportsResult.data as Array<{ status?: string | null }> | null) ?? [],
    },
    riskMemory: {
      recommendationCount: recommendationsResult.error ? 0 : recommendationsResult.count ?? 0,
    },
  });

  return NextResponse.json({
    companyId,
    companyName: company.name?.trim() || "Company Workspace",
    health,
    warning: adminClient
      ? null
      : "Last sign-in and company-level onboarding details may be partial because the Supabase service role is unavailable.",
  });
}
