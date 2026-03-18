"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  getDocumentCreditCost,
  isMarketplaceEnabled,
} from "@/lib/marketplace";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentItem = {
  id: string;
  project_name: string;
  status: string;
  created_at?: string | null;
  approved_at?: string | null;
  approved_by_email?: string | null;
  archived_at?: string | null;
  archived_by_email?: string | null;
  restored_at?: string | null;
  restored_by_email?: string | null;
  marketplace_updated_at?: string | null;
  marketplace_updated_by_email?: string | null;
  notes?: string | null;
  draft_file_path: string | null;
  final_file_path: string | null;
  reviewer_email: string | null;
  review_notes: string | null;
};

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Unknown time";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatAbsolute(timestamp?: string | null) {
  if (!timestamp) return "Unknown time";
  return new Date(timestamp).toLocaleString();
}

export default function ReviewDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [documentItem, setDocumentItem] = useState<DocumentItem | null>(null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);
  const [creditCost, setCreditCost] = useState("5");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMarketplace, setSavingMarketplace] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState<
    "archive" | "restore" | "delete" | ""
  >("");
  const [loadError, setLoadError] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as an admin.");
    }

    return session.access_token;
  }

  const loadDocument = useCallback(async () => {
    if (!id) {
      setDocumentItem(null);
      setLoadError("Missing document ID.");
      setLoading(false);
      return;
    }

    setLoadError("");

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      setDocumentItem(data);
      setReviewerEmail(data.reviewer_email || "");
      setReviewNotes(data.review_notes || "");
      setMarketplaceEnabled(isMarketplaceEnabled(data.notes));
      setCreditCost(String(getDocumentCreditCost(data.notes)));
    } else {
      setDocumentItem(null);
      setLoadError(error?.message || "Document could not be loaded.");
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) {
      queueMicrotask(() => {
        void loadDocument();
      });
    }
  }, [id, loadDocument]);

  async function uploadFinalDoc() {
    if (!file || !documentItem) {
      alert("Please upload the final DOCX.");
      return;
    }

    setSaving(true);

    try {
      const token = await getAccessToken();
      const payload = new FormData();
      payload.append("file", file);
      payload.append("reviewerEmail", reviewerEmail);
      payload.append("reviewNotes", reviewNotes);
      payload.append("marketplaceEnabled", String(marketplaceEnabled));
      payload.append("creditCost", creditCost);

      const res = await fetch(`/api/documents/approve/${documentItem.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        alert(data?.error || "Approval failed.");
        setSaving(false);
        return;
      }

      await loadDocument();
      alert("Final document sent to user.");
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    }

    setSaving(false);
  }

  async function saveMarketplaceSettings() {
    if (!documentItem) return;

    setSavingMarketplace(true);

    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/admin/documents/${documentItem.id}/marketplace`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            enabled: marketplaceEnabled,
            creditCost: Number(creditCost),
          }),
        }
      );

      const data = (await res.json().catch(() => null)) as
        | { error?: string; notes?: string }
        | null;

      if (!res.ok) {
        alert(data?.error || "Failed to save marketplace settings.");
        setSavingMarketplace(false);
        return;
      }

      setDocumentItem((prev) =>
        prev
          ? {
              ...prev,
              notes: data?.notes ?? prev.notes ?? null,
            }
          : prev
      );
      await loadDocument();
      alert("Marketplace settings saved.");
    } catch (error) {
      console.error(error);
      alert("Failed to save marketplace settings.");
    }

    setSavingMarketplace(false);
  }

  async function runLifecycleAction(action: "archive" | "restore" | "delete") {
    if (!documentItem) return;

    if (
      action === "delete" &&
      !window.confirm("Delete this document record and any stored draft/final files?")
    ) {
      return;
    }

    if (
      action === "archive" &&
      !window.confirm("Archive this document and hide it from normal workspace views?")
    ) {
      return;
    }

    setLifecycleLoading(action);

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/documents/${documentItem.id}/lifecycle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; status?: string }
        | null;

      if (!res.ok) {
        alert(data?.error || "Lifecycle update failed.");
        setLifecycleLoading("");
        return;
      }

      if (action === "delete") {
        alert("Document deleted.");
        router.push("/admin/review-documents");
        router.refresh();
        return;
      }

      const nextStatus =
        typeof data?.status === "string" && data.status.trim()
          ? data.status
          : action === "archive"
            ? "archived"
            : documentItem.final_file_path
              ? "approved"
              : "submitted";

      setDocumentItem((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
            }
          : prev
      );

      await loadDocument();
      alert(action === "archive" ? "Document archived." : "Document restored.");
    } catch (error) {
      console.error(error);
      alert("Lifecycle update failed.");
    }

    setLifecycleLoading("");
  }

  const timelineEvents = useMemo(() => {
    if (!documentItem) {
      return [] as Array<{
        key: string;
        title: string;
        time: string;
        detail: string;
      }>;
    }

    const events = [
      documentItem.created_at
        ? {
            key: "created",
            title: "Document created",
            time: documentItem.created_at,
            detail: "Initial submission record created for review.",
          }
        : null,
      documentItem.approved_at
        ? {
            key: "approved",
            title: "Final approved",
            time: documentItem.approved_at,
            detail: `Approved by ${documentItem.approved_by_email ?? documentItem.reviewer_email ?? "an admin"}.`,
          }
        : null,
      documentItem.marketplace_updated_at
        ? {
            key: "marketplace",
            title: "Marketplace updated",
            time: documentItem.marketplace_updated_at,
            detail: `${isMarketplaceEnabled(documentItem.notes) ? "Listed" : "Hidden"} at ${getDocumentCreditCost(documentItem.notes)} credits by ${documentItem.marketplace_updated_by_email ?? "an admin"}.`,
          }
        : null,
      documentItem.archived_at
        ? {
            key: "archived",
            title: "Document archived",
            time: documentItem.archived_at,
            detail: `Archived by ${documentItem.archived_by_email ?? "an admin"}.`,
          }
        : null,
      documentItem.restored_at
        ? {
            key: "restored",
            title: "Document restored",
            time: documentItem.restored_at,
            detail: `Restored by ${documentItem.restored_by_email ?? "an admin"}.`,
          }
        : null,
    ].filter(
      (
        event
      ): event is {
        key: string;
        title: string;
        time: string;
        detail: string;
      } => Boolean(event?.time)
    );

    return events.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  }, [documentItem]);

  if (loading) return <div className="p-6">Loading document...</div>;
  if (!documentItem) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold text-slate-900">Document not found.</div>
        {loadError ? (
          <div className="text-sm text-slate-600">{loadError}</div>
        ) : null}
        <button
          onClick={() => router.push("/admin/review-documents")}
          className="rounded-lg border px-4 py-2 font-semibold"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold">Review PSHSEP</h1>
          <p className="text-sm text-slate-600">
            Download draft, review in Word, then upload final version.
          </p>
        </div>

        <div className="rounded-lg border p-5 shadow-sm">
          <p><strong>Project:</strong> {documentItem.project_name}</p>
          <p><strong>Status:</strong> {documentItem.status}</p>
        </div>

        <div className="rounded-lg border p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Draft Document</h3>

          <a
            href={`/api/documents/download/${documentItem.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 no-underline hover:bg-slate-100"
          >
            Open Draft DOCX
          </a>
        </div>

        <div className="rounded-lg border p-5 shadow-sm space-y-4">
          <h3 className="font-semibold">Upload Final Document</h3>

          <input
            type="file"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <div>
            <label className="text-sm font-semibold block mb-1">
              Reviewer Email
            </label>
            <input
              type="email"
              value={reviewerEmail}
              onChange={(e) => setReviewerEmail(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">
              Review Notes
            </label>
            <textarea
              rows={4}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <button
            onClick={uploadFinalDoc}
            disabled={saving}
            className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Uploading..." : "Approve & Send Final"}
          </button>
        </div>

        <div className="rounded-lg border p-5 shadow-sm space-y-4">
          <h3 className="font-semibold">Marketplace Settings</h3>
          <p className="text-sm text-slate-600">
            Control whether this completed document is listed in the credit marketplace and how many credits it costs.
          </p>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">
              List this completed document in the marketplace
            </span>
            <input
              type="checkbox"
              checked={marketplaceEnabled}
              onChange={(e) => setMarketplaceEnabled(e.target.checked)}
              className="h-5 w-5"
            />
          </label>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Credit Cost
            </label>
            <input
              type="number"
              min={1}
              value={creditCost}
              onChange={(e) => setCreditCost(e.target.value)}
              className="w-full rounded-lg border p-2"
            />
          </div>

          <button
            onClick={saveMarketplaceSettings}
            disabled={savingMarketplace}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
          >
            {savingMarketplace ? "Saving..." : "Save Marketplace Settings"}
          </button>
        </div>

        <div className="rounded-lg border p-5 shadow-sm space-y-4">
          <h3 className="font-semibold">Document Timeline</h3>
          <p className="text-sm text-slate-600">
            Track the key review, lifecycle, and marketplace events for this document.
          </p>

          {timelineEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No timeline events recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {timelineEvents.map((event, index) => (
                <div
                  key={event.key}
                  className="flex gap-4 rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatRelative(event.time)} at {formatAbsolute(event.time)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border p-5 shadow-sm space-y-4">
          <h3 className="font-semibold">Document Lifecycle</h3>
          <p className="text-sm text-slate-600">
            Archive documents to hide them from the active workflow, restore them later, or permanently delete the record and stored files.
          </p>

          <div className="flex flex-wrap gap-3">
            {isArchivedStatus(documentItem.status) ? (
              <button
                onClick={() => void runLifecycleAction("restore")}
                disabled={Boolean(lifecycleLoading)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
              >
                {lifecycleLoading === "restore" ? "Restoring..." : "Restore Document"}
              </button>
            ) : (
              <button
                onClick={() => void runLifecycleAction("archive")}
                disabled={Boolean(lifecycleLoading)}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {lifecycleLoading === "archive" ? "Archiving..." : "Archive Document"}
              </button>
            )}

            <button
              onClick={() => void runLifecycleAction("delete")}
              disabled={Boolean(lifecycleLoading)}
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {lifecycleLoading === "delete" ? "Deleting..." : "Delete Document"}
            </button>
          </div>
        </div>

        <button
          onClick={() => router.push("/admin/review-documents")}
          className="rounded-lg border px-4 py-2 font-semibold"
        >
          Back
        </button>

      </div>
    </div>
  );
}
