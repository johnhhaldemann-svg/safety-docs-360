"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { MarketplacePreviewModal } from "@/components/MarketplacePreviewModal";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import type { BuilderProgramAiReview } from "@/lib/builderDocumentAiReview";
import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";
import { isDocumentAiReviewerRole } from "@/lib/documentAiReviewAuth";
import type { PermissionMap } from "@/lib/rbac";
import {
  getDocumentCreditCost,
  getMarketplacePreviewPath,
  getSubmitterPreviewStatus,
  isMarketplaceEnabled,
} from "@/lib/marketplace";
import {
  GC_REQUIRED_PROGRAM_DOCUMENT_TYPE,
  canReviewGcProgramDocumentRole,
} from "@/lib/gcRequiredProgram";
import type { GcProgramAiReview } from "@/lib/gcProgramAiReview";
import { formatSafetyBlueprintDocumentType } from "@/lib/safetyBlueprintLabels";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentItem = {
  id: string;
  project_name: string;
  document_type?: string | null;
  document_title?: string | null;
  file_name?: string | null;
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
  generated_document_id?: string | null;
  file_path?: string | null;
  final_file_path: string | null;
  reviewer_email: string | null;
  review_notes: string | null;
};

type FeedbackTone = "neutral" | "success" | "warning" | "error";
type AiExtractionMeta =
  | {
      ok: true;
      method: string;
      truncated: boolean;
      annotations: ReviewDocumentAnnotation[];
    }
  | {
      ok: false;
      error: string;
    };

type AiSiteExtractionMeta =
  | {
      fileName: string;
      ok: true;
      method: string;
      truncated: boolean;
      annotations: ReviewDocumentAnnotation[];
    }
  | null;

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

  if (normalized === "approved") return "app-badge-success";
  if (normalized === "submitted") return "app-badge-warning";
  if (normalized === "archived") return "app-badge-neutral";
  return "app-badge-neutral";
}

function adminApiJsonErrorMessage(res: Response, rawText: string, parsed: unknown): string {
  if (parsed && typeof parsed === "object" && parsed !== null) {
    const err = (parsed as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) return err.trim();
  }
  const t = rawText.trim();
  if (t.length > 0 && !t.startsWith("<!") && !t.startsWith("<html")) {
    return t.length > 500 ? `${t.slice(0, 500)}…` : t;
  }
  return `AI review failed (HTTP ${res.status}).`;
}

