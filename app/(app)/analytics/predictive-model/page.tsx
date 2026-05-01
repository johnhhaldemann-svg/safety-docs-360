"use client";

import { useCallback, useEffect, useState } from "react";
import { PredictiveModelView } from "@/components/analytics/PredictiveModelView";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

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
  const [days, setDays] = useState(30);
  const [jobsiteId, setJobsiteId] = useState("");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load predictive risk.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days, jobsiteId]);

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
    />
  );
}
