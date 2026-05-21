"use client";

import { useCallback, useEffect, useState } from "react";
import { PredictiveModelView } from "@/components/analytics/PredictiveModelView";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { ExplainableRecommendation } from "@/lib/leadershipTrust";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return { Authorization: `Bearer ${session.access_token}` };
}

export default function PredictiveModelPage() {
  const [data, setData] = useState<PredictiveRiskPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [riskActionRecommendations, setRiskActionRecommendations] = useState<ExplainableRecommendation[]>([]);
  const [riskActionLoading, setRiskActionLoading] = useState(false);
  const [riskActionMessage, setRiskActionMessage] = useState("");
  const [days, setDays] = useState(30);
  const [jobsiteId, setJobsiteId] = useState("");

  const loadRiskActions = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetchWithTimeoutSafe(
        "/api/company/risk-memory/recommendations?limit=8",
        { headers },
        12000,
        "Risk actions"
      );
      const body = (await res.json().catch(() => null)) as {
        recommendations?: ExplainableRecommendation[];
        warning?: string;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error || "Failed to load AI risk actions.");
      setRiskActionRecommendations(body?.recommendations ?? []);
      setRiskActionMessage(body?.warning ?? "");
    } catch (err) {
      setRiskActionMessage(err instanceof Error ? err.message : "Failed to load AI risk actions.");
      setRiskActionRecommendations([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ days: String(days) });
      if (jobsiteId) params.set("jobsiteId", jobsiteId);
      const res = await fetchWithTimeoutSafe(
        `/api/company/predictive-risk?${params.toString()}`,
        { headers },
        20000,
        "Predictive risk"
      );
      const body = (await res.json().catch(() => null)) as PredictiveRiskPayload & { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Failed to load predictive risk.");
      setData(body);
      await loadRiskActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load predictive risk.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days, jobsiteId, loadRiskActions]);

  const generateRiskActionPlan = useCallback(async () => {
    setRiskActionLoading(true);
    setRiskActionMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetchWithTimeoutSafe(
        "/api/company/ai/risk-action-plan",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            days,
            jobsiteId: jobsiteId || undefined,
            mode: "both",
          }),
        },
        30000,
        "AI risk action plan"
      );
      const body = (await res.json().catch(() => null)) as {
        recommendations?: Array<{
          id: string;
          kind: string;
          title: string;
          body: string;
          confidence: number;
          priority: ExplainableRecommendation["priority"];
          actionType?: ExplainableRecommendation["actionType"];
          targetModule: string;
          targetHref: string;
          evidenceRefs: ExplainableRecommendation["evidenceRefs"];
          status: ExplainableRecommendation["status"];
          verificationRequired?: boolean;
          mitigationState?: string;
          riskReductionPoints?: number;
          linkedModule?: string | null;
          linkedRecordId?: string | null;
          createdAt: string;
        }>;
        warnings?: string[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error || "Failed to generate AI risk action plan.");
      const mapped: ExplainableRecommendation[] = (body?.recommendations ?? []).map((rec) => ({
        id: rec.id,
        kind: rec.kind,
        title: rec.title,
        body: rec.body,
        confidence: rec.confidence,
        created_at: rec.createdAt,
        status: rec.status,
        priority: rec.priority,
        actionType: rec.actionType,
        sourceModule: rec.targetModule,
        verificationRequired: rec.verificationRequired,
        mitigationState: rec.mitigationState,
        riskReductionPoints: rec.riskReductionPoints,
        linkedModule: rec.linkedModule,
        linkedRecordId: rec.linkedRecordId,
        evidenceRefs: rec.evidenceRefs ?? [],
        evidence:
          rec.evidenceRefs && rec.evidenceRefs.length > 0
            ? `Grounded in ${rec.evidenceRefs.length} evidence reference${rec.evidenceRefs.length === 1 ? "" : "s"}.`
            : undefined,
        actionHref: rec.targetHref,
      }));
      setRiskActionRecommendations((current) => {
        const seen = new Set(mapped.map((item) => item.id));
        return [...mapped, ...current.filter((item) => !seen.has(item.id))].slice(0, 8);
      });
      setRiskActionMessage(body?.warnings?.length ? body.warnings.join(" ") : `${mapped.length} AI risk action${mapped.length === 1 ? "" : "s"} generated.`);
    } catch (err) {
      setRiskActionMessage(err instanceof Error ? err.message : "Failed to generate AI risk action plan.");
    } finally {
      setRiskActionLoading(false);
    }
  }, [days, jobsiteId]);

  const updateRiskRecommendation = useCallback(
    async (id: string, actionType: string) => {
      setRiskActionLoading(true);
      setRiskActionMessage("");
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/company/risk-memory/recommendations/${encodeURIComponent(id)}/actions`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ actionType }),
        });
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          recommendation?: {
            id: string;
            status?: ExplainableRecommendation["status"];
            action_type?: ExplainableRecommendation["actionType"];
            owner_user_id?: string | null;
            due_at?: string | null;
            linked_module?: string | null;
            linked_record_id?: string | null;
            verification_required?: boolean;
            mitigation_state?: string;
            risk_reduction_points?: number;
          };
        } | null;
        if (!res.ok) throw new Error(body?.error || "Failed to execute recommendation action.");
        const updated = body?.recommendation;
        setRiskActionRecommendations((current) =>
          current
            .map((item) =>
              item.id === id && updated
                ? {
                    ...item,
                    status: updated.status ?? item.status,
                    actionType: updated.action_type ?? item.actionType,
                    ownerUserId: updated.owner_user_id ?? item.ownerUserId,
                    dueAt: updated.due_at ?? item.dueAt,
                    linkedModule: updated.linked_module ?? item.linkedModule,
                    linkedRecordId: updated.linked_record_id ?? item.linkedRecordId,
                    verificationRequired: updated.verification_required ?? item.verificationRequired,
                    mitigationState: updated.mitigation_state ?? item.mitigationState,
                    riskReductionPoints: updated.risk_reduction_points ?? item.riskReductionPoints,
                  }
                : item
            )
            .filter((item) => item.status !== "dismissed" && item.status !== "resolved")
        );
        setRiskActionMessage(`Action recorded: ${actionType.replaceAll("_", " ")}.`);
      } catch (err) {
        setRiskActionMessage(err instanceof Error ? err.message : "Failed to execute recommendation action.");
      } finally {
        setRiskActionLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <PredictiveModelView
      data={data}
      loading={loading}
      error={error}
      days={days}
      selectedJobsiteId={jobsiteId}
      onDaysChange={setDays}
      onJobsiteChange={setJobsiteId}
      onRefresh={() => void load()}
      riskActionRecommendations={riskActionRecommendations}
      riskActionLoading={riskActionLoading}
      riskActionMessage={riskActionMessage}
      onGenerateRiskActionPlan={() => void generateRiskActionPlan()}
      onExecuteRiskRecommendation={(id, actionType) => void updateRiskRecommendation(id, actionType)}
    />
  );
}
