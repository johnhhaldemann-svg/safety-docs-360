"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type Definition = { id: string; title: string; active: boolean };
type Version = { id: string; version: number; schema: { fields?: unknown[] } };

export default function CompanySafetyFormsPage() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [title, setTitle] = useState("");
  const [schemaJson, setSchemaJson] = useState(
    JSON.stringify(
      {
        fields: [
          { id: "site", label: "Jobsite acknowledgment", type: "checkbox", required: true },
          { id: "notes", label: "Notes", type: "text", required: false },
        ],
      },
      null,
      2
    )
  );
  const [extendDefId, setExtendDefId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
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
      setDefinitions(data?.definitions ?? []);
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Load failed.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDefinition() {
    if (!title.trim()) return;
    let initialSchema: unknown;
    try {
      initialSchema = JSON.parse(schemaJson) as unknown;
    } catch {
      setTone("error");
      setMessage("Schema JSON is invalid.");
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/safety-forms/definitions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: title.trim(), initialSchema }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Create failed.");
      setTitle("");
      setTone("success");
      setMessage("Form definition created with version 1.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Create failed.");
    }
  }

  async function publishVersion() {
    if (!extendDefId) return;
    let schema: unknown;
    try {
      schema = JSON.parse(schemaJson) as unknown;
    } catch {
      setTone("error");
      setMessage("Schema JSON is invalid.");
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch(
        `/api/company/safety-forms/definitions/${encodeURIComponent(extendDefId)}/versions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ schema }),
        }
      );
      const data = (await res.json().catch(() => null)) as { error?: string; version?: Version } | null;
      if (!res.ok) throw new Error(data?.error || "Publish failed.");
      setTone("success");
      setMessage(`Published version ${data?.version?.version ?? ""}.`);
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Publish failed.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company admin"
        title="Safety forms"
        description="Define versioned field schemas. Crews run submissions on the jobsite Safety forms tab."
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard title="Existing definitions" description="Each definition can have many schema versions; the jobsite uses the latest.">
        {loading ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : definitions.length === 0 ? (
          <EmptyState title="No definitions yet" description="Create one below." />
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {definitions.map((d) => (
              <li key={d.id} className="rounded-lg border border-slate-800 px-3 py-2">
                <span className="font-medium text-slate-100">{d.title}</span>
                {!d.active ? <span className="ml-2 text-xs text-amber-400">inactive</span> : null}
                <div className="text-xs text-slate-500">{d.id}</div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Create definition" description="Creates definition plus version 1 from the JSON schema.">
        <div className="flex max-w-xl flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Form title"
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <textarea
            value={schemaJson}
            onChange={(e) => setSchemaJson(e.target.value)}
            rows={12}
            className="font-mono text-xs rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 [color-scheme:dark]"
          />
          <button type="button" onClick={() => void createDefinition()} className={appButtonPrimaryClassName}>
            Create
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Publish new version" description="Pick a definition and publish the schema below as the next version.">
        <div className="flex max-w-xl flex-col gap-2">
          <select
            value={extendDefId}
            onChange={(e) => setExtendDefId(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          >
            <option value="">Select definition…</option>
            {definitions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void publishVersion()} className={appButtonSecondaryClassName}>
            Publish version
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
