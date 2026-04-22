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
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { MarketplacePreviewModal } from "@/components/MarketplacePreviewModal";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";
import type { PermissionMap } from "@/lib/rbac";
import {
  getDocumentStatusLabel,
  getDocumentStatusTone,
  isApprovedDocumentStatus,
  isArchivedDocumentStatus,
  isSubmittedDocumentStatus,
} from "@/lib/documentStatus";
import { formatSafetyBlueprintDocumentType } from "@/lib/safetyBlueprintLabels";

const supabase = getSupabaseBrowserClient();

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

type ExcerptModalState = {
  title: string;
  excerpt: string;
  truncated: boolean;
  empty: boolean;
  pageCount?: number | null;
};

function statusClasses(status?: string | null) {
  return getDocumentStatusTone(status);
}

export default function ReviewDocumentsPage() {
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState<"" | "archive" | "delete">("");
  const [excerptModal, setExcerptModal] = useState<ExcerptModalState | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [downloadLoadingId, setDownloadLoadingId] = useState<string | null>(null);

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

  const previewDraftExcerpt = useCallback(
    async (documentId: string) => {
      setPreviewLoadingId(documentId);
      setMessage("");
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/admin/documents/${documentId}/preview-excerpt`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const raw = await res.text();
        type PreviewExcerptJson = {
          error?: string;
          title?: string;
          excerpt?: string;
          truncated?: boolean;
          empty?: boolean;
          pageCount?: number | null;
        };
        let data: PreviewExcerptJson | null = null;
        try {
          data = raw ? (JSON.parse(raw) as PreviewExcerptJson) : null;
        } catch {
          data = null;
        }

        if (!res.ok) {
          const msg =
            (data && typeof data.error === "string" && data.error) ||
            (raw.trim() && !raw.trim().startsWith("<")
              ? raw.trim().slice(0, 240)
              : `Preview failed (HTTP ${res.status}).`);
          throw new Error(msg);
        }

        if (typeof data?.excerpt !== "string") {
          throw new Error("Invalid preview response.");
        }

        setExcerptModal({
          title: typeof data.title === "string" ? data.title : "Document preview",
          excerpt: data.excerpt,
          truncated: Boolean(data.truncated),
          empty: Boolean(data.empty),
          pageCount:
            typeof data.pageCount === "number" && Number.isFinite(data.pageCount)
              ? data.pageCount
              : null,
        });
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to load preview excerpt."
        );
      } finally {
        setPreviewLoadingId(null);
      }
    },
    [getAccessToken]
  );

  const downloadFullDraft = useCallback(
    async (documentId: string) => {
      setDownloadLoadingId(documentId);
      setMessage("");
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/documents/download/${documentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || "Failed to download draft document.");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 60_000);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to download draft document."
        );
      } finally {
        setDownloadLoadingId(null);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (accessToken) {
        const meResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const meData = (await meResponse.json().catch(() => null)) as
          | { user?: { permissionMap?: PermissionMap } }
          | null;

        if (meResponse.ok) {
          setPermissionMap(meData?.user?.permissionMap ?? null);
        }
      }

      await loadDocuments();
    })();
  }, [loadDocuments]);

  const pendingDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        !isArchivedDocumentStatus(doc.status) &&
        isSubmittedDocumentStatus(doc.status, Boolean(doc.final_file_path))
    );
  }, [documents]);

  const approvedDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        !isArchivedDocumentStatus(doc.status) &&
        isApprovedDocumentStatus(doc.status, Boolean(doc.final_file_path))
    );
  }, [documents]);

  const activeDocumentCount = useMemo(() => {
    return documents.filter((doc) => !isArchivedDocumentStatus(doc.status)).length;
  }, [documents]);

  const selectedCount = selectedIds.length;
  const canReviewDocuments = Boolean(
    permissionMap?.can_review_documents || permissionMap?.can_access_internal_admin
  );
  const canApproveDocuments = Boolean(permissionMap?.can_approve_documents);

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
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Admin Workflow"
          title="Review Documents"
          description="Manage submitted drafts, complete reviews, and confirm approved files."
        />
        <InlineMessage>Loading submissions...</InlineMessage>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Admin Workflow"
        title="Review Documents"
        description="Manage submitted drafts, complete reviews, and confirm approved files."
        actions={
          <>
            <Link
              href="/admin/archive"
              className="rounded-xl border border-[var(--app-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:border-[rgba(79,125,243,0.24)] hover:bg-[var(--app-accent-primary-soft)]"
            >
              Open Archive
            </Link>
            <Link
              href="/admin"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Admin Dashboard
            </Link>
          </>
        }
      />

      <SectionCard
        title="Bulk Actions"
        description={`${selectedCount} document${selectedCount === 1 ? "" : "s"} selected across the active review workflow.`}
      >
        {!canReviewDocuments ? (
          <div className="mb-4">
            <InlineMessage tone="warning">
              Your current role does not have review access for this queue.
            </InlineMessage>
          </div>
        ) : null}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runBulkAction("archive")}
              disabled={selectedCount === 0 || Boolean(bulkLoading) || !canReviewDocuments}
              className="rounded-xl border border-[var(--semantic-warning)] bg-[var(--semantic-warning)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(217,164,65,0.2)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading === "archive" ? "Archiving..." : "Archive Selected"}
            </button>
            <button
              type="button"
              onClick={() => void runBulkAction("delete")}
              disabled={selectedCount === 0 || Boolean(bulkLoading) || !canReviewDocuments}
              className="rounded-xl border border-[var(--semantic-danger)] bg-[var(--semantic-danger)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(217,83,79,0.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading === "delete" ? "Deleting..." : "Delete Selected"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedCount === 0 || Boolean(bulkLoading) || !canReviewDocuments}
              className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {message ? <div className="mt-4"><InlineMessage>{message}</InlineMessage></div> : null}
      </SectionCard>

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
        onPreviewDraft={previewDraftExcerpt}
        onDownloadFullDraft={downloadFullDraft}
        previewLoadingId={previewLoadingId}
        downloadLoadingId={downloadLoadingId}
        canReviewDocuments={canReviewDocuments}
        canApproveDocuments={canApproveDocuments}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />

      <ReviewSection
        title="Approved Documents"
        emptyMessage="No approved documents yet."
        documents={approvedDocuments}
        actionLabel="Open Review"
        onPreviewDraft={previewDraftExcerpt}
        onDownloadFullDraft={downloadFullDraft}
        previewLoadingId={previewLoadingId}
        downloadLoadingId={downloadLoadingId}
        canReviewDocuments={canReviewDocuments}
        canApproveDocuments={canApproveDocuments}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />

      <MarketplacePreviewModal
        open={Boolean(excerptModal)}
        onClose={() => setExcerptModal(null)}
        title={excerptModal?.title ?? ""}
        excerpt={excerptModal?.excerpt ?? ""}
        truncated={excerptModal?.truncated ?? false}
        empty={excerptModal?.empty ?? false}
        pageCount={excerptModal?.pageCount ?? null}
        variant="admin"
      />
    </div>
  );
}

function ReviewSection({
  title,
  emptyMessage,
  documents,
  actionLabel,
  onPreviewDraft,
  onDownloadFullDraft,
  previewLoadingId,
  downloadLoadingId,
  canReviewDocuments,
  canApproveDocuments,
  selectedIds,
  setSelectedIds,
}: {
  title: string;
  emptyMessage: string;
  documents: DocumentItem[];
  actionLabel: string;
  onPreviewDraft: (documentId: string) => Promise<void>;
  onDownloadFullDraft: (documentId: string) => Promise<void>;
  previewLoadingId: string | null;
  downloadLoadingId: string | null;
  canReviewDocuments: boolean;
  canApproveDocuments: boolean;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}) {
  const sectionIds = documents.map((doc) => doc.id);
  const allSelected =
    sectionIds.length > 0 && sectionIds.every((id) => selectedIds.includes(id));

  return (
        <SectionCard
          title={title}
          description={`${documents.length} item${documents.length === 1 ? "" : "s"} in this queue.`}
          aside={
            documents.length > 0 ? (
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={!canReviewDocuments}
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
            ) : null
          }
        >
      <div className="space-y-4">
        {documents.length === 0 ? (
          <EmptyState title="Nothing in this queue" description={emptyMessage} />
        ) : (
          documents.map((doc) => {
            const titleText =
              doc.project_name ?? doc.document_type ?? "Untitled Document";

            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-[var(--app-border-strong)] bg-[rgba(255,255,255,0.9)] p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      disabled={!canReviewDocuments}
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
                      <h3 className="text-lg font-semibold text-[var(--app-text-strong)]">
                        {titleText}
                      </h3>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          statusClasses(doc.status),
                        ].join(" ")}
                      >
                        {getDocumentStatusLabel(doc.status, Boolean(doc.final_file_path))}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--app-text)]">
                      Type: {doc.document_type ? formatSafetyBlueprintDocumentType(doc.document_type) : "-"}
                    </p>
                    <p className="text-sm text-[var(--app-text)]">
                      User ID: {doc.user_id}
                    </p>
                    <p className="text-sm text-[var(--app-text)]">
                      Submitted: {new Date(doc.created_at).toLocaleString()}
                    </p>
                    {doc.review_notes ? (
                      <p className="mt-1 text-sm text-[var(--app-muted)]">
                        Notes: {doc.review_notes}
                      </p>
                    ) : null}
                  </Link>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void onPreviewDraft(doc.id);
                      }}
                      disabled={!canReviewDocuments || previewLoadingId === doc.id}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--app-border-strong)] bg-white px-4 text-sm font-extrabold text-[var(--app-text-strong)] hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-60"
                    >
                      {previewLoadingId === doc.id ? "Loading excerpt…" : "Preview excerpt"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onDownloadFullDraft(doc.id);
                      }}
                      disabled={!canReviewDocuments || downloadLoadingId === doc.id}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--semantic-warning)] bg-[var(--semantic-warning)] px-4 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-60"
                    >
                      {downloadLoadingId === doc.id ? "Downloading…" : "Download full draft"}
                    </button>

                    <Link
                      href={`/admin/review-documents/${doc.id}`}
                      className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-extrabold ${
                        canApproveDocuments
                          ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary)] !text-white hover:bg-[var(--app-accent-primary-hover)]"
                          : "border-[var(--app-border-strong)] bg-[var(--semantic-neutral-bg)] !text-[var(--semantic-neutral)]"
                      }`}
                    >
                      {canApproveDocuments ? actionLabel : "View"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">
        {value}
      </p>
    </div>
  );
}
