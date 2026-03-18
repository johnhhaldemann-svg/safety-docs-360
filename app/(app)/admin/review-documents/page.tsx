"use client";

import Link from "next/link";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentItem = {
  id: string;
  user_id: string;
  document_type: string | null;
  project_name: string | null;
  status: string | null;
  created_at: string;
  review_notes: string | null;
  final_file_path?: string | null;
};

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

function statusClasses(status?: string | null) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "submitted") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function ReviewDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState<"" | "archive" | "delete">("");

  const loadDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load documents error:", error.message);
      setMessage(error.message);
    } else {
      setDocuments(data || []);
    }

    setLoading(false);
  }, []);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as an admin.");
    }

    return session.access_token;
  }, []);

  const openDraftDocument = useCallback(
    async (documentId: string) => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/documents/download/${documentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || "Failed to open draft document.");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 60_000);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to open draft document."
        );
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const pendingDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        !isArchivedStatus(doc.status) &&
        doc.status?.trim().toLowerCase() === "submitted" && !doc.final_file_path
    );
  }, [documents]);

  const approvedDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        !isArchivedStatus(doc.status) &&
        (doc.status?.trim().toLowerCase() === "approved" ||
          Boolean(doc.final_file_path))
    );
  }, [documents]);

  const activeDocumentCount = useMemo(() => {
    return documents.filter((doc) => !isArchivedStatus(doc.status)).length;
  }, [documents]);

  const selectedCount = selectedIds.length;

  async function runBulkAction(action: "archive" | "delete") {
    if (selectedIds.length === 0) {
      setMessage("Select at least one document first.");
      return;
    }

    if (
      action === "delete" &&
      !window.confirm("Delete the selected document records and any stored files?")
    ) {
      return;
    }

    if (
      action === "archive" &&
      !window.confirm("Archive the selected documents and hide them from normal views?")
    ) {
      return;
    }

    setBulkLoading(action);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/documents/lifecycle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ids: selectedIds,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; count?: number }
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Bulk action failed.");
      }

      setSelectedIds([]);
      setMessage(
        action === "archive"
          ? `Archived ${data?.count ?? selectedCount} document${(data?.count ?? selectedCount) === 1 ? "" : "s"}.`
          : `Deleted ${data?.count ?? selectedCount} document${(data?.count ?? selectedCount) === 1 ? "" : "s"}.`
      );
      await loadDocuments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBulkLoading("");
    }
  }

  if (loading) {
    return <div className="p-6">Loading submissions...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Review Documents</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage submitted drafts, complete reviews, and confirm approved files.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bulk Actions</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedCount} document{selectedCount === 1 ? "" : "s"} selected across the active review workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runBulkAction("archive")}
              disabled={selectedCount === 0 || Boolean(bulkLoading)}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading === "archive" ? "Archiving..." : "Archive Selected"}
            </button>
            <button
              type="button"
              onClick={() => void runBulkAction("delete")}
              disabled={selectedCount === 0 || Boolean(bulkLoading)}
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading === "delete" ? "Deleting..." : "Delete Selected"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedCount === 0 || Boolean(bulkLoading)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Pending Review" value={String(pendingDocuments.length)} />
        <SummaryCard title="Approved" value={String(approvedDocuments.length)} />
        <SummaryCard title="Active Records" value={String(activeDocumentCount)} />
      </section>

      <ReviewSection
        title="Pending Review"
        emptyMessage="No submitted drafts are waiting for review."
        documents={pendingDocuments}
        actionLabel="Review"
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />

      <ReviewSection
        title="Approved Documents"
        emptyMessage="No approved documents yet."
        documents={approvedDocuments}
        actionLabel="Open Review"
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />
    </div>
  );
}

function ReviewSection({
  title,
  emptyMessage,
  documents,
  actionLabel,
  selectedIds,
  setSelectedIds,
}: {
  title: string;
  emptyMessage: string;
  documents: DocumentItem[];
  actionLabel: string;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}) {
  const sectionIds = documents.map((doc) => doc.id);
  const allSelected =
    sectionIds.length > 0 && sectionIds.every((id) => selectedIds.includes(id));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {documents.length > 0 ? (
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => {
                setSelectedIds((prev) => {
                  if (event.target.checked) {
                    return Array.from(new Set([...prev, ...sectionIds]));
                  }

                  return prev.filter((id) => !sectionIds.includes(id));
                });
              }}
              className="h-4 w-4"
            />
            Select All
          </label>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          documents.map((doc) => {
            const titleText =
              doc.project_name ?? doc.document_type ?? "Untitled Document";

            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 p-4 shadow-sm transition hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      onChange={(event) => {
                        setSelectedIds((prev) =>
                          event.target.checked
                            ? Array.from(new Set([...prev, doc.id]))
                            : prev.filter((id) => id !== doc.id)
                        );
                      }}
                      className="mt-1 h-4 w-4"
                    />
                  </label>
                  <Link
                    href={`/admin/review-documents/${doc.id}`}
                    className="block flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {titleText}
                      </h3>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          statusClasses(doc.status),
                        ].join(" ")}
                      >
                        {doc.status ?? "unknown"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      Type: {doc.document_type || "-"}
                    </p>
                    <p className="text-sm text-slate-700">
                      User ID: {doc.user_id}
                    </p>
                    <p className="text-sm text-slate-700">
                      Submitted: {new Date(doc.created_at).toLocaleString()}
                    </p>
                    {doc.review_notes ? (
                      <p className="mt-1 text-sm text-slate-600">
                        Notes: {doc.review_notes}
                      </p>
                    ) : null}
                  </Link>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void openDraftDocument(doc.id);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-900 hover:bg-slate-100"
                    >
                      Open Draft DOCX
                    </button>

                    <Link
                      href={`/admin/review-documents/${doc.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-extrabold text-white hover:bg-slate-700"
                    >
                      {actionLabel}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}
