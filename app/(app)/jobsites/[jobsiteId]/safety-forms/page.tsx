"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import type { SafetyFormField } from "@/lib/safetyForms/schema";

const supabase = getSupabaseBrowserClient();

type Definition = { id: string; title: string; active: boolean };
type Version = { id: string; version: number; schema: { fields?: SafetyFormField[] } };

export default function JobsiteSafetyFormsPage() {
  const routeParams = useParams();
  const jobsiteId = typeof routeParams?.jobsiteId === "string" ? routeParams.jobsiteId : "";
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [defId, setDefId] = useState("");
  const [version, setVersion] = useState<Version | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");

  const fields = useMemo(() => version?.schema?.fields ?? [], [version]);

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/safety-forms/definitions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => null)) as { definitions?: Definition[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to load.");
      const defs = (data?.definitions ?? []).filter((d) => d.active !== false);
      setDefinitions(defs);
      setDefId((current) => current || (defs[0]?.id ?? ""));
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Load failed.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    if (!defId) {
      setVersion(null);
      return;
    }
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(
          `/api/company/safety-forms/definitions/${encodeURIComponent(defId)}/versions`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const data = (await res.json().catch(() => null)) as { versions?: Version[] } | null;
        const latest = data?.versions?.[0] ?? null;
        setVersion(latest);
        setAnswers({});
      } catch {
        setVersion(null);
      }
    })();
  }, [defId]);

  async function saveDraft() {
    if (!jobsiteId || !version) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/safety-forms/submissions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobsiteId,
          versionId: version.id,
          answers,
          status: "draft",
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Save failed.");
      setTone("success");
      setMessage("Draft saved.");
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Save failed.");
    }
  }

  async function submit() {
    if (!jobsiteId || !version) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/safety-forms/submissions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobsiteId,
          versionId: version.id,
          answers,
          status: "submitted",
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Submit failed.");
      setTone("success");
      setMessage("Submitted.");
      setAnswers({});
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Submit failed.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Jobsite workspace"
        title="Safety forms"
        description="Run the latest published version for a selected company form."
        actions={
          <Link href={`/jobsites/${jobsiteId}/overview`} className={appButtonSecondaryClassName}>
            Overview
          </Link>
        }
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard title="Choose form" description="Schemas are managed under Company → Safety forms.">
        {loading ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : definitions.length === 0 ? (
          <EmptyState title="No active forms" description="Ask a company admin to publish a form definition." />
        ) : (
          <select
            value={defId}
            onChange={(e) => setDefId(e.target.value)}
            className="max-w-md rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          >
            {definitions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        )}
      </SectionCard>

      {version ? (
        <SectionCard
          title={`Runner (v${version.version})`}
          description="Required fields must be satisfied before submit."
        >
          <div className="space-y-4 max-w-xl">
            {fields.map((f) => (
              <label key={f.id} className="block text-sm text-slate-200">
                <span className="mb-1 block font-medium">
                  {f.label}
                  {f.required ? <span className="text-amber-400"> *</span> : null}
                </span>
                {f.type === "text" ? (
                  <input
                    value={String(answers[f.id] ?? "")}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
                  />
                ) : (
                  <input
                    type="checkbox"
                    checked={Boolean(answers[f.id])}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-500"
                  />
                )}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveDraft()} className={appButtonSecondaryClassName}>
                Save draft
              </button>
              <button type="button" onClick={() => void submit()} className={appButtonPrimaryClassName}>
                Submit
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
