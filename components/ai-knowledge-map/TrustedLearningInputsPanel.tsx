"use client";

import { useCallback, useEffect, useState } from "react";
import { FileUp, Globe2, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { SOURCE_TYPES, TRUST_LEVELS, type ApprovedSourceRow, type GusLearningSourceType, type GusLearningTrustLevel } from "@/lib/gusLearning/types";

type TrustedDocument = {
  id: string;
  company_id: string | null;
  document_title: string | null;
  document_type: string | null;
  category: string | null;
  status: string | null;
  final_file_path: string | null;
  file_name: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type TrustedInputsResponse = {
  sources?: ApprovedSourceRow[];
  documents?: TrustedDocument[];
  error?: string;
};

export function TrustedLearningInputsPanel({ companyId, onChanged }: { companyId: string | null; onChanged: () => void }) {
  const [sources, setSources] = useState<ApprovedSourceRow[]>([]);
  const [documents, setDocuments] = useState<TrustedDocument[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<GusLearningSourceType>("OSHA");
  const [trustLevel, setTrustLevel] = useState<GusLearningTrustLevel>("high");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("AI Knowledge Library");
  const [category, setCategory] = useState("Knowledge Library");
  const [file, setFile] = useState<File | null>(null);
  const [makeGlobal, setMakeGlobal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const scopedCompanyId = companyId && companyId !== "all" ? companyId : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scopedCompanyId) params.set("companyId", scopedCompanyId);
      const response = await fetch(`/api/ai-knowledge-map/trusted-inputs?${params.toString()}`);
      const body = await response.json().catch(() => null) as TrustedInputsResponse | null;
      if (!response.ok) throw new Error(body?.error ?? "Trusted learning inputs unavailable.");
      setSources(body?.sources ?? []);
      setDocuments(body?.documents ?? []);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trusted learning inputs unavailable.");
    } finally {
      setLoading(false);
    }
  }, [scopedCompanyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function addSource() {
    setWorking("source");
    setMessage(null);
    try {
      const response = await fetch("/api/ai-knowledge-map/trusted-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: makeGlobal ? "global" : scopedCompanyId,
          sourceName,
          sourceUrl,
          sourceType,
          trustLevel,
          jurisdiction: "Federal",
        }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Failed to add trusted learning source.");
      setSourceName("");
      setSourceUrl("");
      setMessage("Trusted learning source added. Run Learning Check to queue findings for Human Review.");
      await load();
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add trusted learning source.");
    } finally {
      setWorking(null);
    }
  }

  async function uploadDocument() {
    if (!file) {
      setMessage("Choose a PDF, Word, or text document first.");
      return;
    }
    setWorking("document");
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("companyId", makeGlobal ? "global" : scopedCompanyId ?? "global");
      formData.set("title", documentTitle || file.name);
      formData.set("documentType", documentType);
      formData.set("category", category);
      formData.set("file", file);
      const response = await fetch("/api/ai-knowledge-map/trusted-inputs", { method: "POST", body: formData });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Failed to upload trusted learning document.");
      setDocumentTitle("");
      setFile(null);
      setMessage("Trusted document added as approved source material. Run Learning Check to queue it for Human Review.");
      await load();
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to upload trusted learning document.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <aside className="rounded-xl border border-white/10 bg-slate-950/72 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Trusted Learning Inputs</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Add approved sites and documents before learning checks create Human Review candidates.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-white/10 bg-white/[0.05] p-2 text-slate-100 hover:bg-white/[0.09]" aria-label="Refresh trusted learning inputs">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : <RefreshCw className="h-4 w-4 text-sky-300" />}
        </button>
      </div>

      {message ? <p className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/10 p-2 text-xs font-bold text-sky-100">{message}</p> : null}

      <label className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200">
        <input type="checkbox" checked={makeGlobal} onChange={(event) => setMakeGlobal(event.target.checked)} className="h-4 w-4 accent-sky-400" />
        Share as global approved library input
      </label>

      <details className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3" open>
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
          <Globe2 className="h-3.5 w-3.5 text-sky-300" />
          Add trusted site
        </summary>
        <div className="mt-3 grid gap-2">
          <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-500" placeholder="Source name, e.g. OSHA Construction" />
          <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-500" placeholder="https://www.osha.gov/..." />
          <div className="grid grid-cols-2 gap-2">
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value as GusLearningSourceType)} className="rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-xs font-bold text-white outline-none">
              {SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={trustLevel} onChange={(event) => setTrustLevel(event.target.value as GusLearningTrustLevel)} className="rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-xs font-bold text-white outline-none">
              {TRUST_LEVELS.filter((level) => level !== "blocked").map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <button type="button" disabled={working === "source" || !sourceName.trim() || !sourceUrl.trim()} onClick={() => void addSource()} className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-300/16 disabled:opacity-60">
            {working === "source" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add trusted site
          </button>
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
          <FileUp className="h-3.5 w-3.5 text-sky-300" />
          Add trusted document
        </summary>
        <div className="mt-3 grid gap-2">
          <input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-500" placeholder="Document title" />
          <div className="grid grid-cols-2 gap-2">
            <input value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-xs font-bold text-white outline-none" placeholder="Document type" />
            <input value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-xs font-bold text-white outline-none" placeholder="Category" />
          </div>
          <input type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-sky-300 file:px-2 file:py-1 file:text-xs file:font-black file:text-slate-950" />
          <button type="button" disabled={working === "document" || !file} onClick={() => void uploadDocument()} className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-300/16 disabled:opacity-60">
            {working === "document" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            Upload trusted document
          </button>
        </div>
      </details>

      <div className="mt-3 grid gap-2">
        <Metric icon={Globe2} label="Trusted sites" value={sources.length} />
        <Metric icon={ShieldCheck} label="Approved docs" value={documents.length} />
      </div>
      <div className="mt-3 space-y-2">
        {[...sources.slice(0, 3).map((source) => ({ id: source.id, title: source.source_name, meta: `${source.domain} | ${source.trust_level}` })), ...documents.slice(0, 3).map((document) => ({ id: document.id, title: document.document_title ?? document.file_name ?? "Approved document", meta: document.category ?? document.document_type ?? "document" }))].map((item) => (
          <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="truncate text-xs font-black text-slate-100">{item.title}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{item.meta}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">
      <span className="inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-sky-300" />
        {label}
      </span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}
