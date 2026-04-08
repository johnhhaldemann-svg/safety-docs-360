"use client";

import { useCallback, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type Props = {
  surface: string;
  /** Optional JSON or prose context (bounded server-side). */
  structuredContext?: string | null;
  title?: string;
  className?: string;
};

export function CompanyAiAssistPanel({
  surface,
  structuredContext,
  title = "Company AI assistant",
  className = "",
}: Props) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [retrieval, setRetrieval] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(async () => {
    const q = message.trim();
    if (!q) {
      setError("Enter a question.");
      return;
    }
    setLoading(true);
    setError("");
    setReply("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in to use the assistant.");
      }
      const res = await fetch("/api/company/ai/assist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface,
          message: q,
          context: structuredContext ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        text?: string;
        disclaimer?: string;
        retrieval?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setReply(data?.text ?? "");
      setDisclaimer(data?.disclaimer ?? "");
      setRetrieval(data?.retrieval ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [message, surface, structuredContext]);

  return (
    <div
      className={`rounded-[1.4rem] border border-slate-700/80 bg-slate-950/50 p-5 shadow-sm ${className}`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">AI + memory</div>
      <h2 className="mt-2 text-lg font-bold text-slate-100">{title}</h2>
      <p className="mt-1 text-sm text-slate-300">
        Answers use your company memory bank when available. Not legal advice.
      </p>

      <div className="mt-4 space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Ask about hazards, procedures, or your documents…"
          className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-sky-500/50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="rounded-2xl bg-[linear-gradient(135deg,_#4f7cff_0%,_#5b6cff_100%)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}

      {reply ? (
        <div className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-sm leading-6 text-slate-200">
          <div className="whitespace-pre-wrap">{reply}</div>
          {retrieval ? (
          <div className="mt-2 text-xs text-slate-400">Retrieval: {retrieval}</div>
          ) : null}
          {disclaimer ? (
            <p className="mt-3 text-xs leading-5 text-slate-400">{disclaimer}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
