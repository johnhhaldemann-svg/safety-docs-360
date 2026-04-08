"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MemoryItem = {
  id: string;
  source: string;
  title: string;
  body: string;
  created_at: string;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      const res = await fetch("/api/company/memory", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), source: "manual" }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Save failed.");
      setTitle("");
      setBody("");
      await load();
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
      className={`rounded-[1.4rem] border border-slate-700/80 bg-slate-950/50 p-5 shadow-sm ${className}`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Memory bank</div>
      <h2 className="mt-2 text-lg font-bold text-slate-100">Company knowledge</h2>
      <p className="mt-1 text-sm text-slate-300">
        Snippets power AI answers. {canMutate ? "Add procedures, site rules, or lessons learned." : "Ask a lead to add entries."}
      </p>

      {canMutate ? (
        <div className="mt-4 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
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
            disabled={saving}
            className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-4 py-2 text-sm font-semibold text-sky-200 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add to memory"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
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
                  <div className="font-semibold text-slate-200">{item.title || "Untitled"}</div>
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
    </div>
  );
}
