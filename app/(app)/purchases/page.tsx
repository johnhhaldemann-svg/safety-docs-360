"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DownloadConfirmModal } from "@/components/DownloadConfirmModal";
import type { CreditTransaction } from "@/lib/credits";
import { getDocumentCreditCost } from "@/lib/marketplace";
import type { PermissionMap } from "@/lib/rbac";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
} from "@/components/WorkspacePrimitives";

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
  notes: string | null;
  file_name: string | null;
  final_file_path?: string | null;
};

type CreditState = {
  creditBalance: number;
  purchasedDocumentIds: string[];
  subscriptionStatus: string;
  transactions: CreditTransaction[];
  ledgerEnabled: boolean;
  billingScope?: "user" | "company";
  companyId?: string | null;
  companyName?: string | null;
};

type TestCreditPack = {
  id: "starter" | "pro" | "max";
  label: string;
  credits: number;
  note: string;
};

const TEST_CREDIT_PACKS: TestCreditPack[] = [
  {
    id: "starter",
    label: "Starter Pack",
    credits: 10,
    note: "Quick top-up for marketplace testing.",
  },
  {
    id: "pro",
    label: "Pro Pack",
    credits: 25,
    note: "Enough credits to unlock several completed docs.",
  },
  {
    id: "max",
    label: "Max Pack",
    credits: 50,
    note: "Best option for heavier test purchases.",
  },
];

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

