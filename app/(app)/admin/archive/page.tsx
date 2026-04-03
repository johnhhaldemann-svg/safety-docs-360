"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ArchivedDocument = {
  id: string;
  created_at: string;
  archived_at?: string | null;
  archived_by_email?: string | null;
  restored_at?: string | null;
  restored_by_email?: string | null;
  project_name: string | null;
  document_type: string | null;
  status: string | null;
  file_name?: string | null;
  final_file_path?: string | null;
  draft_file_path?: string | null;
};

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

function formatDocumentTitle(doc: ArchivedDocument) {
  return doc.project_name ?? doc.document_type ?? doc.file_name ?? "Untitled Document";
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Updated recently";

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

export default function AdminArchivePage() {
  const [documents, setDocuments] = useState<ArchivedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [fileFilter, setFileFilter] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState<"" | "restore" | "delete">("");

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

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("archived_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setDocuments(((data ?? []) as ArchivedDocument[]).filter((doc) => isArchivedStatus(doc.status)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const documentTypes = useMemo(() => {
    const values = Array.from(
      new Set(documents.map((doc) => doc.document_type).filter(Boolean))
    ) as string[];

    return ["All Types", ...values.sort()];
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return documents.filter((doc) => {
      const title = formatDocumentTitle(doc).toLowerCase();
      const type = (doc.document_type ?? "").toLowerCase();
      const fileName = (doc.file_name ?? "").toLowerCase();
      const hasFinalFile = Boolean(doc.final_file_path);
      const hasDraftOnly = Boolean(doc.draft_file_path) && !doc.final_file_path;

      const matchesSearch =
        query.length === 0 ||
        title.includes(query) ||
        type.includes(query) ||
        fileName.includes(query);

      const matchesType =
        typeFilter === "All Types" ? true : doc.document_type === typeFilter;

      const matchesFileFilter =
        fileFilter === "all"
          ? true
          : fileFilter === "final"
            ? hasFinalFile
            : hasDraftOnly;

      return matchesSearch && matchesType && matchesFileFilter;
    });
  }, [documents, fileFilter, searchTerm, typeFilter]);

  const stats = useMemo(() => {
    const withFinal = documents.filter((doc) => Boolean(doc.final_file_path)).length;
    const draftOnly = documents.filter(
      (doc) => Boolean(doc.draft_file_path) && !doc.final_file_path
    ).length;

    return {
      total: documents.length,
      final: withFinal,
      draftOnly,
    };
  }, [documents]);

  const runLifecycleAction = useCallback(
    async (documentId: string, action: "restore" | "delete") => {
      if (
        action === "delete" &&
        !window.confirm("Delete this archived document and all stored files?")
      ) {
        return;
      }

      setActionLoadingId(`${action}:${documentId}`);
      setMessage("");

      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/admin/documents/${documentId}/lifecycle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        });

        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;

        if (!res.ok) {
          throw new Error(data?.error || "Archive action failed.");
        }

        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setMessage(action === "restore" ? "Document restored." : "Document deleted.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Archive action failed.");
      } finally {
        setActionLoadingId("");
      }
    },
    [getAccessToken]
  );

  const runBulkAction = useCallback(
    async (action: "restore" | "delete") => {
      if (selectedIds.length === 0) {
        setMessage("Select at least one archived document first.");
        return;
      }

      if (
        action === "delete" &&
        !window.confirm("Delete the selected archived documents and all stored files?")
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
          throw new Error(data?.error || "Bulk archive action failed.");
        }

        setDocuments((prev) => prev.filter((doc) => !selectedIds.includes(doc.id)));
        setMessage(
          action === "restore"
            ? `Restored ${data?.count ?? selectedIds.length} archived document${(data?.count ?? selectedIds.length) === 1 ? "" : "s"}.`
            : `Deleted ${data?.count ?? selectedIds.length} archived document${(data?.count ?? selectedIds.length) === 1 ? "" : "s"}.`
        );
        setSelectedIds([]);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Bulk archive action failed."
        );
      } finally {
        setBulkLoading("");
      }
    },
    [getAccessToken, selectedIds]
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Document Lifecycle"
        title="Archived Documents"
        description="Review archived records, restore them back into the active workflow, or permanently delete obsolete drafts and finals."
        actions={
          <>
            <Link
              href="/admin/review-documents"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Review Queue
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Back to Admin
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-3">
        <StatCard
          title="Archived Documents"
          value={String(stats.total)}
          note="Hidden from normal user and admin flows"
        />
        <StatCard
          title="Archived Finals"
          value={String(stats.final)}
          note="Archived records that still have final files"
        />
        <StatCard
          title="Draft-Only Records"
          value={String(stats.draftOnly)}
          note="Archived records without a final approval"
        />
      </section>

      <SectionCard
        title="Bulk Actions"
        description={`${selectedIds.length} archived document${selectedIds.length === 1 ? "" : "s"} selected in this archive view.`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runBulkAction("restore")}
              disabled={selectedIds.length === 0 || Boolean(bulkLoading)}
              className="rounded-xl border border-sky-500/35 bg-sky-950/35 px-4 py-3 text-sm font-semibold !text-sky-900 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading === "restore" ? "Restoring..." : "Restore Selected"}
            </button>
            <button
              type="button"
              onClick={() => void runBulkAction("delete")}
              disabled={selectedIds.length === 0 || Boolean(bulkLoading)}
              className="rounded-xl border border-red-300 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading === "delete" ? "Deleting..." : "Delete Selected"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0 || Boolean(bulkLoading)}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Archive Filters" description="Search by document name, type, or file state.">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Search Archived Documents
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search project, type, or file..."
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Document Type
              </label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
              >
                {documentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                File State
              </label>
              <select
                value={fileFilter}
                onChange={(event) => setFileFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="all">All Archived</option>
                <option value="final">Has Final File</option>
                <option value="draft">Draft Only</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setTypeFilter("All Types");
              setFileFilter("all");
            }}
            className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
          >
            Clear Filters
          </button>
        </div>

        {message ? <div className="mt-4"><InlineMessage>{message}</InlineMessage></div> : null}
      </SectionCard>

      <SectionCard
        title="Archive Records"
        description={`${filteredDocuments.length} archived document${filteredDocuments.length === 1 ? "" : "s"} in this view.`}
        aside={
          filteredDocuments.length > 0 ? (
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={filteredDocuments.every((doc) => selectedIds.includes(doc.id))}
                onChange={(event) => {
                  const filteredIds = filteredDocuments.map((doc) => doc.id);
                  setSelectedIds((prev) => {
                    if (event.target.checked) {
                      return Array.from(new Set([...prev, ...filteredIds]));
                    }

                    return prev.filter((id) => !filteredIds.includes(id));
                  });
                }}
                className="h-4 w-4"
              />
              Select All In View
            </label>
          ) : null
        }
      >
        {loading ? (
          <InlineMessage>Loading archived documents...</InlineMessage>
        ) : filteredDocuments.length === 0 ? (
          <EmptyState
            title="No archived documents match the current filters"
            description="Try a broader search or switch file-state filters."
          />
        ) : (
          <div className="space-y-4">
            {filteredDocuments.map((doc) => {
              const restoreLoading = actionLoadingId === `restore:${doc.id}`;
              const deleteLoading = actionLoadingId === `delete:${doc.id}`;

              return (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-700/80 p-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <label className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
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
                          className="h-4 w-4"
                        />
                        Select
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-100">
                          {formatDocumentTitle(doc)}
                        </h3>
                        <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
                          Archived
                        </span>
                        {doc.final_file_path ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Final File
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            Draft Only
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {doc.document_type ?? "Document"}
                        {doc.file_name ? ` - ${doc.file_name}` : ""}
                      </p>
                      <div className="mt-3 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-3">
                          <p className="font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Archived
                          </p>
                          <p className="mt-2 text-sm font-medium text-slate-300">
                            {formatRelative(doc.archived_at ?? doc.created_at)}
                          </p>
                          <p className="mt-1">
                            {doc.archived_by_email ?? "Unknown admin"} at{" "}
                            {formatAbsolute(doc.archived_at ?? doc.created_at)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-3">
                          <p className="font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Last Restore
                          </p>
                          {doc.restored_at ? (
                            <>
                              <p className="mt-2 text-sm font-medium text-slate-300">
                                {formatRelative(doc.restored_at)}
                              </p>
                              <p className="mt-1">
                                {doc.restored_by_email ?? "Unknown admin"} at{" "}
                                {formatAbsolute(doc.restored_at)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mt-2 text-sm font-medium text-slate-300">
                                Never restored
                              </p>
                              <p className="mt-1">
                                This record has stayed archived since it was moved out of the active workflow.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap gap-3 xl:w-auto xl:justify-end">
                      <Link
                        href={`/admin/review-documents/${doc.id}`}
                        className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
                      >
                        Open Review
                      </Link>

                      <button
                        type="button"
                        onClick={() => void runLifecycleAction(doc.id, "restore")}
                        disabled={Boolean(actionLoadingId)}
                        className="rounded-xl border border-sky-500/35 bg-sky-950/35 px-4 py-3 text-sm font-semibold !text-sky-900 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {restoreLoading ? "Restoring..." : "Restore"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void runLifecycleAction(doc.id, "delete")}
                        disabled={Boolean(actionLoadingId)}
                        className="rounded-xl border border-red-300 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleteLoading ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}
