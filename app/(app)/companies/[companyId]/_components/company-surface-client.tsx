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
        if (!response.ok) throw new Error(String(data?.error ?? "Failed to load company surface."));
        if (!cancelled) setPayload(data ?? {});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, surface]);

  return (
    <SectionCard title={title} description={description}>
      {loading ? <InlineMessage>Loading...</InlineMessage> : null}
      {!loading && error ? <InlineMessage tone={errorTone}>{error}</InlineMessage> : null}
      {!loading && !error ? (
        <pre className="overflow-auto rounded-xl border border-slate-700/80 bg-slate-950/50 p-4 text-xs text-slate-300">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </SectionCard>
  );
}
