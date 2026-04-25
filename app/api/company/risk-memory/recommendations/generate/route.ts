import { NextResponse } from "next/server";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { buildLlmRiskRecommendations } from "@/lib/riskMemory/llmRecommendations";
import { buildRuleBasedRiskRecommendations, type RiskRecommendationDraft } from "@/lib/riskMemory/recommendations";
import { buildRiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";
import { buildSalesDemoRiskRecommendations } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

function canManage(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function isMissingTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_risk_ai_recommendations");
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
      }
    : { mode };

  const rows = drafts.map((d) => ({
    company_id: companyScope.companyId,
    jobsite_id: jobsiteId,
    kind: d.kind,
    title: d.title,
    body: d.body,
    confidence: d.confidence,
    context_snapshot: snapshot,
    created_by: auth.user.id,
  }));

  const ins = await auth.supabase.from("company_risk_ai_recommendations").insert(rows).select("id, kind, title, body, confidence, created_at");

  if (ins.error) {
    if (isMissingTable(ins.error.message)) {
      return NextResponse.json({ error: "Recommendations table not available. Run migrations." }, { status: 503 });
    }
    return NextResponse.json({ error: ins.error.message || "Failed to save recommendations." }, { status: 500 });
  }

  return NextResponse.json({
    created: ins.data?.length ?? 0,
    recommendations: ins.data ?? [],
    mode,
  });
}
