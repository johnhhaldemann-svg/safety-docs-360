"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type Doc = {
  id: string;
  title: string;
  doc_type: string;
  expires_on: string | null;
  verification_status: string;
};

export default function ContractorDetailPage() {
  const { id: contractorId } = useParams<{ id: string }>();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [evalSummary, setEvalSummary] = useState<{
    status: string;
    reasons: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("coi");
  const [expiresOn, setExpiresOn] = useState("");
  const [score, setScore] = useState("85");

  const load = useCallback(async () => {
    if (!contractorId) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const h = { Authorization: `Bearer ${session.access_token}` };
      const [dRes, eRes] = await Promise.all([
        fetch(`/api/company/contractors/${encodeURIComponent(contractorId)}/documents`, { headers: h }),
        fetch(`/api/company/contractors/${encodeURIComponent(contractorId)}/evaluate`, { headers: h }),
      ]);
      const dJson = (await dRes.json().catch(() => null)) as { documents?: Doc[]; error?: string } | null;
      const eJson = (await eRes.json().catch(() => null)) as {
        status?: string;
        reasons?: string[];
        error?: string;
      } | null;
      if (!dRes.ok) throw new Error(dJson?.error || "Failed to load documents.");
      if (!eRes.ok) throw new Error(eJson?.error || "Failed to evaluate.");
      setDocs(dJson?.documents ?? []);
      setEvalSummary({ status: eJson?.status ?? "unknown", reasons: eJson?.reasons ?? [] });
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
    setLoading(false);
  }, [contractorId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addDocument() {
    if (!title.trim() || !contractorId) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const res = await fetch(`/api/company/contractors/${encodeURIComponent(contractorId)}/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docType,
          title: title.trim(),
          expiresOn: expiresOn.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed.");
      setTitle("");
      setExpiresOn("");
      setTone("success");
      setMessage("Document added.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function saveEvaluation() {
    if (!contractorId) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in.");
      const n = Number.parseFloat(score);
      const res = await fetch(`/api/company/contractors/${encodeURIComponent(contractorId)}/evaluations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ score: Number.isFinite(n) ? n : 0, blockingFlags: [] }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed.");
      setTone("success");
      setMessage("Evaluation saved.");
      await load();
    } catch (e) {
      setTone("error");
      setMessage(e instanceof Error ? e.message : "Failed.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Contractor"
        title="Compliance documents"
        description="Track expirations and store a simple prequal score for procurement reviews."
        actions={
          <Link href="/company-contractors" className={appButtonSecondaryClassName}>
            All contractors
          </Link>
        }
      />
      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <SectionCard title="Prequal status" description="Based on document expirations.">
        {loading ? (
          <InlineMessage>Loading…</InlineMessage>
        ) : evalSummary ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={evalSummary.status === "eligible" ? "Eligible" : "Blocked"}
              tone={evalSummary.status === "eligible" ? "success" : "warning"}
            />
            <ul className="mt-2 w-full list-disc pl-5 text-sm text-slate-300">
              {evalSummary.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Add document" description="COI, WCB, license, EMR, or other evidence.">
        <div className="flex flex-wrap gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          >
            <option value="coi">COI</option>
            <option value="wcb">WCB</option>
            <option value="license">License</option>
            <option value="emr">EMR</option>
            <option value="safety_manual">Safety manual</option>
            <option value="other">Other</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="min-w-[10rem] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
          />
          <button type="button" onClick={() => void addDocument()} className={appButtonPrimaryClassName}>
            Save
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Documents on file" description="Sorted by expiry.">
        <ul className="space-y-2 text-sm text-slate-300">
          {docs.map((d) => (
            <li key={d.id} className="rounded-lg border border-slate-800 px-3 py-2">
              {d.title} · {d.doc_type} · {d.expires_on ?? "no expiry"} · {d.verification_status}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Evaluation score" description="Latest score snapshot for this subcontractor.">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-400">
            Score
            <input
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="mt-1 block w-24 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 [color-scheme:dark]"
            />
          </label>
          <button type="button" onClick={() => void saveEvaluation()} className={appButtonPrimaryClassName}>
            Save evaluation
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
