"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { InlineMessage, SectionCard } from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function CompanySurfaceClient({
  companyId,
  surface,
  title,
  description,
}: {
  companyId: string;
  surface: "overview" | "users" | "jobsites" | "documents" | "analytics";
  title: string;
  description: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorTone, setErrorTone] = useState<"error" | "warning">("error");
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setErrorTone("error");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Missing auth token.");
        const response = await fetch(`/api/companies/${companyId}/${surface}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (!response.ok) {
          // #region agent log
          fetch("http://127.0.0.1:7613/ingest/cee4d426-76d4-454a-9d6d-950241152e62", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be144" },
            body: JSON.stringify({
              sessionId: "1be144",
              runId: "surface-client",
              hypothesisId: "H-company-surface-fetch",
              location: "company-surface-client.tsx:load",
              message: "company surface API not ok",
              data: { status: response.status, surface },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          const err = typeof data?.error === "string" ? data.error.trim() : "";
          const warn = typeof data?.warning === "string" ? data.warning.trim() : "";
          if (!cancelled) {
            setError(err || warn || "Failed to load company surface.");
            setErrorTone(err ? "error" : "warning");
            setPayload(null);
          }
        } else if (!cancelled) {
          setPayload(data ?? {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setErrorTone("error");
        }
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, surface]);

  const overviewAnalyticsIssue =
    surface === "overview" &&
    payload?.overview &&
    typeof payload.overview === "object" &&
    payload.overview !== null
      ? (() => {
          const raw = (payload.overview as Record<string, unknown>).analyticsSummaryIssue;
          return typeof raw === "string" ? raw.trim() : "";
        })()
      : "";

  return (
    <SectionCard title={title} description={description}>
      {loading ? <InlineMessage>Loading...</InlineMessage> : null}
      {!loading && error ? <InlineMessage tone={errorTone}>{error}</InlineMessage> : null}
      {!loading && !error && payload ? (
        <div className="space-y-4">
          {overviewAnalyticsIssue ? (
            <InlineMessage tone="warning">{overviewAnalyticsIssue}</InlineMessage>
          ) : null}
          <pre className="overflow-auto rounded-xl border border-slate-700/80 bg-slate-950/50 p-4 text-xs text-slate-300">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      ) : null}
    </SectionCard>
  );
}
