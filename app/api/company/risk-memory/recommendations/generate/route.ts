import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { buildLlmRiskRecommendations } from "@/lib/riskMemory/llmRecommendations";
import { buildRuleBasedRiskRecommendations, type RiskRecommendationDraft } from "@/lib/riskMemory/recommendations";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { buildSalesDemoRiskRecommendations } from "@/lib/demoWorkspace";
import { enrichRiskActionDraft, inferRiskActionType } from "@/lib/riskActionPlan";
import {
  createCompanyNotification,
  listCompanyNotificationRecipients,
} from "@/lib/companyNotifications";
import { retrieveAiEngineBrainContext } from "@/lib/aiEngine/brain";
import type { TrustedKnowledgeGraphMemoryItem } from "@/lib/aiKnowledgeMap/types";

export const runtime = "nodejs";

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_risk_ai_recommendations");
}

function graphPatternQuery(ctx: Awaited<ReturnType<typeof buildRiskMemoryStructuredContext>>) {
  if (!ctx) return "approved safety graph risk patterns controls incidents permits training";
  const terms = [
    ctx.aggregatedWithBaseline?.band ?? ctx.aggregated.band,
    ...ctx.topScopes.map((scope) => scope.code),
    ...ctx.topHazards.map((hazard) => hazard.code),
    ...ctx.topLocationAreas.map((area) => area.label),
    ...ctx.topLocationGrids.map((grid) => grid.label),
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return terms.length > 0
    ? `approved safety graph risk patterns ${terms.slice(0, 20).join(" ")}`
    : "approved safety graph risk patterns controls incidents permits training";
}

function buildApprovedGraphPatternDrafts(
  graphMemory: TrustedKnowledgeGraphMemoryItem[],
): RiskRecommendationDraft[] {
  if (graphMemory.length === 0) return [];
  const relationshipCount = graphMemory.reduce((sum, item) => sum + item.relationshipReasons.length, 0);
  const titles = graphMemory
    .slice(0, 3)
    .map((item) => item.title)
    .filter(Boolean)
    .join(", ");
  return [
    {
      kind: "approved_graph_pattern",
      title: "Review approved knowledge graph risk pattern",
      body:
        `Approved graph memory found ${graphMemory.length} reviewed safety node(s)` +
        (relationshipCount > 0 ? ` and ${relationshipCount} approved relationship(s)` : "") +
        (titles ? ` tied to current risk patterns: ${titles}.` : ".") +
        " Use these reviewed links as supporting evidence when assigning controls, training checks, and follow-up actions.",
      confidence: Math.min(0.82, 0.62 + graphMemory.length * 0.03),
    },
  ];
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const modeRaw = String(body?.mode ?? "rules").trim().toLowerCase();
  const mode = modeRaw === "llm" || modeRaw === "both" ? modeRaw : "rules";
  if (auth.role === "sales_demo") {
    return NextResponse.json(buildSalesDemoRiskRecommendations(mode));
  }
  if (!canManage(auth.role)) {
    return NextResponse.json({ error: "Only managers and admins can generate recommendations." }, { status: 403 });
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "No company workspace linked." }, { status: 400 });
  }
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const days = Math.min(365, Math.max(1, Number(body?.days ?? 90)));
  const jobsiteId = body?.jobsiteId != null ? String(body.jobsiteId).trim() || null : null;

  const ctx = await buildRiskMemoryStructuredContext(auth.supabase, companyScope.companyId, {
    days,
    jobsiteId,
  });
  const brain = await retrieveAiEngineBrainContext({
        surface: "risk.recommendations",
        userClient: auth.supabase,
        companyId: companyScope.companyId,
        jobsiteId,
        query: graphPatternQuery(ctx),
        includeLegacyMemory: true,
        topK: 8,
        legacyTopK: 4,
      }).catch(() => ({
        items: [],
        method: "none" as const,
        warnings: ["AI Engine brain memory was unavailable for this run."],
        graphMemoryCount: 0,
      }));

  const combined: RiskRecommendationDraft[] = [];

  if (mode === "llm" || mode === "both") {
    const llm = await buildLlmRiskRecommendations(ctx);
    if (mode === "llm") {
      if (llm.error === "no_openai_key") {
        return NextResponse.json(
          { error: "OPENAI_API_KEY is not configured. Add it to the server environment or use mode=rules." },
          { status: 503 }
        );
      }
      if (llm.error === "no_context" || !ctx) {
        return NextResponse.json({ error: "Risk memory context is not available for this workspace." }, { status: 503 });
      }
    }
    combined.push(...llm.drafts);
  }

  if (mode === "rules" || mode === "both") {
    combined.push(...buildRuleBasedRiskRecommendations(ctx));
  }
  combined.push(...buildApprovedGraphPatternDrafts(brain.items));

  const seen = new Set<string>();
  const drafts = combined.filter((d) => {
    const k = d.title.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (drafts.length === 0) {
    return NextResponse.json({ created: 0, recommendations: [], mode });
  }

  const snapshot = ctx
    ? {
        engine: ctx.engine,
        windowDays: ctx.windowDays,
        facetCount: ctx.facetCount,
        band: ctx.aggregatedWithBaseline?.band ?? ctx.aggregated.band,
        score: ctx.aggregatedWithBaseline?.score ?? ctx.aggregated.score,
        mode,
        trustedGraphMemoryCount: brain.graphMemoryCount,
        aiEngineBrainMethod: brain.method,
      }
    : { mode, trustedGraphMemoryCount: brain.graphMemoryCount, aiEngineBrainMethod: brain.method };

  const rows = drafts.map((d) => {
    const actionDraft = enrichRiskActionDraft({
      ...d,
      priority: d.confidence >= 0.75 ? "high" : "medium",
      targetModule: "risk_memory",
      targetHref: "/settings/risk-memory",
      evidenceRefs: [],
      actionType: inferRiskActionType({
        kind: d.kind,
        title: d.title,
        body: d.body,
        priority: d.confidence >= 0.75 ? "high" : "medium",
        targetModule: "risk_memory",
      }),
    });
    return {
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      kind: d.kind,
      title: d.title,
      body: d.body,
      confidence: d.confidence,
      context_snapshot: snapshot,
      created_by: auth.user.id,
      status: "active",
      priority: actionDraft.priority,
      action_type: actionDraft.actionType,
      target_module: actionDraft.targetModule,
      target_href: actionDraft.targetHref,
      verification_required: actionDraft.verificationRequired,
      mitigation_state: actionDraft.mitigationState,
      risk_reduction_points: actionDraft.riskReductionPoints,
      evidence_summary: {
        evidenceRefs: [],
        trustedGraphMemory:
          d.kind === "approved_graph_pattern"
            ? brain.items.slice(0, 5).map((item) => ({
                nodeId: item.nodeId,
                title: item.title,
                sourceTable: item.sourceTable,
                sourceId: item.sourceId,
                confidenceScore: item.confidenceScore,
                relationshipReasons: item.relationshipReasons,
              }))
            : [],
      },
    };
  });

  const ins = await auth.supabase.from("company_risk_ai_recommendations").insert(rows).select("id, kind, title, body, confidence, created_at");

  if (ins.error) {
    if (isMissingTable(ins.error.message)) {
      return NextResponse.json({ error: "Recommendations table not available. Run migrations." }, { status: 503 });
    }
    return NextResponse.json({ error: ins.error.message || "Failed to save recommendations." }, { status: 500 });
  }

  const recommendations = ins.data ?? [];
  if (recommendations.length > 0) {
    const recipients = await listCompanyNotificationRecipients({
      supabase: auth.supabase,
      companyId: companyScope.companyId,
      roles: ["company_admin", "manager", "safety_manager"],
      includeUserIds: [auth.user.id],
    });
    await Promise.all(
      recipients.userIds.map((recipientUserId) =>
        createCompanyNotification({
          supabase: auth.supabase,
          companyId: companyScope.companyId!,
          recipientUserId,
          actorUserId: auth.user.id,
          eventType: "risk_recommendation",
          title: `${recommendations.length} risk recommendation${recommendations.length === 1 ? "" : "s"} ready`,
          body: recommendations[0]?.title ?? "New predictive risk guidance is ready for triage.",
          priority: "high",
          href: "/settings/risk-memory",
          sourceTable: "company_risk_ai_recommendations",
          sourceId: recommendations[0]?.id ?? null,
          metadata: {
            mode,
            created: recommendations.length,
            jobsiteId,
            recipientLookupError: recipients.error,
          },
        })
      )
    );
  }

  return NextResponse.json({
    created: recommendations.length,
    recommendations,
    mode,
    trustedGraphMemoryCount: brain.graphMemoryCount,
  });
}
