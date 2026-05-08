import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { demoCompanyUsers } from "@/lib/demoWorkspace";
import {
  buildLeadershipSafetyScores,
  canViewLeadershipSafetyScore,
  isLeadershipSafetyRole,
  leaderScopeForAssignments,
  type LeadershipSafetyScore,
} from "@/lib/leadershipSafetyScores";
import { authorizeRequest, formatAppRole, normalizeAppRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type QueryResult = {
  data: Array<Record<string, unknown>> | null;
  error: { message?: string | null } | null;
};

function parseDays(value: string | null) {
  const n = Number(value ?? "30");
  return Math.max(7, Math.min(120, Number.isFinite(n) ? Math.floor(n) : 30));
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isMissingTable(message?: string | null) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find");
}

function serialize(score: LeadershipSafetyScore, leader?: { name?: string | null; email?: string | null }) {
  return {
    companyId: score.companyId,
    userId: score.userId,
    name: leader?.name ?? "",
    email: leader?.email ?? "",
    role: score.role,
    roleLabel: formatAppRole(score.role),
    windowStart: score.windowStart,
    windowEnd: score.windowEnd,
    score: score.score,
    grade: score.grade,
    trend: score.trend,
    lastScoredAt: score.lastScoredAt,
    positiveSignals: score.positiveSignals,
    negativeSignals: score.negativeSignals,
    evidenceRefs: score.evidenceRefs,
    coachingPrompt:
      score.negativeSignals[0]?.detail ??
      score.positiveSignals[0]?.detail ??
      "No elevated coaching signals were found in this window.",
  };
}

function demoScores(days: number, userId?: string | null) {
  const windowEnd = new Date().toISOString();
  const windowStart = isoDaysAgo(days);
  const leaders = demoCompanyUsers
    .filter((user) => isLeadershipSafetyRole(user.role))
    .map((user) => ({
      companyId: "demo-company",
      userId: user.id,
      name: user.name,
      email: user.email,
      role: normalizeAppRole(user.role),
      windowStart,
      windowEnd,
      score: user.role === "foreman" ? 76 : user.role === "field_supervisor" ? 83 : 88,
      grade: user.role === "foreman" ? "C" : user.role === "field_supervisor" ? "B" : "B",
      trend: user.role === "foreman" ? -4 : 3,
      lastScoredAt: windowEnd,
      positiveSignals: [
        {
          label: "Risk actions reviewed",
          detail: "Demo leadership has active risk-reduction follow-through in this window.",
          points: 6,
        },
      ],
      negativeSignals:
        user.role === "foreman"
          ? [
              {
                label: "Open assigned-work gaps",
                detail: "Demo assigned work includes open permit/JSA follow-through items.",
                points: -8,
              },
            ]
          : [],
      evidenceRefs: [],
    }));
  const filtered = userId ? leaders.filter((score) => score.userId === userId) : leaders;
  return { scores: filtered, windowStart, windowEnd, persisted: false };
}

async function safeQuery(query: PromiseLike<QueryResult>) {
  const result = await query;
  if (result.error && isMissingTable(result.error.message)) {
    return { data: [], error: null };
  }
  return result;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_dashboards",
      "can_view_reports",
      "can_view_analytics",
      "can_manage_company_users",
      "can_view_all_company_data",
    ],
  });
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const days = parseDays(searchParams.get("days"));
  const requestedUserId = searchParams.get("userId")?.trim() || null;
  const windowEnd = new Date().toISOString();
  const windowStart = isoDaysAgo(days);

  if (auth.role === "sales_demo") {
    return NextResponse.json(demoScores(days, requestedUserId));
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ scores: [], windowStart, windowEnd, persisted: false });
  }
  const companyId = companyScope.companyId;

  const [
    roleRowsRes,
    assignmentRes,
    jobsitesRes,
    incidentsRes,
    permitsRes,
    jsasRes,
    jsaActivitiesRes,
    correctiveRes,
    recommendationsRes,
    behaviorRes,
    previousScoresRes,
  ] = await Promise.all([
    safeQuery(
      auth.supabase
        .from("user_roles")
        .select("user_id, role, team, account_status")
        .eq("company_id", companyId) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_jobsite_assignments")
        .select("user_id, jobsite_id, role")
        .eq("company_id", companyId) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_jobsites")
        .select("id, name")
        .eq("company_id", companyId) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_incidents")
        .select("id, title, category, severity, status, sif_flag, escalation_level, recordable, injury_type, created_at, jobsite_id")
        .eq("company_id", companyId)
        .gte("created_at", windowStart) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_permits")
        .select("id, title, permit_type, severity, status, due_at, created_at, updated_at, jobsite_id, owner_user_id, dap_activity_id, sif_flag, stop_work_status, escalation_level")
        .eq("company_id", companyId)
        .gte("created_at", windowStart) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_jsas")
        .select("id, title, description, status, severity, category, due_at, created_at, updated_at, jobsite_id, owner_user_id")
        .eq("company_id", companyId)
        .gte("created_at", windowStart) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_jsa_activities")
        .select("id, jsa_id, jobsite_id, activity_name, hazard_description, mitigation, permit_required, permit_type, planned_risk_level, status, created_at, updated_at")
        .eq("company_id", companyId)
        .gte("created_at", windowStart) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_corrective_actions")
        .select("id, title, status, severity, priority, due_at, closed_at, created_at, jobsite_id, assigned_user_id, sif_potential")
        .eq("company_id", companyId)
        .gte("created_at", windowStart) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_risk_ai_recommendations")
        .select("id, title, kind, confidence, dismissed, created_at, jobsite_id")
        .eq("company_id", companyId)
        .gte("created_at", windowStart) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("behavior_risk_events")
        .select("id, jobsite_id, supervisor_id, risk_driver, risk_points, status, created_at, resolved_at, recommended_action")
        .eq("company_id", companyId)
        .gte("created_at", windowStart) as unknown as PromiseLike<QueryResult>
    ),
    safeQuery(
      auth.supabase
        .from("company_leadership_safety_scores")
        .select("user_id, score")
        .eq("company_id", companyId)
        .lt("window_end", windowStart)
        .order("window_end", { ascending: false })
        .limit(200) as unknown as PromiseLike<QueryResult>
    ),
  ]);

  const hardError =
    roleRowsRes.error?.message ||
    assignmentRes.error?.message ||
    jobsitesRes.error?.message ||
    incidentsRes.error?.message ||
    permitsRes.error?.message ||
    jsasRes.error?.message ||
    jsaActivitiesRes.error?.message ||
    correctiveRes.error?.message ||
    recommendationsRes.error?.message ||
    behaviorRes.error?.message;
  if (hardError) {
    return NextResponse.json({ error: hardError || "Failed to load leadership scores." }, { status: 500 });
  }

  const adminClient = createSupabaseAdminClient();
  const authUsers = adminClient
    ? await adminClient.auth.admin
        .listUsers()
        .then((result) => result.data.users ?? [])
        .catch(() => [])
    : [];
  const userById = new Map(authUsers.map((user) => [user.id, user] as const));
  const leaders = (roleRowsRes.data ?? [])
    .filter((row) => String(row.account_status ?? "active") !== "suspended")
    .map((row) => ({
      userId: String(row.user_id ?? ""),
      role: String(row.role ?? ""),
      name:
        typeof userById.get(String(row.user_id ?? ""))?.user_metadata?.full_name === "string"
          ? String(userById.get(String(row.user_id ?? ""))?.user_metadata?.full_name)
          : userById.get(String(row.user_id ?? ""))?.email?.split("@")[0] ?? "",
      email: userById.get(String(row.user_id ?? ""))?.email ?? "",
    }))
    .filter((leader) => leader.userId && isLeadershipSafetyRole(leader.role));

  const previousScoresByUserId: Record<string, number> = {};
  for (const row of previousScoresRes.data ?? []) {
    const userId = String(row.user_id ?? "");
    const score = Number(row.score ?? Number.NaN);
    if (userId && Number.isFinite(score) && previousScoresByUserId[userId] == null) {
      previousScoresByUserId[userId] = score;
    }
  }

  const assignments = assignmentRes.data ?? [];
  const allJobsiteIds = (jobsitesRes.data ?? []).map((row) => String(row.id ?? "")).filter(Boolean);
  const scores = buildLeadershipSafetyScores({
    companyId,
    leaders,
    assignments,
    allJobsiteIds,
    rows: {
      incidents: incidentsRes.data ?? [],
      permits: permitsRes.data ?? [],
      jsas: jsasRes.data ?? [],
      jsaActivities: jsaActivitiesRes.data ?? [],
      correctiveActions: correctiveRes.data ?? [],
      recommendations: recommendationsRes.data ?? [],
      behaviorEvents: behaviorRes.data ?? [],
    },
    windowStart,
    windowEnd,
    previousScoresByUserId,
  });

  const viewerRole = normalizeAppRole(auth.role);
  const viewerScope = isLeadershipSafetyRole(viewerRole)
    ? leaderScopeForAssignments(
        { userId: auth.user.id, role: viewerRole },
        assignments,
        allJobsiteIds
      )
    : { jobsiteIds: allJobsiteIds };
  const visibleScores = scores.filter((score) => {
    const targetScope = leaderScopeForAssignments(
      { userId: score.userId, role: score.role },
      assignments,
      allJobsiteIds
    );
    return canViewLeadershipSafetyScore({
      viewerRole: auth.role,
      viewerUserId: auth.user.id,
      targetUserId: score.userId,
      targetRole: score.role,
      viewerJobsiteIds: viewerScope.jobsiteIds,
      targetJobsiteIds: targetScope.jobsiteIds,
    });
  });

  if (requestedUserId && !visibleScores.some((score) => score.userId === requestedUserId)) {
    return NextResponse.json({ error: "You do not have access to this leadership score." }, { status: 403 });
  }

  const filteredScores = requestedUserId
    ? visibleScores.filter((score) => score.userId === requestedUserId)
    : visibleScores;

  let persisted = false;
  if (adminClient && scores.length > 0) {
    const upsertRows = scores.map((score) => ({
      company_id: score.companyId,
      user_id: score.userId,
      role: score.role,
      window_start: score.windowStart,
      window_end: score.windowEnd,
      score: score.score,
      grade: score.grade,
      trend: score.trend,
      last_scored_at: score.lastScoredAt,
      positive_signals: score.positiveSignals,
      negative_signals: score.negativeSignals,
      evidence_refs: score.evidenceRefs,
    }));
    const result = await adminClient
      .from("company_leadership_safety_scores")
      .upsert(upsertRows, {
        onConflict: "company_id,user_id,role,window_start,window_end",
      });
    persisted = !result.error;
  }

  const leaderById = new Map(leaders.map((leader) => [leader.userId, leader] as const));
  return NextResponse.json({
    scores: filteredScores.map((score) => serialize(score, leaderById.get(score.userId))),
    windowStart,
    windowEnd,
    persisted,
  });
}
