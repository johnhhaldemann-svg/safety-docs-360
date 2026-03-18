"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreditTransaction } from "@/lib/credits";
import { getDocumentCreditCost } from "@/lib/marketplace";

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
};

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
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [creditState, setCreditState] = useState<CreditState>({
    creditBalance: 0,
    purchasedDocumentIds: [],
    subscriptionStatus: "inactive",
    transactions: [],
    ledgerEnabled: false,
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
        documentsResult,
        creditsResponse,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("documents").select("*").order("created_at", { ascending: false }),
        fetch("/api/library/credits", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      setCurrentUserId(user?.id ?? "");

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

  const handleOpenDocument = useCallback(
    async (documentId: string) => {
      setActionLoadingId(documentId);
      setMessage("");

      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/library/access/${documentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
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

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Completed Documents
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              My Purchases
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Open the finished documents you own or unlocked with credits, and keep an eye on your balance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Available Credits"
          value={String(creditState.creditBalance)}
          note={creditState.ledgerEnabled ? "Tracked by credit ledger" : "Using fallback storage"}
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

      {message && (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-700 shadow-sm">
          {message}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Unlocked Completed Documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              Final deliverables you can open right now.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Subscription: {creditState.subscriptionStatus}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Loading your purchases...
          </div>
        ) : availablePurchasedDocuments.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No completed documents are unlocked yet. Visit the marketplace in the library to purchase one.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
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
                    onClick={() => void handleOpenDocument(doc.id)}
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
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Purchase History</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your recent marketplace unlocks and the credits each one used.
          </p>

          {purchaseTransactions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No marketplace purchases yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Credit Tips</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quick context for how completed document purchases work.
          </p>

          <div className="mt-6 space-y-4">
            <TipCard
              title="Owned approvals stay here"
              body="When your own submitted document gets approved, it appears in this page automatically."
            />
            <TipCard
              title="Marketplace purchases unlock forever"
              body="Once you spend credits on a completed document, it stays in your unlocked list."
            />
            <TipCard
              title="Pricing comes from the document"
              body="Each marketplace document can have its own credit cost set by the admin team."
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Recent Credit Activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Grants and purchases affecting your current balance.
            </p>
          </div>
          <Link
            href="/library"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open Library
          </Link>
        </div>

        {creditState.transactions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No credit activity yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
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
      </section>
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

function TipCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
