"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type Chem = {
  id: string;
  chemical_name: string;
  manufacturer: string | null;
  sds_file_path: string | null;
  sds_effective_date: string | null;
  next_review_date: string | null;
};

export default function JobsiteChemicalsPage() {
  const routeParams = useParams();
  const jobsiteId = typeof routeParams?.jobsiteId === "string" ? routeParams.jobsiteId : "";
  const [rows, setRows] = useState<Chem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");
  const [name, setName] = useState("");
  const [sdsPath, setSdsPath] = useState("");
  const [nextReview, setNextReview] = useState("");

  const load = useCallback(async () => {
    if (!jobsiteId) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch(
        `/api/company/chemicals?jobsiteId=${encodeURIComponent(jobsiteId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = (await res.json().catch(() => null)) as { chemicals?: Chem[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to load.");
      setRows(data?.chemicals ?? []);
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
    setLoading(false);
  }, [jobsiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRow() {
    if (!name.trim() || !jobsiteId) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch("/api/company/chemicals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobsiteId,
          chemicalName: name.trim(),
          sdsFilePath: sdsPath.trim() || null,
          nextReviewDate: nextReview.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed.");
      setName("");
      setSdsPath("");
      setNextReview("");
      setTone("success");
      setMessage("Saved.");
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
        title="Chemicals & SDS"
        description="Register products on site, attach SDS storage paths, and track review dates."
        actions={
          <Link href={`/jobsites/${jobsiteId}/overview`} className={appButtonSecondaryClassName}>
            Overview
          </Link>
        }
      />
      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard title="Add chemical">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chemical name"
            className="min-w-[12rem] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <input
            value={sdsPath}
            onChange={(e) => setSdsPath(e.target.value)}
            placeholder="SDS file path / URL"
            className="min-w-[14rem] flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <input
            type="date"
            value={nextReview}
            onChange={(e) => setNextReview(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <button type="button" onClick={() => void addRow()} className={appButtonPrimaryClassName}>
            Add
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Register">
        {loading ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-800 px-3 py-2">
                <span className="font-semibold text-slate-100">{r.chemical_name}</span>
                {r.sds_file_path ? <span className="ml-2 text-xs text-slate-500">SDS: {r.sds_file_path}</span> : null}
                {r.next_review_date ? (
                  <span className="ml-2 text-xs text-amber-200">Review by {r.next_review_date}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
