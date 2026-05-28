import { NextResponse } from "next/server";
import { requestAiResponsesText } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { getCompanyScope } from "@/lib/companyScope";
import { listCompanyAssignableUsers } from "@/lib/companyAssignableUsers";
import {
  buildAiActionPrompt,
  defaultDueDateForRisk,
  fallbackAiActionSuggestion,
  parseAiActionSuggestionText,
  type CorrectiveActionRiskSignal,
} from "@/lib/correctiveActionAi";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

function canManageCorrectiveActions(role: string) {
  return (
    isAdminRole(role) ||
    role === "company_admin" ||
    role === "manager" ||
    role === "safety_manager" ||
    role === "project_manager" ||
    role === "field_supervisor" ||
    role === "foreman"
  );
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeRiskSignal(input: unknown): CorrectiveActionRiskSignal | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const title = clean(record.title);
  if (!title) return null;
  return {
    id: clean(record.id, title.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    title,
    detail: clean(record.detail) || null,
    source: clean(record.source) || null,
    site: clean(record.site) || null,
    siteId: clean(record.siteId) || null,
    area: clean(record.area) || null,
    riskLevel: clean(record.riskLevel) || null,
    score: typeof record.score === "number" && Number.isFinite(record.score) ? record.score : null,
  };
}

function looksLikeExistingAction(row: Record<string, unknown>, risk: CorrectiveActionRiskSignal) {
  const title = clean(row.title).toLowerCase();
  const description = clean(row.description).toLowerCase();
  const riskTitle = risk.title.toLowerCase();
  const riskId = risk.id.toLowerCase();
  return (
    title.includes(riskTitle) ||
    description.includes(`risk signal: ${riskId}`) ||
    description.includes(riskTitle)
  );
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_view_dashboards", "can_view_analytics"],
  });
  if ("error" in auth) return auth.error;

  if (!canManageCorrectiveActions(auth.role)) {
    return NextResponse.json(
      { error: "Only permitted field leaders can generate AI corrective actions." },
      { status: 403 }
    );
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

  const body = (await request.json().catch(() => null)) as { risk?: unknown } | null;
  const risk = normalizeRiskSignal(body?.risk);
  if (!risk) {
    return NextResponse.json({ error: "A risk signal with a title is required." }, { status: 400 });
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(risk.siteId || null, jobsiteScope)) {
    return NextResponse.json(
      { error: "You can only generate actions for assigned jobsites." },
      { status: 403 }
    );
  }

  let existingQuery = auth.supabase
    .from("company_corrective_actions")
    .select("id, title, description, status, assigned_user_id, due_at")
    .eq("company_id", companyScope.companyId)
    .not("status", "eq", "verified_closed")
    .limit(50);
  if (risk.siteId) {
    existingQuery = existingQuery.eq("jobsite_id", risk.siteId);
  }
  const existingResult = await existingQuery;
  if (!existingResult.error) {
    const existing = ((existingResult.data ?? []) as Array<Record<string, unknown>>).find((row) =>
      looksLikeExistingAction(row, risk)
    );
    if (existing) {
      return NextResponse.json(
        {
          error: "An open corrective action already appears to cover this risk signal.",
          existingAction: existing,
        },
        { status: 409 }
      );
    }
  }

  const assignableUsers = await listCompanyAssignableUsers({
    supabase: auth.supabase,
    companyId: companyScope.companyId,
  });
  const fallback = fallbackAiActionSuggestion({ risk, assignableUsers });
  const model =
    process.env.CORRECTIVE_ACTION_AI_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel("gpt-4o-mini");

  const response = await requestAiResponsesText({
    model,
    input: buildAiActionPrompt({ risk, assignableUsers }),
    surface: "corrective-actions.ai-suggest",
    maxAttempts: 2,
  });

  const parsed = response.text ? parseAiActionSuggestionText(response.text) : null;
  const severity = parsed?.severity ?? fallback.severity;
  const dueAtCandidate = parsed?.dueAt ? new Date(parsed.dueAt) : null;
  const dueAt =
    dueAtCandidate && !Number.isNaN(dueAtCandidate.getTime())
      ? dueAtCandidate.toISOString()
      : parsed
        ? defaultDueDateForRisk(severity)
        : fallback.dueAt;

  const assignableById = new Map(assignableUsers.map((user) => [user.id, user] as const));
  const parsedAssignee = parsed?.assignedUserId ? assignableById.get(parsed.assignedUserId) ?? null : null;
  const fallbackAssignee = fallback.assignedUserId ? assignableById.get(fallback.assignedUserId) ?? null : null;
  const assignedUser = parsedAssignee ?? fallbackAssignee ?? null;
  const invalidAssigneeWarning =
    parsed?.assignedUserId && !parsedAssignee
      ? "AI returned an assignee outside the active company user list, so it was replaced with a valid user."
      : null;
  const warning =
    invalidAssigneeWarning ??
    fallback.warning ??
    (response.meta.fallbackUsed ? "AI output was unavailable, so a deterministic mitigation suggestion was prepared." : null);

  return NextResponse.json({
    suggestion: {
      riskId: risk.id,
      riskTitle: risk.title,
      title: parsed?.title ?? fallback.title,
      description: parsed?.description ?? fallback.description,
      severity,
      category: parsed?.category ?? fallback.category,
      dueAt,
      assignedUserId: assignedUser?.id ?? null,
      assignedUserName: assignedUser?.name ?? null,
      rationale: parsed?.rationale ?? fallback.rationale,
      warning,
    },
    assignableUsers,
    meta: response.meta,
  });
}
