"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DownloadConfirmModal } from "@/components/DownloadConfirmModal";
import {
  ActivityFeed,
  InlineMessage,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import { getDocumentCreditCost, isMarketplaceEnabled } from "@/lib/marketplace";
import type { CreditTransaction } from "@/lib/credits";
import {
  getDocumentStatusLabel,
  getDocumentStatusTone,
  isApprovedDocumentStatus,
  isArchivedDocumentStatus,
} from "@/lib/documentStatus";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  status?: string | null;
  project_name: string | null;
  document_title: string | null;
  document_type: string | null;
  category: string | null;
  notes: string | null;
  file_name: string | null;
  file_path: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
  file_size: number | null;
  uploaded_by: string | null;
};

type CreditState = {
  creditBalance: number;
  purchasedDocumentIds: string[];
  subscriptionStatus: string;
  transactions: CreditTransaction[];
  ledgerEnabled: boolean;
};

type PendingDownload =
  | { mode: "direct"; path: string }
  | { mode: "completed"; documentId: string };

function getDocumentTitle(doc: DocumentRow) {
  return doc.document_title ?? doc.project_name ?? doc.file_name ?? "Untitled Document";
}

function getDocumentSubtitle(doc: DocumentRow) {
  return doc.project_name || doc.file_name || "General workspace document";
}

