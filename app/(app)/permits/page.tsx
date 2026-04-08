"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
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

type PermitRow = {
  id: string;
  title: string;
  permit_type: string;
  status: string;
  severity: string;
  escalation_level: string;
  stop_work_status: string;
  sif_flag: boolean;
  created_at: string;
};

const EMPTY_FORM = {
  title: "",
  permitType: "hot_work",
  severity: "medium",
  dapActivityId: "",
  observationId: "",
};

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Missing auth token.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function PermitsPage() {
  const searchParams = useSearchParams();
  const [permits, setPermits] = useState<PermitRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadPermits() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/company/permits${query}`, { headers });
      const data = (await response.json().catch(() => null)) as { permits?: PermitRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load permits.");
      setPermits(data?.permits ?? []);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load permits.");
      setPermits([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const dapActivityId = searchParams.get("dapActivityId")?.trim() ?? "";
    if (dapActivityId) {
      setForm((current) => ({ ...current, dapActivityId }));
    }
    void loadPermits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchParams]);

  const counts = useMemo(
    () => ({
      total: permits.length,
      active: permits.filter((item) => item.status === "active").length,
      stopWork: permits.filter((item) => item.stop_work_status === "stop_work_active").length,
      sif: permits.filter((item) => item.sif_flag).length,
    }),
    [permits]
  );

  async function createPermit() {
    if (!form.title.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/permits", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: form.title,
          permitType: form.permitType,
          severity: form.severity,
          dapActivityId: form.dapActivityId || null,
          observationId: form.observationId || null,
          status: "draft",
          escalationLevel: "none",
          stopWorkStatus: "normal",
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create permit.");
      setForm(EMPTY_FORM);
      setMessageTone("success");
      setMessage("Permit created.");
      await loadPermits();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to create permit.");
    }
    setSaving(false);
  }

  async function updateRiskState(permit: PermitRow, updates: Record<string, unknown>) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/permits", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: permit.id, ...updates }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to update permit.");
      await loadPermits();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update permit.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Safety Modules"
        title="Permits"
        description="Manage permit lifecycle, SIF flags, escalation, and stop-work controls."
        actions={
          <Link href="/dashboard" className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300">
            Back to Dashboard
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CompanyAiAssistPanel
          surface="permits"
          title="Permit assistant"
          structuredContext={JSON.stringify({
            total: counts.total,
            active: counts.active,
            sif: counts.sif,
            stopWork: counts.stopWork,
          })}
        />
        <CompanyMemoryBankPanel />
      </div>

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Total</div><div className="mt-2 text-3xl font-black">{counts.total}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Active</div><div className="mt-2 text-3xl font-black">{counts.active}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">SIF Flagged</div><div className="mt-2 text-3xl font-black">{counts.sif}</div></div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"><div className="text-xs text-slate-500">Stop Work</div><div className="mt-2 text-3xl font-black">{counts.stopWork}</div></div>
      </section>

      <SectionCard title="Create Permit" description="Start with permit basics, then escalate/stop-work as needed.">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Permit title" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]" />
          <select value={form.permitType} onChange={(event) => setForm((prev) => ({ ...prev, permitType: event.target.value }))} className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]">
            <option value="hot_work">Hot Work</option>
            <option value="confined_space">Confined Space</option>
            <option value="electrical">Electrical</option>
            <option value="excavation">Excavation</option>
          </select>
          <select value={form.severity} onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))} className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input
            value={form.dapActivityId}
            onChange={(event) => setForm((prev) => ({ ...prev, dapActivityId: event.target.value }))}
            placeholder="DAP Activity ID (optional)"
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
          />
          <input
            value={form.observationId}
            onChange={(event) => setForm((prev) => ({ ...prev, observationId: event.target.value }))}
            placeholder="Observation ID (optional)"
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]"
          />
        </div>
        <div className="mt-4">
          <button onClick={() => void createPermit()} disabled={saving || !form.title.trim()} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Creating..." : "Create Permit"}
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Permit Operations" description="Track permit status and high-risk controls.">
        <div className="mb-4">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 [color-scheme:dark]">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        {loading ? (
          <InlineMessage>Loading permits...</InlineMessage>
        ) : permits.length === 0 ? (
          <EmptyState title="No permits yet" description="Create your first permit to start high-risk controls." />
        ) : (
          <div className="space-y-3">
            {permits.map((permit) => (
              <div key={permit.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{permit.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{permit.permit_type} · {permit.severity}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={permit.status} tone={permit.status === "active" ? "success" : permit.status === "closed" ? "neutral" : "info"} />
                    <StatusBadge label={permit.escalation_level} tone={permit.escalation_level === "critical" ? "warning" : "info"} />
                    <StatusBadge label={permit.stop_work_status} tone={permit.stop_work_status === "stop_work_active" ? "warning" : "neutral"} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void updateRiskState(permit, { status: permit.status === "active" ? "closed" : "active" })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {permit.status === "active" ? "Close" : "Activate"}
                  </button>
                  <button onClick={() => void updateRiskState(permit, { sifFlag: !permit.sif_flag })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {permit.sif_flag ? "Unset SIF" : "Set SIF"}
                  </button>
                  <button onClick={() => void updateRiskState(permit, { escalationLevel: permit.escalation_level === "none" ? "urgent" : "none" })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    {permit.escalation_level === "none" ? "Escalate" : "Clear Escalation"}
                  </button>
                  <button
                    onClick={() =>
                      void updateRiskState(permit, permit.stop_work_status === "stop_work_active"
                        ? { stopWorkStatus: "cleared", stopWorkReason: "Cleared by manager." }
                        : { stopWorkStatus: "stop_work_active", stopWorkReason: "High-risk condition detected." })
                    }
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700"
                  >
                    {permit.stop_work_status === "stop_work_active" ? "Clear Stop Work" : "Stop Work"}
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
