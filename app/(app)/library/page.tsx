"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DownloadConfirmModal } from "@/components/DownloadConfirmModal";
import { getDocumentCreditCost, isMarketplaceEnabled } from "@/lib/marketplace";
import type { CreditTransaction } from "@/lib/credits";

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

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

export default function LibraryPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
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

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading documents: ${error.message}`);
      setLoading(false);
      return;
    }

    setDocuments(data ?? []);
    setLoading(false);
  }, []);

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
          ? data!.purchasedDocumentIds!.filter(
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
            ? data!.purchasedDocumentIds!.filter(
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

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (isArchivedStatus(doc.status)) {
        return false;
      }

      const query = searchTerm.toLowerCase();
      const title = doc.document_title ?? doc.project_name ?? doc.file_name ?? "Untitled Document";
      const projectName = doc.project_name ?? "";
      const fileName = doc.file_name ?? "";
      const category = doc.category ?? "";

      const matchesSearch =
        title.toLowerCase().includes(query) ||
        projectName.toLowerCase().includes(query) ||
        fileName.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "All Categories"
          ? true
          : doc.category === categoryFilter;

      const matchesType =
        typeFilter === "All Types" ? true : doc.document_type === typeFilter;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [documents, searchTerm, categoryFilter, typeFilter]);

  const approvedDocuments = useMemo(() => {
    return filteredDocuments.filter(
      (doc) =>
        doc.status?.trim().toLowerCase() === "approved" ||
        Boolean(doc.final_file_path)
    );
  }, [filteredDocuments]);

  const otherDocuments = useMemo(() => {
    return filteredDocuments.filter(
      (doc) =>
        doc.status?.trim().toLowerCase() !== "approved" &&
        !doc.final_file_path
    );
  }, [filteredDocuments]);

  const accessibleApprovedDocuments = useMemo(() => {
    return approvedDocuments.filter(
      (doc) =>
        doc.user_id === currentUserId ||
        creditState.purchasedDocumentIds.includes(doc.id)
    );
  }, [approvedDocuments, creditState.purchasedDocumentIds, currentUserId]);

  const marketplaceDocuments = useMemo(() => {
    return approvedDocuments.filter(
      (doc) =>
        isMarketplaceEnabled(doc.notes) &&
        doc.user_id !== currentUserId &&
        !creditState.purchasedDocumentIds.includes(doc.id)
    );
  }, [approvedDocuments, creditState.purchasedDocumentIds, currentUserId]);

  const stats = useMemo(() => {
    const activeDocuments = documents.filter((doc) => !isArchivedStatus(doc.status));

    return {
      total: activeDocuments.length,
      templates: activeDocuments.filter((d) => d.document_type === "Template").length,
      forms: activeDocuments.filter((d) => d.document_type === "Form").length,
      reports: activeDocuments.filter((d) => d.document_type === "Report").length,
    };
  }, [documents]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Document Center
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Library
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Browse and open all uploaded documents from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Upload Document
            </Link>
            <Link
              href="/search"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Search Records
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Credits"
          value={String(creditState.creditBalance)}
          note="Available to unlock completed docs"
        />
        <StatCard
          title="Unlocked Docs"
          value={String(accessibleApprovedDocuments.length)}
          note="Purchased or owned completed documents"
        />
        <StatCard
          title="Marketplace"
          value={String(marketplaceDocuments.length)}
          note="Completed docs available to buy"
        />
        <StatCard
          title="Subscription"
          value={creditState.subscriptionStatus}
          note="Used for default starting credits"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Credit Ledger</h2>
            <p className="mt-1 text-sm text-slate-500">
              {creditState.ledgerEnabled
                ? "Recent credit transactions for your account."
                : "Ledger migration not detected yet. Using fallback credit storage."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Balance: {creditState.creditBalance}
          </div>
        </div>

        {creditState.transactions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No credit transactions yet.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {creditState.transactions.slice(0, 6).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {tx.description || tx.transaction_type}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(tx.created_at).toLocaleString()}
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
                  {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} credits
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={String(stats.total)}
          note="All uploaded records"
        />
        <StatCard
          title="Templates"
          value={String(stats.templates)}
          note="Template documents"
        />
        <StatCard
          title="Forms"
          value={String(stats.forms)}
          note="Form documents"
        />
        <StatCard
          title="Reports"
          value={String(stats.reports)}
          note="Report documents"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Search Library
              </label>
              <input
                type="text"
                placeholder="Search title, project, file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Document Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                {types.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setSearchTerm("");
              setCategoryFilter("All Categories");
              setTypeFilter("All Types");
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}
      </section>

      <DocumentSection
        title="Unlocked Completed Documents"
        description={`${accessibleApprovedDocuments.length} completed document${accessibleApprovedDocuments.length === 1 ? "" : "s"} ready to open`}
        documents={accessibleApprovedDocuments}
        loading={loading}
        onOpen={(doc) => setPendingDownload({ mode: "completed", documentId: doc.id })}
        emptyTitle="No unlocked completed documents yet"
        emptyMessage="Completed documents you own or purchase with credits will appear here."
      />

      <MarketplaceSection
        documents={marketplaceDocuments}
        loading={loading}
        creditBalance={creditState.creditBalance}
        actionLoadingId={actionLoadingId}
        onPurchase={handlePurchaseDocument}
      />

      <DocumentSection
        title="Documents"
        description={`${otherDocuments.length} document${otherDocuments.length === 1 ? "" : "s"} found`}
        documents={otherDocuments}
        loading={loading}
        onOpen={(doc) =>
          handleOpenFile(doc.file_path ?? doc.draft_file_path ?? doc.final_file_path)
        }
        emptyTitle="No documents found"
        emptyMessage="Try adjusting your filters or upload a new file."
      />

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
}: {
  title: string;
  description: string;
  documents: DocumentRow[];
  loading: boolean;
  onOpen: (document: DocumentRow) => void;
  emptyTitle: string;
  emptyMessage: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading library...</p>
      ) : documents.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">{emptyTitle}</p>
          <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Title
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Project
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Category
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  File
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Open
                </th>
              </tr>
            </thead>

            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="rounded-l-2xl border-y border-l border-slate-200 bg-slate-50 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {doc.document_title ?? doc.project_name ?? doc.file_name ?? "Untitled Document"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Uploaded by {doc.uploaded_by ?? "Unknown"}
                      </p>
                    </div>
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    {doc.project_name || "General"}
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    {doc.document_type || "-"}
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    {doc.category || "-"}
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    {doc.file_name ?? "-"}
                  </td>

                  <td className="rounded-r-2xl border-y border-r border-slate-200 bg-slate-50 px-4 py-4 text-right">
                    <button
                      onClick={() => onOpen(doc)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Completed Document Marketplace
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Spend credits to unlock completed documents from the library.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Balance: {creditBalance} credits
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading marketplace...</p>
      ) : documents.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No marketplace documents available
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Approved completed documents available for credits will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => {
            const cost = getDocumentCreditCost(doc.notes);
            const canAfford = creditBalance >= cost;

            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {doc.project_name ?? doc.file_name ?? "Completed Document"}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {doc.document_type || "Document"}
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {cost} credits
                  </span>
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  Unlock this completed document and add it to your approved library.
                </p>

                <button
                  onClick={() => onPurchase(doc.id)}
                  disabled={actionLoadingId === doc.id || !canAfford}
                  className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {actionLoadingId === doc.id
                    ? "Unlocking..."
                    : canAfford
                      ? "Unlock Document"
                      : "Not Enough Credits"}
                </button>
              </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}