function formatDocumentTitle(doc: DocumentRow) {
  return doc.document_title ?? doc.project_name ?? doc.file_name ?? "Untitled Document";
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

export default function PurchasesPage() {
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [creditPackLoadingId, setCreditPackLoadingId] = useState("");
  const [pendingDocumentId, setPendingDocumentId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [creditState, setCreditState] = useState<CreditState>({
    creditBalance: 0,
    purchasedDocumentIds: [],
    subscriptionStatus: "inactive",
    transactions: [],
    ledgerEnabled: false,
    billingScope: "user",
    companyId: null,
    companyName: null,
  });

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const [
        {
          data: { user },
        },
        meResponse,
        documentsResult,
        creditsResponse,
      ] = await Promise.all([
        supabase.auth.getUser(),
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        supabase
          .from("documents")
          .select(
            "id,created_at,user_id,company_id,status,project_name,document_title,document_type,category,notes,file_name,file_path,draft_file_path,final_file_path,file_size,uploaded_by"
          )
          .order("created_at", { ascending: false })
          .range(0, 199),
        fetch("/api/library/credits", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      setCurrentUserId(user?.id ?? "");
      const meData = (await meResponse.json().catch(() => null)) as
        | { user?: { permissionMap?: PermissionMap } }
        | null;

      if (meResponse.ok) {
        setPermissionMap(meData?.user?.permissionMap ?? null);
      }

      if (documentsResult.error) {
        throw new Error(documentsResult.error.message);
      }

      const creditData = (await creditsResponse.json().catch(() => null)) as
        | (Partial<CreditState> & { error?: string })
        | null;

      if (!creditsResponse.ok) {
        throw new Error(creditData?.error || "Failed to load purchases.");
      }

      setDocuments((documentsResult.data ?? []) as DocumentRow[]);
      setCreditState({
        creditBalance: Number(creditData?.creditBalance ?? 0),
        purchasedDocumentIds: Array.isArray(creditData?.purchasedDocumentIds)
          ? creditData.purchasedDocumentIds.filter(
              (value): value is string => typeof value === "string"
            )
          : [],
        subscriptionStatus: String(creditData?.subscriptionStatus ?? "inactive"),
        transactions: Array.isArray(creditData?.transactions)
          ? creditData.transactions.filter(
              (value): value is CreditTransaction =>
                Boolean(value) &&
                typeof value === "object" &&
                typeof (value as CreditTransaction).id === "string"
            )
          : [],
        ledgerEnabled: Boolean(creditData?.ledgerEnabled),
        billingScope:
          creditData?.billingScope === "company" ? "company" : "user",
        companyId:
          typeof creditData?.companyId === "string" ? creditData.companyId : null,
        companyName:
          typeof creditData?.companyName === "string" ? creditData.companyName : null,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load purchases.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const completedDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        !isArchivedStatus(doc.status) &&
        (doc.status?.trim().toLowerCase() === "approved" || Boolean(doc.final_file_path))
    );
  }, [documents]);

  const ownedCompletedDocuments = useMemo(() => {
    return completedDocuments.filter((doc) => doc.user_id === currentUserId);
  }, [completedDocuments, currentUserId]);

  const purchasedCompletedDocuments = useMemo(() => {
    return completedDocuments.filter(
      (doc) =>
        doc.user_id !== currentUserId &&
        creditState.purchasedDocumentIds.includes(doc.id)
    );
  }, [completedDocuments, creditState.purchasedDocumentIds, currentUserId]);

  const availablePurchasedDocuments = useMemo(() => {
    return [...ownedCompletedDocuments, ...purchasedCompletedDocuments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [ownedCompletedDocuments, purchasedCompletedDocuments]);

  const purchaseTransactions = useMemo(() => {
    const titleById = new Map(documents.map((doc) => [doc.id, formatDocumentTitle(doc)]));

    return creditState.transactions
      .filter(
        (tx) =>
          tx.transaction_type === "purchase" &&
          typeof tx.document_id === "string" &&
          tx.document_id.length > 0
      )
      .map((tx) => ({
        ...tx,
        documentTitle: titleById.get(tx.document_id ?? "") ?? "Completed document",
      }));
  }, [creditState.transactions, documents]);

  const totalCreditsSpent = useMemo(() => {
    return purchaseTransactions.reduce((total, tx) => total + Math.abs(tx.amount), 0);
  }, [purchaseTransactions]);
  const canManageBilling = Boolean(permissionMap?.can_manage_billing);
  const billingLabel =
    creditState.billingScope === "company"
      ? `${creditState.companyName || "Company"} billing`
      : "Personal billing";

  const handleOpenDocument = useCallback(
    async (documentId: string, confirmed = false) => {
      setActionLoadingId(documentId);
      setMessage("");

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
          throw new Error(data?.error || "Failed to open completed document.");
        }

        window.open(data.signedUrl, "_blank");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to open document.");
      } finally {
        setActionLoadingId("");
      }
    },
    [getAccessToken]
  );

  const handleBuyTestCredits = useCallback(
    async (packId: TestCreditPack["id"]) => {
      setCreditPackLoadingId(packId);
      setMessage("");

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/library/buy-credits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ packId }),
        });

        const data = (await res.json().catch(() => null)) as
          | (Partial<CreditState> & { error?: string; grantedCredits?: number })
          | null;

        if (!res.ok) {
          throw new Error(data?.error || "Failed to add test credits.");
        }

        setCreditState((prev) => ({
          ...prev,
          creditBalance: Number(data?.creditBalance ?? prev.creditBalance),
          purchasedDocumentIds: Array.isArray(data?.purchasedDocumentIds)
            ? data.purchasedDocumentIds.filter(
                (value): value is string => typeof value === "string"
              )
            : prev.purchasedDocumentIds,
          transactions: Array.isArray(data?.transactions)
            ? data.transactions.filter(
                (value): value is CreditTransaction =>
                  Boolean(value) &&
                  typeof value === "object" &&
                  typeof (value as CreditTransaction).id === "string"
              )
            : prev.transactions,
          ledgerEnabled: Boolean(data?.ledgerEnabled ?? prev.ledgerEnabled),
          billingScope:
            data?.billingScope === "company"
              ? "company"
              : (prev.billingScope ?? "user"),
          companyId:
            typeof data?.companyId === "string" ? data.companyId : prev.companyId,
          companyName:
            typeof data?.companyName === "string"
              ? data.companyName
              : prev.companyName,
        }));
        setMessage(
          `Added ${Number(data?.grantedCredits ?? 0)} test credits to your account.`
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to add test credits."
        );
      } finally {
        setCreditPackLoadingId("");
      }
    },
    [getAccessToken]
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Completed Documents"
        title="My Purchases"
        description="Open approved files you own or unlocked with credits, and keep a clean audit trail of balance, purchases, and access."
        actions={
          <>
            <Link
              href="/library"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Browse Marketplace
            </Link>
            <Link
              href="/search"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Search Records
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Available Credits"
          value={String(creditState.creditBalance)}
          note={
            creditState.ledgerEnabled
              ? `${billingLabel} tracked by credit ledger`
              : `${billingLabel} using fallback storage`
          }
        />
        <StatCard
          title="Unlocked Documents"
          value={String(availablePurchasedDocuments.length)}
          note="Completed documents ready to open"
        />
        <StatCard
          title="Owned Finals"
          value={String(ownedCompletedDocuments.length)}
          note="Documents approved from your own submissions"
        />
        <StatCard
          title="Credits Spent"
          value={String(totalCreditsSpent)}
          note={`${purchaseTransactions.length} marketplace purchase${purchaseTransactions.length === 1 ? "" : "s"}`}
        />
      </section>

      <SectionCard
        title="Buy Test Credits"
        description="Use these in-app packs to simulate credit purchases without real payment processing."
        aside={
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {billingLabel}: {creditState.creditBalance}
          </div>
        }
      >
        {!canManageBilling ? (
          <InlineMessage tone="warning">
            Your current role can view completed documents and credit history, but only billing-enabled roles can add credits or unlock marketplace files.
          </InlineMessage>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {TEST_CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {pack.label}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">{pack.note}</p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {pack.credits} credits
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleBuyTestCredits(pack.id)}
                  disabled={creditPackLoadingId === pack.id}
                  className="mt-5 inline-flex rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creditPackLoadingId === pack.id ? "Adding..." : "Add Test Credits"}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {message ? (
        <InlineMessage tone={message.toLowerCase().includes("failed") ? "error" : "success"}>
          {message}
        </InlineMessage>
      ) : null}

      <SectionCard
        title="Unlocked Completed Documents"
        description="Final deliverables you can open right now."
        aside={
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Subscription: {creditState.subscriptionStatus} ({billingLabel})
          </div>
        }
      >
        {loading ? (
          <InlineMessage>Loading your purchases...</InlineMessage>
        ) : availablePurchasedDocuments.length === 0 ? (
          <EmptyState
            title="No completed documents unlocked yet"
            description="Visit the library marketplace or wait for one of your submissions to be approved."
            actionHref="/library"
            actionLabel="Open Marketplace"
          />
        ) : (
          <div className="space-y-4">
            {availablePurchasedDocuments.map((doc) => {
              const ownedByUser = doc.user_id === currentUserId;

              return (
                <div
                  key={doc.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {formatDocumentTitle(doc)}
                      </h3>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          ownedByUser
                            ? "bg-sky-100 text-sky-700"
                            : "bg-emerald-100 text-emerald-700",
                        ].join(" ")}
                      >
                        {ownedByUser ? "Your Approved File" : "Purchased"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {doc.document_type ?? "Completed document"}
                      {doc.project_name ? ` • ${doc.project_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Added {formatRelative(doc.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPendingDocumentId(doc.id)}
                    disabled={actionLoadingId === doc.id}
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoadingId === doc.id ? "Opening..." : "Open Document"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Purchase History"
          description="Your recent marketplace unlocks and the credits each one used."
        >
          {purchaseTransactions.length === 0 ? (
            <EmptyState
              title="No marketplace purchases yet"
              description="Unlock a completed document from the library to start your purchase history."
            />
          ) : (
            <div className="space-y-4">
              {purchaseTransactions.slice(0, 8).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {tx.documentTitle}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {tx.description || "Marketplace purchase"} • {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {Math.abs(tx.amount)} credits
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <StartChecklist
          title="Purchase Checklist"
          items={[
            { label: "Have credits available", done: creditState.creditBalance > 0 },
            { label: "Unlock or own at least one completed file", done: availablePurchasedDocuments.length > 0 },
            { label: "Review transaction history", done: creditState.transactions.length > 0 },
            { label: "Open a completed document", done: availablePurchasedDocuments.length > 0 },
          ]}
        />
      </section>

      <SectionCard
        title="Recent Credit Activity"
        description="Grants and purchases affecting your current balance."
        aside={
          <Link
            href="/library"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open Library
          </Link>
        }
      >
        {creditState.transactions.length === 0 ? (
          <EmptyState
            title="No credit activity yet"
            description="Grants and purchases will appear here once credits are added or used."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {creditState.transactions.slice(0, 6).map((tx) => {
              const doc = documents.find((item) => item.id === tx.document_id);
              const purchaseCost = doc ? getDocumentCreditCost(doc.notes) : Math.abs(tx.amount);

              return (
                <div
                  key={tx.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
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
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                    </span>
                  </div>
                  {doc && (
                    <p className="mt-3 text-sm text-slate-600">
                      {formatDocumentTitle(doc)}
                      {tx.amount < 0 ? ` • ${purchaseCost} credit unlock` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <DownloadConfirmModal
        open={Boolean(pendingDocumentId)}
        loading={Boolean(pendingDocumentId) && actionLoadingId === pendingDocumentId}
        onCancel={() => {
          setPendingDocumentId("");
          setActionLoadingId("");
        }}
        onConfirm={() => {
          const documentId = pendingDocumentId;
          void handleOpenDocument(documentId, true).then(() => {
            setPendingDocumentId("");
          });
        }}
      />
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}
