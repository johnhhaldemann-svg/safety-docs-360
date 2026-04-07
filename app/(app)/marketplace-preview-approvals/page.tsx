"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import { getSubmitterPreviewStatus } from "@/lib/marketplace";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentRow = {
  id: string;
  user_id: string | null;
  project_name: string | null;
  document_title: string | null;
  notes: string | null;
};

function titleFor(doc: DocumentRow) {
  return doc.document_title?.trim() || doc.project_name?.trim() || "Untitled document";
}

export default function MarketplacePreviewApprovalsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [previewUrlById, setPreviewUrlById] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in.");
    }

    return session.access_token;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? "");

      const res = await fetch("/api/workspace/documents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; documents?: DocumentRow[] }
        | null;

      if (!res.ok) {
        setMessage(data?.error || "Could not load documents.");
        return;
      }

      setDocuments(Array.isArray(data?.documents) ? data!.documents! : []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrlById)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewUrlById]);

  const pendingForYou = useMemo(() => {
    if (!currentUserId) return [];
    return documents.filter((doc) => {
      if (doc.user_id !== currentUserId) return false;
      return getSubmitterPreviewStatus(doc.notes) === "pending";
    });
  }, [documents, currentUserId]);

  const openPreview = useCallback(async (documentId: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/documents/${documentId}/owner-marketplace-preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let err = "Could not load preview.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) err = j.error;
        } catch {
          /* ignore */
        }
        toast.error(err);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrlById((m) => {
        const prev = m[documentId];
        if (prev) URL.revokeObjectURL(prev);
        return { ...m, [documentId]: url };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load preview.");
    }
  }, [getAccessToken]);

  const sendDecision = useCallback(
    async (documentId: string, decision: "approve" | "reject") => {
      setActionId(documentId);
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/documents/${documentId}/marketplace-preview-decision`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          toast.error(data?.error || "Update failed.");
          return;
        }
        toast.success(
          decision === "approve"
            ? "Preview approved. Buyers can now see this preview in the library."
            : "Preview rejected. Your reviewer can publish an updated preview."
        );
        setPreviewUrlById((m) => {
          const u = m[documentId];
          if (u) URL.revokeObjectURL(u);
          const next = { ...m };
          delete next[documentId];
          return next;
        });
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed.");
      } finally {
        setActionId("");
      }
    },
    [getAccessToken, load]
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Marketplace"
        title="Preview approvals"
        description="When our team generates a buyer preview for your marketplace listing, confirm here that it looks right before it is shown in the public library."
      />

      {message ? <InlineMessage tone="warning">{message}</InlineMessage> : null}

      <SectionCard
        title="Waiting for your decision"
        description="These listings have a generated preview PDF pending your approval."
      >
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : pendingForYou.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            description="When a preview is generated for your marketplace document, it will appear here for you to approve or reject."
          />
        ) : (
          <ul className="space-y-6">
            {pendingForYou.map((doc) => (
              <li
                key={doc.id}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{titleFor(doc)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {doc.project_name?.trim() || "General workspace"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openPreview(doc.id)}
                      className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-950/50"
                    >
                      {previewUrlById[doc.id] ? "Reload preview" : "Open preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendDecision(doc.id, "approve")}
                      disabled={actionId === doc.id}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionId === doc.id ? "Saving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendDecision(doc.id, "reject")}
                      disabled={actionId === doc.id}
                      className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-950/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {previewUrlById[doc.id] ? (
                  <iframe
                    title={`Preview ${doc.id}`}
                    src={previewUrlById[doc.id]}
                    className="mt-4 h-[min(55vh,28rem)] w-full rounded-xl border border-slate-700/80 bg-white"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