function getDocumentStatus(doc: DocumentRow) {
  return getDocumentStatusLabel(doc.status, Boolean(doc.final_file_path));
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCompactDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "Size unavailable";

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusTone(status: string) {
  return getDocumentStatusTone(status);
}

function getSubscriptionTone(status: string) {
  return status.trim().toLowerCase() === "active"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-200 text-slate-700";
}

export default function LibraryPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState("");
  const [viewerRole, setViewerRole] = useState("viewer");
  const [creditState, setCreditState] = useState<CreditState>({
    creditBalance: 0,
    purchasedDocumentIds: [],
    subscriptionStatus: "inactive",
    transactions: [],
    ledgerEnabled: false,
  });
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

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

  const loadDocuments = useCallback(async (targetPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setMessage("");
    }

    try {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/workspace/documents?page=${targetPage}&pageSize=25`,
        {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            documents?: DocumentRow[];
            viewerRole?: string;
            pagination?: { page?: number; hasMore?: boolean };
          }
        | null;

      if (!response.ok) {
        setMessage(data?.error || "Error loading documents.");
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const nextDocuments = data?.documents ?? [];
      setDocuments((current) => (append ? [...current, ...nextDocuments] : nextDocuments));
      setViewerRole(data?.viewerRole ?? "viewer");
      setPage(Number(data?.pagination?.page ?? targetPage));
      setHasMore(Boolean(data?.pagination?.hasMore));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error loading documents.");
    }

    setLoading(false);
    setLoadingMore(false);
  }, [getAccessToken]);

  const loadCredits = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? "");

      const res = await fetch("/api/library/credits", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | Partial<CreditState> & { error?: string }
        | null;

      if (!res.ok) {
        setMessage(data?.error || "Failed to load credit balance.");
        return;
      }

      setCreditState({
        creditBalance: Number(data?.creditBalance ?? 0),
        purchasedDocumentIds: Array.isArray(data?.purchasedDocumentIds)
          ? data.purchasedDocumentIds.filter(
              (value): value is string => typeof value === "string"
            )
          : [],
        subscriptionStatus: String(data?.subscriptionStatus ?? "inactive"),
        transactions: Array.isArray(data?.transactions)
          ? data.transactions.filter(
              (value): value is CreditTransaction =>
                Boolean(value) &&
                typeof value === "object" &&
                typeof (value as CreditTransaction).id === "string"
            )
          : [],
        ledgerEnabled: Boolean(data?.ledgerEnabled),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load credits.");
    }
  }, [getAccessToken]);

  async function handleOpenFile(path?: string | null) {
    setMessage("");

    if (!path) {
      setMessage("Open file failed: missing file path.");
      return;
    }

    setPendingDownload({ mode: "direct", path });
  }

  const handleOpenCompletedDocument = useCallback(
    async (documentId: string, confirmed = false) => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/library/access/${documentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-download-confirmed": confirmed ? "true" : "false",
          },
        });

        const data = (await res.json().catch(() => null)) as
          | { error?: string; signedUrl?: string }
          | null;

        if (!res.ok || !data?.signedUrl) {
          setMessage(data?.error || "Failed to open completed document.");
          return;
        }

        window.open(data.signedUrl, "_blank");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to open document.");
      }
    },
    [getAccessToken]
  );

  const confirmPendingDownload = useCallback(async () => {
    if (!pendingDownload) {
      return;
    }

    setDownloadLoading(true);
    setMessage("");

    try {
      if (pendingDownload.mode === "direct") {
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(pendingDownload.path, 60);

        if (error || !data?.signedUrl) {
          throw new Error(error?.message || "Failed to create file access URL.");
        }

        window.open(data.signedUrl, "_blank");
      } else {
        await handleOpenCompletedDocument(pendingDownload.documentId, true);
      }

      setPendingDownload(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to open document.");
    } finally {
      setDownloadLoading(false);
    }
  }, [handleOpenCompletedDocument, pendingDownload]);

  const handlePurchaseDocument = useCallback(
    async (documentId: string) => {
      setActionLoadingId(documentId);
      setMessage("");

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/library/purchase", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ documentId }),
        });

        const data = (await res.json().catch(() => null)) as
          | {
              error?: string;
              creditBalance?: number;
              purchasedDocumentIds?: string[];
            }
          | null;

        if (!res.ok) {
          setMessage(data?.error || "Purchase failed.");
          setActionLoadingId("");
          return;
        }

        setCreditState((prev) => ({
          ...prev,
          creditBalance: Number(data?.creditBalance ?? prev.creditBalance),
          purchasedDocumentIds: Array.isArray(data?.purchasedDocumentIds)
            ? data.purchasedDocumentIds.filter(
                (value): value is string => typeof value === "string"
              )
            : prev.purchasedDocumentIds,
        }));
        setMessage("Document unlocked successfully.");
        await loadCredits();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Purchase failed.");
      }

      setActionLoadingId("");
    },
    [getAccessToken, loadCredits]
  );

  useEffect(() => {
    void (async () => {
      await loadDocuments();
      await loadCredits();
    })();
  }, [loadCredits, loadDocuments]);

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(documents.map((doc) => doc.category).filter(Boolean))
    ) as string[];

    return ["All Categories", ...values.sort()];
  }, [documents]);

  const types = useMemo(() => {
    const values = Array.from(
      new Set(documents.map((doc) => doc.document_type).filter(Boolean))
    ) as string[];

    return ["All Types", ...values.sort()];
  }, [documents]);

  const isManagerView =
    viewerRole === "company_admin" ||
    viewerRole === "manager" ||
    viewerRole === "company_user";
  const companyPrimaryAction =
    viewerRole === "company_admin"
      ? { href: "/company-users", label: "Manage Company Users" }
      : { href: "/submit", label: "Submit document" };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (!isManagerView && isArchivedDocumentStatus(doc.status)) {
        return false;
      }

      const query = searchTerm.toLowerCase();
      const title = getDocumentTitle(doc);
      const projectName = doc.project_name ?? "";
      const fileName = doc.file_name ?? "";
      const category = doc.category ?? "";

      const matchesSearch =
        title.toLowerCase().includes(query) ||
        projectName.toLowerCase().includes(query) ||
        fileName.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "All Categories" ? true : doc.category === categoryFilter;

      const matchesType =
        typeFilter === "All Types" ? true : doc.document_type === typeFilter;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [documents, searchTerm, categoryFilter, typeFilter, isManagerView]);

  const approvedDocuments = useMemo(() => {
    return filteredDocuments.filter(
      (doc) =>
        isApprovedDocumentStatus(doc.status, Boolean(doc.final_file_path))
    );
  }, [filteredDocuments]);

  const otherDocuments = useMemo(() => {
    return filteredDocuments.filter(
      (doc) => !isApprovedDocumentStatus(doc.status, Boolean(doc.final_file_path))
    );
  }, [filteredDocuments]);

  const accessibleApprovedDocuments = useMemo(() => {
    if (isManagerView) {
      return approvedDocuments;
    }

    return approvedDocuments.filter(
      (doc) =>
        doc.user_id === currentUserId ||
        creditState.purchasedDocumentIds.includes(doc.id)
    );
  }, [approvedDocuments, creditState.purchasedDocumentIds, currentUserId, isManagerView]);

  const marketplaceDocuments = useMemo(() => {
    if (isManagerView) {
      return [];
    }

    return approvedDocuments.filter(
      (doc) =>
        isMarketplaceEnabled(doc.notes) &&
        doc.user_id !== currentUserId &&
        !creditState.purchasedDocumentIds.includes(doc.id)
    );
  }, [approvedDocuments, creditState.purchasedDocumentIds, currentUserId, isManagerView]);

  const stats = useMemo(() => {
    const activeDocuments = documents.filter((doc) => !isArchivedDocumentStatus(doc.status));

    return {
      total: activeDocuments.length,
      templates: activeDocuments.filter((d) => d.document_type === "Template").length,
      forms: activeDocuments.filter((d) => d.document_type === "Form").length,
      reports: activeDocuments.filter((d) => d.document_type === "Report").length,
    };
  }, [documents]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count += 1;
    if (categoryFilter !== "All Categories") count += 1;
    if (typeFilter !== "All Types") count += 1;
    return count;
  }, [searchTerm, categoryFilter, typeFilter]);

  const summaryCards = isManagerView
    ? [
        {
          title: "Completed documents",
          value: String(accessibleApprovedDocuments.length),
      note: "Completed files available to this company account",
        },
        {
          title: "Company credits",
          value: String(creditState.creditBalance),
          note: "Available for completed document unlocks",
        },
        {
          title: "Templates",
          value: String(stats.templates),
          note: "Completed template records in this library view",
        },
        {
          title: "Reports",
          value: String(stats.reports),
          note: "Completed report documents ready to open",
        },
      ]
    : [
        {
          title: "Ready to open",
          value: String(accessibleApprovedDocuments.length),
          note: "Completed documents you already own or unlocked",
        },
        {
          title: "Marketplace options",
          value: String(marketplaceDocuments.length),
          note: "Completed documents you can unlock with credits",
        },
        {
          title: "Active documents",
          value: String(stats.total),
          note: "Archived records are hidden from this view",
        },
        {
          title: "Credits available",
          value: String(creditState.creditBalance),
          note: "Available for marketplace unlocks",
        },
      ];

  const transactionPreview = creditState.transactions.slice(0, 4);
  const recentDocumentItems = filteredDocuments.slice(0, 4).map((doc) => ({
    id: doc.id,
    title: getDocumentTitle(doc),
    detail: `${getDocumentStatus(doc)} file in ${doc.category || "General"} for ${doc.project_name || "your workspace"}.`,
    meta: formatCompactDate(doc.created_at),
    tone: isApprovedDocumentStatus(doc.status, Boolean(doc.final_file_path))
      ? ("success" as const)
      : ("info" as const),
  }));
  const workflowSteps = isManagerView
    ? [
        {
          label: "Completed docs only",
      detail: "Company accounts are limited to the completed-document side of the workflow.",
          complete: true,
        },
        {
          label: "Library access",
          detail: "Open approved files directly from the completed library.",
          active: accessibleApprovedDocuments.length > 0,
          complete: accessibleApprovedDocuments.length > 0,
        },
        {
          label: "Company users",
          detail: "Invite and manage only users assigned to your company.",
          complete: true,
        },
      ]
    : [
        {
          label: "Upload and submit",
          detail: "Source files are uploaded first and then sent into the review workflow.",
          complete: stats.total > 0,
        },
        {
          label: "Admin review",
          detail: "Submitted documents stay in review until the final version is approved.",
          active: otherDocuments.length > 0,
          complete: accessibleApprovedDocuments.length > 0 || marketplaceDocuments.length > 0,
        },
        {
          label: "Approved files",
          detail: "Completed records become ready to open or available for marketplace unlock.",
          active: accessibleApprovedDocuments.length > 0,
          complete: accessibleApprovedDocuments.length > 0,
        },
        {
          label: "Library access",
          detail: "Open completed documents directly from your ready list after approval or purchase.",
          active: accessibleApprovedDocuments.length > 0,
          complete: false,
        },
      ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_360px]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_45%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              {isManagerView ? "Completed Document Center" : "Document Center"}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
              {isManagerView ? "Open completed company documents" : "Find what you need faster"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              {isManagerView
                ? "Company accounts stay focused on completed files only, with no draft or in-review records mixed into the workspace."
                : "Open completed documents, browse in-progress files, and use credits without digging through separate tools."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={isManagerView ? companyPrimaryAction.href : "/upload"}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                {isManagerView ? companyPrimaryAction.label : "Upload a document"}
              </Link>
              <Link
                href={isManagerView ? "/dashboard" : "/search"}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {isManagerView ? "Back to dashboard" : "Search all records"}
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {card.title}
                  </p>
                  <p className="mt-3 text-3xl font-black text-slate-950">{card.value}</p>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{card.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-950 p-8 text-white lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
                  Credits & Access
                </p>
                <h2 className="mt-3 text-2xl font-black">Account snapshot</h2>
              </div>
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                  getSubscriptionTone(creditState.subscriptionStatus),
                ].join(" ")}
              >
                {creditState.subscriptionStatus}
              </span>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">Current balance</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-5xl font-black text-white">
                  {creditState.creditBalance}
                </span>
                <span className="pb-1 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">
                  credits
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {isManagerView
                  ? "Completed files that are already available to this company account will appear in the ready list below."
                  : "Use credits to unlock completed marketplace documents and move them straight into your ready-to-open list."}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MiniInfoCard
                label="Unlocked docs"
                value={String(accessibleApprovedDocuments.length)}
                note="Available now"
              />
              <MiniInfoCard
                label="Marketplace docs"
                value={String(marketplaceDocuments.length)}
                note="Can be unlocked"
              />
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Recent activity
                </h3>
                <span className="text-xs text-slate-400">
                  {creditState.ledgerEnabled ? "Live ledger" : "Fallback credit data"}
                </span>
              </div>

              {transactionPreview.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-slate-300">
                  No credit activity yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {transactionPreview.map((tx) => (
                    <div
                      key={tx.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {tx.description || tx.transaction_type}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatTimestamp(tx.created_at)}
                          </p>
                        </div>
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            tx.amount >= 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700",
                          ].join(" ")}
                        >
                          {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Search library
              </label>
              <input
                type="text"
                placeholder="Search title, project, file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Document type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                {types.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <div className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {filteredDocuments.length}
              </span>{" "}
              matching document{filteredDocuments.length === 1 ? "" : "s"}
              {activeFilterCount > 0
                ? ` across ${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                : ""}
            </div>

            <button
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("All Categories");
                setTypeFilter("All Types");
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        {activeFilterCount > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchTerm.trim() ? <FilterChip label={`Search: ${searchTerm.trim()}`} /> : null}
            {categoryFilter !== "All Categories" ? (
              <FilterChip label={`Category: ${categoryFilter}`} />
            ) : null}
            {typeFilter !== "All Types" ? (
              <FilterChip label={`Type: ${typeFilter}`} />
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Tip: use search and filters together to narrow down large libraries fast.
          </p>
        )}

        {message ? (
          <div className="mt-4">
            <InlineMessage tone="warning">{message}</InlineMessage>
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Templates"
          value={String(stats.templates)}
          note="Reusable template documents"
        />
        <StatCard
          title="Forms"
          value={String(stats.forms)}
          note="Operational form records"
        />
        <StatCard
          title="Reports"
          value={String(stats.reports)}
          note="Completed report documents"
        />
        <StatCard
          title="Subscription"
          value={creditState.subscriptionStatus}
          note="Default credits can be tied to account status"
        />
      </section>

      <WorkflowPath
        title={isManagerView ? "Company Access Workflow" : "Upload to Library Workflow"}
        description={
          isManagerView
            ? "This role stays on the completed-document side of the platform and does not handle draft or review-stage files."
            : "The library is the end of the document journey. Files appear here after upload, submission, admin review, and final approval."
        }
        steps={workflowSteps}
      />

      {recentDocumentItems.length > 0 ? (
        <ActivityFeed
          title="Recent Document History"
          description="Latest document changes and approvals now visible from the library."
          items={recentDocumentItems}
        />
      ) : null}

      <DocumentSection
        title="Ready to open"
        description="Completed documents you already have access to."
        loading={loading}
        documents={accessibleApprovedDocuments}
        emptyTitle="No ready documents yet"
        emptyMessage="Completed documents you own or unlock with credits will show up here first."
        onOpen={(doc) => setPendingDownload({ mode: "completed", documentId: doc.id })}
        actionLabel="Open document"
      />

      {!loading && hasMore ? (
        <div className="flex justify-center">
          <button
            onClick={() => void loadDocuments(page + 1, true)}
            disabled={loadingMore}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load more documents"}
          </button>
        </div>
      ) : null}

      {!isManagerView ? (
        <MarketplaceSection
          documents={marketplaceDocuments}
          loading={loading}
          creditBalance={creditState.creditBalance}
          actionLoadingId={actionLoadingId}
          onPurchase={handlePurchaseDocument}
        />
      ) : null}

      {!isManagerView ? (
        <DocumentSection
          title="All active documents"
          description="Uploaded records that are still in progress or waiting on completion."
          loading={loading}
          documents={otherDocuments}
          emptyTitle="No documents found"
          emptyMessage="Try adjusting your filters or upload a new file."
          onOpen={(doc) =>
            handleOpenFile(doc.file_path ?? doc.draft_file_path ?? doc.final_file_path)
          }
          actionLabel="Preview file"
        />
      ) : null}

      <DownloadConfirmModal
        open={Boolean(pendingDownload)}
        loading={downloadLoading}
        onCancel={() => {
          setPendingDownload(null);
          setDownloadLoading(false);
        }}
        onConfirm={() => {
          void confirmPendingDownload();
        }}
      />
    </div>
  );
}

function DocumentSection({
  title,
  description,
  documents,
  loading,
  onOpen,
  emptyTitle,
  emptyMessage,
  actionLabel,
}: {
  title: string;
  description: string;
  documents: DocumentRow[];
  loading: boolean;
  onOpen: (document: DocumentRow) => void;
  emptyTitle: string;
  emptyMessage: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {documents.length} item{documents.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-base font-semibold text-slate-900">{emptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              actionLabel={actionLabel}
              onOpen={() => onOpen(doc)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DocumentCard({
  document,
  actionLabel,
  onOpen,
}: {
  document: DocumentRow;
  actionLabel: string;
  onOpen: () => void;
}) {
  const status = getDocumentStatus(document);

  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold leading-6 text-slate-950">
            {getDocumentTitle(document)}
          </p>
          <p className="mt-2 text-sm text-slate-500">{getDocumentSubtitle(document)}</p>
        </div>
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold",
            getStatusTone(status),
          ].join(" ")}
        >
          {status}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <InfoPair label="Type" value={document.document_type || "Not set"} />
        <InfoPair label="Category" value={document.category || "Unassigned"} />
        <InfoPair label="Uploaded by" value={document.uploaded_by || "Unknown"} />
        <InfoPair label="Created" value={formatCompactDate(document.created_at)} />
      </dl>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          File details
        </p>
        <p className="mt-2 truncate text-sm font-medium text-slate-800">
          {document.file_name || "No file name available"}
        </p>
        <p className="mt-1 text-sm text-slate-500">{formatFileSize(document.file_size)}</p>
      </div>

      <button
        onClick={onOpen}
        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {actionLabel}
      </button>
    </article>
  );
}

function MarketplaceSection({
  documents,
  loading,
  creditBalance,
  actionLoadingId,
  onPurchase,
}: {
  documents: DocumentRow[];
  loading: boolean;
  creditBalance: number;
  actionLoadingId: string;
  onPurchase: (documentId: string) => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Marketplace unlocks
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use credits to unlock completed documents and move them into your ready
            list.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Balance: {creditBalance} credits
        </div>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-base font-semibold text-slate-900">
            No marketplace documents available
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            When completed documents are listed for credits, they will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {documents.map((doc) => {
            const cost = getDocumentCreditCost(doc.notes);
            const canAfford = creditBalance >= cost;

            return (
              <article
                key={doc.id}
                className="flex h-full flex-col rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold leading-6 text-slate-950">
                      {getDocumentTitle(doc)}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {doc.document_type || "Completed document"}
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {cost} credits
                  </span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <InfoPair label="Project" value={doc.project_name || "General"} />
                  <InfoPair label="Category" value={doc.category || "Unassigned"} />
                  <InfoPair label="Uploaded by" value={doc.uploaded_by || "Unknown"} />
                  <InfoPair label="Created" value={formatCompactDate(doc.created_at)} />
                </dl>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <p className="text-sm text-slate-600">
                    Unlock this completed file and add it to your ready-to-open
                    library.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {canAfford
                      ? "You have enough credits for this unlock."
                      : `You need ${cost - creditBalance} more credit${cost - creditBalance === 1 ? "" : "s"}.`}
                  </p>
                </div>

                <button
                  onClick={() => onPurchase(doc.id)}
                  disabled={actionLoadingId === doc.id || !canAfford}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {actionLoadingId === doc.id
                    ? "Unlocking..."
                    : canAfford
                      ? "Unlock document"
                      : "Not enough credits"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{note}</p>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
      {label}
    </span>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function MiniInfoCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{note}</p>
    </div>
  );
}
