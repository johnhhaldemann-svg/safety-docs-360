import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { getCompanySeatCounts } from "@/lib/companySeats";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { emptyOnboardingState, getUserOnboardingState } from "@/lib/onboardingState";
import { authorizeRequest } from "@/lib/rbac";
import { buildRevenueReadinessSummary } from "@/lib/revenueReadiness";

export const runtime = "nodejs";

function isMissingJsaRelationError(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("company_daps") || lower.includes("company_jsas") || lower.includes("schema cache");
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_manage_company_users",
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_create_documents",
    ],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!companyScope.companyId) {
    return NextResponse.json({
      companyId: null,
      companyName: companyScope.companyName,
      progress: buildRevenueReadinessSummary({
        companyProfile: null,
        onboarding: emptyOnboardingState(),
      }),
      warning: "This account is not linked to a company workspace yet.",
    });
  }

  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const [
    companyResult,
    usersResult,
    invitesResult,
    jobsitesResult,
    documentsResult,
    subscriptionResult,
    actionsResult,
    incidentsResult,
    permitsResult,
    jsasResult,
    reportsResult,
    onboardingResult,
    recommendationsResult,
  ] = await Promise.all([
    auth.supabase
      .from("companies")
      .select(
        "id, name, industry, phone, address_line_1, city, state_region, country, status, pilot_trial_ends_at, pilot_converted_at"
      )
      .eq("id", companyScope.companyId)
      .maybeSingle(),
    auth.supabase
      .from("company_memberships")
      .select("status")
      .eq("company_id", companyScope.companyId),
    auth.supabase
      .from("company_invites")
      .select("status:account_status")
      .eq("company_id", companyScope.companyId)
      .is("consumed_at", null),
    auth.supabase
      .from("company_jobsites")
      .select("status")
      .eq("company_id", companyScope.companyId),
    auth.supabase
      .from("documents")
      .select("status, final_file_path, draft_file_path")
      .eq("company_id", companyScope.companyId),
    auth.supabase
      .from("company_subscriptions")
      .select("status, plan_name, max_user_seats, subscription_price_cents, seat_price_cents")
      .eq("company_id", companyScope.companyId)
      .maybeSingle(),
    auth.supabase
      .from("company_corrective_actions")
      .select("status, due_at, closed_at")
      .eq("company_id", companyScope.companyId)
      .limit(500),
    auth.supabase
      .from("company_incidents")
      .select("status")
      .eq("company_id", companyScope.companyId)
      .limit(500),
    auth.supabase
      .from("company_permits")
      .select("status, stop_work_status")
      .eq("company_id", companyScope.companyId)
      .limit(500),
    auth.supabase
      .from("company_jsas")
      .select("status")
      .eq("company_id", companyScope.companyId)
      .limit(500),
    auth.supabase
      .from("company_reports")
      .select("status")
      .eq("company_id", companyScope.companyId)
      .limit(500),
    getUserOnboardingState({
      supabase: auth.supabase,
      userId: auth.user.id,
    }),
    auth.supabase
      .from("company_risk_ai_recommendations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyScope.companyId)
      .eq("dismissed", false),
  ]);

  const hardError =
    companyResult.error ||
    usersResult.error ||
    invitesResult.error ||
    jobsitesResult.error ||
    documentsResult.error ||
    subscriptionResult.error ||
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
          "Failed to load onboarding progress.",
      },
      { status: 500 }
    );
  }

  const seats = await getCompanySeatCounts(auth.supabase, companyScope.companyId);
  const subscription = subscriptionResult.data as
    | {
        status?: string | null;
        plan_name?: string | null;
        max_user_seats?: number | null;
        subscription_price_cents?: number | null;
        seat_price_cents?: number | null;
      }
    | null;

  const progress = buildRevenueReadinessSummary({
    companyProfile: (companyResult.data as never) ?? null,
    companyUsers: (usersResult.data as Array<{ status?: string | null }> | null) ?? [],
    companyInvites: (invitesResult.data as Array<{ status?: string | null }> | null) ?? [],
    jobsites: (jobsitesResult.data as Array<{ status?: string | null }> | null) ?? [],
    documents:
      (documentsResult.data as Array<{
        status?: string | null;
        final_file_path?: string | null;
        draft_file_path?: string | null;
      }> | null) ?? [],
    onboarding: onboardingResult.data,
    subscription: {
      status: subscription?.status ?? null,
      planName: subscription?.plan_name ?? null,
      maxUserSeats: subscription?.max_user_seats ?? null,
      seatsUsed: seats.seatsUsed,
      subscriptionPriceCents: subscription?.subscription_price_cents ?? null,
      seatPriceCents: subscription?.seat_price_cents ?? null,
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
    companyId: companyScope.companyId,
    companyName: companyScope.companyName,
    progress,
  });
}
