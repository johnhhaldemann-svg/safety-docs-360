"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type IncidentRow = {
  id: string;
  title: string;
  status: string;
  category: string;
  severity: string;
  sif_flag: boolean;
  escalation_level: string;
  stop_work_status: string;
  created_at: string;
};

const EMPTY_FORM = {
  title: "",
  category: "incident",
  severity: "medium",
  observationId: "",
  dapActivityId: "",
};

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Missing auth token.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function IncidentsPage() {
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");

  async function loadIncidents() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/company/incidents${query}`, { headers });
      const data = (await response.json().catch(() => null)) as { incidents?: IncidentRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load incidents.");
      setIncidents(data?.incidents ?? []);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load incidents.");
      setIncidents([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const observationId = searchParams.get("observationId")?.trim() ?? "";
    if (observationId) {
      setForm((current) => ({ ...current, observationId }));
    }
    void loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchParams]);

  const counts = useMemo(
    () => ({
      total: incidents.length,
      open: incidents.filter((item) => item.status !== "closed").length,
      sif: incidents.filter((item) => item.sif_flag).length,
      stopWork: incidents.filter((item) => item.stop_work_status === "stop_work_active").length,
    }),
    [incidents]
  );

  async function createIncident() {
    if (!form.title.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/incidents", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          severity: form.severity,
          status: "open",
          escalationLevel: "none",
          stopWorkStatus: "normal",
          sifFlag: form.category === "incident",
          observationId: form.observationId || null,
          dapActivityId: form.dapActivityId || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create incident.");
      setForm(EMPTY_FORM);
      setMessageTone("success");
      setMessage("Incident created.");
      await loadIncidents();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to create incident.");
    }
    setSaving(false);
  }

  async function updateIncident(item: IncidentRow, updates: Record<string, unknown>) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/incidents", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: item.id, ...updates }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to update incident.");
      await loadIncidents();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update incident.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Safety Modules"
        title="Incidents"
        description="Track incidents and near misses with SIF, escalation, and stop-work controls."
        actions={
          <Link href="/dashboard" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Back to Dashboard
          </Link>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Total</div><div className="mt-2 text-3xl font-black">{counts.total}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Open</div><div className="mt-2 text-3xl font-black">{counts.open}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">SIF</div><div className="mt-2 text-3xl font-black">{counts.sif}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Stop Work</div><div className="mt-2 text-3xl font-black">{counts.stopWork}</div></div>
      </section>

      <SectionCard title="Create Incident / Near Miss" description="Capture event details and classify risk immediately.">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Incident title" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <option value="incident">Incident</option>
            <option value="near_miss">Near Miss</option>
            <option value="hazard">Hazard</option>
          </select>
          <select value={form.severity} onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input
            value={form.observationId}
            onChange={(event) => setForm((prev) => ({ ...prev, observationId: event.target.value }))}
            placeholder="Observation ID (optional)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
          <input
            value={form.dapActivityId}
            onChange={(event) => setForm((prev) => ({ ...prev, dapActivityId: event.target.value }))}
            placeholder="DAP Activity ID (optional)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="mt-4">
          <button onClick={() => void createIncident()} disabled={saving || !form.title.trim()} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Creating..." : "Create Incident"}
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Incident Operations" description="Manage lifecycle and high-risk controls.">
        <div className="mb-4">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        {loading ? (
          <InlineMessage>Loading incidents...</InlineMessage>
        ) : incidents.length === 0 ? (
          <EmptyState title="No incidents yet" description="Log your first incident or near miss to begin tracking." />
        ) : (
          <div className="space-y-3">
            {incidents.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.category} · {item.severity}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={item.status} tone={item.status === "closed" ? "neutral" : item.status === "in_progress" ? "info" : "warning"} />
                    <StatusBadge label={item.escalation_level} tone={item.escalation_level === "critical" ? "warning" : "info"} />
                    <StatusBadge label={item.stop_work_status} tone={item.stop_work_status === "stop_work_active" ? "warning" : "neutral"} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void updateIncident(item, { status: item.status === "open" ? "in_progress" : item.status === "in_progress" ? "closed" : "open" })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Cycle Status
                  </button>
                  <button onClick={() => void updateIncident(item, { sifFlag: !item.sif_flag })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {item.sif_flag ? "Unset SIF" : "Set SIF"}
                  </button>
                  <button onClick={() => void updateIncident(item, { escalationLevel: item.escalation_level === "none" ? "critical" : "none" })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {item.escalation_level === "none" ? "Escalate" : "Clear Escalation"}
                  </button>
                  <button
                    onClick={() =>
                      void updateIncident(item, item.stop_work_status === "stop_work_active"
                        ? { stopWorkStatus: "cleared", stopWorkReason: "Cleared by operations lead." }
                        : { stopWorkStatus: "stop_work_active", stopWorkReason: "Unsafe condition requires stop work." })
                    }
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700"
                  >
                    {item.stop_work_status === "stop_work_active" ? "Clear Stop Work" : "Stop Work"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
