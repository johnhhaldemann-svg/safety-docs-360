"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useState } from "react";
import {
  appNativeSelectClassName,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type ContractorRow = { id: string; name: string };
type CrewRow = { id: string; name: string; jobsiteId: string | null };
type JobsiteRow = { id: string; name: string; status?: string | null };

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

export default function RiskMemorySettingsPage() {
  const [contractors, setContractors] = useState<ContractorRow[]>([]);
  const [crews, setCrews] = useState<CrewRow[]>([]);
  const [jobsites, setJobsites] = useState<JobsiteRow[]>([]);
  const [contractorName, setContractorName] = useState("");
  const [crewName, setCrewName] = useState("");
  const [crewJobsiteId, setCrewJobsiteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"contractor" | "crew" | null>(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const [cRes, crRes, jRes] = await Promise.all([
        fetch("/api/company/contractors", { headers }),
        fetch("/api/company/crews", { headers }),
        fetch("/api/company/jobsites", { headers }),
      ]);
      const cJson = (await cRes.json().catch(() => null)) as { contractors?: ContractorRow[]; error?: string } | null;
      const crJson = (await crRes.json().catch(() => null)) as { crews?: CrewRow[]; error?: string } | null;
      const jJson = (await jRes.json().catch(() => null)) as { jobsites?: JobsiteRow[]; error?: string } | null;
      if (!cRes.ok) throw new Error(cJson?.error || "Could not load contractors.");
      if (!crRes.ok) throw new Error(crJson?.error || "Could not load crews.");
      if (!jRes.ok) throw new Error(jJson?.error || "Could not load jobsites.");
      setContractors(cJson?.contractors ?? []);
      setCrews(crJson?.crews ?? []);
      setJobsites(jJson?.jobsites ?? []);
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to load.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function addContractor() {
    const name = contractorName.trim();
    if (!name) return;
    setSaving("contractor");
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/contractors", {
        method: "POST",
        headers,
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not add contractor.");
      setContractorName("");
      setTone("success");
      setMessage("Contractor added.");
      await loadAll();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Save failed.");
    }
    setSaving(null);
  }

  async function addCrew() {
    const name = crewName.trim();
    if (!name) return;
    setSaving("crew");
    setMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/company/crews", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          jobsiteId: crewJobsiteId.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Could not add crew.");
      setCrewName("");
      setCrewJobsiteId("");
      setTone("success");
      setMessage("Crew added.");
      await loadAll();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Save failed.");
    }
    setSaving(null);
  }

  const inputClass = "app-text-input";
  const btnClass =
    "rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHero
        eyebrow="Workspace"
        title="Risk Memory setup"
        description="Contractors and crews appear in optional Risk Memory fields on incidents and field issues. Analytics uses facet rollups after data is saved."
      />

      <p className="text-sm text-[var(--app-text)]">
        <Link
          href="/analytics#safety-risk-memory"
          className="font-semibold text-[var(--app-accent-primary)] underline-offset-2 hover:underline"
        >
          Open Analytics · Risk Memory
        </Link>
      </p>

      {message ? (
        <InlineMessage tone={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "error" ? "error" : "neutral"}>
          {message}
        </InlineMessage>
      ) : null}

      <SectionCard title="Contractors" description="Directory for facet linking and reporting.">
        {loading ? (
          <p className="text-sm text-[var(--app-text)]">Loading…</p>
        ) : (
          <>
            <ul className="mb-4 space-y-1 text-sm text-[var(--app-text-strong)]">
              {contractors.length === 0 ? (
                <li className="text-[var(--app-text)]">
                  No contractors yet. Add one below or run DB migrations if the table is missing.
                </li>
              ) : (
                contractors.map((c) => (
                  <li
                    key={c.id}
                    className="app-soft-field rounded-lg px-3 py-2 text-[var(--app-text-strong)]"
                  >
                    {c.name}
                  </li>
                ))
              )}
            </ul>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="risk-memory-new-contractor"
                  className="mb-1 block text-xs font-medium text-[var(--app-text)]"
                >
                  New contractor name
                </label>
                <input
                  id="risk-memory-new-contractor"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. ABC Concrete"
                />
              </div>
              <button
                type="button"
                className={btnClass}
                disabled={saving !== null || !contractorName.trim()}
                onClick={() => void addContractor()}
              >
                {saving === "contractor" ? "Saving…" : "Add contractor"}
              </button>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Crews"
        description="Optional jobsite scope: leave jobsite blank for company-wide crews. Field issues can filter crews by selected jobsite."
      >
        {loading ? (
          <p className="text-sm text-[var(--app-text)]">Loading…</p>
        ) : (
          <>
            <ul className="mb-4 space-y-1 text-sm text-[var(--app-text-strong)]">
              {crews.length === 0 ? (
                <li className="text-[var(--app-text)]">No crews yet.</li>
              ) : (
                crews.map((c) => (
                  <li
                    key={c.id}
                    className="app-soft-field rounded-lg px-3 py-2"
                  >
                    {c.name}
                    {c.jobsiteId ? (
                      <span className="ml-2 text-xs text-[var(--app-text)]">(jobsite-specific)</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="risk-memory-new-crew"
                  className="mb-1 block text-xs font-medium text-[var(--app-text)]"
                >
                  New crew name
                </label>
                <input
                  id="risk-memory-new-crew"
                  value={crewName}
                  onChange={(e) => setCrewName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Tower crane crew"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--app-text)]">Jobsite (optional)</label>
                <select
                  value={crewJobsiteId}
                  onChange={(e) => setCrewJobsiteId(e.target.value)}
                  className={appNativeSelectClassName}
                >
                  <option value="">Company-wide</option>
                  {jobsites.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                      {j.status ? ` (${j.status})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={btnClass}
                disabled={saving !== null || !crewName.trim()}
                onClick={() => void addCrew()}
              >
                {saving === "crew" ? "Saving…" : "Add crew"}
              </button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
