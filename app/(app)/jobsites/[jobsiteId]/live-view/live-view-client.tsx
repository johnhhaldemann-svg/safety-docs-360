"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { InlineMessage, PageHero, SectionCard, StatusBadge } from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ObservationRow = {
  id: string;
  jobsite_id: string | null;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  status:
    | "open"
    | "assigned"
    | "in_progress"
    | "corrected"
    | "verified_closed"
    | "escalated"
    | "stop_work";
  assigned_user_id: string | null;
  due_at: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  dap_activity_id?: string | null;
  workflow_status?: string | null;
  evidence_count?: number;
};

type PermitRow = {
  id: string;
  jobsite_id: string | null;
  permit_type: string;
  status: string;
  observation_id?: string | null;
};

type ActivityCardRow = {
  id: string;
  dap_id: string;
  jobsite_id: string | null;
  work_date: string | null;
  trade: string | null;
  activity_name: string;
  area: string | null;
  hazard_category: string | null;
  permit_required: boolean;
  permit_type: string | null;
  status: "not_started" | "active" | "paused" | "completed" | string;
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

function isOpenStatus(status: string) {
  return status !== "verified_closed";
}

function durationSince(iso: string) {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return "-";
  const diffMs = Math.max(0, Date.now() - start);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export function JobsiteLiveViewClient({ jobsiteId }: { jobsiteId: string }) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ObservationRow[]>([]);
  const [activityCards, setActivityCards] = useState<ActivityCardRow[]>([]);
  const [permits, setPermits] = useState<PermitRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddDescription, setQuickAddDescription] = useState("");
  const [quickAddSeverity, setQuickAddSeverity] = useState("medium");
  const [quickAddCategory, setQuickAddCategory] = useState("hazard");
  const [openOnly, setOpenOnly] = useState(false);
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [sifOnly, setSifOnly] = useState(false);
  const [tradeFilter, setTradeFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [permitTypeFilter, setPermitTypeFilter] = useState("all");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const [liveResponse, permitsResponse] = await Promise.all([
        fetch(`/api/jobsites/${jobsiteId}/live-view`, { headers }),
        fetch("/api/company/permits", { headers }),
      ]);

      const livePayload = (await liveResponse.json().catch(() => null)) as
        | { observations?: ObservationRow[]; activities?: ActivityCardRow[]; error?: string }
        | null;
      const permitsPayload = (await permitsResponse.json().catch(() => null)) as
        | { permits?: PermitRow[]; error?: string }
        | null;

      if (!liveResponse.ok) throw new Error(livePayload?.error || "Failed to load live observations.");
      if (!permitsResponse.ok) throw new Error(permitsPayload?.error || "Failed to load permits.");

      setRows((livePayload?.observations ?? []).filter((row) => row.jobsite_id === jobsiteId));
      setActivityCards(
        (livePayload?.activities ?? []).filter((row) => row.jobsite_id === jobsiteId)
      );
      setPermits((permitsPayload?.permits ?? []).filter((item) => item.jobsite_id === jobsiteId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load jobsite live view.");
      setRows([]);
      setActivityCards([]);
      setPermits([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsiteId]);

  const permitByObservationId = useMemo(() => {
    const map = new Map<string, PermitRow[]>();
    for (const permit of permits) {
      const obsId = permit.observation_id ?? "";
      if (!obsId) continue;
      map.set(obsId, [...(map.get(obsId) ?? []), permit]);
    }
    return map;
  }, [permits]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const area = row.title.split("-")[0]?.trim() || "General";
      const trade = row.category || "general";
      const responsible = row.assigned_user_id || "unassigned";
      const linkedPermitTypes = (permitByObservationId.get(row.id) ?? []).map((item) => item.permit_type);
      const isSif = row.category === "near_miss" || row.workflow_status === "escalated" || row.workflow_status === "stop_work";
      const isHigh = row.severity === "high" || row.severity === "critical";

      if (openOnly && !isOpenStatus(row.status)) return false;
      if (highRiskOnly && !isHigh) return false;
      if (sifOnly && !isSif) return false;
      if (tradeFilter !== "all" && trade !== tradeFilter) return false;
      if (areaFilter !== "all" && area !== areaFilter) return false;
      if (responsibleFilter !== "all" && responsible !== responsibleFilter) return false;
      if (permitTypeFilter !== "all" && !linkedPermitTypes.includes(permitTypeFilter)) return false;
      return true;
    });
  }, [
    rows,
    permitByObservationId,
    openOnly,
    highRiskOnly,
    sifOnly,
    tradeFilter,
    areaFilter,
    responsibleFilter,
    permitTypeFilter,
  ]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const closedToday = filtered.filter((row) => row.closed_at?.slice(0, 10) === todayKey).length;
  const openCount = filtered.filter((row) => isOpenStatus(row.status)).length;
  const highRiskCount = filtered.filter(
    (row) => row.severity === "high" || row.severity === "critical"
  ).length;
  const sifCount = filtered.filter(
    (row) => row.category === "near_miss" || row.workflow_status === "escalated" || row.workflow_status === "stop_work"
  ).length;
  const activePermits = permits.filter((item) => item.status === "active").length;
  const activeToday = filtered.filter((row) => row.created_at.slice(0, 10) === todayKey).length;

  async function patchObservation(id: string, body: Record<string, unknown>) {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/company/observations/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || "Action failed.");
  }

  async function closeObservation(id: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/company/observations/${id}/close`, {
      method: "POST",
      headers,
      body: JSON.stringify({ managerOverride: true, managerOverrideReason: "Verified in live view." }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || "Failed to verify closure.");
  }

  async function runAction(action: () => Promise<void>) {
    setMessage("");
    try {
      await action();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function patchActivityStatus(id: string, status: "active" | "paused" | "completed") {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/company/dap-activities", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id, status }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || "Failed to update activity status.");
  }

  async function createObservationFromActivity(activity: ActivityCardRow) {
    const headers = await getAuthHeaders();
    const title = `${activity.area || "General"} - ${activity.activity_name}`;
    const descriptionParts = [
      activity.trade ? `Trade: ${activity.trade}` : null,
      activity.hazard_category ? `Hazard Category: ${activity.hazard_category}` : null,
      `Permit Required: ${activity.permit_required ? "Yes" : "No"}`,
      activity.permit_type ? `Permit Type: ${activity.permit_type}` : null,
    ].filter(Boolean);
    const response = await fetch("/api/company/observations", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description: descriptionParts.join(" | "),
        severity: "medium",
        category: "hazard",
        observationType: "negative",
        sifPotential: false,
        status: "open",
        dapActivityId: activity.id,
        jobsiteId,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || "Failed to create observation from activity.");
  }

  async function createQuickObservation() {
    const title = quickAddTitle.trim();
    if (!title) {
      setMessage("Observation title is required.");
      return;
    }
    const headers = await getAuthHeaders();
    const response = await fetch("/api/company/observations", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description: quickAddDescription.trim() || null,
        severity: quickAddSeverity,
        category: quickAddCategory,
        observationType: "negative",
        sifPotential: false,
        status: "open",
        jobsiteId,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || "Failed to create observation.");
    setQuickAddTitle("");
    setQuickAddDescription("");
    setQuickAddSeverity("medium");
    setQuickAddCategory("hazard");
    setQuickAddOpen(false);
  }

  const tradeOptions = Array.from(new Set(rows.map((row) => row.category || "general")));
  const areaOptions = Array.from(new Set(rows.map((row) => row.title.split("-")[0]?.trim() || "General")));
  const responsibleOptions = Array.from(new Set(rows.map((row) => row.assigned_user_id || "unassigned")));
  const permitTypeOptions = Array.from(new Set(permits.map((item) => item.permit_type).filter(Boolean)));

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Jobsite Workspace"
        title="Live View"
        description="Real-time observation matrix and action workflow for this jobsite."
      />
      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active tasks today", value: activeToday },
          { label: "Open observations", value: openCount },
          { label: "High-risk observations", value: highRiskCount },
          { label: "SIF-potential observations", value: sifCount },
          { label: "Active permits", value: activePermits },
          { label: "Closed today", value: closedToday },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 text-3xl font-black text-white">{loading ? "-" : card.value}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.65fr_0.75fr]">
        <div className="space-y-6">
          <SectionCard
            title="Today Activity Cards"
            description="Auto-created from submitted DAP activities with direct observation creation."
          >
            {activityCards.length < 1 ? (
              <InlineMessage tone="neutral">No activity cards for today yet.</InlineMessage>
            ) : (
              <div className="space-y-2">
                {activityCards.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{activity.activity_name}</div>
                        <div className="text-xs text-slate-500">
                          {activity.trade || "trade n/a"} - {activity.area || "area n/a"} -{" "}
                          {activity.hazard_category || "hazard n/a"} - Permit{" "}
                          {activity.permit_required ? `required (${activity.permit_type || "type n/a"})` : "not required"}
                        </div>
                      </div>
                      <StatusBadge label={activity.status} tone={activity.status === "completed" ? "success" : "info"} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => void runAction(() => patchActivityStatus(activity.id, "active"))}>Set Active</button>
                      <button className="rounded border px-2 py-1" onClick={() => void runAction(() => patchActivityStatus(activity.id, "paused"))}>Pause</button>
                      <button className="rounded border px-2 py-1" onClick={() => void runAction(() => patchActivityStatus(activity.id, "completed"))}>Complete</button>
                      <button className="rounded border px-2 py-1" onClick={() => void runAction(() => createObservationFromActivity(activity))}>Create Observation</button>
                      <Link className="rounded border px-2 py-1" href={`/field-id-exchange?dapActivityId=${encodeURIComponent(activity.id)}`}>
                        Open Prefilled Form
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Main Observation Matrix" description="Live observations, controls, and response workflow.">
          <div className="mb-3 md:hidden space-y-2">
            {filtered.map((row) => (
              <div key={`mobile-${row.id}`} className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{row.title}</div>
                    <div className="text-xs text-slate-500">{row.category} · {row.severity}</div>
                  </div>
                  <StatusBadge label={row.status} tone={row.status === "verified_closed" ? "success" : "info"} />
                </div>
                <div className="mt-2 text-xs text-slate-500">{row.description ?? "-"}</div>
                <div className="mt-2 flex gap-2">
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => setSelectedId(row.id)}>Details</button>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => void runAction(() => patchObservation(row.id, { status: "corrected" }))}>Corrected</button>
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-auto">
            <table className="min-w-[1500px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700/80 text-slate-500">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Area</th>
                  <th className="px-2 py-2">Trade</th>
                  <th className="px-2 py-2">Activity</th>
                  <th className="px-2 py-2">Hazard Category</th>
                  <th className="px-2 py-2">Observation Type</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Risk Level</th>
                  <th className="px-2 py-2">Controls / Corrective Action</th>
                  <th className="px-2 py-2">Responsible Party</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">SIF Potential</th>
                  <th className="px-2 py-2">Photo Count</th>
                  <th className="px-2 py-2">Time Open</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const area = row.title.split("-")[0]?.trim() || "General";
                  const trade = row.category || "general";
                  const isSif =
                    row.category === "near_miss" ||
                    row.workflow_status === "escalated" ||
                    row.workflow_status === "stop_work";
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-700/60 align-top ${
                        row.status === "stop_work" ? "bg-amber-950/40" : ""
                      }`}
                    >
                      <td className="px-2 py-2">{new Date(row.created_at).toLocaleTimeString()}</td>
                      <td className="px-2 py-2">{area}</td>
                      <td className="px-2 py-2">{trade}</td>
                      <td className="px-2 py-2">{row.dap_activity_id ? `DAP ${row.dap_activity_id.slice(0, 8)}` : "Ad-hoc"}</td>
                      <td className="px-2 py-2">{row.category}</td>
                      <td className="px-2 py-2">{row.category === "near_miss" ? "near_miss" : "negative"}</td>
                      <td className="px-2 py-2">{row.description ?? "-"}</td>
                      <td className="px-2 py-2">{row.severity}</td>
                      <td className="px-2 py-2">{row.title}</td>
                      <td className="px-2 py-2">{row.assigned_user_id ?? "unassigned"}</td>
                      <td className="px-2 py-2">
                        <StatusBadge
                          label={row.status}
                          tone={row.status === "verified_closed" ? "success" : row.status === "stop_work" ? "warning" : "info"}
                        />
                      </td>
                      <td className="px-2 py-2">{isSif ? "Yes" : "No"}</td>
                      <td className="px-2 py-2">{row.evidence_count ?? 0}</td>
                      <td className="px-2 py-2">{durationSince(row.created_at)}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button className="rounded border px-2 py-1" onClick={() => setSelectedId(row.id)}>View details</button>
                          <button
                            className="rounded border px-2 py-1"
                            onClick={() =>
                              void runAction(async () => {
                                const text = window.prompt("Edit description", row.description ?? "");
                                if (text === null) return;
                                await patchObservation(row.id, { description: text });
                              })
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="rounded border px-2 py-1"
                            onClick={() =>
                              void runAction(async () => {
                                const userId = window.prompt("Assign user id");
                                if (!userId) return;
                                await patchObservation(row.id, { assignedUserId: userId });
                              })
                            }
                          >
                            Assign
                          </button>
                          <Link className="rounded border px-2 py-1" href="/field-id-exchange">
                            Add photo
                          </Link>
                          <button className="rounded border px-2 py-1" onClick={() => void runAction(() => patchObservation(row.id, { status: "corrected" }))}>Mark corrected</button>
                          <button className="rounded border px-2 py-1" onClick={() => void runAction(() => closeObservation(row.id))}>Verify closure</button>
                          <button className="rounded border px-2 py-1" onClick={() => void runAction(() => patchObservation(row.id, { status: "escalated" }))}>Escalate</button>
                          <button className="rounded border px-2 py-1" onClick={() => void runAction(() => patchObservation(row.id, { convertToIncident: true, incidentType: "incident", status: "escalated" }))}>Convert to incident</button>
                          <Link className="rounded border px-2 py-1" href={`/permits?observationId=${encodeURIComponent(row.id)}`}>Link permit</Link>
                          <button
                            className="rounded border px-2 py-1"
                            onClick={() =>
                              void runAction(async () => {
                                const dapActivityId = window.prompt("DAP activity id");
                                if (!dapActivityId) return;
                                await patchObservation(row.id, { dapActivityId });
                              })
                            }
                          >
                            Link DAP activity
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length < 1 ? (
            <InlineMessage tone="neutral">No live observations match the current filters.</InlineMessage>
          ) : null}
          </SectionCard>
        </div>

        <SectionCard title="Right-side Filters" description="Refine the live observation matrix.">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              Open only
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={highRiskOnly} onChange={(e) => setHighRiskOnly(e.target.checked)} />
              High risk only
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sifOnly} onChange={(e) => setSifOnly(e.target.checked)} />
              SIF only
            </label>

            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">By trade</div>
              <select className="w-full rounded border px-2 py-1.5" value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}>
                <option value="all">All</option>
                {tradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">By area</div>
              <select className="w-full rounded border px-2 py-1.5" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="all">All</option>
                {areaOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">By responsible party</div>
              <select className="w-full rounded border px-2 py-1.5" value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)}>
                <option value="all">All</option>
                {responsibleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">By permit type</div>
              <select className="w-full rounded border px-2 py-1.5" value={permitTypeFilter} onChange={(e) => setPermitTypeFilter(e.target.value)}>
                <option value="all">All</option>
                {permitTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>
      </div>

      {selectedId ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setSelectedId(null)} aria-label="Close details panel" />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-slate-700/80 bg-slate-900/90 p-4 shadow-2xl">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Observation Details</div>
            <div className="mb-3 text-sm text-slate-300">{selectedId}</div>
            <pre className="h-[70vh] overflow-auto rounded-xl border border-slate-700/80 bg-slate-950/50 p-3 text-xs">
              {JSON.stringify(rows.find((row) => row.id === selectedId) ?? {}, null, 2)}
            </pre>
            <button className="mt-3 rounded border px-3 py-1.5 text-sm" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </aside>
        </>
      ) : null}

      <button
        type="button"
        className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#4f7cff_0%,_#5b6cff_100%)] text-3xl font-semibold text-white shadow-[0_12px_30px_rgba(79,124,255,0.35)]"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Quick add observation"
      >
        +
      </button>

      {quickAddOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setQuickAddOpen(false)} aria-label="Close quick add panel" />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-slate-700/80 bg-slate-900/90 p-4 shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Add</div>
            <div className="mt-1 text-lg font-bold text-slate-100">New Observation</div>
            <div className="mt-4 space-y-3">
              <input value={quickAddTitle} onChange={(e) => setQuickAddTitle(e.target.value)} placeholder="Title" className="w-full rounded border px-3 py-2 text-sm" />
              <textarea value={quickAddDescription} onChange={(e) => setQuickAddDescription(e.target.value)} rows={4} placeholder="Description" className="w-full rounded border px-3 py-2 text-sm" />
              <select value={quickAddSeverity} onChange={(e) => setQuickAddSeverity(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select value={quickAddCategory} onChange={(e) => setQuickAddCategory(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                <option value="hazard">Hazard</option>
                <option value="near_miss">Near Miss</option>
                <option value="unsafe_condition">Unsafe Condition</option>
              </select>
              <div className="flex gap-2">
                <button className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => void runAction(createQuickObservation)}>
                  Save Observation
                </button>
                <button className="rounded border px-4 py-2 text-sm" onClick={() => setQuickAddOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
