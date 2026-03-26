"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
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

type DapRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  category: string;
  jobsite_id?: string | null;
  work_date?: string | null;
  updated_at: string;
};

type DapActivityRow = {
  id: string;
  dap_id: string;
  activity_name: string;
  trade: string | null;
  area: string | null;
  status: string;
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

export default function DapsPage() {
  const [daps, setDaps] = useState<DapRow[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activities, setActivities] = useState<DapActivityRow[]>([]);
  const [selectedDapId, setSelectedDapId] = useState("");
  const [activityName, setActivityName] = useState("");

  async function loadDaps() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/daps", { headers });
      const data = (await response.json().catch(() => null)) as { daps?: DapRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to load DAPs.");
      setDaps(data?.daps ?? []);
      const activityResponse = await fetch("/api/company/dap-activities", { headers });
      const activityData = (await activityResponse.json().catch(() => null)) as
        | { activities?: DapActivityRow[] }
        | null;
      if (activityResponse.ok) {
        setActivities(activityData?.activities ?? []);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load DAPs.");
      setDaps([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadDaps();
  }, []);

  async function createDap() {
    if (!title.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/daps", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          status: "draft",
          severity: "medium",
          category: "corrective_action",
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create DAP.");
      setTitle("");
      if (!selectedDapId && daps.length > 0) {
        setSelectedDapId(daps[0].id);
      }
      await loadDaps();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create DAP.");
    }
    setSaving(false);
  }

  async function createActivity() {
    if (!selectedDapId || !activityName.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/dap-activities", {
        method: "POST",
        headers,
        body: JSON.stringify({
          dapId: selectedDapId,
          activityName,
          status: "monitored",
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to create activity.");
      setActivityName("");
      await loadDaps();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create activity.");
    }
    setSaving(false);
  }

  async function updateStatus(item: DapRow, status: string) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/company/daps", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: item.id, status }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to update DAP.");
      await loadDaps();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update DAP.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Safety Modules"
        title="Daily Action Plans"
        description="Manage DAP lifecycle by draft, active, and closed states."
        actions={
          <Link href="/dashboard" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Back to Dashboard
          </Link>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard title="Create DAP" description="Start a daily action plan for field operations.">
        <div className="flex flex-wrap gap-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="DAP title"
            className="min-w-[260px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void createDap()}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create DAP"}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Planned Activities -> Live View"
        description="Add planned activities to a DAP. These become monitored activities for daily live observations."
      >
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedDapId}
            onChange={(event) => setSelectedDapId(event.target.value)}
            className="min-w-[260px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select DAP</option>
            {daps.map((dap) => (
              <option key={dap.id} value={dap.id}>
                {dap.title}
              </option>
            ))}
          </select>
          <input
            value={activityName}
            onChange={(event) => setActivityName(event.target.value)}
            placeholder="Planned activity name"
            className="min-w-[260px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void createActivity()}
            disabled={saving || !selectedDapId || !activityName.trim()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Add Activity
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {activities
            .filter((item) => !selectedDapId || item.dap_id === selectedDapId)
            .slice(0, 8)
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="text-sm text-slate-900">{item.activity_name}</div>
                <div className="flex gap-2">
                  <Link
                    href={`/field-id-exchange?dapActivityId=${encodeURIComponent(item.id)}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Create Observation
                  </Link>
                  <Link
                    href={`/permits?dapActivityId=${encodeURIComponent(item.id)}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Link Permit
                  </Link>
                </div>
              </div>
            ))}
        </div>
      </SectionCard>

      <SectionCard title="DAP Board" description="Operational DAP list with quick status transitions.">
        {loading ? (
          <InlineMessage>Loading DAPs...</InlineMessage>
        ) : daps.length === 0 ? (
          <EmptyState title="No DAPs yet" description="Create a DAP to start daily planning." />
        ) : (
          <div className="space-y-3">
            {daps.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.category} · {item.severity}</div>
                  </div>
                  <StatusBadge label={item.status} tone={item.status === "active" ? "success" : item.status === "closed" ? "neutral" : "info"} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void updateStatus(item, "submitted")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Submit DAP</button>
                  <button onClick={() => void updateStatus(item, "active")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Set Active</button>
                  <button onClick={() => void updateStatus(item, "closed")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Close</button>
                  <button onClick={() => void updateStatus(item, "draft")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Reopen Draft</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
