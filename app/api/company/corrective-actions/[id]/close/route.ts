import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { OFFLINE_DEMO_EMAIL } from "@/lib/offlineDesktopSession";
import {
  buildClosedLoopEventMetadata,
  buildClosedLoopLearningEvent,
  buildClosedLoopOutcomeRecord,
  type ClosedLoopCorrectiveActionRow,
  type ClosedLoopRecommendationRow,
} from "@/lib/aiKnowledgeMap/closedLoopOutcomes";

export const runtime = "nodejs";

type ClosePayload = {
  managerOverride?: boolean;
  managerOverrideReason?: string;
  closureNote?: string;
};

type MinimalSupabaseClient = {
  from: (table: string) => {
    select?: (columns?: string, options?: unknown) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          eq: (column: string, value: unknown) => PromiseLike<{ data?: ClosedLoopRecommendationRow[] | null; error?: { message?: string | null } | null }>;
        };
      };
    };
    update?: (payload: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => PromiseLike<{ error?: { message?: string | null } | null }>;
      };
    };
    insert?: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => PromiseLike<{ error?: { message?: string | null } | null }>;
  };
};


function canManageCorrectiveActions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "sales_demo"
  );
}

function canVerifyClosed(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "sales_demo"
  );
}

function isMissingCorrectiveActionsTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_corrective_action");
}

function isDemoRequest(auth: { role: string; user: { email?: string | null } }) {
  return (
    auth.role === "sales_demo" ||
    (auth.user.email ?? "").trim().toLowerCase() === OFFLINE_DEMO_EMAIL.toLowerCase()
  );
}

