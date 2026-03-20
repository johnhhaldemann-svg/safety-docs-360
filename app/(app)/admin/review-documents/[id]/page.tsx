"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
} from "@/components/WorkspacePrimitives";
import type { PermissionMap } from "@/lib/rbac";
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
  document_type?: string | null;
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

type FeedbackTone = "neutral" | "success" | "warning" | "error";

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

function statusClasses(status?: string | null) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "submitted") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "archived") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

export default function ReviewDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [documentItem, setDocumentItem] = useState<DocumentItem | null>(null);
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);
  const [creditCost, setCreditCost] = useState("5");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMarketplace, setSavingMarketplace] = useState(false);
  const [openingDraft, setOpeningDraft] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState<
    "archive" | "restore" | "delete" | ""
  >("");
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");

  const setFeedbackMessage = useCallback(
    (message: string, tone: FeedbackTone = "neutral") => {
      setFeedback(message);
      setFeedbackTone(tone);
    },
    []
  );

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

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) return;

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
    })();
  }, []);

  const openDraftDocument = useCallback(async () => {
    if (!documentItem?.id) {
      return;
    }

    setOpeningDraft(true);

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/documents/download/${documentItem.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Failed to open draft document.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60_000);
      setFeedbackMessage("Draft DOCX opened in a new tab.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to open draft document.",
        "error"
      );
    } finally {
      setOpeningDraft(false);
    }
  }, [documentItem?.id, getAccessToken, setFeedbackMessage]);

  async function uploadFinalDoc() {
    if (!file || !documentItem) {
      setFeedbackMessage("Choose the final DOCX before sending approval.", "warning");
      return;
    }

    setSaving(true);
    setFeedback("");

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
        setFeedbackMessage(data?.error || "Approval failed.", "error");
        return;
      }

      await loadDocument();
      setFile(null);
      setFeedbackMessage("Final document approved and sent to the user.", "success");
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Upload failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMarketplaceSettings() {
    if (!documentItem) return;

    setSavingMarketplace(true);
    setFeedback("");

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
        setFeedbackMessage(
          data?.error || "Failed to save marketplace settings.",
          "error"
        );
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
      setFeedbackMessage("Marketplace settings saved.", "success");
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Failed to save marketplace settings.", "error");
    } finally {
      setSavingMarketplace(false);
    }
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
    setFeedback("");

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
        setFeedbackMessage(data?.error || "Lifecycle update failed.", "error");
        return;
      }

      if (action === "delete") {
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
      setFeedbackMessage(
        action === "archive" ? "Document archived." : "Document restored.",
        "success"
      );
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Lifecycle update failed.", "error");
    } finally {
      setLifecycleLoading("");
    }
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

  const checklistItems = useMemo(
    () => [
      {
        label: "Draft document available",
        done: Boolean(documentItem?.draft_file_path),
      },
      { label: "Reviewer contact saved", done: Boolean(reviewerEmail.trim()) },
      { label: "Review notes captured", done: Boolean(reviewNotes.trim()) },
      {
        label: "Final file uploaded",
        done: Boolean(file || documentItem?.final_file_path),
      },
    ],
    [
      documentItem?.draft_file_path,
      documentItem?.final_file_path,
      file,
      reviewNotes,
      reviewerEmail,
    ]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Admin Workflow"
          title="Review Workspace"
          description="Open the submitted draft, complete your review notes, and approve the final document."
        />
        <InlineMessage>Loading review workspace...</InlineMessage>
      </div>
    );
  }

  if (!documentItem) {
    return (
      <div className="space-y-6">
        <PageHero
          eyebrow="Admin Workflow"
          title="Review Workspace"
          description="Open the submitted draft, complete your review notes, and approve the final document."
          actions={
            <Link
              href="/admin/review-documents"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Review Queue
            </Link>
          }
        />
        <EmptyState
          title="Document not found"
          description={loadError || "This review record could not be loaded."}
          actionHref="/admin/review-documents"
          actionLabel="Return to queue"
        />
      </div>
    );
  }

  const titleText =
    documentItem.project_name || documentItem.document_type || "Untitled document";
  const normalizedStatus = documentItem.status?.trim().toLowerCase() || "unknown";
  const canReviewDocuments = Boolean(permissionMap?.can_review_documents);
  const canApproveDocuments = Boolean(permissionMap?.can_approve_documents);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Construction Safety Hub"
        title={titleText}
        description="Review the submitted draft, capture reviewer notes, approve the final document, and manage lifecycle settings from one workspace."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                void openDraftDocument();
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {openingDraft ? "Opening Draft..." : "Open Draft DOCX"}
            </button>
            <Link
              href="/admin/review-documents"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Back to Review Queue
            </Link>
          </>
        }
      />

      {feedback ? <InlineMessage tone={feedbackTone}>{feedback}</InlineMessage> : null}
      {!canReviewDocuments ? (
        <InlineMessage tone="warning">
          Your current role does not have access to review this document.
        </InlineMessage>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Status"
          value={
            normalizedStatus === "approved"
              ? "Approved"
              : normalizedStatus === "submitted"
                ? "Submitted"
                : normalizedStatus === "archived"
                  ? "Archived"
                  : "In Review"
          }
          detail="Current workflow state for this document."
        />
        <StatCard
          label="Document Type"
          value={documentItem.document_type || "PSHSEP"}
          detail="Primary document category saved on the record."
        />
        <StatCard
          label="Marketplace"
          value={marketplaceEnabled ? `${creditCost} credits` : "Hidden"}
          detail="Completed document listing and credit cost."
        />
        <StatCard
          label="Last Updated"
          value={formatRelative(
            documentItem.approved_at ??
              documentItem.marketplace_updated_at ??
              documentItem.created_at
          )}
          detail="Most recent review or marketplace event."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <SectionCard
            title="Review Summary"
            description="Document details, reviewer ownership, and current approval readiness."
            aside={
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(documentItem.status)}`}
              >
                {documentItem.status || "unknown"}
              </span>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Project
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {documentItem.project_name || "Untitled project"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Submitted
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {formatAbsolute(documentItem.created_at)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Reviewer
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {reviewerEmail || "Not assigned yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Final File
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {documentItem.final_file_path ? "Uploaded" : "Waiting for approval"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Draft source</p>
                <p className="mt-2 text-sm text-slate-600">
                  Download the submitted draft to complete edits in Word before uploading the approved version.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void openDraftDocument();
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {openingDraft ? "Opening..." : "Open Draft DOCX"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Current review notes</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {reviewNotes.trim()
                    ? reviewNotes
                    : "No reviewer notes have been captured yet. Add any approval comments or required edits below."}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Approval Workspace"
            description="Upload the final DOCX, confirm reviewer details, and send the approved version back into the workspace."
          >
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Final DOCX
                  </label>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                    className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-sky-500"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {file ? `Selected: ${file.name}` : "Upload the final approved DOCX file."}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Reviewer Email
                  </label>
                  <input
                    type="email"
                    value={reviewerEmail}
                    onChange={(event) => setReviewerEmail(event.target.value)}
                    placeholder="reviewer@company.com"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Review Notes
                </label>
                <textarea
                  rows={5}
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Summarize corrections, approvals, or handoff notes for the user."
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Ready to send the final document?
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      This will save the final DOCX, mark the document as approved, and notify the workspace record.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={uploadFinalDoc}
                    disabled={saving || !canApproveDocuments}
                    className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Approving..." : canApproveDocuments ? "Approve and Send Final" : "Approval Restricted"}
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Marketplace Settings"
            description="Control whether this approved document appears in the credit marketplace and what it costs to unlock."
          >
            <div className="space-y-5">
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    List in marketplace
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Approved documents can be hidden or listed for credit purchase.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketplaceEnabled}
                  onChange={(event) => setMarketplaceEnabled(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>

              <div className="max-w-xs">
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Credit Cost
                </label>
                <input
                  type="number"
                  min={1}
                  value={creditCost}
                  onChange={(event) => setCreditCost(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveMarketplaceSettings}
                  disabled={savingMarketplace || !canApproveDocuments}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingMarketplace ? "Saving..." : "Save Marketplace Settings"}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Timeline"
            description="Review lifecycle, approval, and marketplace history for this document."
          >
            {timelineEvents.length === 0 ? (
              <EmptyState
                title="No events yet"
                description="Timeline events will appear here as the document moves through approval and lifecycle updates."
              />
            ) : (
              <div className="space-y-3">
                {timelineEvents.map((event, index) => (
                  <div
                    key={event.key}
                    className="flex gap-4 rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
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
          </SectionCard>

          <SectionCard
            title="Lifecycle Controls"
            description="Archive finished work, restore archived records, or permanently delete the document and stored files."
          >
            <div className="flex flex-wrap gap-3">
              {isArchivedStatus(documentItem.status) ? (
                <button
                  type="button"
                  onClick={() => void runLifecycleAction("restore")}
                  disabled={Boolean(lifecycleLoading) || !canApproveDocuments}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lifecycleLoading === "restore" ? "Restoring..." : "Restore Document"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void runLifecycleAction("archive")}
                  disabled={Boolean(lifecycleLoading) || !canApproveDocuments}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lifecycleLoading === "archive" ? "Archiving..." : "Archive Document"}
                </button>
              )}

              <button
                type="button"
                onClick={() => void runLifecycleAction("delete")}
                disabled={Boolean(lifecycleLoading) || !canApproveDocuments}
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {lifecycleLoading === "delete" ? "Deleting..." : "Delete Document"}
              </button>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <StartChecklist
            title="Approval Checklist"
            items={checklistItems}
          />

          <SectionCard
            title="Review Guidance"
            description="Use the same workflow every time so documents stay consistent for admins and field teams."
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                1. Open the draft DOCX and complete edits in Word.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                2. Capture reviewer email and approval notes before sending.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                3. Upload the final DOCX and approve the document.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                4. Decide whether the completed file should appear in the marketplace.
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Approval State"
            description="A quick status summary for the document and final file."
          >
            <div className="space-y-3">
              <InlineMessage
                tone={
                  documentItem.final_file_path
                    ? "success"
                    : isArchivedStatus(documentItem.status)
                      ? "warning"
                      : "neutral"
                }
              >
                {documentItem.final_file_path
                  ? "A final file is attached to this record and the document can be opened from the user library."
                  : isArchivedStatus(documentItem.status)
                    ? "This document is archived and hidden from active workspace views until restored."
                    : "This record is still waiting for final approval and delivery."}
              </InlineMessage>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
