"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type EvalResult = {
  status: "eligible" | "blocked";
  reasons: string[];
  missingProgramIds: string[];
};

export default function JobsiteInductionsPage() {
  const routeParams = useParams();
  const jobsiteId = typeof routeParams?.jobsiteId === "string" ? routeParams.jobsiteId : "";
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [recordProgramId, setRecordProgramId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const load = useCallback(async () => {
    if (!jobsiteId) return;
    setLoading(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const h = { Authorization: `Bearer ${session.access_token}` };
      const [pRes, eRes] = await Promise.all([
        fetch("/api/company/inductions/programs", { headers: h }),
        fetch(
          `/api/company/inductions/evaluate?jobsiteId=${encodeURIComponent(jobsiteId)}`,
          { headers: h }
        ),
      ]);
      const pJson = (await pRes.json().catch(() => null)) as { programs?: Array<{ id: string; name: string }> } | null;
      const eJson = (await eRes.json().catch(() => null)) as EvalResult & { error?: string } | null;
      if (!pRes.ok) throw new Error((pJson as { error?: string })?.error || "Failed to load programs.");
      if (!eRes.ok) throw new Error(eJson?.error || "Failed to evaluate access.");
      setPrograms((pJson?.programs ?? []).filter((p) => (p as { active?: boolean }).active !== false));
      setEvalResult({
        status: eJson!.status,
        reasons: eJson!.reasons ?? [],
        missingProgramIds: eJson!.missingProgramIds ?? [],
      });
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Load failed.");
    }
    setLoading(false);
  }, [jobsiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recordCompletion() {
    if (!recordProgramId || !jobsiteId) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const body: Record<string, unknown> = {
        programId: recordProgramId,
        jobsiteId,
        userId: session.user.id,
      };
      if (expiresAt.trim()) body.expiresAt = new Date(expiresAt).toISOString();
      const res = await fetch("/api/company/inductions/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to record.");
      setTone("success");
      setMessage("Completion recorded.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Jobsite workspace"
        title="Inductions"
        description="Site access readiness for your account on this jobsite. Supervisors record completions after orientation."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/jobsites/${jobsiteId}/overview`} className={appButtonSecondaryClassName}>
              Overview
            </Link>
            <Link href="/company-inductions" className={appButtonSecondaryClassName}>
              Company setup
            </Link>
          </div>
        }
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard title="Access status" description="Based on active programs and requirements for this jobsite.">
        {loading || !jobsiteId ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : evalResult ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge
                label={evalResult.status === "eligible" ? "Eligible" : "Blocked"}
                tone={evalResult.status === "eligible" ? "success" : "warning"}
              />
            </div>
            {evalResult.reasons.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                {evalResult.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No induction gaps for this jobsite.</p>
            )}
          </div>
        ) : (
          <EmptyState title="No evaluation" description="Try refreshing the page." />
        )}
      </SectionCard>

      <SectionCard
        title="Record my completion"
        description="After you finish the site induction, record it here. Expiry is optional (ISO local datetime)."
      >
        <div className="flex flex-wrap gap-2">
          <select
            value={recordProgramId}
            onChange={(e) => setRecordProgramId(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          >
            <option value="">Select program…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <button type="button" onClick={() => void recordCompletion()} className={appButtonPrimaryClassName}>
            Record completion
          </button>
        </div>
        {programs.length === 0 && !loading ? (
          <p className="mt-3 text-sm text-slate-500">
            No active programs yet. Ask a company admin to configure programs under Company setup.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}
