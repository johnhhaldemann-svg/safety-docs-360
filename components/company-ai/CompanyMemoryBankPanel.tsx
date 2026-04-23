"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type MemoryItem = {
  id: string;
  source: string;
  title: string;
  body: string;
  created_at: string;
};

type SimilarCandidate = {
  id: string;
  title: string;
  body: string;
  score: number;
  reason: string;
};

type Props = {
  className?: string;
};

export function CompanyMemoryBankPanel({ className = "" }: Props) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [canMutate, setCanMutate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingSimilar, setPendingSimilar] = useState<SimilarCandidate | null>(null);
  /** Saved entry cards are hidden by default to reduce vertical clutter. */
  const [savedEntriesOpen, setSavedEntriesOpen] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setItems([]);
        return;
      }
      const res = await fetch("/api/company/memory?limit=50", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => null)) as {
        items?: MemoryItem[];
        capabilities?: { canMutate?: boolean };
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load memory.");
      }
      setItems(data?.items ?? []);
      setCanMutate(Boolean(data?.capabilities?.canMutate));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("company-memory-changed"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMemory = async (opts: { replaceMemoryItemId?: string }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sign in required.");
    const res = await fetch("/api/company/memory", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim(),
        source: "manual",
        ...(opts.replaceMemoryItemId ? { replaceMemoryItemId: opts.replaceMemoryItemId } : {}),
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) throw new Error(data?.error || "Save failed.");
    setTitle("");
    setBody("");
    setPendingSimilar(null);
    await load();
  };

  const addItem = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in required.");

      const simRes = await fetch("/api/company/memory/similar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const simData = (await simRes.json().catch(() => null)) as {
        similar?: SimilarCandidate | null;
        error?: string;
      } | null;
      if (!simRes.ok) {
        throw new Error(simData?.error || "Could not check for similar entries.");
      }
      if (simData?.similar) {
        setPendingSimilar(simData.similar);
        return;
      }

      await saveMemory({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const confirmReplace = async () => {
    if (!pendingSimilar) return;
    setSaving(true);
    setError("");
    try {
      await saveMemory({ replaceMemoryItemId: pendingSimilar.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const uploadDocumentFile = async (file: File) => {
    setUploadingDoc(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in required.");
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) {
        fd.append("title", title.trim());
      }
      const res = await fetch("/api/company/memory/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Upload failed.");
      setTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addAsSeparate = async () => {
    setPendingSimilar(null);
    setSaving(true);
    setError("");
    try {
      await saveMemory({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!canMutate) return;
    if (!window.confirm("Remove this memory entry?")) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in required.");
      const res = await fetch(`/api/company/memory/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Delete failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  return (
    <div
      className={`relative rounded-[1.4rem] border border-slate-700/80 bg-slate-950/50 p-5 shadow-sm ${className}`}
    >
      {pendingSimilar ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-[1.4rem] bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-similar-title"
        >
          <div className="max-h-[min(90vh,28rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-xl">
            <h3 id="memory-similar-title" className="text-base font-bold text-amber-100">
              Similar entry found
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              This looks close to something already in your company knowledge. Replace the existing entry with what you
              just typed, or keep both.
            </p>
            <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/60 p-3 text-sm">
              <div className="font-semibold text-slate-200">{pendingSimilar.title || "Untitled"}</div>
              <div className="mt-2 line-clamp-4 text-slate-400">{pendingSimilar.body}</div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingSimilar(null)}
                disabled={saving}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/60 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void addAsSeparate()}
                disabled={saving}
                className="rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add as new entry"}
              </button>
              <button
                type="button"
                onClick={() => void confirmReplace()}
                disabled={saving}
                className="rounded-xl border border-sky-500/50 bg-sky-950/50 px-4 py-2 text-sm font-semibold text-sky-100 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Replace existing"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Memory bank</div>
      <h2 className="mt-2 text-lg font-bold text-slate-100">Company knowledge</h2>
      <p className="mt-1 text-sm text-slate-300">
        Snippets and uploaded PDFs/DOCX power smart answers and draft review.{" "}
        {canMutate ? "Add procedures, site rules, or reference documents." : "Ask a lead to add entries."}
      </p>

      {canMutate ? (
        <div className="mt-4 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Memory entry title"
            className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500/50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Body text"
            className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500/50"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={saving || uploadingDoc}
            className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-4 py-2 text-sm font-semibold text-sky-200 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add to memory"}
          </button>
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-3">
            <div className="text-xs font-semibold text-slate-400">Upload a document</div>
            <p className="mt-1 text-xs text-slate-500">
              PDF or DOCX (max 12 MB). Text is extracted for search; the file is stored for your company. Optional: set
              Title above to label this upload.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Upload memory document"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadDocumentFile(f);
              }}
            />
            <button
              type="button"
              disabled={uploadingDoc || saving}
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
            >
              {uploadingDoc ? "Uploading…" : "Choose PDF or DOCX"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}

      {loading || items.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setSavedEntriesOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-left text-sm font-semibold text-slate-200 hover:border-slate-600/80 hover:bg-slate-900/70"
            aria-expanded={savedEntriesOpen}
          >
            <span>
              Saved entries
              {!loading && items.length > 0 ? (
                <span className="ml-1 font-normal text-slate-400">({items.length})</span>
              ) : null}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${savedEntriesOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {savedEntriesOpen ? (
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="text-sm text-slate-400">Loading...</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-slate-400">No memory entries yet.</div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-200">{item.title || "Untitled"}</span>
                          {item.source === "document_upload" ? (
                            <span className="rounded-md border border-violet-500/35 bg-violet-950/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">
                              Document
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 line-clamp-3 text-slate-400">{item.body}</div>
                      </div>
                      {canMutate ? (
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          className="shrink-0 text-xs font-semibold text-rose-300 hover:text-rose-200"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
