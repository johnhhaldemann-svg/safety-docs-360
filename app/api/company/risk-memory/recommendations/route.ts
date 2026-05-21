import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { explainRecommendation } from "@/lib/leadershipTrust";
import type { LeadershipEvidenceRef } from "@/lib/leadershipTrust";

export const runtime = "nodejs";

function isMissingTable(message?: string | null) {
  const m = (message ?? "").toLowerCase();
  return m.includes("company_risk_ai_recommendations");
}

function parseEvidenceRefs(value: unknown): LeadershipEvidenceRef[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const refs = (value as { evidenceRefs?: unknown }).evidenceRefs;
  if (!Array.isArray(refs)) return [];
  const out: LeadershipEvidenceRef[] = [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") continue;
    const item = ref as Record<string, unknown>;
    const id = String(item.id ?? "").trim();
    const label = String(item.label ?? "").trim();
    if (!id || !label) continue;
    out.push({
      id,
      label,
      href: typeof item.href === "string" && item.href ? item.href : "/analytics/predictive-model",
      sourceModule: String(item.sourceModule ?? item.source_module ?? "predictive_risk"),
      sourceId: typeof item.sourceId === "string" ? item.sourceId : typeof item.source_id === "string" ? item.source_id : null,
      detail: typeof item.detail === "string" ? item.detail : undefined,
    });
  }
  return out;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_analytics",
      "can_view_all_company_data",
      "can_view_dashboards",
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
    return NextResponse.json({ recommendations: [] });
  }
  if (await companyHasCsepPlanName(auth.supabase, companyScope.companyId)) {
    return csepWorkspaceForbiddenResponse();
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "12")));

  const res = await auth.supabase
    .from("company_risk_ai_recommendations")
    .select("id, kind, title, body, confidence, created_at, dismissed, status, priority, owner_user_id, due_at, target_module, target_href, evidence_summary, accepted_at, field_used_at, resolved_at, dismissed_at")
    .eq("company_id", companyScope.companyId)
    .neq("status", "dismissed")
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) {
    if (isMissingTable(res.error.message)) {
      return NextResponse.json({ recommendations: [], warning: "Recommendations table not migrated yet." });
    }
    return NextResponse.json({ error: res.error.message || "Failed to load recommendations." }, { status: 500 });
  }

  return NextResponse.json({
    recommendations: (res.data ?? []).map((rec) =>
      explainRecommendation({
        id: rec.id,
        kind: rec.kind,
        title: rec.title,
        body: rec.body,
        confidence: rec.confidence,
        created_at: rec.created_at,
        actionHref: rec.target_href ?? "/analytics/predictive-model",
        status: rec.status ?? "active",
        priority: rec.priority ?? "medium",
        ownerUserId: rec.owner_user_id ?? null,
        dueAt: rec.due_at ?? null,
        sourceModule: rec.target_module ?? "risk_memory",
        evidenceRefs: parseEvidenceRefs(rec.evidence_summary),
        acceptedAt: rec.accepted_at ?? null,
        fieldUsedAt: rec.field_used_at ?? null,
        resolvedAt: rec.resolved_at ?? null,
        dismissedAt: rec.dismissed_at ?? null,
      })
    ),
  });
}
