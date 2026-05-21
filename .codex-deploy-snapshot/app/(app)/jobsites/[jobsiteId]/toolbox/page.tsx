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
import {
  enqueueToolboxOperation,
  listQueuedToolboxOperations,
  removeQueuedToolboxOperation,
} from "@/lib/fieldSync/offlineQueue";

const supabase = getSupabaseBrowserClient();

type SessionRow = {
  id: string;
  status: string;
  conducted_at: string;
  updated_at: string;
  notes: string | null;
  template_id: string | null;
  linked_corrective_action_id: string | null;
};

type TemplateRow = { id: string; name: string };

export default function JobsiteToolboxPage() {
  const routeParams = useParams();
  const jobsiteId = typeof routeParams?.jobsiteId === "string" ? routeParams.jobsiteId : "";
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [templateId, setTemplateId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);

  const load = useCallback(async () => {
    if (!jobsiteId) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const h = { Authorization: `Bearer ${session.access_token}` };
      const [sRes, tRes] = await Promise.all([
        fetch(`/api/company/toolbox/sessions?jobsiteId=${encodeURIComponent(jobsiteId)}`, { headers: h }),
        fetch("/api/company/toolbox/templates", { headers: h }),
      ]);
      const sJson = (await sRes.json().catch(() => null)) as { sessions?: SessionRow[]; error?: string } | null;
      const tJson = (await tRes.json().catch(() => null)) as { templates?: TemplateRow[] } | null;
      if (!sRes.ok) throw new Error(sJson?.error || "Failed to load sessions.");
      setSessions(sJson?.sessions ?? []);
      const tpl = (tJson?.templates ?? []) as Array<{ id: string; name: string; active?: boolean }>;
      setTemplates(tpl.filter((t) => t.active !== false).map((t) => ({ id: t.id, name: t.name })));
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Load failed.");
    }
    setLoading(false);
  }, [jobsiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined" || !("indexedDB" in window)) return;
    void listQueuedToolboxOperations()
      .then((q) => setQueuedCount(q.length))
      .catch(() => setQueuedCount(0));
  }, [sessions]);

  async function startSession() {
    if (!jobsiteId) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/toolbox/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobsiteId,
          templateId: templateId || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; session?: SessionRow } | null;
      if (!res.ok) throw new Error(data?.error || "Failed.");
      setTone("success");
      setMessage("Session started.");
      setActiveSessionId(data?.session?.id ?? null);
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function addAttendee() {
    const sid = activeSessionId ?? sessions.find((s) => s.status === "draft")?.id;
    if (!sid || !guestName.trim()) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch(`/api/company/toolbox/sessions/${encodeURIComponent(sid)}/attendees`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ guestName: guestName.trim(), signed: true }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed.");
      setGuestName("");
      setTone("success");
      setMessage("Attendee added.");
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function queueCompleteOffline(sid: string) {
    const row = sessions.find((s) => s.id === sid);
    if (!row) return;
    try {
      await enqueueToolboxOperation({
        kind: "toolbox_session_upsert",
        sessionId: sid,
        ifUnmodifiedSince: row.updated_at,
        patch: { status: "completed" },
      });
      setTone("success");
      setMessage("Completion queued for sync when you are back online.");
      const q = await listQueuedToolboxOperations();
      setQueuedCount(q.length);
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Queue failed.");
    }
  }

  async function flushQueuedOps() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const queued = await listQueuedToolboxOperations();
      if (!queued.length) {
        setTone("neutral");
        setMessage("Nothing queued.");
        return;
      }
      const operations = queued.map((q) => ({
        opId: q.localId,
        ...(q.operation as Record<string, unknown>),
      }));
      const res = await fetch("/api/company/field-sync/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operations }),
      });
      const data = (await res.json().catch(() => null)) as {
        results?: Array<{ opId: string; ok: boolean; conflict?: boolean; error?: string }>;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Sync failed.");
      for (const r of data?.results ?? []) {
        if (r.ok) {
          await removeQueuedToolboxOperation(r.opId);
        }
      }
      const conflicts = (data?.results ?? []).filter((r) => r.conflict).length;
      setTone(conflicts ? "warning" : "success");
      setMessage(
        conflicts
          ? `Synced with ${conflicts} conflict(s); resolve on server and re-queue if needed.`
          : "Queued operations processed."
      );
      const q = await listQueuedToolboxOperations();
      setQueuedCount(q.length);
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Sync failed.");
    }
  }

  async function completeSession(sid: string) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch(`/api/company/toolbox/sessions/${encodeURIComponent(sid)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "completed" }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed.");
      setTone("success");
      setMessage("Session completed.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  }

  const draft = sessions.find((s) => s.status === "draft");

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Jobsite workspace"
        title="Toolbox talks"
        description="Run pre-start briefings, capture attendance, and close the session when the crew acknowledges topics."
        actions={
          <Link href={`/jobsites/${jobsiteId}/overview`} className={appButtonSecondaryClassName}>
            Overview
          </Link>
        }
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard title="Start a session" description="Optional template; then add attendees by name or user id.">
        <div className="flex flex-wrap gap-2">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void startSession()} className={appButtonPrimaryClassName}>
            New session
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Create templates via API or a future company admin page (`POST /api/company/toolbox/templates`).
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Offline pilot"
        description="Queue a completion while offline, then flush when connectivity returns. Uses IndexedDB + POST /api/company/field-sync/batch with server-wins conflicts."
      >
        <p className="text-sm text-slate-400">
          Queued operations: <strong className="text-slate-200">{queuedCount}</strong>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void flushQueuedOps()} className={appButtonPrimaryClassName}>
            Flush queue
          </button>
          {draft ? (
            <button
              type="button"
              onClick={() => void queueCompleteOffline(draft.id)}
              className={appButtonSecondaryClassName}
            >
              Queue complete (offline)
            </button>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Active draft" description="Add at least one attendee before completing.">
        {loading ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : draft ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={draft.status} tone="info" />
              <span className="text-xs text-slate-500">{new Date(draft.conducted_at).toLocaleString()}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Attendee name"
                className="min-w-[10rem] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
              />
              <button type="button" onClick={() => void addAttendee()} className={appButtonPrimaryClassName}>
                Add attendee
              </button>
              <button type="button" onClick={() => void completeSession(draft.id)} className={appButtonSecondaryClassName}>
                Mark completed
              </button>
            </div>
            {draft.linked_corrective_action_id ? (
              <p className="text-xs text-slate-500">
                Linked corrective action:{" "}
                <Link href="/field-id-exchange" className="text-sky-400 underline">
                  Field log
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState title="No draft session" description="Start a new session above." />
        )}
      </SectionCard>

      <SectionCard title="Recent sessions" description="Completed talks stay on record for audits.">
        {sessions.filter((s) => s.status === "completed").length === 0 ? (
          <p className="text-sm text-slate-500">No completed sessions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {sessions
              .filter((s) => s.status === "completed")
              .map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-800 px-3 py-2">
                  {new Date(s.conducted_at).toLocaleString()}
                  {s.notes ? ` · ${s.notes}` : ""}
                </li>
              ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
