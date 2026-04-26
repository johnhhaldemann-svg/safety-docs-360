"use client";

import Link from "next/link";
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

type Program = {
  id: string;
  name: string;
  description: string | null;
  audience: string;
  active: boolean;
};

type Requirement = {
  id: string;
  program_id: string;
  jobsite_id: string | null;
  active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

type Jobsite = { id: string; name: string };

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in.");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export default function CompanyInductionsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [newName, setNewName] = useState("");
  const [newAudience, setNewAudience] = useState("worker");
  const [reqProgramId, setReqProgramId] = useState("");
  const [reqJobsiteId, setReqJobsiteId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const h = await authHeaders();
      const [pRes, rRes, jRes] = await Promise.all([
        fetch("/api/company/inductions/programs", { headers: h }),
        fetch("/api/company/inductions/requirements", { headers: h }),
        fetch("/api/company/jobsites", { headers: h }),
      ]);
      const pData = (await pRes.json().catch(() => null)) as { programs?: Program[]; error?: string } | null;
      const rData = (await rRes.json().catch(() => null)) as { requirements?: Requirement[]; error?: string } | null;
      const jData = (await jRes.json().catch(() => null)) as { jobsites?: Jobsite[]; error?: string } | null;
      if (!pRes.ok) throw new Error(pData?.error || "Failed to load programs.");
      if (!rRes.ok) throw new Error(rData?.error || "Failed to load requirements.");
      setPrograms(pData?.programs ?? []);
      setRequirements(rData?.requirements ?? []);
      const raw = (jData?.jobsites ?? []) as Array<{ id?: string; name?: string }>;
      setJobsites(
        raw
          .map((row) => ({ id: String(row.id ?? ""), name: String(row.name ?? "Jobsite") }))
          .filter((j) => j.id)
      );
      if (!jRes.ok && jData?.error) {
        setTone("warning");
        setMessage(jData.error);
      }
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Load failed.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProgram() {
    if (!newName.trim()) return;
    try {
      const h = await authHeaders();
      const res = await fetch("/api/company/inductions/programs", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ name: newName.trim(), audience: newAudience }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Create failed.");
      setNewName("");
      setTone("success");
      setMessage("Program created.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Create failed.");
    }
  }

  async function createRequirement() {
    if (!reqProgramId) return;
    try {
      const h = await authHeaders();
      const res = await fetch("/api/company/inductions/requirements", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          programId: reqProgramId,
          jobsiteId: reqJobsiteId || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Create failed.");
      setTone("success");
      setMessage("Requirement added.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Create failed.");
    }
  }

  async function toggleProgramActive(p: Program) {
    try {
      const h = await authHeaders();
      const res = await fetch(`/api/company/inductions/programs/${encodeURIComponent(p.id)}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ active: !p.active }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Update failed.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Update failed.");
    }
  }

  function jobsiteLabel(id: string | null) {
    if (!id) return "All jobsites";
    return jobsites.find((j) => j.id === id)?.name ?? id;
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company workspace"
        title="Induction programs"
        description="Define induction programs and which jobsites require them. Field teams record completions on each jobsite Inductions tab."
        actions={
          <Link href="/jobsites" className={appButtonSecondaryClassName}>
            Open job sites
          </Link>
        }
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard
        title="Programs"
        description="Each program can be required per jobsite or company-wide (leave jobsite empty on the requirement)."
      >
        {loading ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Program name"
                className="min-w-[12rem] flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
              />
              <select
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value)}
                className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
              >
                <option value="worker">Worker</option>
                <option value="visitor">Visitor</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
              <button type="button" onClick={() => void createProgram()} className={appButtonPrimaryClassName}>
                Add program
              </button>
            </div>
            {programs.length === 0 ? (
              <EmptyState title="No programs yet" description="Create a program, then add requirements for each jobsite." />
            ) : (
              <ul className="space-y-2">
                {programs.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-semibold text-slate-100">{p.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{p.audience}</span>
                      {!p.active ? <span className="ml-2 text-xs text-amber-400">inactive</span> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleProgramActive(p)}
                      className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300"
                    >
                      {p.active ? "Deactivate" : "Activate"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Requirements" description="Assign a program to all jobsites or one specific jobsite.">
        <div className="flex flex-wrap gap-2">
          <select
            value={reqProgramId}
            onChange={(e) => setReqProgramId(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          >
            <option value="">Select program…</option>
            {programs.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={reqJobsiteId}
            onChange={(e) => setReqJobsiteId(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          >
            <option value="">All jobsites</option>
            {jobsites.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void createRequirement()} className={appButtonPrimaryClassName}>
            Add requirement
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {requirements.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
              Program <span className="font-mono text-slate-300">{r.program_id.slice(0, 8)}…</span> ·{" "}
              {jobsiteLabel(r.jobsite_id)} · {r.active ? "active" : "inactive"}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