function ReviewList({
  title,
  items,
  tone = "text-slate-200",
}: {
  title: string;
  items: string[];
  tone?: string;
}) {
  if (!items.length) return null;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${tone}`}>
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item.slice(0, 48)}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function EmbeddedReviewNotes({ annotations }: { annotations: ReviewDocumentAnnotation[] }) {
  if (!annotations.length) return null;

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Embedded Reviewer Notes
      </p>
      <div className="mt-3 space-y-3">
        {annotations.map((annotation) => (
          <div
            key={`${annotation.id}-${annotation.note.slice(0, 32)}`}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <p className="text-sm font-semibold text-slate-100">{annotation.note}</p>
            {annotation.anchorText ? (
              <p className="mt-1 text-xs text-slate-400">Anchor: {annotation.anchorText}</p>
            ) : null}
            <p className="mt-1 text-[11px] text-slate-500">
              Comment {annotation.id}
              {annotation.author ? ` • ${annotation.author}` : ""}
              {annotation.date ? ` • ${new Date(annotation.date).toLocaleString()}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
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
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-100">
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);
  const [creditCost, setCreditCost] = useState("5");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMarketplace, setSavingMarketplace] = useState(false);
  const [marketplacePreviewFile, setMarketplacePreviewFile] = useState<File | null>(null);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewExcerptLoading, setPreviewExcerptLoading] = useState(false);
  const [fullFileDownloadLoading, setFullFileDownloadLoading] = useState(false);
  const [regenerateDraftLoading, setRegenerateDraftLoading] = useState(false);
  const [excerptModal, setExcerptModal] = useState<{
    title: string;
    excerpt: string;
    truncated: boolean;
    empty: boolean;
    pageCount?: number | null;
  } | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState<
    "archive" | "restore" | "delete" | ""
  >("");
  const [gcReviewLoading, setGcReviewLoading] = useState<"approve" | "reject" | "">(
    ""
  );
  const [gcAiContext, setGcAiContext] = useState("");
  const [gcSiteReferenceFile, setGcSiteReferenceFile] = useState<File | null>(null);
  const [gcAiLoading, setGcAiLoading] = useState(false);
  const [gcAiResult, setGcAiResult] = useState<GcProgramAiReview | null>(null);
  const [gcAiDisclaimer, setGcAiDisclaimer] = useState("");
  const [gcAiExtraction, setGcAiExtraction] = useState<AiExtractionMeta | null>(null);
  const [gcAiSiteExtraction, setGcAiSiteExtraction] = useState<AiSiteExtractionMeta>(null);
  const [gcAiError, setGcAiError] = useState("");
  const [builderAiContext, setBuilderAiContext] = useState("");
  const [builderSiteReferenceFile, setBuilderSiteReferenceFile] = useState<File | null>(null);
  const [builderAiLoading, setBuilderAiLoading] = useState(false);
  const [builderAiResult, setBuilderAiResult] = useState<BuilderProgramAiReview | null>(null);
  const [builderAiDisclaimer, setBuilderAiDisclaimer] = useState("");
  const [builderAiExtraction, setBuilderAiExtraction] = useState<AiExtractionMeta | null>(null);
  const [builderAiSiteExtraction, setBuilderAiSiteExtraction] =
    useState<AiSiteExtractionMeta>(null);
  const [builderAiError, setBuilderAiError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const [marketplacePreviewPageCount, setMarketplacePreviewPageCount] = useState<number | null>(
    null
  );

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
        | { user?: { permissionMap?: PermissionMap; role?: string } }
        | null;

      if (meResponse.ok) {
        setPermissionMap(meData?.user?.permissionMap ?? null);
        setUserRole(meData?.user?.role ?? null);
      }
    })();
  }, []);

  const previewAdminExcerpt = useCallback(async () => {
    if (!documentItem?.id) {
      return;
    }

    setPreviewExcerptLoading(true);

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/documents/${documentItem.id}/preview-excerpt`, {
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
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to load preview excerpt.",
        "error"
      );
    } finally {
      setPreviewExcerptLoading(false);
    }
  }, [documentItem?.id, getAccessToken, setFeedbackMessage]);

  const downloadFullDraft = useCallback(async () => {
    if (!documentItem?.id) {
      return;
    }

    setFullFileDownloadLoading(true);

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
        throw new Error(data?.error || "Failed to download draft document.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60_000);
      setFeedbackMessage("Full draft opened in a new tab.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to download draft document.",
        "error"
      );
    } finally {
      setFullFileDownloadLoading(false);
    }
  }, [documentItem?.id, getAccessToken, setFeedbackMessage]);

  const downloadGcFullUpload = useCallback(async () => {
    if (!documentItem?.id) {
      return;
    }

    setFullFileDownloadLoading(true);

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/documents/${documentItem.id}/download-upload`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Failed to open full company upload.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60_000);
      setFeedbackMessage("Full company upload opened in a new tab.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Failed to open company upload.",
        "error"
      );
    } finally {
      setFullFileDownloadLoading(false);
    }
  }, [documentItem?.id, getAccessToken, setFeedbackMessage]);

  const regenerateDraft = useCallback(async () => {
    if (!documentItem?.id) {
      return;
    }

    setRegenerateDraftLoading(true);

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/documents/${documentItem.id}/regenerate-draft`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = await res.text();
      type RegenerateDraftJson = { error?: string; success?: boolean };
      let data: RegenerateDraftJson | null = null;
      try {
        data = raw ? (JSON.parse(raw) as RegenerateDraftJson) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const message =
          (data && typeof data.error === "string" && data.error) ||
          (raw.trim() && !raw.trim().startsWith("<")
            ? raw.trim().slice(0, 500)
            : `Draft regeneration failed (HTTP ${res.status}).`);
        throw new Error(message);
      }

      await loadDocument();
      setFeedbackMessage("Draft regenerated from the saved AI draft.", "success");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Draft regeneration failed.",
        "error"
      );
    } finally {
      setRegenerateDraftLoading(false);
    }
  }, [documentItem?.id, getAccessToken, loadDocument, setFeedbackMessage]);

  async function runGcReview(action: "approve" | "reject") {
    if (!documentItem?.id) {
      return;
    }

    setGcReviewLoading(action === "approve" ? "approve" : "reject");
    setFeedback("");

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/gc-program-document/${documentItem.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        setFeedbackMessage(data?.error || "GC review action failed.", "error");
        return;
      }

      if (action === "reject") {
        router.push("/admin/review-documents");
        router.refresh();
        setFeedbackMessage("GC submission rejected and removed.", "success");
        return;
      }

      await loadDocument();
      setFeedbackMessage("GC program document approved for the company workspace.", "success");
    } catch (error) {
      console.error(error);
      setFeedbackMessage("GC review action failed.", "error");
    } finally {
      setGcReviewLoading("");
    }
  }

  async function runGcAiReview() {
    if (!documentItem?.id) {
      return;
    }

    setGcAiLoading(true);
    setGcAiError("");
    setGcAiResult(null);
    setGcAiDisclaimer("");
    setGcAiExtraction(null);
    setGcAiSiteExtraction(null);

    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.append("additionalGcContext", gcAiContext);
      if (gcSiteReferenceFile) {
        form.append("siteDocument", gcSiteReferenceFile);
      }

      const res = await fetch(`/api/admin/gc-program-document/${documentItem.id}/ai-review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const rawText = await res.text();
      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }
      const data = parsed as
        | {
            error?: string;
            review?: GcProgramAiReview;
            disclaimer?: string;
            extraction?: AiExtractionMeta;
            siteReferenceExtraction?: AiSiteExtractionMeta;
          }
        | null;

      if (!res.ok) {
        setGcAiError(adminApiJsonErrorMessage(res, rawText, parsed));
        return;
      }

      if (data?.review) {
        setGcAiResult(data.review);
      }
      setGcAiDisclaimer(data?.disclaimer ?? "");
      setGcAiExtraction(data?.extraction ?? null);
      const siteEx = data?.siteReferenceExtraction;
      setGcAiSiteExtraction(siteEx?.ok === true ? siteEx : null);
    } catch (error) {
      console.error(error);
      setGcAiError(error instanceof Error ? error.message : "AI review failed.");
    } finally {
      setGcAiLoading(false);
    }
  }

  async function runBuilderAiReview() {
    if (!documentItem?.id) {
      return;
    }

    setBuilderAiLoading(true);
    setBuilderAiError("");
    setBuilderAiResult(null);
    setBuilderAiDisclaimer("");
    setBuilderAiExtraction(null);
    setBuilderAiSiteExtraction(null);

    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.append("additionalReviewerContext", builderAiContext);
      if (builderSiteReferenceFile) {
        form.append("siteDocument", builderSiteReferenceFile);
      }

      const res = await fetch(`/api/admin/documents/${documentItem.id}/ai-review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const rawText = await res.text();
      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }
      const data = parsed as
        | {
            error?: string;
            review?: BuilderProgramAiReview;
            disclaimer?: string;
            programLabel?: string;
            extraction?: AiExtractionMeta;
            siteReferenceExtraction?: AiSiteExtractionMeta;
          }
        | null;

      if (!res.ok) {
        setBuilderAiError(adminApiJsonErrorMessage(res, rawText, parsed));
        return;
      }

      if (data?.review) {
        setBuilderAiResult(data.review);
      }
      setBuilderAiDisclaimer(data?.disclaimer ?? "");
      setBuilderAiExtraction(data?.extraction ?? null);
      setBuilderAiSiteExtraction(
        data?.siteReferenceExtraction?.ok === true ? data.siteReferenceExtraction : null
      );
    } catch (error) {
      console.error(error);
      setBuilderAiError(error instanceof Error ? error.message : "AI review failed.");
    } finally {
      setBuilderAiLoading(false);
    }
  }

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

  async function generateMarketplacePreviewPdf() {
    if (!documentItem) return;

    setGeneratingPreview(true);
    setFeedback("");

    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/admin/documents/${documentItem.id}/generate-marketplace-preview`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const raw = await res.text();
      const data = (() => {
        try {
          return raw
            ? (JSON.parse(raw) as {
                error?: string;
                notes?: string;
                previewFilePath?: string;
                pageCount?: number | null;
              })
            : null;
        } catch {
          return null;
        }
      })();

      if (!res.ok) {
        const fallback =
          raw.trim() && !raw.trim().startsWith("<")
            ? raw.trim().slice(0, 240)
            : `Preview failed (HTTP ${res.status}).`;
        setFeedbackMessage(data?.error || fallback || "Failed to generate preview PDF.", "error");
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
      setMarketplacePreviewPageCount(
        typeof data?.pageCount === "number" && Number.isFinite(data.pageCount)
          ? data.pageCount
          : null
      );
      await loadDocument();
      setFeedbackMessage(
        typeof data?.pageCount === "number" && Number.isFinite(data.pageCount)
          ? `Preview PDF generated (${data.pageCount} pages) and sent to the document owner for approval.`
          : "Preview PDF generated and sent to the document owner for approval.",
        "success"
      );
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Failed to generate preview PDF.", "error");
    } finally {
      setGeneratingPreview(false);
    }
  }

  async function uploadMarketplacePreview() {
    if (!documentItem) return;

    if (!marketplacePreviewFile) {
      setFeedbackMessage("Choose a PDF or DOCX preview file first.", "warning");
      return;
    }

    setUploadingPreview(true);
    setFeedback("");

    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("file", marketplacePreviewFile);

      const res = await fetch(
        `/api/admin/documents/${documentItem.id}/marketplace/preview`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            notes?: string;
            previewFilePath?: string;
            pageCount?: number | null;
          }
        | null;

      if (!res.ok) {
        setFeedbackMessage(data?.error || "Failed to upload preview.", "error");
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
      setMarketplacePreviewPageCount(
        typeof data?.pageCount === "number" && Number.isFinite(data.pageCount)
          ? data.pageCount
          : null
      );
      setMarketplacePreviewFile(null);
      await loadDocument();
      setFeedbackMessage(
        typeof data?.pageCount === "number" && Number.isFinite(data.pageCount)
          ? `Marketplace preview uploaded (${data.pageCount} pages).`
          : "Marketplace preview uploaded.",
        "success"
      );
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Failed to upload preview.", "error");
    } finally {
      setUploadingPreview(false);
    }
  }

  async function removeMarketplacePreview() {
    if (!documentItem) return;

    if (!getMarketplacePreviewPath(documentItem.notes)) {
      setFeedbackMessage("There is no preview to remove.", "warning");
      return;
    }

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
            previewFilePath: null,
          }),
        }
      );

      const data = (await res.json().catch(() => null)) as
        | { error?: string; notes?: string }
        | null;

      if (!res.ok) {
        setFeedbackMessage(
          data?.error || "Failed to remove marketplace preview.",
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
      setMarketplacePreviewPageCount(null);
      await loadDocument();
      setFeedbackMessage("Marketplace preview removed.", "success");
    } catch (error) {
      console.error(error);
      setFeedbackMessage("Failed to remove marketplace preview.", "error");
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

  const checklistItems = useMemo(() => {
    const isGc =
      documentItem?.document_type?.trim() === GC_REQUIRED_PROGRAM_DOCUMENT_TYPE;

    if (isGc) {
      return [
        {
          label: "Company upload received",
          done: Boolean(documentItem?.file_path),
        },
        {
          label: "Approved for workspace",
          done: Boolean(documentItem?.final_file_path),
        },
      ];
    }

    return [
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
    ];
  }, [
    documentItem?.document_type,
    documentItem?.draft_file_path,
    documentItem?.file_path,
    documentItem?.final_file_path,
    file,
    reviewNotes,
    reviewerEmail,
  ]);

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
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
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
    documentItem.project_name ||
    documentItem.document_title ||
    documentItem.document_type ||
    "Untitled document";
  const normalizedStatus = documentItem.status?.trim().toLowerCase() || "unknown";
  const canAccessInternalAdmin = Boolean(permissionMap?.can_access_internal_admin);
  const canReviewDocuments = Boolean(
    permissionMap?.can_review_documents || permissionMap?.can_access_internal_admin
  );
  const canApproveDocuments = Boolean(permissionMap?.can_approve_documents);
  const isGcProgramDoc =
    documentItem.document_type?.trim() === GC_REQUIRED_PROGRAM_DOCUMENT_TYPE;
  const canActOnGcProgram = canReviewGcProgramDocumentRole(userRole);
  const gcPendingApproval =
    isGcProgramDoc &&
    normalizedStatus === "submitted" &&
    !documentItem.final_file_path;
  const canRunDocumentAiReview = isDocumentAiReviewerRole(userRole);
  const showGcAiReview = isGcProgramDoc && canRunDocumentAiReview && Boolean(documentItem.file_path);
  const builderProgramType = (() => {
    const t = (documentItem.document_type ?? "").trim().toUpperCase();
    if (t === "CSEP" || t === "PSHSEP" || t === "PESHEP" || t === "PESHEPS") return t;
    return null;
  })();
  const showBuilderAiReview =
    !isGcProgramDoc &&
    Boolean(builderProgramType) &&
    canRunDocumentAiReview &&
    Boolean(documentItem.draft_file_path || documentItem.final_file_path);
  const canOpenPrimaryReviewFile = isGcProgramDoc
    ? Boolean(documentItem.file_path)
    : Boolean(documentItem.draft_file_path);
  const canRegenerateStoredDraft =
    !isGcProgramDoc &&
    Boolean(documentItem.generated_document_id) &&
    Boolean(documentItem.draft_file_path) &&
    canApproveDocuments;
  const reviewNotesProvided = Boolean(reviewerEmail.trim() || reviewNotes.trim());
  const hasFinalFile = Boolean(documentItem.final_file_path);
  const marketplacePreviewPath = getMarketplacePreviewPath(documentItem.notes);
  const submitterPreviewStatus = getSubmitterPreviewStatus(documentItem.notes);
  const canManageOwnerPreview =
    !isGcProgramDoc && Boolean(builderProgramType) && canApproveDocuments;
  const ownerPreviewActionLabel = marketplacePreviewPath
    ? "Regenerate preview PDF for owner"
    : "Generate preview PDF for owner";
  const ownerPreviewHelperText = marketplacePreviewPath
    ? submitterPreviewStatus === "rejected"
      ? "The current owner preview was rejected. Regenerate it here so the submitter can review a fresh copy."
      : "A preview is already attached. Regenerate it here if the submitted CSEP changed or you want to replace the owner review copy."
    : "Create the owner review PDF directly from this submitted CSEP before approval.";
  const currentStepLabel = isArchivedStatus(documentItem.status)
    ? "Archived"
    : isGcProgramDoc
      ? hasFinalFile
        ? "Published"
        : reviewNotesProvided
          ? "Ready to approve"
          : "Review upload"
      : hasFinalFile
        ? "Approved"
        : reviewNotesProvided
          ? "Finalize DOCX"
          : "Review draft";
  const reviewWorkflowSteps = isGcProgramDoc
    ? [
        {
          label: "Review company upload",
          detail: "Open the submitted file and confirm it matches the GC requirements.",
          complete: Boolean(documentItem.file_path),
          active: !documentItem.file_path,
        },
        {
          label: "Capture review notes",
          detail: "Record missing items, reviewer comments, and any required edits.",
          complete: reviewNotesProvided,
          active: !reviewNotesProvided && Boolean(documentItem.file_path),
        },
        {
          label: "Approve or reject",
          detail: "Release the upload to the workspace or remove it from the queue.",
          complete: hasFinalFile || isArchivedStatus(documentItem.status),
          active: !hasFinalFile && !isArchivedStatus(documentItem.status),
        },
        {
          label: "Track publish state",
          detail: "Use marketplace and lifecycle controls after the approval decision.",
          complete: hasFinalFile,
          active: hasFinalFile && !isArchivedStatus(documentItem.status),
        },
      ]
    : [
        {
          label: "Review draft DOCX",
          detail: "Open the draft file and complete any edits before final approval.",
          complete: Boolean(documentItem.draft_file_path),
          active: !documentItem.draft_file_path,
        },
        {
          label: "Capture reviewer notes",
          detail: "Save the reviewer email and any approval comments before sending.",
          complete: reviewNotesProvided,
          active: !reviewNotesProvided && Boolean(documentItem.draft_file_path),
        },
        {
          label: "Upload final DOCX",
          detail: "Attach the approved file and mark the document as ready for delivery.",
          complete: hasFinalFile,
          active: !hasFinalFile && reviewNotesProvided,
        },
        {
          label: "Publish or archive",
          detail:
            "Decide whether the completed file should stay active, move to marketplace, or be archived.",
          complete: hasFinalFile || isArchivedStatus(documentItem.status),
          active: hasFinalFile && !isArchivedStatus(documentItem.status),
        },
      ];

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Construction Safety Hub"
        title={titleText}
        description={
          isGcProgramDoc
            ? "Review the company’s GC-required program upload. Approve to release it to their workspace, or reject to remove it."
            : "Review the submitted draft, capture reviewer notes, approve the final document, and manage lifecycle settings from one workspace."
        }
        actions={
          <>
            {canOpenPrimaryReviewFile ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void previewAdminExcerpt();
                  }}
                  disabled={previewExcerptLoading}
                  className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-950/60 disabled:opacity-60"
                >
                  {previewExcerptLoading ? "Loading excerpt…" : "Preview excerpt"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void (isGcProgramDoc ? downloadGcFullUpload() : downloadFullDraft());
                  }}
                  disabled={fullFileDownloadLoading}
                  className="rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:opacity-60"
                >
                  {fullFileDownloadLoading
                    ? "Opening…"
                    : isGcProgramDoc
                      ? "Open full upload"
                      : "Download full draft"}
                </button>
                {!isGcProgramDoc ? (
                  <button
                    type="button"
                    onClick={() => {
                      void regenerateDraft();
                    }}
                    disabled={regenerateDraftLoading || !canRegenerateStoredDraft}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/50 disabled:opacity-60"
                  >
                    {regenerateDraftLoading
                      ? "Regenerating..."
                      : canRegenerateStoredDraft
                        ? "Regenerate draft"
                        : "Regeneration unavailable"}
                  </button>
                ) : null}
              </>
            ) : null}
            <Link
              href="/admin/review-documents"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Back to Review Queue
            </Link>
          </>
        }
      />

      {feedback ? <InlineMessage tone={feedbackTone}>{feedback}</InlineMessage> : null}
      {!canReviewDocuments && !canAccessInternalAdmin ? (
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
          value={formatSafetyBlueprintDocumentType(documentItem.document_type || "PSHSEP")}
          detail="Primary document category saved on the record."
        />
        <StatCard
          label="Current Step"
          value={currentStepLabel}
          detail="What the reviewer should do next."
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

      <WorkflowPath
        title="Review path"
        description="The page is arranged in the order most admins work through the document. Complete the source review first, then finalize and publish or archive."
        steps={reviewWorkflowSteps}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <SectionCard
            title="Review Summary"
            description="Document details, reviewer ownership, and current approval readiness."
            aside={
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(documentItem.status)}`}
              >
                {documentItem.status || "unknown"}
              </span>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Project
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-100">
                  {documentItem.project_name || "Untitled project"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Submitted
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-100">
                  {formatAbsolute(documentItem.created_at)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Reviewer
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-100">
                  {reviewerEmail || "Not assigned yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Final File
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-100">
                  {documentItem.final_file_path ? "Uploaded" : "Waiting for approval"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/80 p-4">
                <p className="text-sm font-semibold text-slate-100">
                  {isGcProgramDoc ? "Company upload" : "Draft source"}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {isGcProgramDoc
                    ? "Preview an excerpt first; open the full company upload only when you need the complete file. It stays hidden from their workspace until you approve it."
                    : "Preview a short excerpt first. Download the full draft when you need to edit in Word before uploading the approved version."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {isGcProgramDoc ? (
                    documentItem.file_path ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            void previewAdminExcerpt();
                          }}
                          disabled={previewExcerptLoading}
                          className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-950/60 disabled:opacity-60"
                        >
                          {previewExcerptLoading ? "Loading excerpt…" : "Preview excerpt"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void downloadGcFullUpload();
                          }}
                          disabled={fullFileDownloadLoading}
                          className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:opacity-60"
                        >
                          {fullFileDownloadLoading ? "Opening…" : "Open full upload"}
                        </button>
                      </>
                    ) : null
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void previewAdminExcerpt();
                        }}
                        disabled={previewExcerptLoading}
                        className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-950/60 disabled:opacity-60"
                      >
                        {previewExcerptLoading ? "Loading excerpt…" : "Preview excerpt"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void downloadFullDraft();
                        }}
                        disabled={fullFileDownloadLoading}
                        className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:opacity-60"
                      >
                        {fullFileDownloadLoading ? "Opening…" : "Download full draft"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void regenerateDraft();
                        }}
                        disabled={regenerateDraftLoading || !canRegenerateStoredDraft}
                        className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/50 disabled:opacity-60"
                      >
                        {regenerateDraftLoading
                          ? "Regenerating..."
                          : canRegenerateStoredDraft
                            ? "Regenerate draft"
                            : "Regeneration unavailable"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/80 p-4">
                <p className="text-sm font-semibold text-slate-100">Current review notes</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {reviewNotes.trim()
                    ? reviewNotes
                    : "No reviewer notes have been captured yet. Add any approval comments or required edits below."}
                </p>
              </div>
            </div>
          </SectionCard>

          {showBuilderAiReview ? (
            <SectionCard
              title={`AI review (${builderProgramType})`}
              description="Internal triage on the submitted builder draft: OSHA-aligned construction expectations, scope/hazard coverage, and clarity before you approve the final file. Optional: paste owner/GC/site rules not fully reflected in the draft."
            >
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-200">
                  Reviewer context (optional)
                </label>
                <textarea
                  rows={4}
                  value={builderAiContext}
                  onChange={(e) => setBuilderAiContext(e.target.value)}
                  placeholder="e.g. Contract exhibit references, site-specific controls, environmental requirements, client redlines to verify…"
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <div>
                  <label className="block text-sm font-semibold text-slate-200">
                    Site / GC reference document (optional)
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    PDF or DOCX (max 12 MB). The AI compares the draft to this file alongside OSHA expectations.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="block w-full max-w-md text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800/70 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-200 hover:file:bg-slate-200"
                      onChange={(e) => {
                        const next = e.target.files?.[0] ?? null;
                        setBuilderSiteReferenceFile(next);
                      }}
                    />
                    {builderSiteReferenceFile ? (
                      <button
                        type="button"
                        onClick={() => setBuilderSiteReferenceFile(null)}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-950/50"
                      >
                        Clear file
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void runBuilderAiReview()}
                    disabled={builderAiLoading}
                    className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {builderAiLoading ? "Analyzing…" : `Run AI review (${builderProgramType})`}
                  </button>
                </div>
                {builderAiError ? (
                  <InlineMessage tone="error">{builderAiError}</InlineMessage>
                ) : null}
                {builderAiExtraction ? (
                  <p className="text-xs text-slate-500">
                    {builderAiExtraction.ok
                      ? `Text extracted (${builderAiExtraction.method}${builderAiExtraction.truncated ? ", truncated" : ""})${builderAiExtraction.annotations.length ? ` with ${builderAiExtraction.annotations.length} embedded note${builderAiExtraction.annotations.length === 1 ? "" : "s"}` : ""}.`
                      : `Text extraction: ${builderAiExtraction.error ?? "failed"} — review may be limited.`}
                  </p>
                ) : null}
                {builderAiSiteExtraction ? (
                  <p className="text-xs text-slate-500">
                    Site reference ({builderAiSiteExtraction.fileName}): text extracted (
                    {builderAiSiteExtraction.method}
                    {builderAiSiteExtraction.truncated ? ", truncated" : ""}).
                  </p>
                ) : null}
                {builderAiDisclaimer ? (
                  <p className="text-xs text-slate-500">{builderAiDisclaimer}</p>
                ) : null}
                {builderAiExtraction?.ok ? (
                  <EmbeddedReviewNotes annotations={builderAiExtraction.annotations} />
                ) : null}
                {builderAiResult ? (
                  <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-violet-900">
                        Overall
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">
                        {builderAiResult.overallAssessment === "sufficient"
                          ? "Appears broadly ready (verify before approval)"
                          : builderAiResult.overallAssessment === "needs_work"
                            ? "Needs follow-up / strengthening"
                            : "Insufficient context or unreadable text"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Summary
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">
                        {builderAiResult.executiveSummary}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Scope, trades &amp; hazard coverage
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">
                        {builderAiResult.scopeTradeAndHazardCoverage}
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReviewList
                        title="Strengths"
                        items={builderAiResult.regulatoryAndProgramStrengths}
                      />
                      <ReviewList
                        title="Gaps / risks"
                        items={builderAiResult.gapsRisksOrClarifications}
                      />
                    </div>
                    <ReviewList
                      title="Recommended edits before approval"
                      items={builderAiResult.recommendedEditsBeforeApproval}
                    />
                    <ReviewList
                      title="Document quality issues"
                      items={builderAiResult.documentQualityIssues ?? []}
                    />
                    <ReviewList
                      title="Note coverage"
                      items={builderAiResult.noteCoverage ?? []}
                    />
                    <ReviewList
                      title="Checklist delta"
                      items={builderAiResult.checklistDelta ?? []}
                    />
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {showGcAiReview ? (
            <SectionCard
              title="AI review"
              description="Compare the company upload to typical OSHA-aligned expectations and to GC/site rules. Optionally add pasted requirements, and/or upload a site or GC reference document (PDF or DOCX) so the model can cross-check the submission against that file and OSHA."
            >
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-200">
                  Additional GC / site requirements (optional)
                </label>
                <textarea
                  rows={4}
                  value={gcAiContext}
                  onChange={(e) => setGcAiContext(e.target.value)}
                  placeholder="e.g. Site-specific safety plan elements, exhibit references, hot work rules, crane mat requirements…"
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <div>
                  <label className="block text-sm font-semibold text-slate-200">
                    Site / GC reference document (optional)
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    PDF or DOCX (max 12 MB). The AI compares the submission to this file alongside OSHA expectations.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="block w-full max-w-md text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800/70 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-200 hover:file:bg-slate-200"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setGcSiteReferenceFile(f);
                      }}
                    />
                    {gcSiteReferenceFile ? (
                      <button
                        type="button"
                        onClick={() => setGcSiteReferenceFile(null)}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-950/50"
                      >
                        Clear file
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void runGcAiReview()}
                    disabled={gcAiLoading}
                    className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {gcAiLoading ? "Analyzing…" : "Run AI review (OSHA + GC)"}
                  </button>
                </div>
                {gcAiError ? (
                  <InlineMessage tone="error">{gcAiError}</InlineMessage>
                ) : null}
                {gcAiExtraction ? (
                  <p className="text-xs text-slate-500">
                    Submission:{" "}
                    {gcAiExtraction.ok
                      ? `text extracted (${gcAiExtraction.method}${gcAiExtraction.truncated ? ", truncated" : ""})${gcAiExtraction.annotations.length ? ` with ${gcAiExtraction.annotations.length} embedded note${gcAiExtraction.annotations.length === 1 ? "" : "s"}` : ""}.`
                      : `extraction ${gcAiExtraction.error ?? "failed"} — review may be limited.`}
                  </p>
                ) : null}
                {gcAiSiteExtraction ? (
                  <p className="text-xs text-slate-500">
                    Site reference ({gcAiSiteExtraction.fileName}): text extracted (
                    {gcAiSiteExtraction.method}
                    {gcAiSiteExtraction.truncated ? ", truncated" : ""}).
                  </p>
                ) : null}
                {gcAiDisclaimer ? (
                  <p className="text-xs text-slate-500">{gcAiDisclaimer}</p>
                ) : null}
                {gcAiExtraction?.ok ? (
                  <EmbeddedReviewNotes annotations={gcAiExtraction.annotations} />
                ) : null}
                {gcAiResult ? (
                  <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-violet-900">
                        Overall
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">
                        {gcAiResult.overallAssessment === "sufficient"
                          ? "Appears broadly sufficient (verify in field)"
                          : gcAiResult.overallAssessment === "needs_work"
                            ? "Needs follow-up / strengthening"
                            : "Insufficient context or unreadable text"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Summary
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">
                        {gcAiResult.executiveSummary}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        GC / site alignment
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">
                        {gcAiResult.alignmentWithGcSiteRequirements}
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReviewList
                        title="OSHA-related strengths"
                        items={gcAiResult.oshaRelatedStrengths}
                      />
                      <ReviewList
                        title="Gaps / risks (OSHA-oriented)"
                        items={gcAiResult.oshaRelatedGapsOrRisks}
                      />
                    </div>
                    <ReviewList
                      title="Recommended follow-ups"
                      items={gcAiResult.recommendedFollowUps}
                    />
                    <ReviewList
                      title="Document quality issues"
                      items={gcAiResult.documentQualityIssues ?? []}
                    />
                    <ReviewList
                      title="Note coverage"
                      items={gcAiResult.noteCoverage ?? []}
                    />
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {gcPendingApproval ? (
            <SectionCard
              title="GC program document"
              description="Approve to release this file to the company workspace, or reject to delete the submission and storage copy."
            >
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  {documentItem.file_name ? (
                    <>
                      Uploaded file:{" "}
                      <span className="font-semibold text-slate-100">{documentItem.file_name}</span>
                    </>
                  ) : (
                    "A file is attached to this record."
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void runGcReview("approve")}
                    disabled={
                      Boolean(gcReviewLoading) ||
                      !canActOnGcProgram ||
                      !canApproveDocuments
                    }
                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {gcReviewLoading === "approve"
                      ? "Approving…"
                      : canActOnGcProgram
                        ? "Approve for workspace"
                        : "Approval restricted"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runGcReview("reject")}
                    disabled={
                      Boolean(gcReviewLoading) ||
                      !canActOnGcProgram ||
                      !canApproveDocuments
                    }
                    className="rounded-xl border border-red-300 bg-red-950/40 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {gcReviewLoading === "reject" ? "Rejecting…" : "Reject and remove"}
                  </button>
                </div>
                {!canActOnGcProgram ? (
                  <p className="text-xs text-slate-500">
                    Only platform administrators and internal reviewers can approve or reject GC program
                    uploads.
                  </p>
                ) : null}
              </div>
            </SectionCard>
          ) : !isGcProgramDoc ? (
            <SectionCard
              title="Approval Workspace"
              description="Upload the final DOCX, confirm reviewer details, and send the approved version back into the workspace."
            >
              <div className="space-y-5">
                {canManageOwnerPreview ? (
                  <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-violet-100">
                          Owner preview for submitted {builderProgramType}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">{ownerPreviewHelperText}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void generateMarketplacePreviewPdf();
                        }}
                        disabled={generatingPreview || uploadingPreview || !canApproveDocuments}
                        className="rounded-xl border border-violet-500/40 bg-violet-950/40 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-950/70 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingPreview ? "Generating..." : ownerPreviewActionLabel}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      {submitterPreviewStatus === "pending"
                        ? "Current status: pending owner approval."
                        : submitterPreviewStatus === "approved"
                          ? "Current status: approved by the document owner."
                          : submitterPreviewStatus === "rejected"
                            ? "Current status: rejected by the document owner."
                            : "Current status: no owner approval request has been sent yet."}
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">
                      Final DOCX
                    </label>
                    <input
                      type="file"
                      accept=".docx"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                      className="block w-full rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-sky-700"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {file ? `Selected: ${file.name}` : "Upload the final approved DOCX file."}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">
                      Reviewer Email
                    </label>
                    <input
                      type="email"
                      value={reviewerEmail}
                      onChange={(event) => setReviewerEmail(event.target.value)}
                      placeholder="reviewer@company.com"
                      className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">
                    Review Notes
                  </label>
                  <textarea
                    rows={5}
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Summarize corrections, approvals, or handoff notes for the user."
                    className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
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
                      className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Approving..." : canApproveDocuments ? "Approve and Send Final" : "Approval Restricted"}
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Marketplace Settings"
            description="Control whether this approved document appears in the credit marketplace and what it costs to unlock."
          >
            <div className="space-y-5">
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-100">
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
                <label className="mb-2 block text-sm font-semibold text-slate-200">
                  Credit Cost
                </label>
                <input
                  type="number"
                  min={1}
                  value={creditCost}
                  onChange={(event) => setCreditCost(event.target.value)}
                  className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <p className="text-sm font-semibold text-slate-100">
                  Buyer preview (before credit unlock)
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Upload PDF or DOCX source material, or generate a watermarked PDF from the
                  draft or final file. Buyers see a short on-screen excerpt or inline PDF
                  preview (no full-document download). Text-based PDFs work best; scanned
                  pages may show little or no excerpt until purchase.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Listing
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {marketplaceEnabled ? "Visible in marketplace" : "Hidden from marketplace"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getDocumentCreditCost(documentItem.notes)} credits to unlock.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Preview file
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {marketplacePreviewPath
                        ? marketplacePreviewPath.split("/").pop()
                        : "Not attached yet"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Buyers see this file through an excerpt or preview, not the full download.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Page count
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {typeof marketplacePreviewPageCount === "number" &&
                      Number.isFinite(marketplacePreviewPageCount)
                        ? `${marketplacePreviewPageCount} pages`
                        : "Shown after generate/upload"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Enough context to judge length without giving away the full file.
                    </p>
                  </div>
                </div>
                {marketplacePreviewPath ? (
                  <p className="mt-3 text-xs font-medium text-emerald-400">
                    Preview on file:{" "}
                    {marketplacePreviewPath.split("/").pop()}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">No preview uploaded yet.</p>
                )}
                {documentItem ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Owner approval status:{" "}
                    {(() => {
                      const s = getSubmitterPreviewStatus(documentItem.notes);
                      if (s === "pending") return "Pending document owner approval";
                      if (s === "approved") return "Approved by document owner (or manual upload)";
                      if (s === "rejected") return "Rejected by document owner — replace preview";
                      return "Not required (legacy listing or manual upload without gate)";
                    })()}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-950/50">
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      onChange={(event) => {
                        const next = event.target.files?.[0] ?? null;
                        setMarketplacePreviewFile(next);
                        event.target.value = "";
                      }}
                    />
                    Choose file
                  </label>
                  {marketplacePreviewFile ? (
                    <span className="truncate text-sm text-slate-400">
                      {marketplacePreviewFile.name}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void generateMarketplacePreviewPdf();
                    }}
                    disabled={generatingPreview || uploadingPreview || !canApproveDocuments}
                    className="rounded-xl border border-violet-500/40 bg-violet-950/40 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-950/70 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generatingPreview ? "Generating..." : ownerPreviewActionLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void uploadMarketplacePreview();
                    }}
                    disabled={
                      uploadingPreview ||
                      generatingPreview ||
                      !canApproveDocuments ||
                      !marketplacePreviewFile
                    }
                    className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingPreview ? "Uploading..." : "Upload preview"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void removeMarketplacePreview();
                    }}
                    disabled={
                      savingMarketplace ||
                      uploadingPreview ||
                      generatingPreview ||
                      !canApproveDocuments ||
                      !marketplacePreviewPath
                    }
                    className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove preview
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveMarketplaceSettings}
                  disabled={savingMarketplace || !canApproveDocuments}
                  className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="flex gap-4 rounded-2xl border border-slate-700/80 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-300">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatRelative(event.time)} at {formatAbsolute(event.time)}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">{event.detail}</p>
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
                  className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lifecycleLoading === "restore" ? "Restoring..." : "Restore Document"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void runLifecycleAction("archive")}
                  disabled={Boolean(lifecycleLoading) || !canApproveDocuments}
                  className="rounded-xl border border-amber-300 bg-amber-950/40 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lifecycleLoading === "archive" ? "Archiving..." : "Archive Document"}
                </button>
              )}

              <button
                type="button"
                onClick={() => void runLifecycleAction("delete")}
                disabled={Boolean(lifecycleLoading) || !canApproveDocuments}
                className="rounded-xl border border-red-300 bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
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
              {isGcProgramDoc ? (
                <>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                    1. Open the company upload and verify it matches what the GC requires.
                  </div>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                    2. Approve to release it to the company workspace, or reject to remove it.
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                    1. Open the draft DOCX and complete edits in Word.
                  </div>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                    2. Capture reviewer email and approval notes before sending.
                  </div>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                    3. Upload the final DOCX and approve the document.
                  </div>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 text-sm text-slate-400">
                    4. Decide whether the completed file should appear in the marketplace.
                  </div>
                </>
              )}
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
                  ? isGcProgramDoc
                    ? "This GC program file is approved and visible in the company workspace."
                    : "A final file is attached to this record and the document can be opened from the user library."
                  : isArchivedStatus(documentItem.status)
                    ? "This document is archived and hidden from active workspace views until restored."
                    : isGcProgramDoc
                      ? "This GC upload is waiting for approve or reject."
                      : "This record is still waiting for final approval and delivery."}
              </InlineMessage>
            </div>
          </SectionCard>
        </div>
      </div>

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