async function recordRecommendationClosedLoopOutcomes(params: {
  supabase: MinimalSupabaseClient;
  companyId: string;
  correctiveAction: ClosedLoopCorrectiveActionRow;
  evidenceCount: number;
  closureNote: string;
  actorUserId: string;
}) {
  const recommendationsQuery = params.supabase
    .from("company_risk_ai_recommendations")
    .select?.("id, company_id, jobsite_id, title, body, status, priority, mitigation_state, risk_reduction_points, verification_required, evidence_summary, linked_module, linked_record_id");
  const linkedResult = recommendationsQuery
    ? await recommendationsQuery
        .eq("company_id", params.companyId)
        .eq("linked_module", "corrective_action")
        .eq("linked_record_id", params.correctiveAction.id)
    : { data: [], error: null };

  if (linkedResult.error) return { recorded: 0, warning: linkedResult.error.message || "Linked recommendation lookup failed." };
  const recommendations = linkedResult.data ?? [];
  if (recommendations.length === 0) return { recorded: 0, warning: null };

  const now = new Date().toISOString();
  let recorded = 0;
  for (const recommendation of recommendations) {
    const outcome = buildClosedLoopOutcomeRecord({
      recommendation,
      correctiveAction: params.correctiveAction,
      evidenceCount: params.evidenceCount,
      closureNote: params.closureNote,
    });
    const learningEvent = buildClosedLoopLearningEvent(outcome);
    const metadata = buildClosedLoopEventMetadata({ outcome, learningEvent });

    const updateQuery = params.supabase
      .from("company_risk_ai_recommendations")
      .update?.({
        status: "resolved",
        mitigation_state: "resolved",
        risk_reduction_points: outcome.riskReductionPoints,
        resolved_at: now,
      });
    const updateResult = updateQuery
      ? await updateQuery.eq("id", recommendation.id).eq("company_id", params.companyId)
      : null;
    if (updateResult?.error) return { recorded, warning: updateResult.error.message || "Recommendation outcome update failed." };

    const outcomeInsert = await params.supabase.from("company_risk_recommendation_events").insert?.({
      company_id: params.companyId,
      recommendation_id: recommendation.id,
      event_type: "outcome_recorded",
      from_status: recommendation.status ?? "accepted",
      to_status: "resolved",
      actor_user_id: params.actorUserId,
      metadata,
    });
    if (outcomeInsert?.error) return { recorded, warning: outcomeInsert.error.message || "Recommendation outcome event failed." };

    const learningInsert = await params.supabase.from("company_risk_recommendation_events").insert?.({
      company_id: params.companyId,
      recommendation_id: recommendation.id,
      event_type: "learning_event_created",
      from_status: recommendation.status ?? "accepted",
      to_status: "resolved",
      actor_user_id: params.actorUserId,
      metadata,
    });
    if (learningInsert?.error) return { recorded, warning: learningInsert.error.message || "Recommendation learning event failed." };
    recorded += 1;
  }

  return { recorded, warning: null };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_edit_documents", "can_view_all_company_data"],
  });

  if ("error" in auth) {
    return auth.error;
  }

  if (!canManageCorrectiveActions(auth.role)) {
    return NextResponse.json(
      { error: "Only permitted field leaders can close corrective actions." },
      { status: 403 }
    );
  }
  if (!canVerifyClosed(auth.role)) {
    return NextResponse.json(
      { error: "Only Safety Manager or above can mark Verified Closed." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ClosePayload | null;
  const managerOverride = Boolean(body?.managerOverride);
  const managerOverrideReason = body?.managerOverrideReason?.trim() ?? "";
  const closureNote = body?.closureNote?.trim() ?? "";

  if (isDemoRequest(auth)) {
    if (managerOverride && !managerOverrideReason) {
      return NextResponse.json(
        { error: "Manager override reason is required when closing without photo proof." },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    return NextResponse.json({
      success: true,
      action: {
        id,
        company_id: "demo-company",
        status: "verified_closed",
        workflow_status: "verified_closed",
        closed_at: now,
        closure_note: closureNote || null,
        manager_override_close: managerOverride,
        manager_override_reason: managerOverride ? managerOverrideReason : null,
        validation_reviewed_by: auth.user.id,
        validation_reviewed_at: now,
        updated_by: auth.user.id,
        updated_at: now,
      },
      message: managerOverride
        ? "Corrective action closed with manager override."
        : "Corrective action closed.",
    });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return csepBlock;

  const actionResult = await auth.supabase
    .from("company_corrective_actions")
    .select("id, status, jobsite_id, sif_potential, created_at")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (actionResult.error) {
    if (isMissingCorrectiveActionsTable(actionResult.error.message)) {
      return NextResponse.json(
        {
          error:
            "Corrective action tracking tables are not available yet. Run the latest Supabase migration first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: actionResult.error.message || "Failed to find corrective action." },
      { status: 500 }
    );
  }

  if (!actionResult.data) {
    return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
  }
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(actionResult.data.jobsite_id, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only verify closures for assigned jobsites." },
      { status: 403 }
    );
  }

  if (actionResult.data.status === "verified_closed") {
    return NextResponse.json(
      { success: true, message: "Corrective action is already closed." },
      { status: 200 }
    );
  }

  const evidenceResult = await auth.supabase
    .from("company_corrective_action_evidence")
    .select("id", { count: "exact", head: true })
    .eq("action_id", id)
    .eq("company_id", companyScope.companyId);

  if (evidenceResult.error) {
    return NextResponse.json(
      { error: evidenceResult.error.message || "Failed to validate completion proof." },
      { status: 500 }
    );
  }

  const evidenceCount = evidenceResult.count ?? 0;
  if (evidenceCount < 1 && !managerOverride) {
    return NextResponse.json(
      {
        error:
          "At least one completion photo is required before closing this issue, unless a manager override is provided.",
      },
      { status: 400 }
    );
  }

  if (managerOverride && !managerOverrideReason) {
    return NextResponse.json(
      { error: "Manager override reason is required when closing without photo proof." },
      { status: 400 }
    );
  }
  if (actionResult.data.sif_potential && !closureNote) {
    return NextResponse.json(
      { error: "Closure note is required for SIF-potential observations." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const timeToCloseHours =
    actionResult.data.created_at
      ? Math.max(
          0,
          Number(
            (
              (new Date(now).getTime() - new Date(actionResult.data.created_at).getTime()) /
              (1000 * 60 * 60)
            ).toFixed(2)
          )
        )
      : null;
  const closeResult = await auth.supabase
    .from("company_corrective_actions")
    .update({
      status: "verified_closed",
      workflow_status: "verified_closed",
      closed_at: now,
      closure_note: closureNote || null,
      validation_reviewed_by: auth.user.id,
      validation_reviewed_at: now,
      time_to_close_hours: timeToCloseHours,
      manager_override_close: managerOverride,
      manager_override_reason: managerOverride ? managerOverrideReason : null,
      updated_by: auth.user.id,
    })
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .select(
      "id, company_id, jobsite_id, title, description, severity, status, assigned_user_id, due_at, started_at, closed_at, manager_override_close, manager_override_reason, created_at, updated_at"
    )
    .single();

  if (closeResult.error) {
    return NextResponse.json(
      { error: closeResult.error.message || "Failed to close corrective action." },
      { status: 500 }
    );
  }

  await auth.supabase.from("company_corrective_action_events").insert({
    action_id: id,
    company_id: companyScope.companyId,
    event_type: "closed",
    detail: managerOverride
      ? "Issue closed with manager override and no photo proof."
      : "Issue closed with completion photo proof.",
    event_payload: {
      managerOverride,
      managerOverrideReason: managerOverride ? managerOverrideReason : null,
      evidenceCount,
      closureNote: closureNote || null,
      validationReviewedBy: auth.user.id,
      validationReviewedAt: now,
      timeToCloseHours,
    },
    created_by: auth.user.id,
  });

  const closedLoop = await recordRecommendationClosedLoopOutcomes({
    supabase: auth.supabase as unknown as MinimalSupabaseClient,
    companyId: companyScope.companyId,
    correctiveAction: closeResult.data as unknown as ClosedLoopCorrectiveActionRow,
    evidenceCount,
    closureNote,
    actorUserId: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    action: closeResult.data,
    closedLoopOutcomeRecords: closedLoop.recorded,
    closedLoopWarning: closedLoop.warning,
    message: managerOverride
      ? "Corrective action closed with manager override."
      : "Corrective action closed.",
  });
}
